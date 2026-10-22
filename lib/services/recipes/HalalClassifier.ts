/**
 * HalalClassifier.ts
 * Deterministic Halal Eligibility Classification Engine for VicCalary.
 *
 * Evaluates candidate dishes against Islamic dietary guidelines:
 * - HALAL_VERIFIED: Confirmed permissible through naturally halal ingredients or verified halal meat sourcing.
 * - HARAM_DETECTED: Prohibited ingredients present (pork, alcohol, cooking wines, blood, etc.).
 * - HALAL_UNVERIFIED: Sourcing is ambiguous or meat slaughter is unverified.
 *
 * Non-negotiable rule: Only HALAL_VERIFIED recipes may enter the recommendation pool.
 */

export type HalalClassification = 'HALAL_VERIFIED' | 'HARAM_DETECTED' | 'HALAL_UNVERIFIED';

export interface HalalEvaluationResult {
  status: HalalClassification;
  reasons: string[];
  detectedHaramIngredients: string[];
  unverifiedIngredients: string[];
}

// 1. Prohibited Swine Ingredients and Derivatives
const PORK_KEYWORDS = [
  'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard', 'pork belly',
  'pork chop', 'pork loin', 'pork ribs', 'pork sausage', 'guanciale', 'chorizo',
  'pepperoni', 'speck', 'chicharron', 'babi', 'daging babi', 'minyak babi',
  'porcine', 'porcine gelatin', 'pork gelatin', 'sow', 'swine'
];

// 2. Prohibited Alcoholic Beverages, Cooking Wines, and Alcoholic Ingredients
// Alcohol used in cooking does NOT become halal even if cooked/simmered.
const ALCOHOL_KEYWORDS = [
  'wine', 'red wine', 'white wine', 'cooking wine', 'shaoxing', 'shaoxing wine',
  'sherry', 'marsala', 'port wine', 'vermouth', 'prosecco', 'madeira', 'sangria',
  'merlot', 'cabernet', 'chardonnay', 'pinot noir', 'pinot grigio', 'riesling',
  'mirin', 'hon-mirin', 'sake', 'champagne', 'beer', 'ale', 'cider', 'stout',
  'lager', 'rum', 'brandy', 'cognac', 'vodka', 'gin', 'whiskey', 'whisky',
  'bourbon', 'tequila', 'mezcal', 'liqueur', 'liquor', 'spirits', 'kirsch',
  'schnapps', 'triple sec', 'cointreau', 'amaretto', 'kahlua', 'baileys',
  'alcoholic', 'alcohol', 'beer batter', 'wine marinade', 'flambé', 'angostura'
];

// 3. Prohibited Blood and Blood Derivatives
const BLOOD_KEYWORDS = [
  'blood', 'blood sausage', 'black pudding', 'morcilla', 'boudin noir',
  'blood pudding', 'blood tofu', 'daging darah'
];

// 4. Prohibited Insects and Derived Colorings
const INSECT_ADDITIVES = [
  'cochineal', 'carmine', 'carminic acid', 'e120', 'karmin'
];

// 5. Ambiguous Ingredients Requiring Verified Sourcing
const AMBIGUOUS_ADDITIVES = [
  'gelatin', 'gelatine', 'animal rennet', 'rennet', 'pepsin',
  'animal fat', 'tallow', 'suet', 'animal shortening', 'bone broth'
];

// 6. Land Meat & Poultry (Requires Verified Halal Slaughter)
const LAND_MEATS = [
  'chicken', 'beef', 'lamb', 'mutton', 'goat', 'turkey', 'duck', 'veal',
  'ayam', 'sapi', 'kambing', 'daging sapi', 'daging ayam', 'daging kambing', 'bebek'
];

// 7. Verified Halal Culinary Traditions & Home-Cooked Recipe Providers (after passing zero-tolerance Haram & Additive gates)
const VERIFIED_HALAL_PROVIDERS = ['curated', 'halal_curated', 'internal', 'spoonacular', 'themealdb'];
const VERIFIED_HALAL_REGIONS = ['indonesian', 'malaysian', 'middle eastern', 'arabic', 'turkish', 'moroccan'];

function normalizeText(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks whether an ambiguous ingredient has explicit plant or halal qualification.
 * e.g., "agar-agar gelatin", "halal bovine gelatin", "microbial rennet", "vegetable broth"
 */
function isAmbiguityResolvedHalal(phrase: string): boolean {
  const lower = phrase.toLowerCase();
  const safeQualifiers = [
    'halal', 'kosher', 'fish', 'bovine halal', 'plant', 'vegetarian', 'vegan',
    'agar', 'pectin', 'carrageenan', 'microbial', 'vegetable'
  ];
  return safeQualifiers.some(q => lower.includes(q));
}

/**
 * Evaluates candidate recipe against the strict Halal-Only food policy.
 */
export function classifyHalal(candidate: {
  title?: string;
  name?: string;
  ingredients?: Array<any>;
  instructions?: any;
  cuisine?: string;
  cuisine_type?: string;
  provider?: string;
  dietary_tags?: string[] | any;
}): HalalEvaluationResult {
  const reasons: string[] = [];
  const detectedHaramIngredients: string[] = [];
  const unverifiedIngredients: string[] = [];

  const title = candidate.title || candidate.name || '';
  const cuisine = candidate.cuisine || candidate.cuisine_type || '';
  const provider = candidate.provider || '';
  const tags: string[] = Array.isArray(candidate.dietary_tags)
    ? candidate.dietary_tags.map(t => String(t).toLowerCase())
    : [];

  // Extract all text tokens for comprehensive inspection
  const ingredientItems: string[] = [];
  if (Array.isArray(candidate.ingredients)) {
    candidate.ingredients.forEach(ing => {
      if (typeof ing === 'string') {
        ingredientItems.push(ing);
      } else if (ing && typeof ing === 'object') {
        ingredientItems.push(ing.item || ing.name || ing.normalized_name || '');
      }
    });
  }

  let instructionsText = '';
  if (Array.isArray(candidate.instructions)) {
    instructionsText = candidate.instructions.map((inst: any) => 
      typeof inst === 'string' ? inst : (inst?.instruction || inst?.step || '')
    ).join(' ');
  } else if (typeof candidate.instructions === 'string') {
    instructionsText = candidate.instructions;
  }

  const allText = `${title} ${ingredientItems.join(' ')} ${instructionsText}`.toLowerCase();
  const normalizedSearch = normalizeText(allText);

  // --------------------------------------------------------------------------
  // STEP 1: HARAM DETECTION (Zero-Tolerance Hard Gate)
  // --------------------------------------------------------------------------

  // Check Pork & Swine derivatives
  for (const pork of PORK_KEYWORDS) {
    const regex = new RegExp(`(^|\\s)${pork.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(normalizedSearch)) {
      detectedHaramIngredients.push(pork);
      reasons.push(`Contains prohibited pork or swine derivative: "${pork}"`);
    }
  }

  // Check Alcohol & Cooking Alcohol (ignoring explicit "alcohol-free" / "non-alcoholic" qualifiers)
  const alcoholSearch = normalizeText(
    allText.replace(/\b(?:alcohol[-\s]+free|non[-\s]+alcoholic|zero[-\s]+alcohol)\b/gi, ' ')
  );
  for (const alcohol of ALCOHOL_KEYWORDS) {
    const regex = new RegExp(`(^|\\s)${alcohol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(alcoholSearch)) {
      detectedHaramIngredients.push(alcohol);
      reasons.push(`Contains prohibited alcoholic ingredient: "${alcohol}"`);
    }
  }

  // Check Blood & Blood derivatives
  for (const blood of BLOOD_KEYWORDS) {
    const regex = new RegExp(`(^|\\s)${blood.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(normalizedSearch)) {
      detectedHaramIngredients.push(blood);
      reasons.push(`Contains prohibited blood derivative: "${blood}"`);
    }
  }

  // Check Prohibited Insect additives
  for (const insect of INSECT_ADDITIVES) {
    if (normalizedSearch.includes(insect)) {
      detectedHaramIngredients.push(insect);
      reasons.push(`Contains non-halal insect-derived additive: "${insect}"`);
    }
  }

  if (detectedHaramIngredients.length > 0) {
    return {
      status: 'HARAM_DETECTED',
      reasons,
      detectedHaramIngredients: Array.from(new Set(detectedHaramIngredients)),
      unverifiedIngredients: []
    };
  }

  // --------------------------------------------------------------------------
  // STEP 2: AMBIGUOUS ADDITIVES CHECK
  // --------------------------------------------------------------------------
  for (const item of ingredientItems) {
    const lowerItem = item.toLowerCase();
    for (const ambiguous of AMBIGUOUS_ADDITIVES) {
      if (lowerItem.includes(ambiguous)) {
        if (!isAmbiguityResolvedHalal(lowerItem)) {
          unverifiedIngredients.push(item);
          reasons.push(`Ingredient "${item}" contains ambiguous "${ambiguous}" without verified plant or halal source`);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 3: MEAT SOURCING & SLAUGHTER VERIFICATION
  // --------------------------------------------------------------------------
  // Determine if land meat is present
  const hasLandMeat = LAND_MEATS.some(meat => {
    const regex = new RegExp(`(^|\\s)${meat}(\\s|$)`, 'i');
    return regex.test(normalizedSearch);
  });

  if (hasLandMeat) {
    const isCurated = VERIFIED_HALAL_PROVIDERS.includes(provider.toLowerCase());
    const isHalalTagged = tags.some(t => t.includes('halal'));
    const isVerifiedRegion = VERIFIED_HALAL_REGIONS.some(r => cuisine.toLowerCase().includes(r));
    const specifiesHalal = ingredientItems.some(i => i.toLowerCase().includes('halal'));

    // Sourcing verification rule
    const isMeatSourcingVerified = isCurated || isHalalTagged || isVerifiedRegion || specifiesHalal;

    if (!isMeatSourcingVerified) {
      unverifiedIngredients.push('Unverified meat sourcing');
      reasons.push(`Dish contains land meat but lacks verified Halal slaughter or certification`);
    }
  }

  // If any unverified elements exist, classify as HALAL_UNVERIFIED
  if (unverifiedIngredients.length > 0) {
    return {
      status: 'HALAL_UNVERIFIED',
      reasons,
      detectedHaramIngredients: [],
      unverifiedIngredients: Array.from(new Set(unverifiedIngredients))
    };
  }

  // --------------------------------------------------------------------------
  // STEP 4: HALAL VERIFIED
  // --------------------------------------------------------------------------
  return {
    status: 'HALAL_VERIFIED',
    reasons: ['All ingredients and sourcing conform to Islamic dietary guidelines.'],
    detectedHaramIngredients: [],
    unverifiedIngredients: []
  };
}
