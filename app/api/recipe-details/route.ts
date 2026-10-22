import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { loadUserProfileContext, UserProfileContext } from '@/lib/services/ai/ContextAssembler';
import { RecipeInstructionNormalizer } from '@/lib/services/recipes/RecipeInstructionNormalizer';
import { CuratedRecipeProvider } from '@/lib/services/recipes/CuratedRecipeProvider';
import { TheMealDBRecipeProvider } from '@/lib/services/recipes/TheMealDBRecipeProvider';
import { adaptRecipeForUser } from '@/lib/services/recipes/AllergySafeRecipeAdapter';
import { sanitizeFoodImageUrl } from '@/lib/services/FoodImageService';
import { AuthoritativeRecipe } from '@/lib/services/recipes/RecipeProvider';

const curatedProvider = new CuratedRecipeProvider();
const mealDbProvider = new TheMealDBRecipeProvider();

function parseIngredients(ingredientsRaw: any): Array<{ item: string; amount: string | number; unit: string }> {
  if (!ingredientsRaw) return [];
  if (typeof ingredientsRaw === 'string') {
    try {
      ingredientsRaw = JSON.parse(ingredientsRaw);
    } catch {
      return [{ item: ingredientsRaw, amount: '', unit: '' }];
    }
  }
  if (!Array.isArray(ingredientsRaw)) return [];

  return ingredientsRaw.map((ing: any) => {
    if (typeof ing === 'string') {
      return { item: ing, amount: '', unit: '' };
    }
    return {
      item: ing.item || ing.name || String(ing),
      amount: ing.amount ?? '',
      unit: ing.unit ?? ''
    };
  });
}

function extractInstructionString(s: any): string {
  if (typeof s === 'string') return s.trim();
  if (typeof s?.instruction === 'string' && s.instruction.trim()) return s.instruction.trim();
  if (typeof s?.step === 'string' && s.step.trim()) return s.step.trim();
  if (typeof s?.text === 'string' && s.text.trim()) return s.text.trim();
  return '';
}

function parseInstructions(instructionsRaw: any): string[] {
  if (!instructionsRaw) return [];
  if (typeof instructionsRaw === 'string') {
    try {
      const parsed = JSON.parse(instructionsRaw);
      if (Array.isArray(parsed)) return parsed.map(extractInstructionString).filter(Boolean);
    } catch {
      const steps = instructionsRaw
        .split(/\r?\n+/)
        .map((s: string) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);
      return steps.length > 0 ? steps : [instructionsRaw.trim()];
    }
  }
  if (Array.isArray(instructionsRaw)) {
    return instructionsRaw.map(extractInstructionString).filter(Boolean);
  }
  return [];
}

function finalizeWithAllergyAdaptation(rawDetails: any, userContext: UserProfileContext | null) {
  // First normalize instructions, timings, and base culinary history
  const baseNormalized = RecipeInstructionNormalizer.normalizeRecipeDetails(rawDetails);

  // Build an AuthoritativeRecipe packet to run through AllergySafeRecipeAdapter
  const candidate: AuthoritativeRecipe = {
    id: baseNormalized.id,
    external_id: baseNormalized.id,
    provider: 'curated',
    title: baseNormalized.title,
    image_url: sanitizeFoodImageUrl(
      baseNormalized.image_url,
      baseNormalized.title,
      baseNormalized.cuisine_type,
      'lunch'
    ),
    meal_category: 'lunch',
    cuisine: baseNormalized.cuisine_type,
    prep_time_minutes: baseNormalized.prep_time_minutes,
    cook_time_minutes: baseNormalized.cook_time_minutes,
    servings: baseNormalized.servings,
    ingredients: baseNormalized.ingredients.map(i => ({
      item: i.item,
      amount: i.amount,
      unit: i.unit,
      normalized_name: i.item.toLowerCase()
    })),
    instructions: baseNormalized.instructions.map((text, idx) => ({
      step: idx + 1,
      instruction: text
    })),
    nutrition: {
      calories: baseNormalized.total_calories || 350,
      protein_g: baseNormalized.protein_g || 18,
      carbs_g: baseNormalized.carbs_g || 40,
      fat_g: baseNormalized.fat_g || 10
    },
    dietary_tags: baseNormalized.dietary_tags
  };

  const adaptedResult = adaptRecipeForUser(candidate, userContext, baseNormalized.description);
  const adapted = adaptedResult.recipe;

  // Re-normalize with adapted title, ingredients, instructions, and the 3-part allergy-aware history narrative
  const finalNormalized = RecipeInstructionNormalizer.normalizeRecipeDetails({
    ...baseNormalized,
    id: adapted.id || baseNormalized.id,
    title: adapted.title,
    image_url: adapted.image_url,
    ingredients: adapted.ingredients,
    instructions: adapted.instructions.map(i => i.instruction),
    description: adaptedResult.historyNarrative,
    total_calories: adapted.nutrition.calories,
    protein_g: adapted.nutrition.protein_g,
    carbs_g: adapted.nutrition.carbs_g,
    fat_g: adapted.nutrition.fat_g
  });

  return {
    ...finalNormalized,
    description: adaptedResult.historyNarrative,
    clinical_justification: adaptedResult.historyNarrative
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawId = body?.id?.toString()?.trim();
    if (!rawId) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // Resolve user context so RecipeDetails enforces onboarding allergies and renders the 3-part history narrative
    let resolvedUserId = body?.userId;
    if (!resolvedUserId) {
      const authUser = await getAuthenticatedUser(req);
      if (authUser?.id) resolvedUserId = authUser.id;
    }

    let userContext: UserProfileContext | null = null;
    if (resolvedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId)) {
      userContext = await loadUserProfileContext(supabase, resolvedUserId);
    }

    const cleanId = rawId.replace(/^(themealdb_|cocktail_|spoonacular_)/i, '');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    // 0. Check CuratedRecipeProvider or Universal Search ID directly
    if (rawId.startsWith('curated_')) {
      const curatedMatch =
        (await curatedProvider.getRecipeById(rawId)) ||
        (rawId.startsWith('curated_search_') ? await mealDbProvider.getRecipeById(rawId) : null);

      if (curatedMatch) {
        return NextResponse.json(
          finalizeWithAllergyAdaptation(
            {
              id: curatedMatch.external_id,
              title: curatedMatch.title,
              image_url: curatedMatch.image_url,
              cuisine_type: curatedMatch.cuisine || 'International',
              dietary_tags: curatedMatch.dietary_tags || ['Halal'],
              ingredients: parseIngredients(curatedMatch.ingredients),
              instructions: parseInstructions(curatedMatch.instructions),
              prep_time_minutes: curatedMatch.prep_time_minutes,
              cook_time_minutes: curatedMatch.cook_time_minutes,
              total_calories: curatedMatch.nutrition?.calories || 0,
              protein_g: curatedMatch.nutrition?.protein_g || 0,
              carbs_g: curatedMatch.nutrition?.carbs_g || 0,
              fat_g: curatedMatch.nutrition?.fat_g || 0,
              servings: curatedMatch.servings || 1,
              description: ''
            },
            userContext
          )
        );
      }
    }

    // 1. Check cached_recipes table
    let cached: any = null;
    try {
      let cachedQuery = supabase.from('cached_recipes').select('*');
      if (isUuid) {
        cachedQuery = cachedQuery.eq('id', rawId);
      } else {
        cachedQuery = cachedQuery.or(`id.eq.${rawId},id.eq.${cleanId}`);
      }
      const { data } = await cachedQuery.maybeSingle();
      cached = data;
    } catch (e) {
      console.warn('[recipe-details] cached_recipes query skipped:', e);
    }

    if (cached) {
      return NextResponse.json(
        finalizeWithAllergyAdaptation(
          {
            ...cached,
            id: String(cached.id),
            title: cached.title || 'Untitled Recipe',
            image_url: cached.image_url || '',
            cuisine_type: cached.cuisine_region || cached.cuisine_type || 'International',
            dietary_tags: Array.isArray(cached.dietary_tags) ? cached.dietary_tags : ['Halal'],
            ingredients: parseIngredients(cached.ingredients),
            instructions: parseInstructions(cached.instructions_steps || cached.instructions),
            prep_time_minutes: cached.preparation_time || cached.prep_time_minutes,
            cook_time_minutes: cached.cook_time_minutes,
            total_calories: cached.nutrition?.calories || cached.total_calories || 360,
            protein_g: Number(cached.nutrition?.protein || cached.protein_g || 22),
            carbs_g: Number(cached.nutrition?.carbs || cached.carbs_g || 40),
            fat_g: Number(cached.nutrition?.fat || cached.fat_g || 11),
            servings: cached.servings || 2,
            description: ''
          },
          userContext
        )
      );
    }

    // 2. Check recipes table (UUID or external_id)
    let recipeQuery = supabase.from('recipes').select('*');
    if (isUuid) {
      recipeQuery = recipeQuery.eq('id', rawId);
    } else {
      const isNumeric = !isNaN(Number(cleanId)) && cleanId.trim() !== '';
      if (isNumeric) {
        recipeQuery = recipeQuery.or(`external_id.eq.${rawId},external_id.eq.${cleanId},spoonacular_id.eq.${cleanId}`);
      } else {
        recipeQuery = recipeQuery.or(`external_id.eq.${rawId},external_id.eq.${cleanId}`);
      }
    }

    const { data: dbRecipeRows } = await recipeQuery.limit(1);
    const dbRecipe = Array.isArray(dbRecipeRows) ? dbRecipeRows[0] : dbRecipeRows;

    if (dbRecipe) {
      let ingredients = parseIngredients(dbRecipe.ingredients);
      let instructions = parseInstructions(dbRecipe.instructions);
      let protein_g = dbRecipe.protein_g != null ? Number(dbRecipe.protein_g) : null;
      let carbs_g = dbRecipe.carbs_g != null ? Number(dbRecipe.carbs_g) : null;
      let fat_g = dbRecipe.fat_g != null ? Number(dbRecipe.fat_g) : null;
      let calories = dbRecipe.total_calories || 0;

      if (ingredients.length === 0 || instructions.length === 0 || protein_g === null || protein_g === 0) {
        try {
          const sanitizedTitle = (dbRecipe.title || '').replace(/[(),.%]/g, '').trim();
          if (sanitizedTitle.length >= 3) {
            const { data: canonicalMatches } = await supabase
              .from('recipes')
              .select('*')
              .ilike('title', `%${sanitizedTitle}%`)
              .neq('id', dbRecipe.id)
              .limit(5);

            if (canonicalMatches && canonicalMatches.length > 0) {
              const bestMatch =
                canonicalMatches.find((m: any) => {
                  const ings = parseIngredients(m.ingredients);
                  const insts = parseInstructions(m.instructions);
                  return ings.length > 0 && insts.length > 0;
                }) || canonicalMatches[0];

              if (bestMatch) {
                if (ingredients.length === 0) ingredients = parseIngredients(bestMatch.ingredients);
                if (instructions.length === 0) instructions = parseInstructions(bestMatch.instructions);
                if ((protein_g === null || protein_g === 0) && bestMatch.protein_g != null) protein_g = Number(bestMatch.protein_g);
                if ((carbs_g === null || carbs_g === 0) && bestMatch.carbs_g != null) carbs_g = Number(bestMatch.carbs_g);
                if ((fat_g === null || fat_g === 0) && bestMatch.fat_g != null) fat_g = Number(bestMatch.fat_g);
                if (calories === 0 && bestMatch.total_calories) calories = bestMatch.total_calories;
              }
            }
          }
        } catch (enrichErr) {
          console.warn('[recipe-details] Canonical title enrichment skipped:', enrichErr);
        }
      }

      return NextResponse.json(
        finalizeWithAllergyAdaptation(
          {
            ...dbRecipe,
            id: String(dbRecipe.id),
            title: dbRecipe.title || 'Untitled Recipe',
            image_url: dbRecipe.image_url || '',
            cuisine_type: dbRecipe.cuisine_type || 'International',
            dietary_tags: Array.isArray(dbRecipe.dietary_tags) ? dbRecipe.dietary_tags : ['Halal'],
            ingredients,
            instructions,
            prep_time_minutes: dbRecipe.prep_time_minutes,
            cook_time_minutes: dbRecipe.cook_time_minutes,
            total_calories: calories || 350,
            protein_g: protein_g != null ? protein_g : 20,
            carbs_g: carbs_g != null ? carbs_g : 40,
            fat_g: fat_g != null ? fat_g : 10,
            servings: 2,
            description: ''
          },
          userContext
        )
      );
    }

    // 2.5 Check user_daily_meal_plans
    try {
      const { data: dailyPlans } = await (supabase as any)
        .from('user_daily_meal_plans')
        .select('id, user_id, plan_date, breakfast, lunch, dinner, snacks, drinks, desserts, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (dailyPlans && Array.isArray(dailyPlans)) {
        for (const dp of dailyPlans) {
          const allMeals = [
            ...(Array.isArray(dp.breakfast) ? dp.breakfast : []),
            ...(Array.isArray(dp.lunch) ? dp.lunch : []),
            ...(Array.isArray(dp.dinner) ? dp.dinner : []),
            ...(Array.isArray(dp.snacks) ? dp.snacks : []),
            ...(Array.isArray(dp.drinks) ? dp.drinks : []),
            ...(Array.isArray(dp.desserts) ? dp.desserts : [])
          ];
          const match = allMeals.find(
            (m: any) =>
              m.id === rawId ||
              m.id === cleanId ||
              m.external_id === rawId ||
              (m.title && cleanId.length > 3 && m.title.toLowerCase().includes(cleanId.toLowerCase()))
          );
          if (match) {
            return NextResponse.json(
              finalizeWithAllergyAdaptation(
                {
                  ...match,
                  id: match.id || rawId,
                  title: match.title || match.name || 'Delicious Recipe',
                  image_url: match.image_url || match.image || '',
                  cuisine_type: match.cuisine || match.cuisine_region || 'International',
                  dietary_tags: match.dietary_tags || ['Halal'],
                  ingredients: parseIngredients(match.ingredients),
                  instructions: parseInstructions(match.instructions || match.instructions_steps),
                  prep_time_minutes: match.prep_time_minutes || match.preparation_time,
                  cook_time_minutes: match.cook_time_minutes,
                  total_calories: match.total_calories || match.calories || 350,
                  protein_g: Number(match.protein_g || match.protein || 20),
                  carbs_g: Number(match.carbs_g || match.carbs || 40),
                  fat_g: Number(match.fat_g || match.fat || 10),
                  servings: 2,
                  description: ''
                },
                userContext
              )
            );
          }
        }
      }
    } catch (planErr) {
      console.warn('[recipe-details] user_daily_meal_plans lookup error:', planErr);
    }

    // 3. Fallback: Live lookup from TheMealDBRecipeProvider (matches search card nutrition & Halal substitution)
    const isNumericId = !isNaN(Number(cleanId)) && cleanId.trim() !== '';
    if (isNumericId) {
      try {
        const mealDbMatch = await mealDbProvider.getRecipeById(cleanId);
        if (mealDbMatch) {
          const finalDetails = finalizeWithAllergyAdaptation(
            {
              id: mealDbMatch.external_id,
              title: mealDbMatch.title,
              image_url: mealDbMatch.image_url,
              cuisine_type: mealDbMatch.cuisine || 'International',
              dietary_tags: mealDbMatch.dietary_tags || ['Halal'],
              ingredients: parseIngredients(mealDbMatch.ingredients),
              instructions: parseInstructions(mealDbMatch.instructions),
              prep_time_minutes: mealDbMatch.prep_time_minutes,
              cook_time_minutes: mealDbMatch.cook_time_minutes,
              total_calories: mealDbMatch.nutrition?.calories || 380,
              protein_g: mealDbMatch.nutrition?.protein_g || 24,
              carbs_g: mealDbMatch.nutrition?.carbs_g || 40,
              fat_g: mealDbMatch.nutrition?.fat_g || 12,
              servings: mealDbMatch.servings || 2,
              description: ''
            },
            userContext
          );

          await supabase.from('cached_recipes').upsert(
            {
              id: String(cleanId),
              title: finalDetails.title,
              image_url: finalDetails.image_url,
              ingredients: finalDetails.ingredients,
              instructions_steps: finalDetails.instructions,
              nutrition: {
                calories: finalDetails.total_calories,
                protein: finalDetails.protein_g,
                carbs: finalDetails.carbs_g,
                fat: finalDetails.fat_g
              },
              cuisine_region: finalDetails.cuisine_type,
              preparation_time: finalDetails.prep_time_minutes,
              meal_type: 'Main',
              provider: 'themealdb'
            },
            { onConflict: 'id' }
          );

          return NextResponse.json(finalDetails);
        }
      } catch (upstreamErr) {
        console.warn('[recipe-details] TheMealDB fallback fetch failed:', upstreamErr);
      }
    }

    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  } catch (error: any) {
    console.error('recipe-details error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
