import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { userId, year, month } = await req.json()
    const supabase = createServerSupabaseClient()

    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0).toISOString()

    const [progressRes, budgetRes, profileRes, settingsRes] = await Promise.all([
      supabase.from('daily_progress').select('*').eq('user_id', userId).gte('progress_date', startDate).lte('progress_date', endDate),
      supabase.from('budget_transactions').select('*').eq('user_id', userId).gte('created_at', startDate).lte('created_at', endDate),
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('user_settings').select('language').eq('user_id', userId).maybeSingle(),
    ])
    
    const explicitUserLang = settingsRes?.data?.language || 'en';

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
    if (!apiKey) throw new Error('NEXT_PUBLIC_OPENAI_API_KEY not configured.')

    const prompt = `Perform a high-level longitudinal health and financial analysis for the user.
Month: ${month}/${year}
User Goals: ${profileRes.data?.full_name}'s daily targets.
Daily Metrics (30 days): ${JSON.stringify(progressRes.data)}
Spending Data: ${JSON.stringify(budgetRes.data)}

TASKS:
1. TREND ANALYSIS: Evaluate calorie consistency and goal adherence %.
2. FINANCIAL EFFICIENCY: Analyze spending patterns vs. nutritional ROI.
3. PREDICTIVE ADVICE: What should they change next month to hit their goals?

STRICT JSON OUTPUT:
{
    "summary": "Deep analytical reflection",
    "insights": ["Nutritional trend", "Financial efficiency", "Behavioral pattern"],
    "adherencePercentage": number,
    "spendingEfficiency": "EXCELLENT" | "GOOD" | "POOR",
    "tips": ["Concrete tip 1", "Concrete tip 2"],
    "trend": "improving" | "maintaining" | "struggling"
}

LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('\${explicitUserLang}'). Do NOT reply in English unless their language code is 'en'.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
      }),
    })

    if (!response.ok) throw new Error(`OpenAI failed: ${await response.text()}`)
    const data = await response.json()
    const parsed = JSON.parse(data.choices[0]?.message?.content || '{}')

    supabase.from('monthly_reports').upsert({ user_id: userId, report_year: year, report_month: month, ...parsed }).then()

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
