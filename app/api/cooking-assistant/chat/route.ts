import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { query, recipeTitle, currentStepIdx, currentInstruction } = payload;

        if (!query) {
            return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        }

        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI API key missing');

        const systemPrompt = `You are a warm, supportive, and experienced professional chef. 
The user is currently cooking "${recipeTitle || 'a meal'}".
They are currently on Step ${currentStepIdx + 1}, which is: "${currentInstruction}".

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
                    { role: 'user', content: query }
                ],
                temperature: 0.7,
                max_tokens: 150, // Keep responses concise for TTS
            }),
        });

        if (!openAiRes.ok) {
            throw new Error(`OpenAI error: ${await openAiRes.text()}`);
        }

        const data = await openAiRes.json();
        const answer = data.choices[0].message.content;

        return NextResponse.json({ answer });
    } catch (error: any) {
        console.error('[Cooking-Assistant-Chat Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
