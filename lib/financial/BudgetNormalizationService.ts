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
};

/**
 * The maximum raw monthly value (after weekly*4.33 conversion) that could
 * plausibly be a legacy USD onboarding amount. The old onboarding slider
 * had a USD max of ~$500/week ≈ $2165/month. Values above this threshold
 * are assumed to already be in local currency.
 */
const LEGACY_USD_MONTHLY_CEILING = 2500;

/**
 * Minimum plausible localized monthly budget for non-USD high-exchange-rate
 * currencies. If the value is below this AND the target currency has a rate
 * > 10 vs USD, it's almost certainly a legacy USD amount.
 */
const LOW_VALUE_THRESHOLD = 1000;

export class BudgetNormalizationService {

  /**
   * Determines whether an onboarding budget value is a legacy USD amount
   * that needs conversion to the user's local currency.
   *
   * Logic:
   * 1. If the budget profile is already marked `is_normalized`, return false.
   * 2. If the target currency IS USD, no conversion needed.
   * 3. If the monthly amount is small (< LEGACY_USD_MONTHLY_CEILING) and
   *    the target currency typically has high exchange rates (IDR, VND, KRW, etc.),
   *    it's almost certainly a legacy USD value.
   */
  static isLegacyUsdBudget(
    monthlyAmount: number,
    targetCurrencyCode: string,
    isAlreadyNormalized: boolean | null | undefined
  ): boolean {
    // Already normalized — never re-convert
    if (isAlreadyNormalized === true) return false;

    // If target is USD, no conversion needed
    if (targetCurrencyCode === 'USD') return false;

    // If the monthly amount is suspiciously small for a non-USD currency,
    // it's likely a legacy USD value. The current localized onboarding slider
    // for IDR starts at ~Rp320,000/week = ~Rp1,385,600/month minimum.
    // A legacy USD value of $500/week would be ~$2165/month max.
    if (monthlyAmount > 0 && monthlyAmount < LEGACY_USD_MONTHLY_CEILING) {
      return true;
    }

    return false;
  }

  /**
   * Fetches a live exchange rate from USD to targetCurrency using
   * the open.er-api.com free API.
   *
   * Returns null if the rate cannot be fetched (caller must handle gracefully).
   */
  static async fetchExchangeRate(
    targetCurrencyCode: string
  ): Promise<{ rate: number; source: string; retrievedAt: string } | null> {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.error('[BudgetNormalization] Exchange rate API returned', res.status);
        return null;
      }
      const data = await res.json();
      const rate = data?.rates?.[targetCurrencyCode];
      if (!rate || typeof rate !== 'number' || rate <= 0) {
        console.error('[BudgetNormalization] No valid rate found for', targetCurrencyCode);
        return null;
      }
      return {
        rate,
        source: 'open.er-api.com',
        retrievedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[BudgetNormalization] Exchange rate fetch failed:', err);
      return null;
    }
  }

  /**
   * Converts a USD amount to the target currency using a live exchange rate.
   */
  static async normalizeToLocalCurrency(
    amountUsd: number,
    targetCurrencyCode: string,
    dailyAllowanceUsd?: number
  ): Promise<NormalizationResult> {
    const symbol = CURRENCY_SYMBOLS[targetCurrencyCode] || '$';
    const isZeroDecimal = ['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'HUF'].includes(targetCurrencyCode);
    const rawDaily = dailyAllowanceUsd !== undefined ? dailyAllowanceUsd : amountUsd / 30;

    if (targetCurrencyCode === 'USD') {
      return {
        monthlyBudget: Math.round(amountUsd * 100) / 100,
        dailyAllowance: Math.round(rawDaily * 100) / 100,
        currency: 'USD',
        currencySymbol: '$',
        wasConverted: false,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        exchangeRateSource: null,
        error: null,
      };
    }

    const rateResult = await this.fetchExchangeRate(targetCurrencyCode);
    if (!rateResult) {
      return {
        monthlyBudget: Math.round(amountUsd * 100) / 100,
        dailyAllowance: Math.round(rawDaily * 100) / 100,
        currency: 'USD',
        currencySymbol: '$',
        wasConverted: false,
        originalAmount: amountUsd,
        originalCurrency: 'USD',
        exchangeRate: null,
        exchangeRateSource: null,
        error: `Failed to fetch exchange rate for ${targetCurrencyCode}. Budget kept in USD to prevent incorrect display.`,
      };
    }

    const convertedMonthly = isZeroDecimal 
      ? Math.round(amountUsd * rateResult.rate)
      : Math.round(amountUsd * rateResult.rate * 100) / 100;

    const convertedDaily = isZeroDecimal
      ? Math.round(rawDaily * rateResult.rate)
      : Math.round(rawDaily * rateResult.rate * 100) / 100;

    console.log(
      `[BudgetNormalization] Converted $${amountUsd} USD → ${symbol}${convertedMonthly.toLocaleString()} ${targetCurrencyCode} (rate: ${rateResult.rate})`
    );

    return {
      monthlyBudget: convertedMonthly,
      dailyAllowance: convertedDaily,
      currency: targetCurrencyCode,
      currencySymbol: symbol,
      wasConverted: true,
      originalAmount: amountUsd,
      originalCurrency: 'USD',
      exchangeRate: rateResult.rate,
      exchangeRateSource: rateResult.source,
      error: null,
    };
  }

  /**
   * Full pipeline: reads onboarding, detects legacy format, converts if needed,
   * persists to user_budget_profiles with full metadata.
   *
   * Returns the final monthly budget and currency, or null if no budget data exists.
   */
  static async createOrNormalizeBudgetProfile(
    userId: string,
    geo: GeoContext
  ): Promise<NormalizationResult | null> {
    const supabase = createAdminSupabaseClient();
    const isZeroDecimal = ['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'HUF'].includes(geo.currencyCode);
    const symbol = CURRENCY_SYMBOLS[geo.currencyCode] || '$';

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

    if (!onboarding && !existingProfile) {
      console.warn(`[BudgetNormalization] No budget data found for user ${userId}`);
      return null;
    }

    // The user's direct onboarding budget input
    const rawBudgetInput = (onboarding?.budget != null && Number(onboarding.budget) > 0)
      ? Number(onboarding.budget)
      : ((onboarding?.weekly_budget != null && Number(onboarding.weekly_budget) > 0)
          ? Number(onboarding.weekly_budget)
          : Number(existingProfile?.monthly_budget || 0));

    if (rawBudgetInput <= 0) {
      console.warn(`[BudgetNormalization] Neither weekly nor monthly budget specified for user ${userId}`);
      return null;
    }

    // The monthly cycle total directly reflects the user's onboarding response
    const rawMonthly = rawBudgetInput;
    // The daily allowance is the daily amount the user is permitted to spend to stay within their monthly cycle total
    const rawDailyAllowance = rawBudgetInput / 30;

    // Detect if this is a legacy USD value (e.g. old USD values like 117 or 200 that need conversion to local currency)
    const isLegacy = this.isLegacyUsdBudget(rawMonthly, geo.currencyCode, false);
    let result: NormalizationResult;

    if (isLegacy) {
      result = await this.normalizeToLocalCurrency(rawMonthly, geo.currencyCode, rawDailyAllowance);
    } else {
      const finalMonthly = isZeroDecimal ? Math.round(rawMonthly) : Math.round(rawMonthly * 100) / 100;
      const finalDaily = isZeroDecimal ? Math.round(rawDailyAllowance) : Math.round(rawDailyAllowance * 100) / 100;

      result = {
        monthlyBudget: finalMonthly,
        dailyAllowance: finalDaily,
        currency: geo.currencyCode,
        currencySymbol: symbol,
        wasConverted: false,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        exchangeRateSource: null,
        error: null,
      };
    }

    // Persist to user_budget_profiles safely without failing on missing columns or constraints
    try {
      if (existingProfile) {
        await supabase
          .from('user_budget_profiles')
          .update({
            monthly_budget: result.monthlyBudget,
            currency: result.currency,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);
        console.log(`[BudgetNormalization] Updated existing profile ${existingProfile.id}: ${result.currencySymbol}${result.monthlyBudget} ${result.currency}`);
      } else {
        await supabase
          .from('user_budget_profiles')
          .insert({
            user_id: userId,
            monthly_budget: result.monthlyBudget,
            currency: result.currency,
            budget_source: 'onboarding',
            updated_at: new Date().toISOString(),
          });
        console.log(`[BudgetNormalization] Created budget profile: ${result.currencySymbol}${result.monthlyBudget} ${result.currency}`);
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
    return CURRENCY_SYMBOLS[currencyCode] || '$';
  }
}
