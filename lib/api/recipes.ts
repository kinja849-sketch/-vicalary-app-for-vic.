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
    try {
        const res = await fetch('/api/recipe-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: recipeId?.toString() })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data?.error || "Failed to fetch details");
        return data;
    } catch (e) {
        if (typeof recipeId === 'string' && recipeId.includes('-')) {
            const { data: recipe } = await supabase.from('recipes').select('*').eq('id', recipeId).maybeSingle();
            if (recipe) return recipe;
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
    const fetchFromApi = async (type: string) => {
        try {
            const count = (type === 'breakfast' || type === 'main course') ? 24 : 4; 
            const res = await fetch('/api/search-recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type || 'main course', number: count, userId })
            });
            if (!res.ok) return [];
            const data = await res.json();
            return (data?.results || []).map((m: any) => ({
                ...m,
                id: String(m.id),
                name: m.title,
                calories: m.calories,
                subtitle: `${m.calories} cal`,
                image: m.image
            }));
        } catch (e) { return []; }
    };

    const categories = ['breakfast', 'main course', 'snack', 'drink', 'dessert'];
    const [b, m, s, dr, ds] = await Promise.all(categories.map(cat => fetchFromApi(cat)));

    const allFetched = [...b, ...m, ...s, ...dr, ...ds];
    const uuidMap = await ensureRecipesUuids(allFetched);
    const mapWithUuid = (list: any[]) => list.map(m => ({ ...m, internal_id: uuidMap[m.id] }));

    const lunch = m.slice(0, 12);
    const dinner = m.slice(12, 24);

    return { 
        breakfast: mapWithUuid(b), 
        lunch: mapWithUuid(lunch), 
        dinner: mapWithUuid(dinner), 
        snacks: mapWithUuid(s), 
        drinks: mapWithUuid(dr), 
        desserts: mapWithUuid(ds) 
    };
}

export const getDailyMealSuggestions = async (userId: string) => {
    // 1. Fetch user timezone from settings
    const { data: settings } = await supabase.from('user_settings').select('timezone').eq('user_id', userId).maybeSingle();
    const userTz = settings?.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');

    // 2. Calculate current hour based on user's timezone
    const now = new Date();
    const localDateStr = now.toLocaleString("en-US", { timeZone: userTz });
    const localHour = new Date(localDateStr).getHours();
    
    let currentSession = 'breakfast';
    if (localHour >= 4 && localHour < 11) currentSession = 'breakfast';
    else if (localHour >= 11 && localHour < 16) currentSession = 'lunch';
    else currentSession = 'dinner';

    const today = now.toISOString().split('T')[0];
    
    // 3. Check if a plan exists for today
    const { data: existingPlan, error: existingError } = await (supabase as any)
        .from('user_daily_meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('plan_date', today)
        .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
        console.error("[Recipes] Error fetching daily plan:", existingError);
    }

    if (existingPlan && Array.isArray((existingPlan as any).breakfast) && (existingPlan as any).breakfast.length > 0) {
        return {
            breakfast: (existingPlan as any).breakfast || [],
            lunch: (existingPlan as any).lunch || [],
            dinner: (existingPlan as any).dinner || [],
            snacks: (existingPlan as any).snacks || [],
            drinks: (existingPlan as any).drinks || [],
            desserts: (existingPlan as any).desserts || [],
            currentSession
        };
    }

    // 4. Generate new plan via unified recommendation API
    try {
        const { getUserLocation } = await import('./location');
        const loc = await getUserLocation();

        const res = await fetch('/api/daily-meal-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, locationContext: loc, localHour })
        });
        
        if (!res.ok) throw new Error("Failed to fetch daily meal plan");
        
        const data = await res.json();
        
        const planToInsert = {
            user_id: userId,
            plan_date: today,
            breakfast: data.breakfast || [],
            lunch: data.lunch || [],
            dinner: data.dinner || [],
            snacks: data.snacks || [],
            drinks: data.drinks || [],
            desserts: data.desserts || []
        };

        // Insert into DB
        await (supabase as any).from('user_daily_meal_plans').upsert([planToInsert], { onConflict: 'user_id,plan_date' });

        return {
            ...planToInsert,
            currentSession
        };
    } catch (err) {
        console.error("[Recipes] Error generating daily meal plan:", err);
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
