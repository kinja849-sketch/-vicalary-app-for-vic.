import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

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
- Calories: ${nutrition.calories !== undefined ? `${nutrition.calories} kcal` : 'Not specified'}
- Protein: ${nutrition.protein !== undefined ? `${nutrition.protein}g` : '0g'}
- Carbohydrates: ${nutrition.carbohydrates !== undefined ? `${nutrition.carbohydrates}g` : '0g'}
- Total Fat: ${nutrition.fat !== undefined ? `${nutrition.fat}g` : '0g'}
- Dietary Fiber: ${nutrition.fiber !== undefined ? `${nutrition.fiber}g` : '0g'}
- Sugars: ${nutrition.sugar !== undefined ? `${nutrition.sugar}g` : '0g'}
- Sodium: ${nutrition.sodium_mg !== undefined ? `${nutrition.sodium_mg}mg` : '0mg'}
- Basis: ${nutrition.basis === 'serving' ? 'Per Serving' : 'Per 100g'}
- Identified Vitamins: ${nutrition.vitamins?.length ? nutrition.vitamins.join(', ') : 'None listed'}
- Identified Minerals: ${nutrition.minerals?.length ? nutrition.minerals.join(', ') : 'None listed'}
` : 'Nutritional data not documented on packaging.';

    const prompt = `You are a clinical nutritionist and packaged-food advisor for VicCalary.
Write three substantial, high-quality, readable PARAGRAPHS in fluent '${language}' based on verified product data.

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
1. DO NOT invent fictional nutrition figures. Ground your text in the facts above.
2. If nutrition shows 0g or minimal calories for water or black coffee, explain that factually rather than treating it as missing.
3. Write in rich, articulate, readable PARAGRAPHS. DO NOT write one-liners or fragment sentences.

Return ONLY a JSON object:
{
  "description": "A comprehensive paragraph describing what this product is, its brand, category, serving size, and key manufacturing or ingredient characteristics.",
  "vitamins_and_nutrition": "A substantial paragraph discussing the nutritional composition based on the product's serving basis. Explain the calories, macronutrient balance (protein, carbs, fats, sugars, fiber, sodium), and any notable vitamins and minerals present.",
  "recommendation": "A thorough paragraph analyzing whether this packaged food fits the user's specific health objective (${userGoal}, ${calorieGoal} kcal/day), dietary restrictions, and allergies. Explain why it is suitable or unsuitable, and advise on appropriate serving frequency.",
  "healthStatus": "GOOD" | "MODERATE" | "POOR"
}`;

    try {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
      });

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
