export interface FinancialInstitution {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface BankConnectionSession {
  linkToken: string;
  provider: string;
  expiresAt: string;
}

export interface BankAccount {
  accountId: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
  currency: string;
  currentBalance: number;
  availableBalance?: number;
}

export interface BankTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  currency: string;
  date: string; // ISO 8601
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
}

/**
 * Core interface for any banking provider (e.g., Plaid, Brankas, etc.)
 */
export interface BankingProvider {
  /**
   * Unique identifier for this provider (e.g., 'plaid', 'brankas')
   */
  readonly id: string;

  /**
   * Display name of the provider
   */
  readonly name: string;

  /**
   * Check if the provider supports a specific country code
   */
  isCountrySupported(countryCode: string): Promise<boolean>;

  /**
   * Retrieve available institutions for a specific country
   */
  getInstitutions(countryCode: string): Promise<FinancialInstitution[]>;

  /**
   * Initialize a connection session for a user (e.g., create a link token)
   */
  createConnection(userId: string, countryCode: string): Promise<BankConnectionSession>;

  /**
   * Exchange the public token received from the client for a permanent access token
   * The access token should NOT be returned to the client, but saved securely by this method
   * @returns The internal ID of the created bank_connection record
   */
  exchangePublicToken(userId: string, publicToken: string, metadata?: any): Promise<string>;

  /**
   * Retrieve all accounts associated with a specific connection
   */
  getAccounts(connectionId: string): Promise<BankAccount[]>;

  /**
   * Retrieve recent transactions for a specific connection
   */
  getTransactions(connectionId: string, startDate: Date, endDate: Date): Promise<BankTransaction[]>;
}
