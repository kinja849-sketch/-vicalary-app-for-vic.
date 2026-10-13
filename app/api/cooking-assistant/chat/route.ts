import { NextRequest, NextResponse } from 'next/server';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';
import { createServerSupabaseClient } from '@/lib/supabase-server';

type HistoryTurn = { role: 'user' | 'assistant'; text: string };

function sanitizeHistory(raw: unknown): HistoryTurn[] {
    if (!Array.isArray(raw)) return [];
    const turns: HistoryTurn[] = [];
    for (const item of raw.slice(-10)) {
        if (!item || typeof item !== 'object') continue;
        const role = (item as any).role === 'assistant' ? 'assistant' : (item as any).role === 'user' ? 'user' : null;
        const text = String((item as any).text ?? '').trim().slice(0, 500);
        if (!role || !text) continue;
        turns.push({ role, text });
    }
    return turns.slice(-8);
}

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { query, recipeTitle, currentStepIdx, currentInstruction, ingredients, allInstructions, language, userId } = payload;

        if (!query || typeof query !== 'string' || !query.trim()) {
            return NextResponse.json({ error: 'Missing query' }, { status: 400 });
        }

        const supabase = createServerSupabaseClient();
        const resolvedLang = await resolveUserLanguage({
            userId,
            requestLanguage: language,
            supabase,
        });
        const langDirective = buildAILanguageDirective(resolvedLang);

        const formattedIngredients = Array.isArray(ingredients) && ingredients.length > 0
            ? ingredients.map((ing: any) => {
                if (typeof ing === 'string') return `- ${ing}`;
                const amt = ing.amount || ing.quantity || '';
                const unit = ing.unit || '';
                const name = ing.item || ing.name || '';
                return `- ${`${amt} ${unit} ${name}`.trim()}`;
            }).filter((l: string) => l.trim() !== '-').join('\n')
            : '(ingredient list unavailable)';

        const stepList = Array.isArray(allInstructions)
            ? allInstructions.slice(0, 20).map((s: any, i: number) => `${i + 1}. ${String(typeof s === 'string' ? s : s?.instruction || '').slice(0, 160)}`).join('\n')
            : '';

        const isOverview = currentStepIdx === -1 || currentStepIdx === undefined;
        const stepContextDesc = isOverview
            ? 'The cook is at the ingredient overview, before Step 1.'
            : `The cook is on Step ${(currentStepIdx ?? 0) + 1}: "${String(currentInstruction || '').slice(0, 400)}".`;

        const systemPrompt = `You are Chef Vic, a warm, encouraging personal chef talking live with the cook in their kitchen. This is a spoken two-way conversation.
Recipe: "${recipeTitle || 'the current meal'}".
${stepContextDesc}

RECIPE INGREDIENTS (the ONLY source of quantities):
${formattedIngredients}
${stepList ? `\nRECIPE STEPS:\n${stepList}\n` : ''}
RULES:
1. Answer ONLY the cook's latest message, using the earlier turns for context (e.g. "and the pepper?" refers to the previous topic). Never replay a previous reply or a canned greeting.
2. Quantities, ingredients and steps must come from the recipe above. If asked about something that is not in the recipe, say plainly that it is not in this recipe, then give brief, safe cooking guidance. Never invent amounts.
3. Reply in 1 to 2 concise spoken sentences (under 30 words). Lead immediately with the direct answer. No markdown, no lists, no asterisks. Finish every sentence cleanly.
4. If the cook only greets you or says something like "ok", respond naturally and briefly to exactly that, then (at most) one short helpful question about the current step.
5. Only mention taking a photo when the cook asks if they are ready, done, or wants to move on.

${langDirective}`;

        const history = sanitizeHistory(payload.history);
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            ...history.map(h => ({ role: h.role, content: h.text })),
            { role: 'user', content: String(query).trim().slice(0, 600) },
        ];

        const aiRes = await callChatCompletionWithFallback({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.3,
            max_tokens: 75,
            signal: req.signal,
        });

        const answer = String(aiRes.choices?.[0]?.message?.content || '').trim();
        if (!answer) {
            return NextResponse.json({ error: 'Empty answer from provider' }, { status: 502 });
        }

        return NextResponse.json({ answer, provider: (aiRes as any).providerUsed });
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            return new NextResponse(null, { status: 499 });
        }
        console.error('[Cooking-Assistant-Chat Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to process culinary question' }, { status: 500 });
    }
}
