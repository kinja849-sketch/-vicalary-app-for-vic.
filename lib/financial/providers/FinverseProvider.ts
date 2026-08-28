import {
  BankingProvider,
  FinancialInstitution,
  BankConnectionSession,
  BankAccount,
  BankTransaction
} from '../BankingProvider';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

const FINVERSE_CUSTOMER_APP_ID = process.env.FINVERSE_CUSTOMER_APP_ID;
const FINVERSE_CLIENT_ID = process.env.FINVERSE_CLIENT_ID;
const FINVERSE_CLIENT_SECRET = process.env.FINVERSE_CLIENT_SECRET;
const FINVERSE_API_URL = 'https://api.prod.finverse.net';

export class FinverseProvider implements BankingProvider {
  readonly id = 'finverse';
  readonly name = 'Finverse';

  private supportedCountries = ['ID', 'PH', 'TH', 'VN', 'SG', 'MY'];
  
  async isCountrySupported(countryCode: string): Promise<boolean> {
    return this.supportedCountries.includes(countryCode.toUpperCase());
  }

  private alpha2ToAlpha3: Record<string, string> = {
    'ID': 'IDN', 'PH': 'PHL', 'TH': 'THA', 'VN': 'VNM', 'SG': 'SGP', 'MY': 'MYS'
  };

  async getInstitutions(countryCode: string): Promise<FinancialInstitution[]> {
    if (!await this.isCountrySupported(countryCode)) {
      return [];
    }
    
    try {
      const token = await this.getCustomerToken();
      const response = await fetch(`${FINVERSE_API_URL}/institutions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.warn('Finverse getInstitutions error', await response.text());
        return [];
      }
      
      const data = await response.json();
      const targetCountry3 = this.alpha2ToAlpha3[countryCode.toUpperCase()] || countryCode.toUpperCase();
      
      const institutionsArray = Array.isArray(data) ? data : (data.institutions || []);
      
      return institutionsArray
        .filter((inst: any) => inst.countries && inst.countries.includes(targetCountry3))
        .map((inst: any) => ({
          institution_id: inst.institution_id || inst.id,
          name: inst.institution_name || inst.name,
          provider: this.id,
          country_code: countryCode.toUpperCase(),
          logo_url: inst.logo_url || null
        }));
    } catch (e) {
      console.error('Failed to fetch Finverse institutions:', e);
      return [];
    }
  }

  async getCustomerToken(): Promise<string> {
    if (!FINVERSE_CLIENT_ID || !FINVERSE_CLIENT_SECRET) {
      throw new Error("Finverse credentials missing");
    }

    const response = await fetch(`${FINVERSE_API_URL}/auth/customer/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: FINVERSE_CLIENT_ID,
        client_secret: FINVERSE_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Finverse Auth Error: ${err}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async createConnection(userId: string, countryCode: string, metadata?: any): Promise<BankConnectionSession> {
    return {
      linkToken: 'unsupported_direct',
      provider: this.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString()
    };
  }

  async exchangePublicToken(userId: string, publicToken: string, metadata?: any): Promise<string> {
    const supabase = createAdminSupabaseClient();
    
    const { data, error } = await supabase
      .from('bank_connections')
      .upsert({
        user_id: userId,
        provider: this.id,
        encrypted_access_token: publicToken,
        provider_item_id: metadata?.bankId || 'finverse_bank',
        status: 'active',
        last_successful_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider_item_id' })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error("Failed to save connection: " + error?.message);
    }
    return data.id;
  }

  async getAccounts(connectionId: string): Promise<BankAccount[]> {
    return [];
  }

  async getTransactions(connectionId: string, startDate: Date, endDate: Date): Promise<BankTransaction[]> {
    return [];
  }
}
