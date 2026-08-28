import { AuthoritativeRecipe, MealCategory } from './RecipeProvider';

const DESSERT_KEYWORDS = ['panna cotta', 'cake', 'ice cream', 'pudding', 'tart', 'brownie', 'cookie', 'pie', 'dessert', 'mousse', 'cheesecake', 'sorbet', 'gelato'];
const DRINK_KEYWORDS = ['juice', 'smoothie', 'tea', 'coffee', 'latte', 'drink', 'shake', 'beverage', 'infusion', 'wedang', 'jus', 'es '];
const SNACK_KEYWORDS = ['chips', 'crackers', 'nuts', 'bar', 'trail mix', 'snack', 'popcorn', 'bites'];

/**
 * Validates whether a candidate recipe strictly belongs to the target category.
 */
export function validateMealCategory(recipe: AuthoritativeRecipe, targetCategory: MealCategory): { valid: boolean; reason?: string } {
  const title = (recipe.title || '').toLowerCase();
  const category = (recipe.meal_category || '').toLowerCase();

  if (targetCategory === 'breakfast') {
    // Exclude desserts, heavy dinner dishes, drinks
    for (const d of DESSERT_KEYWORDS) {
      if (title.includes(d) || category === 'dessert') {
        return { valid: false, reason: `Dessert dish "${d}" cannot be served as Breakfast` };
      }
    }
    for (const dr of DRINK_KEYWORDS) {
      if (title.includes(dr) || category === 'drink') {
        return { valid: false, reason: `Beverage "${dr}" cannot replace Breakfast meal` };
      }
    }
    return { valid: true };
  }

  if (targetCategory === 'lunch' || targetCategory === 'dinner') {
    // Exclude desserts, drinks, light snacks
    for (const d of DESSERT_KEYWORDS) {
      if (title.includes(d) || category === 'dessert') {
        return { valid: false, reason: `Dessert "${d}" cannot be served as Main Meal (${targetCategory})` };
      }
    }
    for (const dr of DRINK_KEYWORDS) {
      if (title.includes(dr) || category === 'drink') {
        return { valid: false, reason: `Beverage "${dr}" cannot replace Main Meal (${targetCategory})` };
      }
    }
    return { valid: true };
  }

  if (targetCategory === 'snack') {
    if (category === 'drink' || category === 'dessert') {
      return { valid: false, reason: 'Snack category must contain snacks only' };
    }
    return { valid: true };
  }

  if (targetCategory === 'drink') {
    const isDrink = category === 'drink' || DRINK_KEYWORDS.some(k => title.includes(k));
    if (!isDrink) {
      return { valid: false, reason: 'Drink category must contain beverages' };
    }
    return { valid: true };
  }

  if (targetCategory === 'dessert') {
    const isDessert = category === 'dessert' || DESSERT_KEYWORDS.some(k => title.includes(k));
    if (!isDessert) {
      return { valid: false, reason: 'Dessert category must contain sweet/dessert items' };
    }
    return { valid: true };
  }

  return { valid: true };
}
