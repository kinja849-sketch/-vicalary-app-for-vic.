export default async () => {
  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8080'
  const cronSecret = process.env.CRON_SECRET || ''

  try {
    const res = await fetch(`${siteUrl}/api/cron/daily-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
        'x-cron-secret': cronSecret,
      },
    })
    const data = await res.json()
    console.log('[daily-summary-cron] Scheduler execution completed:', data)
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (err: any) {
    console.error('[daily-summary-cron] Scheduler failed:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config = {
  schedule: '*/15 * * * *',
}
