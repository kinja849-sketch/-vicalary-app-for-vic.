import { callChatCompletionWithFallback } from './ai-fallback';

export class ProductAdvisor {
  /**
   * Generates substantial, readable paragraph explanations for scanned packaged products,
   * grounded strictly in authoritative product and nutrition data.
   */
  static async analyze(product: any, nutrition: any, pricing: any, userProfile: any, language: string = 'en') {
    if (!product) return null;

    const userGoal = userProfile?.goal || 'maintain a healthy lifestyle';
    const calorieGoal = userProfile?.daily_calorie_goal || 2000;
    const dietaryLifestyle = (userProfile?.dietary_lifestyle || []).join(', ') || 'Standard diet';
    const healthConcerns = userProfile?.health_conditions || userProfile?.medical_conditions || 'None reported';
    const allergies = userProfile?.allergies ? (Array.isArray(userProfile.allergies) ? userProfile.allergies.join(', ') : userProfile.allergies) : 'None reported';

    const nutritionSummary = nutrition ? `
- Calories: ${nutrition.calories !== undefined && nutrition.calories !== null ? `${nutrition.calories} kcal` : 'Not documented / unlisted'}
- Protein: ${nutrition.protein !== undefined && nutrition.protein !== null ? `${nutrition.protein}g` : 'Not documented / unlisted'}
- Carbohydrates: ${nutrition.carbohydrates !== undefined && nutrition.carbohydrates !== null ? `${nutrition.carbohydrates}g` : 'Not documented / unlisted'}
- Total Fat: ${nutrition.fat !== undefined && nutrition.fat !== null ? `${nutrition.fat}g` : 'Not documented / unlisted'}
- Dietary Fiber: ${nutrition.fiber !== undefined && nutrition.fiber !== null ? `${nutrition.fiber}g` : 'Not documented / unlisted'}
- Sugars: ${nutrition.sugar !== undefined && nutrition.sugar !== null ? `${nutrition.sugar}g` : 'Not documented / unlisted'}
- Sodium: ${nutrition.sodium_mg !== undefined && nutrition.sodium_mg !== null ? `${nutrition.sodium_mg}mg` : 'Not documented / unlisted'}
- Basis: ${nutrition.basis === 'serving' ? 'Per Serving' : 'Per 100g'}
- Identified Vitamins: ${nutrition.vitamins?.length ? nutrition.vitamins.join(', ') : 'None listed'}
- Identified Minerals: ${nutrition.minerals?.length ? nutrition.minerals.join(', ') : 'None listed'}
` : 'Nutritional data not documented on packaging.';

    const languageNames: Record<string, string> = {
      en: 'English',
      id: 'Indonesian (Bahasa Indonesia)',
      ar: 'Arabic (العربية)',
      ur: 'Urdu (اردو)',
      bn: 'Bengali (বাংলা)',
      hi: 'Hindi (हिन्दी)',
      zh: 'Mandarin Chinese (中文)',
      es: 'Spanish (Español)',
      fr: 'French (Français)',
      pt: 'Portuguese (Português)',
      ru: 'Russian (Русский)',
      sw: 'Swahili (Kiswahili)',
      mr: 'Marathi (मराठी)',
      te: 'Telugu (తెలుగు)',
      ta: 'Tamil (தமிழ்)',
      vi: 'Vietnamese (Tiếng Việt)',
      so: 'Somali (Soomaali)',
      my: 'Burmese (မြန်မာ)',
      ko: 'Korean (한국어)',
      tr: 'Turkish (Türkçe)',
      de: 'German (Deutsch)'
    };
    const langName = languageNames[language.toLowerCase()] || language;

    const prompt = `You are a clinical nutritionist and packaged-food advisor for VicCalary.
Write three clear, articulate, highly informative clinical paragraphs ENTIRELY in fluent ${langName} (language code: '${language}') based strictly on verified product data.
Do NOT write in English unless English is requested. All JSON string values must be in ${langName}.

PRODUCT DETAILS:
- Name: ${product.name}
- Brand: ${product.brand || 'Unbranded'}
- Category: ${product.category || 'Packaged Grocery'}
- Serving Size: ${product.serving_size || product.size || '1 serving'}
- Ingredients: ${product.ingredients || 'Not listed'}
- Allergens: ${product.allergens?.length ? product.allergens.join(', ') : 'None declared'}

AUTHORITATIVE NUTRITION:
${nutritionSummary}

USER HEALTH PROFILE:
- Primary Objective: ${userGoal}
- Daily Calorie Target: ${calorieGoal} kcal/day
- Dietary Lifestyle: ${dietaryLifestyle}
- Known Allergies / Dislikes: ${allergies}
- Health Context: ${healthConcerns}

RULES:
1. Ground your text strictly in the facts above. DO NOT invent fictional numbers.
2. If nutrition states 'Not documented / unlisted', explicitly state that nutritional facts are not documented on file; NEVER state, claim, or assume 0g or 0mg for missing macros! Only mention 0g if verified zero-energy (like plain water) or verified 0 on label.
3. INFORMATIVE DESCRIPTIONS: Provide a substantive, well-grounded description (2 to 4 rich sentences) covering product identity, brand origin, culinary/nutritional role, and key packaging attributes. Avoid empty generic one-liners.
4. Keep each paragraph focused, concise, and informative (2 to 4 sentences each). Avoid rambling filler.
5. Output language MUST be ${langName}.

Return ONLY a JSON object:
{
  "description": "A substantive, informative paragraph describing what this product is, its brand, category, serving size, culinary role, and key manufacturing or ingredient characteristics.",
  "vitamins_and_nutrition": "A focused paragraph discussing the nutritional composition based on the product's serving basis. If nutrition is unlisted, clearly state that nutrition facts are unavailable on packaging. If nutrition is available, explain the calories, macronutrient balance (protein, carbs, fats, sugars, fiber, sodium), and any notable vitamins and minerals present.",
  "recommendation": "A clear clinical paragraph analyzing whether this packaged food fits the user's specific health objective (${userGoal}, ${calorieGoal} kcal/day), dietary restrictions, and allergies. State why it is suitable or unsuitable, and advise on appropriate serving frequency.",
  "healthStatus": "GOOD" | "MODERATE" | "POOR"
}`;

    try {
      const response = await callChatCompletionWithFallback({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 480,
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0]?.message?.content || '';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      }
      return null;
    } catch (e) {
      console.error("[ProductAdvisor] Error generating advice:", e);
      return {
        description: `${product.name} is a packaged product by ${product.brand || 'the manufacturer'} in the ${product.category || 'grocery'} category.`,
        vitamins_and_nutrition: nutrition?.calories !== undefined 
          ? `Provides approximately ${nutrition.calories} kcal per ${nutrition.basis === 'serving' ? 'serving' : '100g'}, with ${nutrition.protein || 0}g protein, ${nutrition.carbohydrates || 0}g carbohydrates, and ${nutrition.fat || 0}g fat.`
          : 'Detailed nutritional information is not available on the packaging.',
        recommendation: `Assess this product within your daily calorie goal of ${calorieGoal} kcal and ensure ingredients align with your dietary preferences.`,
        healthStatus: 'MODERATE'
      };
    }
  }
}
