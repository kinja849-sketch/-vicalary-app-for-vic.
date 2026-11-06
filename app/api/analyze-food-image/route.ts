import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NutritionNormalizer, IdentifiedFoodItem } from '@/lib/nutrition/NutritionNormalizer';
import { SafetyEngine } from '@/lib/services/SafetyEngine';
import { callChatCompletionWithFallback, getPrimaryApiKey, getBackupApiKey } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage } from '@/lib/api/serverLanguage';
import { FoodAnalysisOrchestrator } from '@/lib/orchestration/FoodAnalysisOrchestrator';

function parseJSONSafely(text?: string | null, fallback: any = {}) {
  try {
    if (!text) return fallback;
    const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonStart = stripped.indexOf('{');
    const jsonEnd = stripped.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      return JSON.parse(stripped.substring(jsonStart, jsonEnd + 1));
    }
    return JSON.parse(stripped);
  } catch (e) {
    return fallback;
  }
}

const GENERIC_PLACEHOLDER_NAMES = new Set([
  'meal analysis',
  'meal',
  'analyzed meal',
  'confirmed meal',
  'food',
  'dish',
  'plate',
  'unknown',
  'unknown food'
]);

const KNOWN_COMPONENT_EXTRACTION_RULES: Array<{
  keywords: RegExp;
  canonicalName: string;
  matchTokens: string[];
  variant_or_method: string;
  estimated_portion_g: number;
  portion_description: string;
}> = [
  {
    keywords: /\b(potato|potatoes|kentang)\b/i,
    canonicalName: 'Potatoes',
    matchTokens: ['potato', 'potatoes', 'kentang', 'fries'],
    variant_or_method: 'stewed',
    estimated_portion_g: 150,
    portion_description: 'stewed potato chunks (~150g)'
  },
  {
    keywords: /\b(tomato|tomatoes|tomat)\b/i,
    canonicalName: 'Tomatoes',
    matchTokens: ['tomato', 'tomatoes', 'tomat'],
    variant_or_method: 'stewed',
    estimated_portion_g: 80,
    portion_description: 'simmered tomato pieces (~80g)'
  },
  {
    keywords: /\b(onion|onions|bawang\s*bombay)\b/i,
    canonicalName: 'Onions',
    matchTokens: ['onion', 'onions', 'bawang'],
    variant_or_method: 'sautéed',
    estimated_portion_g: 45,
    portion_description: 'cooked sliced onions (~45g)'
  },
  {
    keywords: /\b(white\s*rice|steamed\s*rice|rice|nasi\s*putih|nasi)\b/i,
    canonicalName: 'White Rice',
    matchTokens: ['rice', 'nasi'],
    variant_or_method: 'steamed',
    estimated_portion_g: 158,
    portion_description: '1 cup steamed white rice (~158g)'
  },
  {
    keywords: /\b(chicken|ayam)\b/i,
    canonicalName: 'Chicken Breast',
    matchTokens: ['chicken', 'ayam'],
    variant_or_method: 'cooked',
    estimated_portion_g: 140,
    portion_description: 'cooked chicken portion (~140g)'
  },
  {
    keywords: /\b(egg|eggs|telur)\b/i,
    canonicalName: 'Eggs',
    matchTokens: ['egg', 'eggs', 'telur'],
    variant_or_method: 'boiled',
    estimated_portion_g: 50,
    portion_description: '1 cooked egg (~50g)'
  },
  {
    keywords: /\b(cucumber|cucumbers|timun|mentimun)\b/i,
    canonicalName: 'Cucumber',
    matchTokens: ['cucumber', 'cucumbers', 'timun', 'mentimun'],
    variant_or_method: 'raw',
    estimated_portion_g: 60,
    portion_description: 'fresh cucumber slices (~60g)'
  },
  {
    keywords: /\b(carrot|carrots|wortel)\b/i,
    canonicalName: 'Carrots',
    matchTokens: ['carrot', 'carrots', 'wortel'],
    variant_or_method: 'cooked',
    estimated_portion_g: 60,
    portion_description: 'cooked carrot pieces (~60g)'
  },
  {
    keywords: /\b(broccoli|brokoli)\b/i,
    canonicalName: 'Broccoli',
    matchTokens: ['broccoli', 'brokoli'],
    variant_or_method: 'steamed',
    estimated_portion_g: 85,
    portion_description: 'steamed broccoli florets (~85g)'
  }
];

function resolveMealPlateAndDisplayItems(
  mealTitle: string,
  rawMealDescription: string,
  rawFoods: any[],
  mealCompositionType?: string
): {
  isCookedDishMode: boolean;
  plateFoodsForCalculation: IdentifiedFoodItem[];
  displayItemsForCarousel: IdentifiedFoodItem[];
} {
  const validFoods: IdentifiedFoodItem[] = (Array.isArray(rawFoods) ? rawFoods : [])
    .filter(f => f && typeof f.name === 'string' && f.name.trim().length > 0)
    .filter(f => !GENERIC_PLACEHOLDER_NAMES.has(f.name.toLowerCase().trim()));

  const combinedNarrative = `${mealTitle || ''} ${rawMealDescription || ''} ${validFoods.map(f => `${f.name} ${f.portion_description || ''}`).join(' ')}`;
  const lower = combinedNarrative.toLowerCase();

  const isBakedOrGriddled =
    /\b(cake|chiffon|sponge\s*cake|bolu|kue\s*chiffon|kue\s*bolu|brownie|brownies|muffin|muffins|cupcake|cupcakes|pancake|pancakes|waffle|waffles|crepe|crepes|donut|doughnut|cookie|cookies|croissant|pastry)\b/i.test(
      lower
    );

  // 1. Baked Goods, Cakes, Chiffon Cakes, Pancakes, Waffles, Pastries:
  // Calculate total calories strictly from the visible baked/cooked item on the plate,
  // and list the culinary items used to prepare it with is_cooked_ingredient: true (no individual raw ingredient calorie distortion).
  if (isBakedOrGriddled) {
    const isChocolate = /\b(chocolate|cokelat|coklat|cocoa|kakao|brownie|brownies)\b/i.test(lower);
    const isPancakeOrWaffle = /\b(pancake|pancakes|waffle|waffles|crepe|crepes)\b/i.test(lower);
    const isWholeCake =
      /\b(whole|ring|round|bundt|entire|full|loyang|cincin|utuh)\b/i.test(lower) ||
      validFoods.some(f => (f.estimated_portion_g || 0) >= 400);

    // Determine the visible cooked dish on the plate for authentic plate-level calorie calculation
    let plateDishName = isChocolate ? 'Chocolate Chiffon Cake' : 'Chiffon Cake';
    let platePortionG = isWholeCake ? 750 : 110;
    if (isPancakeOrWaffle) {
      plateDishName = /\bwaffle/i.test(lower) ? 'Waffles' : 'Pancakes';
      platePortionG = 220;
    }

    // If the vision model directly observed the cake/pancake weight on the plate, preserve that observed plate weight
    const observedPlateItem = validFoods.find(f =>
      /\b(cake|chiffon|bolu|brownie|muffin|cupcake|pancake|pancakes|waffle|waffles|crepe|crepes|donut|doughnut|pastry)\b/i.test(f.name)
    );
    if (observedPlateItem && observedPlateItem.estimated_portion_g && observedPlateItem.estimated_portion_g >= 50) {
      platePortionG = observedPlateItem.estimated_portion_g;
    }

    const plateFoodsForCalculation: IdentifiedFoodItem[] = [
      {
        name: plateDishName,
        variant_or_method: isPancakeOrWaffle ? 'cooked' : 'baked',
        preparation_state: isPancakeOrWaffle ? 'cooked' : 'baked',
        estimated_portion_g: platePortionG,
        portion_description: isWholeCake ? `whole baked cake (~${platePortionG}g)` : `serving on plate (~${platePortionG}g)`,
        confidence: 0.94
      }
    ];

    const cookedIngredientsList: IdentifiedFoodItem[] = [
      {
        name: 'Wheat Flour',
        variant_or_method: 'baked',
        preparation_state: 'baked',
        estimated_portion_g: 100,
        portion_description: 'Used in dish',
        is_cooked_ingredient: true,
        confidence: 0.95
      },
      {
        name: 'Eggs',
        variant_or_method: 'cooked',
        preparation_state: 'cooked',
        estimated_portion_g: 100,
        portion_description: 'Used in dish',
        is_cooked_ingredient: true,
        confidence: 0.95
      },
      {
        name: 'Sugar',
        variant_or_method: 'baked',
        preparation_state: 'baked',
        estimated_portion_g: 50,
        portion_description: 'Used in dish',
        is_cooked_ingredient: true,
        confidence: 0.94
      },
      {
        name: isPancakeOrWaffle ? 'Butter' : 'Vegetable Oil',
        variant_or_method: 'cooked',
        preparation_state: 'cooked',
        estimated_portion_g: 30,
        portion_description: 'Used in dish',
        is_cooked_ingredient: true,
        confidence: 0.92
      }
    ];

    if (isChocolate) {
      cookedIngredientsList.push({
        name: 'Cocoa Powder',
        variant_or_method: 'baked',
        preparation_state: 'baked',
        estimated_portion_g: 25,
        portion_description: 'Used in dish',
        is_cooked_ingredient: true,
        confidence: 0.94
      });
    }

    cookedIngredientsList.push({
      name: 'Whole Milk',
      variant_or_method: 'raw',
      preparation_state: 'raw',
      estimated_portion_g: 100,
      portion_description: 'Used in dish',
      is_cooked_ingredient: true,
      confidence: 0.92
    });

    return {
      isCookedDishMode: true,
      plateFoodsForCalculation,
      displayItemsForCarousel: cookedIngredientsList
    };
  }

  // 2. Expand any combined food item names and extract visible components mentioned in the dish (deduplicated)
  const decomposed: IdentifiedFoodItem[] = [];
  for (const item of validFoods) {
    const lowerItemName = item.name.toLowerCase().trim();
    const matchedRulesForItem = KNOWN_COMPONENT_EXTRACTION_RULES.filter(r => r.keywords.test(lowerItemName));
    if (matchedRulesForItem.length >= 2) {
      for (const rule of matchedRulesForItem) {
        if (!decomposed.some(d => rule.matchTokens.some(t => d.name.toLowerCase().includes(t)))) {
          decomposed.push({
            name: rule.canonicalName,
            count: '1x',
            variant_or_method: item.variant_or_method || rule.variant_or_method,
            estimated_portion_g: rule.estimated_portion_g,
            portion_description: rule.portion_description,
            confidence: item.confidence ?? 0.92
          });
        }
      }
    } else {
      const singleRule = matchedRulesForItem[0];
      const isDuplicate = decomposed.some(d => {
        const dLower = d.name.toLowerCase().trim();
        if (dLower === lowerItemName) return true;
        if (singleRule && singleRule.matchTokens.some(t => dLower.includes(t))) return true;
        return false;
      });
      if (!isDuplicate) {
        decomposed.push(item);
      }
    }
  }

  for (const rule of KNOWN_COMPONENT_EXTRACTION_RULES) {
    if (rule.keywords.test(combinedNarrative)) {
      const alreadyPresent = decomposed.some(d =>
        rule.matchTokens.some(t => d.name.toLowerCase().includes(t))
      );
      if (!alreadyPresent) {
        decomposed.push({
          name: rule.canonicalName,
          count: '1x',
          variant_or_method: rule.variant_or_method,
          estimated_portion_g: rule.estimated_portion_g,
          portion_description: rule.portion_description,
          confidence: 0.9
        });
      }
    }
  }

  // Determine whether this is a blended cooked dish (stew, curry, soup, stir-fry, casserole)
  // vs. clearly separable & countable items on the plate (e.g. Eggs and Salad, Boiled Eggs and Tomatoes, Grilled Chicken and Broccoli)
  const isBlendedCookedMeal =
    mealCompositionType === 'cooked_dish' ||
    /\b(stew|stewed|curry|curried|soup|broth|soto|gulai|rendang|semur|stir[\s-]*fry|tumis|casserole|nasi\s*goreng|mie\s*goreng|simmered)\b/i.test(
      lower
    );

  const isClearlySeparablePlate =
    mealCompositionType === 'separable_items' ||
    (!isBlendedCookedMeal &&
      decomposed.some(f => /\b(egg|eggs|telur|salad|lettuce|cucumber|raw\s*tomato|tomatoes|avocado|broccoli|chicken\s*breast|steak|apple|banana|orange)\b/i.test(f.name)));

  if (isBlendedCookedMeal && !isClearlySeparablePlate) {
    const displayCookedItems = decomposed.map(item => ({
      ...item,
      portion_description: 'Used in dish',
      is_cooked_ingredient: true
    }));
    return {
      isCookedDishMode: true,
      plateFoodsForCalculation: decomposed,
      displayItemsForCarousel: displayCookedItems
    };
  }

  // 3. Clearly Separable & Countable Items on a Plate (e.g., Eggs + Salad/Lettuce, Boiled Eggs + Tomatoes):
  // Calculate and display individual calories for each visible item on the plate.
  return {
    isCookedDishMode: false,
    plateFoodsForCalculation: decomposed,
    displayItemsForCarousel: decomposed.map(item => ({
      ...item,
      is_cooked_ingredient: false
    }))
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, userId, locationContext, isProductScan, confirmedItems, mealTitleOverride } = body;

    if (!imageUrl && !imageBase64 && (!Array.isArray(confirmedItems) || confirmedItems.length === 0)) {
      return NextResponse.json({ error: 'Image URL, base64 data, or confirmedItems is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Fast deterministic recalculation path when user confirms or adjusts item weights/counts in UI
    if (Array.isArray(confirmedItems) && confirmedItems.length > 0 && !imageUrl && !imageBase64) {
      const orchestrated = await FoodAnalysisOrchestrator.executeFoodItemsWorkflow({
        dishName: mealTitleOverride || confirmedItems[0]?.name || 'Confirmed Meal',
        items: confirmedItems,
        supabase,
        primaryConfidence: 1.0
      });
      return NextResponse.json({
        name: orchestrated.dish_name,
        workflow: orchestrated.workflow,
        type: 'FOOD',
        calories: orchestrated.calculation.total_calories,
        calories_exact: orchestrated.calculation.total_calories_exact,
        calorie_range: orchestrated.calculation.calorie_range,
        protein: orchestrated.calculation.total_protein,
        carbs: orchestrated.calculation.total_carbs,
        fat: orchestrated.calculation.total_fat,
        fiber: orchestrated.calculation.total_fiber,
        sugar: orchestrated.calculation.total_sugar,
        sodium_mg: orchestrated.calculation.total_sodium_mg,
        vitamins: orchestrated.calculation.prominent_vitamins,
        minerals: orchestrated.calculation.prominent_minerals,
        items: orchestrated.calculation.normalized_items,
        is_decomposed_mixed_meal: orchestrated.is_decomposed_mixed_meal,
        provenance: orchestrated.provenance,
        confirmation: orchestrated.confirmation,
        verification_status: orchestrated.provenance.verification_status,
        requires_confirmation: orchestrated.confirmation.requires_confirmation,
        is_verified: true
      });
    }
    const hasAIKey = !!(getPrimaryApiKey() || getBackupApiKey());

    if (!hasAIKey) {
      return NextResponse.json({ error: 'AI provider API key not configured (neither primary nor backup)' }, { status: 500 });
    }

    // ─── 1. FETCH USER PROFILE, ONBOARDING, AND TODAY'S CANONICAL MEAL PLAN ───
    let userGoal = 'maintain a healthy lifestyle';
    let dailyCalorieGoal = 2000;
    let dietaryRestrictions: string[] = [];
    let allergies: string[] = [];
    let healthConditions = 'None reported';
    let userLanguage = body.language || locationContext?.language || (locationContext?.languages?.[0]) || 'en';
    let todaySuggestedMeals: Array<{ name: string; calories: number; image?: string; session?: string }> = [];

    if (userId) {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const [
        { data: onboarding },
        { data: userSettings },
        { data: profile },
        { data: dailyPlan }
      ] = await Promise.all([
        supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_settings').select('language, is_language_auto').eq('user_id', userId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_daily_meal_plans')
          .select('breakfast, lunch, dinner, snacks')
          .eq('user_id', userId)
          .eq('plan_date', todayDateStr)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (onboarding) {
        userGoal = onboarding.goal || userGoal;
        dailyCalorieGoal = onboarding.daily_calorie_goal || dailyCalorieGoal;
        dietaryRestrictions = onboarding.dietary_lifestyle || [];
        healthConditions = onboarding.health_conditions || onboarding.medical_conditions || healthConditions;
      }

      if (profile && (profile as any).allergies) {
        allergies = Array.isArray((profile as any).allergies) ? (profile as any).allergies : [(profile as any).allergies];
      } else if (onboarding && (onboarding as any).allergies) {
        allergies = Array.isArray((onboarding as any).allergies) ? (onboarding as any).allergies : [(onboarding as any).allergies];
      }

      userLanguage = await resolveUserLanguage({
        userId,
        requestLanguage: body.language,
        locationContext,
        supabase
      });

      if (dailyPlan) {
        const sessions = ['breakfast', 'lunch', 'dinner', 'snacks'];
        for (const s of sessions) {
          const mealList = (dailyPlan as any)[s];
          if (Array.isArray(mealList)) {
            for (const m of mealList) {
              if (m && m.name) {
                todaySuggestedMeals.push({
                  name: m.name,
                  calories: m.calories || m.total_calories || 400,
                  image: m.image_url || m.image || '',
                  session: s
                });
              }
            }
          }
        }
      }
    }

    // ─── 2. STEP 1: VISION IDENTIFICATION OF INDIVIDUAL FOODS & PORTIONS ───
    const visionSystemPrompt = `You are a professional clinical dietitian and food vision analyst.
Analyze the visible meal in this photo with high clinical accuracy and culinary precision.

1. DISTINGUISH COOKED/BLENDED DISHES vs. CLEARLY SEPARABLE ITEMS ON A PLATE:
   - Set "meal_composition_type" to either "cooked_dish" or "separable_items".
   - CASE A — "cooked_dish" (Cooked, Baked, Griddled, Stewed, Curried, or Blended Meals):
     * Examples: Cakes, chiffon cakes, pancakes, waffles, muffins, pastries, stews (e.g., potato and tomato stew with rice), curries, soups, casseroles, stir-fries.
     * AUTHENTIC PLATE CALORIE RULE: The calorie calculation MUST come strictly from what is visibly on the plate or table as a finished cooked dish (e.g., 1 whole baked chocolate chiffon ring cake ~450g, or 4 cooked pancakes ~160g, or cooked potato-tomato stew ~250g + steamed white rice ~158g), NOT by guessing raw ingredient measurements (like cups of raw flour or tablespoons of oil).
     * ITEMS USED TO COOK: Also list the core items/ingredients used to cook or bake that dish in foods[] with "is_cooked_ingredient": true (for example, for a chocolate chiffon cake: "Wheat Flour", "Eggs", "Sugar", "Vegetable Oil", "Cocoa Powder", "Whole Milk"; for a potato-tomato stew with rice: "Potatoes", "Tomatoes", "Onions", "White Rice") so the user can clearly see what items were used to prepare the meal without distorting the plate's calorie total.
   - CASE B — "separable_items" (Clearly Separable & Countable Whole Items on a Plate):
     * Examples: Eggs and salad/lettuce, boiled/fried eggs and raw tomatoes, grilled chicken breast with broccoli and steamed rice, steak and asparagus.
     * Because each component on the plate is clearly distinct, visible, and countable/measurable on its own:
       - List each visible food item in foods[] with "is_cooked_ingredient": false.
       - Whenever countable items are visible (e.g., 2 eggs, 4 eggs, 2 whole tomatoes), ALWAYS set "count" to the exact multiplier (e.g., "2x", "4x") and "estimated_portion_g" to the total weight (e.g., 2 eggs × 50g = 100g; 4 eggs × 50g = 200g; 1 cup fresh lettuce/salad = ~85g).

2. METHOD & VARIANT RECOGNITION:
   - For every item, specify the observable culinary preparation method or variant in "variant_or_method":
     * Grains/Starches/Baking: 'white_rice', 'brown_rice', 'fried_rice', 'baked', 'steamed'.
     * Vegetables/Produce: 'stewed', 'boiled', 'sautéed', 'roasted', 'steamed', 'raw', 'sliced'.
     * Potatoes/Tubers: 'stewed', 'boiled', 'roasted', 'mashed', 'french_fries', 'baked'.
     * Proteins: 'grilled', 'fried', 'roasted', 'boiled', 'poached', 'pan_seared', 'steamed', 'raw'.

3. ACCURATE PORTION GROUNDING ON THE PLATE:
   - Ground portion estimates in realistic plate/table geometry:
     * 1 whole baked chiffon/sponge ring cake: ~450g. 1 slice cake: ~85g.
     * 4 cooked pancakes: ~152g.
     * 1 medium/large egg: ~50g (~72 kcal). If 2 eggs are visible, count is "2x" and portion is 100g (~143 kcal). If 4 eggs are visible, count is "4x" and portion is 200g (~286 kcal).
     * 1 bowl/portion fresh lettuce or green salad: ~85g (~13 kcal).
     * 1 whole medium raw tomato: ~120g (~22 kcal).
     * Cooked potato & tomato stew on plate: ~250g (~195 kcal).
     * 1 cup cooked white rice: ~158g (~205 kcal).
     * Palm grilled chicken breast: ~140-150g (~231-248 kcal).

Return ONLY a valid JSON object matching this schema:
{
  "meal_title": "Descriptive, accurate culinary name for this meal",
  "meal_composition_type": "cooked_dish | separable_items",
  "visual_uncertainties": "Specific notes on what cannot be verified visually",
  "meal_description": "An informative paragraph describing the observed dish on the plate, its preparation, and the items present.",
  "foods": [
    {
      "name": "Food or culinary item name (e.g. Eggs, Lettuce, Tomatoes, Potatoes, Onions, White Rice, Wheat Flour, Sugar, Cocoa Powder, Vegetable Oil, Whole Milk)",
      "count": "2x or 4x or 1 cup (for separable items) or Used in dish (for cooked dish ingredients)",
      "variant_or_method": "baked | stewed | boiled | steamed | raw | cooked",
      "estimated_portion_g": 100,
      "portion_description": "2 large eggs (~100g) or Used in dish",
      "is_cooked_ingredient": false,
      "confidence": 0.95
    }
  ]
}`;

    const resolvedImageUri = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl;

    const visionResult = await callChatCompletionWithFallback({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionSystemPrompt },
          {
            type: 'image_url',
            image_url: {
              url: resolvedImageUri,
              detail: 'high'
            }
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    });

    let visionParsed = parseJSONSafely(visionResult.choices[0]?.message?.content);

    // If primary/backup parse yielded empty foods array, run a fast focused retry
    if (!visionParsed || !Array.isArray(visionParsed.foods) || visionParsed.foods.length === 0) {
      const retryVisionResult = await callChatCompletionWithFallback({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${visionSystemPrompt}\n\nIMPORTANT: Keep JSON compact and valid. Ensure every visible food item on the plate (e.g. Potatoes, Tomatoes, Onions, White Rice) is listed as its own entry in foods[].`
            },
            {
              type: 'image_url',
              image_url: {
                url: resolvedImageUri,
                detail: 'low'
              }
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2500,
        response_format: { type: 'json_object' }
      });
      const retryParsed = parseJSONSafely(retryVisionResult.choices[0]?.message?.content);
      if (retryParsed && (Array.isArray(retryParsed.foods) || retryParsed.meal_title)) {
        visionParsed = retryParsed;
      }
    }

    const rawMealDescription = visionParsed.meal_description || '';
    const visualUncertainties = visionParsed.visual_uncertainties || 'Portion sizes and preparation fats estimated from visual appearance.';
    const {
      isCookedDishMode,
      plateFoodsForCalculation,
      displayItemsForCarousel
    } = resolveMealPlateAndDisplayItems(
      visionParsed.meal_title || '',
      rawMealDescription,
      visionParsed.foods || [],
      visionParsed.meal_composition_type
    );

    const mealTitle =
      visionParsed.meal_title && !GENERIC_PLACEHOLDER_NAMES.has(String(visionParsed.meal_title).toLowerCase().trim())
        ? visionParsed.meal_title
        : displayItemsForCarousel.length > 0
          ? displayItemsForCarousel.map(f => f.name).join(', ')
          : 'Analyzed Meal';

    const identifiedFoods: IdentifiedFoodItem[] = plateFoodsForCalculation.length > 0
      ? plateFoodsForCalculation
      : [{ name: 'Steamed White Rice', estimated_portion_g: 158, portion_description: '1 standard serving (~158g)' }];

    const avgVisionConfidence =
      identifiedFoods.reduce((acc, f) => acc + (typeof f.confidence === 'number' ? f.confidence : 0.85), 0) /
      Math.max(1, identifiedFoods.length);

    // ─── 3. STEP 2: CENTRALIZED ORCHESTRATION & DETERMINISTIC NUTRITION NORMALIZATION ───
    const orchestratedResult = await FoodAnalysisOrchestrator.executeFoodItemsWorkflow({
      dishName: mealTitle,
      items: identifiedFoods,
      supabase,
      imageUrl: resolvedImageUri,
      primaryConfidence: avgVisionConfidence
    });
    const nutritionCalculation = orchestratedResult.calculation;

    // If the meal is a cooked/baked dish where carousel tiles represent the items used to cook the meal,
    // normalize the display items for their authentic isolated images while keeping the plate-level total calories!
    let finalCarouselItems = nutritionCalculation.normalized_items;
    if (isCookedDishMode && displayItemsForCarousel.length > 0) {
      const displayNormalized = await NutritionNormalizer.calculateMealNutrition(displayItemsForCarousel, supabase);
      finalCarouselItems = displayNormalized.normalized_items.map(item => ({
        ...item,
        is_cooked_ingredient: true,
        portion_description: 'Used in dish'
      }));
    }

    // ─── 4. STEP 3: USER PLAN ALIGNMENT & DEEP PARAGRAPH SYNTHESIS ───
    const canonicalMealsContext = todaySuggestedMeals.length > 0
      ? `TODAY'S SUGGESTED MEALS IN USER'S PLAN (Canonical Source):
${todaySuggestedMeals.slice(0, 8).map(m => `- ${m.name} (~${m.calories} kcal, ${m.session})`).join('\n')}`
      : `NO PRE-EXISTING MEAL PLAN FOUND FOR TODAY.`;

    const languageNames: Record<string, string> = {
      en: 'English',
      id: 'Indonesian (Bahasa Indonesia)',
      ar: 'Arabic (العربية)',
      ur: 'Urdu (اردو)',
      bn: 'Bengali (বাংলা)',
      hi: 'Hindi (हिन्दी)',
      zh: 'Mandarin Chinese (中文)',
      es: 'Spanish (Español)',
      fr: 'French (Français)',
      pt: 'Portuguese (Português)',
      ru: 'Russian (Русский)',
      sw: 'Swahili (Kiswahili)',
      mr: 'Marathi (मराठी)',
      te: 'Telugu (తెలుగు)',
      ta: 'Tamil (தமிழ்)',
      vi: 'Vietnamese (Tiếng Việt)',
      so: 'Somali (Soomaali)',
      my: 'Burmese (မြန်မာ)',
      ko: 'Korean (한국어)',
      tr: 'Turkish (Türkçe)',
      de: 'German (Deutsch)'
    };
    const targetLangName = languageNames[userLanguage.toLowerCase()] || userLanguage;

    const cookedIngredientsList = isCookedDishMode
      ? finalCarouselItems.map(i => i.name).join(', ')
      : '';

    const synthesisPrompt = `You are the lead nutritional intelligence engine for VicCalary.
You write clear, comprehensive, clinical-grade nutritional explanations in natural paragraphs.

USER HEALTH CONTEXT:
- Primary Goal: ${userGoal}
- Daily Calorie Target: ${dailyCalorieGoal} kcal/day
- Dietary Restrictions: ${dietaryRestrictions.length ? dietaryRestrictions.join(', ') : 'None'}
- Allergies / Dislikes: ${allergies.length ? allergies.join(', ') : 'None'}
- Health Conditions: ${healthConditions}

AUTHENTICATED NUTRITIONAL FACTS (DO NOT INVENT NUMBERS, USE THESE EXACT TOTALS):
- Identified Dish: ${mealTitle}
- Meal Composition Mode: ${isCookedDishMode ? 'COOKED_DISH (plate-level calorie calculation; indicate items used to cook without individual raw ingredient calorie counts)' : 'SEPARABLE_ITEMS (clearly distinct, countable items on the plate with individual calorie calculations)'}
- Plate Portions Evaluated for Total Calories: ${nutritionCalculation.normalized_items.map(i => `${i.name} (${i.portion_description}): ${i.calories} kcal, ${i.protein}g protein, ${i.carbs}g carbs, ${i.fat}g fat`).join('; ')}
${isCookedDishMode ? `- Items Used to Cook / Prepare This Dish: ${cookedIngredientsList}` : ''}
- Total Estimated Calories: ${nutritionCalculation.total_calories} kcal (sensible range: ${nutritionCalculation.calorie_range.min} - ${nutritionCalculation.calorie_range.max} kcal)
- Total Protein: ${nutritionCalculation.total_protein}g
- Total Carbohydrates: ${nutritionCalculation.total_carbs}g
- Total Fat: ${nutritionCalculation.total_fat}g
- Total Fiber: ${nutritionCalculation.total_fiber}g
- Total Sugar: ${nutritionCalculation.total_sugar}g
- Total Sodium: ${nutritionCalculation.total_sodium_mg}mg
- Key Vitamins & Minerals present: ${[...nutritionCalculation.prominent_vitamins, ...nutritionCalculation.prominent_minerals].join(', ')}
- Visual Uncertainties: ${visualUncertainties}
- Visual Observation Details: ${rawMealDescription}

CRITICAL LANGUAGE REQUIREMENT:
You MUST write all output fields (meal_title, meal_description, vitamins_and_nutrition, recommendation) EXCLUSIVELY in fluent ${targetLangName} (code '${userLanguage}').
Under no circumstances should you output in English if another language is specified.

TASK: Write three substantive, highly informative clinical PARAGRAPHS in fluent ${targetLangName}.

1. "meal_description":
   ${isCookedDishMode
     ? `A rich, comprehensive, and culinary-grounded paragraph (4 to 6 detailed sentences) describing the cooked/baked dish observed on the plate or table (${mealTitle}). Clearly mention the culinary items used to cook or bake this meal (${cookedIngredientsList}) without assigning individual raw-ingredient calorie numbers to each ingredient, and explain that the finished dish on the plate provides a total of ${nutritionCalculation.total_calories} kcal based on its visible cooked portion.`
     : `A rich, comprehensive, and culinary-grounded paragraph (4 to 6 detailed sentences) describing the distinct, separable food items observed on the plate. Explicitly detail each visible item, its count/portion, and its individual USDA/TKPI calorie contribution from AUTHENTICATED NUTRITIONAL FACTS above, and how they sum to the total ${nutritionCalculation.total_calories} kcal.`}
   Strictly avoid vague or generic one-liners.

2. "vitamins_and_nutrition":
   A focused nutritional narrative paragraph. Explain what the macronutrient balance means for sustained energy, satiety, and blood sugar. Discuss specific micronutrients identified (e.g. Potassium, Vitamin C, Iron) and relevant considerations like sodium or saturated fat.

3. "recommendation":
   A clear clinical paragraph assessing whether this meal fits the user's current plan and objective (${userGoal}, ${dailyCalorieGoal} kcal/day). 
   - State clearly if it is recommended (verdict GOOD/MODERATE) or not recommended (verdict POOR).
   - Explain WHY based on calorie density, macronutrients, and declared restrictions/allergies.
   - Suggest sensible portion adjustments or side modifications that would improve suitability.
   - CRITICAL RULE IF NOT RECOMMENDED: You MUST NOT invent a fictional alternative meal! Look at "TODAY'S SUGGESTED MEALS IN USER'S PLAN" provided above, pick the most appropriate canonical meal from that list, name it explicitly, and explain why that exact alternative better serves their goal today.

Return ONLY a JSON object:
{
  "meal_title": "Translated dish name in ${targetLangName}",
  "meal_description": "Substantive, informative paragraph in ${targetLangName}...",
  "vitamins_and_nutrition": "Focused paragraph in ${targetLangName}...",
  "recommendation": "Clear recommendation in ${targetLangName}...",
  "verdict": "GOOD" | "MODERATE" | "POOR",
  "is_recommended": true | false,
  "alternative_meal_name": "Exact canonical meal name from today's plan if not recommended, or null if recommended"
}`;

    const synthesisResult = await callChatCompletionWithFallback({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.2,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    });

    const synthesisData = parseJSONSafely(synthesisResult.choices[0]?.message?.content);

    const fallbackClinicalDescription =
      rawMealDescription && rawMealDescription.length > 40
        ? rawMealDescription
        : isCookedDishMode
          ? `This cooked dish (${mealTitle}) is prepared using ${cookedIngredientsList.toLowerCase()}, providing a total of ${nutritionCalculation.total_calories} kcal for the visible portion on the plate. ${visualUncertainties}`
          : `This plate features ${nutritionCalculation.normalized_items.map(i => `${i.name.toLowerCase()} (${i.portion_description}, ${i.calories} kcal)`).join(', ')}, providing a total of ${nutritionCalculation.total_calories} kcal across all observed items. ${visualUncertainties}`;

    const fallbackVitaminsNarrative =
      `This meal supplies ${nutritionCalculation.total_protein}g of protein, ${nutritionCalculation.total_carbs}g of carbohydrates, and ${nutritionCalculation.total_fat}g of fat (${nutritionCalculation.total_fiber}g dietary fiber), alongside key micronutrients including ${[...nutritionCalculation.prominent_vitamins, ...nutritionCalculation.prominent_minerals].slice(0, 6).join(', ') || 'Potassium, Vitamin C, and B Vitamins'}.`;

    // ─── 5. DETERMINISTIC SAFETY GATE (ALLERGIES & MEDICAL CONDITIONS) ───
    const userSafetyProfile = userId 
      ? await SafetyEngine.getUserSafetyProfile(userId, supabase, userLanguage)
      : { userId: 'anon', userGoal, dailyCalorieGoal, allergies, medicalConditions: [healthConditions], dietaryLifestyle: dietaryRestrictions, isDiabetic: false, hasHypertension: false, language: userLanguage };

    const safetyEvaluation = SafetyEngine.evaluateMealSafety(
      isCookedDishMode ? [...identifiedFoods, ...displayItemsForCarousel] : identifiedFoods,
      nutritionCalculation,
      userSafetyProfile
    );

    let finalVerdict = synthesisData.verdict || (synthesisData.is_recommended ? 'GOOD' : 'MODERATE');
    let finalIsRecommended = synthesisData.is_recommended ?? (finalVerdict !== 'POOR');
    let finalRecommendation = synthesisData.recommendation || '';

    if (!safetyEvaluation.isSafe) {
      finalVerdict = 'POOR';
      finalIsRecommended = false;
      if (safetyEvaluation.warningMessage) {
        finalRecommendation = `${safetyEvaluation.warningMessage}\n\n${finalRecommendation}`;
      }
    }

    // Link alternative meal details if recommended or if safety gate failed
    let alternativeMealObj = null;
    let targetAltName = synthesisData.alternative_meal_name;

    if (!targetAltName && !finalIsRecommended && todaySuggestedMeals.length > 0) {
      targetAltName = todaySuggestedMeals[0].name;
    }

    if (targetAltName) {
      const matchedCanonical = todaySuggestedMeals.find(
        m => m.name.toLowerCase().includes(targetAltName.toLowerCase()) ||
             targetAltName.toLowerCase().includes(m.name.toLowerCase())
      ) || todaySuggestedMeals[0];

      if (matchedCanonical) {
        alternativeMealObj = {
          name: matchedCanonical.name,
          calories: matchedCanonical.calories,
          image: matchedCanonical.image,
          session: matchedCanonical.session
        };
      }
    }

    return NextResponse.json({
      name: synthesisData.meal_title || mealTitle,
      workflow: orchestratedResult.workflow,
      type: 'FOOD',
      description: synthesisData.meal_description || fallbackClinicalDescription,
      vitamins_and_nutrition: synthesisData.vitamins_and_nutrition || fallbackVitaminsNarrative,
      recommendation: finalRecommendation,
      verdict: finalVerdict,
      is_recommended: finalIsRecommended,
      user_alignment_boolean: finalIsRecommended,
      healthStatus: finalVerdict,

      // Authoritative deterministic nutrition
      calories: nutritionCalculation.total_calories,
      calories_exact: nutritionCalculation.total_calories_exact,
      calorie_range: nutritionCalculation.calorie_range,
      protein: nutritionCalculation.total_protein,
      carbs: nutritionCalculation.total_carbs,
      fat: nutritionCalculation.total_fat,
      fiber: nutritionCalculation.total_fiber,
      sugar: nutritionCalculation.total_sugar,
      sodium_mg: nutritionCalculation.total_sodium_mg,
      vitamins: nutritionCalculation.prominent_vitamins,
      minerals: nutritionCalculation.prominent_minerals,

      alternative_meal: alternativeMealObj,
      items: finalCarouselItems,
      is_decomposed_mixed_meal: orchestratedResult.is_decomposed_mixed_meal,
      provenance: orchestratedResult.provenance,
      confirmation: orchestratedResult.confirmation,
      verification_status: orchestratedResult.provenance.verification_status,
      requires_confirmation: orchestratedResult.confirmation.requires_confirmation,
      is_verified: !orchestratedResult.confirmation.requires_confirmation,
      needs_crowdsourcing: false
    });

  } catch (error: any) {
    console.error('[analyze-food-image] Error:', error.message || error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
