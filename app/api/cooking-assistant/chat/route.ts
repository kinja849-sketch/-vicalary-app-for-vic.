import { NextRequest, NextResponse } from 'next/server';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { query, recipeTitle, currentStepIdx, currentInstruction, language, userId } = payload;

        if (!query) {
            return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        }

        const supabase = createServerSupabaseClient();
        const resolvedLang = await resolveUserLanguage({
            userId,
            requestLanguage: language,
            supabase,
        });
        const langDirective = buildAILanguageDirective(resolvedLang);

        const systemPrompt = `You are a warm, supportive, and experienced professional chef. 
The user is currently cooking "${recipeTitle || 'a meal'}".
They are currently on Step ${(currentStepIdx ?? 0) + 1}, which is: "${currentInstruction || ''}".

The user has asked a question or needs help. Respond directly, conversationally, and EXTREMELY concisely.
YOU MUST KEEP YOUR RESPONSE TO A MAXIMUM OF 1 OR 2 SHORT SENTENCES. 
Do not use lists, bullet points, or complex formatting. Speak naturally as if you are standing next to them in the kitchen. Provide a fast, actionable answer.

${langDirective}`;

        const aiRes = await callChatCompletionWithFallback({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: String(query).slice(0, 500) }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        const answer = aiRes.choices?.[0]?.message?.content || "Here to help! Let me know what step you'd like guidance with.";

        return NextResponse.json({ answer });
    } catch (error: any) {
        console.error('[Cooking-Assistant-Chat Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to process culinary question' }, { status: 500 });
    }
}
