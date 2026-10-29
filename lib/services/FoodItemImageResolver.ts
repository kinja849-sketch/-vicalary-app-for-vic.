/**
 * FoodItemImageResolver.ts
 *
 * Resolves photorealistic isolated food item images on clean/transparent backgrounds
 * matching the curated card tile presentation (e.g. egg, tomato, cucumber, bread, rice, chicken, potato).
 */

const KNOWN_FOOD_ITEM_IMAGES: Record<string, string> = {
  // Eggs & Dairy
  'egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'eggs': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'boiled egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'poached egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'fried egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'omelette': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'telur': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'telur dadar': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'telur mata sapi': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'cheese': 'https://www.themealdb.com/images/ingredients/Cheddar%20Cheese.png',
  'butter': 'https://www.themealdb.com/images/ingredients/Butter.png',
  'milk': 'https://www.themealdb.com/images/ingredients/Milk.png',
  'yogurt': 'https://www.themealdb.com/images/ingredients/Yogurt.png',

  // Produce & Vegetables
  'tomato': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'tomatoes': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'sliced tomato': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'cherry tomato': 'https://www.themealdb.com/images/ingredients/Cherry%20Tomatoes.png',
  'cucumber': 'https://www.themealdb.com/images/ingredients/Cucumber.png',
  'cucumbers': 'https://www.themealdb.com/images/ingredients/Cucumber.png',
  'lettuce': 'https://www.themealdb.com/images/ingredients/Lettuce.png',
  'salad': 'https://www.themealdb.com/images/ingredients/Lettuce.png',
  'salad greens': 'https://www.themealdb.com/images/ingredients/Lettuce.png',
  'spinach': 'https://www.themealdb.com/images/ingredients/Spinach.png',
  'broccoli': 'https://www.themealdb.com/images/ingredients/Broccoli.png',
  'steamed broccoli': 'https://www.themealdb.com/images/ingredients/Broccoli.png',
  'carrot': 'https://www.themealdb.com/images/ingredients/Carrots.png',
  'carrots': 'https://www.themealdb.com/images/ingredients/Carrots.png',
  'avocado': 'https://www.themealdb.com/images/ingredients/Avocado.png',
  'onion': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'garlic': 'https://www.themealdb.com/images/ingredients/Garlic.png',
  'mushroom': 'https://www.themealdb.com/images/ingredients/Mushrooms.png',
  'mushrooms': 'https://www.themealdb.com/images/ingredients/Mushrooms.png',

  // Bakery, Grains & Starches
  'bread': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'toast': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'toasted bread': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'sourdough': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'sourdough bread': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'bao bun': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80',
  'plain bao bun': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80',
  'steamed bun': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80',
  'bun': 'https://www.themealdb.com/images/ingredients/Bread.png',
  'white rice': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80',
  'rice': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80',
  'steamed rice': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80',
  'steamed white rice': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80',
  'jasmine rice': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80',
  'nasi putih': 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80',
  'brown rice': 'https://www.themealdb.com/images/ingredients/Brown%20Rice.png',
  'steamed brown rice': 'https://www.themealdb.com/images/ingredients/Brown%20Rice.png',
  'fried rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=300&q=80',
  'nasi goreng': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=300&q=80',
  'quinoa': 'https://www.themealdb.com/images/ingredients/Quinoa.png',
  'rolled oats': 'https://www.themealdb.com/images/ingredients/Rolled%20Oats.png',
  'oats': 'https://www.themealdb.com/images/ingredients/Rolled%20Oats.png',
  'pasta': 'https://www.themealdb.com/images/ingredients/Spaghetti.png',
  'noodles': 'https://www.themealdb.com/images/ingredients/Egg%20Noodles.png',
  'crepe': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=300&q=80',
  'crepes': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=300&q=80',
  'pan-fried crepes': 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=300&q=80',
  'pancake': 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=300&q=80',
  'pancakes': 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=300&q=80',
  'waffle': 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=300&q=80',
  'waffles': 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=300&q=80',

  // Potatoes & Tubers
  'potato': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'potatoes': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'boiled potato': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'boiled potatoes': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'roasted potatoes': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80',
  'baked potato': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80',
  'potato wedges': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=300&q=80',
  'mashed potatoes': 'https://images.unsplash.com/photo-1618449840665-9ed506d73a34?auto=format&fit=crop&w=300&q=80',
  'french fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=300&q=80',
  'fries': 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=300&q=80',

  // Proteins: Poultry, Meat, Seafood, Plant
  'chicken': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'chicken breast': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'grilled chicken': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'grilled chicken breast': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'roasted chicken': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=300&q=80',
  'fried chicken': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&q=80',
  'crispy chicken': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&q=80',
  'chicken thigh': 'https://www.themealdb.com/images/ingredients/Chicken%20Thighs.png',
  'chicken drumstick': 'https://www.themealdb.com/images/ingredients/Chicken%20Legs.png',
  'ayam goreng': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=300&q=80',
  'ayam bakar': 'https://www.themealdb.com/images/ingredients/Chicken%20Breast.png',
  'beef': 'https://www.themealdb.com/images/ingredients/Beef.png',
  'steak': 'https://www.themealdb.com/images/ingredients/Beef.png',
  'beef steak': 'https://www.themealdb.com/images/ingredients/Beef.png',
  'salmon': 'https://www.themealdb.com/images/ingredients/Salmon.png',
  'grilled salmon': 'https://www.themealdb.com/images/ingredients/Salmon.png',
  'fish': 'https://www.themealdb.com/images/ingredients/Fish.png',
  'prawns': 'https://www.themealdb.com/images/ingredients/Prawns.png',
  'shrimp': 'https://www.themealdb.com/images/ingredients/Prawns.png',
  'tofu': 'https://www.themealdb.com/images/ingredients/Tofu.png',
  'firm tofu': 'https://www.themealdb.com/images/ingredients/Tofu.png',
  'tempeh': 'https://images.unsplash.com/photo-1546069901-d68a9668383e?auto=format&fit=crop&w=200&q=80',
  'tempe': 'https://images.unsplash.com/photo-1546069901-d68a9668383e?auto=format&fit=crop&w=200&q=80',

  // Soups & Liquids
  'soup': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',
  'broth': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',
  'soup / broth': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',
  'chicken broth': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',
  'vegetable broth': 'https://www.themealdb.com/images/ingredients/Chicken%20Stock.png',

  // Seasonings & Condiments
  'salt': 'https://www.themealdb.com/images/ingredients/Salt.png',
  'pepper': 'https://www.themealdb.com/images/ingredients/Black%20Pepper.png',
  'black pepper': 'https://www.themealdb.com/images/ingredients/Black%20Pepper.png',
  'olive oil': 'https://www.themealdb.com/images/ingredients/Olive%20Oil.png',
  'oil': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'chili oil': 'https://www.themealdb.com/images/ingredients/Chili%20Powder.png',
  'sambal': 'https://www.themealdb.com/images/ingredients/Red%20Chilli.png'
};

export class FoodItemImageResolver {
  /**
   * Resolves an authentic, clean isolated food item image URL based on food name and preparation method.
   */
  public static resolveImageUrl(foodName: string, methodOrVariant?: string): string {
    const rawName = (foodName || '').toLowerCase().trim();
    const rawMethod = (methodOrVariant || '').toLowerCase().trim();
    const composite = `${rawMethod} ${rawName}`.trim();

    // 1. Check composite match first (e.g. "fried chicken", "roasted potatoes", "boiled egg")
    if (composite && KNOWN_FOOD_ITEM_IMAGES[composite]) {
      return KNOWN_FOOD_ITEM_IMAGES[composite];
    }

    // 2. Check direct name match
    if (KNOWN_FOOD_ITEM_IMAGES[rawName]) {
      return KNOWN_FOOD_ITEM_IMAGES[rawName];
    }

    // 3. Keyword / partial matching
    for (const [key, url] of Object.entries(KNOWN_FOOD_ITEM_IMAGES)) {
      if (rawName.includes(key) || (composite && composite.includes(key))) {
        return url;
      }
    }

    // 4. Fallback to TheMealDB ingredient CDN capitalized query
    const cleanWord = rawName
      .replace(/[^a-zA-Z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['cooked', 'fried', 'baked', 'roasted', 'sliced', 'steamed'].includes(w))[0];

    if (cleanWord) {
      const cap = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
      return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(cap)}.png`;
    }

    return 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80';
  }
}
