import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminSupabaseClient, getAuthenticatedUser, createServerSupabaseClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        let user = await getAuthenticatedUser(request);
        
        if (!user) {
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
            user = data?.user;
        }

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const country = (searchParams.get('country') || 'UNKNOWN').toUpperCase();
        if (country === 'UNKNOWN') return NextResponse.json({ success: true, source: 'none', banks: [] });
        
        const supabase = createServerSupabaseClient(request);
        
        // 1. Check Backend Cache (Supabase institution_cache)
        const { data: cachedBanks, error: cacheError } = await supabase
            .from('institution_cache')
            .select('*')
            .eq('country_code', country);
            
        if (!cacheError && cachedBanks && cachedBanks.length > 0) {
            // Cache Hit: Normalize for frontend consumption
            const banks = cachedBanks.map(b => ({
                id: b.institution_id || b.id,
                name: b.name,
                logo: b.logo_url,
                provider: b.provider
            }));
            
            // Check if they are using the old ui-avatars. If so, invalidate the cache and force a new fetch.
            const hasAvatar = banks.some(b => b.logo && b.logo.includes('ui-avatars.com'));
            // Also invalidate old hardcoded IDs (bca, mandiri, etc.) regardless of provider
            const hasHardcodedIds = banks.some(b => ['bca', 'mandiri', 'bni', 'bri', 'cimb'].includes(b.id?.toLowerCase()));

            if (!hasAvatar && !hasHardcodedIds) {
                return NextResponse.json({ success: true, source: 'cache', banks });
            }
        }
        
        // 2. Cache Miss: True Provider API Fetch
        let rawBanks: any[] = [];
        
        if (['US', 'CA'].includes(country)) {
            // PLAID API
            const plaidEnv = process.env.PLAID_ENV || 'sandbox';
            const plaidUrl = plaidEnv === 'production' 
                ? 'https://production.plaid.com/institutions/get'
                : plaidEnv === 'development'
                ? 'https://development.plaid.com/institutions/get' 
                : 'https://sandbox.plaid.com/institutions/get';
                
            const plaidRes = await fetch(plaidUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: process.env.PLAID_CLIENT_ID,
                    secret: process.env.PLAID_SECRET,
                    count: 30,
                    offset: 0,
                    country_codes: [country],
                    options: { include_optional_metadata: true }
                })
            });
            
            const plaidData = await plaidRes.json();
            
            if (plaidRes.ok && plaidData.institutions) {
                rawBanks = plaidData.institutions.map((inst: any) => ({
                    institution_id: inst.institution_id,
                    name: inst.name,
                    logo_url: inst.logo ? `data:image/png;base64,${inst.logo}` : `https://logo.clearbit.com/${inst.name.replace(/\s+/g, '').toLowerCase()}.com`,
                    provider: 'plaid',
                    country_code: country
                }));
            } else {
                console.error("Plaid API Error:", plaidData);
                // Return fallback empty if API fails instead of 500 crashing
                rawBanks = [];
            }
            
        } else if (country === 'ID' || country === 'PH' || country === 'TH' || country === 'VN' || country === 'SG' || country === 'MY') {
            // FINVERSE API Live
            try {
                const { FinverseProvider } = await import('@/lib/financial/providers/FinverseProvider');
                const finverse = new FinverseProvider();
                const institutions = await finverse.getInstitutions(country);
                rawBanks = institutions.map(inst => ({
                    institution_id: (inst as any).institution_id || inst.id,
                    name: inst.name,
                    logo_url: (inst as any).logo_url || inst.logoUrl || `/custom-logos/${inst.name.replace(/\s+/g, '-').toLowerCase()}-logo.png`,
                    provider: 'finverse',
                    country_code: country
                }));
            } catch (err) {
                console.error("Finverse API Institutions Error:", err);
                rawBanks = [];
            }
        }
        
        if (rawBanks.length === 0) {
            return NextResponse.json({ success: true, source: 'api', banks: [] });
        }
        
        // 3. Populate Cache
        const adminSupabase = createAdminSupabaseClient();
        
        // Let's clear the old corrupted ui-avatar records
        await adminSupabase.from('institution_cache').delete().eq('country_code', country);
        
        // Insert new records without explicit id (so Postgres generates UUID)
        adminSupabase.from('institution_cache').insert(rawBanks)
            .then(({ error }) => {
                if (error) console.error("Cache Insert Error:", error);
            });
            
        // Normalize for frontend
        const banks = rawBanks.map(b => ({
            id: b.institution_id,
            name: b.name,
            logo: b.logo_url,
            provider: b.provider
        }));
        
        return NextResponse.json({ success: true, source: 'api', banks });
    } catch (err: any) {
        console.error("Institution Discovery Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

