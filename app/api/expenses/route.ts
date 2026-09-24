import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const { product_name, quantity = 1, unit_price, total_amount, currency, barcode, category, source = 'manual' } = body;

        if (!product_name || !unit_price || !total_amount) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();
        
        const { data, error } = await supabase.from('financial_transactions').insert({
            user_id: user.id,
            merchant_name: product_name,
            description: `Scanner purchase: ${product_name} x${quantity}`,
            amount: Number(total_amount),
            currency,
            category,
            source,
            transaction_date: new Date().toISOString(),
        }).select().single();

        if (error) {
            console.error("[Expenses API] Error inserting expense:", error);
            throw new Error(error.message);
        }

        return NextResponse.json({ success: true, expense: data });
    } catch (err: any) {
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
