import { NextResponse } from 'next/server';
import { getAuthenticatedUser, createServerSupabaseClient } from '@/lib/supabase-server';
import { BudgetNormalizationService } from '@/lib/financial/BudgetNormalizationService';

/**
 * Budget Diagnostics Endpoint (development only)
 * 
 * Returns the full budget normalization pipeline state for the authenticated user.
 * Never exposes secrets or auth tokens.
 * 
 * GET /api/budget/diagnostics
 */
export async function GET(request: Request) {
    // Only available in development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'Diagnostics endpoint is not available in production' },
            { status: 404 }
        );
    }

    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerSupabaseClient();

        // 1. Get onboarding data
        const { data: onboarding } = await supabase
            .from('onboarding_responses')
            .select('budget, weekly_budget, created_at, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();

        // 2. Get budget profile
        const { data: budgetProfile } = await supabase
            .from('user_budget_profiles')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 3. Get user settings
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('currency, country_code, language, timezone')
            .eq('user_id', user.id)
            .maybeSingle();

        // 4. Get financial region
        const { data: financialRegion } = await supabase
            .from('user_financial_regions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        // 5. Get IP geo context
        const clientIp = request.headers.get('x-real-ip') || 
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
            request.headers.get('cf-connecting-ip') || 
            '8.8.8.8';

        const { data: ipCache } = await supabase
            .from('ip_location_cache')
            .select('*')
            .eq('ip_address', clientIp)
            .maybeSingle();

        // 6. Get today's expenses
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const { data: todayExpenses } = await supabase
            .from('financial_transactions')
            .select('amount, merchant_name, description, currency, source, transaction_date')
            .eq('user_id', user.id)
            .gte('transaction_date', startOfDay.toISOString())
            .order('transaction_date', { ascending: false });

        // 7. Determine legacy detection result
        const onboardingBudgetValue = onboarding?.budget 
            ? Number(onboarding.budget) 
            : onboarding?.weekly_budget 
                ? Number(onboarding.weekly_budget) * 4.33 
                : null;

        const resolvedCurrency = userSettings?.currency || ipCache?.currency_code || 'USD';
        const isLegacy = onboardingBudgetValue !== null 
            ? BudgetNormalizationService.isLegacyUsdBudget(
                onboardingBudgetValue, 
                resolvedCurrency, 
                budgetProfile?.is_normalized
              )
            : null;

        return NextResponse.json({
            userId: user.id,
            clientIp,
            onboarding: onboarding ? {
                budget: onboarding.budget,
                weekly_budget: onboarding.weekly_budget,
                computed_monthly: onboardingBudgetValue,
                created_at: onboarding.created_at,
                updated_at: onboarding.updated_at,
            } : null,
            budgetProfile: budgetProfile ? {
                id: budgetProfile.id,
                monthly_budget: Number(budgetProfile.monthly_budget),
                currency: budgetProfile.currency,
                budget_source: budgetProfile.budget_source,
                is_normalized: budgetProfile.is_normalized,
                original_amount: budgetProfile.original_amount ? Number(budgetProfile.original_amount) : null,
                original_currency: budgetProfile.original_currency,
                exchange_rate_used: budgetProfile.exchange_rate_used ? Number(budgetProfile.exchange_rate_used) : null,
                exchange_rate_source: budgetProfile.exchange_rate_source,
                normalized_at: budgetProfile.normalized_at,
                created_at: budgetProfile.created_at,
                updated_at: budgetProfile.updated_at,
            } : null,
            legacyDetection: {
                onboardingBudgetRaw: onboardingBudgetValue,
                resolvedCurrency,
                isLegacyUsd: isLegacy,
                profileAlreadyNormalized: budgetProfile?.is_normalized ?? null,
            },
            geo: {
                ip_cache: ipCache ? {
                    country_code: ipCache.country_code,
                    country_name: ipCache.country_name,
                    city: ipCache.city,
                    currency_code: ipCache.currency_code,
                    currency_symbol: ipCache.currency_symbol,
                    cached_at: ipCache.cached_at,
                    expires_at: ipCache.expires_at,
                } : null,
                user_settings: userSettings ? {
                    currency: userSettings.currency,
                    country_code: userSettings.country_code,
                    language: userSettings.language,
                    timezone: userSettings.timezone,
                } : null,
                financial_region: financialRegion ? {
                    country_code: financialRegion.country_code,
                    currency_code: financialRegion.currency_code,
                    currency_symbol: financialRegion.currency_symbol,
                    detection_method: financialRegion.detection_method,
                } : null,
            },
            todayExpenses: {
                count: todayExpenses?.length || 0,
                totalAmount: todayExpenses?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0,
                items: todayExpenses || [],
            },
            _links: {
                budget_page: '/budget',
                budget_api: '/api/budget/daily',
                diagnostics: '/api/budget/diagnostics',
            },
        });

    } catch (err: any) {
        console.error('[Budget Diagnostics] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
