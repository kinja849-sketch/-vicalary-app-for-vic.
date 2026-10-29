import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ScannerDecisionEngine } from '@/lib/scanner/ScannerDecisionEngine';
import { ProductAdvisor } from '@/lib/ai/ProductAdvisor';
import { SafetyEngine } from '@/lib/services/SafetyEngine';
import { FoodColoringService } from '@/lib/products/FoodColoringService';
import { resolveUserLanguage } from '@/lib/api/serverLanguage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, userId, locationContext, imageUrl, imageBase64 } = body;

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json({ error: 'Valid barcode string required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Client IP for market localization
    const clientIp =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      '';

    // 1. Fetch User settings & onboarding context
    const [{ data: userSettings }, { data: onboarding }, { data: profile }] = await Promise.all([
      supabase.from('user_settings').select('language, country_code, currency, is_language_auto').eq('user_id', userId).maybeSingle(),
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
    ]);

    const lang = await resolveUserLanguage({
      userId,
      requestLanguage: body.language,
      locationContext,
      supabase
    });

    const country = userSettings?.country_code || locationContext?.country_code || locationContext?.country || 'US';

    const mergedProfile = {
      ...(onboarding || {}),
      ...(body.profileContext || {}),
      allergies:
        body.profileContext?.allergies ||
        (profile as any)?.allergies ||
        onboarding?.allergies ||
        [],
      goal:
        body.profileContext?.goal ||
        onboarding?.goal ||
        (profile as any)?.goal ||
        'maintain a healthy lifestyle',
      daily_calorie_goal:
        Number(
          body.profileContext?.daily_calorie_goal ||
          onboarding?.daily_calorie_goal ||
          (profile as any)?.daily_calorie_goal ||
          2000
        )
    };

    // 2. Strict Gateway Decision - No AI hallucination of unknown barcodes
    const packageImage = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl;
    const decision = await ScannerDecisionEngine.processScan(barcode, userId, country, clientIp, packageImage);

    if (decision.status === 'PRODUCT_NOT_FOUND') {
      const notFoundMsgs: Record<string, string> = {
        en: 'Unable to identify product in database. You can report this product to add it.',
        id: 'Tidak dapat mengidentifikasi produk di database. Anda dapat melaporkan produk ini untuk menambahkannya.',
        ar: 'تعذر التعرف على المنتج في قاعدة البيانات. يمكنك الإبلاغ عن هذا المنتج لإضافته.',
        ur: 'ڈیٹا بیس میں مصنوعات کی شناخت کرنے میں ناکام۔ آپ اسے شامل کرنے کے لیے رپورٹ کر سکتے ہیں۔',
        es: 'No se puede identificar el producto en la base de datos. Puede reportar este producto para agregarlo.',
        fr: "Impossible d'identifier le produit dans la base de données. Vous pouvez le signaler pour l'ajouter.",
        de: 'Produkt konnte nicht in der Datenbank identifiziert werden. Sie können dieses Produkt melden, um es hinzuzufügen.',
        tr: 'Ürün veritabanında tanımlanamadı. Eklemek için bu ürünü bildirebilirsiniz.'
      };
      const notFoundNames: Record<string, string> = {
        en: 'Product Not Found',
        id: 'Produk Tidak Ditemukan',
        ar: 'المنتج غير موجود',
        ur: 'پروڈکٹ نہیں ملا',
        es: 'Producto no encontrado',
        fr: 'Produit non trouvé',
        de: 'Produkt nicht gefunden'
      };
      return NextResponse.json({
        found: false,
        barcode,
        type: 'food',
        name: notFoundNames[lang] || notFoundNames['en'],
        description: notFoundMsgs[lang] || notFoundMsgs['en'],
        is_compliant: undefined,
        needs_crowdsourcing: true
      });
    }

    // 3. BOYCOTT GATE: If product falls under boycott criteria, STOP IMMEDIATELY
    if (decision.status === 'FLAGGED') {
      const b = decision.boycottDetails;
      const resolvedParent = b.parentCompany || b.companyName || decision.product.brand || 'Flagged Parent Entity';
      const resolvedBrand = decision.product.brand || b.companyName || decision.product.name;
      const relationshipLabel = b.parentCompany
        ? `Parent company (${b.parentCompany}) has documented ties.`
        : `Direct campaign target (${resolvedParent}).`;

      return NextResponse.json({
        found: true,
        barcode,
        type: 'food',
        name: decision.product.name,
        brand: resolvedBrand,
        manufacturer: resolvedParent,
        image_url: decision.product.image,
        category: decision.product.category,
        serving_size: decision.product.serving_size,
        is_compliant: false,
        status: 'FLAGGED',
        boycott: {
          flagged: true,
          campaignName: b.campaignName || 'Ethical Responsibility Campaign',
          companyName: b.companyName || decision.product.brand || decision.product.name,
          parentCompany: resolvedParent,
          relationshipType: b.relationshipType || 'parent',
          reason: b.reason || `Parent company (${resolvedParent}) has documented commercial or political ties under active campaign review.`,
          sourceUrl: b.sourceUrl || 'https://bdsmovement.net',
          verifiedAt: b.verifiedAt
        },
        political_warning: `⚠️ ETHICAL RESPONSIBILITY ALERT — Parent Company: ${resolvedParent}. ${b.reason || 'Flagged under active boycott campaign.'}`,
        description: `${decision.product.name} (Brand: ${resolvedBrand} → Parent: ${resolvedParent}) has been flagged by active corporate responsibility campaigns. ${relationshipLabel} Normal purchase analysis is suspended at this safety gate.`,
        needs_crowdsourcing: false
      });
    }

    // 4. APPROVED GATE: Product is ethically clear -> Proceed to Deterministic Facts, Safety, Coloring, Advisor, and Pricing
    const p = decision.product;
    const n: any = decision.nutrition || {};

    // Authentic calories & macros strictly from verified packaging nutriments (or 0 for plain water)
    const calcCalories = n.calories !== undefined && n.calories !== null ? n.calories : null;
    const calcProtein = n.protein !== undefined && n.protein !== null ? n.protein : null;
    const calcCarbs = n.carbohydrates !== undefined && n.carbohydrates !== null ? n.carbohydrates : null;
    const calcFat = n.fat !== undefined && n.fat !== null ? n.fat : null;
    const calcSatFat = n.saturated_fat !== undefined && n.saturated_fat !== null ? n.saturated_fat : null;
    const calcSugar = n.sugar !== undefined && n.sugar !== null ? n.sugar : null;
    const calcFiber = n.fiber !== undefined && n.fiber !== null ? n.fiber : null;
    const calcSodium = n.sodium_mg !== undefined && n.sodium_mg !== null ? n.sodium_mg : null;

    // 5. FOOD COLORING & ADDITIVES DETECTION (Deterministic, on real declared ingredients/additives only)
    const coloring = p.coloring || FoodColoringService.analyze(p.ingredients, p.additives);
    p.coloring = coloring;

    // 6. DETERMINISTIC ALLERGY, MEDICAL & GOAL FIT EVALUATION
    const userSafetyProfile = await SafetyEngine.getUserSafetyProfile(userId, supabase, lang);
    if (Array.isArray(mergedProfile.allergies) && mergedProfile.allergies.length > 0 && userSafetyProfile.allergies.length === 0) {
      userSafetyProfile.allergies = mergedProfile.allergies.map((a: any) => String(a).toLowerCase().trim()).filter(Boolean);
    }
    if (mergedProfile.goal && (!userSafetyProfile.userGoal || userSafetyProfile.userGoal === 'maintain a healthy lifestyle')) {
      userSafetyProfile.userGoal = String(mergedProfile.goal);
    }
    if (mergedProfile.daily_calorie_goal) {
      userSafetyProfile.dailyCalorieGoal = Number(mergedProfile.daily_calorie_goal);
    }

    const safetyEval = SafetyEngine.evaluateProductSafety(p, n, userSafetyProfile);

    // 7. GROUNDED ADVISOR NARRATIVE (Receives verified product, nutrition, coloring, and safetyEval)
    const advice = await ProductAdvisor.analyze(
      p,
      n,
      decision.pricing,
      mergedProfile,
      lang,
      safetyEval
    );

    let finalHealthStatus: 'GOOD' | 'MODERATE' | 'POOR' = safetyEval.verdict || advice?.healthStatus || 'GOOD';
    let finalRecommendation = advice?.recommendation || ProductAdvisor.buildDeterministicRecommendation(p, n, mergedProfile, safetyEval);
    const finalIsCompliant = true; // Ethically compliant (passed boycott gate)

    if (!safetyEval.isSafe) {
      finalHealthStatus = 'POOR';
      if (safetyEval.warningMessage && !finalRecommendation.includes(safetyEval.warningMessage)) {
        finalRecommendation = `${safetyEval.warningMessage}\n\n${finalRecommendation}`;
      }
    } else if (safetyEval.goalFit && safetyEval.goalFit.status !== 'GOOD') {
      finalHealthStatus = safetyEval.goalFit.status;
    }

    // 8. HONEST LOCALIZED PRICING (Cache -> Verified Search -> else needs_user_price)
    let formattedPrice: string | null = null;
    let numericPrice: number | null = null;
    let priceMetadata: any = null;
    const curr = decision.pricing?.currency || userSettings?.currency || (country === 'ID' ? 'IDR' : 'USD');

    if (decision.pricing && typeof decision.pricing.price === 'number' && decision.pricing.price > 0) {
      numericPrice = decision.pricing.price;
      const formattedNum = numericPrice.toLocaleString();
      formattedPrice =
        curr === 'IDR' ? `Rp ${formattedNum}` : curr === 'USD' ? `$${formattedNum}` : `${curr} ${formattedNum}`;
      priceMetadata = {
        amount: decision.pricing.price,
        currency: curr,
        status: decision.pricing.status || 'verified',
        source: decision.pricing.source || 'Verified Local Price Cache',
        retrievedAt: decision.pricing.retrievedAt,
        retailer: decision.pricing.retailer || 'Local Market',
        needs_user_price: decision.pricing.needs_user_price ?? (decision.pricing.status !== 'verified'),
        confidence: decision.pricing.confidence ?? 0.9
      };
    } else {
      priceMetadata = {
        amount: null,
        currency: curr,
        status: 'needs_user_price',
        source: decision.pricing?.source || 'No verified shelf price in local registry — enter shelf price',
        retrievedAt: decision.pricing?.retrievedAt || new Date().toISOString(),
        retailer: decision.pricing?.retailer || 'Local Shelf Price Required',
        needs_user_price: true,
        confidence: 0.0,
        reference_estimate: decision.pricing?.reference_estimate || null
      };
    }

    const hasRealIngredients =
      typeof p.ingredients === 'string' &&
      p.ingredients.trim().length > 0 &&
      !p.ingredients.toLowerCase().includes('not listed in database');

    return NextResponse.json({
      found: true,
      barcode,
      type: 'food',
      is_verified: calcCalories !== null && hasRealIngredients,
      name: p.name,
      generic_name: p.generic_name,
      brand: p.brand || null,
      manufacturer: p.manufacturer || p.brand || null,
      origin_country: p.origin_country || null,
      category: p.category || null,
      size: p.size || null,
      serving_size: p.serving_size || (n.basis === '100g' ? '100g' : null),
      image_url: p.image,
      nutriscore_grade: p.nutriscore_grade || null,
      nova_group: p.nova_group || null,

      // Ingredients & Food Coloring (strictly real or null/unknown)
      ingredients: hasRealIngredients ? p.ingredients : null,
      ingredients_status: hasRealIngredients ? (p.ingredients_status || 'verified') : 'unavailable',
      allergens: p.allergens || [],
      traces: p.traces || [],
      coloring,

      // Ethical & Safety Status
      is_compliant: finalIsCompliant,
      status: 'APPROVED',
      political_warning: 'Ethically cleared.',
      is_safe_for_profile: safetyEval.isSafe,
      safety_warnings: [...(safetyEval.allergyWarnings || []), ...(safetyEval.medicalWarnings || [])],
      allergy_warnings: safetyEval.allergyWarnings || [],
      medical_warnings: safetyEval.medicalWarnings || [],
      matched_allergens: safetyEval.matchedAllergens || [],
      goal_fit: safetyEval.goalFit || null,

      // Authoritative Packaging Nutrition (null when unavailable, never Pending/fake 0)
      calories: calcCalories,
      protein: calcProtein,
      carbs: calcCarbs,
      fat: calcFat,
      saturated_fat: calcSatFat,
      sugar: calcSugar,
      fiber: calcFiber,
      sodium_mg: calcSodium,
      vitamins: n.vitamins ?? [],
      minerals: n.minerals ?? [],
      serving_basis: n.basis || '100g',
      nutrition_status: calcCalories !== null ? (n.status || 'verified') : 'unavailable',

      // Grounded Narrative Advice
      description: advice?.description || ProductAdvisor.buildDeterministicDescription(p, n),
      vitamins_and_nutrition: advice?.vitamins_and_nutrition || ProductAdvisor.buildDeterministicNutritionParagraph(p, n),
      recommendation: finalRecommendation,
      healthStatus: finalHealthStatus,
      user_alignment_boolean: finalHealthStatus !== 'POOR' && safetyEval.isSafe,
      is_recommended: finalHealthStatus !== 'POOR' && safetyEval.isSafe,

      // Pricing: verified cache/search or honest needs_user_price
      price: numericPrice,
      estimated_price: formattedPrice,
      price_metadata: priceMetadata,

      needs_crowdsourcing: calcCalories === null || !hasRealIngredients
    });
  } catch (error: any) {
    console.error('[analyze-product-barcode] Error:', error.message || error);
    return NextResponse.json(
      {
        found: false,
        type: 'food',
        name: 'Product Not Found',
        description: 'Error identifying product: ' + (error.message || 'Lookup failed'),
        needs_crowdsourcing: true
      },
      { status: 500 }
    );
  }
}
