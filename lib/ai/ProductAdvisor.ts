import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export class ProductAdvisor {
  static async analyze(product: any, nutrition: any, price: any, userProfile: any, language: string) {
    if (!product) return null;
    
    // Only analyze if we have actual nutrition or if it's explicitly requested.
    const prompt = `You are a nutrition advisor.
Evaluate this product strictly based on verified data. DO NOT invent macros.
User profile: Daily Calorie Goal = ${userProfile?.daily_calorie_goal || 'Unknown'}.
Product: ${product.name}
Nutrition: ${JSON.stringify(nutrition || 'Unavailable')}

Provide exactly this JSON structure (in ${language}):
{
  "description": "Short factual description of the product.",
  "recommendation": "1-2 sentence recommendation for the user.",
  "vitamins_and_nutrition": "1 sentence summarizing vitamins/minerals if present.",
  "healthStatus": "GOOD" | "MODERATE" | "POOR"
}`;

    try {
      const { text } = await generateText({
        model: openai('gpt-4o'),
        prompt,
      });

      let jsonStart = text.indexOf('{');
      let jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      }
      return null;
    } catch (e) {
      console.error("[ProductAdvisor] Error", e);
      return null;
    }
  }
}
