import { supabase } from '@/lib/supabase';

export interface UserFinancialRegion {
  id?: string;
  user_id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  locale: string;
  detected_at: string;
  detection_method: "ip" | "device" | "user_confirmed";
}

export class RegionService {
  /**
   * Automatically detects the user's region based on their IP or device settings.
   * In a real implementation, this would use Vercel's headers or an IP geolocation API.
   * For now, it returns a default or browser-based estimate.
   */
  static async detectRegion(): Promise<Omit<UserFinancialRegion, 'id' | 'user_id' | 'detected_at'>> {
    const defaultRegion = {
      country_code: 'ID',
      country_name: 'Indonesia',
      currency_code: 'IDR',
      currency_symbol: 'Rp',
      locale: 'id-ID',
      detection_method: 'ip' as const,
    };

    // If running in browser, we can try to guess from Intl
    if (typeof window !== 'undefined') {
      try {
        const locale = navigator.language;
        // Basic heuristic
        if (locale.includes('id')) {
          return {
            country_code: 'ID',
            country_name: 'Indonesia',
            currency_code: 'IDR',
            currency_symbol: 'Rp',
            locale: 'id-ID',
            detection_method: 'device',
          };
        }
      } catch (e) {
        console.warn("Region detection failed, falling back to US");
      }
    }

    return defaultRegion;
  }

  /**
   * Retrieves the confirmed financial region for a user from the database.
   */
  static async getUserRegion(userId: string): Promise<UserFinancialRegion | null> {
    const { data, error } = await supabase
      .from('user_financial_regions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserFinancialRegion;
  }

  /**
   * Saves or updates the user's confirmed financial region.
   */
  static async saveUserRegion(region: UserFinancialRegion): Promise<void> {
    const { error } = await supabase
      .from('user_financial_regions')
      .upsert({
        user_id: region.user_id,
        country_code: region.country_code,
        country_name: region.country_name,
        currency_code: region.currency_code,
        currency_symbol: region.currency_symbol,
        locale: region.locale,
        detected_at: region.detected_at,
        detection_method: region.detection_method
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error("[RegionService] Failed to save region:", error);
      throw new Error("Failed to save financial region");
    }
  }
}
