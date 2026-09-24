import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { BudgetEngine } from '@/lib/financial/BudgetEngine';
import { BudgetNormalizationService } from '@/lib/financial/BudgetNormalizationService';
import type { GeoContext } from '@/lib/financial/BudgetNormalizationService';

export async function GET(request: Request) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createAdminSupabaseClient();

        // ── 1. Authoritative User Preference Resolution ──
        // Check user_settings first (persisted user choice), then request headers
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('currency, country_code')
            .eq('user_id', user.id)
            .maybeSingle();

        const clientHeaderCurrency = request.headers.get('x-user-currency');
        const clientHeaderCountry = request.headers.get('x-user-country');

        let geo: GeoContext;

        if (userSettings?.currency) {
            const curr = userSettings.currency;
            const country = userSettings.country_code || clientHeaderCountry || 'US';
            geo = {
                countryCode: country,
                currencyCode: curr,
                currencySymbol: BudgetNormalizationService.getCurrencySymbol(curr),
            };
        } else if (clientHeaderCurrency) {
            geo = {
                countryCode: clientHeaderCountry || 'US',
                currencyCode: clientHeaderCurrency,
                currencySymbol: BudgetNormalizationService.getCurrencySymbol(clientHeaderCurrency),
            };
        } else {
            // ── 2. Fall back to IP Geolocation if no user setting or header exists ──
            const clientIp = request.headers.get('x-real-ip') || 
                request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                request.headers.get('cf-connecting-ip') || 
                '8.8.8.8';

            geo = {
                countryCode: 'US',
                currencyCode: 'USD',
                currencySymbol: '$',
            };
            
            try {
                const { data: cachedGeo } = await supabase
                  .from('ip_location_cache')
                  .select('*')
                  .eq('ip_address', clientIp)
                  .single();

                if (cachedGeo && new Date(cachedGeo.expires_at) > new Date()) {
                    geo = {
                        countryCode: cachedGeo.country_code || 'US',
                        currencyCode: cachedGeo.currency_code || 'USD',
                        currencySymbol: BudgetNormalizationService.getCurrencySymbol(cachedGeo.currency_code || 'USD'),
                    };
                } else {
                    const geoApiKey = process.env.IPGEOLOCATION_API_KEY || process.env.NEXT_PUBLIC_IPGEO_API_KEY || '673294bd8a6549a3aa58e727e4e1a069';
                    const geoRes = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${geoApiKey}&ip=${clientIp}`);
                    if (geoRes.ok) {
                        const data = await geoRes.json();
                        const currencyCode = data.currency?.code || 'USD';
                        geo = {
                            countryCode: data.country_code2 || 'US',
                            currencyCode,
                            currencySymbol: BudgetNormalizationService.getCurrencySymbol(currencyCode),
                        };
                        
                        await supabase.from('ip_location_cache').upsert({
                            ip_address: clientIp,
                            country_code: geo.countryCode,
                            country_name: data.country_name || 'United States',
                            city: data.city || data.state_prov || 'Unknown',
                            currency_code: geo.currencyCode,
                            currency_symbol: geo.currencySymbol,
                            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        }, { onConflict: 'ip_address' });
                    }
                }

                const { data: currencyMap } = await supabase
                  .from('country_currency_map')
                  .select('currency_code, currency_symbol')
                  .eq('country_code', geo.countryCode)
                  .maybeSingle();

                if (currencyMap?.currency_code) {
                    geo.currencyCode = currencyMap.currency_code;
                    geo.currencySymbol = currencyMap.currency_symbol || BudgetNormalizationService.getCurrencySymbol(currencyMap.currency_code);
                }
            } catch (geoError) {
                console.error("[Budget API] Failed to detect IP geo:", geoError);
            }
        }

        console.log(`[Budget API] Geo resolved for user ${user.id}: ${geo.countryCode} / ${geo.currencyCode} (${geo.currencySymbol})`);

        // ── Calculate budget using the full geo context ──
        const summary = await BudgetEngine.calculateBudgetStatus(user.id, geo);
        
        if (!summary) {
             return NextResponse.json({ success: true, needs_setup: true, summary: null });
        }

        // Strip diagnostics in production
        const responseData = { ...summary };
        if (process.env.NODE_ENV === 'production') {
            delete responseData.diagnostics;
        }

        return NextResponse.json({ success: true, summary: responseData });

    } catch (err: any) {
        console.error("Budget engine daily route error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
