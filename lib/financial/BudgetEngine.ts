import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { BudgetNormalizationService, GeoContext, BudgetDiagnostics } from './BudgetNormalizationService';

export interface BudgetSummary {
  monthlyBudget: number;
  spentThisMonth: number;
  remainingBudget: number;
  daysRemaining: number;
  recommendedDailySpend: number;
  spentToday: number;
  remainingToday: number;
  percentUsed: number;
  status: string;
  currency: string;
  currencySymbol: string;
  currentDateStr?: string;
  recentExpenses?: Array<{ amount: number; merchant_name: string; transaction_date: string }>;
  diagnostics?: BudgetDiagnostics;
}

export class BudgetEngine {
  static async calculateBudgetStatus(
    userId: string,
    geo: GeoContext
  ): Promise<BudgetSummary | null> {
    const supabase = createAdminSupabaseClient();

    // Initialize diagnostics
    const diagnostics: BudgetDiagnostics = {
      userId,
      onboardingBudgetRaw: null,
      onboardingField: null,
      detectedFormat: 'unknown',
      originalCurrency: null,
      detectedCountry: geo.countryCode,
      resolvedCurrencyCode: geo.currencyCode,
      exchangeRateSource: null,
      exchangeRateValue: null,
      convertedAmount: null,
      budgetPeriodStart: null,
      budgetPeriodEnd: null,
      calculatedDailyAllowance: null,
      todayScannerExpenses: null,
      remainingAmount: null,
      profileAlreadyNormalized: false,
    };

    // ── 1. Normalize / create budget profile via centralized service ──
    const normResult = await BudgetNormalizationService.createOrNormalizeBudgetProfile(userId, geo);

    if (!normResult) {
      console.warn(`[BudgetEngine] No budget data for user ${userId}`);
      return null;
    }

    // Populate diagnostics from normalization result
    diagnostics.originalCurrency = normResult.originalCurrency;
    diagnostics.exchangeRateSource = normResult.exchangeRateSource;
    diagnostics.exchangeRateValue = normResult.exchangeRate;
    diagnostics.convertedAmount = normResult.monthlyBudget;
    diagnostics.detectedFormat = normResult.wasConverted ? 'legacy_usd' : 'current_localized';
    if (normResult.originalAmount !== null) {
      diagnostics.onboardingBudgetRaw = normResult.originalAmount;
    }

    const monthlyBudget = normResult.monthlyBudget;
    const currency = normResult.currency;
    const currencySymbol = normResult.currencySymbol;

    // Handle conversion failure gracefully
    if (normResult.error) {
      console.warn(`[BudgetEngine] Normalization warning: ${normResult.error}`);
    }

    // ── 2. Define personalized cycle boundaries ──
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('created_at')
      .eq('id', userId)
      .single();

    const joinDate = userProfile?.created_at ? new Date(userProfile.created_at) : new Date();
    const joinDay = joinDate.getDate();

    const now = new Date();
    let startOfCycle = new Date(now.getFullYear(), now.getMonth(), joinDay);

    if (startOfCycle > now) {
      startOfCycle = new Date(now.getFullYear(), now.getMonth() - 1, joinDay);
    }
    startOfCycle.setHours(0, 0, 0, 0);

    const endOfCycle = new Date(startOfCycle.getFullYear(), startOfCycle.getMonth() + 1, joinDay);
    endOfCycle.setHours(0, 0, 0, 0);

    diagnostics.budgetPeriodStart = startOfCycle.toISOString();
    diagnostics.budgetPeriodEnd = endOfCycle.toISOString();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // ── 3. Query the authoritative ledger for the cycle ──
    const { data: transactions, error: txError } = await supabase
      .from('financial_transactions')
      .select('amount, transaction_date, merchant_name')
      .eq('user_id', userId)
      .gte('transaction_date', startOfCycle.toISOString())
      .neq('reconciliation_status', 'merged');

    if (txError) {
      console.error('[BudgetEngine] Error querying transactions:', txError);
      throw new Error('Failed to calculate budget from ledger');
    }

    // ── 4. Calculate monthly and daily expenditure ──
    let spentThisMonth = 0;
    let spentToday = 0;
    const recentExpenses: Array<{ amount: number; merchant_name: string; transaction_date: string }> = [];

    for (const tx of transactions || []) {
      const amt = Number(tx.amount);
      spentThisMonth += amt;

      const txDate = new Date(tx.transaction_date);
      if (txDate >= startOfDay) {
        spentToday += amt;
        recentExpenses.push({
          amount: amt,
          merchant_name: tx.merchant_name || 'Scanned Item',
          transaction_date: tx.transaction_date,
        });
      }
    }

    // ── 5. Calculate remaining budget and daily allocation ──
    const remainingBudget = Math.max(0, monthlyBudget - spentThisMonth);
    const daysRemaining = Math.max(1, Math.ceil((endOfCycle.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Authoritative daily allowance directly from onboarding response
    const recommendedDailySpend = normResult.dailyAllowance;
    const remainingToday = Math.max(0, recommendedDailySpend - spentToday);

    const percentUsed = monthlyBudget > 0 ? (spentThisMonth / monthlyBudget) * 100 : 0;

    let status: 'on_track' | 'warning' | 'under_budget' | 'over_budget' = 'on_track';
    if (spentToday > recommendedDailySpend) status = 'over_budget';
    else if (percentUsed > 90) status = 'warning';
    else if (percentUsed < 20 && daysRemaining < 10) status = 'under_budget';

    // Populate remaining diagnostics
    diagnostics.calculatedDailyAllowance = recommendedDailySpend;
    diagnostics.todayScannerExpenses = spentToday;
    diagnostics.remainingAmount = remainingToday;

    const currentDateStr = now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // ── 6. Log comprehensive diagnostics ──
    console.log('[BudgetEngine] ═══════════════════════════════════════');
    console.log('[BudgetEngine] User:', userId);
    console.log('[BudgetEngine] Country:', geo.countryCode, '| Currency:', currency, currencySymbol);
    console.log('[BudgetEngine] Format:', diagnostics.detectedFormat);
    if (normResult.wasConverted) {
      console.log(`[BudgetEngine] Converted: $${normResult.originalAmount} USD → ${currencySymbol}${monthlyBudget.toLocaleString()} ${currency} (rate: ${normResult.exchangeRate})`);
    }
    console.log(`[BudgetEngine] Monthly: ${currencySymbol}${monthlyBudget.toLocaleString()} | Daily: ${currencySymbol}${recommendedDailySpend.toFixed(0)} | Spent today: ${currencySymbol}${spentToday.toFixed(0)} | Remaining: ${currencySymbol}${remainingToday.toFixed(0)}`);
    console.log(`[BudgetEngine] Cycle: ${daysRemaining} days left | ${percentUsed.toFixed(1)}% used | Status: ${status}`);
    console.log('[BudgetEngine] ═══════════════════════════════════════');

    const summary: BudgetSummary = {
      monthlyBudget,
      spentThisMonth,
      remainingBudget,
      daysRemaining,
      recommendedDailySpend,
      spentToday,
      remainingToday,
      percentUsed,
      status,
      currency,
      currencySymbol,
      currentDateStr,
      recentExpenses,
      diagnostics,
    };

    // ── 7. Persist daily snapshot ──
    try {
      const dateStr = now.toISOString().split('T')[0];
      await supabase.from('daily_budget_status').upsert(
        {
          user_id: userId,
          date: dateStr,
          monthly_budget: monthlyBudget,
          daily_target: recommendedDailySpend,
          actual_spending: spentToday,
          remaining: remainingToday,
          status,
        },
        { onConflict: 'user_id,date' }
      );
    } catch (e) {
      console.error('[BudgetEngine] Error saving daily status:', e);
    }

    return summary;
  }
}
