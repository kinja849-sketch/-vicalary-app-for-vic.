import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { recipeProvider } from '@/lib/services/RecipeProviderService';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'desserts'];

export async function POST(req: NextRequest) {
  try {
    const { userId, locationContext, localHour, forceRefresh } = await req.json();
    
    // 1. Fetch User Profile & Constraints
    const supabase = createAdminSupabaseClient();
    let allergies = [];
    let intolerances = [];
    let calorieTarget = 2000;
    
    if (userId) {
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();
      const { data: onboarding } = await supabase.from('onboarding_responses').select('*').eq('user_id', userId).single();
      if (onboarding?.allergies) allergies = Array.isArray(onboarding.allergies) ? onboarding.allergies : [onboarding.allergies];
      if (onboarding?.dietary_preference) intolerances = Array.isArray(onboarding.dietary_preference) ? onboarding.dietary_preference : [onboarding.dietary_preference];
      // simplified calorie target
    }

    // 2. AI orchestration: Generate search constraints
    // (In a full implementation, AI would generate dynamic parameters based on user history, but we'll use a fixed AI prompt for now)
    
    const aiPrompt = `
    You are a meal planner orchestrator.
    User Allergies: ${allergies.join(', ') || 'None'}
    User Intolerances: ${intolerances.join(', ') || 'None'}
    Target Calories: ${calorieTarget}
    
    Generate search parameters for each meal category.
    Use one of the following main ingredient keywords for Lunch/Dinner: Chicken, Beef, Seafood, Vegetarian, Vegan.
    Respond with JSON:
    {
      "breakfast": { "query": "Breakfast", "maxCalories": 400 },
      "lunch": { "query": "Chicken", "maxCalories": 600 },
      "dinner": { "query": "Seafood", "maxCalories": 500 },
      "snacks": { "query": "Snack", "maxCalories": 200 },
      "drinks": { "query": "Drink", "maxCalories": 150 },
      "desserts": { "query": "Dessert", "maxCalories": 250 }
    }
    `;

    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: aiPrompt }]
    });

    const aiParams = JSON.parse(aiRes.choices[0].message.content || "{}");

    // 3. Fetch from API Provider & 4. Validation Gate
    const responsePayload: Record<string, any[]> = {};
    const recipesToUpsert: any[] = [];
    const todayIso = new Date().toISOString().split('T')[0];

    for (const cat of CATEGORIES) {
      const params = aiParams[cat] || { query: cat, maxCalories: 500 };
      
      // Request 15 to account for backend allergy filtering dropping some
      const recipes = await recipeProvider.searchRecipes({
        query: params.query,
        number: 15,
        maxCalories: params.maxCalories,
        type: cat === 'drinks' ? 'beverage' : cat
      });

      // Backend Safety Validation Gate
      // 1. Must have an image
      // 2. Must not contain allergies in ingredients (simple string match for now)
      const validRecipes = recipes.filter(r => {
        if (!r.image_url || r.image_url.includes('unsplash')) return false;
        
        const hasAllergy = allergies.some(allergy => {
          return r.ingredients.some(ing => (ing.item || '').toLowerCase().includes(allergy.toLowerCase()));
        });
        
        if (hasAllergy) return false;
        
        return true;
      }).slice(0, 12);

      // Prepare for client payload
      responsePayload[cat] = validRecipes.map(r => ({
        id: r.external_id,
        title: r.title,
        image_url: r.image_url,
        calories: r.total_calories,
        subtitle: `${r.total_calories} kcal`
      }));
      
      // Collect for DB persist
      recipesToUpsert.push(...validRecipes);
    }

    // 5. Database Persistence
    if (recipesToUpsert.length > 0) {
      const mappedForRecipesTable = recipesToUpsert.map(r => ({
        id: crypto.randomUUID(), // Temporarily mapping to UUID for `id` column. Real implementation should match external_id.
        external_id: r.external_id,
        title: r.title,
        image_url: r.image_url,
        ingredients: r.ingredients,
        instructions: r.instructions,
        total_calories: r.total_calories,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        cuisine_type: r.cuisine_type,
        provider: r.provider
      }));

      // Upsert Recipes
      const { error: upsertErr } = await supabase
        .from('recipes')
        .upsert(mappedForRecipesTable, { onConflict: 'external_id' });

      if (upsertErr) console.error("Recipe Upsert Error:", upsertErr);

      // Save Daily Plan
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        
        // We must map the IDs returned to the client to the newly created UUIDs, 
        // but for now we'll just save the external references to the daily plan JSONB.
        
        const { error: planErr } = await supabase.from('user_daily_meal_plans').upsert({
          user_id: userId,
          plan_date: todayIso,
          breakfast: responsePayload.breakfast,
          lunch: responsePayload.lunch,
          dinner: responsePayload.dinner,
          snacks: responsePayload.snacks,
          drinks: responsePayload.drinks,
          desserts: responsePayload.desserts,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,plan_date' });
        
        if (planErr) console.error("Plan Upsert Error:", planErr);
      }
    }

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('daily-meal-plan Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate meal plan' }, { status: 500 });
  }
}
