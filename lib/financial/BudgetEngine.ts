import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

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
}

export class BudgetEngine {
  /**
   * Deterministically calculates budget health based on:
   * 1. The immutable onboarding monthly budget (user_budget_profiles)
   * 2. The authoritative transaction ledger (financial_transactions)
   */
  static async calculateBudgetStatus(userId: string): Promise<BudgetSummary | null> {
    const supabase = createAdminSupabaseClient();
    
    // 1. Get the authoritative onboarding budget
    const { data: budgetProfile, error: profileErr } = await supabase
      .from('user_budget_profiles')
      .select('monthly_budget, currency')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!budgetProfile) {
        console.warn("[BudgetEngine] No budget profile found for user:", userId);
        
        // --- AUTO-CREATE FROM ONBOARDING ---
        const { data: onboarding } = await supabase
            .from('onboarding_responses')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (onboarding && (onboarding.budget || onboarding.weekly_budget)) {
            let calculatedBudget = onboarding.budget 
                ? Number(onboarding.budget) 
                : Number(onboarding.weekly_budget) * 4.33;
                
            // The budget is strictly whatever the user provided in onboarding.
            // Do not invent exchange rates.
            let currency = onboarding.currency || 'USD';
            
            // If the user's region indicates IDR, we assume their input was IDR
            // unless otherwise specified.
            const { data: region } = await supabase
                .from('user_financial_regions')
                .select('currency_code')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();
                
            if (region && region.currency_code) {
                currency = region.currency_code;
            }

            console.log(`[BudgetEngine] Auto-creating budget profile: ${calculatedBudget} ${currency}`);
            const { error: insertErr } = await supabase
                .from('user_budget_profiles')
                .insert({
                    user_id: userId,
                    monthly_budget: calculatedBudget,
                    currency: currency,
                });
            
            if (!insertErr) {
                return this.calculateBudgetStatus(userId);
            }
        }
        
        return null;
    }

    const monthlyBudget = Number(budgetProfile.monthly_budget);
    const currency = budgetProfile.currency || 'USD';

    // 2. Define month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // 3. Define today boundaries for daily spending tracking
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // 4. Query the authoritative ledger for the entire month
    // Exclude 'merged' so we don't double count a scanner purchase that later appeared on the bank statement.
    const { data: transactions, error: txError } = await supabase
      .from('financial_transactions')
      .select('amount, transaction_date')
      .eq('user_id', userId)
      .gte('transaction_date', startOfMonth.toISOString())
      .neq('reconciliation_status', 'merged');

    if (txError) {
      console.error("[BudgetEngine] Error querying transactions:", txError);
      throw new Error("Failed to calculate budget from ledger");
    }

    // 5. Calculate monthly and daily expenditure
    let spentThisMonth = 0;
    let spentToday = 0;

    for (const tx of transactions || []) {
      const amt = Number(tx.amount);
      spentThisMonth += amt;
      
      const txDate = new Date(tx.transaction_date);
      if (txDate >= startOfDay) {
          spentToday += amt;
      }
    }

    // 6. Calculate Remaining Budget and Days
    const remainingBudget = Math.max(0, monthlyBudget - spentThisMonth);
    
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // Number of full days remaining in this month, including today
    const daysRemaining = Math.max(1, Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const recommendedDailySpend = remainingBudget / daysRemaining;
    const remainingToday = Math.max(0, recommendedDailySpend - spentToday);
    
    const percentUsed = (spentThisMonth / monthlyBudget) * 100;
    
    let status = 'on_track';
    if (percentUsed >= 100) status = 'over_budget';
    else if (percentUsed > 90) status = 'warning';
    else if (percentUsed < 20 && daysRemaining < 10) status = 'under_budget';

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
      currency
    };

    // 7. Persist daily snapshot (Idempotent upsert)
    try {
        const dateStr = now.toISOString().split('T')[0];
        await supabase.from('daily_budget_status').upsert({
            user_id: userId,
            date: dateStr,
            monthly_budget: monthlyBudget,
            daily_target: recommendedDailySpend,
            actual_spending: spentToday,
            remaining: remainingToday,
            status: status
        }, { onConflict: 'user_id,date' });
    } catch (e) {
        console.error("[BudgetEngine] Error saving daily status:", e);
    }

    return summary;
  }
}
