import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const authUser = await getAuthenticatedUser(req).catch(() => null)
    const userId = body.userId || authUser?.id
    const year = Number(body.year) || new Date().getFullYear()
    const month = Number(body.month) || (new Date().getMonth() + 1)
    const force = Boolean(body.force)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: missing user context' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // 1. Check if a report already exists for this (user_id, year, month)
    const { data: cachedReport } = await supabase
      .from('monthly_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('report_year', year)
      .eq('report_month', month)
      .maybeSingle()

    if (cachedReport && !force) {
      const parsedTips = Array.isArray(cachedReport.tips) ? cachedReport.tips : []
      const insightsObj = typeof cachedReport.insights === 'object' ? cachedReport.insights : {}
      const motivationalMessage = (insightsObj as any)?.motivationalMessage ||
        'Keep honoring your health journey with consistency and mindfulness.'

      return NextResponse.json({
        summary: cachedReport.summary,
        insights: Array.isArray(cachedReport.insights) ? cachedReport.insights : (insightsObj as any)?.items || [],
        adherencePercentage: Number(cachedReport.adherence_percentage || 0),
        spendingEfficiency: cachedReport.spending_efficiency || 'GOOD',
        tips: parsedTips,
        actionPlan: parsedTips,
        motivationalMessage,
        trend: cachedReport.trend || 'maintaining',
        cached: true,
      })
    }

    // 2. Build exact month date boundaries without timezone conversion error
    const lastDay = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 3. Assemble full monthly evidence pack
    const [
      progressRes,
      measurementsRes,
      milestonesRes,
      foodHistoryRes,
      budgetRes,
      profileRes,
      settingsRes,
      onboardingRes,
    ] = await Promise.all([
      // Daily progress
      supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .gte('progress_date', startDate)
        .lte('progress_date', endDate)
        .order('progress_date', { ascending: true }),

      // Progress measurements (weight, mood, reflections)
      supabase
        .from('progress_measurements')
        .select('*')
        .eq('user_id', userId)
        .gte('measurement_date', startDate)
        .lte('measurement_date', endDate)
        .order('measurement_date', { ascending: true }),

      // User weekly milestones (objectives, plans, problems)
      (supabase.from('user_milestones' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .gte('milestone_date', startDate)
        .lte('milestone_date', endDate)
        .order('milestone_date', { ascending: true }),

      // Food items and analyses logged
      supabase
        .from('food_analysis_history')
        .select('food_name, calories, meal_type, analysis_type, created_at, local_date')
        .eq('user_id', userId)
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`),

      // Budget transactions
      supabase
        .from('budget_transactions')
        .select('amount, description, transaction_date')
        .eq('user_id', userId)
        .gte('transaction_date', `${startDate}T00:00:00.000Z`)
        .lte('transaction_date', `${endDate}T23:59:59.999Z`),

      // User profile
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),

      // User settings (language, timezone)
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),

      // Onboarding preferences
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
    ])

    const userLang = settingsRes?.data?.language || 'en'
    const profile = profileRes?.data || {}
    const onboarding = onboardingRes?.data || {}
    const dailyProgress = progressRes?.data || []
    const measurements = measurementsRes?.data || []
    const milestones = milestonesRes?.data || []
    const foodHistory = foodHistoryRes?.data || []
    const budget = budgetRes?.data || []

    // 4. Calculate deterministic metrics from real data
    const totalDaysLogged = dailyProgress.length
    const calorieTarget = onboarding.daily_calorie_goal || profile.goal_calories || 2000

    let adherentDays = 0
    let totalCaloriesLogged = 0

    dailyProgress.forEach((p: any) => {
      const c = Number(p.calories_consumed || 0)
      totalCaloriesLogged += c
      // Consider adherent if within 20% of goal
      if (c >= calorieTarget * 0.8 && c <= calorieTarget * 1.2) {
        adherentDays += 1
      }
    })

    const adherencePercentage = totalDaysLogged > 0
      ? Math.round((adherentDays / totalDaysLogged) * 100)
      : 50

    const totalSpent = budget.reduce((acc: number, b: any) => acc + (Number(b.amount) || 0), 0)

    // Weight trajectory
    const weights = measurements.filter((m: any) => m.weight != null).map((m: any) => Number(m.weight))
    const startWeight = weights.length > 0 ? weights[0] : null
    const endWeight = weights.length > 0 ? weights[weights.length - 1] : null

    // Milestone reflections and problems
    const milestoneSummaries = milestones.map((m: any, idx: number) => ({
      week: idx + 1,
      date: m.milestone_date,
      objective: m.objective,
      focus: m.plan_suggestion,
      challenges: m.problems_faced,
    }))

    // Qualitative reflections from daily check-ins
    const reflections = measurements
      .map((m: any) => {
        let text = ''
        if (m.notes) {
          try {
            const parsed = JSON.parse(m.notes)
            text = parsed.reflection || ''
          } catch {
            text = m.notes
          }
        }
        return text ? `(${m.measurement_date}): "${text}"` : null
      })
      .filter(Boolean)
      .slice(0, 10)

    // 5. Build AI Prompt
    const prompt = `You are the lead AI Health Coach for VicCalary conducting an end-of-month health, nutrition, and behavioral review for ${profile.full_name || 'the user'}.

MONTH: ${month}/${year} (${startDate} to ${endDate})
USER GOALS: ${onboarding.goal || profile.primary_goal || 'Healthy Living'}, Target Calories: ${calorieTarget} kcal/day

VERIFIED MONTHLY EVIDENCE PACK:
1. DAILY PROGRESS:
   - Days Logged: ${totalDaysLogged} / ${lastDay} days
   - Average Daily Intake: ${totalDaysLogged > 0 ? Math.round(totalCaloriesLogged / totalDaysLogged) : 0} kcal
   - Calorie Adherence Rate: ${adherencePercentage}%
2. MEASUREMENTS & MOOD:
   - Weight Journey: ${startWeight != null ? `${startWeight}kg -> ${endWeight}kg` : 'No weigh-ins'}
   - Daily Reflections Sample: ${reflections.length > 0 ? reflections.join('; ') : 'No notes'}
3. WEEKLY CHECKPOINT NOTES:
   ${JSON.stringify(milestoneSummaries, null, 2)}
4. FOOD & MEAL ACTIVITY:
   - Total Logged Items: ${foodHistory.length}
5. FINANCIAL METRICS:
   - Total Food Purchases Logged: ${totalSpent > 0 ? `$${totalSpent.toFixed(2)}` : 'None logged'}

TASK:
Synthesize an authentic, tailored analysis report. Do NOT invent events or data points outside this evidence pack. Directly acknowledge their specific weekly milestone notes and challenges faced.

STRICT JSON OUTPUT FORMAT:
{
  "summary": "Detailed 2-3 paragraph longitudinal reflection connecting their daily consistency, meal choices, and weekly notes.",
  "insights": [
    "Nutritional trend insight citing real meal/macro patterns",
    "Behavioral pattern insight citing specific challenges from milestone notes",
    "Financial or lifestyle efficiency insight"
  ],
  "adherencePercentage": ${adherencePercentage},
  "spendingEfficiency": "EXCELLENT" | "GOOD" | "POOR",
  "actionPlan": [
    "Specific actionable tip 1 for next month",
    "Specific actionable tip 2 for next month",
    "Specific actionable tip 3 for next month"
  ],
  "tips": [
    "Specific actionable tip 1 for next month",
    "Specific actionable tip 2 for next month"
  ],
  "motivationalMessage": "Empowering, personal 1-2 sentence concluding motivation.",
  "trend": "improving" | "maintaining" | "struggling"
}

LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('${userLang}'). Do NOT reply in English unless language code is 'en'.`

    const aiRes = await callChatCompletionWithFallback({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are the compassionate, highly analytical lead Health Coach for VicCalary. You deliver deeply personalized, grounded monthly health audits in valid JSON format only.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    })

    const parsed = JSON.parse(aiRes.choices[0]?.message?.content || '{}')

    const responsePayload = {
      summary: parsed.summary || 'Monthly review completed.',
      insights: parsed.insights || [],
      adherencePercentage: typeof parsed.adherencePercentage === 'number' ? parsed.adherencePercentage : adherencePercentage,
      spendingEfficiency: parsed.spendingEfficiency || (totalSpent > 0 ? 'GOOD' : 'EXCELLENT'),
      tips: parsed.tips || parsed.actionPlan || [],
      actionPlan: parsed.actionPlan || parsed.tips || [],
      motivationalMessage: parsed.motivationalMessage || 'Every small step compounds into lasting wellness.',
      trend: parsed.trend || 'maintaining',
    }

    // 6. Persist to monthly_reports table with proper schema types
    try {
      await supabase
        .from('monthly_reports')
        .upsert({
          user_id: userId,
          report_year: year,
          report_month: month,
          summary: responsePayload.summary,
          insights: { items: responsePayload.insights, motivationalMessage: responsePayload.motivationalMessage },
          adherence_percentage: responsePayload.adherencePercentage,
          spending_efficiency: responsePayload.spendingEfficiency,
          tips: responsePayload.actionPlan,
          trend: responsePayload.trend,
        }, {
          onConflict: 'user_id,report_year,report_month',
        })
    } catch (saveErr) {
      console.warn('[monthly-analysis] Failed to persist report into monthly_reports:', saveErr)
    }

    return NextResponse.json(responsePayload)
  } catch (error: any) {
    console.error('[monthly-analysis] API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req).catch(() => null)
    const userId = req.nextUrl.searchParams.get('userId') || authUser?.id
    const year = Number(req.nextUrl.searchParams.get('year')) || new Date().getFullYear()
    const month = Number(req.nextUrl.searchParams.get('month')) || (new Date().getMonth() + 1)
    const force = req.nextUrl.searchParams.get('force') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: missing user context' }, { status: 401 })
    }

    // Reuse POST logic
    return POST(new NextRequest(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ userId, year, month, force }),
    }))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
