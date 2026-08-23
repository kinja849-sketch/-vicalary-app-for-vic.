import { supabase } from '../supabase'

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

export const createBudget = async (userId: string, totalBudget: number, startDate: string, endDate: string, currencyCode: string = 'USD', currencySymbol: string = '$') => {
    // Deactivate existing budgets
    await supabase
        .from('user_budgets')
        .update({ is_active: false })
        .eq('user_id', userId)

    const { data, error } = await (supabase
        .from('user_budgets') as any)
        .insert({
            user_id: userId,
            total_budget: totalBudget,
            remaining_budget: totalBudget,
            current_balance: totalBudget,
            period_start: startDate,
            period_end: endDate,
            currency: currencyCode,
            currency_symbol: currencySymbol,
            is_active: true,
        } as any)
        .select()
        .single()

    if (error) throw error

    // Call AI Budget Engine orchestrator to generate intelligent goals and analysis
    try {
        await fetch('/api/banking/ai-budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                total_budget: totalBudget,
                period_end: endDate
            })
        });
    } catch (aiErr) {
        console.error("AI Budget Engine failed to run, but basic budget was created:", aiErr);
    }

    return data
}

export const getActiveBudget = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)

    if (error) throw error
    return data && data.length > 0 ? data[0] : null
}

export const getBudgetTransactions = async (budgetId: string) => {
    const { data, error } = await supabase
        .from('budget_transactions')
        .select(`
      *,
      food_analysis_history (
        *,
        food_items (*)
      )
    `)
        .eq('budget_id', budgetId)
        .order('transaction_date', { ascending: false })

    if (error) throw error
    return data
}

export const getBudgetHistory = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_budgets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}
export const deleteBudget = async (budgetId: string) => {
    const { error } = await supabase
        .from('user_budgets')
        .delete()
        .eq('id', budgetId)

    if (error) throw error
    return true
}
