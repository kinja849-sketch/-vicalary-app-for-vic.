/**
 * GoalOrientedRanker.ts
 * Deterministic nutritional scoring, dietary filtering, and per-user onboarding ranking engine.
 *
 * Ensures every user's own onboarding responses shape their meal suggestions:
 * - Goal (Lose Weight / Gain Weight / Maintain Weight across English, Indonesian, Swahili, Burmese)
 * - Daily Calorie Goal (per-category calorie budget matching)
 * - Dietary Preference & Lifestyle (High-protein, Low-carb, Keto, Balanced, Vegan, Vegetarian)
 * - Meal Prep Time & Cooking Skill (Beginner / Intermediate / Advanced, <15m / 15-30m / 30-60m)
 * - Medical Conditions (Secondary lymphedema, Acid reflux, Diabetes, Hypertension)
 * - Liked Foods & Preferred Cuisines
 * - Deterministic Per-User Differentiation so every user receives uniquely tailored meal options
 */

import { AuthoritativeRecipe, MealCategory } from './RecipeProvider';

export interface UserRankingContext {
  userId?: string;
  goal?: string;
  dailyCalorieGoal?: number;
  activityLevel?: string;
  preferredCuisines?: string[];
  likedFoods?: string[];
  dislikedFoods?: string[];
  allergies?: string[];
  medicalConditions?: string[];
  dietaryPreference?: string;
  dietaryLifestyle?: string[];
  cookingSkill?: string;
  mealPrepTime?: string;
  favoriteRecipeIds?: Set<string>;
}

export interface ScoredRecipe {
  recipe: AuthoritativeRecipe;
  score: number;
  matchReasons: string[];
}

export type NormalizedGoal = 'lose_weight' | 'gain_weight' | 'maintain_weight';

export function normalizeOnboardingGoal(rawGoal?: string): NormalizedGoal {
  const g = (rawGoal || '').toLowerCase().trim();
  if (
    g.includes('lose') ||
    g.includes('loss') ||
    g.includes('reduction') ||
    g.includes('deficit') ||
    g.includes('turun') ||
    g.includes('kupunguza') ||
    g.includes('လျှော့')
  ) {
    return 'lose_weight';
  }
  if (
    g.includes('gain') ||
    g.includes('muscle') ||
    g.includes('bulk') ||
    g.includes('hypertrophy') ||
    g.includes('kuongeza') ||
    g.includes('tambah') ||
    g.includes('တိုး')
  ) {
    return 'gain_weight';
  }
  return 'maintain_weight';
}

export interface DietaryFlags {
  isVegan: boolean;
  isVegetarian: boolean;
  isHighProtein: boolean;
  isLowCarb: boolean;
  isBalanced: boolean;
}

export function extractDietaryFlags(context: UserRankingContext): DietaryFlags {
  const combined = [
    context.dietaryPreference || '',
    ...(context.dietaryLifestyle || [])
  ]
    .join(' ')
    .toLowerCase();

  return {
    isVegan: /\b(vegan|nabati)\b/.test(combined) || combined.includes('နို့၊ ဥ မပါ'),
    isVegetarian: /\b(vegetarian)\b/.test(combined) || combined.includes('သက်သတ်လွတ်'),
    isHighProtein: /high[\s\-]*protein|tinggi\s*protein|protini\s*nyingi|ပရိုတင်း/.test(combined),
    isLowCarb: /low[\s\-]*carb|keto|rendah\s*karbo|ကာဗိုဟိုက်ဒရိတ်/.test(combined),
    isBalanced: /\b(balanced|seimbang|usawa)\b/.test(combined) || combined.includes('မျှတသော')
  };
}

export function parseMaxPrepMinutes(mealPrepTime?: string): number {
  const p = (mealPrepTime || '').toLowerCase();
  if (p.includes('less than 15') || p.includes('< 15') || p.includes('kurang dari 15')) return 15;
  if (p.includes('15-30') || p.includes('15 - 30') || p.includes('15–30')) return 30;
  if (p.includes('30-60') || p.includes('30 - 60') || p.includes('30–60')) return 60;
  return 45;
}

const OBSCURE_OR_UNREALISTIC_PATTERNS = [
  /r[øo]mmegr[øo]t/i,
  /sledz\s+w\s+oleju/i,
  /polish\s+herrings?/i,
  /algerian\s+flafla/i,
  /tahwa\s+kembang/i,
  /handesh/i,
  /kusksu/i,
  /chivito\s+uruguayo/i,
  /breakfast\s+pastries/i,
  /black\s+tea\s+soy\s+latte/i,
  /bubur\s+manado/i,
  /pepes\s+ikan/i,
  /pepes\s+tahu/i,
  /ikan\s+tongkol/i,
  /tumis\s+/i,
  /saus\s+tiram/i,
  /sayur\s+/i,
  /kolak\s+pisang/i,
  /wedang\s+jahe/i,
  /kunyit\s+asam/i,
  /bola\s+ubi/i,
  /singkong\s+rebus/i,
  /ubi\s+cilembu/i,
  /sate\s+dada\s+ayam/i,
  /capcay\s+goreng/i,
  /milanesa/i,
  /nasi\s+merah/i,
  /torrijas/i,
  /padron\s+peppers/i,
  /patatas\s+bravas/i,
  /sup\s+ayam/i,
  /soto\s+ayam/i,
  /ayam\s+bakar/i,
  /dada\s+ayam/i,
  /ikan\s+nila/i,
  /ikan\s+kembung/i,
  /telur\s+rebus/i,
  /roti\s+gandum/i,
  /puding\s+chia/i,
  /es\s+timun/i,
  /jus\s+alpukat/i
];

function stripPlantSafeTerms(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(oat|almond|coconut|soy|rice|cashew|hemp)\s+milk\b/g, 'plant_beverage')
    .replace(/\b(peanut|sunflower\s+seed|almond|cashew|cocoa|shea)\s+butter\b/g, 'plant_spread')
    .replace(/\bcoconut\s+cream\b/g, 'plant_cream');
}

/**
 * Hard gate for dietary lifestyle (Vegan / Vegetarian) and everyday meal practicality.
 */
export function passesDietaryAndPracticalityGate(
  recipe: AuthoritativeRecipe,
  context: UserRankingContext
): boolean {
  const title = (recipe.title || '').trim();
  if (!title) return false;

  // Reject obscure/unrealistic or untranslated regional dishes so suggestions stay practical
  if (OBSCURE_OR_UNREALISTIC_PATTERNS.some(rx => rx.test(title))) {
    return false;
  }

  const flags = extractDietaryFlags(context);
  if (!flags.isVegan && !flags.isVegetarian) {
    return true;
  }

  const rawText = `${title} ${(recipe.ingredients || [])
    .map(i => (typeof i === 'string' ? i : `${i.item} ${i.normalized_name || ''}`))
    .join(' ')}`;
  const cleaned = stripPlantSafeTerms(rawText);

  const meatOrFishRegex = /\b(chicken|turkey|beef|steak|sirloin|lamb|mutton|veal|duck|goose|meat|fish|salmon|tuna|cod|tilapia|snapper|trout|mackerel|sardine|anchovy|shrimp|prawn|crab|lobster|seafood|oyster\s+sauce|saus\s+tiram|fish\s+sauce|chicken\s+broth|beef\s+broth)\b/i;

  if (flags.isVegetarian || flags.isVegan) {
    if (meatOrFishRegex.test(cleaned)) {
      return false;
    }
  }

  if (flags.isVegan) {
    const animalProductRegex = /\b(egg|eggs|egg\s+white|egg\s+yolk|mayonnaise|milk|whole\s+milk|skim\s+milk|cheese|cream\s+cheese|cottage\s+cheese|parmesan|cheddar|mozzarella|feta|ricotta|yogurt|greek\s+yogurt|butter|ghee|heavy\s+cream|sour\s+cream|whey|casein|honey)\b/i;
    if (animalProductRegex.test(cleaned)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns expected target calories for a specific meal category based on daily goal.
 */
export function getCategoryCalorieBudget(
  dailyCalories: number,
  category: MealCategory
): { min: number; target: number; max: number } {
  const daily = Math.max(1200, dailyCalories || 2000);

  switch (category) {
    case 'breakfast': {
      const bfTarget = Math.round(daily * 0.22);
      return { min: Math.max(220, bfTarget - 110), target: bfTarget, max: bfTarget + 110 };
    }
    case 'lunch': {
      const lunchTarget = Math.round(daily * 0.32);
      return { min: Math.max(320, lunchTarget - 130), target: lunchTarget, max: lunchTarget + 130 };
    }
    case 'dinner': {
      const dinTarget = Math.round(daily * 0.28);
      return { min: Math.max(300, dinTarget - 120), target: dinTarget, max: dinTarget + 120 };
    }
    case 'snack': {
      const snackTarget = Math.round(daily * 0.09);
      return { min: 90, target: snackTarget, max: snackTarget + 60 };
    }
    case 'drink':
      return { min: 15, target: 95, max: 210 };
    case 'dessert':
      return { min: 95, target: 165, max: 240 };
    default:
      return { min: 300, target: 450, max: 600 };
  }
}

function deterministicHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/**
 * Deterministically scores a candidate recipe according to the user's onboarding responses.
 */
export function scoreRecipeForUser(
  recipe: AuthoritativeRecipe,
  context: UserRankingContext,
  category: MealCategory
): ScoredRecipe {
  let score = 50;
  const matchReasons: string[] = [];

  // Reward practical everyday curated Halal recipes so restaurant/obscure dishes never dominate
  if (recipe.provider === 'curated') {
    score += 24;
  }

  const goal = normalizeOnboardingGoal(context.goal);
  const dietaryFlags = extractDietaryFlags(context);
  const maxPrepMinutes = parseMaxPrepMinutes(context.mealPrepTime);

  const calories = recipe.nutrition?.calories || recipe.total_calories || 0;
  const protein = recipe.nutrition?.protein_g || recipe.protein_g || 0;
  const carbs = recipe.nutrition?.carbs_g || recipe.carbs_g || 0;
  const fat = recipe.nutrition?.fat_g || recipe.fat_g || 0;

  const budget = getCategoryCalorieBudget(context.dailyCalorieGoal || 2000, category);

  // --------------------------------------------------------------------------
  // 1. OBJECTIVE-DRIVEN NUTRITIONAL SCORING (Lose / Gain / Maintain Weight)
  // --------------------------------------------------------------------------
  if (goal === 'lose_weight') {
    if (calories <= budget.target && calories >= budget.min - 40) {
      score += 26;
      matchReasons.push(`Fits your weight-loss target (${calories} kcal vs ~${budget.target} kcal budget)`);
    } else if (calories <= budget.max) {
      score += 14;
      matchReasons.push(`Within your ${budget.max} kcal ${category} limit`);
    } else {
      const overPct = (calories - budget.max) / Math.max(100, budget.max);
      score -= Math.min(45, Math.round(overPct * 60));
    }

    // Protein density supports satiety & lean mass retention during weight loss
    const proteinCalRatio = (protein * 4) / Math.max(1, calories);
    if (proteinCalRatio >= 0.25 || (category === 'snack' && protein >= 10)) {
      score += 18;
      matchReasons.push(`High protein satiety (${protein}g protein)`);
    } else if (proteinCalRatio >= 0.16) {
      score += 10;
    }
  } else if (goal === 'gain_weight') {
    if (calories >= budget.target) {
      score += 24;
      matchReasons.push(`Supports healthy weight & muscle gain (${calories} kcal)`);
    } else if (calories >= budget.min) {
      score += 12;
    } else {
      score -= 12;
    }

    if (protein >= 32) {
      score += 26;
      matchReasons.push(`High muscle-building protein (${protein}g)`);
    } else if (protein >= 20) {
      score += 16;
      matchReasons.push(`Solid protein support (${protein}g)`);
    }
  } else {
    // Maintain Weight
    const diff = Math.abs(calories - budget.target);
    const proximityBonus = Math.max(0, 24 - Math.round(diff / 12));
    score += proximityBonus;
    if (proximityBonus >= 14) {
      matchReasons.push(`Balanced energy for weight maintenance (${calories} kcal)`);
    }
    if (protein >= 18 && fat >= 6) {
      score += 10;
    }
  }

  // --------------------------------------------------------------------------
  // 2. DIETARY PREFERENCE & LIFESTYLE SCORING
  // --------------------------------------------------------------------------
  if (dietaryFlags.isHighProtein) {
    if ((category === 'lunch' || category === 'dinner') && protein >= 34) {
      score += 22;
      matchReasons.push(`Matches High-Protein preference (${protein}g protein)`);
    } else if (category === 'breakfast' && protein >= 20) {
      score += 20;
      matchReasons.push(`High-protein breakfast (${protein}g protein)`);
    } else if (category === 'snack' && protein >= 10) {
      score += 18;
      matchReasons.push(`High-protein snack (${protein}g protein)`);
    } else if (protein >= 12) {
      score += 8;
    }
  }

  if (dietaryFlags.isLowCarb) {
    if (carbs <= 22) {
      score += 24;
      matchReasons.push(`Matches Low-Carb preference (${carbs}g net carbs)`);
    } else if (carbs <= 35) {
      score += 10;
    } else if (carbs > 48) {
      score -= 18;
    }
  }

  if (dietaryFlags.isVegan) {
    score += 15;
    matchReasons.push('100% plant-based Vegan Halal meal');
  } else if (dietaryFlags.isVegetarian) {
    score += 12;
    matchReasons.push('Vegetarian Halal meal');
  }

  // --------------------------------------------------------------------------
  // 3. MEAL PREP TIME & COOKING SKILL ALIGNMENT
  // --------------------------------------------------------------------------
  const prepTime = recipe.prep_time_minutes || 15;
  if (prepTime <= maxPrepMinutes) {
    score += 12;
    if (context.mealPrepTime) {
      matchReasons.push(`Ready in ${prepTime} mins (fits your ${context.mealPrepTime} schedule)`);
    }
  } else {
    score -= Math.min(15, Math.round((prepTime - maxPrepMinutes) / 2));
  }

  const skill = (context.cookingSkill || '').toLowerCase();
  const isBeginner = skill.includes('beginner') || skill.includes('pemula') || skill.includes('anza');
  if (isBeginner && prepTime <= 15 && (recipe.instructions?.length || 3) <= 3) {
    score += 10;
    matchReasons.push('Simple 3-step beginner-friendly recipe');
  }

  // --------------------------------------------------------------------------
  // 4. MEDICAL CONDITIONS ADJUSTMENTS
  // --------------------------------------------------------------------------
  const conditions = (context.medicalConditions || []).map(c => c.toLowerCase());
  const dishText = `${recipe.title} ${(recipe.ingredients || [])
    .map(i => (typeof i === 'string' ? i : i.item))
    .join(' ')}`.toLowerCase();

  const hasLymphedema = conditions.some(c => c.includes('lymphedema'));
  const hasAcidReflux = conditions.some(c => c.includes('reflux') || c.includes('gerd') || c.includes('ulcer'));
  const isDiabetic = conditions.some(c => c.includes('diabet') || c.includes('sugar'));
  const hasHypertension = conditions.some(c => c.includes('hypertens') || c.includes('blood pressure'));

  if (hasLymphedema) {
    if (/\b(spinach|broccoli|berries|blueberries|strawberries|oats|chia|turmeric|ginger|cucumber|lentil|chickpea|sweet potato|olive oil|chicken breast)\b/.test(dishText)) {
      score += 14;
      matchReasons.push('Anti-inflammatory whole foods supportive of lymphatic health');
    }
  }

  if (hasAcidReflux) {
    if (/\b(spicy|chili|chilli|jalapeno|cayenne|hot sauce|sambal|balado)\b/.test(dishText)) {
      score -= 25;
    } else if (/\b(oat|oats|banana|melon|watermelon|sweet potato|chicken breast|brown rice|spinach|chamomile|ginger)\b/.test(dishText)) {
      score += 14;
      matchReasons.push('Gentle, reflux-friendly ingredients');
    }
  }

  if (isDiabetic) {
    const carbRatio = (carbs * 4) / Math.max(1, calories);
    if (carbRatio <= 0.42 || /\b(oats|quinoa|lentil|chickpea|chia|broccoli|spinach|tofu)\b/.test(dishText)) {
      score += 14;
      matchReasons.push('Low-glycemic, fiber-rich profile');
    }
  }

  if (hasHypertension) {
    if (/\b(banana|sweet potato|spinach|avocado|lentil|beans|oats|cucumber|watermelon)\b/.test(dishText)) {
      score += 12;
      matchReasons.push('Potassium-rich, heart-healthy whole ingredients');
    }
  }

  // --------------------------------------------------------------------------
  // 5. PREFERRED CUISINES & LIKED FOODS
  // --------------------------------------------------------------------------
  const recipeCuisine = (recipe.cuisine || recipe.cuisine_type || '').toLowerCase();
  const preferredCuisines = (context.preferredCuisines || []).map(c => c.toLowerCase());
  if (preferredCuisines.length > 0 && recipeCuisine) {
    if (preferredCuisines.some(pc => recipeCuisine.includes(pc) || pc.includes(recipeCuisine))) {
      score += 14;
      matchReasons.push(`Matches preferred ${recipe.cuisine} cuisine`);
    }
  }

  const likedFoods = (context.likedFoods || []).map(f => f.toLowerCase());
  for (const liked of likedFoods) {
    if (liked && liked !== 'none' && dishText.includes(liked)) {
      score += 10;
      matchReasons.push(`Includes your liked food: ${liked}`);
      break;
    }
  }

  // --------------------------------------------------------------------------
  // 6. FAVORITES AFFINITY BOOST
  // --------------------------------------------------------------------------
  const favIds = context.favoriteRecipeIds;
  const canonicalId = recipe.id || recipe.external_id;
  if (favIds && (favIds.has(canonicalId) || (recipe.id && favIds.has(recipe.id)))) {
    score += 20;
    matchReasons.push('Saved in your Favorites');
  }

  // --------------------------------------------------------------------------
  // 7. DETERMINISTIC PER-USER DIFFERENTIATION
  // Ensures different users with different onboarding profiles (or userIds)
  // get uniquely tailored meal selections rather than an identical static order.
  // --------------------------------------------------------------------------
  const userSeed = [
    context.userId || 'guest',
    goal,
    String(context.dailyCalorieGoal || 2000),
    (context.dietaryPreference || '').toLowerCase(),
    (context.dietaryLifestyle || []).join(',').toLowerCase(),
    (context.allergies || []).join(',').toLowerCase(),
    (context.mealPrepTime || '').toLowerCase(),
    (context.cookingSkill || '').toLowerCase(),
    canonicalId
  ].join('|');

  const userVariation = deterministicHash(userSeed) % 15; // 0..14 points deterministic variation per user
  score += userVariation;

  if (matchReasons.length === 0) {
    matchReasons.push(`Tailored for your ${context.goal || 'health'} goal (${calories} kcal)`);
  }

  return {
    recipe,
    score,
    matchReasons
  };
}

/**
 * Filters and ranks an array of eligible candidate recipes for a given user and category.
 */
export function rankRecipesForUser(
  candidates: AuthoritativeRecipe[],
  context: UserRankingContext,
  category: MealCategory,
  limit: number = 12
): AuthoritativeRecipe[] {
  if (!candidates || candidates.length === 0) return [];

  // Apply hard dietary lifestyle (Vegan/Vegetarian) and everyday practicality filter strictly
  const filtered = candidates.filter(c => passesDietaryAndPracticalityGate(c, context));

  const scored = filtered.map(c => scoreRecipeForUser(c, context, category));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => ({
    ...s.recipe,
    clinical_justification: s.matchReasons.slice(0, 2).join(' • ')
  }));
}
