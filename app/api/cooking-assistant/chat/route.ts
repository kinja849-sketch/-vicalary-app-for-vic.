import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { query, recipeTitle, currentStepIdx, currentInstruction } = payload;

        if (!query) {
            return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');

        const systemPrompt = `You are a warm, supportive, and experienced professional chef. 
The user is currently cooking "${recipeTitle || 'a meal'}".
They are currently on Step ${(currentStepIdx ?? 0) + 1}, which is: "${currentInstruction || ''}".

The user has asked a question or needs help. Respond directly, conversationally, and EXTREMELY concisely.
YOU MUST KEEP YOUR RESPONSE TO A MAXIMUM OF 1 OR 2 SHORT SENTENCES. 
Do not use lists, bullet points, or complex formatting. Speak naturally as if you are standing next to them in the kitchen. Provide a fast, actionable answer.`;

        const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: String(query).slice(0, 500) }
                ],
                temperature: 0.7,
                max_tokens: 150,
            }),
        });

        if (!openAiRes.ok) {
            const errText = await openAiRes.text();
            console.error('[OpenAI Chat Upstream Error]:', errText);
            throw new Error('Failed to generate assistant response');
        }

        const data = await openAiRes.json();
        const answer = data.choices?.[0]?.message?.content || "Here to help! Let me know what step you'd like guidance with.";

        return NextResponse.json({ answer });
    } catch (error: any) {
        console.error('[Cooking-Assistant-Chat Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to process culinary question' }, { status: 500 });
    }
}
