import { BankingProvider } from './BankingProvider';
import { PlaidProvider } from './providers/PlaidProvider';
import { FinverseProvider } from './providers/FinverseProvider';

export class BankingProviderRouter {
  private providers: Map<string, BankingProvider> = new Map();

  constructor() {
    // Register available providers
    this.registerProvider(new PlaidProvider());
    this.registerProvider(new FinverseProvider());
  }

  private registerProvider(provider: BankingProvider) {
    this.providers.set(provider.id, provider);
  }

  /**
   * Automatically select the best supported provider for a given country
   */
  async getBestProviderForCountry(countryCode: string): Promise<BankingProvider | null> {
    for (const provider of this.providers.values()) {
      if (await provider.isCountrySupported(countryCode)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Get a specific provider by its ID
   */
  getProvider(providerId: string): BankingProvider | undefined {
    return this.providers.get(providerId);
  }
}

// Singleton instance
export const bankingRouter = new BankingProviderRouter();
