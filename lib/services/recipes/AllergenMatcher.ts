import { ALLERGEN_DICTIONARY } from './AllergenDictionary';
import { AuthoritativeRecipe } from './RecipeProvider';

export interface AllergenCheckResult {
  safe: boolean;
  violationReason?: string;
  detectedAllergens: string[];
}

/**
 * Normalizes text for allergen and ingredient matching
 */
function normalizeText(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks if a recipe violates user allergies or disliked foods
 */
export function checkAllergensAndDislikes(
  recipe: AuthoritativeRecipe,
  userAllergies: string[] = [],
  userDislikes: string[] = []
): AllergenCheckResult {
  const detectedAllergens: string[] = [];

  // Build searchable text from title, ingredients, and tags
  const titleNorm = normalizeText(recipe.title);
  const ingredientTexts = recipe.ingredients.map(ing => normalizeText(typeof ing === 'string' ? ing : `${ing.item} ${ing.normalized_name || ''}`));
  const combinedText = `${titleNorm} ${ingredientTexts.join(' ')} ${recipe.dietary_tags.map(normalizeText).join(' ')}`;

  // 1. Check Allergies
  for (const allergy of userAllergies) {
    const rawAllergy = normalizeText(allergy);
    if (!rawAllergy || rawAllergy === 'none') continue;

    // Retrieve dictionary list or fallback to direct keyword
    const dictionaryKey = Object.keys(ALLERGEN_DICTIONARY).find(k => k === rawAllergy || rawAllergy.includes(k) || k.includes(rawAllergy));
    const forbiddenKeywords = dictionaryKey ? ALLERGEN_DICTIONARY[dictionaryKey] : [rawAllergy];

    for (const keyword of forbiddenKeywords) {
      const kw = keyword.toLowerCase();
      // Match whole word or contained phrase
      const regex = new RegExp(`(^|\\s)${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (regex.test(combinedText) || combinedText.includes(kw)) {
        detectedAllergens.push(allergy);
        return {
          safe: false,
          violationReason: `Recipe contains prohibited allergen: "${keyword}" (Allergy: ${allergy})`,
          detectedAllergens
        };
      }
    }
  }

  // 2. Check Disliked Foods
  for (const dislike of userDislikes) {
    const rawDislike = normalizeText(dislike);
    if (!rawDislike || rawDislike === 'none') continue;

    const regex = new RegExp(`(^|\\s)${rawDislike.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(combinedText) || combinedText.includes(rawDislike)) {
      return {
        safe: false,
        violationReason: `Recipe contains user-disliked food: "${dislike}"`,
        detectedAllergens
      };
    }
  }

  return {
    safe: true,
    detectedAllergens: []
  };
}
