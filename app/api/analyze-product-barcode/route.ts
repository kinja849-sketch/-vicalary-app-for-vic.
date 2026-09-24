import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ScannerDecisionEngine } from '@/lib/scanner/ScannerDecisionEngine'
import { ProductAdvisor } from '@/lib/ai/ProductAdvisor'

export async function POST(req: NextRequest) {
  try {
    const { barcode, userId, locationContext } = await req.json()
    const supabase = createServerSupabaseClient()

    // 1. Fetch User settings
    const [{ data: userSettings }, { data: onboarding }] = await Promise.all([
      supabase.from('user_settings').select('language').eq('user_id', userId).maybeSingle(),
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle()
    ]);
    const lang = userSettings?.language || locationContext?.languages?.[0] || 'en';
    const country = locationContext?.country_code || 'US';

    // 2. Strict Gateway
    const decision = await ScannerDecisionEngine.processScan(barcode, userId, country);

    if (decision.status === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({
        found: false,
        barcode,
        type: 'food',
        name: 'Product Not Found',
        description: 'Error identifying product. Barcode not found in authoritative database.',
        is_compliant: undefined,
        needs_crowdsourcing: true
      })
    }

    if (decision.status === 'FLAGGED') {
      return NextResponse.json({
        found: true,
        barcode,
        type: 'food',
        name: decision.product.name,
        brand: decision.product.brand,
        image_url: decision.product.image,
        is_compliant: false,
        political_warning: ` ETHICAL ALERT: ${decision.boycottDetails.reason} (Source: ${decision.boycottDetails.sourceUrl || 'Campaign'})`,
        needs_crowdsourcing: false
      })
    }

    // 3. Approved -> Get AI recommendation
    const advice = await ProductAdvisor.analyze(
        decision.product, 
        decision.nutrition, 
        decision.pricing, 
        onboarding, 
        lang
    );

    // 4. Return clean data
    return NextResponse.json({
      found: true,
      barcode,
      type: 'food',
      is_verified: true,
      name: decision.product.name,
      brand: decision.product.brand,
      image_url: decision.product.image,
      is_compliant: true,
      political_warning: 'Ethically clear.',
      
      // Nutrition explicitly null if unknown
      calories: (decision.nutrition as any)?.calories ?? null,
      protein: (decision.nutrition as any)?.protein ?? null,
      carbs: (decision.nutrition as any)?.carbohydrates ?? null,
      fat: (decision.nutrition as any)?.fat ?? null,
      sugar: (decision.nutrition as any)?.sugar ?? null,
      fiber: (decision.nutrition as any)?.fiber ?? null,
      
      // AI advice
      description: advice?.description || "Verified product.",
      recommendation: advice?.recommendation || "Safe for consumption.",
      vitamins_and_nutrition: advice?.vitamins_and_nutrition || "Data unavailable.",
      healthStatus: advice?.healthStatus || "GOOD",
      
      // Pricing
      estimated_price: decision.pricing ? `${decision.pricing.currency} ${decision.pricing.price}` : null,
      
      needs_crowdsourcing: false
    })

  } catch (error: any) {
    console.error('analyze-product error:', error.message)
    return NextResponse.json({ 
        found: false,
        type: 'food',
        name: 'Product Not Found',
        description: 'Error identifying product. ' + error.message,
        needs_crowdsourcing: true
    })
  }
}
