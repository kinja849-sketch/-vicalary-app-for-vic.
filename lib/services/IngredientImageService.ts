/**
 * IngredientImageService.ts
 *
 * Provides photorealistic culinary ingredient images on isolated/clean backgrounds,
 * replicating authentic food photography (e.g. sliced bread, halved avocado, sea salt,
 * cracked pepper, kidney beans, whole scotch bonnet).
 */

const KNOWN_INGREDIENT_IMAGE_MAP: Record<string, string> = {
  // Grains & Starches
  'rice': 'https://www.themealdb.com/images/ingredients/Rice.png',
  'long-grain white rice': 'https://www.themealdb.com/images/ingredients/Rice.png',
  'brown rice': 'https://www.themealdb.com/images/ingredients/Brown%20Rice.png',
  'bread': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'sourdough bread': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'quinoa': 'https://www.themealdb.com/images/ingredients/Quinoa.png',
  'rolled oats': 'https://www.themealdb.com/images/ingredients/Rolled%20Oats.png',
  'oats': 'https://www.themealdb.com/images/ingredients/Rolled%20Oats.png',

  // Legumes & Beans
  'kidney beans': 'https://www.themealdb.com/images/ingredients/Kidney%20Beans.png',
  'beans': 'https://www.themealdb.com/images/ingredients/Kidney%20Beans.png',
  'black beans': 'https://www.themealdb.com/images/ingredients/Black%20Beans.png',
  'tofu': 'https://www.themealdb.com/images/ingredients/Tofu.png',
  'firm tofu': 'https://www.themealdb.com/images/ingredients/Tofu.png',
  'tempeh': 'https://images.unsplash.com/photo-1546069901-d68a9668383e?auto=format&fit=crop&w=200&q=80',

  // Liquids & Milks
  'coconut milk': 'https://www.themealdb.com/images/ingredients/Coconut%20Milk.png',
  'olive oil': 'https://www.themealdb.com/images/ingredients/Olive%20Oil.png',
  'oil': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'cooking oil': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'chili oil': 'https://www.themealdb.com/images/ingredients/Chili%20Powder.png',
  'water': 'https://www.themealdb.com/images/ingredients/Water.png',
  'broth': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',
  'chicken broth': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',

  // Aromatics, Vegetables & Herbs
  'onion': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'yellow onion': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'red onion': 'https://www.themealdb.com/images/ingredients/Red%20Onion.png',
  'garlic': 'https://www.themealdb.com/images/ingredients/Garlic.png',
  'scallions': 'https://www.themealdb.com/images/ingredients/Spring%20Onions.png',
  'spring onions': 'https://www.themealdb.com/images/ingredients/Spring%20Onions.png',
  'thyme': 'https://www.themealdb.com/images/ingredients/Thyme.png',
  'fresh thyme': 'https://www.themealdb.com/images/ingredients/Thyme.png',
  'avocado': 'https://www.themealdb.com/images/ingredients/Avocado.png',
  'spinach': 'https://www.themealdb.com/images/ingredients/Spinach.png',
  'broccoli': 'https://www.themealdb.com/images/ingredients/Broccoli.png',
  'tomato': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'cucumber': 'https://www.themealdb.com/images/ingredients/Cucumber.png',

  // Peppers & Spices
  'scotch bonnet': 'https://www.themealdb.com/images/ingredients/Scotch%20Bonnet.png',
  'scotch bonnet pepper': 'https://www.themealdb.com/images/ingredients/Scotch%20Bonnet.png',
  'black pepper': 'https://www.themealdb.com/images/ingredients/Black%20Pepper.png',
  'pepper': 'https://www.themealdb.com/images/ingredients/Black%20Pepper.png',
  'salt': 'https://www.themealdb.com/images/ingredients/Salt.png',
  'sea salt': 'https://www.themealdb.com/images/ingredients/Salt.png',
  'allspice': 'https://www.themealdb.com/images/ingredients/Allspice.png',
  'ginger': 'https://www.themealdb.com/images/ingredients/Ginger.png',
  'turmeric': 'https://www.themealdb.com/images/ingredients/Turmeric.png',

  // Proteins
  'chicken': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'chicken breast': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'halal chicken breast': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'beef': 'https://www.themealdb.com/images/ingredients/Beef.png',
  'lean beef': 'https://www.themealdb.com/images/ingredients/Beef.png',
  'egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'eggs': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'farm fresh eggs': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'fish': 'https://www.themealdb.com/images/ingredients/Fish.png',
  'shrimp': 'https://www.themealdb.com/images/ingredients/Prawns.png',
  'prawns': 'https://www.themealdb.com/images/ingredients/Prawns.png',
  'lime': 'https://www.themealdb.com/images/ingredients/Lime.png',
  'lemon': 'https://www.themealdb.com/images/ingredients/Lemon.png'
};

export interface ParsedIngredient {
  name: string;
  amount: string;
  imageUrl: string;
}

export class IngredientImageService {
  /**
   * Parses an ingredient string or object into a structured name, amount, and image URL.
   */
  public static parseIngredient(ing: any): ParsedIngredient {
    if (!ing) {
      return {
        name: 'Ingredient',
        amount: '',
        imageUrl: KNOWN_INGREDIENT_IMAGE_MAP['salt']
      };
    }

    if (typeof ing === 'object' && ing !== null) {
      const name = ing.item || ing.name || 'Ingredient';
      const amount = (ing.amount || ing.unit) ? `${ing.amount || ''} ${ing.unit || ''}`.trim() : '';
      return {
        name,
        amount,
        imageUrl: this.getIngredientImageUrl(name)
      };
    }

    const str = String(ing).trim();

    // Regex to extract leading amounts like "1 cup", "1 can (15 oz)", "1/2 tsp", "1 whole", "3/4 cup"
    const amountRegex = /^((?:\d+(?:\/\d+)?(?:\.\d+)?|\d+-\d+)?\s*(?:cup|cups|can|cans|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|g|gram|grams|kg|ml|oz|clove|cloves|pinch|pinches|stalk|stalks|piece|pieces|head|heads|whole)?(?:\s*\([^)]*\))?)\s*(?:of\s+)?(.*)$/i;

    const match = str.match(amountRegex);
    if (match && match[1]?.trim() && match[2]?.trim()) {
      const amount = match[1].trim();
      const name = match[2].trim();
      return {
        name,
        amount,
        imageUrl: this.getIngredientImageUrl(name)
      };
    }

    return {
      name: str,
      amount: '',
      imageUrl: this.getIngredientImageUrl(str)
    };
  }

  /**
   * Returns a high-definition photorealistic ingredient image URL.
   */
  public static getIngredientImageUrl(rawIngredientName: string): string {
    if (!rawIngredientName) return 'https://www.themealdb.com/images/ingredients/Salt.png';

    const normalized = rawIngredientName
      .toLowerCase()
      .replace(/[0-9\/]/g, '')
      .replace(/\b(cup|cups|can|tbsp|tsp|tablespoon|teaspoon|g|gram|grams|kg|pcs|diced|chopped|sliced|shredded|rinsed|drained|fresh|raw|cooked|whole|kept|with|stem|intact|low-sodium|freshly|ground)\b/gi, '')
      .replace(/[(),.%]/g, '')
      .trim();

    // 1. Check direct map
    if (KNOWN_INGREDIENT_IMAGE_MAP[normalized]) {
      return KNOWN_INGREDIENT_IMAGE_MAP[normalized];
    }

    // 2. Partial term match
    for (const [key, url] of Object.entries(KNOWN_INGREDIENT_IMAGE_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return url;
      }
    }

    // 3. Fallback to TheMealDB public CDN using capitalized clean name
    const capitalized = normalized
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('%20');

    if (capitalized) {
      return `https://www.themealdb.com/images/ingredients/${capitalized}.png`;
    }

    return 'https://www.themealdb.com/images/ingredients/Salt.png';
  }
}
