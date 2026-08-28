import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';
import { supabase } from '@/lib/supabase';
import {
  BankingProvider,
  FinancialInstitution,
  BankConnectionSession,
  BankAccount,
  BankTransaction
} from '../BankingProvider';

// Configure Plaid Client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export class PlaidProvider implements BankingProvider {
  readonly id = 'plaid';
  readonly name = 'Plaid';

  // Plaid natively supports US, CA, UK, and some EU countries
  private supportedCountries = ['US', 'CA', 'GB', 'FR', 'ES', 'IE', 'NL', 'DE'];

  async isCountrySupported(countryCode: string): Promise<boolean> {
    return this.supportedCountries.includes(countryCode.toUpperCase());
  }

  async getInstitutions(countryCode: string): Promise<FinancialInstitution[]> {
    // In a real app, this might query /institutions/get, but for UI rendering before linking
    // it's usually better to just launch Plaid Link and let it handle the UI.
    // We return an empty array indicating Plaid Link handles the UI natively.
    return [];
  }

  async createConnection(userId: string, countryCode: string): Promise<BankConnectionSession> {
    try {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'VicCalary',
        products: [Products.Transactions],
        country_codes: [countryCode.toUpperCase() as CountryCode],
        language: 'en',
      });

      return {
        linkToken: response.data.link_token,
        provider: this.id,
        expiresAt: response.data.expiration
      };
    } catch (error) {
      console.error("[PlaidProvider] Error creating link token:", error);
      throw new Error("Failed to initialize secure bank connection");
    }
  }

  async exchangePublicToken(userId: string, publicToken: string, metadata?: any): Promise<string> {
    try {
      // 1. Exchange public token for access token
      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = response.data.access_token;
      const itemId = response.data.item_id;

      // 2. Securely store the access token in the database
      // NEVER send this token back to the frontend
      const { data, error } = await supabase
        .from('bank_connections')
        .insert({
          user_id: userId,
          provider: this.id,
          encrypted_access_token: accessToken, // In production, this should be further encrypted before DB
          provider_item_id: itemId,
          status: 'active',
          last_successful_sync: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error("Failed to save secure bank connection: " + error?.message);
      }

      return data.id;
    } catch (error) {
      console.error("[PlaidProvider] Error exchanging token:", error);
      throw new Error("Bank authorization failed");
    }
  }

  async getAccounts(connectionId: string): Promise<BankAccount[]> {
    // Fetch the access token securely from the backend
    const accessToken = await this.getAccessToken(connectionId);

    const response = await plaidClient.accountsGet({
      access_token: accessToken
    });

    return response.data.accounts.map(acc => ({
      accountId: acc.account_id,
      name: acc.name,
      mask: acc.mask || '****',
      type: acc.type,
      subtype: acc.subtype || 'unknown',
      currency: acc.balances.iso_currency_code || 'USD',
      currentBalance: acc.balances.current || 0,
      availableBalance: acc.balances.available || acc.balances.current || 0
    }));
  }

  async getTransactions(connectionId: string, startDate: Date, endDate: Date): Promise<BankTransaction[]> {
    const accessToken = await this.getAccessToken(connectionId);
    
    // Use Plaid's transactions/get endpoint
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    return response.data.transactions.map(t => ({
      transactionId: t.transaction_id,
      accountId: t.account_id,
      amount: t.amount,
      currency: t.iso_currency_code || 'USD',
      date: t.date,
      name: t.name,
      merchantName: t.merchant_name || undefined,
      category: t.category || [],
      pending: t.pending
    }));
  }

  /**
   * Internal helper to securely fetch the access token
   */
  private async getAccessToken(connectionId: string): Promise<string> {
    const { data, error } = await supabase
      .from('bank_connections')
      .select('encrypted_access_token')
      .eq('id', connectionId)
      .single();

    if (error || !data?.encrypted_access_token) {
      throw new Error("Secure bank connection not found or unauthorized");
    }

    return data.encrypted_access_token;
  }
}
