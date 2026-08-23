import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || 'production';

const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
            'PLAID-SECRET': PLAID_SECRET,
        },
    },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(request: Request) {
    try {
        const { public_token, userId, institution_id, institution_name } = await request.json();

        if (!public_token || !userId) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Exchange the public token for an access token
        const response = await plaidClient.itemPublicTokenExchange({
            public_token: public_token,
        });

        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        // 2. Store securely in backend (NOT accessible to frontend)
        const supabase = createServerSupabaseClient();
        
        const { error: dbError } = await supabase.from('connected_banks').upsert({
            user_id: userId,
            access_token: accessToken,
            institution_id: institution_id || 'unknown',
            institution_name: institution_name || 'Unknown Institution',
        }, { onConflict: 'user_id,institution_id' });

        if (dbError) {
            console.error("Database Error Storing Token:", dbError);
            throw new Error("Failed to secure access token in backend");
        }

        // 3. We also need to get account data to return some public info to the frontend
        const authResponse = await plaidClient.authGet({
            access_token: accessToken,
        });

        const accounts = authResponse.data.accounts;
        
        // Save balances to the new account_balances table
        for (const account of accounts) {
            const balanceData = {
                user_id: userId,
                account_id: account.account_id,
                available_balance: account.balances.available || 0,
                current_balance: account.balances.current || 0,
                currency: account.balances.iso_currency_code || 'USD',
                last_updated: new Date().toISOString()
            };
            
            const { error: balanceError } = await supabase
                .from('account_balances')
                .upsert(balanceData, { onConflict: 'account_id' });
                
            if (balanceError) {
                 console.error("Database Error Storing Balance:", balanceError);
            }
        }

        const primaryAccount = accounts[0]; // For MVP, return the first account info to frontend

        // Return non-sensitive details to frontend
        return NextResponse.json({
            success: true,
            account: {
                bank_name: institution_name || primaryAccount.name,
                account_name: primaryAccount.name,
                balance: primaryAccount.balances.available || primaryAccount.balances.current || 0,
                currency: primaryAccount.balances.iso_currency_code || 'USD'
            }
        });

    } catch (err: any) {
        console.error('Plaid Exchange Token Error:', err.response?.data || err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
