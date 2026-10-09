import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ScannerDecisionEngine } from '@/lib/scanner/ScannerDecisionEngine';
import { ProductAdvisor } from '@/lib/ai/ProductAdvisor';
import { SafetyEngine } from '@/lib/services/SafetyEngine';
import { FoodColoringService } from '@/lib/products/FoodColoringService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, userId, locationContext, language } = body;

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json({ error: 'Valid barcode string required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Client IP for market localization
    const clientIp = req.headers.get('x-real-ip') || 
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
      req.headers.get('cf-connecting-ip') || 
      '';

    // 1. Fetch User settings & onboarding context
    const [{ data: userSettings }, { data: onboarding }, { data: profile }] = await Promise.all([
      supabase.from('user_settings').select('language, country_code, currency, is_language_auto').eq('user_id', userId).maybeSingle(),
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_profiles').select('allergies').eq('id', userId).maybeSingle()
    ]);

    // Strict Language Hierarchy:
    // 1. Explicitly chosen language from client request body
    // 2. User settings language (manual override)
    // 3. Location-derived language from IP
    // 4. Default 'en'
    const lang = body.language || 
      (userSettings?.is_language_auto === false && userSettings?.language ? userSettings.language : null) ||
      userSettings?.language || 
      locationContext?.language || 
      locationContext?.languages?.[0] || 
      'en';

    const country = userSettings?.country_code || locationContext?.country_code || locationContext?.country || 'US';

    const mergedProfile = {
      ...(onboarding || {}),
      allergies: (profile as any)?.allergies || onboarding?.allergies || []
    };

    // 2. Strict Gateway Decision - No AI hallucination of unknown barcodes
    const decision = await ScannerDecisionEngine.processScan(barcode, userId, country, clientIp);

    if (decision.status === 'PRODUCT_NOT_FOUND') {
      const notFoundMsgs: Record<string, string> = {
        en: 'Unable to identify product in database. You can report this product to add it.',
        id: 'Tidak dapat mengidentifikasi produk di database. Anda dapat melaporkan produk ini untuk menambahkannya.',
        ar: 'تعذر التعرف على المنتج في قاعدة البيانات. يمكنك الإبلاغ عن هذا المنتج لإضافته.',
        es: 'No se puede identificar el producto en la base de datos. Puede reportar este producto para agregarlo.',
        fr: 'Impossible d\'identifier le produit dans la base de données. Vous pouvez le signaler pour l\'ajouter.'
      };
      return NextResponse.json({
        found: false,
        barcode,
        type: 'food',
        name: lang === 'id' ? 'Produk Tidak Ditemukan' : 'Product Not Found',
        description: notFoundMsgs[lang] || notFoundMsgs['en'],
        is_compliant: undefined,
        needs_crowdsourcing: true
      });
    }

    // 3. BOYCOTT GATE: If product falls under boycott criteria, STOP IMMEDIATELY
    if (decision.status === 'FLAGGED') {
      const b = decision.boycottDetails;
      const relationshipLabel = b.parentCompany 
        ? `Parent company (${b.parentCompany}) has documented ties.`
        : `Direct campaign target.`;

      return NextResponse.json({
        found: true,
        barcode,
        type: 'food',
        name: decision.product.name,
        brand: decision.product.brand,
        image_url: decision.product.image,
        category: decision.product.category,
        serving_size: decision.product.serving_size,
        is_compliant: false,
        status: 'FLAGGED',
        boycott: {
          flagged: true,
          campaignName: b.campaignName || 'Ethical Responsibility Campaign',
          companyName: b.companyName || decision.product.brand,
          parentCompany: b.parentCompany,
          relationshipType: b.relationshipType,
          reason: b.reason || 'Documented commercial or political ties under active campaign review.',
          sourceUrl: b.sourceUrl || 'https://bdsmovement.net',
          verifiedAt: b.verifiedAt
        },
        political_warning: `⚠️ ETHICAL RESPONSIBILITY ALERT: ${b.reason || 'Flagged under active boycott campaign.'}`,
        description: `${decision.product.name} (Brand: ${decision.product.brand || 'Unknown'}) has been flagged by active corporate responsibility campaigns. ${relationshipLabel} Normal purchase analysis is suspended at this safety gate.`,
        needs_crowdsourcing: false
      });
    }

    // 4. APPROVED GATE: Product is ethically clear -> Proceed to Nutrition, Onboarding Alignment, and Pricing
    const p = decision.product;
    const n = decision.nutrition || {};

    const advice = await ProductAdvisor.analyze(
      p, 
      n, 
      decision.pricing, 
      mergedProfile, 
      lang
    );

    const userSafetyProfile = await SafetyEngine.getUserSafetyProfile(userId, supabase, lang);
    const safetyEval = SafetyEngine.evaluateProductSafety(p, n, userSafetyProfile);

    let finalHealthStatus = advice?.healthStatus || "GOOD";
    let finalRecommendation = advice?.recommendation || "Safe for consumption according to profile context.";
    let finalIsCompliant = true;

    if (!safetyEval.isSafe) {
      finalHealthStatus = 'POOR';
      finalIsCompliant = false;
      if (safetyEval.warningMessage) {
        finalRecommendation = `${safetyEval.warningMessage}\n\n${finalRecommendation}`;
      }
    }

    // 5. FOOD COLORING & ADDITIVES DETECTION (Deterministic, Zero Hallucination)
    const coloring = FoodColoringService.analyze(p.ingredients, p.additives);

    // 6. Format localized price according to authentic price provider result
    let formattedPrice: string | null = null;
    let numericPrice: number | null = null;
    let priceMetadata: any = null;
    const curr = decision.pricing?.currency || (country === 'ID' ? 'IDR' : 'USD');

    if (decision.pricing && decision.pricing.price > 0) {
      numericPrice = decision.pricing.price;
      const formattedNum = numericPrice.toLocaleString();
      formattedPrice = curr === 'IDR' ? `Rp ${formattedNum}` : curr === 'USD' ? `$${formattedNum}` : `${curr} ${formattedNum}`;
      priceMetadata = {
        amount: decision.pricing.price,
        currency: curr,
        source: decision.pricing.source || 'Local Market Cache',
        retrievedAt: decision.pricing.retrievedAt,
        retailer: decision.pricing.retailer || 'Local Market',
        confidence: decision.pricing.confidence ?? 0.8
      };
    } else {
      priceMetadata = {
        amount: null,
        currency: curr,
        source: 'Unverified (Enter shelf price)',
        needs_user_price: true,
        confidence: 0.0
      };
    }

    // Authentic calories: strictly from packaging nutriments or known 0-cal items (e.g. water)
    let calcCalories = n.calories ?? null;
    let calcProtein = n.protein ?? null;
    let calcCarbs = n.carbohydrates ?? null;
    let calcFat = n.fat ?? null;

    const lowerName = (p.name || '').toLowerCase();
    if (calcCalories === null && (lowerName.includes('water') || lowerName.includes('mineral water') || lowerName.includes('air mineral'))) {
      calcCalories = 0; calcProtein = 0; calcCarbs = 0; calcFat = 0;
    }

    return NextResponse.json({
      found: true,
      barcode,
      type: 'food',
      is_verified: n.calories !== undefined,
      name: p.name,
      brand: p.brand,
      category: p.category,
      serving_size: p.serving_size,
      image_url: p.image,
      ingredients: p.ingredients || 'Ingredients not declared on packaging.',
      allergens: p.allergens,
      coloring,
      is_compliant: finalIsCompliant,
      status: 'APPROVED',
      political_warning: 'Ethically cleared.',
      
      // Authoritative/Enriched nutrition
      calories: calcCalories,
      protein: calcProtein,
      carbs: calcCarbs,
      fat: calcFat,
      sugar: n.sugar ?? null,
      fiber: n.fiber ?? null,
      sodium_mg: n.sodium_mg ?? null,
      vitamins: n.vitamins ?? [],
      minerals: n.minerals ?? [],
      serving_basis: n.basis || 'serving',
      
      // AI Narrative Advice
      description: advice?.description || `${p.name} from ${p.brand || 'verified brand'}.`,
      vitamins_and_nutrition: advice?.vitamins_and_nutrition || "Nutrition details based on product packaging.",
      recommendation: finalRecommendation,
      healthStatus: finalHealthStatus,
      user_alignment_boolean: finalHealthStatus !== 'POOR',
      is_recommended: finalHealthStatus !== 'POOR',
      
      // Pricing: authentic localized price
      price: numericPrice,
      estimated_price: formattedPrice,
      price_metadata: priceMetadata,
      
      needs_crowdsourcing: false
    });

  } catch (error: any) {
    console.error('[analyze-product-barcode] Error:', error.message || error);
    return NextResponse.json({ 
      found: false,
      type: 'food',
      name: 'Product Not Found',
      description: 'Error identifying product: ' + (error.message || 'Lookup failed'),
      needs_crowdsourcing: true
    }, { status: 500 });
  }
}
