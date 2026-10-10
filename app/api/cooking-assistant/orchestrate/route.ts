import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective } from '@/lib/api/serverLanguage';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const { recipe, userId, language } = payload;

        if (!recipe || !recipe.title) {
            return NextResponse.json({ error: 'Missing recipe data' }, { status: 400 });
        }

        // Fetch User Profile to get VCalorie Context
        const supabase = createServerSupabaseClient();
        const resolvedLang = await resolveUserLanguage({
            userId,
            requestLanguage: language,
            supabase,
        });
        const langDirective = buildAILanguageDirective(resolvedLang);

        let userContext = '';
        if (userId) {
            const { data: userProfile } = await supabase.from('user_profiles').select('goal, dietary_lifestyle').eq('id', userId).maybeSingle();
            if (userProfile) {
                userContext = `User Goal: ${userProfile.goal || 'General Health'}. Dietary Restrictions: ${(userProfile.dietary_lifestyle || []).join(', ') || 'None'}.`;
            }
        }

        const systemPrompt = `You are a warm, experienced professional chef guiding a user through cooking in real time. 
You are transforming a standard recipe into an immersive, conversational guided cooking session.

CRITICAL REQUIREMENT:
You MUST output the exact same number of steps as the original recipe instructions. DO NOT summarize or group steps together. If the original recipe has 6 steps, you must output exactly 6 steps in your JSON array.

RECIPE PROVIDED:
Title: ${recipe.title}
Dietary Tags: ${(recipe.dietary_tags || []).join(', ')}
Prep Time: ${recipe.prep_time_minutes || 0}m, Cook Time: ${recipe.cook_time_minutes || 0}m
Servings: ${recipe.servings || 2}
Calories: ${recipe.total_calories || 0}kcal, Protein: ${recipe.protein_g || 0}g, Carbs: ${recipe.carbs_g || 0}g, Fat: ${recipe.fat_g || 0}g
Ingredients: ${JSON.stringify(recipe.ingredients)}
Standard Instructions: ${JSON.stringify(recipe.instructions)}

USER VCALORIE CONTEXT:
${userContext}

TASK:
Output a strictly valid JSON object matching this schema:
{
  "overview": {
    "text": "A natural, warm, conversational greeting and introduction to the dish. YOU MUST EXPLICITLY READ OUT ALL THE INGREDIENTS, their exact amounts, and what state they should be in (e.g., 'You will need 2 onions, finely chopped, and 1 cup of flour'). Mention the prep time and dynamically bring in the nutritional context (calories/macros) relating to the user's goals if applicable. Do not skip the ingredient review. Avoid sounding like a robot.",
    "equipment": ["list", "of", "pans", "etc"],
    "ingredients_image_prompt": "A highly detailed, photorealistic prompt for an AI image generator showing all the raw ingredients for this meal laid out beautifully on a kitchen counter."
  },
  "steps": [
    {
      "instruction": "A conversational, human-like instruction for this specific step. Explain textures (e.g. 'until golden brown'). Speak like a chef talking to a student.",
      "duration_seconds": 300, // Estimated time this step takes in real life
      "ingredients_used": ["list", "of", "ingredients", "needed", "for", "this", "step"],
      "image_prompt": "A highly detailed, photorealistic prompt for an AI image generator showing exactly what the food looks like AT THIS SPECIFIC STAGE of cooking (e.g., 'Close up of diced onions sautéing in a pan, golden brown')."
    }
  ]
}

${langDirective}
All user-facing text fields ("overview.text", "steps[].instruction") MUST be translated and written strictly in the specified target language!`;

        const openAiRes = await callChatCompletionWithFallback({
            model: 'gpt-4o',
            messages: [{ role: 'system', content: systemPrompt }],
            response_format: { type: 'json_object' },
            temperature: 0.7,
        });

        const content = openAiRes.choices[0]?.message?.content || '{}';
        const parsedSession = JSON.parse(content);

        return NextResponse.json({ success: true, session: parsedSession });
    } catch (error: any) {
        console.error('[Orchestration Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
