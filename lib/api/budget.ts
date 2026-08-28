import { supabase } from '../supabase'

// ============================================================================
// BUDGET MANAGEMENT (V2 ARCHITECTURE)
// ============================================================================

export const getBudgetStatus = async (userId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // In V2 Architecture, the backend's deterministic BudgetEngine is responsible for
    // returning the daily budget status, fetching from user_budget_profiles and financial_transactions.
    const res = await fetch('/api/budget/daily', {
        method: 'GET',
        headers: {
            'Authorization': session ? `Bearer ${session.access_token}` : ''
        }
    });
    
    if (!res.ok) {
        throw new Error('Failed to fetch budget status from BudgetEngine');
    }
    
    const data = await res.json();
    if (data.needs_setup) {
        return null;
    }
    return data.summary;
}

export const getBudgetHistory = async (userId: string) => {
    await supabase.auth.getSession();
    const { data, error } = await supabase
        .from('daily_budget_status')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

    if (error) throw error;
    return data;
}

// Replaces the old createBudget form. The UI shouldn't use this directly,
// but it's here in case the user wants to update their profile goal.
export const updateBudgetProfile = async (userId: string, monthlyBudget: number, currency: string = 'USD') => {
    await supabase.auth.getSession();
    const { data, error } = await supabase
        .from('user_budget_profiles')
        .upsert({
            user_id: userId,
            monthly_budget: monthlyBudget,
            currency: currency,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) throw error;
    return data;
}
