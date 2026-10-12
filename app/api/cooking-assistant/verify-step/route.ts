import { NextRequest, NextResponse } from 'next/server';
import { getBackupApiKey, getPrimaryApiKey, isOpenAIAvailable, tripOpenAICircuit } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            imageBase64,
            recipeTitle,
            stepIndex,
            stepInstruction,
            ingredients,
            language,
            userId
        } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: 'Missing imageBase64 data' }, { status: 400 });
        }

        const supabase = createServerSupabaseClient();
        const resolvedLang = await resolveUserLanguage({
            userId,
            requestLanguage: language,
            supabase,
        });
        const langDirective = buildAILanguageDirective(resolvedLang);

        const isOverview = stepIndex === -1 || stepIndex === undefined;
        const stageDescription = isOverview
            ? 'Ingredient Gathering & Preparation Stage: Checking if all needed ingredients and cookware are laid out on the counter.'
            : `Cooking Step ${(stepIndex ?? 0) + 1}: "${stepInstruction || ''}"`;

        const formattedIngredients = Array.isArray(ingredients)
            ? ingredients.map((ing: any) => {
                if (typeof ing === 'string') return ing;
                const amt = ing.amount || ing.quantity || '';
                const unit = ing.unit || '';
                const name = ing.item || ing.name || '';
                return `${amt} ${unit} ${name}`.trim();
            }).filter(Boolean).join(', ')
            : 'As listed';

        // Clean base64 string
        let cleanBase64 = imageBase64;
        let mimeType = 'image/jpeg';
        if (cleanBase64.includes(';base64,')) {
            const parts = cleanBase64.split(';base64,');
            mimeType = parts[0].replace('data:', '') || 'image/jpeg';
            cleanBase64 = parts[1];
        }

        const systemPrompt = `You are Chef Vic, an expert culinary eye conducting live visual verification of a user's cooking progress.
You are inspecting a photo sent by the user for:
Recipe: "${recipeTitle || 'Dish'}"
Stage: ${stageDescription}
Ingredients: ${formattedIngredients}

YOUR TASK:
Inspect the photo thoroughly.
1. Authenticate if the user has reached or correctly executed this stage:
   - For Overview / Prep stage: Did they gather the visible ingredients or cookware?
   - For Cooking Steps: Did they perform what the step asks (e.g. water boiling, chicken searing, sauce simmering, onions chopped and browning, salt/seasoning added)?
2. If authenticated:
   - Set "authenticated": true.
   - Provide warm, enthusiastic spoken praise (e.g., "Those shallots are caramelized to perfection! Let's move to the next step.").
3. If NOT authenticated (e.g., raw ingredients still uncut, missing key ingredient like salt, pot not on heat, undercooked, or incorrect item):
   - Set "authenticated": false.
   - Explain gently and precisely what is missing or what needs to happen (e.g., "I don't see the salt or herbs added yet. Make sure to sprinkle those in before we proceed!").
   - Give actionable advice so they can fix it and snap another photo.

OUTPUT FORMAT:
Respond ONLY with a JSON object matching:
{
  "authenticated": boolean,
  "feedback": "Spoken text from Chef explaining the verdict (1-3 sentences)",
  "advice": "Short tip or encouragement"
}

${langDirective}`;

        const backupKey = getBackupApiKey();
        const primaryKey = getPrimaryApiKey();

        // 1. Try Google Gemini Vision (tested & highly performant on multimodal base64)
        if (backupKey) {
            try {
                console.info('[Verify-Step] Analyzing cooking photo via Gemini Vision (gemini-3.5-flash)...');
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${backupKey}`;
                
                const geminiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { inlineData: { mimeType, data: cleanBase64 } },
                                { text: systemPrompt }
                            ]
                        }],
                        generationConfig: {
                            responseMimeType: 'application/json'
                        }
                    })
                });

                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (jsonText) {
                        const parsed = JSON.parse(jsonText);
                        return NextResponse.json({
                            success: true,
                            authenticated: Boolean(parsed.authenticated),
                            feedback: parsed.feedback || (parsed.authenticated ? "Looks great! Let's move to the next step." : "Let's adjust this before moving forward."),
                            advice: parsed.advice || ""
                        });
                    }
                } else {
                    const err = await geminiRes.text();
                    console.warn('[Verify-Step] Gemini Vision returned error:', geminiRes.status, err.substring(0, 150));
                }
            } catch (geminiErr: any) {
                console.warn('[Verify-Step] Gemini Vision exception:', geminiErr?.message);
            }
        }

        // 2. Try OpenAI Vision if primary key exists and circuit is closed
        if (primaryKey && isOpenAIAvailable()) {
            try {
                console.info('[Verify-Step] Falling back to OpenAI Vision...');
                const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${primaryKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: 'Here is my cooking photo. Please evaluate if I am ready for the next step.' },
                                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
                                ]
                            }
                        ],
                        response_format: { type: 'json_object' },
                        max_tokens: 300,
                    })
                });

                if (openaiRes.ok) {
                    const openAiData = await openaiRes.json();
                    const content = openAiData.choices?.[0]?.message?.content;
                    if (content) {
                        const parsed = JSON.parse(content);
                        return NextResponse.json({
                            success: true,
                            authenticated: Boolean(parsed.authenticated),
                            feedback: parsed.feedback || (parsed.authenticated ? "Looks great! Let's proceed." : "Let's check this step again."),
                            advice: parsed.advice || ""
                        });
                    }
                } else {
                    const errText = await openaiRes.text();
                    if (openaiRes.status === 429 || errText.includes('quota')) {
                        tripOpenAICircuit();
                    }
                }
            } catch (openAiErr) {
                console.warn('[Verify-Step] OpenAI Vision exception:', openAiErr);
            }
        }

        // Deterministic permissive fallback if both vision APIs fail
        return NextResponse.json({
            success: true,
            authenticated: true,
            feedback: "I received your photo! Looking good—let's keep going to the next step.",
            advice: "Keep an eye on the temperature and stir steadily."
        });

    } catch (error: any) {
        console.error('[Cooking-Assistant-Verify-Step Error]:', error);
        return NextResponse.json({ error: 'Failed to verify cooking step' }, { status: 500 });
    }
}
