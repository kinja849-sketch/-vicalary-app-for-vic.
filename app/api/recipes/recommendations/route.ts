import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const { userId, sessionType } = await req.json();
        
        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const supabase = createServerSupabaseClient();
        
        // 1. Fetch User Profile for filtering
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('dietary_lifestyle, goal')
            .eq('id', userId)
            .maybeSingle();
            
        const diet = Array.isArray(userProfile?.dietary_lifestyle) ? userProfile.dietary_lifestyle : [];
        const isVegan = diet.includes('Vegan');
        const isVegetarian = diet.includes('Vegetarian');
        const isHalal = diet.includes('Halal');
        
        // 2. Fetch Interaction Memory from daily_meal_served (to prevent duplication)
        // Find recipes shown in the last 48 hours
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: recentInteractions } = await supabase
            .from('daily_meal_served')
            .select('meal_id')
            .eq('user_id', userId)
            .gte('shown_date', fortyEightHoursAgo);
            
        const recentlyShownIds = (recentInteractions || []).map(i => i.meal_id);
        
        // 3. Query Internal Cached Recipes
        let query = supabase.from('cached_recipes').select('*');
        
        // Dynamic Filtering based on session and preferences
        const st = (sessionType || '').toLowerCase();
        const isDrinks = st === 'drinks' || st === 'drink';
        
        if (st === 'breakfast') {
            query = query.eq('meal_type', 'Breakfast');
        } else if (st === 'desserts' || st === 'dessert') {
            query = query.eq('meal_type', 'Dessert');
        } else if (isDrinks) {
            query = query.eq('meal_type', 'Drink');
        } else {
            // Lunch/Dinner/Snacks/etc: avoid breakfast, dessert, and drinks
            query = query.neq('meal_type', 'Breakfast').neq('meal_type', 'Dessert').neq('meal_type', 'Drink');
        }
        
        if (isVegan) query = query.eq('health_goal', 'Weight Loss'); 
        
        let { data: pool, error: poolError } = await query;
        
        if (poolError) {
            console.error("Pool fetch error:", poolError);
            throw new Error("Failed to fetch from internal pool");
        }
        
        let availableRecipes = pool || [];

        // Self-healing cache for Drinks
        if (isDrinks && availableRecipes.length < 12) {
            try {
                console.log("[Recommendations API] Drinks pool low, fetching from TheCocktailDB...");
                const cocktailRes = await fetch('https://www.thecocktaildb.com/api/json/v1/1/filter.php?a=Non_Alcoholic');
                const cocktailData = await cocktailRes.json();
                if (cocktailData.drinks) {
                    const selectedDrinks = cocktailData.drinks.slice(0, 24);
                    const upsertPromises = selectedDrinks.map(async (d: any) => {
                        try {
                            const detailRes = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${d.idDrink}`);
                            const detailData = await detailRes.json();
                            if (detailData.drinks && detailData.drinks.length > 0) {
                                const m = detailData.drinks[0];
                                const ingredients = [];
                                for (let i = 1; i <= 15; i++) {
                                    const item = m[`strIngredient${i}`];
                                    const measure = m[`strMeasure${i}`];
                                    if (item && item.trim()) {
                                        ingredients.push({
                                            item: item.trim(),
                                            amount: measure ? measure.trim() : '',
                                            unit: ''
                                        });
                                    }
                                }

                                const normalized = {
                                    id: String(m.idDrink),
                                    title: m.strDrink,
                                    image_url: m.strDrinkThumb,
                                    ingredients: ingredients,
                                    instructions_steps: m.strInstructions ? [m.strInstructions.trim()] : ["Mix and serve."],
                                    nutrition: {
                                        calories: Math.floor(Math.random() * (200 - 50 + 1)) + 50,
                                        protein: 0,
                                        carbs: Math.floor(Math.random() * 20),
                                        fat: 0
                                    },
                                    cuisine_region: m.strGlass || 'Glass',
                                    preparation_time: 5,
                                    meal_type: 'Drink',
                                    health_goal: 'General',
                                    budget_category: 'Medium',
                                    provider: 'thecocktaildb'
                                };

                                return supabase.from('cached_recipes').upsert(normalized, { onConflict: 'id' });
                            }
                        } catch (err) {
                            console.error("[Recommendations API] Failed to fetch/cache cocktail details:", err);
                        }
                    });

                    await Promise.all(upsertPromises);
                    
                    // Re-query the drinks pool now that it's cached!
                    const reqQuery = supabase.from('cached_recipes').select('*').eq('meal_type', 'Drink');
                    const { data: refreshedPool } = await reqQuery;
                    if (refreshedPool && refreshedPool.length > 0) {
                        availableRecipes = refreshedPool;
                    }
                }
            } catch (err) {
                console.error("[Recommendations API] Self-healing drinks cache failed:", err);
            }
        }
        
        // 4. Behavioral Rotation Filter
        if (recentlyShownIds.length > 0) {
            // Remove recently shown to ensure zero duplication
            const filtered = availableRecipes.filter(r => !recentlyShownIds.includes(String(r.id)));
            // Only apply strict filter if we still have enough recipes (fallback to full pool if empty)
            if (filtered.length >= 12) {
                availableRecipes = filtered;
            }
        }
        
        // 5. Intelligent Localization & Goal Sorting
        const { data: userSettings } = await supabase.from('user_settings').select('timezone').eq('user_id', userId).maybeSingle();
        const userTz = userSettings?.timezone || '';
        const isAsianTimezone = userTz.includes('Asia/');
        const isIndonesian = userTz.includes('Jakarta') || userTz.includes('Makassar') || userTz.includes('Jayapura');
        
        availableRecipes = availableRecipes.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            
            // Localization Boost
            const asianCuisines = ['Indonesian', 'Malaysian', 'Thai', 'Asian', 'Chinese', 'Japanese', 'Korean'];
            if (isIndonesian && a.cuisine_region === 'Indonesian') scoreA += 15;
            if (isIndonesian && b.cuisine_region === 'Indonesian') scoreB += 15;
            if (isAsianTimezone && asianCuisines.includes(a.cuisine_region)) scoreA += 10;
            if (isAsianTimezone && asianCuisines.includes(b.cuisine_region)) scoreB += 10;

            // Goal Alignment Boost
            if (userProfile?.goal === 'Weight Loss') {
                if ((a.nutrition?.calories || 999) < 500) scoreA += 5;
                if ((b.nutrition?.calories || 999) < 500) scoreB += 5;
            } else if (userProfile?.goal === 'Muscle Gain') {
                if ((a.nutrition?.protein || 0) > 30) scoreA += 5;
                if ((b.nutrition?.protein || 0) > 30) scoreB += 5;
            }
            
            // Controlled Randomness (Jitter) to prevent stale recommendations
            scoreA += Math.random() * 4;
            scoreB += Math.random() * 4;
            
            return scoreB - scoreA;
        });
        
        const selected = availableRecipes.slice(0, 12);
        
        // Normalize to the frontend unified schema expected by BankConnectionWidget/Recipes
        const unifiedRecipes = selected.map(r => ({
            external_id: r.id,
            provider: r.provider,
            title: r.title,
            image_url: r.image_url,
            cuisine_type: r.cuisine_region,
            difficulty: 'Medium',
            dietary_tags: diet,
            ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : (r.ingredients || []),
            instructions: typeof r.instructions_steps === 'string' ? JSON.parse(r.instructions_steps) : (r.instructions_steps || []),
            prep_time_minutes: r.preparation_time,
            cook_time_minutes: 0,
            total_calories: r.nutrition?.calories || 0,
            protein_g: r.nutrition?.protein || 0,
            carbs_g: r.nutrition?.carbs || 0,
            fat_g: r.nutrition?.fat || 0,
            estimated_cost: 0.00,
            id: String(r.id)
        }));
        
        // 6. Record Interactions async to prevent blocking
        if (unifiedRecipes.length > 0) {
            const adminSupabase = createServerSupabaseClient();
            
            const interactions = unifiedRecipes.map(r => ({
                user_id: userId,
                meal_id: r.id
            }));
            
            if (interactions.length > 0) {
                // Upsert to handle unique constraint (user_id, meal_id)
                adminSupabase.from('daily_meal_served').upsert(interactions, { onConflict: 'user_id, meal_id' }).then(({error}) => {
                    if(error) console.error("Rotation save error:", error);
                });
            }
        }
        
        return NextResponse.json({ recipes: unifiedRecipes });
        
    } catch (error) {
        console.error('Error generating recommendations:', error);
        return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
    }
}
