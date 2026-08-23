import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calculateEconomicPrice } from '@/lib/pricing'

// Static checkPoliticalAffiliation removed. Strict Audit Protocol handles this dynamically.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, imageBase64, userId, locationContext, isProductScan } = body

    if (!imageUrl && !imageBase64) throw new Error('Image URL or base64 data is required')

    const supabase = createServerSupabaseClient()
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY

    let profileContext = 'USER PROFILE: General healthy adult. No specific dietary restrictions on file.'
    let userGoalSummary = 'maintain a healthy lifestyle'

    if (userId) {
      const { data: onboarding } = await supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (onboarding) {
        const goal = onboarding.goal || 'maintain a healthy lifestyle'
        const restrictions = (onboarding.dietary_lifestyle || []).join(', ') || 'none'
        const medical = onboarding.medical_conditions || 'None reported'
        const health = onboarding.health_conditions || 'None reported'
        const calorieTarget = onboarding.daily_calorie_goal || 2000
        userGoalSummary = goal

        profileContext = `USER PROFILE & CONSTRAINTS:
- PRIMARY GOAL: ${goal}
- DIETARY LIFESTYLE / RESTRICTIONS: ${restrictions}
- MEDICAL CONDITIONS: ${medical}
- HEALTH CONCERNS: ${health}
- DAILY CALORIE TARGET: ${calorieTarget} kcal/day
- ASSESSMENT RULE: Based on the above profile, explicitly state whether this meal is GOOD, MODERATE, or POOR for this user and why.`
      }
      
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', userId)
        .maybeSingle()
      
      var explicitUserLang = userSettings?.language || locationContext?.language;

      const { data: budgetData } = await supabase
        .from('user_budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (budgetData) {
        const today = new Date();
        const end = new Date(budgetData.period_end);
        if (today <= end) {
            const diffTime = Math.abs(end.getTime() - today.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const remaining = budgetData.remaining_budget ?? budgetData.total_budget ?? 0;
            const dailyAllocation = diffDays > 0 ? remaining / diffDays : remaining;
            profileContext += `\n- FINANCIAL CONTEXT: Remaining Daily Budget is ${locationContext?.currency_symbol || '$'}${dailyAllocation.toFixed(2)}. Evaluate affordability based on this limit.`;
        }
      }
    }

    const identificationPrompt = isProductScan
      ? `Identify the packaged product in this image. VERY IMPORTANT: Visually scan the image for a barcode and extract the exact EAN/UPC digits printed beneath the barcode lines. Return ONLY a JSON object with "name", "brand", "barcode" (string of digits, or null if absolutely not visible), and "type" ("food", "medication", or "unknown"). Example: {"name": "Instant Noodle Cup", "brand": "Nissin", "barcode": "0123456789012", "type": "food"}`
      : `Identify the food in this image. Return ONLY a JSON object with a "name" field. Example: {"name": "Apple"}`

    const idResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: identificationPrompt },
            { type: 'image_url', image_url: { url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl, detail: 'low' } },
          ],
        }],
        response_format: { type: 'json_object' },
      }),
    })

    const idData = await idResponse.json()
    const idContent = JSON.parse(idData.choices[0].message.content)
    let identifiedName = idContent.name
    let identifiedBrand = idContent.brand || ''
    const identifiedType = idContent.type || 'food'
    const extractedBarcode = idContent.barcode

    let dbVerifiedContext = ''
    let isHallucinated = true
    let verifiedFood: any = null

    if (isProductScan && extractedBarcode && extractedBarcode.length >= 8) {
      try {
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${extractedBarcode}.json`)
        if (offRes.ok) {
          const offData = await offRes.json()
          if (offData.status === 1 && offData.product) {
            const p = offData.product
            identifiedName = p.product_name || p.product_name_en || identifiedName
            identifiedBrand = p.brands || identifiedBrand
            const nutriments = p.nutriments
            if (nutriments) {
              verifiedFood = {
                calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || nutriments['energy_100g'] / 4.184 || 0),
                protein: Math.round((nutriments['proteins_100g'] || nutriments['proteins'] || 0) * 10) / 10,
                carbs: Math.round((nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0) * 10) / 10,
                fat: Math.round((nutriments['fat_100g'] || nutriments['fat'] || 0) * 10) / 10,
                fiber: Math.round((nutriments['fiber_100g'] || nutriments['fiber'] || 0) * 10) / 10,
                sugar: Math.round((nutriments['sugars_100g'] || nutriments['sugars'] || 0) * 10) / 10,
              }
              isHallucinated = false
              dbVerifiedContext = `
VERIFIED NUTRITIONAL DATA FOUND IN MASTER DATABASE (BARCODE: ${extractedBarcode}):
- Calories: ${verifiedFood.calories} kcal
- Protein: ${verifiedFood.protein}g
- Carbs: ${verifiedFood.carbs}g
- Fat: ${verifiedFood.fat}g
- Fiber: ${verifiedFood.fiber}g
- Sugar: ${verifiedFood.sugar}g

MANDATORY: You MUST use these exact verified numbers in your output. Do not hallucinate.`
            }
          }
        }
      } catch (e) {
        console.warn('Open Food Facts lookup failed during image scan', e)
      }
    }

    if (!verifiedFood) {
        const { data: dbFood } = await supabase
          .from('food_items')
          .select('*')
          .ilike('name', `%${identifiedName}%`)
          .order('calories', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (dbFood) {
          verifiedFood = dbFood
          isHallucinated = false
          dbVerifiedContext = `
VERIFIED NUTRITIONAL DATA FOUND IN DATABASE:
- Calories: ${verifiedFood.calories} kcal
- Protein: ${verifiedFood.protein}g
- Carbs: ${verifiedFood.carbs}g
- Fat: ${verifiedFood.fat}g
- Fiber: ${verifiedFood.fiber}g
- Sugar: ${verifiedFood.sugar}g

MANDATORY: You MUST use these exact verified numbers in your output.`
        }
    }

    const clientIp =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      '8.8.8.8';

    let geoInfo = {
      country_code: locationContext?.country_code || 'US',
      country_name: locationContext?.country_name || locationContext?.country || 'Unknown',
      city: locationContext?.city || 'Unknown',
      currency_code: locationContext?.currency || locationContext?.currency_code || 'USD',
      currency_symbol: locationContext?.currency_symbol || '$',
    }

    if (geoInfo.country_name === 'Unknown') {
      try {
        const geoRes = await fetch(`https://ipapi.co/${clientIp}/json/`);
        if (geoRes.ok) {
          const g = await geoRes.json();
          geoInfo = {
            country_code: g.country_code || 'US',
            country_name: g.country_name || 'United States',
            city: g.city || 'Unknown',
            currency_code: g.currency || 'USD',
            currency_symbol: g.currency_symbol || '$',
          };
        }
      } catch (e) {
        console.warn('[Food-AI] Geo lookup failed, using fallbacks');
      }
    }

    let productCategory = 'General';
    const lowerName = (identifiedName || '').toLowerCase();
    if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('susu')) productCategory = 'Dairy';
    else if (lowerName.includes('drink') || lowerName.includes('juice') || lowerName.includes('water')) productCategory = 'Beverages';
    else if (lowerName.includes('snack') || lowerName.includes('chip')) productCategory = 'Snacks';
    else if (lowerName.includes('cereal') || lowerName.includes('oat')) productCategory = 'Cereals';
    else if (lowerName.includes('meat') || lowerName.includes('beef')) productCategory = 'Meat';
    else if (lowerName.includes('fruit') || lowerName.includes('veg')) productCategory = 'Produce';
    
    const deterministicPriceRaw = await calculateEconomicPrice(supabase, geoInfo, productCategory);

    const { data: userSettings } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', userId)
        .maybeSingle()
      
    var explicitUserLang = userSettings?.language || (locationContext?.languages?.[0] || 'en');

    let aiPrompt = ''
    let responseFormat: any = { type: 'json_object' }

    if (isProductScan && identifiedType === 'medication') {
      aiPrompt = `You are a Medical Search and Retrieval Tool. Your ONLY job is to search the provided context, affirm the medication found, and return exact factual data. Do not act as an analyst.
NAME: ${identifiedName}
BRAND: ${identifiedBrand}
USER PROFILE: Location ${geoInfo.country_name} (${geoInfo.currency_symbol})

STRICT AUDIT PROTOCOL:
1. Identify the parent company and its political alignment based on your knowledge base.
2. Highlight any affiliations with companies, institutions, or investment firms (e.g., BlackRock, Vanguard) that invest heavily in the US and Israel.
3. If affiliated, set affiliationType to 'affiliated'. If clear of such ties, set to 'approved'.
4. Provide a concise summary of these affiliations in 'affiliationDetails'.

Provide a DEEP, ACTUAL, FACTUAL JSON response with all fields. Be extremely concise (1-2 sentences max per field):
{"name":"${identifiedName}","brand":"${identifiedBrand}","generic_name":"Generic Name","description":"A brief, 1-2 sentence factual affirmation of the medication searched and found.","purpose":"Concise mechanism of action","side_effects":"Concise side effects","interactions":"Concise interactions","warnings":"Concise warnings","storage":"Concise storage","healthStatus":"SAFE","politicalAlignment":"...","affiliationType":"approved","affiliationDetails":"..."}

LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('${explicitUserLang}'). Do NOT reply in English unless their language code is 'en' or similar.`
    } else if (isProductScan) {
      aiPrompt = `You are a Search and Retrieval Tool. Your ONLY job is to search the provided context, affirm the product found, and return the exact factual data. Do not hallucinate or act as a verbose analyst.
PRODUCT NAME: ${identifiedName}
BRAND: ${identifiedBrand}
USER PROFILE: ${profileContext}
${dbVerifiedContext}
REGIONAL STANDARDS: Use ${['US', 'UK', 'CA', 'AU'].includes(geoInfo.country_name) ? 'Imperial (oz/lbs)' : 'Metric (g/kg)'} units. Factor in ${geoInfo.country_name} food safety regulations.

STRICT AUDIT PROTOCOL:
1. Identify the parent company and its political alignment based on your knowledge base.
2. Highlight any affiliations with companies, institutions, or investment firms (e.g., BlackRock, Vanguard) that invest heavily in the US and Israel.
3. If affiliated, set affiliationType to 'affiliated'. If clear of such ties, set to 'approved'.
4. Provide a concise summary of these affiliations in 'affiliationDetails'.

RULES:
1. ${verifiedFood ? 'USE THE VERIFIED NUTRITION NUMBERS EXACTLY.' : 'Use the provided product details to estimate macros concisely.'}
2. Be extremely concise. Do NOT write paragraphs.
3. In the description, explicitly affirm the search result (e.g., "Found: [Brand] [Product].").

Respond with ONLY JSON:
{"name":"${identifiedName}","brand":"${identifiedBrand}","description":"A brief, 1-2 sentence factual affirmation of the exact product searched and found.","usage_instructions":"Concise usage","ingredients_analysis":"Concise summary of ingredients","dietary_suitability":"Concise dietary notes","vitamins_and_nutrition":"Concise nutrition overview","recommendation":"One sentence recommendation","recommended_pairings":"One sentence pairing","cheaper_alternatives":[],"calories":${verifiedFood ? verifiedFood.calories : 0},"protein":${verifiedFood ? verifiedFood.protein : 0},"carbs":${verifiedFood ? verifiedFood.carbs : 0},"fat":${verifiedFood ? verifiedFood.fat : 0},"sugar":${verifiedFood ? verifiedFood.sugar : 0},"fiber":${verifiedFood ? verifiedFood.fiber : 0},"verdict":"GOOD","user_alignment_boolean":true,"politicalAlignment":"...","affiliationType":"approved","affiliationDetails":"..."}

LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('${explicitUserLang}'). Do NOT reply in English unless their language code is 'en' or similar.`
    } else {
      aiPrompt = `You are a Visual Search and Retrieval Tool. Your ONLY job is to search the provided context, affirm the dish found, and return the exact factual data. Do not act as a verbose analyst.
Analyze the provided food image with precision and deep factual details. Be concise.

${profileContext}
${dbVerifiedContext}
LOCATION CONTEXT: ${geoInfo.city}, ${geoInfo.country_name}
REGIONAL STANDARDS: Use ${['US', 'UK', 'CA', 'AU'].includes(geoInfo.country_name) ? 'Imperial' : 'Metric'} units. 

STRICT AUDIT PROTOCOL:
1. Identify the parent company and its political alignment based on your knowledge base.
2. Highlight any affiliations with companies, institutions, or investment firms (e.g., BlackRock, Vanguard) that invest heavily in the US and Israel.
3. If affiliated, set affiliationType to 'affiliated'. If clear of such ties, set to 'approved'.
4. Provide a concise summary of these affiliations in 'affiliationDetails'.

Write a concise nutritional report (1-2 sentences max per field):
- description: A brief, 1-2 sentence factual affirmation of the exact dish found.
- vitamins_and_nutrition: Concise list of vitamins and minerals.
- recommended_pairings: Concise suggested enhancements.
- recommendation: ONE sentence tailored to the user's goal (${userGoalSummary}).

${verifiedFood ? 'MANDATORY: Use the VERIFIED NUTRITIONAL DATA provided above.' : 'ESTIMATION RULE: Provide your best nutritional estimate based on portion size.'}

JSON OUTPUT:
{"name":"${identifiedName}","description":"...","vitamins_and_nutrition":"...","recommended_pairings":"...","recommendation":"...","verdict":"GOOD|MODERATE|POOR","user_alignment_boolean":true,"calories":${verifiedFood?.calories || 0},"protein":${verifiedFood?.protein || 0},"carbs":${verifiedFood?.carbs || 0},"fat":${verifiedFood?.fat || 0},"sugar":${verifiedFood?.sugar || 0},"fiber":${verifiedFood?.fiber || 0},"confidence_interval":${verifiedFood ? 1.0 : 0.8},"is_verified":${!isHallucinated},"politicalAlignment":"...","affiliationType":"approved","affiliationDetails":"..."}`

      responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: 'food_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }, description: { type: 'string' },
              vitamins_and_nutrition: { type: 'string' }, recommended_pairings: { type: 'string' },
              recommendation: { type: 'string' }, verdict: { type: 'string', enum: ['GOOD', 'MODERATE', 'POOR'] },
              user_alignment_boolean: { type: 'boolean' }, calories: { type: 'number' },
              protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
              sugar: { type: 'number' }, fiber: { type: 'number' },
              confidence_interval: { type: 'number' }, is_verified: { type: 'boolean' },
              politicalAlignment: { type: 'string' }, affiliationType: { type: 'string' }, affiliationDetails: { type: 'string' }
            },
            required: ['name', 'description', 'vitamins_and_nutrition', 'recommended_pairings', 'recommendation', 'verdict', 'user_alignment_boolean', 'calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'confidence_interval', 'is_verified', 'politicalAlignment', 'affiliationType', 'affiliationDetails'],
            additionalProperties: false,
          },
        },
      }
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: [
          { type: 'text', text: aiPrompt },
          { type: 'image_url', image_url: { url: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl, detail: 'high' } },
        ]}],
        response_format: responseFormat,
      }),
    })

    if (!aiResponse.ok) throw new Error(`OpenAI error: ${await aiResponse.text()}`)
    const aiResult = await aiResponse.json()
    
    let parsed: any = {};
    const aiContent = aiResult.choices[0].message.content;
    if (!aiContent || aiContent.trim() === "null" || aiResult.choices[0].message.refusal) {
        console.warn("AI Refused or returned null content. Falling back to default object.");
        parsed = {
            name: identifiedName || "Unknown Food",
            brand: identifiedBrand || "",
            description: "Analysis unavailable due to AI safety filters.",
            vitamins_and_nutrition: "Unavailable",
            recommended_pairings: "Unavailable",
            recommendation: "Unavailable",
            verdict: "MODERATE",
            user_alignment_boolean: true,
            calories: verifiedFood ? verifiedFood.calories : 0,
            protein: verifiedFood ? verifiedFood.protein : 0,
            carbs: verifiedFood ? verifiedFood.carbs : 0,
            fat: verifiedFood ? verifiedFood.fat : 0,
            sugar: verifiedFood ? verifiedFood.sugar : 0,
            fiber: verifiedFood ? verifiedFood.fiber : 0,
            political_warning: 'Check unavailable.',
            is_compliant: true,
            needs_crowdsourcing: false,
            estimated_price: isProductScan ? deterministicPriceRaw : undefined
        };
    } else {
        try {
            parsed = JSON.parse(aiContent);
            const stripSymbols = (obj: any) => {
                for (const key in obj) {
                    if (typeof obj[key] === 'string') {
                        obj[key] = obj[key].replace(/[*#]/g, '');
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        stripSymbols(obj[key]);
                    }
                }
            };
            stripSymbols(parsed);

            // Map the new structured affiliation properties back into the expected UI format
            parsed.political_warning = parsed.affiliationType === 'affiliated' ? `🔴 ETHICAL ALERT: ${parsed.affiliationDetails}` : 'Ethically cleared (LLM Grounded).';
            parsed.is_compliant = parsed.affiliationType !== 'affiliated';
            if (isProductScan) {
              parsed.estimated_price = deterministicPriceRaw;
            }
            parsed.needs_crowdsourcing = false;
        } catch (e) {
            console.error("Failed to parse AI JSON output", e);
            throw new Error("AI returned malformed JSON");
        }
    }

    if (verifiedFood && identifiedType !== 'medication') {
      parsed.calories = verifiedFood.calories
      parsed.protein = verifiedFood.protein
      parsed.carbs = verifiedFood.carbs
      parsed.fat = verifiedFood.fat
      parsed.sugar = verifiedFood.sugar ?? parsed.sugar
      parsed.fiber = verifiedFood.fiber ?? parsed.fiber
    }

    return NextResponse.json({
      ...parsed,
      type: identifiedType === 'medication' ? 'medication' : 'food',
      healthStatus: parsed.verdict || parsed.healthStatus,
      confidence_interval: verifiedFood ? 1.0 : 0.8,
      is_verified: !isHallucinated,
      needs_crowdsourcing: false
    })
  } catch (error: any) {
    console.error('analyze-food-image error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
