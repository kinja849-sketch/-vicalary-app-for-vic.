import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

import { getAuthenticatedUser } from '@/lib/supabase-server';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || 'sandbox';

const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV] || PlaidEnvironments.sandbox,
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
        const authUser = await getAuthenticatedUser(request);
        const body = await request.json().catch(() => ({}));
        const userId = authUser?.id || body.userId;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Valid user session required' }, { status: 401 });
        }
        
        if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
             return NextResponse.json({ success: false, error: 'Plaid credentials missing in backend' }, { status: 500 });
        }

        const requestData = {
            user: {
                client_user_id: userId,
            },
            client_name: 'Vic Financial Coaching',
            products: [Products.Auth, Products.Transactions],
            country_codes: [CountryCode.Us, CountryCode.Ca],
            language: 'en',
        };

        const response = await plaidClient.linkTokenCreate(requestData);
        return NextResponse.json({ success: true, link_token: response.data.link_token });

    } catch (err: any) {
        console.error('Plaid Create Link Token Error:', err.response?.data || err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
