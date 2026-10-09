import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';
import { getAICompletionText } from '@/lib/ai/ai-fallback';

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const { daily_budget, daily_spending, remaining_budget, currency, recent_expenses } = body;

        if (daily_budget === undefined || daily_spending === undefined) {
            return NextResponse.json({ success: false, error: 'Missing budget context' }, { status: 400 });
        }

        const prompt = `
You are an empathetic financial and nutritional coach for the Vicalary app.
The user has exceeded their daily budget. 
Daily Budget: ${daily_budget} ${currency || 'USD'}
Daily Spending: ${daily_spending} ${currency || 'USD'}
Remaining Budget: ${remaining_budget} ${currency || 'USD'}
Recent Expenses: ${JSON.stringify(recent_expenses || [])}

Provide a short, encouraging 2-3 sentence piece of advice on how they can adjust their spending tomorrow to bring their weekly budget back on track without feeling deprived. Keep it supportive and focus on the categories they spent the most on today. Do not hallucinate prices or fake transactions.`;

        const text = await getAICompletionText({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
        });

        return NextResponse.json({ success: true, advice: text });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

