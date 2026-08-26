export interface BudgetData {
    id: string;
    total_budget: number;
    remaining_budget: number;
    period_start: string;
    period_end: string;
}

export const getDynamicDailyBudget = (budget: BudgetData | null) => {
    if (!budget) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const end = new Date(budget.period_end);
    end.setHours(23, 59, 59, 999);
    
    // Ensure we don't calculate for past dates
    if (today.getTime() > end.getTime()) return 0;

    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / msPerDay));

    const remaining = budget.remaining_budget ?? budget.total_budget ?? 0;
    if (remaining <= 0) return 0;

    // Dynamic daily spending target based on remaining budget and remaining days
    const dailyAllocation = remaining / diffDays;
    
    return Math.max(0, Number(dailyAllocation.toFixed(2)));
};
