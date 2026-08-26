import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message = '', conversation_type = 'ai' } = await req.json()

    // Fast rule-based classification
    const text = message.toLowerCase().trim()
    let intent = 'general_chat'
    let requires_user_profile = true
    let requires_meal_plan = false
    let requires_budget_snapshot = false
    let requires_affiliation_lookup = false
    let requires_external_search = false
    let format = 'conversation'

    if (/\b(boycott|israel|ownership|parent company|who owns|affiliated with|subsidiary|brand of|bds)\b/i.test(text)) {
      intent = 'affiliation_lookup'
      requires_user_profile = false
      requires_affiliation_lookup = true
    } else if (/\b(budget|spending|spent|bank balance|money|expenses|afford|cost of food)\b/i.test(text)) {
      intent = 'budget_status'
      requires_budget_snapshot = true
    } else if (/\b(medicine|medication|pill|dose|dosage|drug|prescription|side effect)\b/i.test(text)) {
      intent = 'medicine_inquiry'
    } else if (/\b(meal|recipe|cook|dinner|lunch|breakfast|snack|eat|food|calories|macros|protein|diet|nutrition)\b/i.test(text)) {
      intent = 'meal_question'
      requires_meal_plan = true
    } else if (/\b(barcode|product|scan|nutrition label)\b/i.test(text)) {
      intent = 'product_analysis'
      requires_affiliation_lookup = true
    } else if (/\b(prayer|quran|hadith|dua|namaz|salat|islamic|verse|fasting|ramadan|spiritual)\b/i.test(text)) {
      intent = 'spiritual_guidance'
    } else if (/\b(nearest|nearby|supermarket|grocery store|restaurant|where to buy)\b/i.test(text)) {
      intent = 'location_inquiry'
      requires_user_profile = false
      requires_external_search = true
    }

    return new Response(
      JSON.stringify({
        intent,
        confidence: 0.95,
        requires_user_profile,
        requires_meal_plan,
        requires_budget_snapshot,
        requires_affiliation_lookup,
        requires_external_search,
        format
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
