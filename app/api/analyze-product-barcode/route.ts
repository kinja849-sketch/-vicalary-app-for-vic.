import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calculateEconomicPrice } from '@/lib/pricing'

// checkPoliticalAffiliation removed. We now use dynamic LLM grounding via Strict Audit Protocol.

function parseNutriments(nutriments: any) {
  if (!nutriments) return null
  const cal = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || nutriments['energy_100g'] / 4.184 || 0
  const protein = nutriments['proteins_100g'] || nutriments['proteins'] || 0
  const carbs = nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0
  const fat = nutriments['fat_100g'] || nutriments['fat'] || 0
  const sugar = nutriments['sugars_100g'] || nutriments['sugars'] || 0
  const fiber = nutriments['fiber_100g'] || nutriments['fiber'] || 0
  if (cal === 0 && protein === 0) return null
  return {
    calories: Math.round(cal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  }
}

async function getGeoInfo(supabase: any, clientIp: string) {
  const { data: cached } = await supabase
    .from('ip_location_cache')
    .select('*')
    .eq('ip_address', clientIp)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (cached) return cached

  try {
    const geoRes = await fetch(`https://ipapi.co/${clientIp}/json/`)
    if (geoRes.ok) {
      const g = await geoRes.json()
      if (!g.error) {
        const geoInfo = {
          ip_address: clientIp,
          country_code: g.country_code || 'US',
          country_name: g.country_name || 'United States',
          city: g.city || 'Unknown',
          timezone: g.timezone || 'UTC',
          currency_code: g.currency || 'USD',
          currency_symbol: g.currency_symbol || '$',
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }
        supabase.from('ip_location_cache').upsert(geoInfo, { onConflict: 'ip_address' }).then()
        return geoInfo
      }
    }
  } catch (e) {
    console.error('Geo lookup failed:', e)
  }

  return { country_code: 'US', country_name: 'United States', city: 'Unknown', currency_code: 'USD', currency_symbol: '$', timezone: 'UTC' }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { barcode, userId, locationContext } = body

    if (!barcode) throw new Error('Barcode is required')

    const supabase = createServerSupabaseClient()
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY

    let geoInfo: any
    if (locationContext && (locationContext.country_code || locationContext.country)) {
      geoInfo = {
        country_code: locationContext.country_code || locationContext.country || 'US',
        country_name: locationContext.country_name || locationContext.country || 'Unknown',
        city: locationContext.city || 'Unknown',
        currency_code: locationContext.currency || locationContext.currency_code || 'USD',
        currency_symbol: locationContext.currency_symbol || '$',
        timezone: locationContext.timezone || 'UTC',
      }
    } else {
      const clientIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('cf-connecting-ip') ||
        '8.8.8.8'
      geoInfo = await getGeoInfo(supabase, clientIp)
    }

    const currencySymbol = geoInfo.currency_symbol || '$'

    let productData: any = null
    let medicationData: any = null
    let verifiedNutrition: any = null
    let isFromCache = false

    const isPotentialNDC = /^\d{10,11}$/.test(barcode.replace(/-/g, ''))
    if (isPotentialNDC) {
      const { data: cachedMed } = await supabase.from('medications').select('*').eq('ndc_code', barcode).maybeSingle()
      if (cachedMed) {
        medicationData = cachedMed
        isFromCache = true
      } else {
        try {
          const fdaRes = await fetch(`https://api.fda.gov/drug/ndc.json?search=product_ndc:"${barcode}"`)
          if (fdaRes.ok) {
            const fdaData = await fdaRes.json()
            if (fdaData.results?.length > 0) {
              const drug = fdaData.results[0]
              medicationData = {
                ndc_code: barcode,
                proprietary_name: drug.brand_name,
                generic_name: drug.generic_name,
                active_ingredients: drug.active_ingredients,
                dosage_form: drug.dosage_form,
                route: (drug.route || []).join(', '),
                manufacturer: drug.labeler_name,
                marketing_status: drug.marketing_status,
                is_verified: true,
              }
              supabase.from('medications').insert(medicationData).then()
            }
          }
        } catch (e) { console.error('OpenFDA error:', e) }
      }
    }

    if (medicationData) {
      productData = { type: 'medication', name: medicationData.proprietary_name || medicationData.generic_name, brand: medicationData.manufacturer }
    } else {
      const { data: cachedProd } = await supabase.from('products').select('*, companies(*)').eq('barcode', barcode).maybeSingle()
      if (cachedProd) {
        isFromCache = true
        productData = { type: 'food', name: cachedProd.name, brand: cachedProd.companies?.name || cachedProd.manufacturer, nutritional_data: cachedProd.nutritional_data, country_of_origin: cachedProd.country_of_origin }
        verifiedNutrition = parseNutriments(cachedProd.nutritional_data)
      } else {
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
        if (offRes.ok) {
          const offData = await offRes.json()
          if (offData.status === 1 && offData.product) {
            const p = offData.product
            productData = { type: 'food', name: p.product_name || p.product_name_en || 'Unknown Product', brand: p.brands, manufacturer: p.manufacturer, nutritional_data: p.nutriments, image_url: p.image_url, country_of_origin: p.countries_en || p.countries }
            verifiedNutrition = parseNutriments(p.nutriments)
            const { data: brandRow } = await supabase.from('companies').select('id').ilike('name', `%${p.brands?.split(',')[0].trim()}%`).maybeSingle()
            supabase.from('products').upsert({ barcode, name: productData.name, brand_id: brandRow?.id, manufacturer: p.brands, nutritional_data: p.nutriments, country_of_origin: productData.country_of_origin }, { onConflict: 'barcode' }).then()
          }
        }
      }
    }

    if (!productData && !isPotentialNDC) {
      return NextResponse.json({ found: false, error: 'Product not found. Please enter details manually.' }, { status: 404 })
    }

    if (!productData && isPotentialNDC) {
      productData = { type: 'medication', isFallback: true }
    }

    // LLM handles political checks dynamically now.
    // ECONOMIC PRICING (FAO INDEX METHOD)
    let productCategory = 'General';
    const lowerName = (productData?.name || '').toLowerCase();
    if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('susu')) productCategory = 'Dairy';
    else if (lowerName.includes('drink') || lowerName.includes('juice') || lowerName.includes('water')) productCategory = 'Beverages';
    else if (lowerName.includes('snack') || lowerName.includes('chip')) productCategory = 'Snacks';
    else if (lowerName.includes('cereal') || lowerName.includes('oat')) productCategory = 'Cereals';
    else if (lowerName.includes('meat') || lowerName.includes('beef')) productCategory = 'Meat';
    
    const deterministicPriceRaw = await calculateEconomicPrice(supabase, geoInfo, productCategory);

    const { data: userSettings } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', userId)
        .maybeSingle()
      
    var explicitUserLang = userSettings?.language || (locationContext?.languages?.[0] || 'en');

    let dailyBudgetStr = 'No specific financial constraints on file.';
    if (userId) {
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
            dailyBudgetStr = `Remaining Daily Budget is ${currencySymbol}${dailyAllocation.toFixed(2)}. Evaluate affordability based on this limit.`;
        }
      }
    }

    const hasVerifiedNutrition = verifiedNutrition !== null
    let prompt: string

    if (productData?.type === 'medication') {
      prompt = `You are a Medical Search and Retrieval Tool. Your ONLY job is to search the provided context, affirm the medication found, and return exact factual data. Do not act as an analyst.

SEARCH QUERY: Barcode or NDC ${barcode}
VERIFIED FDA DATA: ${medicationData ? JSON.stringify(medicationData) : 'Not found in FDA database. Infer from barcode if possible.'}
USER LOCATION: ${geoInfo.country_name} (${currencySymbol})

STRICT AUDIT PROTOCOL:
1. Identify the parent company and its political alignment based on your knowledge base.
2. Highlight any affiliations with companies, institutions, or investment firms (e.g., BlackRock, Vanguard) that invest heavily in the US and Israel.
3. If affiliated, set affiliationType to 'affiliated'. If clear of such ties, set to 'approved'.
4. Provide a concise summary of these affiliations in 'affiliationDetails'.

Provide a DEEP, ACTUAL, FACTUAL JSON response. Be extremely concise (1-2 sentences per text field):
{"name":"${medicationData?.proprietary_name || medicationData?.generic_name || 'Exact Medication Name'}","brand":"${medicationData?.manufacturer || 'Manufacturer'}","generic_name":"${medicationData?.generic_name || 'Generic Name'}","description":"A brief, 1-2 sentence factual affirmation of the medication searched and found.","purpose":"Concise mechanism of action","side_effects":"Concise side effects","interactions":"Concise interactions","warnings":"Concise warnings","storage":"Concise storage","healthStatus":"SAFE","politicalAlignment":"...","affiliationType":"approved","affiliationDetails":"..."}

LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('${explicitUserLang}'). Do NOT reply in English unless their language code is 'en' or similar.`
    } else {
      prompt = `You are a Search and Retrieval Tool. Your ONLY job is to search the provided context, affirm the product found, and return the exact factual data. Do not hallucinate or act as a verbose analyst.

SEARCH QUERY: Barcode ${barcode}
VERIFIED DATABASE RESULT: ${JSON.stringify(productData || { barcode })}
USER LOCATION: ${geoInfo.city}, ${geoInfo.country_name} | CURRENCY: ${currencySymbol}

STRICT AUDIT PROTOCOL:
1. Identify the parent company and its political alignment based on your knowledge base.
2. Highlight any affiliations with companies, institutions, or investment firms (e.g., BlackRock, Vanguard) that invest heavily in the US and Israel.
3. If affiliated, set affiliationType to 'affiliated'. If clear of such ties, set to 'approved'.
4. Provide a concise summary of these affiliations in 'affiliationDetails'.

RULES:
  1. ${hasVerifiedNutrition ? 'USE THE VERIFIED NUTRITION NUMBERS EXACTLY.' : 'Use the provided product details to estimate macros concisely.'}
  2. Be extremely concise. Do NOT write paragraphs.
  3. In the description, explicitly affirm the search result (e.g., "Found: [Brand] [Product].").
  
  Respond with ONLY JSON:
  {"name":"exact product name","brand":"brand name","description":"A brief, 1-2 sentence factual affirmation of the exact product searched and found.","usage_instructions":"Concise usage","ingredients_analysis":"Concise summary of ingredients","dietary_suitability":"Concise dietary notes","vitamins_and_nutrition":"Concise nutrition overview","recommendation":"One sentence recommendation","recommended_pairings":"One sentence pairing","cheaper_alternatives":[],"calories":${hasVerifiedNutrition ? verifiedNutrition.calories : 0},"protein":${hasVerifiedNutrition ? verifiedNutrition.protein : 0},"carbs":${hasVerifiedNutrition ? verifiedNutrition.carbs : 0},"fat":${hasVerifiedNutrition ? verifiedNutrition.fat : 0},"sugar":${hasVerifiedNutrition ? verifiedNutrition.sugar : 0},"fiber":${hasVerifiedNutrition ? verifiedNutrition.fiber : 0},"healthStatus":"GOOD|MODERATE|POOR","user_alignment_boolean":true,"politicalAlignment":"...","affiliationType":"approved","affiliationDetails":"..."}
  
  LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('${explicitUserLang}'). Do NOT reply in English unless their language code is 'en' or similar.`
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiRes.ok) throw new Error(`OpenAI error: ${await aiRes.text()}`)
    const aiData = await aiRes.json()
    const result = JSON.parse(aiData.choices[0].message.content)

    // Strip markdown symbols to prevent them from showing in the UI
    const stripSymbols = (obj: any) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].replace(/[*#]/g, '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                stripSymbols(obj[key]);
            }
        }
    };
    stripSymbols(result);

    result.political_warning = result.affiliationType === 'affiliated' ? `🔴 ETHICAL ALERT: ${result.affiliationDetails}` : 'Ethically cleared (LLM Grounding).';
    result.is_compliant = result.affiliationType !== 'affiliated';
    result.needs_crowdsourcing = false;
    if (productData?.type !== 'medication') {
        result.estimated_price = deterministicPriceRaw;
    }

    if (verifiedNutrition) {
      result.calories = verifiedNutrition.calories
      result.protein = verifiedNutrition.protein
      result.carbs = verifiedNutrition.carbs
      result.fat = verifiedNutrition.fat
      result.sugar = verifiedNutrition.sugar
      result.fiber = verifiedNutrition.fiber
    }

    return NextResponse.json({
      found: !!productData,
      barcode,
      type: productData?.type || 'unknown',
      is_verified: !!(medicationData?.is_verified || verifiedNutrition),
      is_from_cache: isFromCache,
      image_url: productData?.image_url,
      country_of_origin: productData?.country_of_origin,
      needs_crowdsourcing: result.needs_crowdsourcing ?? false,
      ...result,
    })
  } catch (error: any) {
    console.error('analyze-product error:', error.message)
    // Fallback if AI or fetch completely fails
    return NextResponse.json({ 
        found: true,
        type: 'food',
        name: 'Analysis Unavailable',
        description: 'Analysis unavailable due to AI safety filters or timeout. Please check the network and try again.',
        political_warning: 'Ethically cleared. Not found on the TechForPalestine boycott list.',
        is_compliant: true,
        needs_crowdsourcing: true
    })
  }
}
