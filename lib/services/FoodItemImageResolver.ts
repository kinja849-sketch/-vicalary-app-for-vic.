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
  'whole egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'whole eggs': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'boiled egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'boiled eggs': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'poached egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'fried egg': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'fried eggs': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'omelette': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'telur': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'telur dadar': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'telur mata sapi': 'https://www.themealdb.com/images/ingredients/Egg.png',
  'cheese': 'https://www.themealdb.com/images/ingredients/Cheddar%20Cheese.png',
  'cheddar': 'https://www.themealdb.com/images/ingredients/Cheddar%20Cheese.png',
  'cheddar cheese': 'https://www.themealdb.com/images/ingredients/Cheddar%20Cheese.png',
  'mozzarella': 'https://www.themealdb.com/images/ingredients/Mozzarella.png',
  'keju': 'https://www.themealdb.com/images/ingredients/Cheddar%20Cheese.png',
  'butter': 'https://www.themealdb.com/images/ingredients/Butter.png',
  'melted butter': 'https://www.themealdb.com/images/ingredients/Butter.png',
  'unsalted butter': 'https://www.themealdb.com/images/ingredients/Butter.png',
  'salted butter': 'https://www.themealdb.com/images/ingredients/Butter.png',
  'mentega': 'https://www.themealdb.com/images/ingredients/Butter.png',
  'milk': 'https://www.themealdb.com/images/ingredients/Milk.png',
  'whole milk': 'https://www.themealdb.com/images/ingredients/Milk.png',
  'fresh milk': 'https://www.themealdb.com/images/ingredients/Milk.png',
  'susu': 'https://www.themealdb.com/images/ingredients/Milk.png',
  'susu cair': 'https://www.themealdb.com/images/ingredients/Milk.png',
  'cream': 'https://www.themealdb.com/images/ingredients/Double%20Cream.png',
  'heavy cream': 'https://www.themealdb.com/images/ingredients/Double%20Cream.png',
  'whipped cream': 'https://www.themealdb.com/images/ingredients/Double%20Cream.png',
  'yogurt': 'https://www.themealdb.com/images/ingredients/Yogurt.png',

  // Core Baking & Culinary Building Blocks
  'flour': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'wheat flour': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'all-purpose flour': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'all purpose flour': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'cake flour': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'plain flour': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'tepung': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'tepung terigu': 'https://www.themealdb.com/images/ingredients/Flour.png',
  'sugar': 'https://www.themealdb.com/images/ingredients/Sugar.png',
  'granulated sugar': 'https://www.themealdb.com/images/ingredients/Sugar.png',
  'white sugar': 'https://www.themealdb.com/images/ingredients/Sugar.png',
  'caster sugar': 'https://www.themealdb.com/images/ingredients/Caster%20Sugar.png',
  'brown sugar': 'https://www.themealdb.com/images/ingredients/Brown%20Sugar.png',
  'powdered sugar': 'https://www.themealdb.com/images/ingredients/Icing%20Sugar.png',
  'gula': 'https://www.themealdb.com/images/ingredients/Sugar.png',
  'gula pasir': 'https://www.themealdb.com/images/ingredients/Sugar.png',
  'cocoa powder': 'https://www.themealdb.com/images/ingredients/Cocoa%20Powder.png',
  'cocoa': 'https://www.themealdb.com/images/ingredients/Cocoa%20Powder.png',
  'unsweetened cocoa powder': 'https://www.themealdb.com/images/ingredients/Cocoa%20Powder.png',
  'cokelat bubuk': 'https://www.themealdb.com/images/ingredients/Cocoa%20Powder.png',
  'bubuk kakao': 'https://www.themealdb.com/images/ingredients/Cocoa%20Powder.png',
  'chocolate': 'https://www.themealdb.com/images/ingredients/Dark%20Chocolate.png',
  'dark chocolate': 'https://www.themealdb.com/images/ingredients/Dark%20Chocolate.png',
  'milk chocolate': 'https://www.themealdb.com/images/ingredients/Dark%20Chocolate.png',
  'chocolate chips': 'https://www.themealdb.com/images/ingredients/Dark%20Chocolate.png',
  'cokelat': 'https://www.themealdb.com/images/ingredients/Dark%20Chocolate.png',
  'baking powder': 'https://www.themealdb.com/images/ingredients/Baking%20Powder.png',
  'yeast': 'https://www.themealdb.com/images/ingredients/Yeast.png',
  'vanilla': 'https://www.themealdb.com/images/ingredients/Vanilla%20Extract.png',
  'vanilla extract': 'https://www.themealdb.com/images/ingredients/Vanilla%20Extract.png',
  'honey': 'https://www.themealdb.com/images/ingredients/Honey.png',
  'madu': 'https://www.themealdb.com/images/ingredients/Honey.png',
  'maple syrup': 'https://www.themealdb.com/images/ingredients/Maple%20Syrup.png',
  'syrup': 'https://www.themealdb.com/images/ingredients/Maple%20Syrup.png',
  'vegetable oil': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'canola oil': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'sunflower oil': 'https://www.themealdb.com/images/ingredients/Sunflower%20Oil.png',
  'cooking oil': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'minyak sayur': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',
  'minyak goreng': 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil.png',

  // Fruits
  'apple': 'https://www.themealdb.com/images/ingredients/Apples.png',
  'apples': 'https://www.themealdb.com/images/ingredients/Apples.png',
  'banana': 'https://www.themealdb.com/images/ingredients/Bananas.png',
  'bananas': 'https://www.themealdb.com/images/ingredients/Bananas.png',
  'pisang': 'https://www.themealdb.com/images/ingredients/Bananas.png',
  'orange': 'https://www.themealdb.com/images/ingredients/Orange.png',
  'oranges': 'https://www.themealdb.com/images/ingredients/Orange.png',
  'jeruk': 'https://www.themealdb.com/images/ingredients/Orange.png',
  'strawberry': 'https://www.themealdb.com/images/ingredients/Strawberries.png',
  'strawberries': 'https://www.themealdb.com/images/ingredients/Strawberries.png',
  'blueberry': 'https://www.themealdb.com/images/ingredients/Blueberries.png',
  'blueberries': 'https://www.themealdb.com/images/ingredients/Blueberries.png',
  'lemon': 'https://www.themealdb.com/images/ingredients/Lemon.png',
  'lime': 'https://www.themealdb.com/images/ingredients/Lime.png',

  // Produce & Vegetables
  'tomato': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'tomatoes': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'stewed tomato': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'stewed tomatoes': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'cooked tomatoes': 'https://www.themealdb.com/images/ingredients/Tomato.png',
  'simmered tomatoes': 'https://www.themealdb.com/images/ingredients/Tomato.png',
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
  'onions': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'cooked onion': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'cooked onions': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'sauteed onions': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'sautéed onions': 'https://www.themealdb.com/images/ingredients/Onion.png',
  'stewed onions': 'https://www.themealdb.com/images/ingredients/Onion.png',
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
  'cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80',
  'chiffon cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80',
  'chocolate cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80',
  'sponge cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80',
  'kue': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=300&q=80',
  'brownie': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=300&q=80',
  'brownies': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=300&q=80',
  'muffin': 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=300&q=80',
  'cupcake': 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=300&q=80',
  'cookie': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=300&q=80',
  'cookies': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=300&q=80',
  'donut': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=300&q=80',
  'doughnut': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=300&q=80',
  'croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=300&q=80',
  'pastry': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=300&q=80',

  // Potatoes & Tubers
  'potato': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'potatoes': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'boiled potato': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'boiled potatoes': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'stewed potato': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'stewed potatoes': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
  'cooked potatoes': 'https://www.themealdb.com/images/ingredients/Potatoes.png',
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

    // 3. Keyword / partial matching (longest key first to avoid premature short matches)
    const sortedEntries = Object.entries(KNOWN_FOOD_ITEM_IMAGES).sort((a, b) => b[0].length - a[0].length);
    for (const [key, url] of sortedEntries) {
      if (rawName.includes(key) || (composite && composite.includes(key))) {
        return url;
      }
    }

    // 4. Verified TheMealDB ingredient whitelist (never blindly guess invalid URLs like Chiffon.png)
    const VERIFIED_MEALDB_INGREDIENTS: Record<string, string> = {
      flour: 'Flour.png',
      sugar: 'Sugar.png',
      egg: 'Egg.png',
      eggs: 'Egg.png',
      butter: 'Butter.png',
      milk: 'Milk.png',
      cheese: 'Cheddar%20Cheese.png',
      honey: 'Honey.png',
      cocoa: 'Cocoa%20Powder.png',
      chocolate: 'Dark%20Chocolate.png',
      salt: 'Salt.png',
      pepper: 'Black%20Pepper.png',
      garlic: 'Garlic.png',
      ginger: 'Ginger.png',
      lemon: 'Lemon.png',
      lime: 'Lime.png',
      apple: 'Apples.png',
      banana: 'Bananas.png',
      strawberry: 'Strawberries.png',
      blueberry: 'Blueberries.png',
      avocado: 'Avocado.png',
      broccoli: 'Broccoli.png',
      carrot: 'Carrots.png',
      cucumber: 'Cucumber.png',
      lettuce: 'Lettuce.png',
      mushroom: 'Mushrooms.png',
      onion: 'Onion.png',
      peas: 'Peas.png',
      potato: 'Potatoes.png',
      spinach: 'Spinach.png',
      tomato: 'Tomato.png',
      zucchini: 'Courgettes.png',
      beef: 'Beef.png',
      chicken: 'Chicken%20Breast.png',
      pork: 'Pork.png',
      lamb: 'Lamb.png',
      bacon: 'Bacon.png',
      sausage: 'Sausages.png',
      sausages: 'Sausages.png',
      salmon: 'Salmon.png',
      tuna: 'Tuna.png',
      prawn: 'Prawns.png',
      prawns: 'Prawns.png',
      shrimp: 'Prawns.png',
      tofu: 'Tofu.png',
      bread: 'Bread.png',
      oats: 'Rolled%20Oats.png'
    };

    const words = rawName.replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
    for (const w of words) {
      if (VERIFIED_MEALDB_INGREDIENTS[w]) {
        return `https://www.themealdb.com/images/ingredients/${VERIFIED_MEALDB_INGREDIENTS[w]}`;
      }
    }

    return 'https://www.themealdb.com/images/ingredients/Flour.png';
  }
}
