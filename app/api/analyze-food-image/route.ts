import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NutritionNormalizer, IdentifiedFoodItem } from '@/lib/nutrition/NutritionNormalizer';
import { SafetyEngine } from '@/lib/services/SafetyEngine';
import { callChatCompletionWithFallback, getPrimaryApiKey, getBackupApiKey } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage } from '@/lib/api/serverLanguage';

function parseJSONSafely(text?: string | null, fallback: any = {}) {
  try {
    if (!text) return fallback;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    }
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, userId, locationContext, isProductScan } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: 'Image URL or base64 data is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
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

1. STRICT ACCURATE MEAL DECOMPOSITION (DECOMPOSE STEWS & MIXED DISHES):
   - Carefully examine and separate each distinct food component on the plate.
   - NEVER lump mixed dishes, stews, curries, or sautés into a single generic item name (e.g. NEVER return "Potato and tomato stew" or "Chicken vegetable curry").
   - ALWAYS break down and identify the actual constituent culinary ingredients visible in the dish:
     * For example, in a potato and tomato stew with rice:
       - "Potatoes" (stewed/boiled potato chunks, ~140-160g)
       - "Tomatoes" (simmered tomato chunks/reduction, ~60-80g)
       - "Onions" (cooked/sautéed sliced onions, ~30-50g)
       - "White Rice" (steamed long-grain rice, ~150-160g)
   - Every significant ingredient used to cook that meal must be reflected in foods[] as it is seen according to the image.

2. METHOD & VARIANT RECOGNITION:
   - For every item, specify the observable culinary preparation method or variant in "variant_or_method":
     * Grains/Starches: 'white_rice', 'brown_rice', 'fried_rice', 'quinoa', 'sourdough', 'toast', 'bun'.
     * Vegetables/Produce: 'stewed', 'boiled', 'sautéed', 'roasted', 'steamed', 'raw', 'sliced'.
     * Potatoes/Tubers: 'stewed', 'boiled', 'roasted', 'mashed', 'french_fries', 'baked'.
     * Proteins: 'grilled', 'fried', 'roasted', 'boiled', 'poached', 'pan_seared', 'steamed', 'raw' (and specify cut if visible, e.g. breast vs thigh).
   - If countable items exist (e.g. eggs, buns, bread slices, dumplings), provide the exact count in "count" (e.g. "4x", "1x", "2 slices").

3. ACCURATE PORTION GROUNDING & ANTI-DISTORTION:
   - Ground portion estimates in realistic dinner plate geometry (~25-28cm diameter).
   - Estimate portion weight in grams (g) conservatively based on physical food density:
     * Cooked potatoes/chunks: ~130-160g (~110-140 kcal).
     * Sautéed/cooked onions: ~30-50g (~12-20 kcal).
     * Stewed/sliced tomatoes: ~60-90g (~12-18 kcal).
     * 1 cup cooked rice: ~150-160g (~195-210 kcal).
     * 1 medium egg: ~48-52g (~70 kcal). If 4 eggs are visible, portion is ~200g (~280 kcal).
     * Cucumber sticks/slices: ~50-80g (~8-12 kcal).
     * 1 steamed bao bun: ~40-50g (~100-115 kcal).
     * Palm chicken breast: ~140-160g (~230-265 kcal grilled).
   - DO NOT systematically inflate or exaggerate portion grams. State unobserved elements (cooking oils, sodium) in "visual_uncertainties" rather than manufacturing phantom calories.

Return ONLY a valid JSON object matching this schema:
{
  "meal_title": "Descriptive, accurate culinary name for this meal combination",
  "visual_uncertainties": "Specific notes on what cannot be verified visually (e.g., hidden cooking fats, sodium, inside meat doneness)",
  "meal_description": "An informative paragraph describing the observed dish, cooking methods, textures, and component proportions.",
  "foods": [
    {
      "name": "Food item name (e.g. Potatoes, Tomatoes, Onions, White Rice, Eggs, Chicken Breast)",
      "count": "1x",
      "variant_or_method": "stewed",
      "estimated_portion_g": 150,
      "portion_description": "chunky stewed potato pieces (~150g)",
      "confidence": 0.95
    }
  ]
}`;

    const visionResult = await callChatCompletionWithFallback({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionSystemPrompt },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl,
              detail: 'high'
            }
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const visionParsed = parseJSONSafely(visionResult.choices[0]?.message?.content);
    const mealTitle = visionParsed.meal_title || 'Meal Analysis';
    const visualUncertainties = visionParsed.visual_uncertainties || 'Portion sizes and preparation fats estimated from visual appearance.';
    const rawMealDescription = visionParsed.meal_description || '';
    const identifiedFoods: IdentifiedFoodItem[] = Array.isArray(visionParsed.foods) && visionParsed.foods.length > 0
      ? visionParsed.foods
      : [{ name: mealTitle, estimated_portion_g: 220, portion_description: '1 standard serving (~220g)' }];

    // ─── 3. STEP 2: AUTHORITATIVE NUTRITION NORMALIZATION ───
    const nutritionCalculation = await NutritionNormalizer.calculateMealNutrition(identifiedFoods, supabase);

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
- Identified Items & Portions: ${nutritionCalculation.normalized_items.map(i => `${i.name} (${i.portion_description}): ${i.calories} kcal, ${i.protein}g protein, ${i.carbs}g carbs, ${i.fat}g fat`).join('; ')}
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
   A rich, comprehensive, and culinary-grounded paragraph (4 to 6 detailed sentences) describing what is observed on the plate. Explicitly detail each constituent ingredient used to cook the meal (e.g. potatoes, tomatoes, onions, rice), noting how each was prepared (e.g. simmered in a rich tomato-onion reduction, tender-boiled, steamed fluffy grains), its visible culinary texture, and its proportion on the plate. Strictly avoid vague or generic one-liners.

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
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const synthesisData = parseJSONSafely(synthesisResult.choices[0]?.message?.content);

    // ─── 5. DETERMINISTIC SAFETY GATE (ALLERGIES & MEDICAL CONDITIONS) ───
    const userSafetyProfile = userId 
      ? await SafetyEngine.getUserSafetyProfile(userId, supabase, userLanguage)
      : { userId: 'anon', userGoal, dailyCalorieGoal, allergies, medicalConditions: [healthConditions], dietaryLifestyle: dietaryRestrictions, isDiabetic: false, hasHypertension: false, language: userLanguage };

    const safetyEvaluation = SafetyEngine.evaluateMealSafety(identifiedFoods, nutritionCalculation, userSafetyProfile);

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
      type: 'FOOD',
      description: synthesisData.meal_description || visualUncertainties,
      vitamins_and_nutrition: synthesisData.vitamins_and_nutrition,
      recommendation: finalRecommendation,
      verdict: finalVerdict,
      is_recommended: finalIsRecommended,
      user_alignment_boolean: finalIsRecommended,
      healthStatus: finalVerdict,
      
      // Authoritative deterministic nutrition
      calories: nutritionCalculation.total_calories,
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
      items: nutritionCalculation.normalized_items,
      is_verified: true,
      needs_crowdsourcing: false
    });

  } catch (error: any) {
    console.error('[analyze-food-image] Error:', error.message || error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
