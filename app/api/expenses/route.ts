import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
    try {
        let user = await getAuthenticatedUser(request);
        const body = await request.json().catch(() => ({}));
        const { 
            product_name, 
            quantity = 1, 
            unit_price, 
            total_amount, 
            currency = 'USD', 
            barcode, 
            category = 'Food & Dining', 
            source = 'barcode_scan', 
            user_id 
        } = body;

        const targetUserId = user?.id || user_id;
        if (!targetUserId) {
            return NextResponse.json({ success: false, error: 'Unauthorized: missing user identity' }, { status: 401 });
        }

        const amountToRecord = Number(total_amount ?? unit_price ?? 0);
        if (!product_name || isNaN(amountToRecord) || amountToRecord <= 0) {
            return NextResponse.json({ success: false, error: 'Missing product_name or valid amount' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();
        
        const { data, error } = await supabase.from('financial_transactions').insert({
            user_id: targetUserId,
            merchant_name: product_name,
            description: `Purchase: ${product_name}`,
            amount: amountToRecord,
            currency: currency || 'USD',
            category: category || 'Food & Dining',
            source: source || 'barcode_scan',
            transaction_date: new Date().toISOString(),
            reconciliation_status: 'pending',
        }).select().single();

        if (error) {
            console.error("[Expenses API] Error inserting expense:", error);
            throw new Error(error.message);
        }

        // Secondary sync with user_budgets and budget_transactions if available
        try {
            const { data: activeBudget } = await supabase
                .from('user_budgets')
                .select('id, remaining_budget')
                .eq('user_id', targetUserId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (activeBudget?.id) {
                await supabase.from('budget_transactions').insert({
                    budget_id: activeBudget.id,
                    amount: amountToRecord,
                    description: `Purchase: ${product_name}`,
                    transaction_date: new Date().toISOString()
                } as any);

                if (activeBudget.remaining_budget !== null && activeBudget.remaining_budget !== undefined) {
                    const newRemaining = Math.max(0, Number(activeBudget.remaining_budget) - amountToRecord);
                    await supabase.from('user_budgets')
                        .update({ remaining_budget: newRemaining })
                        .eq('id', activeBudget.id);
                }
            }
        } catch (bErr) {
            console.warn("[Expenses API] Sync user_budgets warning:", bErr);
        }

        return NextResponse.json({ success: true, expense: data });
    } catch (err: any) {
        console.error("[Expenses API] Fatal handler error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const limit = Number(searchParams.get('limit')) || 50;

        const supabase = createAdminSupabaseClient();
        
        const { data, error } = await supabase.from('financial_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true, expenses: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
