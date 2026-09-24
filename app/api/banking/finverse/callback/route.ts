import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

async function handleCallback(request: Request) {
    try {
        let code = '';
        let stateParam = '';
        let errorMsg = '';

        if (request.method === 'POST') {
            const formData = await request.formData().catch(() => null);
            if (formData) {
                code = formData.get('code')?.toString() || '';
                stateParam = formData.get('state')?.toString() || '';
                errorMsg = formData.get('error')?.toString() || '';
            }
        } else {
            const { searchParams } = new URL(request.url);
            code = searchParams.get('code') || '';
            stateParam = searchParams.get('state') || '';
            errorMsg = searchParams.get('error') || '';
        }

        if (errorMsg) {
             throw new Error(`Finverse Error: ${errorMsg}`);
        }

        if (!code) {
             throw new Error('Missing authorization code from Finverse.');
        }

        let stateUserId = '';
        let bankId = '';

        if (stateParam && stateParam.includes(':')) {
            const parts = stateParam.split(':');
            stateUserId = parts[0];
            bankId = parts[1];
        }

        // 1. SECURE AUTH: Get real user from Supabase session cookie, do not blindly trust state
        const { getAuthenticatedUser } = require('@/lib/supabase-server');
        const authUser = await getAuthenticatedUser(request);
        
        let finalUserId = authUser?.id;

        if (!finalUserId && stateUserId) {
             // If for some reason the cookie didn't transmit (e.g. cross-site strictness), 
             // we still shouldn't blindly trust it, but we can attempt to retrieve the user if we had a secure nonce.
             // For strict compliance to AGENTS.md, we mandate the cookie auth.
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
             if (data?.user) {
                 finalUserId = data.user.id;
             }
        }

        if (!finalUserId) {
            throw new Error('UnauthorizedSession');
        }

        if (stateUserId && stateUserId !== finalUserId) {
            throw new Error('SessionMismatch');
        }

        const supabase = require('@/lib/supabase-server').createAdminSupabaseClient();
        
        // 1. Exchange the code for a Login Identity Token
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const FINVERSE_API_URL = process.env.FINVERSE_API_URL || 'https://api.prod.finverse.net';
        const { FinverseProvider } = require('@/lib/financial/providers/FinverseProvider');
        const finverse = new FinverseProvider();
        const customerToken = await finverse.getCustomerToken();
        
        const redirectUri = `${siteUrl}/api/banking/finverse/callback`;

        const tokenRes = await fetch(`${FINVERSE_API_URL}/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customerToken}`
            },
            body: JSON.stringify({
                client_id: process.env.FINVERSE_CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error("Finverse token exchange failed:", errText);
            throw new Error('Failed to securely exchange bank token');
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        const loginIdentityId = tokenData.login_identity_id || bankId || 'finverse_bank';

        // 2. Create connection record
        const { data: connection, error: connErr } = await supabase.from('bank_connections' as any).upsert({
            user_id: finalUserId,
            provider: 'finverse',
            encrypted_access_token: accessToken,
            provider_item_id: loginIdentityId,
            status: 'connected',
            last_successful_sync: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'provider_item_id' }).select('id').single();
        
        if (connErr) {
            console.error("Failed to upsert bank connection:", connErr);
            throw new Error(`Connection upsert failed: ${connErr.message}`);
        }

        // 3. Fetch Real Balances from Provider
        const accountsRes = await fetch(`${FINVERSE_API_URL}/accounts`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (accountsRes.ok) {
            const accountsData = await accountsRes.json();
            const accounts = accountsData.accounts || [];
            
            if (accounts.length > 0) {
                const accountsToInsert = accounts.map((acc: any) => ({
                    user_id: finalUserId,
                    connection_id: connection.id,
                    provider: 'finverse',
                    account_id: acc.account_id,
                    institution_name: acc.institution_name || bankId,
                    account_name: acc.account_name || 'Bank Account',
                    account_type: acc.account_type || 'depository',
                    account_subtype: acc.account_subtype || 'checking',
                    current_balance: acc.balance?.amount || 0,
                    available_balance: acc.balance?.available_amount || acc.balance?.amount || 0,
                    iso_currency_code: acc.balance?.currency || 'IDR',
                    mask: acc.account_number_masked || acc.account_id.slice(-4),
                    updated_at: new Date().toISOString()
                }));

                await supabase.from('user_bank_accounts').upsert(accountsToInsert, { onConflict: 'account_id' });
            }
        }

        const successHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Success</title></head>
            <body>
                <script>
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'FINVERSE_SUCCESS', connection_id: '${connection.id}' }, '*');
                    } else if (window.opener) {
                        window.opener.postMessage({ type: 'FINVERSE_SUCCESS', connection_id: '${connection.id}' }, '*');
                        window.close();
                    } else {
                        window.location.href = '/budget?success=true&connection_id=${connection.id}';
                    }
                </script>
            </body>
            </html>
        `;
        return new NextResponse(successHtml, { headers: { 'Content-Type': 'text/html' } });

    } catch (err: any) {
        console.error("Finverse callback error:", err);
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
                <script>
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'FINVERSE_ERROR', error: '${err.message.replace(/'/g, "\\'")}' }, '*');
                    } else if (window.opener) {
                        window.opener.postMessage({ type: 'FINVERSE_ERROR', error: '${err.message.replace(/'/g, "\\'")}' }, '*');
                        window.close();
                    } else {
                        window.location.href = '/budget?error=${encodeURIComponent(err.message)}';
                    }
                </script>
            </body>
            </html>
        `;
        return new NextResponse(errorHtml, { headers: { 'Content-Type': 'text/html' }, status: 500 });
    }
}

export async function GET(request: Request) {
    return handleCallback(request);
}

export async function POST(request: Request) {
    return handleCallback(request);
}
