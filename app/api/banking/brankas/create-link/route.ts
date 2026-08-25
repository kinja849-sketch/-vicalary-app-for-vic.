import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

const BRANKAS_API_KEY = process.env.BRANKAS_API_KEY;

export async function POST(request: Request) {
    try {
        const authUser = await getAuthenticatedUser(request);
        const body = await request.json().catch(() => ({}));
        const userId = authUser?.id || body.userId;
        const bankId = body.bankId;
        const countryCode = body.countryCode;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Valid user session required' }, { status: 401 });
        }

        if (!bankId) {
            return NextResponse.json({ success: false, error: 'bankId is required' }, { status: 400 });
        }

        if (!BRANKAS_API_KEY) {
            return NextResponse.json({ success: false, error: 'Brankas API Key is missing in backend' }, { status: 500 });
        }

        // Generate a deterministic or random transaction ID for tracking
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        let redirectUrl = '';
        try {
            const response = await fetch('https://statement.bnk.to/v1/statement-init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': BRANKAS_API_KEY!
                },
                body: JSON.stringify({
                    bank_id: bankId,
                    country: countryCode || 'ID',
                    callback: {
                        success_url: `${siteUrl}/api/banking/brankas/callback?status=SUCCESS&user_id=${userId}&bank_id=${bankId}&transaction_id=${transactionId}`,
                        fail_url: `${siteUrl}/api/banking/brankas/callback?status=FAIL&user_id=${userId}&bank_id=${bankId}`
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.redirect_uri) {
                    redirectUrl = data.redirect_uri;
                }
            } else {
                const errorText = await response.text();
                console.warn("Brankas Live API Error:", errorText);
            }
        } catch (e: any) {
            console.warn("Failed to connect to Brankas API:", e.message);
        }

        // In non-production development environments, provide a mock statement link if key is inactive
        if (!redirectUrl) {
            if (process.env.NODE_ENV === 'production' && BRANKAS_API_KEY !== 'mock') {
                return NextResponse.json({ success: false, error: 'Failed to initialize bank statement link with Brankas' }, { status: 502 });
            }
            const mockStatementId = `stmt_mock_${Date.now()}`;
            redirectUrl = `${siteUrl}/api/banking/brankas/callback?status=SUCCESS&user_id=${userId}&bank_id=${bankId}&transaction_id=${transactionId}&statement_id=${mockStatementId}`;
        }

        return NextResponse.json({ success: true, redirect_url: redirectUrl });

    } catch (err: any) {
        console.error('Brankas Create Link Error:', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
