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
             return NextResponse.redirect(new URL(`/budget?error=${encodeURIComponent(errorMsg)}`, request.url));
        }

        if (!code) {
             return NextResponse.redirect(new URL('/budget?error=MissingCode', request.url));
        }

        let userId = '';
        let bankId = '';

        if (stateParam && stateParam.includes(':')) {
            const parts = stateParam.split(':');
            userId = parts[0];
            bankId = parts[1];
        }

        if (!userId) {
            return NextResponse.redirect(new URL('/budget?error=MissingUser', request.url));
        }

        const supabase = createAdminSupabaseClient();
        
        // 1. Create connection record
        const { data: connection, error: connErr } = await supabase.from('bank_connections' as any).upsert({
            user_id: userId,
            provider: 'finverse',
            encrypted_access_token: code, // We would normally exchange this for a Login Identity token
            provider_item_id: bankId || 'finverse_bank',
            status: 'connected',
            updated_at: new Date().toISOString()
        }, { onConflict: 'provider_item_id' }).select('id').single();
        
        if (connErr) {
            console.error("Failed to upsert bank connection:", connErr);
            throw new Error(`Connection upsert failed: ${connErr.message}`);
        }

        // We don't invent balances anymore. This is handled by a sync engine.
        // For the immediate UX, we just redirect back to budget.
        
        return NextResponse.redirect(new URL(`/budget?success=true&connection_id=${connection.id}`, request.url));

    } catch (err: any) {
        console.error("Finverse callback error:", err);
        return NextResponse.redirect(new URL(`/budget?error=${encodeURIComponent(err.message)}`, request.url));
    }
}

export async function GET(request: Request) {
    return handleCallback(request);
}

export async function POST(request: Request) {
    return handleCallback(request);
}
