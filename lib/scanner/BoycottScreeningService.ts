import { BoycottStatus } from './types';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  buildFullBrandRelationships,
  CANONICAL_CAMPAIGN_TARGETS,
  CANONICAL_PARENT_MAP,
  normalizeBaseCorporateKey,
  normalizeEntityKey,
  ParsedBrandRelationship
} from './boycottRegistryData';

interface CachedBoycottRegistry {
  loadedAt: number;
  relationshipsByBrand: Map<string, ParsedBrandRelationship[]>;
  allVerifiedRelationships: ParsedBrandRelationship[];
  targets: Array<{
    id?: string;
    campaignId?: string;
    campaignName: string;
    companyName: string;
    normalizedName: string;
    baseCorporateKey: string;
    aliasesNormalized: string[];
    targetType: string;
    reason: string;
    sourceUrl: string;
    verifiedAt?: string;
  }>;
}

/**
 * Words that are common English/product terms or marked multi-owner in the registry;
 * these must NOT be inferred from `productName` alone when `brandName` is empty,
 * preventing false-positive flags on generic product titles (e.g. "Crystal Spring Water", "Pure Silk", "Extra Virgin Olive Oil").
 */
const AMBIGUOUS_NAME_TOKEN_EXCLUSIONS = new Set<string>([
  '18 70',
  'action',
  'advance',
  'aha',
  'aqua',
  'bare',
  'boost',
  'bounty',
  'chunk',
  'comfort',
  'continental',
  'country club',
  'crystal',
  'dfs',
  'dove',
  'drive me',
  'el aguila',
  'elite',
  'everyday',
  'evolve',
  'extra',
  'feast',
  'field day',
  'fiesta',
  'flash',
  'freeway',
  'galaxy',
  'globus',
  'gloria',
  'hayat',
  'kisses',
  'lux',
  'mallo',
  'munchies',
  'one',
  'orbit',
  'prince',
  'pump',
  'sao',
  'savanna',
  'silk',
  'smarties',
  'stride',
  'sunlight',
  'sure',
  'surf',
  'toma',
  'trix',
  'ultima',
  'ultimates',
  'urge',
  'ventura',
  'vilas',
  'vim',
  'vio',
  'vital',
  'vitale',
  'viva',
  'york',
  'yumyum'
]);

export class BoycottScreeningService {
  private static registryCache: CachedBoycottRegistry | null = null;
  private static readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

  /**
   * Clears in-memory registry cache (useful after seeding or in tests).
   */
  static clearCache() {
    this.registryCache = null;
  }

  /**
   * Splits an Open Food Facts or catalog brand string (e.g. "Mondelēz, Oreo" or "Ferrero; Nutella")
   * into ordered candidate brand strings.
   */
  static extractBrandCandidates(brandName?: string): string[] {
    if (!brandName || !brandName.trim()) return [];
    const raw = brandName.trim();
    const candidates: string[] = [];

    const addCandidate = (val: string) => {
      const cleaned = val.trim();
      if (cleaned && !candidates.includes(cleaned)) {
        candidates.push(cleaned);
      }
      // Also strip parenthetical qualifier if present, e.g. "Bounty (Mars)" -> "Bounty"
      const withoutParen = cleaned.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      if (withoutParen && withoutParen !== cleaned && !candidates.includes(withoutParen)) {
        candidates.push(withoutParen);
      }
    };

    // Split on comma, semicolon, or slash first so specific sub-brands in OFF ("Mondelez, Oreo") are evaluated cleanly
    const parts = raw.split(/[,;/|]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      // Prefer the most specific brand token (often the sub-brand in OFF lists) as well as all tokens
      for (const part of parts) {
        addCandidate(part);
      }
    }
    addCandidate(raw);

    return candidates;
  }

  /**
   * Loads `company_relationships` and `campaign_targets` from Supabase merged with the canonical seed baseline.
   * Any future rows inserted into Supabase `company_relationships` or `campaign_targets` are automatically included.
   */
  private static async loadRegistry(supabase: any, campaignIds: string[]): Promise<CachedBoycottRegistry> {
    const now = Date.now();
    if (this.registryCache && campaignIds.length === 0 && now - this.registryCache.loadedAt < this.CACHE_TTL_MS) {
      return this.registryCache;
    }

    const relationshipsMap = new Map<string, ParsedBrandRelationship[]>();
    const pushRelationship = (rel: ParsedBrandRelationship) => {
      if (!rel.normalizedBrand) return;
      const list = relationshipsMap.get(rel.normalizedBrand) || [];
      if (!list.some(r => r.normalizedParent === rel.normalizedParent && r.relationshipType === rel.relationshipType)) {
        list.push(rel);
        relationshipsMap.set(rel.normalizedBrand, list);
      }
    };

    // 1. Seed baseline relationships (guarantees deterministic coverage even if DB is mid-migration)
    for (const rel of buildFullBrandRelationships()) {
      pushRelationship(rel);
    }

    // 2. Load persisted `company_relationships` from Supabase (includes any newly added DB rows)
    try {
      const { data: dbRels } = await supabase
        .from('company_relationships')
        .select('*')
        .limit(2000);

      if (Array.isArray(dbRels)) {
        for (const row of dbRels) {
          const normBrand = row.normalized_brand || normalizeEntityKey(row.brand_name);
          const canonicalParent =
            CANONICAL_PARENT_MAP[normalizeEntityKey(row.parent_company)] || row.parent_company;
          const normParent = row.normalized_parent || normalizeEntityKey(canonicalParent);
          pushRelationship({
            brandName: row.brand_name,
            normalizedBrand: normBrand,
            parentCompany: canonicalParent,
            normalizedParent: normParent,
            rawParentText: row.raw_parent_text || row.parent_company,
            relationshipType: (row.relationship_type as any) || 'subsidiary',
            notes: row.notes || null,
            sourceUrl: row.source_url || 'https://bdsmovement.net'
          });
        }
      }
    } catch (e) {
      // Continue with canonical baseline if DB query fails
    }

    // 3. Load `campaign_targets` from Supabase merged with canonical targets
    const targetsMap = new Map<string, CachedBoycottRegistry['targets'][number]>();

    for (const t of CANONICAL_CAMPAIGN_TARGETS) {
      const normName = normalizeEntityKey(t.companyName);
      targetsMap.set(normName, {
        campaignName: 'Global Ethical & Corporate Responsibility Watch',
        companyName: t.companyName,
        normalizedName: normName,
        baseCorporateKey: normalizeBaseCorporateKey(t.companyName),
        aliasesNormalized: (t.aliases || []).map(a => normalizeEntityKey(a)).filter(Boolean),
        targetType: t.targetType,
        reason: t.reason,
        sourceUrl: t.sourceUrl
      });
    }

    try {
      let targetQuery = supabase
        .from('campaign_targets')
        .select('*, boycott_campaigns(name)');

      if (campaignIds.length > 0) {
        targetQuery = targetQuery.in('campaign_id', campaignIds);
      }

      const { data: dbTargets } = await targetQuery;
      if (Array.isArray(dbTargets) && dbTargets.length > 0) {
        for (const row of dbTargets) {
          const canonicalName =
            CANONICAL_PARENT_MAP[normalizeEntityKey(row.company_name)] || row.company_name;
          const normName = row.normalized_name || normalizeEntityKey(canonicalName);
          const existing = targetsMap.get(normName);
          const dbAliases = Array.isArray(row.aliases)
            ? row.aliases.map((a: string) => normalizeEntityKey(a)).filter(Boolean)
            : [];
          const mergedAliases = Array.from(
            new Set([
              ...(existing?.aliasesNormalized || []),
              ...dbAliases,
              normalizeEntityKey(row.company_name)
            ])
          );

          targetsMap.set(normName, {
            id: row.id,
            campaignId: row.campaign_id,
            campaignName:
              (row as any).boycott_campaigns?.name ||
              existing?.campaignName ||
              'Global Ethical & Corporate Responsibility Watch',
            companyName: canonicalName,
            normalizedName: normName,
            baseCorporateKey: normalizeBaseCorporateKey(canonicalName),
            aliasesNormalized: mergedAliases,
            targetType: row.target_type || existing?.targetType || 'parent',
            reason: row.reason || existing?.reason || 'Documented campaign target',
            sourceUrl: row.source_url || existing?.sourceUrl || 'https://bdsmovement.net',
            verifiedAt: row.verified_at
          });
        }
      }
    } catch (e) {
      // Continue with canonical targets if DB query fails
    }

    const allVerifiedRelationships: ParsedBrandRelationship[] = [];
    for (const list of relationshipsMap.values()) {
      for (const item of list) {
        if (item.relationshipType !== 'unverified' && item.normalizedParent !== 'unverified') {
          allVerifiedRelationships.push(item);
        }
      }
    }
    // Sort longest brand first for deterministic token matching
    allVerifiedRelationships.sort((a, b) => b.normalizedBrand.length - a.normalizedBrand.length);

    const built: CachedBoycottRegistry = {
      loadedAt: now,
      relationshipsByBrand: relationshipsMap,
      allVerifiedRelationships,
      targets: Array.from(targetsMap.values())
    };

    if (campaignIds.length === 0) {
      this.registryCache = built;
    }
    return built;
  }

  /**
   * Matches a company/parent name against loaded `campaign_targets` using:
   * 1. Exact normalized name match
   * 2. Normalized alias match
   * 3. Canonical parent map match
   * 4. Base corporate name match (e.g. "The Coca-Cola Company" <-> "Coca-Cola", "Nestlé S.A." <-> "Nestle")
   */
  private static matchCampaignTarget(
    companyOrParentName: string,
    registry: CachedBoycottRegistry
  ): CachedBoycottRegistry['targets'][number] | null {
    const norm = normalizeEntityKey(companyOrParentName);
    if (!norm || norm === 'unverified') return null;

    const canonicalMapped = CANONICAL_PARENT_MAP[norm];
    const normCanonical = canonicalMapped ? normalizeEntityKey(canonicalMapped) : norm;
    const baseKey = normalizeBaseCorporateKey(canonicalMapped || companyOrParentName);

    for (const target of registry.targets) {
      if (
        target.normalizedName === norm ||
        target.normalizedName === normCanonical ||
        target.aliasesNormalized.includes(norm) ||
        target.aliasesNormalized.includes(normCanonical) ||
        (baseKey.length >= 4 && target.baseCorporateKey === baseKey)
      ) {
        return target;
      }
    }

    return null;
  }

  /**
   * Regional/division corporate entity prefixes that deterministically map to a canonical parent
   * when Open Food Facts supplies a regional legal entity (e.g., "Mondelez Schweiz GmbH",
   * "Nestlé France", "Unilever Deutschland", "Danone Waters", "Ferrero Ibérica").
   */
  private static readonly CORPORATE_ENTITY_PREFIXES: Array<{ prefix: string; parentCompany: string }> = [
    { prefix: 'mondelez ', parentCompany: 'Mondelēz International' },
    { prefix: 'nestle ', parentCompany: 'Nestlé S.A.' },
    { prefix: 'unilever ', parentCompany: 'Unilever PLC' },
    { prefix: 'hindustan unilever ', parentCompany: 'Hindustan Unilever' },
    { prefix: 'danone ', parentCompany: 'Danone S.A.' },
    { prefix: 'ferrero ', parentCompany: 'Ferrero Group' },
    { prefix: 'pepsico ', parentCompany: 'PepsiCo' },
    { prefix: 'coca cola ', parentCompany: 'The Coca-Cola Company' },
    { prefix: 'the coca cola ', parentCompany: 'The Coca-Cola Company' },
    { prefix: 'kraft heinz ', parentCompany: 'Kraft Heinz' },
    { prefix: 'the kraft heinz ', parentCompany: 'Kraft Heinz' },
    { prefix: 'the hershey ', parentCompany: 'The Hershey Company' },
    { prefix: 'hershey ', parentCompany: 'The Hershey Company' },
    { prefix: 'kellanova ', parentCompany: 'Kellanova' },
    { prefix: 'procter gamble ', parentCompany: 'Procter & Gamble' },
    { prefix: 'colgate palmolive ', parentCompany: 'Colgate-Palmolive' },
    { prefix: 'reckitt ', parentCompany: 'Reckitt' },
    { prefix: 'magnum ice cream ', parentCompany: 'The Magnum Ice Cream Company' },
    { prefix: 'the magnum ice cream ', parentCompany: 'The Magnum Ice Cream Company' },
    { prefix: 'froneri ', parentCompany: 'Froneri' },
    { prefix: 'mars wrigley', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars petcare', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars food', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars chocolate', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars multisales', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars inc', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars schweiz', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars deutschland', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars france', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars uk', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars nederland', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars espana', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars italia', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars polska', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars canada', parentCompany: 'Mars, Incorporated' },
    { prefix: 'mars australia', parentCompany: 'Mars, Incorporated' },
    { prefix: 'keurig dr pepper ', parentCompany: 'Keurig Dr Pepper' },
    { prefix: 'general mills ', parentCompany: 'General Mills' },
    { prefix: 'jab holding ', parentCompany: 'JAB Holding Company' },
    { prefix: 'strauss group', parentCompany: 'Strauss Group' }
  ];

  /**
   * Resolves the full parent ownership chain for a normalized brand key (up to 4 hops).
   * Example: "Friskies" -> ["Nestlé Purina", "Nestlé S.A."]
   * Example: "Algida" -> ["The Magnum Ice Cream Company", "Unilever PLC"]
   * Example: "Oreo" -> ["Mondelēz International"]
   * Example: "Mondelez Schweiz GmbH" -> ["Mondelēz International"]
   * Returns isUnverifiedOnly: true if the brand is explicitly marked `unverified`.
   */
  private static resolveOwnershipChain(
    normBrand: string,
    registry: CachedBoycottRegistry,
    rawBrandLabel?: string
  ): {
    isUnverifiedOnly: boolean;
    matchedBrandName?: string;
    chain: ParsedBrandRelationship[];
  } {
    let directRels = registry.relationshipsByBrand.get(normBrand);

    // If not an exact brand row, check if it's a regional corporate entity of a canonical parent
    if (!directRels || directRels.length === 0) {
      const matchedPrefix = this.CORPORATE_ENTITY_PREFIXES.find(
        p => normBrand === p.prefix.trim() || normBrand.startsWith(p.prefix)
      );
      if (matchedPrefix) {
        const normParent = normalizeEntityKey(matchedPrefix.parentCompany);
        directRels = [
          {
            brandName: rawBrandLabel || normBrand,
            normalizedBrand: normBrand,
            parentCompany: matchedPrefix.parentCompany,
            normalizedParent: normParent,
            rawParentText: matchedPrefix.parentCompany,
            relationshipType: 'subsidiary',
            notes: `Regional/division entity of ${matchedPrefix.parentCompany}`,
            sourceUrl: 'https://bdsmovement.net'
          }
        ];
      }
    }

    if (!directRels || directRels.length === 0) {
      return { isUnverifiedOnly: false, chain: [] };
    }

    const verifiedRels = directRels.filter(
      r => r.relationshipType !== 'unverified' && r.normalizedParent !== 'unverified' && r.parentCompany !== 'Unverified'
    );

    if (verifiedRels.length === 0) {
      // Explicitly marked Unverified in registry -> must NEVER auto-flag
      return { isUnverifiedOnly: true, matchedBrandName: directRels[0].brandName, chain: [] };
    }

    const chain: ParsedBrandRelationship[] = [];
    const visited = new Set<string>([normBrand]);
    let currentRel = verifiedRels[0];
    chain.push(currentRel);

    // Walk up the ownership chain (up to 3 additional hops)
    for (let hop = 0; hop < 3; hop++) {
      const nextLookupKey = currentRel.normalizedParent;
      if (!nextLookupKey || visited.has(nextLookupKey)) break;
      visited.add(nextLookupKey);

      const parentRels = registry.relationshipsByBrand.get(nextLookupKey);
      if (!parentRels) break;

      const verifiedParentRel = parentRels.find(
        r =>
          r.relationshipType !== 'unverified' &&
          r.normalizedParent !== 'unverified' &&
          r.normalizedParent !== nextLookupKey
      );
      if (!verifiedParentRel) break;

      chain.push(verifiedParentRel);
      currentRel = verifiedParentRel;
    }

    return {
      isUnverifiedOnly: false,
      matchedBrandName: verifiedRels[0].brandName,
      chain
    };
  }

  /**
   * Evaluates a product's brand (and optional product name fallback) against verified boycott campaigns
   * using strict PARENT-FIRST ownership chain resolution:
   * 1. Resolve brand -> parent ownership chain via `company_relationships` (skipping `unverified` rows).
   * 2. Screen the resolved parent chain against `campaign_targets`. If any parent in the chain is targeted,
   *    return `FLAGGED` with the parent company prominently highlighted.
   * 3. Screen the direct brand against `campaign_targets` (and highlight its canonical parent entity).
   * 4. If `brandName` was empty or unmatched in `company_relationships`, optionally perform a careful
   *    word-boundary match on `productName` against verified brands -> resolve parent -> screen parent.
   */
  static async screenBrand(
    brandName: string,
    userId?: string,
    productName?: string
  ): Promise<BoycottStatus> {
    const hasBrand = Boolean(brandName && brandName.trim().length > 0);
    const hasProductName = Boolean(productName && productName.trim().length > 0);

    if (!hasBrand && !hasProductName) {
      return { flagged: false };
    }

    const supabase = createServerSupabaseClient();

    try {
      // 1. Resolve relevant campaign IDs (user preferences first, fallback to active campaigns)
      let campaignIds: string[] = [];

      if (userId && userId !== 'anon') {
        const { data: userPrefs } = await supabase
          .from('user_campaign_preferences')
          .select('campaign_id')
          .eq('user_id', userId);

        if (userPrefs && userPrefs.length > 0) {
          campaignIds = userPrefs.map((p: any) => p.campaign_id);
        }
      }

      if (campaignIds.length === 0) {
        const { data: activeCampaigns } = await supabase
          .from('boycott_campaigns')
          .select('id')
          .eq('status', 'active');

        if (activeCampaigns && activeCampaigns.length > 0) {
          campaignIds = activeCampaigns.map((c: any) => c.id);
        }
      }

      const registry = await this.loadRegistry(supabase, campaignIds);
      const brandCandidates = this.extractBrandCandidates(brandName);

      let sawExplicitUnverifiedBrand = false;

      // Helper to screen a single candidate brand string (parent-first, then direct target)
      const evaluateCandidate = (candidateRaw: string): BoycottStatus | null => {
        const normCandidate = normalizeEntityKey(candidateRaw);
        if (!normCandidate) return null;

        // ─── STEP A: PARENT-FIRST RESOLUTION VIA company_relationships ───
        const ownership = this.resolveOwnershipChain(normCandidate, registry, candidateRaw);
        if (ownership.isUnverifiedOnly) {
          sawExplicitUnverifiedBrand = true;
          return null;
        }

        if (ownership.chain.length > 0) {
          const firstLink = ownership.chain[0];
          const ultimateLink = ownership.chain[ownership.chain.length - 1];
          const notesList = ownership.chain.map(c => c.notes).filter(Boolean);
          const noteSuffix = notesList.length > 0 ? ` (Market/Ownership Note: ${notesList[0]})` : '';

          // Check ultimate parent first, then intermediate parents in the chain
          const chainToCheck = [...ownership.chain].reverse();
          for (const link of chainToCheck) {
            const matchedTarget = this.matchCampaignTarget(link.parentCompany, registry);
            if (matchedTarget) {
              const displayParent =
                ultimateLink.parentCompany !== firstLink.parentCompany
                  ? `${ultimateLink.parentCompany} (via ${firstLink.parentCompany})`
                  : matchedTarget.companyName || link.parentCompany;

              return {
                flagged: true,
                companyName: ownership.matchedBrandName || candidateRaw,
                parentCompany: displayParent,
                campaignId: matchedTarget.campaignId,
                campaignName: matchedTarget.campaignName,
                reason: `Parent company (${displayParent}) is flagged: ${matchedTarget.reason}${noteSuffix}`,
                relationshipType: firstLink.relationshipType === 'parent' ? 'parent' : 'subsidiary',
                sourceUrl: matchedTarget.sourceUrl || firstLink.sourceUrl,
                verifiedAt: matchedTarget.verifiedAt || new Date().toISOString()
              };
            }
          }
        }

        // ─── STEP B: DIRECT BRAND TARGET MATCH IN campaign_targets ───
        const directTarget = this.matchCampaignTarget(candidateRaw, registry);
        if (directTarget) {
          const canonicalParent =
            CANONICAL_PARENT_MAP[normCandidate] || directTarget.companyName;
          return {
            flagged: true,
            companyName: candidateRaw,
            parentCompany: canonicalParent,
            campaignId: directTarget.campaignId,
            campaignName: directTarget.campaignName,
            reason: `Parent company (${canonicalParent}) is an active campaign target: ${directTarget.reason}`,
            relationshipType: (directTarget.targetType as any) || 'parent',
            sourceUrl: directTarget.sourceUrl,
            verifiedAt: directTarget.verifiedAt || new Date().toISOString()
          };
        }

        return null;
      };

      // 2. Evaluate all explicit brand candidates
      for (const candidate of brandCandidates) {
        const res = evaluateCandidate(candidate);
        if (res && res.flagged) {
          return res;
        }
      }

      // If the brand was explicitly listed as "Unverified" in the registry, stop here and NEVER flag!
      if (sawExplicitUnverifiedBrand) {
        return { flagged: false };
      }

      // 3. Careful Product-Name Token Fallback (when brand is missing or unrecognized in OFF)
      if (hasProductName) {
        const normProductName = ` ${normalizeEntityKey(productName!)} `;
        for (const rel of registry.allVerifiedRelationships) {
          const bKey = rel.normalizedBrand;
          if (!bKey || bKey.length < 3) continue;
          if (AMBIGUOUS_NAME_TOKEN_EXCLUSIONS.has(bKey)) continue;

          if (normProductName.includes(` ${bKey} `)) {
            const nameMatchRes = evaluateCandidate(rel.brandName);
            if (nameMatchRes && nameMatchRes.flagged) {
              return nameMatchRes;
            }
          }
        }
      }

      // 4. Fallback check on `companies` table for documented affiliations
      if (hasBrand) {
        const cleanBrand = brandName.trim();
        const { data: companyRecord } = await supabase
          .from('companies')
          .select('*')
          .ilike('name', cleanBrand)
          .limit(1)
          .maybeSingle();

        if (companyRecord && (companyRecord.israel_affiliated || companyRecord.invest_israel)) {
          const canonicalParent =
            CANONICAL_PARENT_MAP[normalizeEntityKey(companyRecord.name)] || companyRecord.name;
          return {
            flagged: true,
            companyName: companyRecord.name,
            parentCompany: canonicalParent,
            campaignName: 'Corporate Responsibility Watch',
            reason: `Parent company (${canonicalParent}) is flagged: ${
              companyRecord.justification ||
              companyRecord.notes ||
              'Documented commercial investment in occupied territories'
            }`,
            relationshipType: companyRecord.affiliation_type || 'parent',
            sourceUrl:
              (companyRecord.data_sources && companyRecord.data_sources[0]) ||
              'https://bdsmovement.net',
            verifiedAt: companyRecord.updated_at || companyRecord.created_at
          };
        }
      }

      return { flagged: false };
    } catch (err) {
      console.error('[BoycottScreeningService] Error screening brand:', err);
      return { flagged: false };
    }
  }
}
