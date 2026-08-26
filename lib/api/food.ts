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

        // 1. Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('food-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('food-images')
            .getPublicUrl(filePath);

        // Convert file to base64 for direct AI processing (faster & avoids download timeouts)
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
            reader.onload = () => {
                const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
                resolve(base64);
            };
            reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        
        const loc = await getUserLocation();

        // 2. Call Next.js API route
        const res = await fetch('/api/analyze-food-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: publicUrl,
                imageBase64: base64Data,
                userId: userId,
                locationContext: loc,
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

const productCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5;

export const scanProduct = async (userId: string, barcode: string, options?: any) => {
    const loc = await getUserLocation();
    const cacheKey = `${barcode}_${loc?.country_code || 'DEF'}`;

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
            locationContext: loc
        })
    });

    if (!res.ok) throw new Error('analyze-product-barcode failed')
    const data = await res.json()
    logInfo(userId, 'barcode_scan_success', { barcode, productName: data.name });

    // Save to cache
    productCache.set(cacheKey, { data, timestamp: Date.now() });

    return data
}

export const saveFoodAnalysis = async (userId: string, analysis: any) => {
    if (analysis.is_already_saved) return null;

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
            historyError.code === '42P01' || 
            historyError.code === 'PGRST205' || 
            historyError.message?.includes('not found') ||
            historyError.message?.includes('does not exist')
        ) {
            console.error("Critical: food_analysis_history table is missing. Please run migrations.");
            throw new Error("Data storage service is temporarily unavailable. Our team has been notified.");
        }
        throw historyError;
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

const updateDailyProgress = async (userId: string, calories: number) => {
    const today = new Date().toISOString().split('T')[0]

    const { data: existingProgress } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('progress_date', today)
        .maybeSingle()

    if (existingProgress) {
        await supabase
            .from('daily_progress')
            .update({
                calories_consumed: (existingProgress.calories_consumed || 0) + calories,
                meals_logged: (existingProgress.meals_logged || 0) + 1,
            })
            .eq('id', existingProgress.id)
    } else {
        // Get user calorie goal
        const { data: onboarding } = await supabase
            .from('onboarding_responses')
            .select('daily_calorie_goal')
            .eq('user_id', userId)
            .maybeSingle()

        await supabase
            .from('daily_progress')
            .insert({
                user_id: userId,
                progress_date: today,
                calories_consumed: calories,
                calories_goal: onboarding?.daily_calorie_goal || 2000,
                meals_logged: 1,
            })
    }
}
