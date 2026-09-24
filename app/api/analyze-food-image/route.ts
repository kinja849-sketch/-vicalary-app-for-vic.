import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NutritionNormalizer, IdentifiedFoodItem } from '@/lib/nutrition/NutritionNormalizer';
import { SafetyEngine } from '@/lib/services/SafetyEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, userId, locationContext, isProductScan } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: 'Image URL or base64 data is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // ─── 1. FETCH USER PROFILE, ONBOARDING, AND TODAY'S CANONICAL MEAL PLAN ───
    let userGoal = 'maintain a healthy lifestyle';
    let dailyCalorieGoal = 2000;
    let dietaryRestrictions: string[] = [];
    let allergies: string[] = [];
    let healthConditions = 'None reported';
    let userLanguage = 'en';
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
        supabase.from('user_settings').select('language').eq('user_id', userId).maybeSingle(),
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

      userLanguage = userSettings?.language || locationContext?.language || (locationContext?.languages?.[0]) || 'en';

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
Analyze the entire visible meal in the image with precision.
Identify each individual food item present on the plate or in the photo.
Estimate realistic portion weights in grams (g) for each food.
Note any visual ambiguities or uncertainties (e.g. preparation method, type of oil, seasoning, meat blend).

Return ONLY a valid JSON object matching this schema:
{
  "meal_title": "Primary name for this meal combination",
  "visual_uncertainties": "Specific notes on what cannot be verified visually (e.g., hidden oils, seasoning, meat blend)",
  "foods": [
    {
      "name": "Food item name (e.g. French Fries, Chicken Sausage)",
      "estimated_portion_g": 150,
      "portion_description": "Approximate human-readable portion (e.g. 1 medium bowl, 2 links)"
    }
  ]
}`;

    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: visionSystemPrompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl,
                detail: 'auto'
              }
            }
          ]
        }],
        response_format: { type: 'json_object' }
      })
    });

    if (!visionResponse.ok) {
      const errText = await visionResponse.text();
      console.error('[analyze-food-image] Vision OpenAI error:', errText);
      throw new Error(`OpenAI Vision analysis failed: ${errText}`);
    }

    const visionJson = await visionResponse.json();
    const visionParsed = JSON.parse(visionJson.choices[0].message.content || '{}');
    const mealTitle = visionParsed.meal_title || 'Meal Analysis';
    const visualUncertainties = visionParsed.visual_uncertainties || 'Portion sizes and preparation fats estimated from visual appearance.';
    const identifiedFoods: IdentifiedFoodItem[] = Array.isArray(visionParsed.foods) && visionParsed.foods.length > 0
      ? visionParsed.foods
      : [{ name: mealTitle, estimated_portion_g: 250, portion_description: '1 standard serving (~250g)' }];

    // ─── 3. STEP 2: AUTHORITATIVE NUTRITION NORMALIZATION ───
    const nutritionCalculation = await NutritionNormalizer.calculateMealNutrition(identifiedFoods, supabase);

    // ─── 4. STEP 3: USER PLAN ALIGNMENT & DEEP PARAGRAPH SYNTHESIS ───
    const canonicalMealsContext = todaySuggestedMeals.length > 0
      ? `TODAY'S SUGGESTED MEALS IN USER'S PLAN (Canonical Source):
${todaySuggestedMeals.slice(0, 8).map(m => `- ${m.name} (~${m.calories} kcal, ${m.session})`).join('\n')}`
      : `NO PRE-EXISTING MEAL PLAN FOUND FOR TODAY.`;

    const synthesisPrompt = `You are the lead nutritional intelligence engine for VicCalary.
You write detailed, comprehensive, clinical-grade nutritional explanations in natural paragraphs.

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

${canonicalMealsContext}

TASK: Write three substantial, clinical, readable PARAGRAPHS in language code '${userLanguage}':

1. "meal_description":
   A thorough, articulate paragraph explaining what you observe in the image. Describe each distinct component, their estimated portion volumes or piece counts, and explicitly acknowledge visual uncertainties (such as whether fries are deep-fried or air-fried, or sausage meat blends). Do NOT use brief one-liners.

2. "vitamins_and_nutrition":
   A substantial nutritional narrative paragraph. Explain what the macronutrient balance means for sustained energy, satiety, and blood sugar. Discuss the specific micronutrients identified (e.g. Potassium and Vitamin C in potatoes, B vitamins and Iron in sausages/meats) and note relevant considerations such as sodium or saturated fat content.

3. "recommendation":
   A thorough paragraph assessing whether this meal fits the user's current plan and objective (${userGoal}, ${dailyCalorieGoal} kcal/day). 
   - State clearly if it is recommended (verdict GOOD/MODERATE) or not recommended (verdict POOR).
   - Explain WHY based on calorie density, macronutrients, and declared restrictions/allergies.
   - Suggest sensible portion adjustments or side modifications that would improve suitability.
   - CRITICAL RULE IF NOT RECOMMENDED: You MUST NOT invent a fictional alternative meal! Look at "TODAY'S SUGGESTED MEALS IN USER'S PLAN" provided above, pick the most appropriate canonical meal from that list, name it explicitly, and explain why that exact alternative better serves their goal today.

Return ONLY a JSON object:
{
  "meal_description": "Thorough paragraph...",
  "vitamins_and_nutrition": "Substantial paragraph...",
  "recommendation": "Thorough paragraph...",
  "verdict": "GOOD" | "MODERATE" | "POOR",
  "is_recommended": true | false,
  "alternative_meal_name": "Exact canonical meal name from today's plan if not recommended, or null if recommended"
}`;

    const synthesisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: synthesisPrompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!synthesisResponse.ok) {
      const errText = await synthesisResponse.text();
      console.error('[analyze-food-image] Synthesis OpenAI error:', errText);
      throw new Error(`OpenAI Synthesis failed: ${errText}`);
    }

    const synthesisJson = await synthesisResponse.json();
    const synthesisData = JSON.parse(synthesisJson.choices[0].message.content || '{}');

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
      name: mealTitle,
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
