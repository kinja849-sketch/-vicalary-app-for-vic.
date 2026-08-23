import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
    try {
        const { userId, total_budget, period_end } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createServerSupabaseClient();

        const { data: userSettings } = await supabase.from('user_settings').select('language').eq('user_id', userId).maybeSingle();
        const explicitUserLang = userSettings?.language || 'en';
        
        // 1. Fetch user's balances
        const { data: balances } = await supabase.from('account_balances').select('*').eq('user_id', userId);
        
        // 2. Fetch user's transactions (if synced)
        const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(50);
        
        // 3. Build AI prompt
        const prompt = `
        You are an elite financial coach. Analyze the user's financial state and create a personalized budgeting plan.
        
        User's requested monthly budget: ${total_budget}
        Period End: ${period_end}
        
        Account Balances:
        ${balances?.map((b: any) => `- Account ${b.account_id.substring(0,4)}: ${b.available_balance || b.current_balance} ${b.currency}`).join('\n') || 'None'}
        
        Recent Transactions:
        ${transactions?.map((t: any) => `- ${t.date}: ${t.name} (${t.amount})`).join('\n') || 'None'}
        
        Please provide a structured JSON response with the following keys:
        - objective: A motivating financial objective based on their balances and requested budget.
        - target_spending: The optimized target spending amount.
        - timeframe: The timeframe (e.g., 'Monthly').
        - recommendations: Specific actionable recommendations.
        - pacing: A suggested pacing strategy (e.g., 'Spend $X per week').
        - risk_analysis: Any risks you see (e.g., 'Low balance compared to budget').
        
        LANGUAGE MANDATE: You MUST write your entire response fluently in this language code ('\${explicitUserLang}'). Do NOT reply in English unless their language code is 'en'.
        `;

        // 4. Call OpenAI API
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}` // using NEXT_PUBLIC_ just for existing env var compatibility, normally use a backend OPENAI_API_KEY
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });

        const aiData = await aiResponse.json();
        const aiResult = JSON.parse(aiData.choices[0].message.content);

        // 5. Store the AI Budget Goal
        // Deactivate old goals
        await supabase.from('budget_goals').update({ is_active: false }).eq('user_id', userId);
        
        const { data: newGoal, error: goalError } = await supabase.from('budget_goals').insert({
            user_id: userId,
            objective: aiResult.objective,
            target_spending: aiResult.target_spending || total_budget,
            timeframe: aiResult.timeframe,
            recommendations: aiResult.recommendations,
            pacing: aiResult.pacing,
            risk_analysis: aiResult.risk_analysis,
            is_active: true
        }).select().single();

        if (goalError) {
            console.error("Failed to insert budget goal:", goalError);
            throw goalError;
        }

        return NextResponse.json({ success: true, ai_goal: newGoal });

    } catch (err: any) {
        console.error("AI Budget Engine Error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
