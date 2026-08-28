import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/supabase-server';

export async function GET(request: Request) {
    try {
        // Try getting user from Bearer token first (which is what the frontend currently relies on)
        let user = await getAuthenticatedUser(request);
        
        // If Bearer token fails, try SSR cookies (as requested)
        if (!user) {
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll() { return cookieStore.getAll(); },
                        setAll() {}
                    }
                }
            );
            const { data } = await supabase.auth.getUser();
            user = data?.user;
        }

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { createServerSupabaseClient } = require('@/lib/supabase-server');
        const supabase = createServerSupabaseClient(request);

        // Fetch from the NEW schema (user_bank_accounts)
        const { data: accounts, error } = await supabase
            .from('user_bank_accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase user_bank_accounts query error:", error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        // Map to expected frontend format
        const banks = (accounts || []).map(acc => ({
            id: acc.id,
            bank_name: acc.institution_name || acc.provider || 'Connected Bank',
            account_name: acc.account_name,
            balance: acc.available_balance || acc.current_balance,
            currency: acc.iso_currency_code || 'USD',
            provider: acc.provider
        }));

        return NextResponse.json({
            banks: banks || [],
        });
    } catch (error) {
        console.error("User banks error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
