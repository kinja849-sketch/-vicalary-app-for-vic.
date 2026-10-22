import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';
import { loadUserProfileContext } from '@/lib/services/ai/ContextAssembler';
import { formatUserAllergiesList } from '@/lib/services/recipes/AllergySafeRecipeAdapter';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { recipe, userId, language } = payload;

        if (!recipe || !recipe.title) {
            return NextResponse.json({ error: 'Missing recipe data' }, { status: 400 });
        }

        const rawInstructions = Array.isArray(recipe.instructions)
            ? recipe.instructions
            : (typeof recipe.instructions === 'string' ? [recipe.instructions] : []);
        const validInstructions = rawInstructions
            .map((s: any) => typeof s === 'string' ? s : (s?.step || s?.instruction || String(s)))
            .filter((s: string) => s && s.trim().length > 0);

        if (validInstructions.length === 0) {
            return NextResponse.json({ error: 'No cooking instructions available for this recipe' }, { status: 400 });
        }

        // Fetch User Profile & Onboarding Context
        const supabase = createServerSupabaseClient();
        const resolvedLang = await resolveUserLanguage({
            userId,
            requestLanguage: language,
            supabase,
        });
        const langDirective = buildAILanguageDirective(resolvedLang);

        const loadedProfile = await loadUserProfileContext(supabase, userId);
        const allergiesListText = formatUserAllergiesList(loadedProfile.allergies);
        const hasAllergies = Boolean(allergiesListText);
        const allergyOpeningNote = hasAllergies
            ? `Since you have an allergy to ${allergiesListText}, I have opted to go for ${recipe.title} prepared completely free of ${allergiesListText}. `
            : '';
        const allergyClosingReason = hasAllergies
            ? ` Because you are allergic to ${allergiesListText}, I specifically suggest this allergen-safe recipe so you can enjoy every bite safely while supporting your ${loadedProfile.goal || 'healthy lifestyle'} goal.`
            : '';

        const generateFallbackSession = () => {
            const rawIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
            const ingredientsList = rawIngredients
                .map((ing: any) => typeof ing === 'string' ? ing : `${ing.amount || ''} ${ing.unit || ''} ${ing.item || ing.name || ''}`.trim())
                .filter(Boolean);
            const ingText = ingredientsList.length > 0 ? ingredientsList.join(', ') : 'all listed ingredients';

            return {
                overview: {
                    text: `${allergyOpeningNote}Oh, hi! How are you doing? Today this is what is on the menu: ${recipe.title}. You've selected this—very good!${allergyClosingReason} Let's start cooking it together. To start, make sure you have: ${ingText}. Ask me anything if you're unsure about measurements or substitutions. Once you have everything ready, take a photo so I can confirm you're good to begin!`,
                    equipment: ['Cooking pan', 'Utensils'],
                    ingredients_image_prompt: `A beautiful culinary setup with raw ingredients for ${recipe.title}`
                },
                steps: validInstructions.map((stepText: string, idx: number) => ({
                    instruction: stepText,
                    duration_seconds: 240,
                    ingredients_used: [],
                    image_prompt: `${recipe.title} step ${idx + 1}`
                }))
            };
        };

        const userContext = `User Goal: ${loadedProfile.goal || 'General Health'}. Dietary Preferences: ${loadedProfile.dietaryPreference || (loadedProfile.dietaryLifestyle || []).join(', ') || 'Halal'}. Strict Allergies: ${allergiesListText || 'None'}.`;

        const systemPrompt = `You are Chef Vic, a warm, Michelin-experienced, encouraging personal chef coaching the user live in their kitchen.
You are transforming a standard recipe into an interactive two-way guided cooking session.

CRITICAL REQUIREMENTS:
1. You MUST output the exact same number of steps as the original recipe instructions. DO NOT summarize or group steps together. If the original recipe has ${validInstructions.length} steps, you must output exactly ${validInstructions.length} steps in your JSON array.
2. In overview.text: ${hasAllergies ? `Start directly with: "${allergyOpeningNote.trim()}" Then greet` : 'Greet'} the user warmly as Chef Vic: "Oh, hi! How are you doing? Today this is what is on the menu: ${recipe.title}. You've selected this—very good! Let's start cooking it together." ${hasAllergies ? `Also distinctively explain why you suggest this recipe because the user is allergic to ${allergiesListText}. ` : ''}Then read out the key ingredients with their exact amounts, remind them that they can talk or ask questions at any time (e.g. asking for spoons of salt or substitutions), and invite them: "Once you have everything gathered, take a photo and show me so I can confirm you're ready to start cooking!"
3. In steps[].instruction: Conversational chef guidance explaining textures and cues (e.g. 'until fragrant and golden brown'). End each step by reminding them to snap a picture when done so Chef can review and approve moving to the next step.

RECIPE PROVIDED:
Title: ${recipe.title}
Dietary Tags: ${(recipe.dietary_tags || []).join(', ')}
Prep Time: ${recipe.prep_time_minutes || 0}m, Cook Time: ${recipe.cook_time_minutes || 0}m
Servings: ${recipe.servings || 2}
Calories: ${recipe.total_calories || 0}kcal, Protein: ${recipe.protein_g || 0}g, Carbs: ${recipe.carbs_g || 0}g, Fat: ${recipe.fat_g || 0}g
Ingredients: ${JSON.stringify(recipe.ingredients || [])}
Standard Instructions: ${JSON.stringify(validInstructions)}

USER CONTEXT:
${userContext}

TASK:
Output a strictly valid JSON object matching this schema:
{
  "overview": {
    "text": "Warm greeting ('Oh, hi! How are you doing? Today this is what is on the menu: ... You've selected this—very good! Let's start cooking it together.') followed by ingredients review, invitation to ask questions, and prompt for photo confirmation.",
    "equipment": ["pans", "knives"],
    "ingredients_image_prompt": "A photorealistic culinary layout of ingredients for ${recipe.title}"
  },
  "steps": [
    {
      "instruction": "Conversational chef guidance for this step, asking for a photo once complete so Chef can approve moving forward.",
      "duration_seconds": 300,
      "ingredients_used": ["ingredients for this step"],
      "image_prompt": "Food appearance at this stage of cooking"
    }
  ]
}

${langDirective}
All user-facing text fields ("overview.text", "steps[].instruction") MUST be translated and written strictly in the specified target language!`;

        try {
            const openAiRes = await callChatCompletionWithFallback({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: systemPrompt }],
                response_format: { type: 'json_object' },
                temperature: 0.7,
            });

            const content = openAiRes.choices[0]?.message?.content || '{}';
            const parsedSession = JSON.parse(content);

            if (parsedSession && parsedSession.overview && Array.isArray(parsedSession.steps) && parsedSession.steps.length > 0) {
                return NextResponse.json({ success: true, session: parsedSession });
            }
            throw new Error('AI produced incomplete session');
        } catch (aiErr: any) {
            console.warn('[Orchestration] AI generation failed or timed out, using structured fallback session:', aiErr?.message);
            const fallbackSession = generateFallbackSession();
            return NextResponse.json({ success: true, session: fallbackSession, fallback: true });
        }
    } catch (error: any) {
        console.error('[Orchestration Error]:', error);
        return NextResponse.json({ error: error.message || 'Orchestration failed' }, { status: 500 });
    }
}
