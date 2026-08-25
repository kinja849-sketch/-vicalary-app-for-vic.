import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) throw new Error('User ID is required')

    const supabase = createServerSupabaseClient()

    const [profileRes, onboardingRes, settingsRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
    if (!apiKey) throw new Error('NEXT_PUBLIC_OPENAI_API_KEY not set')

    // Geolocation Mapping
    const countryCode = settingsRes.data?.country_code || 'US';
    const countryToQueryMap: Record<string, string> = {
        'ID': 'Indonesian', 'MY': 'Malaysian', 'SG': 'Singaporean', 'TH': 'Thai', 'VN': 'Vietnamese',
        'US': 'American', 'GB': 'British', 'IT': 'Italian', 'FR': 'French', 'ES': 'Spanish',
        'MX': 'Mexican', 'IN': 'Indian', 'CN': 'Chinese', 'JP': 'Japanese', 'KR': 'Korean',
        'GR': 'Greek', 'TR': 'Turkish', 'DE': 'German', 'BR': 'Brazilian', 'AR': 'Argentinian'
    };
    const regionalQuery = countryToQueryMap[countryCode] || 'Healthy';

    const prompt = `You are a PhD Clinical Nutritionist and Michelin-star healthy chef.
User: ${profileRes.data?.full_name || 'User'}
Goal: ${onboardingRes.data?.goal || 'General Health'}
Lifestyle: ${onboardingRes.data?.dietary_lifestyle || 'Balanced'}
Region Context: ${regionalQuery} (${countryCode})

CRITICAL LANGUAGE REQUIREMENT: The user's preferred language code is '${settingsRes.data?.language || 'en'}' and their local currency is ${settingsRes.data?.currency || 'USD'}. ALL of your output strings (name, description, clinical_justification) MUST be written natively in this language ('${settingsRes.data?.language || 'en'}').

TASKS:
1. Suggest 3 elite, personalized recipes that specifically target the user's goal and perfectly match their local cuisine (${regionalQuery}).
2. For each recipe, provide a "Clinical Justification" (2-3 sentences) explaining the biochemical advantage of the chosen ingredients.
3. Include precise macro counts.

STRICT JSON OUTPUT:
{
  "suggestions": [
    {
      "name": "string",
      "description": "string",
      "clinical_justification": "string",
      "calories": number,
      "carbs": number,
      "protein": number,
      "fat": number,
      "prepTime": "string",
      "difficulty": "Easy" | "Medium" | "Hard"
    }
  ]
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error(`OpenAI error: ${await response.text()}`)
    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('personalized-recommendations error:', error)
    return NextResponse.json({ error: error.message }, { status: 200 })
  }
}
