import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import { loadUserProfileContext, UserProfileContext } from '@/lib/services/ai/ContextAssembler';
import { CuratedRecipeProvider } from '@/lib/services/recipes/CuratedRecipeProvider';
import { classifyHalal } from '@/lib/services/recipes/HalalClassifier';
import { checkAllergensAndDislikes } from '@/lib/services/recipes/AllergenMatcher';
import { validateMealCategory } from '@/lib/services/recipes/MealCategoryValidator';
import { RecipeDeduplicator } from '@/lib/services/recipes/RecipeDeduplicator';
import { rankRecipesForUser, UserRankingContext } from '@/lib/services/recipes/GoalOrientedRanker';
import { AuthoritativeRecipe, MealCategory } from '@/lib/services/recipes/RecipeProvider';

const CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'dessert'];
const curatedProvider = new CuratedRecipeProvider();

async function handleMealPlanRequest(userId?: string, forceRefresh?: boolean) {
  try {
    const supabase = createAdminSupabaseClient();
    const todayIso = new Date().toISOString().split('T')[0];

    // 1. Fetch User Profile & Onboarding Context
    let userContext: UserProfileContext | null = null;
    let favoriteIds = new Set<string>();

    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      userContext = await loadUserProfileContext(supabase, userId);

      // Fetch user's favorited recipe IDs to enable safe favorites affinity boost
      try {
        const { data: favs } = await supabase
          .from('user_recipe_interactions')
          .select('recipe_id')
          .eq('user_id', userId)
          .eq('interaction_type', 'favorited');
        if (favs) {
          favs.forEach((f: any) => {
            if (f.recipe_id) favoriteIds.add(String(f.recipe_id));
          });
        }
      } catch (favErr) {
        console.warn('[daily-meal-plan] Could not load favorites:', favErr);
      }
    }

    // Default safe profile context if unauthenticated / guest preview
    const allergies = userContext?.allergies || [];
    const dislikes = userContext?.likedFoods ? [] : (userContext as any)?.dislikes || [];
    const goal = userContext?.goal || 'General Health';
    const dailyCalorieGoal = userContext?.dailyCalorieGoal || 2000;
    const preferredCuisines = userContext?.preferredCuisines || [];
    const likedFoods = userContext?.likedFoods || [];
    const medicalConditions = userContext?.medicalConditions || [];

    const rankingContext: UserRankingContext = {
      userId,
      goal,
      dailyCalorieGoal,
      activityLevel: userContext?.activityLevel,
      preferredCuisines,
      likedFoods,
      dislikedFoods: dislikes,
      allergies,
      medicalConditions,
      dietaryLifestyle: userContext?.dietaryPreference ? [userContext.dietaryPreference] : ['Halal'],
      favoriteRecipeIds: favoriteIds
    };

    // 2. Fetch Candidates across Curated Halal Catalog & Supabase Recipes Database
    const curatedCandidates = await curatedProvider.searchRecipes({ meal_category: 'lunch' }); // pulls catalog
    
    // Query database recipes (up to 300 candidates with verified images and ingredients)
    let dbCandidates: AuthoritativeRecipe[] = [];
    try {
      const { data: dbRows } = await supabase
        .from('recipes')
        .select('*')
        .not('image_url', 'is', null)
        .limit(200);

      if (dbRows && Array.isArray(dbRows)) {
        dbCandidates = dbRows.map((r: any) => {
          let ingList = r.ingredients;
          if (typeof ingList === 'string') {
            try { ingList = JSON.parse(ingList); } catch { ingList = []; }
          }
          let instList = r.instructions;
          if (typeof instList === 'string') {
            try { instList = JSON.parse(instList); } catch { instList = []; }
          }
          const tags = Array.isArray(r.dietary_tags) ? r.dietary_tags : [];

          // Infer meal category based on tags or title if not explicitly set
          const titleLower = (r.title || '').toLowerCase();
          let category: MealCategory = 'lunch';
          if (titleLower.includes('oat') || titleLower.includes('pancake') || titleLower.includes('omelet') || titleLower.includes('breakfast') || titleLower.includes('bubur')) {
            category = 'breakfast';
          } else if (titleLower.includes('soup') || titleLower.includes('sup') || titleLower.includes('salad') || titleLower.includes('dinner')) {
            category = 'dinner';
          } else if (titleLower.includes('smoothie') || titleLower.includes('juice') || titleLower.includes('tea') || titleLower.includes('drink')) {
            category = 'drink';
          } else if (titleLower.includes('dessert') || titleLower.includes('pudding') || titleLower.includes('puding')) {
            category = 'dessert';
          } else if (titleLower.includes('snack') || titleLower.includes('bites') || titleLower.includes('edamame')) {
            category = 'snack';
          }

          return {
            id: r.id,
            external_id: r.external_id || String(r.id),
            provider: r.provider || 'internal',
            title: r.title,
            image_url: r.image_url,
            meal_category: category,
            cuisine: r.cuisine_type || 'International',
            prep_time_minutes: Number(r.prep_time_minutes || 15),
            cook_time_minutes: Number(r.cook_time_minutes || 15),
            servings: 1,
            ingredients: Array.isArray(ingList) ? ingList : [],
            instructions: Array.isArray(instList) ? instList : [],
            nutrition: {
              calories: Number(r.total_calories || 0),
              protein_g: Number(r.protein_g || 0),
              carbs_g: Number(r.carbs_g || 0),
              fat_g: Number(r.fat_g || 0)
            },
            dietary_tags: tags
          };
        });
      }
    } catch (dbErr) {
      console.warn('[daily-meal-plan] Could not query database recipes:', dbErr);
    }

    // Combine candidate pools
    const allCandidates = [...curatedCandidates, ...dbCandidates];

    // 3. Process each category through Deterministic Halal, Safety & Ranking gates
    const responsePayload: Record<string, any[]> = {};
    const deduplicator = new RecipeDeduplicator();
    const recipesToUpsert: AuthoritativeRecipe[] = [];

    for (const cat of CATEGORIES) {
      // Filter candidates for this category
      const categoryCandidates = allCandidates.filter(c => {
        const catMatch = c.meal_category === cat || (cat === 'snack' && c.meal_category === 'snack');
        return catMatch;
      });

      // Also allow curated items of the exact category
      const curatedForCat = curatedCandidates.filter(c => c.meal_category === cat);
      const combinedPool = Array.from(new Set([...categoryCandidates, ...curatedForCat]));

      const eligibleRecipes: AuthoritativeRecipe[] = [];

      for (const candidate of combinedPool) {
        // --- GATE 1: HALAL POLICY CHECK (Zero-Tolerance) ---
        const halalEval = classifyHalal({
          title: candidate.title,
          ingredients: candidate.ingredients,
          instructions: candidate.instructions,
          cuisine: candidate.cuisine,
          provider: candidate.provider,
          dietary_tags: candidate.dietary_tags
        });

        if (halalEval.status !== 'HALAL_VERIFIED') {
          continue; // Strictly reject HARAM_DETECTED and HALAL_UNVERIFIED
        }

        // --- GATE 2: CLINICAL ALLERGY & DISLIKES GATE ---
        const allergyEval = checkAllergensAndDislikes(candidate, allergies, dislikes);
        if (!allergyEval.safe) {
          continue; // Strictly reject allergens and stated dislikes
        }

        // --- GATE 3: MEAL CATEGORY INTEGRITY ---
        const categoryEval = validateMealCategory(candidate, cat);
        if (!categoryEval.valid) {
          continue; // Strictly reject misplaced categories (e.g. dessert as breakfast)
        }

        // --- GATE 4: NUTRITIONAL INTEGRITY (No Zero or Missing Calories) ---
        const cals = candidate.nutrition?.calories || candidate.total_calories || 0;
        if (!cals || cals <= 0) {
          continue; // Zero hallucination: do not invent fake calories
        }

        // --- GATE 5: DEDUPLICATION ---
        const dupCheck = deduplicator.isDuplicate(candidate);
        if (dupCheck.duplicate) {
          continue;
        }

        deduplicator.register(candidate);
        eligibleRecipes.push(candidate);
      }

      // --- GATE 6: GOAL-ORIENTED NUTRITIONAL RANKING ---
      const ranked = rankRecipesForUser(eligibleRecipes, rankingContext, cat, 12);

      // Map to contract expected by frontend
      const mappedPayload = ranked.map(r => ({
        id: r.id || r.external_id,
        external_id: r.external_id,
        title: r.title,
        name: r.title,
        image_url: r.image_url,
        image: r.image_url,
        calories: r.nutrition?.calories || r.total_calories || 0,
        total_calories: r.nutrition?.calories || r.total_calories || 0,
        protein: r.nutrition?.protein_g || r.protein_g || 0,
        protein_g: r.nutrition?.protein_g || r.protein_g || 0,
        carbs: r.nutrition?.carbs_g || r.carbs_g || 0,
        carbs_g: r.nutrition?.carbs_g || r.carbs_g || 0,
        fat: r.nutrition?.fat_g || r.fat_g || 0,
        fat_g: r.nutrition?.fat_g || r.fat_g || 0,
        ingredients: r.ingredients || [],
        instructions: r.instructions || [],
        cuisine: r.cuisine || 'Indonesian',
        cuisine_type: r.cuisine || 'Indonesian',
        meal_type: cat,
        subtitle: `${r.nutrition?.calories || r.total_calories || 0} kcal`,
        clinical_justification: r.clinical_justification || 'Personalized for your nutritional objective.'
      }));

      // Store in response payload (map snack -> snacks, drink -> drinks, dessert -> desserts for legacy compatibility)
      const key = cat === 'snack' ? 'snacks' : cat === 'drink' ? 'drinks' : cat === 'dessert' ? 'desserts' : cat;
      responsePayload[key] = mappedPayload;

      recipesToUpsert.push(...ranked);
    }

    // 4. Persistence to Supabase
    if (recipesToUpsert.length > 0) {
      const dbMapped = recipesToUpsert.map(r => ({
        external_id: r.external_id,
        title: r.title,
        image_url: r.image_url,
        ingredients: r.ingredients || [],
        instructions: r.instructions || [],
        total_calories: r.nutrition?.calories || r.total_calories || 0,
        protein_g: r.nutrition?.protein_g || r.protein_g || 0,
        carbs_g: r.nutrition?.carbs_g || r.carbs_g || 0,
        fat_g: r.nutrition?.fat_g || r.fat_g || 0,
        cuisine_type: r.cuisine || 'Indonesian',
        provider: r.provider || 'curated'
      }));

      try {
        await supabase.from('recipes').upsert(dbMapped, { onConflict: 'external_id' });
      } catch (upsertErr) {
        console.warn('[daily-meal-plan] Recipe upsert notice:', upsertErr);
      }

      // 5. Cache Daily Plan with User Constraint Fingerprint
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        try {
          await supabase.from('user_daily_meal_plans').upsert({
            user_id: userId,
            plan_date: todayIso,
            breakfast: responsePayload.breakfast || [],
            lunch: responsePayload.lunch || [],
            dinner: responsePayload.dinner || [],
            snacks: responsePayload.snacks || [],
            drinks: responsePayload.drinks || [],
            desserts: responsePayload.desserts || [],
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,plan_date' });
        } catch (planErr) {
          console.warn('[daily-meal-plan] Plan cache notice:', planErr);
        }
      }
    }

    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error('[daily-meal-plan] Error generating meal plan:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate meal plan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handleMealPlanRequest(body.userId, body.forceRefresh);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || undefined;
  const forceRefresh = req.nextUrl.searchParams.get('forceRefresh') === 'true';
  return handleMealPlanRequest(userId, forceRefresh);
}
