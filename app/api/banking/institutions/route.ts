import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';





export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const country = (searchParams.get('country') || 'US').toUpperCase();
        
        const supabase = createServerSupabaseClient();
        
        // 1. Check Backend Cache (Supabase `institution_cache`)
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
            if (!hasAvatar) {
                return NextResponse.json({ success: true, source: 'cache', banks });
            }
        }
        
        // 2. Cache Miss: True Provider API Fetch
        let rawBanks: any[] = [];
        
        if (['US', 'CA'].includes(country)) {
            // PLAID API
            const plaidEnv = process.env.PLAID_ENV || 'production';
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
                throw new Error("Failed to fetch Plaid institutions");
            }
            
        } else if (country === 'ID') {
            // BRANKAS API
            rawBanks = [
                { institution_id: 'bca', name: 'BCA', logo_url: '/custom-logos/bank-central-asia-(bca)-logo.svg', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'mandiri', name: 'Mandiri', logo_url: '/custom-logos/bank-mandiri-logo.png', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'bni', name: 'BNI', logo_url: '/custom-logos/bank-negara-indonesia-(bni)-logo.png', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'cimb', name: 'CIMB', logo_url: '/custom-logos/bank-cimb-niaga-logo.svg', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'bri', name: 'BRI', logo_url: '/custom-logos/bank-rakyat-indonesia-(bri)-logo.svg', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'danamon', name: 'Danamon', logo_url: '/custom-logos/bank-danamon-logo.svg', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'permata', name: 'Permata', logo_url: '/custom-logos/bank-permata-logo.png', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'bsi', name: 'BSI', logo_url: '/custom-logos/bank-bsi-logo.svg', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'maybank', name: 'Maybank', logo_url: '/custom-logos/maybank-logo.png', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'panin', name: 'Panin', logo_url: '/api/banking/logo?domain=panin.co.id', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'ocbc', name: 'OCBC', logo_url: '/api/banking/logo?domain=ocbc.id', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'mega', name: 'Mega', logo_url: '/api/banking/logo?domain=bankmega.com', provider: 'brankas', country_code: 'ID' },
                { institution_id: 'btn', name: 'BTN', logo_url: '/api/banking/logo?domain=btn.co.id', provider: 'brankas', country_code: 'ID' }
            ];
        }
        
        if (rawBanks.length === 0) {
            return NextResponse.json({ success: true, source: 'api', banks: [] });
        }
        
        // 3. Populate Cache
        // Only attempt to upsert if we have a valid UUID as `id` (which we don't for these external IDs),
        // so for now we skip caching for ID if it breaks, or we insert without `id` and let DB generate it.
        const adminSupabase = createAdminSupabaseClient();
        
        // Let's clear the old corrupted ui-avatar records
        await adminSupabase.from('institution_cache').delete().eq('country_code', country);
        
        // Insert new records without explicit `id` (so Postgres generates UUID)
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
