import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ScannerDecisionEngine } from '@/lib/scanner/ScannerDecisionEngine';
import { ProductAdvisor } from '@/lib/ai/ProductAdvisor';
import { SafetyEngine } from '@/lib/services/SafetyEngine';

export async function POST(req: NextRequest) {
  try {
    const { barcode, userId, locationContext } = await req.json();

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json({ error: 'Valid barcode string required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // 1. Fetch User settings & onboarding context
    const [{ data: userSettings }, { data: onboarding }, { data: profile }] = await Promise.all([
      supabase.from('user_settings').select('language').eq('user_id', userId).maybeSingle(),
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_profiles').select('allergies').eq('id', userId).maybeSingle()
    ]);

    const lang = userSettings?.language || locationContext?.languages?.[0] || 'en';
    const country = locationContext?.country_code || locationContext?.country || 'US';

    const mergedProfile = {
      ...(onboarding || {}),
      allergies: (profile as any)?.allergies || onboarding?.allergies || []
    };

    // 2. Strict Gateway Decision
    const decision = await ScannerDecisionEngine.processScan(barcode, userId, country);

    if (decision.status === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({
        found: false,
        barcode,
        type: 'food',
        name: 'Product Not Found',
        description: 'Unable to identify product. Barcode was not found in the authoritative product catalog.',
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

    // Format localized price if credible provider returned a verified record
    let formattedPrice: string | null = null;
    let numericPrice: number | null = null;
    let priceMetadata: any = null;

    if (decision.pricing && decision.pricing.price > 0) {
      numericPrice = decision.pricing.price;
      formattedPrice = `${decision.pricing.currency} ${decision.pricing.price.toLocaleString()}`;
      priceMetadata = {
        amount: decision.pricing.price,
        currency: decision.pricing.currency,
        source: decision.pricing.source,
        retrievedAt: decision.pricing.retrievedAt,
        retailer: decision.pricing.retailer
      };
    }

    return NextResponse.json({
      found: true,
      barcode,
      type: 'food',
      is_verified: true,
      name: p.name,
      brand: p.brand,
      category: p.category,
      serving_size: p.serving_size,
      image_url: p.image,
      ingredients: p.ingredients,
      allergens: p.allergens,
      is_compliant: finalIsCompliant,
      status: 'APPROVED',
      political_warning: 'Ethically cleared.',
      
      // Authoritative nutrition from Open Food Facts
      calories: n.calories ?? null,
      protein: n.protein ?? null,
      carbs: n.carbohydrates ?? null,
      fat: n.fat ?? null,
      sugar: n.sugar ?? null,
      fiber: n.fiber ?? null,
      sodium_mg: n.sodium_mg ?? null,
      vitamins: n.vitamins ?? [],
      minerals: n.minerals ?? [],
      serving_basis: n.basis || 'serving',
      
      // AI Narrative Advice
      description: advice?.description || `${p.name} from ${p.brand || 'verified brand'}.`,
      vitamins_and_nutrition: advice?.vitamins_and_nutrition || "Nutrition details based on packaging.",
      recommendation: finalRecommendation,
      healthStatus: finalHealthStatus,
      user_alignment_boolean: finalHealthStatus !== 'POOR',
      is_recommended: finalHealthStatus !== 'POOR',
      
      // Pricing: verified or null (UI displays "Price unavailable")
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
