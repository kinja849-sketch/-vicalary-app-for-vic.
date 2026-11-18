import { createAdminSupabaseClient } from '@/lib/supabase-server';

export interface GeoContext {
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
}

export interface NormalizationResult {
  monthlyBudget: number;
  dailyAllowance: number;
  currency: string;
  currencySymbol: string;
  wasConverted: boolean;
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
  exchangeRateSource: string | null;
  error: string | null;
}

export interface BudgetDiagnostics {
  userId: string;
  onboardingBudgetRaw: number | null;
  onboardingField: string | null;
  detectedFormat: 'legacy_usd' | 'current_localized' | 'unknown';
  originalCurrency: string | null;
  detectedCountry: string;
  resolvedCurrencyCode: string;
  exchangeRateSource: string | null;
  exchangeRateValue: number | null;
  convertedAmount: number | null;
  budgetPeriodStart: string | null;
  budgetPeriodEnd: string | null;
  calculatedDailyAllowance: number | null;
  todayScannerExpenses: number | null;
  remainingAmount: number | null;
  profileAlreadyNormalized: boolean;
}

// Currency symbol map for common currencies
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', IDR: 'Rp', EUR: '€', GBP: '£', JPY: '¥',
  INR: '₹', BDT: '৳', PKR: 'Rs', CNY: '¥', RUB: '₽',
  BRL: 'R$', VND: '₫', TRY: '₺', SAR: 'SR', AED: 'DH',
  KRW: '₩', MYR: 'RM', THB: '฿', PHP: '₱', SGD: 'S$',
  KES: 'KSh', SOS: 'Sh', NGN: '₦', EGP: 'E£', HUF: 'Ft',
  CLP: '$', ARS: '$', MXN: '$', COP: '$', PEN: 'S/',
  CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', CHF: 'CHF',
};

// Currencies that do not use fractional/decimal sub-units
const ZERO_DECIMAL_CURRENCIES = ['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'HUF'];

// Static fallback rates (USD base) to guarantee 100% offline and API-resilient calculations
const FALLBACK_RATES_USD_BASE: Record<string, number> = {
  USD: 1,
  IDR: 15650,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155,
  INR: 84.4,
  BDT: 119.5,
  PKR: 278,
  CNY: 7.24,
  RUB: 99.5,
  BRL: 5.75,
  VND: 25400,
  TRY: 34.5,
  SAR: 3.75,
  AED: 3.67,
  KRW: 1395,
  MYR: 4.47,
  THB: 34.8,
  PHP: 58.8,
  SGD: 1.34,
  CAD: 1.40,
  AUD: 1.54,
  NZD: 1.70,
  CHF: 0.88,
  KES: 129.5,
  SOS: 571,
  NGN: 1675,
  EGP: 49.3,
  HUF: 386,
  CLP: 975,
  ARS: 1000,
  MXN: 20.4,
  COP: 4400,
  PEN: 3.78,
};

let cachedRates: Record<string, number> | null = null;
let cachedRatesTimestamp = 0;
const RATES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class BudgetNormalizationService {
  /**
   * Legacy helper retained for backwards compatibility with diagnostics routes.
   */
  static isLegacyUsdBudget(
    monthlyAmount: number,
    targetCurrencyCode: string,
    isAlreadyNormalized: boolean | null | undefined
  ): boolean {
    if (isAlreadyNormalized === true) return false;
    if (targetCurrencyCode === 'USD') return false;
    return monthlyAmount > 0 && monthlyAmount < 2500;
  }

  /**
   * Fetches latest exchange rate for a single currency relative to USD.
   */
  static async fetchExchangeRate(targetCurrencyCode: string): Promise<{ rate: number; source: string; retrievedAt: string } | null> {
    const { rate, source } = await this.getCrossRate('USD', targetCurrencyCode);
    return { rate, source, retrievedAt: new Date().toISOString() };
  }

  /**
   * Retrieves latest currency rates relative to USD with memory caching
   * and fallback to static market rates.
   */
  static async getExchangeRates(): Promise<{ rates: Record<string, number>; source: string }> {
    if (cachedRates && Date.now() - cachedRatesTimestamp < RATES_CACHE_TTL_MS) {
      return { rates: cachedRates, source: 'open.er-api.com (cache)' };
    }
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.rates && typeof data.rates === 'object') {
          cachedRates = { ...FALLBACK_RATES_USD_BASE, ...data.rates };
          cachedRatesTimestamp = Date.now();
          return { rates: cachedRates, source: 'open.er-api.com' };
        }
      }
    } catch (err) {
      console.warn('[BudgetNormalization] Failed to fetch live exchange rates, using fallback table:', err);
    }
    return { rates: FALLBACK_RATES_USD_BASE, source: 'fallback_table' };
  }

  /**
   * Calculates the cross exchange rate from any source currency to any target currency:
   * Rate(source -> target) = Rate_USD(target) / Rate_USD(source)
   */
  static async getCrossRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<{ rate: number; source: string }> {
    const src = (sourceCurrency || 'USD').toUpperCase();
    const tgt = (targetCurrency || 'USD').toUpperCase();
    if (src === tgt) {
      return { rate: 1, source: 'identity' };
    }
    const { rates, source } = await this.getExchangeRates();
    const srcRate = rates[src] || FALLBACK_RATES_USD_BASE[src] || 1;
    const tgtRate = rates[tgt] || FALLBACK_RATES_USD_BASE[tgt] || 1;
    const crossRate = tgtRate / srcRate;
    return { rate: crossRate, source };
  }

  /**
   * Full pipeline: reads the user's canonical onboarding budget plan,
   * determines its source currency, and accurately calculates the monthly budget
   * and daily allowance in the target country's currency.
   */
  static async createOrNormalizeBudgetProfile(
    userId: string,
    geo: GeoContext
  ): Promise<NormalizationResult | null> {
    const supabase = createAdminSupabaseClient();
    const targetCurrency = (geo.currencyCode || 'USD').toUpperCase();
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
    const symbol = CURRENCY_SYMBOLS[targetCurrency] || geo.currencySymbol || '$';

    // 1. Fetch onboarding responses (primary source of truth for budget)
    const { data: onboarding } = await supabase
      .from('onboarding_responses')
      .select('budget, weekly_budget, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Fetch existing budget profile
    const { data: existingProfile } = await supabase
      .from('user_budget_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch user settings for original currency context if needed
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('currency, country_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (!onboarding && !existingProfile) {
      console.warn(`[BudgetNormalization] No budget data found for user ${userId}`);
      return null;
    }

    // High-denomination currencies where typical grocery budgets are strictly > 1,000 units
    const HIGH_DENOMINATION_CURRENCIES = ['IDR', 'VND', 'KRW', 'JPY', 'KES', 'CLP', 'HUF', 'COP', 'NGN'];

    // Determine the user's raw budget input and its original source currency
    let rawWeeklyBudget = 0;
    let rawMonthlyBudget = 0;
    let sourceCurrency = 'USD';

    if (onboarding?.weekly_budget != null && Number(onboarding.weekly_budget) > 0) {
      const weeklyVal = Number(onboarding.weekly_budget);
      rawWeeklyBudget = weeklyVal;
      rawMonthlyBudget = weeklyVal * 4.33;

      if (weeklyVal <= 1000) {
        // Value was selected on the standard onboarding slider scale ($20-$500/week in USD)
        // Even if existingProfile or userSettings was set to IDR/KES, 49 cannot be 49 IDR (0.3 cents) or 49 KRW.
        sourceCurrency = 'USD';
      } else {
        // High denomination currency input (e.g. 1,248,660 IDR or 5,200 KES)
        sourceCurrency = (userSettings?.currency || existingProfile?.currency || 'IDR').toUpperCase();
      }
    } else if (onboarding?.budget != null && Number(onboarding.budget) > 0) {
      const monthlyVal = Number(onboarding.budget);
      rawMonthlyBudget = monthlyVal;
      rawWeeklyBudget = monthlyVal / 4.33;

      if (monthlyVal <= 1500) {
        sourceCurrency = 'USD';
      } else {
        sourceCurrency = (userSettings?.currency || existingProfile?.currency || 'IDR').toUpperCase();
      }
    } else if (existingProfile?.monthly_budget != null && Number(existingProfile.monthly_budget) > 0) {
      const existingMonthly = Number(existingProfile.monthly_budget);
      sourceCurrency = (existingProfile.currency || userSettings?.currency || 'USD').toUpperCase();
      
      // If marked as high-denomination currency (e.g. IDR) but the number is <= 1000,
      // that profile was corrupted by an inverted rate calculation; treat base as USD.
      if (HIGH_DENOMINATION_CURRENCIES.includes(sourceCurrency) && existingMonthly <= 1000) {
        sourceCurrency = 'USD';
      }
      rawMonthlyBudget = existingMonthly;
      rawWeeklyBudget = rawMonthlyBudget / 4.33;
    }

    if (rawMonthlyBudget <= 0) {
      console.warn(`[BudgetNormalization] Neither weekly nor monthly budget specified for user ${userId}`);
      return null;
    }

    // Calculate cross exchange rate from sourceCurrency to targetCurrency
    const { rate: crossRate, source: rateSource } = await this.getCrossRate(sourceCurrency, targetCurrency);
    const wasConverted = sourceCurrency !== targetCurrency;

    // Convert weekly budget to target currency
    const convertedWeekly = rawWeeklyBudget * crossRate;
    const convertedMonthly = rawMonthlyBudget * crossRate;
    const convertedDaily = convertedWeekly / 7;

    const finalMonthly = isZeroDecimal ? Math.round(convertedMonthly) : Math.round(convertedMonthly * 100) / 100;
    const finalDaily = isZeroDecimal ? Math.round(convertedDaily) : Math.round(convertedDaily * 100) / 100;

    console.log(`[BudgetNormalization] User ${userId}: plan ${rawWeeklyBudget} ${sourceCurrency}/wk -> ${finalDaily}/day (${finalMonthly}/mo ${targetCurrency}) via rate ${crossRate} (${rateSource})`);

    const result: NormalizationResult = {
      monthlyBudget: finalMonthly,
      dailyAllowance: finalDaily,
      currency: targetCurrency,
      currencySymbol: symbol,
      wasConverted,
      originalAmount: rawMonthlyBudget,
      originalCurrency: sourceCurrency,
      exchangeRate: crossRate,
      exchangeRateSource: rateSource,
      error: null,
    };

    // Ensure user_budget_profiles has an initial record if none exists
    try {
      if (!existingProfile) {
        await supabase
          .from('user_budget_profiles')
          .insert({
            user_id: userId,
            monthly_budget: finalMonthly,
            currency: targetCurrency,
            budget_source: 'onboarding',
            updated_at: new Date().toISOString(),
          });
      }
    } catch (persistErr) {
      console.error('[BudgetNormalization] Non-fatal persistence error in user_budget_profiles:', persistErr);
    }

    return result;
  }

  /**
   * Returns the currency symbol for a given ISO currency code.
   */
  static getCurrencySymbol(currencyCode: string): string {
    return CURRENCY_SYMBOLS[(currencyCode || 'USD').toUpperCase()] || '$';
  }
}
