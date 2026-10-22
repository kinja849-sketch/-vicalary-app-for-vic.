import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { loadUserProfileContext, UserProfileContext } from '@/lib/services/ai/ContextAssembler';
import {
  CuratedRecipeProvider,
  doesRecipeRepresentSearchQuery
} from '@/lib/services/recipes/CuratedRecipeProvider';
import {
  TheMealDBRecipeProvider,
  buildUniversalHalalRecipesForQuery
} from '@/lib/services/recipes/TheMealDBRecipeProvider';
import { classifyHalal } from '@/lib/services/recipes/HalalClassifier';
import { adaptRecipeForUser } from '@/lib/services/recipes/AllergySafeRecipeAdapter';
import { RecipeInstructionNormalizer } from '@/lib/services/recipes/RecipeInstructionNormalizer';
import { AuthoritativeRecipe, Ingredient, Instruction } from '@/lib/services/recipes/RecipeProvider';
import { sanitizeFoodImageUrl } from '@/lib/services/FoodImageService';

const curatedProvider = new CuratedRecipeProvider();
const mealDbProvider = new TheMealDBRecipeProvider();

function toStructuredIngredients(raw: any): Ingredient[] {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = raw.split(/\r?\n+/).filter(Boolean);
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((ing: any) => {
      if (typeof ing === 'string') {
        return { item: ing.trim(), amount: '', unit: '', normalized_name: ing.trim().toLowerCase() };
      }
      const item = String(ing?.item || ing?.name || '').trim();
      return {
        item,
        amount: ing?.amount ?? '',
        unit: String(ing?.unit ?? ''),
        normalized_name: (ing?.normalized_name || item).toLowerCase()
      };
    })
    .filter((i: Ingredient) => i.item.length > 0);
}

function toStructuredInstructions(raw: any): Instruction[] {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = raw
        .split(/\r?\n+/)
        .map((s: string) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(arr)) return [];
  const steps: Instruction[] = [];
  for (const s of arr) {
    const text =
      typeof s === 'string'
        ? s.trim()
        : String(s?.instruction || s?.step || s?.text || '').trim();
    if (text.length > 3) {
      steps.push({ step: steps.length + 1, instruction: text });
    }
  }
  return steps;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { type, number = 12, query, userId: bodyUserId } = body;
    const limit = Math.min(Math.max(Number(number) || 12, 1), 36);
    const searchQuery = String(query || '').trim();

    const supabase = createAdminSupabaseClient();

    // Load user context so search strictly enforces onboarding allergies & provides safe alternatives
    let resolvedUserId = bodyUserId;
    if (!resolvedUserId) {
      const authUser = await getAuthenticatedUser(req);
      if (authUser?.id) resolvedUserId = authUser.id;
    }

    let userContext: UserProfileContext | null = null;
    if (resolvedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId)) {
      userContext = await loadUserProfileContext(supabase, resolvedUserId);
    }

    const allergies = userContext?.allergies || [];
    const dislikes = userContext?.dislikedFoods || [];

    const combinedResults: any[] = [];
    const recipesToPersist: AuthoritativeRecipe[] = [];
    const seenTitles = new Set<string>();
    const usedSearchImages = new Set<string>();

    const pushAdaptedCandidate = (rawCandidate: AuthoritativeRecipe) => {
      const adapted = adaptRecipeForUser(rawCandidate, userContext);
      const r = adapted.recipe;
      const normTitle = (r.title || '').toLowerCase().trim();
      if (!normTitle || seenTitles.has(normTitle)) return;
      seenTitles.add(normTitle);

      const cals = r.nutrition?.calories || r.total_calories || 350;
      const prot = r.nutrition?.protein_g || r.protein_g || 20;
      const carbs = r.nutrition?.carbs_g || r.carbs_g || 40;
      const fat = r.nutrition?.fat_g || r.fat_g || 10;
      const prepTime = r.prep_time_minutes || 15;
      const cookTime = r.cook_time_minutes || 15;
      const safeImage = sanitizeFoodImageUrl(
        r.image_url,
        r.title,
        r.cuisine || 'International',
        r.meal_category || 'lunch',
        usedSearchImages
      );
      const canonicalId = r.external_id || r.id || normTitle.replace(/[^a-z0-9]+/g, '_');

      const normDetails = RecipeInstructionNormalizer.normalizeRecipeDetails({
        id: canonicalId,
        title: r.title,
        image_url: safeImage,
        cuisine_type: r.cuisine || 'International',
        dietary_tags: r.dietary_tags || ['Halal'],
        ingredients: r.ingredients,
        instructions: r.instructions,
        prep_time_minutes: prepTime,
        cook_time_minutes: cookTime,
        total_calories: cals,
        protein_g: prot,
        carbs_g: carbs,
        fat_g: fat,
        description: adapted.historyNarrative
      });

      const finalInstructions: Instruction[] = normDetails.instructions.map((text, idx) => ({
        step: idx + 1,
        instruction: text
      }));

      recipesToPersist.push({
        ...r,
        id: canonicalId,
        external_id: canonicalId,
        image_url: safeImage,
        instructions: finalInstructions,
        prep_time_minutes: normDetails.prep_time_minutes,
        cook_time_minutes: normDetails.cook_time_minutes
      });

      combinedResults.push({
        id: canonicalId,
        external_id: canonicalId,
        title: r.title,
        name: r.title,
        image: safeImage,
        image_url: safeImage,
        readyInMinutes: normDetails.total_time_minutes,
        prep_time_minutes: normDetails.prep_time_minutes,
        cook_time_minutes: normDetails.cook_time_minutes,
        calories: cals,
        total_calories: cals,
        protein: prot,
        protein_g: prot,
        carbs: carbs,
        carbs_g: carbs,
        fat: fat,
        fat_g: fat,
        ingredients: r.ingredients,
        instructions: finalInstructions,
        dietary_tags: r.dietary_tags || ['Halal'],
        cuisine: r.cuisine || 'International',
        cuisine_type: r.cuisine || 'International',
        description: adapted.historyNarrative,
        clinical_justification: adapted.historyNarrative,
        subtitle: `${cals} kcal`
      });
    };

    const validCategory =
      type && ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'dessert'].includes(type)
        ? type
        : undefined;

    // 1. Search Curated Halal Catalog:
    //    1a) Naturally allergy-free matches first
    const safeCuratedMatches = await curatedProvider.searchRecipes({
      query: searchQuery || undefined,
      meal_category: validCategory,
      allergies,
      disliked_foods: dislikes,
      limit
    });
    for (const c of safeCuratedMatches) {
      pushAdaptedCandidate(c);
    }

    //    1b) If user has allergies and more matches are needed for their query, adapt remaining curated matches into safe alternatives
    if (searchQuery && combinedResults.length < limit && (allergies.length > 0 || dislikes.length > 0)) {
      const allCuratedMatches = await curatedProvider.searchRecipes({
        query: searchQuery,
        meal_category: validCategory,
        limit
      });
      for (const c of allCuratedMatches) {
        if (combinedResults.length >= limit) break;
        pushAdaptedCandidate(c);
      }
    }

    // 2. Search Supabase `recipes` and `cached_recipes` using strict dish-identity matching
    if (searchQuery.length > 0 && combinedResults.length < limit) {
      try {
        const [{ data: dbRecipes }, { data: cachedRecipes }] = await Promise.all([
          supabase
            .from('recipes')
            .select('*')
            .neq('provider', 'spoonacular')
            .gt('total_calories', 0)
            .limit(180),
          supabase
            .from('cached_recipes')
            .select('*')
            .neq('provider', 'spoonacular')
            .limit(120)
        ]);

        if (Array.isArray(dbRecipes)) {
          for (const r of dbRecipes) {
            if (combinedResults.length >= limit) break;
            if (r.provider === 'spoonacular' || String(r.external_id || '').startsWith('spoonacular_')) continue;

            const ingArr = toStructuredIngredients(r.ingredients);
            const instArr = toStructuredInstructions(r.instructions);
            if (ingArr.length < 2 || instArr.length < 2) continue;

            const ingText = ingArr.map(i => i.item).join(' ');
            const matchesQuery = doesRecipeRepresentSearchQuery(String(r.title || ''), ingText, searchQuery).matches;
            if (!matchesQuery) continue;

            const halalCheck = classifyHalal({
              title: r.title,
              ingredients: ingArr,
              instructions: instArr,
              cuisine: r.cuisine_type,
              provider: r.provider,
              dietary_tags: r.dietary_tags
            });
            if (halalCheck.status !== 'HALAL_VERIFIED') continue;

            pushAdaptedCandidate({
              id: r.id || r.external_id,
              external_id: r.external_id || String(r.id),
              provider: r.provider || 'curated',
              title: r.title,
              image_url: r.image_url,
              meal_category: 'lunch',
              cuisine: r.cuisine_type || 'International',
              prep_time_minutes: Number(r.prep_time_minutes || 15),
              cook_time_minutes: Number(r.cook_time_minutes || 15),
              servings: 1,
              ingredients: ingArr,
              instructions: instArr,
              nutrition: {
                calories: Number(r.total_calories || 340),
                protein_g: Number(r.protein_g || 20),
                carbs_g: Number(r.carbs_g || 40),
                fat_g: Number(r.fat_g || 10)
              },
              dietary_tags: Array.isArray(r.dietary_tags) ? r.dietary_tags : ['Halal']
            });
          }
        }

        if (Array.isArray(cachedRecipes) && combinedResults.length < limit) {
          for (const c of cachedRecipes) {
            if (combinedResults.length >= limit) break;
            if (c.provider === 'spoonacular') continue;

            const ingArr = toStructuredIngredients(c.ingredients);
            const instArr = toStructuredInstructions(c.instructions_steps || c.instructions);
            if (ingArr.length < 2 || instArr.length < 2) continue;

            const ingText = ingArr.map(i => i.item).join(' ');
            const matchesQuery = doesRecipeRepresentSearchQuery(String(c.title || ''), ingText, searchQuery).matches;
            if (!matchesQuery) continue;

            const halalCheck = classifyHalal({
              title: c.title,
              ingredients: ingArr,
              instructions: instArr,
              cuisine: c.cuisine_region || c.cuisine_type,
              provider: c.provider || 'themealdb',
              dietary_tags: c.dietary_tags
            });
            if (halalCheck.status !== 'HALAL_VERIFIED') continue;

            pushAdaptedCandidate({
              id: String(c.id),
              external_id: `themealdb_${c.id}`,
              provider: 'themealdb',
              title: c.title,
              image_url: c.image_url,
              meal_category: 'lunch',
              cuisine: c.cuisine_region || c.cuisine_type || 'International',
              prep_time_minutes: Number(c.preparation_time || 15),
              cook_time_minutes: 20,
              servings: 2,
              ingredients: ingArr,
              instructions: instArr,
              nutrition: {
                calories: Number(c.nutrition?.calories || c.total_calories || 360),
                protein_g: Number(c.nutrition?.protein || c.protein_g || 22),
                carbs_g: Number(c.nutrition?.carbs || c.carbs_g || 40),
                fat_g: Number(c.nutrition?.fat || c.fat_g || 11)
              },
              dietary_tags: ['Halal']
            });
          }
        }
      } catch (dbErr) {
        console.warn('[search-recipes] DB search warning:', dbErr);
      }
    }

    // 3. Search Live TheMealDB (name, category, area, and ingredient) and adapt any allergen-containing dish into a safe alternative
    if (searchQuery.length > 0 && combinedResults.length < limit) {
      try {
        const mealDbMatches = await mealDbProvider.searchRecipes({
          query: searchQuery,
          limit: limit - combinedResults.length
        });

        for (const m of mealDbMatches) {
          if (combinedResults.length >= limit) break;
          pushAdaptedCandidate(m);
        }
      } catch (mealDbErr) {
        console.warn('[search-recipes] TheMealDB search warning:', mealDbErr);
      }
    }

    // 4. Universal Halal Search Enrichment: if a user searches for any specific meal and fewer than 4 exact matches
    //    exist across the catalogs, deterministically synthesize and adapt Halal variations of that exact meal
    //    so every searched meal is richly and accurately represented with unique images.
    if (searchQuery.length >= 2 && combinedResults.length < 4) {
      const universalRecipes = buildUniversalHalalRecipesForQuery(searchQuery, usedSearchImages);
      for (const u of universalRecipes) {
        if (combinedResults.length >= limit) break;
        pushAdaptedCandidate(u);
      }
    }

    // 5. Persist search results to Supabase `recipes` so clicking any card opens `/recipe/[id]` with 100% matching details
    if (recipesToPersist.length > 0) {
      const upsertRows = recipesToPersist.map(r => ({
        external_id: r.external_id || String(r.id),
        title: r.title,
        image_url: r.image_url,
        ingredients: r.ingredients || [],
        instructions: r.instructions || [],
        prep_time_minutes: r.prep_time_minutes || 15,
        cook_time_minutes: r.cook_time_minutes || 15,
        total_calories: r.nutrition?.calories || r.total_calories || 350,
        protein_g: r.nutrition?.protein_g || r.protein_g || 20,
        carbs_g: r.nutrition?.carbs_g || r.carbs_g || 40,
        fat_g: r.nutrition?.fat_g || r.fat_g || 10,
        dietary_tags: r.dietary_tags || ['Halal'],
        cuisine_type: r.cuisine || 'International',
        provider: r.provider || 'curated'
      }));

      try {
        await supabase.from('recipes').upsert(upsertRows, { onConflict: 'external_id' });
      } catch (persistErr) {
        console.warn('[search-recipes] Upsert notice:', persistErr);
      }
    }

    const finalResults = combinedResults.slice(0, limit);
    return NextResponse.json({
      results: finalResults,
      recipes: finalResults,
      totalResults: finalResults.length
    });
  } catch (error: any) {
    console.error('search-recipes error:', error?.message);
    return NextResponse.json({ error: 'Failed to search recipes', results: [], totalResults: 0 }, { status: 500 });
  }
}
