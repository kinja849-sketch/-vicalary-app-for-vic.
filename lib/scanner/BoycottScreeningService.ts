import { BoycottStatus } from './types';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export class BoycottScreeningService {
  /**
   * Evaluates brand and its parent corporate entities against verified boycott campaigns.
   * Completely evidence-driven. Never infers from rumors or models.
   */
  static async screenBrand(brandName: string, userId?: string): Promise<BoycottStatus> {
    if (!brandName || brandName.trim().length === 0) {
      return { flagged: false };
    }

    const supabase = createServerSupabaseClient();
    const cleanBrand = brandName.trim();

    try {
      // 1. Resolve relevant campaign IDs: check user's followed campaigns first,
      // fallback to all active campaigns in boycott_campaigns so unconfigured users are protected.
      let campaignIds: string[] = [];

      if (userId) {
        const { data: userPrefs } = await supabase
          .from('user_campaign_preferences')
          .select('campaign_id')
          .eq('user_id', userId);

        if (userPrefs && userPrefs.length > 0) {
          campaignIds = userPrefs.map(p => p.campaign_id);
        }
      }

      if (campaignIds.length === 0) {
        const { data: activeCampaigns } = await supabase
          .from('boycott_campaigns')
          .select('id')
          .eq('status', 'active');

        if (activeCampaigns && activeCampaigns.length > 0) {
          campaignIds = activeCampaigns.map(c => c.id);
        }
      }

      // 2. Direct Brand Check in campaign_targets
      let directQuery = supabase
        .from('campaign_targets')
        .select('*, boycott_campaigns(name)')
        .ilike('company_name', cleanBrand)
        .limit(1);

      if (campaignIds.length > 0) {
        directQuery = directQuery.in('campaign_id', campaignIds);
      }

      const { data: directTarget } = await directQuery.maybeSingle();

      if (directTarget) {
        return {
          flagged: true,
          companyName: directTarget.company_name,
          campaignId: directTarget.campaign_id,
          campaignName: (directTarget as any).boycott_campaigns?.name || 'Active Campaign',
          reason: directTarget.reason || 'Direct campaign target',
          relationshipType: (directTarget.target_type as any) || 'direct',
          sourceUrl: directTarget.source_url,
          verifiedAt: directTarget.verified_at
        };
      }

      // 3. Parent Company Check via company_relationships
      const { data: relation } = await supabase
        .from('company_relationships')
        .select('*')
        .ilike('brand_name', cleanBrand)
        .limit(1)
        .maybeSingle();

      if (relation && relation.parent_company) {
        let parentQuery = supabase
          .from('campaign_targets')
          .select('*, boycott_campaigns(name)')
          .ilike('company_name', relation.parent_company)
          .limit(1);

        if (campaignIds.length > 0) {
          parentQuery = parentQuery.in('campaign_id', campaignIds);
        }

        const { data: parentTarget } = await parentQuery.maybeSingle();

        if (parentTarget) {
          return {
            flagged: true,
            companyName: cleanBrand,
            parentCompany: relation.parent_company,
            campaignId: parentTarget.campaign_id,
            campaignName: (parentTarget as any).boycott_campaigns?.name || 'Active Campaign',
            reason: `Parent company (${relation.parent_company}) is flagged: ${parentTarget.reason || 'Documented campaign target'}`,
            relationshipType: 'parent',
            sourceUrl: parentTarget.source_url || relation.source_url,
            verifiedAt: parentTarget.verified_at
          };
        }
      }

      // 4. Check companies table for documented affiliations
      const { data: companyRecord } = await supabase
        .from('companies')
        .select('*')
        .ilike('name', cleanBrand)
        .limit(1)
        .maybeSingle();

      if (companyRecord && (companyRecord.israel_affiliated || companyRecord.invest_israel)) {
        return {
          flagged: true,
          companyName: companyRecord.name,
          parentCompany: (companyRecord as any).parent_company_id ? undefined : undefined,
          campaignName: 'Corporate Responsibility Watch',
          reason: companyRecord.justification || companyRecord.notes || 'Documented commercial investment in occupied territories',
          relationshipType: companyRecord.affiliation_type || 'direct',
          sourceUrl: (companyRecord.data_sources && companyRecord.data_sources[0]) || 'https://bdsmovement.net',
          verifiedAt: companyRecord.updated_at || companyRecord.created_at
        };
      }

      return { flagged: false };
    } catch (err) {
      console.error("[BoycottScreeningService] Error screening brand:", err);
      return { flagged: false };
    }
  }
}
