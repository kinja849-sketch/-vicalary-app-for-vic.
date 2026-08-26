import { supabase } from '../supabase'

// ============================================================================
// HELPERS for External API mapping
// ============================================================================

/**
 * Ensures that external recipes (from Spoonacular) are present in our 'recipes' table
 * and returns a map of spoonacular_id -> internal_uuid.
 */
const ensureRecipesUuids = async (recipesData: any[]): Promise<Record<string, string>> => {
    if (!recipesData || recipesData.length === 0) return {};

    const uniqueIds = new Set();
    const toUpsert = recipesData
        .filter(m => {
            const sid = String(m.id || m.spoonacular_id);
            if (!sid || sid === 'undefined' || uniqueIds.has(sid)) return false;
            uniqueIds.add(sid);
            return true;
        })
        .map(m => ({
            spoonacular_id: String(m.id || m.spoonacular_id),
            title: m.title || m.name,
            image_url: m.image || m.image_url,
            total_calories: m.calories || m.total_calories,
            protein_g: m.protein || m.protein_g,
            carbs_g: m.carbs || m.carbs_g,
            fat_g: m.fat || m.fat_g,
            ingredients: m.ingredients || [],
            instructions: m.instructions || []
        }));

    const { data, error } = await supabase
        .from('recipes')
        .upsert(toUpsert, { onConflict: 'spoonacular_id' })
        .select('id, spoonacular_id');

    if (error) {
        console.error("[Recipes] Upsert failed:", error);
        return {};
    }

    return (data || []).reduce((acc: Record<string, string>, r: any) => {
        acc[r.spoonacular_id] = r.id;
        return acc;
    }, {});
};

// ============================================================================
// RECIPES
// ============================================================================

export const getRecipes = async (filters?: {
    cuisineType?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    maxCalories?: number
    tags?: string[]
}) => {
    if (filters) {
        const res = await fetch('/api/search-recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'main course', number: 20 })
        })
        if (res.ok) {
            const data = await res.json()
            if (data?.results) return data.results;
        }
    }

    let query = supabase.from('recipes').select('*')
    if (filters) {
        if (filters.cuisineType) query = query.eq('cuisine_type', filters.cuisineType)
        if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
        if (filters.maxCalories) query = query.lte('total_calories', filters.maxCalories)
        if (filters.tags && filters.tags.length > 0) query = query.contains('dietary_tags', filters.tags)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export const getRecipeDetails = async (recipeId: string | number) => {
    const rawId = String(recipeId || '').trim();
    if (!rawId) throw new Error("Recipe ID is required");

    try {
        const res = await fetch('/api/recipe-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: rawId })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data?.error || "Failed to fetch details");
        return data;
    } catch (e: any) {
        // Direct client fallback to Supabase if API endpoint fails
        try {
            const cleanId = rawId.replace(/^(themealdb_|cocktail_|spoonacular_)/i, '');
            const { data: cached } = await (supabase as any)
                .from('cached_recipes')
                .select('*')
                .or(`id.eq.${rawId},id.eq.${cleanId}`)
                .maybeSingle();

            if (cached) {
                const c = cached as any;
                return {
                    id: String(c.id),
                    title: c.title || 'Untitled Recipe',
                    image_url: c.image_url || '',
                    cuisine_type: c.cuisine_region || c.cuisine_type || 'International',
                    dietary_tags: Array.isArray(c.dietary_tags) ? c.dietary_tags : [],
                    ingredients: typeof c.ingredients === 'string' ? JSON.parse(c.ingredients) : (c.ingredients || []),
                    instructions: typeof c.instructions_steps === 'string' ? JSON.parse(c.instructions_steps) : (c.instructions_steps || c.instructions || []),
                    prep_time_minutes: c.preparation_time || c.prep_time_minutes || 15,
                    cook_time_minutes: c.cook_time_minutes || 0,
                    total_calories: c.nutrition?.calories || c.total_calories || 0,
                    protein_g: Number(c.nutrition?.protein || c.protein_g || 0),
                    carbs_g: Number(c.nutrition?.carbs || c.carbs_g || 0),
                    fat_g: Number(c.nutrition?.fat || c.fat_g || 0),
                    servings: c.servings || 2
                };
            }

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
            let query = supabase.from('recipes').select('*');
            if (isUuid) {
                query = query.eq('id', rawId);
            } else {
                const isNumeric = !isNaN(Number(cleanId)) && cleanId.trim() !== '';
                if (isNumeric) {
                    query = query.or(`external_id.eq.${rawId},external_id.eq.${cleanId},spoonacular_id.eq.${cleanId}`);
                } else {
                    query = query.or(`external_id.eq.${rawId},external_id.eq.${cleanId}`);
                }
            }
            const { data: recipe } = await query.maybeSingle();
            if (recipe) {
                const r = recipe as any;
                return {
                    ...r,
                    ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
                    instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions) : (r.instructions || [])
                };
            }
        } catch (dbErr) {
            console.warn('[getRecipeDetails] Direct DB fallback failed:', dbErr);
        }

        throw e;
    }
}

export const searchRecipes = async (searchTerm: string) => {
    try {
        const res = await fetch('/api/search-recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchTerm, number: 12 })
        })
        if (!res.ok) throw new Error('search-recipes failed');
        const data = await res.json();
        return data.results || [];
    } catch (error) {
        const sanitized = searchTerm.replace(/[(),.%]/g, '').trim();
        if (!sanitized) return [];
        const { data, error: dbError } = await supabase
            .from('recipes')
            .select('*')
            .or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
        if (dbError) throw dbError;
        return data || [];
    }
}

// ============================================================================
// RECIPE INTERACTIONS
// ============================================================================

export const toggleFavoriteRecipe = async (userId: string, recipeId: string | number, recipeData?: any) => {
    let finalUuid = String(recipeId);

    // If it's a numeric Spoonacular ID, resolve to UUID first
    const isNumericId = !isNaN(Number(recipeId)) && !String(recipeId).includes('-');
    if (isNumericId) {
        const map = await ensureRecipesUuids([recipeData || { id: recipeId, title: 'Recipe' }]);
        const mapped = map[String(recipeId)];
        if (mapped) {
            finalUuid = mapped;
        } else {
            console.error(`[Recipes] Could not resolve Spoonacular ID ${recipeId} to UUID`);
            throw new Error("Invalid recipe reference");
        }
    }

    // FINAL GUARD: Ensure finalUuid is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(finalUuid)) {
        console.error(`[Recipes] Invalid UUID for favorite: ${finalUuid}`);
        throw new Error("Invalid recipe reference format");
    }

    const { data: existing } = await supabase
        .from('user_recipe_interactions')
        .select('*')
        .eq('user_id', userId)
        .eq('recipe_id', finalUuid)
        .eq('interaction_type', 'favorited')
        .maybeSingle()

    if (existing) {
        await supabase.from('user_recipe_interactions').delete().eq('id', existing.id)
        return { favorited: false }
    } else {
        const { error } = await supabase
            .from('user_recipe_interactions')
            .insert({
                user_id: userId,
                recipe_id: finalUuid,
                interaction_type: 'favorited',
            })
        if (error) throw error;
        return { favorited: true }
    }
}

export const markRecipeAsCooked = async (userId: string, recipeId: string, notes?: string) => {
    const { data, error } = await supabase
        .from('user_recipe_interactions')
        .insert({
            user_id: userId,
            recipe_id: recipeId,
            interaction_type: 'cooked',
            notes,
        })
        .select()
        .maybeSingle()
    if (error) throw error
    await updateDailyRecipeCount(userId)
    return data
}

export const rateRecipe = async (userId: string, recipeId: string, rating: number, notes?: string) => {
    const { data, error } = await supabase
        .from('user_recipe_interactions')
        .insert({
            user_id: userId,
            recipe_id: recipeId,
            interaction_type: 'rated',
            rating,
            notes,
        })
        .select()
        .maybeSingle()
    if (error) throw error
    return data
}

export const getFavoriteRecipes = async (userId: string) => {
    const { data: interactions, error } = await supabase
        .from('user_recipe_interactions')
        .select('*')
        .eq('user_id', userId)
        .eq('interaction_type', 'favorited')
        .order('interacted_at', { ascending: false })
    if (error) throw error

    if (!interactions || interactions.length === 0) return [];
    
    const recipeIds = interactions.map(i => i.recipe_id).filter(Boolean);
    const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .in('id', recipeIds);
        
    if (recipesError) throw recipesError;
    
    return interactions.map(interaction => ({
        ...interaction,
        recipes: recipes.find(r => r.id === interaction.recipe_id) || null
    }));
}

export const getCookedRecipes = async (userId: string) => {
    const { data: interactions, error } = await supabase
        .from('user_recipe_interactions')
        .select('*')
        .eq('user_id', userId)
        .eq('interaction_type', 'cooked')
        .order('interacted_at', { ascending: false })
    if (error) throw error

    if (!interactions || interactions.length === 0) return [];
    
    const recipeIds = interactions.map(i => i.recipe_id).filter(Boolean);
    const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .in('id', recipeIds);
        
    if (recipesError) throw recipesError;
    
    return interactions.map(interaction => ({
        ...interaction,
        recipes: recipes.find(r => r.id === interaction.recipe_id) || null
    }));
}

// ============================================================================
// PERSONALIZED RECOMMENDATIONS
// ============================================================================

export const getPersonalizedSuggestions = async (userId: string) => {
    try {
        const res = await fetch('/api/personalized-recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        })
        if (!res.ok) throw new Error('personalized-recommendations failed');
        return await res.json()
    } catch (error) {
        console.error("Recommendations failed:", error);
        throw error;
    }
}

export const getCookbookSuggestions = async (userId: string) => {
    try {
        const plan = await getDailyMealSuggestions(userId);
        return {
            breakfast: (plan.breakfast || []).map((m: any) => ({ ...m, name: m.title, subtitle: `${m.calories} kcal` })),
            lunch: (plan.lunch || []).map((m: any) => ({ ...m, name: m.title, subtitle: `${m.calories} kcal` })),
            dinner: (plan.dinner || []).map((m: any) => ({ ...m, name: m.title, subtitle: `${m.calories} kcal` })),
            snacks: (plan.snacks || []).map((m: any) => ({ ...m, name: m.title, subtitle: `${m.calories} kcal` })),
            drinks: (plan.drinks || []).map((m: any) => ({ ...m, name: m.title, subtitle: `${m.calories} kcal` })),
            desserts: (plan.desserts || []).map((m: any) => ({ ...m, name: m.title, subtitle: `${m.calories} kcal` }))
        };
    } catch (e) {
        console.error('[Cookbook] Error fetching AI cookbook suggestions:', e);
        return { breakfast: [], lunch: [], dinner: [], snacks: [], drinks: [], desserts: [] };
    }
}

export const getDailyMealSuggestions = async (userId?: string, forceRefresh = false) => {
    const isUuid = !!userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    // 1. Fetch user timezone from settings
    let userTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Jakarta';
    if (isUuid) {
        try {
            const { data: settings } = await (supabase as any).from('user_settings').select('timezone').eq('user_id', userId).maybeSingle();
            if (settings?.timezone) userTz = settings.timezone;
        } catch (tzErr) {
            console.warn("[Recipes] Could not fetch user timezone:", tzErr);
        }
    }

    // 2. Calculate current hour based on user's timezone
    const now = new Date();
    const localDateStr = now.toLocaleString("en-US", { timeZone: userTz });
    const localHour = new Date(localDateStr).getHours();
    
    let currentSession = 'breakfast';
    if (localHour >= 4 && localHour < 11) currentSession = 'breakfast';
    else if (localHour >= 11 && localHour < 16) currentSession = 'lunch';
    else currentSession = 'dinner';

    const today = now.toISOString().split('T')[0];
    
    // 3. Check if an active AI-generated plan exists for today
    if (isUuid && !forceRefresh) {
        try {
            const { data: existingPlan, error: existingError } = await (supabase as any)
                .from('user_daily_meal_plans')
                .select('*')
                .eq('user_id', userId)
                .eq('plan_date', today)
                .maybeSingle();

            if (existingError && existingError.code !== 'PGRST116') {
                console.error("[Recipes] Error fetching daily plan:", existingError);
            }

            const isLegacyPlaceholder = existingPlan?.breakfast?.[0]?.id === 'b1' || existingPlan?.lunch?.[0]?.id === 'l1';

            if (existingPlan && Array.isArray(existingPlan.breakfast) && existingPlan.breakfast.length > 0 && !isLegacyPlaceholder) {
                return {
                    breakfast: existingPlan.breakfast || [],
                    lunch: existingPlan.lunch || [],
                    dinner: existingPlan.dinner || [],
                    snacks: existingPlan.snacks || [],
                    drinks: existingPlan.drinks || [],
                    desserts: existingPlan.desserts || [],
                    currentSession
                };
            }
        } catch (fetchErr) {
            console.warn("[Recipes] Could not query user_daily_meal_plans:", fetchErr);
        }
    }

    // 4. Generate new plan via AI culinary recommendation engine
    try {
        const { getUserLocation } = await import('./location');
        const loc = await getUserLocation();

        const res = await fetch('/api/daily-meal-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: isUuid ? userId : undefined, locationContext: loc, localHour, forceRefresh })
        });
        
        if (!res.ok) throw new Error("Failed to fetch daily meal plan");
        
        const data = await res.json();
        
        const planToInsert = {
            user_id: isUuid ? userId : undefined,
            plan_date: today,
            breakfast: data.breakfast || [],
            lunch: data.lunch || [],
            dinner: data.dinner || [],
            snacks: data.snacks || [],
            drinks: data.drinks || [],
            desserts: data.desserts || []
        };

        // Insert / update in DB if valid user
        if (isUuid) {
            try {
                await (supabase as any).from('user_daily_meal_plans').upsert([planToInsert], { onConflict: 'user_id,plan_date' });
            } catch (dbErr) {
                console.warn("[Recipes] Could not upsert daily plan:", dbErr);
            }
        }

        return {
            ...planToInsert,
            currentSession
        };
    } catch (err) {
        console.error("[Recipes] Error generating AI daily meal plan:", err);
        return {
            breakfast: [], lunch: [], dinner: [], snacks: [], drinks: [], desserts: [], currentSession
        };
    }
}

const updateDailyRecipeCount = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: existingProgress } = await supabase.from('daily_progress').select('*').eq('user_id', userId).eq('progress_date', today).maybeSingle()
    if (existingProgress) {
        await supabase.from('daily_progress').update({ recipes_cooked: ((existingProgress as any).recipes_cooked || 0) + 1 } as any).eq('id', existingProgress.id)
    } else {
        await supabase.from('daily_progress').insert({
            user_id: userId,
            progress_date: today,
            recipes_cooked: 1,
            calories_consumed: 0,
            calories_goal: 2000,
            meals_logged: 0
        } as any)
    }
}
