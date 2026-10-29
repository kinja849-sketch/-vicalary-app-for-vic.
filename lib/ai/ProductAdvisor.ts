import { callChatCompletionWithFallback } from './ai-fallback';

export class ProductAdvisor {
  /**
   * Builds a rich, multi-sentence deterministic product description grounded strictly in verified catalog facts.
   */
  static buildDeterministicDescription(product: any, nutrition: any): string {
    const name = product?.name || 'Packaged Product';
    const brand = product?.brand;
    const manufacturer = product?.manufacturer && product.manufacturer !== brand ? product.manufacturer : undefined;
    const category = product?.category || 'grocery';
    const origin = product?.origin_country;
    const size = product?.size || product?.serving_size;
    const genericName = product?.generic_name && product.generic_name.toLowerCase() !== name.toLowerCase() ? product.generic_name : undefined;

    const sentence1Parts: string[] = [];
    sentence1Parts.push(`${name}${genericName ? ` (${genericName})` : ''} is a packaged ${category.toLowerCase()} product`);
    if (brand && manufacturer) {
      sentence1Parts.push(`marketed under the ${brand} brand by ${manufacturer}`);
    } else if (brand) {
      sentence1Parts.push(`produced by ${brand}`);
    } else if (manufacturer) {
      sentence1Parts.push(`manufactured by ${manufacturer}`);
    }
    if (origin) {
      sentence1Parts.push(`with documented origin/distribution in ${origin}`);
    }
    const sentence1 = `${sentence1Parts.join(' ')}.`;

    const detailsParts: string[] = [];
    if (size) {
      detailsParts.push(`Stated package/serving quantity is ${size}`);
    }
    if (product?.nutriscore_grade) {
      detailsParts.push(`Nutri-Score grade ${product.nutriscore_grade}`);
    }
    if (product?.nova_group) {
      const novaLabels: Record<number, string> = {
        1: 'unprocessed or minimally processed foods',
        2: 'processed culinary ingredients',
        3: 'processed foods',
        4: 'ultra-processed food and drink products'
      };
      detailsParts.push(`NOVA Group ${product.nova_group} (${novaLabels[product.nova_group] || 'processed food'})`);
    }

    const rawIng = typeof product?.ingredients === 'string' ? product.ingredients.trim() : '';
    const hasRealIng =
      rawIng.length > 0 &&
      !rawIng.toLowerCase().includes('not listed in database') &&
      !rawIng.toLowerCase().includes('unavailable');

    if (hasRealIng) {
      const topItems = rawIng
        .split(/[,;]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (topItems.length > 0) {
        detailsParts.push(`key declared ingredients include ${topItems.join(', ')}`);
      }
    }

    const sentence2 = detailsParts.length > 0
      ? `${detailsParts.join('; ').replace(/^./, c => c.toUpperCase())}.`
      : '';

    const coloringSummary = product?.coloring?.summary;
    const sentence3 = coloringSummary && !product?.coloring?.is_unknown
      ? `${coloringSummary}.`
      : '';

    const basisLabel = nutrition?.basis === 'serving'
      ? `per ${product?.serving_size || 'serving'}`
      : 'per 100g';
    const sentence4 = nutrition?.calories !== undefined && nutrition?.calories !== null
      ? `Nutritionally, it supplies ${nutrition.calories} kcal ${basisLabel}.`
      : 'Catalog nutrition facts are currently unlisted for this barcode.';

    return [sentence1, sentence2, sentence3, sentence4].filter(Boolean).join(' ');
  }

  /**
   * Builds a deterministic nutrition summary paragraph without inventing numbers or turning missing macros into 0g.
   */
  static buildDeterministicNutritionParagraph(product: any, nutrition: any): string {
    if (!nutrition || nutrition.calories === undefined || nutrition.calories === null) {
      return 'Authoritative nutrition facts (calories and macronutrients) are not documented in the barcode catalog for this product. Please refer to the printed Nutrition Facts panel on the physical package.';
    }

    const basisLabel = nutrition.basis === 'serving'
      ? `per serving (${product?.serving_size || '1 serving'})`
      : 'per 100g';

    const macroParts: string[] = [];
    if (nutrition.protein !== undefined && nutrition.protein !== null) macroParts.push(`${nutrition.protein}g protein`);
    if (nutrition.carbohydrates !== undefined && nutrition.carbohydrates !== null) macroParts.push(`${nutrition.carbohydrates}g carbohydrates`);
    if (nutrition.fat !== undefined && nutrition.fat !== null) macroParts.push(`${nutrition.fat}g total fat`);
    if (nutrition.sugar !== undefined && nutrition.sugar !== null) macroParts.push(`${nutrition.sugar}g sugars`);
    if (nutrition.fiber !== undefined && nutrition.fiber !== null) macroParts.push(`${nutrition.fiber}g dietary fiber`);
    if (nutrition.sodium_mg !== undefined && nutrition.sodium_mg !== null) macroParts.push(`${nutrition.sodium_mg}mg sodium`);

    const macroSentence = macroParts.length > 0
      ? `Declared macronutrients include ${macroParts.join(', ')}.`
      : 'Individual macronutrient gram weights are not itemized on the catalog record.';

    const microParts: string[] = [];
    if (Array.isArray(nutrition.vitamins) && nutrition.vitamins.length > 0) {
      microParts.push(`vitamins (${nutrition.vitamins.join(', ')})`);
    }
    if (Array.isArray(nutrition.minerals) && nutrition.minerals.length > 0) {
      microParts.push(`minerals (${nutrition.minerals.join(', ')})`);
    }
    const microSentence = microParts.length > 0
      ? `Notable micronutrients identified include ${microParts.join(' and ')}.`
      : '';

    return [`This product provides ${nutrition.calories} kcal ${basisLabel}.`, macroSentence, microSentence]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Builds a deterministic recommendation paragraph aligned with SafetyEngine & GoalFit.
   */
  static buildDeterministicRecommendation(product: any, nutrition: any, userProfile: any, safetyEval?: any): string {
    const parts: string[] = [];

    if (safetyEval?.allergyWarnings?.length > 0) {
      parts.push(safetyEval.allergyWarnings.join(' '));
    }
    if (safetyEval?.medicalWarnings?.length > 0) {
      parts.push(safetyEval.medicalWarnings.join(' '));
    }
    if (safetyEval?.goalFit) {
      parts.push(`${safetyEval.goalFit.headline}: ${safetyEval.goalFit.reason}`);
    } else {
      const calorieGoal = userProfile?.daily_calorie_goal || 2000;
      const goal = userProfile?.goal || 'healthy lifestyle';
      if (nutrition?.calories !== undefined && nutrition?.calories !== null) {
        parts.push(
          `At ${nutrition.calories} kcal (${nutrition.basis === 'serving' ? 'per serving' : 'per 100g'}), factor this item into your ${calorieGoal} kcal daily target for your ${goal} objective.`
        );
      } else {
        parts.push(
          `Verify the physical nutrition label against your ${calorieGoal} kcal daily target and ${goal} objective before logging.`
        );
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Generates substantial, readable paragraph explanations for scanned packaged products,
   * grounded strictly in authoritative product, nutrition, and safety data.
   */
  static async analyze(
    product: any,
    nutrition: any,
    _pricing: any,
    userProfile: any,
    language: string = 'en',
    safetyEval?: any
  ) {
    if (!product) return null;

    const deterministicDesc = this.buildDeterministicDescription(product, nutrition);
    const deterministicNutrition = this.buildDeterministicNutritionParagraph(product, nutrition);
    const deterministicRec = this.buildDeterministicRecommendation(product, nutrition, userProfile, safetyEval);
    const deterministicVerdict = safetyEval?.verdict || 'GOOD';

    const userGoal = userProfile?.goal || 'maintain a healthy lifestyle';
    const calorieGoal = userProfile?.daily_calorie_goal || 2000;
    const dietaryLifestyle = Array.isArray(userProfile?.dietary_lifestyle)
      ? userProfile.dietary_lifestyle.join(', ') || 'Standard diet'
      : (userProfile?.dietary_lifestyle || 'Standard diet');
    const healthConcerns = userProfile?.health_conditions || userProfile?.medical_conditions || 'None reported';
    const allergies = userProfile?.allergies
      ? (Array.isArray(userProfile.allergies) ? userProfile.allergies.join(', ') : String(userProfile.allergies))
      : 'None reported';

    const hasCalories = nutrition && nutrition.calories !== undefined && nutrition.calories !== null;

    const nutritionSummary = hasCalories
      ? `
- Calories: ${nutrition.calories} kcal
- Protein: ${nutrition.protein !== undefined && nutrition.protein !== null ? `${nutrition.protein}g` : 'Not documented'}
- Carbohydrates: ${nutrition.carbohydrates !== undefined && nutrition.carbohydrates !== null ? `${nutrition.carbohydrates}g` : 'Not documented'}
- Total Fat: ${nutrition.fat !== undefined && nutrition.fat !== null ? `${nutrition.fat}g` : 'Not documented'}
- Dietary Fiber: ${nutrition.fiber !== undefined && nutrition.fiber !== null ? `${nutrition.fiber}g` : 'Not documented'}
- Sugars: ${nutrition.sugar !== undefined && nutrition.sugar !== null ? `${nutrition.sugar}g` : 'Not documented'}
- Sodium: ${nutrition.sodium_mg !== undefined && nutrition.sodium_mg !== null ? `${nutrition.sodium_mg}mg` : 'Not documented'}
- Basis: ${nutrition.basis === 'serving' ? `Per Serving (${product.serving_size || '1 serving'})` : 'Per 100g'}
- Identified Vitamins: ${nutrition.vitamins?.length ? nutrition.vitamins.join(', ') : 'None listed'}
- Identified Minerals: ${nutrition.minerals?.length ? nutrition.minerals.join(', ') : 'None listed'}
`
      : 'Nutritional data is NOT documented in the barcode catalog for this item.';

    const safetyContext = safetyEval
      ? `
DETERMINISTIC SAFETY & GOAL EVALUATION (MUST BE RESPECTED):
- Overall Verdict: ${safetyEval.verdict}
- Allergy Warnings: ${safetyEval.allergyWarnings?.length ? safetyEval.allergyWarnings.join(' | ') : 'None triggered'}
- Medical Warnings: ${safetyEval.medicalWarnings?.length ? safetyEval.medicalWarnings.join(' | ') : 'None triggered'}
- Goal Fit Headline: ${safetyEval.goalFit?.headline || 'N/A'}
- Goal Fit Reason: ${safetyEval.goalFit?.reason || 'N/A'}
`
      : '';

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
Write three clear, articulate, informative clinical paragraphs ENTIRELY in fluent ${langName} (language code: '${language}') based strictly on verified product data.

PRODUCT DETAILS:
- Name: ${product.name}
- Generic Name: ${product.generic_name || 'N/A'}
- Brand: ${product.brand || 'Unbranded'}
- Manufacturer / Parent: ${product.manufacturer || product.brand || 'Unspecified'}
- Origin / Market: ${product.origin_country || 'Unspecified'}
- Category: ${product.category || 'Packaged Grocery'}
- Package / Serving Size: ${product.size || product.serving_size || 'Unspecified'}
- Declared Ingredients: ${product.ingredients || 'Not listed in catalog'}
- Food Coloring Analysis: ${product.coloring?.summary || 'Unknown'}
- Declared Allergens: ${product.allergens?.length ? product.allergens.join(', ') : 'None declared'}
- Nutri-Score / NOVA: ${product.nutriscore_grade ? `Nutri-Score ${product.nutriscore_grade}` : 'N/A'}, ${product.nova_group ? `NOVA Group ${product.nova_group}` : 'N/A'}

AUTHORITATIVE NUTRITION:
${nutritionSummary}

USER HEALTH PROFILE:
- Primary Objective: ${userGoal}
- Daily Calorie Target: ${calorieGoal} kcal/day
- Dietary Lifestyle: ${dietaryLifestyle}
- Declared Allergies / Restrictions: ${allergies}
- Health Context: ${healthConcerns}
${safetyContext}

STRICT NON-HALLUCINATION RULES:
1. Ground your text strictly in the facts above. NEVER invent calories, gram weights, prices, or ingredients.
2. If nutrition states 'NOT documented' or a macro says 'Not documented', explicitly state that nutrition facts are unavailable in the catalog; NEVER state 0 kcal or 0g for undocumented macros!
3. DESCRIPTION: Write 2 to 4 substantive sentences covering product identity, brand/manufacturer, category, package size, and key declared ingredients or processing characteristics.
4. RECOMMENDATION: Explicitly highlight any triggered allergy warnings, medical warnings, and how the product fits the user's primary objective (${userGoal}, ${calorieGoal} kcal/day).
5. Output language MUST be ${langName}.

Return ONLY a JSON object:
{
  "description": "Substantive 2-4 sentence product description.",
  "vitamins_and_nutrition": "Focused paragraph explaining the exact verified calories, macros, and basis, or clearly stating that catalog nutrition is unavailable.",
  "recommendation": "Profile-aware clinical recommendation highlighting allergy safety and alignment with the user's goal (${userGoal}).",
  "healthStatus": "${deterministicVerdict}"
}`;

    try {
      const response = await callChatCompletionWithFallback({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.15,
        max_tokens: 520,
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0]?.message?.content || '';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

        const finalDescription =
          typeof parsed.description === 'string' && parsed.description.trim().length >= 60
            ? parsed.description.trim()
            : deterministicDesc;

        // Guard against LLM inventing kcal numbers when nutrition is unavailable
        let finalNutritionText =
          typeof parsed.vitamins_and_nutrition === 'string' && parsed.vitamins_and_nutrition.trim().length >= 30
            ? parsed.vitamins_and_nutrition.trim()
            : deterministicNutrition;

        if (!hasCalories && /\b\d+\s*(?:kcal|calories|kalori)\b/i.test(finalNutritionText)) {
          finalNutritionText = deterministicNutrition;
        }

        const finalRecText =
          typeof parsed.recommendation === 'string' && parsed.recommendation.trim().length >= 30
            ? parsed.recommendation.trim()
            : deterministicRec;

        return {
          description: finalDescription,
          vitamins_and_nutrition: finalNutritionText,
          recommendation: finalRecText,
          healthStatus: deterministicVerdict
        };
      }
    } catch (e) {
      console.error('[ProductAdvisor] Error generating advice, using deterministic facts:', e);
    }

    return {
      description: deterministicDesc,
      vitamins_and_nutrition: deterministicNutrition,
      recommendation: deterministicRec,
      healthStatus: deterministicVerdict
    };
  }
}
