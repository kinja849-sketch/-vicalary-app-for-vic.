import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { generateDailySummaryForUser } from '@/lib/api/daily-summary-service'
import { format } from 'date-fns'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true
  }

  const authHeader = req.headers.get('authorization')
  const customSecret = req.headers.get('x-cron-secret')
  const bearerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : ''

  if (cronSecret && (bearerToken === cronSecret || customSecret === cronSecret)) {
    return true
  }

  const searchParamSecret = req.nextUrl.searchParams.get('secret')
  if (cronSecret && searchParamSecret === cronSecret) {
    return true
  }

  if (process.env.NODE_ENV === 'development' && req.nextUrl.searchParams.get('dev_override') === 'true') {
    return true
  }

  return false
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron credentials' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const supabase = createAdminSupabaseClient()

    // If specific target user requested for test/manual trigger
    const targetUserId = body.targetUserId || req.nextUrl.searchParams.get('targetUserId')
    const force = Boolean(body.force || req.nextUrl.searchParams.get('force') === 'true')
    const manualDate = body.targetDate || req.nextUrl.searchParams.get('targetDate')

    let usersQuery = supabase
      .from('user_profiles')
      .select('id, full_name, user_settings(timezone, language)')

    if (targetUserId) {
      usersQuery = usersQuery.eq('id', targetUserId)
    }

    const { data: users, error: usersErr } = await usersQuery

    if (usersErr) {
      console.error('[cron/daily-summary] Failed to fetch users:', usersErr)
      return NextResponse.json({ error: usersErr.message }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users found to evaluate' })
    }

    const results: Array<{ userId: string; timezone: string; localHour: number; date: string; status: string; summary?: string }> = []

    for (const u of users) {
      try {
        const settings = Array.isArray(u.user_settings) ? u.user_settings[0] : (u.user_settings as any)
        const tz = settings?.timezone || 'UTC'

        // Determine current hour in user's timezone
        const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
        const localHour = nowInTz.getHours()

        // Check if midnight window (00:00 - 00:59) or manual target user override
        const isMidnightWindow = localHour === 0 || Boolean(targetUserId)

        if (!isMidnightWindow) {
          results.push({
            userId: u.id,
            timezone: tz,
            localHour,
            date: '',
            status: 'skipped_not_midnight',
          })
          continue
        }

        let completedDate: string
        if (manualDate) {
          completedDate = manualDate
        } else {
          const yesterday = new Date(nowInTz)
          yesterday.setDate(yesterday.getDate() - 1)
          completedDate = format(yesterday, 'yyyy-MM-dd')
        }

        const res = await generateDailySummaryForUser(u.id, completedDate, force)

        results.push({
          userId: u.id,
          timezone: tz,
          localHour,
          date: completedDate,
          status: res.alreadySent ? 'already_sent' : res.success ? 'delivered' : 'failed',
          summary: res.summary?.slice(0, 80),
        })
      } catch (userErr: any) {
        console.error(`[cron/daily-summary] Error processing user ${u.id}:`, userErr)
        results.push({
          userId: u.id,
          timezone: 'unknown',
          localHour: -1,
          date: '',
          status: `error: ${userErr.message}`,
        })
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedUsers: users.length,
      processed: results.filter(r => r.status === 'delivered').length,
      alreadySent: results.filter(r => r.status === 'already_sent').length,
      skipped: results.filter(r => r.status === 'skipped_not_midnight').length,
      details: results,
    })
  } catch (err: any) {
    console.error('[cron/daily-summary] Cron execution failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Support GET for external simple webhook pings that authorize via secret
  return POST(req)
}
