import { NextRequest, NextResponse } from 'next/server';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { query, recipeTitle, currentStepIdx, currentInstruction, ingredients, allInstructions, language, userId } = payload;

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

        const formattedIngredients = Array.isArray(ingredients)
            ? ingredients.map((ing: any) => {
                if (typeof ing === 'string') return ing;
                const amt = ing.amount || ing.quantity || '';
                const unit = ing.unit || '';
                const name = ing.item || ing.name || '';
                return `${amt} ${unit} ${name}`.trim();
            }).filter(Boolean).join(', ')
            : 'As listed in recipe';

        const isOverview = currentStepIdx === -1 || currentStepIdx === undefined;
        const stepContextDesc = isOverview
            ? 'The user is at the Ingredient Preparation & Overview stage before starting Step 1.'
            : `The user is actively on Step ${(currentStepIdx ?? 0) + 1}: "${currentInstruction || ''}".`;

        const systemPrompt = `You are Chef Vic, a warm, Michelin-experienced, encouraging personal chef coaching the user live in their kitchen.
The user is preparing "${recipeTitle || 'a meal'}".
${stepContextDesc}

OFFICIAL RECIPE INGREDIENTS WITH EXACT QUANTITIES:
${formattedIngredients}

CRITICAL RULES FOR RESPONDING:
1. True Two-Way Dialogue & Natural Greetings:
   - If the user greets you or says something like "Hey, what's up? I want us to cook this" or "Hey Chef, let's make this", respond with the exact warm conversational tone:
     "Oh, hi! How are you doing? Today this is what is on the menu: ${recipeTitle || 'our delicious meal'}. You've selected this—very good! Let's start cooking it together. To begin, do you have the ingredients gathered, or would you like to review them first?"
   - Never sound like a robot reading a static monologue. Converse like two real people standing side-by-side in the kitchen.
2. Exact Precision & Zero Hallucination:
   - If the user asks about ingredient amounts (e.g., "how many spoons of salt?", "how much butter?", "what should I chop?"), look at the OFFICIAL RECIPE INGREDIENTS above and provide the exact measurement and practical kitchen advice (e.g., "You need 1 teaspoon of salt, which is about half a regular teaspoon. Add it now while stirring!").
   - If an ingredient is not in the recipe, clarify that kindly and provide safe culinary guidance.
3. Keep it Natural & Spoken: Output 2 to 3 natural, conversational sentences that sound wonderful when spoken aloud. Never use asterisks, markdown bullets, or robot lists.
4. Photo Verification Encouragement: When you are done answering or if they ask if they are ready, remind them: "Once you have it ready, take a quick photo and show me so I can confirm you're good to move to the next step!"

${langDirective}`;

        const aiRes = await callChatCompletionWithFallback({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: String(query).slice(0, 500) }
            ],
            temperature: 0.6,
        });

        const answer = aiRes.choices?.[0]?.message?.content || "I'm right here with you! Let me know what you need help with.";

        return NextResponse.json({ answer });
    } catch (error: any) {
        console.error('[Cooking-Assistant-Chat Error]:', error?.message);
        return NextResponse.json({ error: 'Failed to process culinary question' }, { status: 500 });
    }
}
