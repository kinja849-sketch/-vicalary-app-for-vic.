import { AuthoritativeRecipe, MealCategory } from './RecipeProvider';

const DESSERT_KEYWORDS = ['panna cotta', 'cake', 'ice cream', 'pudding', 'puding', 'tart', 'brownie', 'cookie', 'cookies', 'pie', 'dessert', 'mousse', 'cheesecake', 'sorbet', 'gelato', 'kolak'];
const DRINK_KEYWORDS = ['juice', 'smoothie', 'tea', 'coffee', 'latte', 'drink', 'shake', 'milkshake', 'beverage', 'infusion', 'wedang', 'jus', 'bandrek', 'bajigur'];
const SNACK_KEYWORDS = ['chips', 'crackers', 'nuts', 'bar', 'trail mix', 'snack', 'popcorn', 'bites', 'edamame'];

function hasWholeWord(text: string, keyword: string): boolean {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
}

function isBeverageTitle(title: string): string | null {
  if (/ smoothie\s+bowl/i.test(` ${title} `)) return null; // Smoothie bowls are eaten with a spoon as breakfast/snack
  for (const dr of DRINK_KEYWORDS) {
    if (hasWholeWord(title, dr)) return dr;
  }
  if (/^es\s+/i.test(title.trim())) return 'es';
  return null;
}

function isDessertTitle(title: string): string | null {
  // Pancakes are breakfast items, not dessert cakes
  if (hasWholeWord(title, 'pancake') || hasWholeWord(title, 'pancakes')) return null;
  for (const d of DESSERT_KEYWORDS) {
    if (hasWholeWord(title, d)) return d;
  }
  return null;
}

/**
 * Validates whether a candidate recipe strictly belongs to the target category.
 */
export function validateMealCategory(recipe: AuthoritativeRecipe, targetCategory: MealCategory): { valid: boolean; reason?: string } {
  const title = (recipe.title || '').toLowerCase();
  const category = (recipe.meal_category || '').toLowerCase();

  if (targetCategory === 'breakfast') {
    const dessertHit = category === 'dessert' ? 'dessert' : isDessertTitle(title);
    if (dessertHit) {
      return { valid: false, reason: `Dessert dish "${dessertHit}" cannot be served as Breakfast` };
    }
    const drinkHit = category === 'drink' ? 'drink' : isBeverageTitle(title);
    if (drinkHit) {
      return { valid: false, reason: `Beverage "${drinkHit}" cannot replace Breakfast meal` };
    }
    return { valid: true };
  }

  if (targetCategory === 'lunch' || targetCategory === 'dinner') {
    const dessertHit = category === 'dessert' ? 'dessert' : isDessertTitle(title);
    if (dessertHit) {
      return { valid: false, reason: `Dessert "${dessertHit}" cannot be served as Main Meal (${targetCategory})` };
    }
    const drinkHit = category === 'drink' ? 'drink' : isBeverageTitle(title);
    if (drinkHit) {
      return { valid: false, reason: `Beverage "${drinkHit}" cannot replace Main Meal (${targetCategory})` };
    }
    return { valid: true };
  }

  if (targetCategory === 'snack') {
    if (category === 'drink' || category === 'dessert') {
      return { valid: false, reason: 'Snack category must contain snacks only' };
    }
    // Strict Snack Integrity: Reject heavy mains (curries, biryanis, heavy casseroles, stews, pastas, pies, steaks)
    const heavyMainPattern = /\b(curry|biryani|lasagna|lasagne|stew|casserole|pasta|steak|roast|noodle|spaghetti|risotto|rendang|pilaf|pie)\b/i;
    if (heavyMainPattern.test(title)) {
      return { valid: false, reason: `Heavy main dish "${title}" cannot be served as a snack` };
    }
    const cals = Number(recipe.nutrition?.calories || recipe.total_calories || 0);
    if (cals > 280) {
      return { valid: false, reason: `Dish with ${cals} kcal exceeds snack threshold (max 280 kcal)` };
    }
    return { valid: true };
  }

  if (targetCategory === 'drink') {
    const isDrink = category === 'drink' || Boolean(isBeverageTitle(title));
    if (!isDrink) {
      return { valid: false, reason: 'Drink category must contain beverages' };
    }
    return { valid: true };
  }

  if (targetCategory === 'dessert') {
    const isDessert = category === 'dessert' || Boolean(isDessertTitle(title));
    if (!isDessert) {
      return { valid: false, reason: 'Dessert category must contain sweet/dessert items' };
    }
    return { valid: true };
  }

  return { valid: true };
}
