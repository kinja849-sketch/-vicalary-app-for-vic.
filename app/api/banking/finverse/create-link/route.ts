import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { FinverseProvider } from '@/lib/financial/providers/FinverseProvider';

const FINVERSE_CUSTOMER_APP_ID = process.env.FINVERSE_CUSTOMER_APP_ID;
const FINVERSE_CLIENT_ID = process.env.FINVERSE_CLIENT_ID;

export async function POST(request: Request) {
    try {
        let authUser = await getAuthenticatedUser(request);
        
        if (!authUser) {
            const { createServerClient } = require('@supabase/ssr');
            const { cookies } = require('next/headers');
            const cookieStore = await cookies();
            const authClient = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll() { return cookieStore.getAll(); },
                        setAll() {}
                    }
                }
            );
            const { data } = await authClient.auth.getUser();
            authUser = data?.user;
        }

        const body = await request.json().catch(() => ({}));
        const userId = authUser?.id; // strict server auth
        const bankId = body.bankId;
        const countryCode = body.countryCode;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Valid user session required' }, { status: 401 });
        }

        if (!bankId) {
            return NextResponse.json({ success: false, error: 'bankId is required' }, { status: 400 });
        }

        if (!FINVERSE_CLIENT_ID || !FINVERSE_CUSTOMER_APP_ID) {
            return NextResponse.json({ success: false, error: 'Finverse API Keys are missing in backend' }, { status: 500 });
        }

        // Validate institution exists and is supported
        const { createAdminSupabaseClient } = require('@/lib/supabase-server');
        const adminSupabase = createAdminSupabaseClient();
        const { data: institution, error: instError } = await adminSupabase
            .from('institution_cache')
            .select('*')
            .eq('institution_id', bankId)
            .eq('provider', 'finverse')
            .single();

        if (instError || !institution) {
            return NextResponse.json(
                { success: false, error: 'INVALID_INSTITUTION', message: 'The selected bank is not a valid Finverse institution.' },
                { status: 400 }
            );
        }

        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const redirectUri = `${siteUrl}/api/banking/finverse/callback`;

        let redirectUrl = '';
        
        try {
            const provider = new FinverseProvider();
            const customerToken = await provider.getCustomerToken();

            // Create Link Token / URL
            const response = await fetch('https://api.prod.finverse.net/link/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customerToken}`
                },
                body: JSON.stringify({
                    client_id: FINVERSE_CLIENT_ID,
                    grant_type: 'client_credentials',
                    user_id: userId, // Pass our internal user ID
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    response_mode: 'form_post',
                    institution_id: bankId,
                    state: `${userId}:${bankId}`
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.link_url) {
                    redirectUrl = data.link_url;
                } else if (data.url) {
                    redirectUrl = data.url;
                } else {
                    // Fallback construction if link/token just gives a token
                    const linkToken = data.link_token || data.access_token;
                    if (linkToken) {
                        redirectUrl = `https://link.finverse.net?link_token=${linkToken}`;
                    }
                }
            } else {
                const errorText = await response.text();
                console.warn("Finverse Live API Error:", errorText);
                
                if (errorText.includes('40006') || errorText.includes('Invalid institution_id')) {
                    return NextResponse.json({ 
                        success: false, 
                        error: 'INVALID_INSTITUTION', 
                        message: 'The selected bank is temporarily unavailable or unsupported. Please choose another supported bank.' 
                    }, { status: 400 });
                }

                return NextResponse.json({ success: false, error: `Finverse API Error: ${errorText}` }, { status: 500 });
            }
        } catch (e: any) {
            console.warn("Failed to connect to Finverse API:", e.message);
            return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
        
        if (!redirectUrl) {
            return NextResponse.json({ success: false, error: 'Failed to initialize bank connection with Finverse API' }, { status: 502 });
        }

        return NextResponse.json({ success: true, redirect_url: redirectUrl });

    } catch (err: any) {
        console.error('Finverse Create Link Error:', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
