import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const urlUserId = searchParams.get('userId');

        const supabase = createServerSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        const userId = urlUserId || session?.user?.id;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: connectedBanks, error: banksError } = await supabase
            .from('connected_banks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (banksError) {
            console.error("Supabase connected_banks query error:", banksError);
            throw banksError;
        }

        const { data: balances, error: balancesError } = await supabase
            .from('account_balances')
            .select('*')
            .eq('user_id', userId);

        if (balancesError) {
            console.error("Supabase account_balances query error:", balancesError);
            throw balancesError;
        }

        // Map new schema to expected frontend format
        const banks = (balances || []).map(balance => {
            // Find corresponding bank by assuming user's first connected bank for now,
            // or just use generic name if multiple exist without explicit link
            const bank = connectedBanks?.[0];
            return {
                id: balance.id,
                bank_name: bank?.institution_name || 'Connected Bank',
                account_name: 'Account ' + balance.account_id.slice(-4),
                balance: balance.available_balance || balance.current_balance,
                currency: balance.currency
            };
        });

        return NextResponse.json({ success: true, banks: banks });

    } catch (err: any) {
        console.error("Fetch user banks error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
