import { ScannedProduct, BoycottStatus } from './types';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export class BoycottScreeningService {
  static async screenBrand(brandName: string, userId: string): Promise<BoycottStatus> {
    const supabase = createServerSupabaseClient();
    
    // 1. Get user's followed campaigns
    const { data: prefs } = await supabase
      .from('user_campaign_preferences')
      .select('campaign_id')
      .eq('user_id', userId);
      
    if (!prefs || prefs.length === 0) {
      return { flagged: false }; // User not following any campaigns
    }
    
    const campaignIds = prefs.map(p => p.campaign_id);
    
    // 2. Check if brand is a direct target
    const { data: targetMatch } = await supabase
      .from('campaign_targets')
      .select('*, boycott_campaigns(name)')
      .in('campaign_id', campaignIds)
      .ilike('company_name', brandName)
      .limit(1)
      .maybeSingle();
      
    if (targetMatch) {
      return {
        flagged: true,
        campaignId: targetMatch.campaign_id,
        campaignName: targetMatch.boycott_campaigns?.name,
        reason: targetMatch.reason,
        relationshipType: targetMatch.target_type as any,
        sourceUrl: targetMatch.source_url,
        verifiedAt: targetMatch.verified_at
      };
    }
    
    return { flagged: false };
  }
}
