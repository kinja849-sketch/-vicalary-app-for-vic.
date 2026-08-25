import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { userId, targetDate } = await req.json()
    const supabase = createServerSupabaseClient()
    
    // If targetDate is provided (e.g., from a midnight cron asking for yesterday), use it. Otherwise use today.
    const queryDate = targetDate || new Date().toISOString().split('T')[0]

    const [{ data: progress }, { data: mealHistory }, { data: onboarding }] = await Promise.all([
      supabase.from('daily_progress').select('*').eq('user_id', userId).eq('progress_date', queryDate).maybeSingle(),
      supabase.from('food_analysis_history').select('*, food_items(*)').eq('user_id', userId).gte('analyzed_at', queryDate),
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
    ])

    if (!progress) {
      return NextResponse.json({ message: 'No progress found for today' })
    }

    // Check if summary already exists for this specific date to avoid duplicates
    const { data: existingSummary } = await supabase
      .from('messages')
      .select('id')
      .contains('metadata', { type: 'daily_summary', date: queryDate })
      .limit(1)
      .maybeSingle();

    if (existingSummary) {
      return NextResponse.json({ message: 'Summary already sent for this date', alreadySent: true })
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
    const prompt = `You are a helpful and professional Health Coach for the VicAlary App.
Generate a concise, encouraging end-of-day summary for the user based on their activities on ${queryDate}.
Stats: ${progress.calories_consumed}/${progress.calories_goal} kcal.
Meals Logged: ${mealHistory?.length ? mealHistory.map((m: any) => m.food_items?.name).join(', ') : 'None'}.
User Goal: ${onboarding?.goal || 'General Wellness'}.

Instructions:
1. Praise their progress.
2. If they were over/under budget or calories, offer a supportive tip.
3. Keep it to 3-4 sentences.
4. Tone: Friendly, scientific, and encouraging.`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
    })

    const aiData = await aiRes.json()
    let summary = aiData.choices[0].message.content

    // Strip markdown symbols to prevent them from showing in the UI
    summary = summary.replace(/[*#]/g, '');

    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('conversation_type', 'ai')
      .limit(1)

    if (convs && convs.length > 0) {
      await supabase.from('messages').insert({
        conversation_id: convs[0].id,
        sender_id: '00000000-0000-0000-0000-000000000001',
        message_type: 'system',
        content: `🌙 DAILY SUMMARY (${queryDate}):\n\n${summary}`,
        metadata: { type: 'daily_summary', date: queryDate, stats: progress },
      })
    }

    return NextResponse.json({ summary })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
