import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback'
import { format } from 'date-fns'

const COACH_ID = '00000000-0000-0000-0000-000000000001'

export interface DailySummaryResult {
  success: boolean
  alreadySent?: boolean
  date: string
  summary?: string
  conversationId?: string
  hasActivity?: boolean
  error?: string
}

export async function generateDailySummaryForUser(
  targetUserId: string,
  targetDate?: string,
  force: boolean = false
): Promise<DailySummaryResult> {
  const supabase = createAdminSupabaseClient()

  // 1. Fetch user profile, settings, and onboarding preferences
  const [
    { data: profile },
    { data: settings },
    { data: onboarding }
  ] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', targetUserId).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', targetUserId).maybeSingle(),
    supabase.from('onboarding_responses').select('*').eq('user_id', targetUserId).maybeSingle(),
  ])

  const userTz = settings?.timezone || 'UTC'
  const userLang = settings?.language || 'en'

  // 2. Determine target query date in user's timezone
  let queryDate: string
  if (targetDate) {
    queryDate = targetDate
  } else {
    // Local midnight summary defaults to yesterday (the day that just concluded)
    const nowInUserTz = new Date(new Date().toLocaleString('en-US', { timeZone: userTz }))
    const yesterday = new Date(nowInUserTz)
    yesterday.setDate(yesterday.getDate() - 1)
    queryDate = format(yesterday, 'yyyy-MM-dd')
  }

  // 3. Resolve the user's authentic AI Coach conversation
  let coachConvId: string | null = null
  const { data: convParts } = await (supabase
    .from('conversation_participants') as any)
    .select('conversation_id, conversations!inner(id, conversation_type)')
    .eq('user_id', targetUserId)
    .eq('conversations.conversation_type', 'ai')
    .limit(1)

  if (convParts && convParts.length > 0 && convParts[0]?.conversation_id) {
    coachConvId = String(convParts[0].conversation_id)
  } else {
    // Provision an AI Coach conversation for this user if not present
    const { data: newConv, error: createConvErr } = await (supabase
      .from('conversations') as any)
      .insert({
        conversation_type: 'ai',
        name: 'Health Coach',
        avatar_url: '/app logo.png',
        created_by: targetUserId,
      })
      .select('id')
      .single()

    if (createConvErr || !newConv?.id) {
      throw new Error(createConvErr?.message || 'Failed to create Health Coach conversation')
    }

    coachConvId = String(newConv.id)

    await (supabase.from('conversation_participants') as any).insert([
      { conversation_id: coachConvId, user_id: targetUserId },
      { conversation_id: coachConvId, user_id: COACH_ID },
    ])
  }

  // 4. Idempotency Check: Avoid duplicate summary for the same user and date
  const { data: existingSummary } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', coachConvId)
    .contains('metadata', { type: 'daily_summary', date: queryDate })
    .limit(1)
    .maybeSingle()

  if (existingSummary && !force) {
    return {
      success: true,
      alreadySent: true,
      date: queryDate,
      conversationId: coachConvId,
    }
  }

  // 5. Gather rich activity evidence pack for queryDate
  const { data: progress } = await supabase
    .from('daily_progress')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('progress_date', queryDate)
    .maybeSingle()

  const { data: measurements } = await supabase
    .from('progress_measurements')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('measurement_date', queryDate)
    .maybeSingle()

  let mood = ''
  let reflection = ''
  if (measurements?.notes) {
    try {
      const parsedNotes = JSON.parse(measurements.notes)
      mood = parsedNotes.mood || ''
      reflection = parsedNotes.reflection || ''
    } catch {
      reflection = measurements.notes
    }
  }
  if (!mood && (progress?.progress_data as any)?.mood) {
    mood = (progress.progress_data as any).mood
  }
  if (!reflection && (progress?.progress_data as any)?.reflection) {
    reflection = (progress.progress_data as any).reflection
  }

  const { data: mealHistory } = await supabase
    .from('food_analysis_history')
    .select('food_name, calories, meal_type, analysis_type, created_at, local_date, food_items(*)')
    .eq('user_id', targetUserId)
    .or(`local_date.eq.${queryDate},analyzed_at.gte.${queryDate}T00:00:00.000Z`)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: transactions } = await supabase
    .from('budget_transactions')
    .select('amount, description, transaction_date')
    .gte('transaction_date', `${queryDate}T00:00:00.000Z`)
    .lte('transaction_date', `${queryDate}T23:59:59.999Z`)
    .limit(10)

  const { data: coachChats } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', coachConvId)
    .eq('sender_id', targetUserId)
    .gte('created_at', `${queryDate}T00:00:00.000Z`)
    .lte('created_at', `${queryDate}T23:59:59.999Z`)

  const chatCount = coachChats?.length || 0
  const totalSpent = (transactions || []).reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)

  const hasActivity = Boolean(
    (progress && (Number(progress.calories_consumed) > 0 || Number(progress.meals_logged) > 0)) ||
    (mealHistory && mealHistory.length > 0) ||
    measurements?.weight ||
    mood ||
    reflection ||
    totalSpent > 0 ||
    chatCount > 0
  )

  // 6. Formulate AI Prompt based on grounded activity
  const userName = profile?.full_name || 'Friend'
  const goal = onboarding?.goal || profile?.primary_goal || 'General Health & Wellness'
  const calorieGoal = progress?.calories_goal || onboarding?.daily_calorie_goal || 2000
  const calorieConsumed = progress?.calories_consumed || 0
  const mealsLogged = progress?.meals_logged || mealHistory?.length || 0

  let prompt = ''

  if (hasActivity) {
    const mealSummary = mealHistory?.length
      ? mealHistory.map((m: any) => `${m.food_name || m.food_items?.name || 'Meal'} (${m.calories || 0} kcal)`).join(', ')
      : 'Logged via tracker'

    prompt = `You are a supportive, insightful AI Health Coach for ${userName} on the VicCalary platform.
Review their completed day (${queryDate}) based on their verified activity data:
- User Goal: ${goal}
- Calories: ${calorieConsumed} / ${calorieGoal} kcal
- Macros: Protein ${progress?.protein_consumed || 0}g / ${progress?.protein_goal || 50}g, Carbs ${progress?.carbs_consumed || 0}g, Fat ${progress?.fat_consumed || 0}g
- Meals Logged: ${mealsLogged} (${mealSummary})
- Mood & Reflection: Mood: ${mood || 'Not logged'}, Reflection: "${reflection || 'None'}", Weight: ${measurements?.weight ? `${measurements.weight}kg` : 'Not recorded'}
- Spend: ${totalSpent > 0 ? `${totalSpent} on food purchases` : 'No purchases logged'}
- Platform Engagement: ${chatCount} coach questions exchanged.

INSTRUCTIONS:
1. Praise their specific wins and consistency today.
2. If calories or macros were notably over/under target, offer a compassionate, scientifically sound adjustment tip for tomorrow.
3. Keep the summary between 3 to 5 sentences. Suitable as an in-app coach chat message.
4. LANGUAGE MANDATE: You MUST write your entire response fluently in language code: '${userLang}'. Do NOT write in English unless language code is 'en'.`
  } else {
    // Zero-activity: Compassionate, non-shaming check-in prompt
    prompt = `You are a warm, compassionate AI Health Coach for ${userName} on the VicCalary platform.
For the day of ${queryDate}, ${userName} had no logged meals, check-ins, or scanner activity.

INSTRUCTIONS:
1. Deliver a gentle, non-shaming, empathetic evening check-in.
2. Acknowledge that busy days or restful pauses happen, encourage gentle hydration and quality sleep.
3. Invite them with warmth to start fresh with their morning meal or reflection tomorrow whenever they are ready.
4. Keep the message to 2 to 3 sentences.
5. LANGUAGE MANDATE: You MUST write your entire response fluently in language code: '${userLang}'. Do NOT write in English unless language code is 'en'.`
  }

  const aiRes = await callChatCompletionWithFallback({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are the empathetic, science-grounded Health Coach for the VicCalary application. Speak warmly, clearly, and concisely without hallucinating unprovided facts.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 350,
  })

  let summaryText = aiRes.choices[0]?.message?.content || 'Here is your daily health coach reflection. Great job on your journey today!'
  summaryText = summaryText.replace(/[*#]/g, '').trim()

  // 7. Deliver message into user's AI coach conversation
  const messageContent = `🌙 ${summaryText}`

  const { error: msgErr } = await (supabase.from('messages') as any).insert({
    conversation_id: coachConvId,
    sender_id: COACH_ID,
    message_type: 'system',
    content: messageContent,
    metadata: {
      type: 'daily_summary',
      date: queryDate,
      has_activity: hasActivity,
      stats: {
        calories_consumed: calorieConsumed,
        calories_goal: calorieGoal,
        meals_logged: mealsLogged,
        weight: measurements?.weight || null,
        mood: measurements?.mood || null,
      },
    },
    is_delivered: true,
    delivered_at: new Date().toISOString(),
  })

  if (msgErr) {
    console.error('[daily-summary] Failed to insert coach message:', msgErr)
    throw msgErr
  }

  await (supabase.from('conversations') as any)
    .update({
      last_message_at: new Date().toISOString(),
      last_message_content: messageContent,
      last_message_sender_id: COACH_ID,
      last_message_type: 'system',
    })
    .eq('id', coachConvId)

  return {
    success: true,
    summary: summaryText,
    date: queryDate,
    hasActivity,
    conversationId: coachConvId,
  }
}
