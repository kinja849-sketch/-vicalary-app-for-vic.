import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { loadUserProfileContext, UserProfileContext } from '@/lib/services/ai/ContextAssembler';
import { CuratedRecipeProvider } from '@/lib/services/recipes/CuratedRecipeProvider';
import { TheMealDBRecipeProvider } from '@/lib/services/recipes/TheMealDBRecipeProvider';
import { classifyHalal } from '@/lib/services/recipes/HalalClassifier';
import { checkAllergensAndDislikes } from '@/lib/services/recipes/AllergenMatcher';
import { validateMealCategory } from '@/lib/services/recipes/MealCategoryValidator';
import { RecipeDeduplicator } from '@/lib/services/recipes/RecipeDeduplicator';
import { rankRecipesForUser, UserRankingContext } from '@/lib/services/recipes/GoalOrientedRanker';
import { AuthoritativeRecipe, MealCategory, Ingredient, Instruction } from '@/lib/services/recipes/RecipeProvider';
import { sanitizeFoodImageUrl } from '@/lib/services/FoodImageService';
import { buildAllergyAwareHistoryNarrative } from '@/lib/services/recipes/AllergySafeRecipeAdapter';
import { RecipeInstructionNormalizer } from '@/lib/services/recipes/RecipeInstructionNormalizer';

const CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'dessert'];
const curatedProvider = new CuratedRecipeProvider();
const mealDbProvider = new TheMealDBRecipeProvider();

function normalizeCandidateIngredients(raw: any): Ingredient[] {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw.split(/\r?\n+/).map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((ing: any) => {
      if (typeof ing === 'string') {
        const clean = ing.trim();
        return { item: clean, amount: '', unit: '', normalized_name: clean.toLowerCase() };
      }
      const item = String(ing?.item || ing?.name || ing?.original || '').trim();
      return {
        item,
        amount: ing?.amount ?? '',
        unit: String(ing?.unit ?? ''),
        normalized_name: String(ing?.normalized_name || ing?.name || item).toLowerCase()
      };
    })
    .filter((i: Ingredient) => i.item.length > 0);
}

function normalizeCandidateInstructions(raw: any): Instruction[] {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw
        .split(/\r?\n+/)
        .map((s: string) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(parsed)) return [];
  const steps: Instruction[] = [];
  for (const s of parsed) {
    let text = '';
    if (typeof s === 'string') {
      text = s.trim();
    } else if (typeof s?.instruction === 'string' && s.instruction.trim()) {
      text = s.instruction.trim();
    } else if (typeof s?.step === 'string' && s.step.trim()) {
      text = s.step.trim();
    } else if (typeof s?.text === 'string' && s.text.trim()) {
      text = s.text.trim();
    }
    if (text.length > 3) {
      steps.push({ step: steps.length + 1, instruction: text });
    }
  }
  return steps;
}

function inferMealCategory(title: string, explicitCategory?: string | null): MealCategory {
  const exp = (explicitCategory || '').toLowerCase().trim();
  if (exp === 'breakfast') return 'breakfast';
  if (exp === 'lunch') return 'lunch';
  if (exp === 'dinner') return 'dinner';
  if (exp === 'snack' || exp === 'snacks') return 'snack';
  if (exp === 'drink' || exp === 'drinks' || exp === 'beverage') return 'drink';
  if (exp === 'dessert' || exp === 'desserts') return 'dessert';

  const t = (title || '').toLowerCase();
  if (/\b(smoothies?|juices?|latte|matcha|shakes?|infused|wedang|bandrek|bajigur|teh|lassi|drink|beverage|tea|cooler)\b/i.test(t)) {
    return 'drink';
  }
  if (/\b(desserts?|puddings?|puding|parfait|cakes?|brownies?|tarts?|sorbet|kolak|mousse|custard|crumble|truffle)\b/i.test(t)) {
    return 'dessert';
  }
  if (/\b(oat|oats|oatmeal|porridge|pancakes?|omelets?|omelettes?|frittata|breakfast|bubur|granola|shakshuka|toast|scramble)\b/i.test(t)) {
    return 'breakfast';
  }
  if (/\b(snacks?|bites|edamame|hummus|guacamole|crackers|bruschetta|energy balls|spring rolls|wedges|roll-ups)\b/i.test(t)) {
    return 'snack';
  }
  if (/\b(soups?|sup|soto|rawon|stews?|steak|roast|grilled salmon|nila bakar|dinner|curry|kofta|minestrone)\b/i.test(t)) {
    return 'dinner';
  }
  return 'lunch';
}

async function handleMealPlanRequest(req: NextRequest, requestedUserId?: string, forceRefresh?: boolean) {
  try {
    const supabase = createAdminSupabaseClient();
    const todayIso = new Date().toISOString().split('T')[0];

    // Resolve user ID from authenticated session first, falling back to provided UUID
    let userId = requestedUserId;
    if (!userId) {
      const authUser = await getAuthenticatedUser(req);
      if (authUser?.id) userId = authUser.id;
    }

    // 1. Fetch User Profile & Onboarding Context
    let userContext: UserProfileContext | null = null;
    const favoriteIds = new Set<string>();

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

    const allergies = userContext?.allergies || [];
    const dislikes = userContext?.dislikedFoods || [];
    const goal = userContext?.goal || 'General Health';
    const dailyCalorieGoal = userContext?.dailyCalorieGoal || 2000;
    const preferredCuisines = userContext?.preferredCuisines || [];
    const likedFoods = userContext?.likedFoods || [];
    const medicalConditions = userContext?.medicalConditions || [];
    const dietaryPreference = userContext?.dietaryPreference || 'Balanced';
    const dietaryLifestyle = userContext?.dietaryLifestyle || ['Halal'];

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
      dietaryPreference,
      dietaryLifestyle,
      cookingSkill: userContext?.cookingSkill,
      mealPrepTime: userContext?.mealPrepTime,
      favoriteRecipeIds: favoriteIds
    };

    // 2. Fetch Candidates across Curated Halal Catalog, Complete Supabase Recipes (excluding Spoonacular), Cached Recipes (TheMealDB), & Live TheMealDB
    const curatedCandidates = await curatedProvider.searchRecipes({});

    let dbCandidates: AuthoritativeRecipe[] = [];
    let cachedCandidates: AuthoritativeRecipe[] = [];

    try {
      const [{ data: dbRows }, { data: cachedRows }] = await Promise.all([
        supabase
          .from('recipes')
          .select('*')
          .neq('provider', 'spoonacular')
          .not('image_url', 'is', null)
          .gt('total_calories', 0)
          .limit(300),
        supabase
          .from('cached_recipes')
          .select('*')
          .not('image_url', 'is', null)
          .limit(200)
      ]);

      if (dbRows && Array.isArray(dbRows)) {
        for (const r of dbRows) {
          const extId = String(r.external_id || '');
          if (r.provider === 'spoonacular' || extId.startsWith('spoonacular_') || extId.startsWith('curated_')) {
            continue;
          }
          const ingList = normalizeCandidateIngredients(r.ingredients);
          const instList = normalizeCandidateInstructions(r.instructions);
          const tags = Array.isArray(r.dietary_tags) ? r.dietary_tags : ['Halal'];
          const category = inferMealCategory(r.title || '', r.meal_category || r.meal_type);
          const cuisine = r.cuisine_type || 'International';
          const safeImageUrl = sanitizeFoodImageUrl(r.image_url, r.title || '', cuisine, category);

          dbCandidates.push({
            id: r.id,
            external_id: r.external_id || String(r.id),
            provider: r.provider || 'curated',
            title: r.title,
            image_url: safeImageUrl,
            meal_category: category,
            cuisine,
            prep_time_minutes: Number(r.prep_time_minutes || 15),
            cook_time_minutes: Number(r.cook_time_minutes || 15),
            servings: 1,
            ingredients: ingList,
            instructions: instList,
            nutrition: {
              calories: Number(r.total_calories || 0),
              protein_g: Number(r.protein_g || 0),
              carbs_g: Number(r.carbs_g || 0),
              fat_g: Number(r.fat_g || 0)
            },
            dietary_tags: tags
          });
        }
      }

      if (cachedRows && Array.isArray(cachedRows)) {
        for (const c of cachedRows) {
          if (c.provider === 'spoonacular') continue;
          const ingList = normalizeCandidateIngredients(c.ingredients);
          const instList = normalizeCandidateInstructions(c.instructions_steps || c.instructions);
          const cals = Number(c.nutrition?.calories || c.total_calories || 0);
          if (cals <= 0) continue;
          const tags = Array.isArray(c.dietary_tags) ? c.dietary_tags : ['Halal'];
          const category = inferMealCategory(c.title || '', c.meal_type || c.meal_category);
          const cuisine = c.cuisine_region || c.cuisine_type || 'International';
          const safeImageUrl = sanitizeFoodImageUrl(c.image_url, c.title || '', cuisine, category);

          cachedCandidates.push({
            id: String(c.id),
            external_id: c.external_id || `themealdb_${c.id}`,
            provider: (c.provider as any) || 'themealdb',
            title: c.title,
            image_url: safeImageUrl,
            meal_category: category,
            cuisine,
            prep_time_minutes: Number(c.preparation_time || c.prep_time_minutes || 15),
            cook_time_minutes: Number(c.cook_time_minutes || 20),
            servings: Number(c.servings || 1),
            ingredients: ingList,
            instructions: instList,
            nutrition: {
              calories: cals,
              protein_g: Number(c.nutrition?.protein || c.protein_g || 0),
              carbs_g: Number(c.nutrition?.carbs || c.carbs_g || 0),
              fat_g: Number(c.nutrition?.fat || c.fat_g || 0)
            },
            dietary_tags: tags
          });
        }
      }
    } catch (dbErr) {
      console.warn('[daily-meal-plan] Could not query database recipes:', dbErr);
    }

    // 2.5 Optional live TheMealDB enrichment when forceRefresh is requested
    const mealDbLiveCandidates: AuthoritativeRecipe[] = [];
    if (forceRefresh) {
      try {
        const searchTerm = likedFoods[0] || 'chicken';
        const liveMeals = await mealDbProvider.searchRecipes({
          query: searchTerm,
          allergies,
          disliked_foods: dislikes,
          limit: 6
        });
        mealDbLiveCandidates.push(...liveMeals);
      } catch (mErr) {
        console.warn('[daily-meal-plan] Live TheMealDB enrichment skipped:', mErr);
      }
    }

    // Combine candidate pools (Curated Halal Everyday Catalog first so practical meals lead)
    const allCandidates = [
      ...curatedCandidates,
      ...mealDbLiveCandidates,
      ...cachedCandidates,
      ...dbCandidates
    ];

    // 3. Process each category through Deterministic Halal, Safety, Completeness & Ranking gates
    const responsePayload: Record<string, any[]> = {};
    const selectedPlanDeduplicator = new RecipeDeduplicator();
    const usedPlanImages = new Set<string>();
    const recipesToUpsert: AuthoritativeRecipe[] = [];

    for (const cat of CATEGORIES) {
      const categoryDeduplicator = new RecipeDeduplicator();
      const usedCategoryCandidateImages = new Set<string>(usedPlanImages);

      const categoryCandidates = allCandidates.filter(c => {
        if (c.provider === 'curated') {
          return c.meal_category === cat;
        }
        if (cat === 'lunch' || cat === 'dinner') {
          return c.meal_category === 'lunch' || c.meal_category === 'dinner';
        }
        return c.meal_category === cat;
      });

      const eligibleRecipes: AuthoritativeRecipe[] = [];

      for (const candidate of categoryCandidates) {
        if (!candidate.title || /option\s+\d+/i.test(candidate.title)) {
          continue;
        }

        // Ensure candidate has a unique image before deduplication checks so old DB rows don't collide
        const candidateImage = sanitizeFoodImageUrl(
          candidate.image_url,
          candidate.title,
          candidate.cuisine,
          cat,
          usedCategoryCandidateImages
        );
        const normalizedCandidate: AuthoritativeRecipe = {
          ...candidate,
          image_url: candidateImage
        };

        if (selectedPlanDeduplicator.isDuplicate(normalizedCandidate).duplicate) {
          continue;
        }

        // --- GATE 1: HALAL POLICY CHECK (Zero-Tolerance) ---
        const halalEval = classifyHalal({
          title: normalizedCandidate.title,
          ingredients: normalizedCandidate.ingredients,
          instructions: normalizedCandidate.instructions,
          cuisine: normalizedCandidate.cuisine,
          provider: normalizedCandidate.provider,
          dietary_tags: normalizedCandidate.dietary_tags
        });

        if (halalEval.status !== 'HALAL_VERIFIED') {
          continue;
        }

        // --- GATE 2: CLINICAL ALLERGY & DISLIKES GATE ---
        const allergyEval = checkAllergensAndDislikes(normalizedCandidate, allergies, dislikes);
        if (!allergyEval.safe) {
          continue;
        }

        // --- GATE 3: MEAL CATEGORY INTEGRITY ---
        const categoryEval = validateMealCategory(normalizedCandidate, cat);
        if (!categoryEval.valid) {
          continue;
        }

        // --- GATE 4: NUTRITIONAL & CULINARY COMPLETENESS INTEGRITY ---
        const cals = normalizedCandidate.nutrition?.calories || normalizedCandidate.total_calories || 0;
        if (!cals || cals <= 0) {
          continue;
        }
        if (!Array.isArray(normalizedCandidate.ingredients) || normalizedCandidate.ingredients.length < 2) {
          continue;
        }
        if (!Array.isArray(normalizedCandidate.instructions) || normalizedCandidate.instructions.length < 2) {
          continue;
        }

        // --- GATE 5: WITHIN-CATEGORY DEDUPLICATION ---
        const dupCheck = categoryDeduplicator.isDuplicate(normalizedCandidate);
        if (dupCheck.duplicate) {
          continue;
        }

        categoryDeduplicator.register(normalizedCandidate);
        eligibleRecipes.push(normalizedCandidate);
      }

      // --- GATE 6: GOAL & ONBOARDING NUTRITIONAL RANKING ---
      const ranked = rankRecipesForUser(eligibleRecipes, rankingContext, cat, 12);

      const mappedPayload = ranked.map(r => {
        const resolvedImage = sanitizeFoodImageUrl(r.image_url, r.title, r.cuisine, cat, usedPlanImages);
        r.image_url = resolvedImage;
        selectedPlanDeduplicator.register(r);

        const normDetails = RecipeInstructionNormalizer.normalizeRecipeDetails({
          id: String(r.id || r.external_id || ''),
          title: r.title,
          image_url: resolvedImage,
          cuisine_type: r.cuisine || 'International',
          dietary_tags: r.dietary_tags || ['Halal'],
          ingredients: r.ingredients || [],
          instructions: r.instructions || [],
          prep_time_minutes: r.prep_time_minutes || 10,
          cook_time_minutes: r.cook_time_minutes || 15,
          total_calories: r.nutrition?.calories || r.total_calories || 0,
          protein_g: r.nutrition?.protein_g || r.protein_g || 0,
          carbs_g: r.nutrition?.carbs_g || r.carbs_g || 0,
          fat_g: r.nutrition?.fat_g || r.fat_g || 0
        });

        const finalInstructions: Instruction[] = normDetails.instructions.map((text, idx) => ({
          step: idx + 1,
          instruction: text
        }));

        return {
          id: r.id || r.external_id,
          external_id: r.external_id,
          title: r.title,
          name: r.title,
          image_url: resolvedImage,
          image: resolvedImage,
          calories: r.nutrition?.calories || r.total_calories || 0,
          total_calories: r.nutrition?.calories || r.total_calories || 0,
          protein: r.nutrition?.protein_g || r.protein_g || 0,
          protein_g: r.nutrition?.protein_g || r.protein_g || 0,
          carbs: r.nutrition?.carbs_g || r.carbs_g || 0,
          carbs_g: r.nutrition?.carbs_g || r.carbs_g || 0,
          fat: r.nutrition?.fat_g || r.fat_g || 0,
          fat_g: r.nutrition?.fat_g || r.fat_g || 0,
          prep_time_minutes: normDetails.prep_time_minutes,
          cook_time_minutes: normDetails.cook_time_minutes,
          ingredients: r.ingredients || [],
          instructions: finalInstructions,
          dietary_tags: r.dietary_tags || ['Halal'],
          cuisine: r.cuisine || 'International',
          cuisine_type: r.cuisine || 'International',
          meal_type: cat,
          subtitle: `${r.nutrition?.calories || r.total_calories || 0} kcal`,
          description: buildAllergyAwareHistoryNarrative(
            r.title,
            r.ingredients || [],
            r.clinical_justification || '',
            userContext,
            [],
            r.nutrition?.calories || r.total_calories || 350,
            r.nutrition?.protein_g || r.protein_g || 20
          ),
          clinical_justification: buildAllergyAwareHistoryNarrative(
            r.title,
            r.ingredients || [],
            r.clinical_justification || '',
            userContext,
            [],
            r.nutrition?.calories || r.total_calories || 350,
            r.nutrition?.protein_g || r.protein_g || 20
          )
        };
      });

      const key = cat === 'snack' ? 'snacks' : cat === 'drink' ? 'drinks' : cat === 'dessert' ? 'desserts' : cat;
      responsePayload[key] = mappedPayload;

      recipesToUpsert.push(...ranked);
    }

    // 4. Persistence to Supabase (deduplicate by external_id before upserting)
    if (recipesToUpsert.length > 0) {
      const uniqueUpsertMap = new Map<string, any>();
      for (const r of recipesToUpsert) {
        const extId = r.external_id || String(r.id || '');
        if (!extId) continue;
        const safeImg = r.image_url || sanitizeFoodImageUrl(r.image_url, r.title, r.cuisine, r.meal_category);
        uniqueUpsertMap.set(extId, {
          external_id: extId,
          title: r.title,
          image_url: safeImg,
          ingredients: r.ingredients || [],
          instructions: r.instructions || [],
          prep_time_minutes: r.prep_time_minutes || 10,
          cook_time_minutes: r.cook_time_minutes || 15,
          total_calories: r.nutrition?.calories || r.total_calories || 0,
          protein_g: r.nutrition?.protein_g || r.protein_g || 0,
          carbs_g: r.nutrition?.carbs_g || r.carbs_g || 0,
          fat_g: r.nutrition?.fat_g || r.fat_g || 0,
          dietary_tags: r.dietary_tags || ['Halal'],
          cuisine_type: r.cuisine || 'International',
          provider: r.provider || 'curated'
        });
      }

      try {
        await supabase.from('recipes').upsert(Array.from(uniqueUpsertMap.values()), { onConflict: 'external_id' });
      } catch (upsertErr) {
        console.warn('[daily-meal-plan] Recipe upsert notice:', upsertErr);
      }

      // 5. Cache Daily Plan for this User
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
  return handleMealPlanRequest(req, body.userId, body.forceRefresh);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || undefined;
  const forceRefresh = req.nextUrl.searchParams.get('forceRefresh') === 'true';
  return handleMealPlanRequest(req, userId, forceRefresh);
}
