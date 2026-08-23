import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

// This endpoint is meant to be hit by a cron job or manually triggered to populate the internal DB
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        // We can sync by specific category or letter
        const categories = body.categories || ['Seafood', 'Beef', 'Chicken', 'Vegetarian', 'Vegan', 'Pasta', 'Breakfast', 'Dessert'];
        const limitPerCategory = body.limit || 10;
        
        const adminSupabase = createAdminSupabaseClient();
        let totalInserted = 0;
        
        for (const category of categories) {
            // 1. Fetch from TheMealDB Filter
            const listRes = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${category}`);
            const listData = await listRes.json();
            
            if (!listData.meals) continue;
            
            const meals = listData.meals.slice(0, limitPerCategory);
            
            // 2. Fetch full details for normalization
            for (const meal of meals) {
                const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
                const detailData = await detailRes.json();
                
                if (!detailData.meals || detailData.meals.length === 0) continue;
                
                const m = detailData.meals[0];
                
                // Extract ingredients dynamically from strIngredient1 to strIngredient20
                const ingredients = [];
                for (let i = 1; i <= 20; i++) {
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
                
                // Parse Instructions into steps
                const rawInstructions = m.strInstructions || "No instructions provided.";
                const instructions_steps = rawInstructions
                    .split(/\r?\n/)
                    .filter((step: string) => step.trim().length > 3)
                    .map((step: string) => step.trim());
                    
                // Generate generic nutrition if missing, since TheMealDB lacks it
                // In a true hybrid, we'd augment with OpenFoodFacts or Tasty API
                const calories = Math.floor(Math.random() * (800 - 300 + 1)) + 300;
                
                // Normalize schema
                const normalized = {
                    id: m.idMeal,
                    title: m.strMeal,
                    image_url: m.strMealThumb,
                    ingredients: ingredients,
                    instructions_steps: instructions_steps,
                    nutrition: {
                        calories,
                        protein: Math.round(calories * 0.25 / 4),
                        carbs: Math.round(calories * 0.45 / 4),
                        fat: Math.round(calories * 0.30 / 9)
                    },
                    cuisine_region: m.strArea || 'Unknown',
                    preparation_time: 30, // Default estimate
                    meal_type: m.strCategory,
                    health_goal: category === 'Vegan' || category === 'Vegetarian' ? 'Weight Loss' : 'General',
                    budget_category: 'Medium',
                    provider: 'themealdb'
                };
                
                // 3. Upsert to DB
                const { error } = await adminSupabase
                    .from('cached_recipes')
                    .upsert(normalized, { onConflict: 'id' });
                    
                if (error) {
                    console.error("Failed to insert recipe:", error);
                } else {
                    totalInserted++;
                }
            }
        }
        
        return NextResponse.json({ success: true, inserted: totalInserted });
        
    } catch (err: any) {
        console.error("Sync Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
