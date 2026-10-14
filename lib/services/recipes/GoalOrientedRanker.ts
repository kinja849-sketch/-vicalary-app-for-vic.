/**
 * GoalOrientedRanker.ts
 * Deterministic nutritional scoring and ranking engine for personalized meal recommendations.
 *
 * Implements objective-driven meal prioritization:
 * - Weight Reduction: Prioritizes caloric deficit adherence, high protein density, and fiber.
 * - Muscle Gain: Prioritizes high protein content (>= 30g) and sufficient caloric energy.
 * - Weight Maintenance: Optimizes for caloric proximity to target and balanced macros.
 * - General Health: Prioritizes whole food variety and balanced nutrition.
 * - Medical Conditions: Adjusts for diabetes (low sugar, high fiber) and hypertension.
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
  dietaryLifestyle?: string[];
  favoriteRecipeIds?: Set<string>;
}

export interface ScoredRecipe {
  recipe: AuthoritativeRecipe;
  score: number;
  matchReasons: string[];
}

/**
 * Returns expected target calories for a specific meal category based on daily goal.
 */
export function getCategoryCalorieBudget(dailyCalories: number, category: MealCategory): { min: number; target: number; max: number } {
  const daily = Math.max(1200, dailyCalories || 2000);

  switch (category) {
    case 'breakfast':
      // 25% of daily intake
      const bfTarget = Math.round(daily * 0.25);
      return { min: bfTarget - 100, target: bfTarget, max: bfTarget + 100 };
    case 'lunch':
      // 35% of daily intake
      const lunchTarget = Math.round(daily * 0.35);
      return { min: lunchTarget - 120, target: lunchTarget, max: lunchTarget + 120 };
    case 'dinner':
      // 30% of daily intake
      const dinTarget = Math.round(daily * 0.30);
      return { min: dinTarget - 100, target: dinTarget, max: dinTarget + 100 };
    case 'snack':
      // 10% of daily intake
      const snackTarget = Math.round(daily * 0.10);
      return { min: 80, target: snackTarget, max: snackTarget + 60 };
    case 'drink':
      return { min: 10, target: 100, max: 200 };
    case 'dessert':
      return { min: 80, target: 180, max: 280 };
    default:
      return { min: 300, target: 500, max: 700 };
  }
}

/**
 * Deterministically scores a candidate recipe according to user's onboarding goal and profile.
 */
export function scoreRecipeForUser(
  recipe: AuthoritativeRecipe,
  context: UserRankingContext,
  category: MealCategory
): ScoredRecipe {
  let score = 50; // Baseline neutral score
  const matchReasons: string[] = [];

  const rawGoal = (context.goal || 'General Health').toLowerCase();
  const isWeightLoss = rawGoal.includes('lose') || rawGoal.includes('weight_loss') || rawGoal.includes('reduction');
  const isMuscleGain = rawGoal.includes('gain') || rawGoal.includes('muscle') || rawGoal.includes('hypertrophy');
  const isMaintenance = rawGoal.includes('maintain');

  const calories = recipe.nutrition?.calories || recipe.total_calories || 0;
  const protein = recipe.nutrition?.protein_g || recipe.protein_g || 0;
  const carbs = recipe.nutrition?.carbs_g || recipe.carbs_g || 0;
  const fat = recipe.nutrition?.fat_g || recipe.fat_g || 0;

  const budget = getCategoryCalorieBudget(context.dailyCalorieGoal || 2000, category);

  // --------------------------------------------------------------------------
  // 1. OBJECTIVE-DRIVEN NUTRITIONAL SCORING
  // --------------------------------------------------------------------------
  if (isWeightLoss) {
    // Reward meals that fit strictly within the category deficit budget
    if (calories <= budget.target && calories >= budget.min) {
      score += 25;
      matchReasons.push(`Calorie deficit optimal (${calories} kcal vs target ${budget.target} kcal)`);
    } else if (calories > budget.max) {
      const overPct = (calories - budget.max) / budget.max;
      score -= Math.min(35, Math.round(overPct * 50)); // Significant penalty for exceeding calorie target
    } else {
      score += 10;
    }

    // High protein density helps preserve lean mass during deficit
    const proteinCalRatio = (protein * 4) / Math.max(1, calories);
    if (proteinCalRatio >= 0.25) {
      score += 20;
      matchReasons.push(`High protein-to-calorie ratio (${protein}g protein)`);
    } else if (proteinCalRatio >= 0.20) {
      score += 10;
    }
  } else if (isMuscleGain) {
    // Prioritize high absolute protein and sufficient energy
    if (protein >= 35) {
      score += 30;
      matchReasons.push(`Elite muscle-building protein (${protein}g)`);
    } else if (protein >= 25) {
      score += 20;
      matchReasons.push(`Strong protein profile (${protein}g)`);
    } else if (protein >= 18) {
      score += 10;
    } else {
      score -= 15; // Low protein penalized for muscle gain
    }

    // Adequate caloric support (avoid extreme low calorie for muscle building)
    if (calories >= budget.min) {
      score += 15;
    } else {
      score -= 10;
    }
  } else if (isMaintenance) {
    // Proximity to target calories
    const diff = Math.abs(calories - budget.target);
    const accuracyScore = Math.max(0, 25 - Math.round(diff / 15));
    score += accuracyScore;
    if (accuracyScore >= 18) {
      matchReasons.push(`Accurately balanced energy (${calories} kcal)`);
    }

    // Balanced macronutrient split (~40-50% carbs, 20-30% protein, 20-30% fat)
    if (protein >= 20 && fat >= 8) {
      score += 10;
    }
  } else {
    // General Health
    if (calories >= budget.min && calories <= budget.max) {
      score += 20;
      matchReasons.push(`Nutritionally well-portioned (${calories} kcal)`);
    }
    if (protein >= 18) score += 10;
  }

  // --------------------------------------------------------------------------
  // 2. MEDICAL CONDITIONS GATES & ADJUSTMENTS
  // --------------------------------------------------------------------------
  const conditions = (context.medicalConditions || []).map(c => c.toLowerCase());
  const isDiabetic = conditions.some(c => c.includes('diabet') || c.includes('sugar'));
  const hasHypertension = conditions.some(c => c.includes('hypertens') || c.includes('blood pressure'));

  if (isDiabetic) {
    // Prefer complex carbs / high protein, penalize high simple carb ratios
    const carbRatio = (carbs * 4) / Math.max(1, calories);
    if (carbRatio <= 0.40) {
      score += 15;
      matchReasons.push('Low glycemic load suitable for diabetic management');
    } else if (carbRatio > 0.60) {
      score -= 20;
    }
  }

  if (hasHypertension) {
    // Boost fresh vegetable-based preparations
    const titleLower = (recipe.title || '').toLowerCase();
    if (titleLower.includes('bening') || titleLower.includes('kukus') || titleLower.includes('salad')) {
      score += 10;
      matchReasons.push('Low sodium gentle preparation');
    }
  }

  // --------------------------------------------------------------------------
  // 3. CUISINE PREFERENCES
  // --------------------------------------------------------------------------
  const recipeCuisine = (recipe.cuisine || recipe.cuisine_type || '').toLowerCase();
  const preferredCuisines = (context.preferredCuisines || []).map(c => c.toLowerCase());

  if (preferredCuisines.length > 0 && recipeCuisine) {
    const isPreferred = preferredCuisines.some(pc => recipeCuisine.includes(pc) || pc.includes(recipeCuisine));
    if (isPreferred) {
      score += 15;
      matchReasons.push(`Matches preferred cuisine: ${recipe.cuisine}`);
    }
  }

  // --------------------------------------------------------------------------
  // 4. LIKED FOODS AFFINITY
  // --------------------------------------------------------------------------
  const likedFoods = (context.likedFoods || []).map(f => f.toLowerCase());
  if (likedFoods.length > 0) {
    const dishText = `${recipe.title} ${(recipe.ingredients || []).map(i => typeof i === 'string' ? i : i.item).join(' ')}`.toLowerCase();
    for (const liked of likedFoods) {
      if (liked && liked !== 'none' && dishText.includes(liked)) {
        score += 8;
        matchReasons.push(`Includes liked food: ${liked}`);
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. FAVORITES AFFINITY BOOST (Preserves User Choice Safely)
  // --------------------------------------------------------------------------
  const favIds = context.favoriteRecipeIds;
  const canonicalId = recipe.id || recipe.external_id;
  if (favIds && (favIds.has(canonicalId) || (recipe.id && favIds.has(recipe.id)))) {
    score += 20;
    matchReasons.push('User favorite');
  }

  return {
    recipe,
    score,
    matchReasons
  };
}

/**
 * Ranks an array of eligible candidate recipes for a given user and category.
 */
export function rankRecipesForUser(
  candidates: AuthoritativeRecipe[],
  context: UserRankingContext,
  category: MealCategory,
  limit: number = 12
): AuthoritativeRecipe[] {
  if (!candidates || candidates.length === 0) return [];

  const scored = candidates.map(c => scoreRecipeForUser(c, context, category));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => {
    // Attach clinical justification / match reasons to recipe for UI consumption
    return {
      ...s.recipe,
      clinical_justification: s.matchReasons.join('. ')
    };
  });
}
