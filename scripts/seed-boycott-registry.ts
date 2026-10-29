import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import {
  buildFullBrandRelationships,
  CANONICAL_CAMPAIGN_TARGETS,
  normalizeEntityKey
} from '../lib/scanner/boycottRegistryData';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seedBoycottRegistry() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL or DIRECT_URL in .env.local');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[SeedBoycottRegistry] Connected to Supabase Postgres.');

    // 1. Apply idempotent SQL migration
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261029_boycott_parent_first_registry.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migrationSql);
    console.log('[SeedBoycottRegistry] Applied migration 20261029_boycott_parent_first_registry.sql');

    // 2. Upsert active boycott campaign
    const campaignName = 'Global Ethical & Corporate Responsibility Watch';
    const campaignRes = await client.query(
      `
      INSERT INTO public.boycott_campaigns (name, organization, description, source_url, status, updated_at)
      VALUES ($1, $2, $3, $4, 'active', now())
      ON CONFLICT (name) DO UPDATE
        SET organization = EXCLUDED.organization,
            description = EXCLUDED.description,
            source_url = EXCLUDED.source_url,
            status = 'active',
            updated_at = now()
      RETURNING id;
      `,
      [
        campaignName,
        'BDS Movement / Corporate Accountability Watch',
        'Parent-first corporate ownership and ethical consumer boycott registry.',
        'https://bdsmovement.net'
      ]
    );
    const campaignId = campaignRes.rows[0].id;
    console.log(`[SeedBoycottRegistry] Active Campaign ID: ${campaignId}`);

    // 3. Upsert canonical parent campaign_targets
    let targetCount = 0;
    for (const target of CANONICAL_CAMPAIGN_TARGETS) {
      const normalizedName = normalizeEntityKey(target.companyName);
      await client.query(
        `
        INSERT INTO public.campaign_targets
          (campaign_id, company_name, normalized_name, aliases, target_type, reason, source_url, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (campaign_id, company_name) DO UPDATE
          SET normalized_name = EXCLUDED.normalized_name,
              aliases = EXCLUDED.aliases,
              target_type = EXCLUDED.target_type,
              reason = EXCLUDED.reason,
              source_url = EXCLUDED.source_url,
              verified_at = now();
        `,
        [
          campaignId,
          target.companyName,
          normalizedName,
          target.aliases,
          target.targetType,
          target.reason,
          target.sourceUrl
        ]
      );
      targetCount++;
    }
    console.log(`[SeedBoycottRegistry] Upserted ${targetCount} canonical parent campaign_targets.`);

    // 4. Upsert full A–Z + additional brand -> parent relationships
    const allRelationships = buildFullBrandRelationships();
    let verifiedCount = 0;
    let unverifiedCount = 0;

    for (const rel of allRelationships) {
      await client.query(
        `DELETE FROM public.company_relationships WHERE brand_name = $1 AND parent_company <> $2`,
        [rel.brandName, rel.parentCompany]
      );
      await client.query(
        `
        INSERT INTO public.company_relationships
          (brand_name, normalized_brand, parent_company, normalized_parent, raw_parent_text, relationship_type, notes, source_url, verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        ON CONFLICT (brand_name, parent_company) DO UPDATE
          SET normalized_brand = EXCLUDED.normalized_brand,
              normalized_parent = EXCLUDED.normalized_parent,
              raw_parent_text = EXCLUDED.raw_parent_text,
              relationship_type = EXCLUDED.relationship_type,
              notes = EXCLUDED.notes,
              source_url = EXCLUDED.source_url,
              verified_at = now();
        `,
        [
          rel.brandName,
          rel.normalizedBrand,
          rel.parentCompany,
          rel.normalizedParent,
          rel.rawParentText,
          rel.relationshipType,
          rel.notes,
          rel.sourceUrl
        ]
      );

      if (rel.relationshipType === 'unverified') {
        unverifiedCount++;
      } else {
        verifiedCount++;
      }
    }

    // Reload PostgREST schema cache
    await client.query(`NOTIFY pgrst, 'reload schema';`);

    console.log(
      `[SeedBoycottRegistry] Upserted ${allRelationships.length} company_relationships (${verifiedCount} verified parent links, ${unverifiedCount} unverified guard rows).`
    );
  } finally {
    await client.end();
  }
}

seedBoycottRegistry().catch(err => {
  console.error('[SeedBoycottRegistry] Fatal error:', err);
  process.exit(1);
});
