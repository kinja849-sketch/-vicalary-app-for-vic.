import { ALLERGEN_DICTIONARY } from './AllergenDictionary';
import { AuthoritativeRecipe } from './RecipeProvider';

export interface AllergenCheckResult {
  safe: boolean;
  violationReason?: string;
  detectedAllergens: string[];
}

const IGNORED_NONE_VALUES = new Set([
  'none', 'no', 'nil', 'n a', 'na', 'nothing', 'tidak ada', 'tidak', 'hakuna', 'la'
]);

/**
 * Normalizes text for allergen and ingredient matching (including diacritics like ø -> o)
 */
function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses raw user allergy inputs (arrays, comma-separated, or space-separated multi-word strings
 * like "Sea food cheese peanuts" or "peanuts seafood cheese egg whites") into canonical tokens.
 */
export function parseAllergyTokens(rawInput: any): string[] {
  if (!rawInput) return [];
  const rawStrings: string[] = [];
  if (Array.isArray(rawInput)) {
    for (const item of rawInput) {
      if (item != null) rawStrings.push(String(item));
    }
  } else if (typeof rawInput === 'string') {
    rawStrings.push(rawInput);
  }

  const results: string[] = [];
  for (const str of rawStrings) {
    let norm = normalizeText(str);
    if (!norm || IGNORED_NONE_VALUES.has(norm)) continue;

    // Normalize common multi-word allergen phrases before splitting on spaces
    norm = norm
      .replace(/\bsea\s+foods?\b/g, 'seafood')
      .replace(/\bshell\s+fish\b/g, 'shellfish')
      .replace(/\begg\s+whites?\b/g, 'egg')
      .replace(/\begg\s+yolks?\b/g, 'egg')
      .replace(/\bwhole\s+eggs?\b/g, 'egg')
      .replace(/\btree\s+nuts?\b/g, 'tree_nuts')
      .replace(/\bpeanut\s+butter\b/g, 'peanuts')
      .replace(/\bcream\s+cheese\b/g, 'cheese')
      .replace(/\bsour\s+cream\b/g, 'cheese')
      .replace(/\bdairy\s+products?\b/g, 'dairy')
      .replace(/\bcow\s+milk\b/g, 'dairy');

    const parts = str.includes(',') || str.includes(';')
      ? norm.split(/[,;\n]+/).map(s => s.trim())
      : norm.split(/\s+/).map(s => s.trim());

    for (const part of parts) {
      if (part && !IGNORED_NONE_VALUES.has(part) && part !== 'and' && part !== 'or') {
        results.push(part);
      }
    }
  }

  return Array.from(new Set(results));
}

function stripSafePlantCompounds(text: string): string {
  return text
    .replace(/\b(egg|eggs|dairy|cheese|milk|lactose|peanut|peanuts|nut|nuts|seafood|fish|shellfish|gluten|wheat|soy)\s+free\b/g, 'safe_free_label')
    .replace(/\b(dairy\s+free|safe_free_label|plant\s+based|plant|vegan)\s+(mozzarella|cheddar|parmesan|cheese|milk|cream|yogurt|yoghurt|butter|mayo|mayonnaise)\b/g, 'safe_plant_alternative')
    .replace(/\b(coconut|almond|oat|soy|soya|rice|cashew|hemp|flax)\s+(milk|cream|yogurt|yoghurt|butter|cheese)\b/g, '$1_plant_base')
    .replace(/\b(cocoa|shea|sunflower|seed|apple|pumpkin|sunflower\s+seed)\s+butter\b/g, '$1_spread')
    .replace(/\bbutternut\s+squash\b/g, 'squash_veg')
    .replace(/\bwater\s+chestnuts?\b/g, 'water_corm')
    .replace(/\bnutmeg\b/g, 'spice_meg')
    .replace(/\bcoconut\b/g, 'coco_fruit');
}

function resolveDictionaryKeywords(rawAllergy: string): string[] {
  const clean = rawAllergy.replace(/\s+/g, '_');
  if (ALLERGEN_DICTIONARY[clean]) return ALLERGEN_DICTIONARY[clean];
  if (ALLERGEN_DICTIONARY[rawAllergy]) return ALLERGEN_DICTIONARY[rawAllergy];

  if (rawAllergy.includes('egg')) return ALLERGEN_DICTIONARY.egg;
  if (rawAllergy.includes('sea') || rawAllergy.includes('fish') || rawAllergy.includes('shrimp') || rawAllergy.includes('prawn')) {
    return ALLERGEN_DICTIONARY.seafood;
  }
  if (rawAllergy.includes('cheese') || rawAllergy.includes('dairy') || rawAllergy.includes('milk') || rawAllergy.includes('lactose')) {
    return ALLERGEN_DICTIONARY.cheese;
  }
  if (rawAllergy.includes('peanut')) return ALLERGEN_DICTIONARY.peanuts;
  if (rawAllergy.includes('nut')) return ALLERGEN_DICTIONARY.nuts;
  if (rawAllergy.includes('gluten') || rawAllergy.includes('wheat')) return ALLERGEN_DICTIONARY.gluten;
  if (rawAllergy.includes('soy')) return ALLERGEN_DICTIONARY.soy;

  return [rawAllergy];
}

/**
 * Checks if a recipe violates user allergies or disliked foods
 */
export function checkAllergensAndDislikes(
  recipe: Partial<AuthoritativeRecipe> & { title?: string; ingredients?: any[]; dietary_tags?: string[] },
  userAllergies: string[] = [],
  userDislikes: string[] = []
): AllergenCheckResult {
  const detectedAllergens: string[] = [];

  // Build searchable text from title, ingredients, and tags
  const titleNorm = normalizeText(recipe.title);
  const ingredientTexts = (recipe.ingredients || []).map(ing =>
    normalizeText(typeof ing === 'string' ? ing : `${ing.item || ''} ${ing.normalized_name || ''}`)
  );
  const rawCombinedText = `${titleNorm} ${ingredientTexts.join(' ')} ${(recipe.dietary_tags || []).map(normalizeText).join(' ')}`;
  const sanitizedForSafeCompounds = stripSafePlantCompounds(rawCombinedText);

  const parsedAllergies = parseAllergyTokens(userAllergies);

  // 1. Check Allergies
  for (const allergy of parsedAllergies) {
    if (!allergy || IGNORED_NONE_VALUES.has(allergy)) continue;

    const forbiddenKeywords = resolveDictionaryKeywords(allergy);
    const targetText = sanitizedForSafeCompounds;

    for (const keyword of forbiddenKeywords) {
      const kw = normalizeText(keyword);
      if (!kw) continue;
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}(s|es)?(\\s|$)`, 'i');
      if (regex.test(targetText)) {
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
  const parsedDislikes = parseAllergyTokens(userDislikes);
  for (const dislike of parsedDislikes) {
    if (!dislike || IGNORED_NONE_VALUES.has(dislike)) continue;
    const escaped = dislike.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escaped}(s|es)?(\\s|$)`, 'i');
    if (regex.test(rawCombinedText)) {
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
