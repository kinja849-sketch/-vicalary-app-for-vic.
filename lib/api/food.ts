import { supabase } from '../supabase'
import { logInfo, logError, logWarn } from './logging'
import { getUserLocation } from './location'
// Removed gemini import as it is now strictly backend-driven via Edge Functions

// ============================================================================
// FOOD SCANNING & ANALYSIS
// ============================================================================

export interface FoodAnalysisResult {
    name: string
    brand?: string
    manufacturer?: string
    country_of_origin?: string
    ingredients?: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
    sugar?: number
    healthRating: number
    health_impact_score?: number
    clinical_synopsis?: string
    healthStatus?: string
    recommended_pairings?: string
    is_compliant?: boolean
    political_warning?: string
    estimated_price?: string
    cheaper_alternatives?: any[]
    price?: number
    image_url: string
    is_already_saved?: boolean
    needs_crowdsourcing?: boolean
}

export const checkBudgetStatus = async (userId: string, itemPrice: number) => {
    try {
        const { data: onboarding } = await (supabase
            .from('onboarding_responses') as any)
            .select('budget')
            .eq('user_id', userId)
            .maybeSingle();

        if (!onboarding || !(onboarding as any).budget) return { isOver: false, budget: 0 };

        const budget = Number((onboarding as any).budget);

        // Simple logic: if a single item is > 5% of monthly budget, it's a "significant spend"
        // Or we could check month-to-date spending, but for now we'll do a simple threshold check
        // as requested: "check the product price against the user's budget"
        const isOver = itemPrice > (budget * 0.05);

        return { isOver, budget };
    } catch (e) {
        console.error("Budget check failed:", e);
        return { isOver: false, budget: 0 };
    }
}

export const analyzeFoodImage = async (userId: string, file: File, options?: any) => {
    try {
        console.log("Analyzing image with backend Edge Function...");

        // 1. Upload to storage & convert to base64 in parallel for speed
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const uploadPromise = supabase.storage
            .from('food-images')
            .upload(filePath, file)
            .then(res => {
                if (res.error) throw res.error;
                const { data: { publicUrl } } = supabase.storage
                    .from('food-images')
                    .getPublicUrl(filePath);
                return publicUrl;
            });

        // Convert file to base64 for direct AI processing
        const base64Promise = new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
                resolve(base64);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

        const locationPromise = getUserLocation().catch(() => null);

        const [publicUrl, base64Data, loc] = await Promise.all([
            uploadPromise,
            base64Promise,
            locationPromise
        ]);

        const clientLang = options?.language || (typeof window !== 'undefined' ? (localStorage.getItem('app_lang') || 'en') : 'en');

        // 2. Call Next.js API route
        const res = await fetch('/api/analyze-food-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: publicUrl,
                imageBase64: base64Data,
                userId: userId,
                locationContext: loc,
                language: clientLang,
                ...options
            })
        });

        const data = await res.json();

        if (!res.ok || (data && data.error)) {
            const errMsg = data?.error || 'analyze-food-image failed';
            console.warn('analyze-food-image returned error:', errMsg);
            throw new Error(errMsg);
        }

        if (data && data.name) {
            logInfo(userId, 'food_analysis_success', { productName: data.name, imageUrl: publicUrl });
            return { ...data, image_url: publicUrl };
        }

        throw new Error("Invalid response from AI analysis");
    } catch (error: any) {
        logError(userId, 'food_analysis_failed', { error: error.message || error });
        console.error("AI analysis failed:", error);
        throw error;
    }
}

export const analyzeMedication = async (userId: string, file: File, options?: any) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `med-${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const uploadPromise = supabase.storage
            .from('food-images')
            .upload(filePath, file)
            .then(res => {
                if (res.error) return null;
                const { data: { publicUrl } } = supabase.storage
                    .from('food-images')
                    .getPublicUrl(filePath);
                return publicUrl;
            }).catch(() => null);

        const base64Promise = new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
                resolve(base64);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

        const locationPromise = getUserLocation().catch(() => null);

        const [publicUrl, base64Data, loc] = await Promise.all([
            uploadPromise,
            base64Promise,
            locationPromise
        ]);

        const clientLang = options?.language || (typeof window !== 'undefined' ? (localStorage.getItem('app_lang') || 'en') : 'en');

        const res = await fetch('/api/analyze-medication', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: publicUrl,
                imageBase64: base64Data,
                userId,
                locationContext: loc,
                language: clientLang,
                ...options
            })
        });

        const data = await res.json();
        if (!res.ok || (data && data.error)) {
            throw new Error(data?.error || 'Medication analysis failed');
        }

        return { ...data, image_url: publicUrl || data.image_url };
    } catch (error: any) {
        console.error("Medication analysis failed:", error);
        throw error;
    }
}

const productCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5;

export const scanProduct = async (userId: string, barcode: string, options?: any) => {
    const loc = await getUserLocation();
    const clientLang = options?.language || (typeof window !== 'undefined' ? (localStorage.getItem('app_lang') || 'en') : 'en');
    const cacheKey = `${barcode}_${loc?.country_code || 'DEF'}_${clientLang}`;

    // If forcing a reload, skip the cache
    if (!options?.forceReload) {
        const cached = productCache.get(cacheKey);
        if (cached) {
            if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
                console.log(`[Cache Hit] Returning cached data for barcode: ${barcode}`);
                return cached.data;
            } else {
                productCache.delete(cacheKey);
            }
        }
    }

    const res = await fetch('/api/analyze-product-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            barcode,
            userId,
            locationContext: loc,
            language: clientLang
        })
    });

    if (!res.ok) throw new Error('analyze-product-barcode failed')
    const data = await res.json()
    logInfo(userId, 'barcode_scan_success', { barcode, productName: data.name });

    // Save to cache
    productCache.set(cacheKey, { data, timestamp: Date.now() });

    return data
}

export const saveFoodAnalysis = async (userId: string, analysis: any, isPurchaseConfirmed: boolean = false) => {
    if (analysis.is_already_saved && !isPurchaseConfirmed) return null;

    // 1. Save food item
    const { data: foodItemRows, error: foodError } = await (supabase
        .from('food_items') as any)
        .insert({
            name: analysis.name,
            calories: Number(analysis.calories || 0),
            protein: Number(analysis.protein || 0),
            carbs: Number(analysis.carbs || 0),
            fat: Number(analysis.fat || 0),
            fiber: Number(analysis.fiber || 0),
            sugar: Number(analysis.sugar || 0),
            health_rating: Number(analysis.healthRating || analysis.health_impact_score || 5),
            description: analysis.description || analysis.verdict,
            serving_size: analysis.serving_size || '1 serving',
            image_url: analysis.image_url || analysis.mealImage,
            barcode: analysis.barcode,
            user_id: userId,
        })
        .select()

    if (foodError) throw foodError
    const foodItem = foodItemRows && foodItemRows.length > 0 ? foodItemRows[0] : null;

    if (!foodItem) throw new Error("Failed to create food item");

    // 2. Save to history
    const { data: historyRows, error: historyError } = await supabase
        .from('food_analysis_history')
        .insert({
            user_id: userId,
            food_item_id: foodItem.id,
            food_name: analysis.name,
            meal_type: analysis.meal_type || 'snack',
            calories_consumed: Number(analysis.calories || 0),
            calories: Number(analysis.calories || 0),
            protein: Number(analysis.protein || 0),
            carbs: Number(analysis.carbs || 0),
            fat: Number(analysis.fat || 0),
            image_url: analysis.image_url || analysis.mealImage,
            analysis_data: {
                origin_story: analysis.country_of_origin || analysis.origin_country,
                vitamins_and_nutrition: analysis.ingredients || analysis.vitamins_and_nutrition,
                recommendations: analysis.recommended_pairings || analysis.advice || analysis.recommendation,
                user_alignment: analysis.is_compliant || analysis.user_alignment_boolean,
                health_score: analysis.health_impact_score || analysis.healthRating,
                allergen_warnings: analysis.restrictions || [],
                brand: analysis.brand,
                manufacturer: analysis.manufacturer,
                price: analysis.price || analysis.estimated_price,
                political_warning: analysis.political_warning
            },
            notes: String(analysis.political_warning || analysis.description || analysis.advice || analysis.verdict || '').substring(0, 1000)
        })
        .select();

    if (historyError) {
        if (
            historyError.code === '404' || 
            historyError.message?.includes('not found') || 
            historyError.message?.includes('does not exist')
        ) {
            console.warn("food_analysis_history table not found, skipping save.", historyError.message);
        } else {
            console.error("Error saving food analysis history:", historyError);
            throw historyError;
        }
    }

    // Update daily_progress ONLY for meals you eat (Camera meals), NOT for scanner product purchases
    if (!analysis.is_scanner_product) {
        await updateDailyProgress(
            userId,
            Number(analysis.calories || 0),
            Number(analysis.protein || 0),
            Number(analysis.carbs || 0),
            Number(analysis.fat || 0),
            Number(analysis.fiber || 0),
            Number(analysis.sugar || 0)
        ).catch(err => console.warn("[Food] Failed to sync daily progress:", err));
    }

    // 3. Purchase Event (Record Expense) - STRICTLY ONLY UPON USER LOG CONFIRMATION
    if (isPurchaseConfirmed) {
        const rawPrice = analysis.price ?? analysis.estimated_price;
        const price = typeof rawPrice === 'number' && !isNaN(rawPrice)
            ? rawPrice
            : (rawPrice ? parseInt(String(rawPrice).replace(/[^0-9]/g, ''), 10) || 0 : 0);
        if (price > 0) {
            try {
                // Resolve user's currency dynamically instead of hardcoding
                let expenseCurrency = 'USD';
                let expenseCountry = 'US';
                try {
                    const { data: userSettings } = await supabase
                        .from('user_settings')
                        .select('currency, country_code')
                        .eq('user_id', userId)
                        .maybeSingle();
                    if (userSettings?.currency) {
                        expenseCurrency = userSettings.currency;
                        expenseCountry = userSettings.country_code || expenseCountry;
                    } else {
                        const { data: budgetProfile } = await supabase
                            .from('user_budget_profiles')
                            .select('currency')
                            .eq('user_id', userId)
                            .limit(1)
                            .maybeSingle();
                        if (budgetProfile?.currency) {
                            expenseCurrency = budgetProfile.currency;
                        }
                    }
                } catch (currErr) {
                    console.warn("[Food] Could not resolve user currency, defaulting to USD:", currErr);
                }

                // Record expense via server API /api/expenses (uses server admin client to bypass client RLS)
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const expRes = await fetch('/api/expenses', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            product_name: analysis.name || 'Scanned Item',
                            quantity: 1,
                            unit_price: price,
                            total_amount: price,
                            currency: expenseCurrency,
                            barcode: analysis.barcode,
                            category: 'Food & Dining',
                            source: 'barcode_scan'
                        })
                    });
                    const expData = await expRes.json();
                    if (!expRes.ok || !expData.success) {
                        console.error("[Food] Expenses API failed to persist transaction:", expData);
                    } else {
                        console.log("[Food] Successfully recorded scanned purchase transaction via server API:", expData.expense);
                    }
                } catch (apiErr) {
                    console.error("[Food] Network error calling /api/expenses:", apiErr);
                }

                // Secondary sync with user_budgets and budget_transactions if available
                try {
                    const { data: activeBudget } = await supabase
                        .from('user_budgets')
                        .select('id, remaining_budget')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (activeBudget?.id) {
                        await supabase.from('budget_transactions').insert({
                            budget_id: activeBudget.id,
                            food_analysis_id: foodItem.id,
                            amount: price,
                            description: `Purchase: ${analysis.name}`,
                            transaction_date: new Date().toISOString()
                        } as any);

                        if (activeBudget.remaining_budget !== null && activeBudget.remaining_budget !== undefined) {
                            const newRemaining = Math.max(0, Number(activeBudget.remaining_budget) - price);
                            await supabase.from('user_budgets')
                                .update({ remaining_budget: newRemaining })
                                .eq('id', activeBudget.id);
                        }
                    }
                } catch (bErr) {
                    console.warn("[Food] Could not sync budget_transactions:", bErr);
                }

                // Seed product_price_cache with this authentic user-confirmed price
                if (analysis.barcode) {
                    try {
                        await supabase.from('product_price_cache').upsert({
                            product_id: analysis.barcode,
                            retailer: analysis.brand || analysis.manufacturer || 'Local Market',
                            country: expenseCountry,
                            currency: expenseCurrency,
                            price: price,
                            source: 'User Confirmed Log',
                            confidence: 1.0,
                            retrieved_at: new Date().toISOString()
                        }, { onConflict: 'product_id,country' });
                    } catch (cacheErr) {
                        console.warn("[Food] Failed to seed product_price_cache:", cacheErr);
                    }
                }

                console.log(`[Food] Confirmed scanner expense recorded: ${expenseCurrency} ${price}`);
            } catch (txErr) {
                console.error("Failed to record scanner expense:", txErr);
            }
        }
    }

    // Mark as saved locally to prevent double logging
    analysis.is_already_saved = true;

    return historyRows && historyRows.length > 0 ? historyRows[0] : null;
}

// ============================================================================
// HISTORY & RECENT
// ============================================================================

export const getFoodHistory = async (userId: string, limit = 50) => {
    try {
        const { data, error } = await supabase
            .from('food_analysis_history')
            .select(`
      *,
      food_items (*)
    `)
            .eq('user_id', userId)
            .order('analyzed_at', { ascending: false })
            .limit(limit)

        if (error) {
            if (error.code === '404' || error.message?.includes('not found')) {
                console.warn("food_analysis_history table not found, returning empty history.");
                return [];
            }
            throw error;
        }
        return data;
    } catch (e) {
        console.error("Failed to fetch food history:", e);
        return [];
    }
}

export const getRecentMeals = async (userId: string, limit = 10) => {
    const { data, error } = await supabase
        .from('food_analysis_history')
        .select(`
            *,
            food_items (*)
        `)
        .eq('user_id', userId)
        .order('analyzed_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// ============================================================================
// DAILY PROGRESS UPDATE
// ============================================================================

export const updateDailyProgress = async (userId: string, calories: number, protein: number = 0, carbs: number = 0, fat: number = 0, fiber: number = 0, sugar: number = 0) => {
    const today = new Date().toISOString().split('T')[0];

    const { data: existingProgress } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('progress_date', today)
        .maybeSingle();

    if (existingProgress) {
        await supabase
            .from('daily_progress')
            .update({
                calories_consumed: Number(existingProgress.calories_consumed || 0) + calories,
                protein_consumed: Number(existingProgress.protein_consumed || 0) + protein,
                carbs_consumed: Number(existingProgress.carbs_consumed || 0) + carbs,
                fat_consumed: Number(existingProgress.fat_consumed || 0) + fat,
                fiber_consumed: Number(existingProgress.fiber_consumed || 0) + fiber,
                sugar_consumed: Number(existingProgress.sugar_consumed || 0) + sugar,
                meals_logged: (existingProgress.meals_logged || 0) + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', existingProgress.id);
    } else {
        // Get user calorie goal
        const { data: onboarding } = await supabase
            .from('onboarding_responses')
            .select('daily_calorie_goal, protein_goal, carbs_goal, fat_goal')
            .eq('user_id', userId)
            .maybeSingle();

        await supabase
            .from('daily_progress')
            .insert({
                user_id: userId,
                progress_date: today,
                calories_consumed: calories,
                protein_consumed: protein,
                carbs_consumed: carbs,
                fat_consumed: fat,
                fiber_consumed: fiber,
                sugar_consumed: sugar,
                calories_goal: onboarding?.daily_calorie_goal || 2000,
                protein_goal: Number(onboarding?.protein_goal || 50),
                carbs_goal: Number(onboarding?.carbs_goal || 250),
                fat_goal: Number(onboarding?.fat_goal || 70),
                meals_logged: 1,
            });
    }
}
