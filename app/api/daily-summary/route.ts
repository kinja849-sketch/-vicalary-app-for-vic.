import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { generateDailySummaryForUser } from '@/lib/api/daily-summary-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const authUser = await getAuthenticatedUser(req).catch(() => null)
    const targetUserId = body.userId || authUser?.id

    if (!targetUserId) {
      return NextResponse.json({ error: 'Unauthorized: missing user context' }, { status: 401 })
    }

    const result = await generateDailySummaryForUser(
      targetUserId,
      body.targetDate,
      Boolean(body.force)
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[daily-summary API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
