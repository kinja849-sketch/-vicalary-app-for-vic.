import {
  AuthoritativeRecipe,
  Ingredient,
  Instruction,
  MealCategory,
  RecipeProvider,
  RecipeSearchCriteria
} from './RecipeProvider';
import { checkAllergensAndDislikes } from './AllergenMatcher';
import { sanitizeFoodImageUrl } from '@/lib/services/FoodImageService';

interface RawCuratedRecipe {
  id: string;
  externalId: string;
  sourceProvider: 'curated';
  title: string;
  imageUrl: string;
  category: MealCategory;
  cuisine: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: number;
  servings: number;
  ingredients: string[];
  instructions: string[];
  dietaryTags?: string[];
  halalStatus: 'HALAL_VERIFIED';
}

function toAuthoritativeRecipe(raw: RawCuratedRecipe, usedPhotoUrls?: Set<string>): AuthoritativeRecipe {
  const ingredients: Ingredient[] = raw.ingredients.map(line => {
    const clean = line.trim();
    return {
      item: clean,
      amount: '',
      unit: '',
      normalized_name: clean.toLowerCase()
    };
  });

  const instructions: Instruction[] = raw.instructions.map((stepText, idx) => ({
    step: idx + 1,
    instruction: stepText.replace(/^\d+[\.\)]\s*/, '').trim()
  }));

  const uniqueImage = sanitizeFoodImageUrl(raw.imageUrl, raw.title, raw.cuisine, raw.category, usedPhotoUrls);

  return {
    id: raw.id,
    external_id: raw.externalId,
    provider: 'curated',
    title: raw.title,
    name: raw.title,
    image_url: uniqueImage,
    image: uniqueImage,
    meal_category: raw.category,
    cuisine: raw.cuisine,
    cuisine_type: raw.cuisine,
    prep_time_minutes: raw.prepTime,
    cook_time_minutes: Math.max(5, raw.prepTime),
    servings: raw.servings,
    ingredients,
    instructions,
    nutrition: {
      calories: raw.calories,
      protein_g: raw.protein,
      carbs_g: raw.carbs,
      fat_g: raw.fat
    },
    total_calories: raw.calories,
    protein_g: raw.protein,
    carbs_g: raw.carbs,
    fat_g: raw.fat,
    dietary_tags: raw.dietaryTags || ['Halal']
  };
}

/**
 * Curated Halal Everyday Home-Cooked Recipe Catalog
 * All recipes are 100% Halal-verified, practical everyday home-cooked meals with:
 * - Accurate calories and macronutrients
 * - Complete ingredient lists with measurements
 * - Clear 3-4 step cooking instructions
 * - Verified HTTP-200 food photography
 * - Broad allergen-safe and dietary-lifestyle coverage (High-Protein, Low-Carb, Balanced, Vegan/Vegetarian, Lose/Maintain/Gain Weight)
 */
const RAW_CURATED_HALAL_RECIPES: RawCuratedRecipe[] = [
  // ============================================================================
  // BREAKFAST (18 recipes — 15 free of egg, peanuts, seafood, cheese/dairy)
  // ============================================================================
  {
    id: 'curated_bf_1',
    externalId: 'curated_bf_1',
    sourceProvider: 'curated',
    title: 'Rolled Oats with Banana & Chia Seeds',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sng9bm1765320170.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 320,
    protein: 10,
    carbs: 54,
    fat: 7,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '1/2 cup rolled oats',
      '1 cup unsweetened oat milk',
      '1 medium ripe banana, sliced',
      '1 tbsp chia seeds',
      '1/2 tsp ground cinnamon'
    ],
    instructions: [
      'Combine rolled oats, oat milk, and ground cinnamon in a small saucepan over medium heat.',
      'Simmer gently for 5 to 6 minutes, stirring occasionally until the oats are soft and creamy.',
      'Transfer the warm oatmeal to a bowl and top with sliced banana and chia seeds before serving.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Balanced'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_2',
    externalId: 'curated_bf_2',
    sourceProvider: 'curated',
    title: 'Cinnamon Apple Oatmeal Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/hyk47c1762772689.jpg',
    category: 'breakfast',
    cuisine: 'American',
    calories: 310,
    protein: 9,
    carbs: 56,
    fat: 6,
    prepTime: 12,
    servings: 1,
    ingredients: [
      '1/2 cup rolled oats',
      '1 cup water or oat milk',
      '1 medium apple, diced',
      '1 tbsp pumpkin seeds',
      '1 tsp maple syrup',
      '1/2 tsp ground cinnamon'
    ],
    instructions: [
      'Place diced apple, rolled oats, liquid, and cinnamon into a saucepan over medium heat.',
      'Cook for 6 to 8 minutes while stirring until the apples are tender and the oats thicken.',
      'Spoon into a serving bowl, drizzle with maple syrup, and sprinkle pumpkin seeds on top.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_3',
    externalId: 'curated_bf_3',
    sourceProvider: 'curated',
    title: 'Berry & Chia Overnight Oats',
    imageUrl: 'https://www.themealdb.com/images/media/meals/c400ok1764439058.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 295,
    protein: 9,
    carbs: 48,
    fat: 7,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '1/2 cup rolled oats',
      '1 tbsp chia seeds',
      '3/4 cup unsweetened oat milk',
      '1/2 cup fresh strawberries and blueberries',
      '1 tsp maple syrup'
    ],
    instructions: [
      'Stir rolled oats, chia seeds, oat milk, and maple syrup together in a jar or bowl.',
      'Cover and refrigerate for at least 4 hours or overnight until thick and chilled.',
      'Top with fresh strawberries and blueberries right before eating.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_4',
    externalId: 'curated_bf_4',
    sourceProvider: 'curated',
    title: 'Avocado & Tomato Whole Wheat Toast',
    imageUrl: 'https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg',
    category: 'breakfast',
    cuisine: 'Mediterranean',
    calories: 330,
    protein: 9,
    carbs: 36,
    fat: 17,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '2 slices whole wheat bread, toasted',
      '1/2 ripe avocado',
      '1 medium Roma tomato, sliced',
      '1 tsp extra virgin olive oil',
      '1 tsp fresh lemon juice, black pepper & sea salt'
    ],
    instructions: [
      'Toast the whole wheat bread slices until golden and crisp.',
      'Mash the ripe avocado in a small bowl with fresh lemon juice, sea salt, and black pepper.',
      'Spread the mashed avocado evenly over the toast, top with sliced tomatoes, and drizzle with olive oil.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_5',
    externalId: 'curated_bf_5',
    sourceProvider: 'curated',
    title: 'Savory Chicken & Herb Oat Porridge',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1550441275.jpg',
    category: 'breakfast',
    cuisine: 'Asian',
    calories: 360,
    protein: 32,
    carbs: 38,
    fat: 8,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1/2 cup rolled oats',
      '100g cooked Halal chicken breast, shredded',
      '1.5 cups low-sodium chicken broth',
      '1 cup fresh spinach leaves',
      '1 stalk green onion, chopped',
      '1/2 tsp grated fresh ginger'
    ],
    instructions: [
      'Bring the chicken broth and grated ginger to a gentle boil in a small pot.',
      'Stir in the rolled oats and simmer for 5 minutes until creamy.',
      'Fold in the shredded chicken breast and fresh spinach until wilted, then garnish with green onion.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_6',
    externalId: 'curated_bf_6',
    sourceProvider: 'curated',
    title: 'Grilled Chicken & Avocado Breakfast Wrap',
    imageUrl: 'https://www.themealdb.com/images/media/meals/j80gmw1764372176.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 390,
    protein: 34,
    carbs: 32,
    fat: 14,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1 whole wheat tortilla wrap',
      '100g grilled Halal chicken breast, sliced',
      '1/4 ripe avocado, sliced',
      '1/2 cup baby spinach',
      '4 cherry tomatoes, halved'
    ],
    instructions: [
      'Warm the whole wheat tortilla briefly in a dry skillet for 20 seconds per side.',
      'Layer the baby spinach, sliced grilled chicken breast, avocado slices, and cherry tomatoes in the center.',
      'Roll the tortilla tightly into a wrap, slice in half diagonally, and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_7',
    externalId: 'curated_bf_7',
    sourceProvider: 'curated',
    title: 'Tofu & Spinach Garlic Scramble',
    imageUrl: 'https://www.themealdb.com/images/media/meals/vayi021784668764.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 280,
    protein: 21,
    carbs: 14,
    fat: 15,
    prepTime: 12,
    servings: 1,
    ingredients: [
      '150g firm tofu, crumbled',
      '1.5 cups fresh baby spinach',
      '1/2 cup cherry tomatoes, halved',
      '1 clove garlic, minced',
      '1/4 tsp ground turmeric',
      '1 tsp olive oil'
    ],
    instructions: [
      'Heat olive oil in a non-stick skillet over medium heat and sauté minced garlic for 30 seconds.',
      'Add crumbled firm tofu and turmeric, cooking for 4 minutes until lightly golden.',
      'Toss in cherry tomatoes and baby spinach, stirring for 2 minutes until the spinach wilts.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Low-Carb', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_8',
    externalId: 'curated_bf_8',
    sourceProvider: 'curated',
    title: 'Sweet Potato & Black Bean Breakfast Hash',
    imageUrl: 'https://www.themealdb.com/images/media/meals/qtuwxu1468233098.jpg',
    category: 'breakfast',
    cuisine: 'Mexican',
    calories: 340,
    protein: 12,
    carbs: 54,
    fat: 8,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1 medium sweet potato, peeled and diced small',
      '1/2 cup cooked black beans, rinsed',
      '1/2 red bell pepper, diced',
      '1/4 cup diced yellow onion',
      '1 tsp olive oil & 1/2 tsp ground cumin'
    ],
    instructions: [
      'Heat olive oil in a skillet over medium heat and cook the diced sweet potato with a splash of water covered for 8 minutes until tender.',
      'Add diced bell pepper, onion, and cumin, sautéing uncovered for 4 minutes until lightly browned.',
      'Stir in the black beans and warm through for 2 minutes before serving.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_9',
    externalId: 'curated_bf_9',
    sourceProvider: 'curated',
    title: 'Turkey Breast & Avocado Whole Grain Sandwich',
    imageUrl: 'https://www.themealdb.com/images/media/meals/ae6clc1760524712.jpg',
    category: 'breakfast',
    cuisine: 'American',
    calories: 375,
    protein: 31,
    carbs: 34,
    fat: 12,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '2 slices whole grain bread, toasted',
      '90g sliced Halal roasted turkey breast',
      '1/4 ripe avocado, mashed',
      '2 leaves crisp romaine lettuce',
      '2 slices ripe tomato'
    ],
    instructions: [
      'Toast the whole grain bread slices to your liking.',
      'Spread mashed avocado on one slice of toast and layer with romaine lettuce and tomato slices.',
      'Add the Halal roasted turkey breast, close the sandwich, and cut in half.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_10',
    externalId: 'curated_bf_10',
    sourceProvider: 'curated',
    title: 'Mediterranean Chickpea & Herb Breakfast Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/6vi2cv1763075785.jpg',
    category: 'breakfast',
    cuisine: 'Mediterranean',
    calories: 335,
    protein: 13,
    carbs: 46,
    fat: 11,
    prepTime: 12,
    servings: 1,
    ingredients: [
      '3/4 cup cooked chickpeas, warmed',
      '1/2 cup diced cucumber',
      '1/2 cup diced tomatoes',
      '2 tbsp chopped fresh parsley',
      '1 tsp extra virgin olive oil & lemon juice',
      '1/2 tsp ground cumin'
    ],
    instructions: [
      'Warm the chickpeas in a small pan with ground cumin and a pinch of sea salt for 3 minutes.',
      'Arrange the diced cucumber, tomatoes, and fresh parsley in a breakfast bowl.',
      'Spoon the warm spiced chickpeas into the bowl and drizzle with olive oil and lemon juice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_11',
    externalId: 'curated_bf_11',
    sourceProvider: 'curated',
    title: 'Mango & Banana Chia Smoothie Bowl',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/vqquwx1472720634.jpg',
    category: 'breakfast',
    cuisine: 'Tropical',
    calories: 305,
    protein: 7,
    carbs: 58,
    fat: 6,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '1/2 cup frozen mango chunks',
      '1 medium ripe banana',
      '1/2 cup unsweetened oat milk',
      '1 tbsp chia seeds',
      '2 tbsp rolled oats for topping'
    ],
    instructions: [
      'Blend the frozen mango chunks, banana, and oat milk until thick and smooth.',
      'Pour the smoothie base into a bowl.',
      'Sprinkle chia seeds and rolled oats evenly across the top and serve immediately.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_12',
    externalId: 'curated_bf_12',
    sourceProvider: 'curated',
    title: 'Warm Rice Noodle Soup with Shredded Chicken & Greens',
    imageUrl: 'https://www.themealdb.com/images/media/meals/6g9gif1782688663.jpg',
    category: 'breakfast',
    cuisine: 'Asian',
    calories: 350,
    protein: 30,
    carbs: 42,
    fat: 6,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '60g thin rice noodles, softened',
      '100g cooked Halal chicken breast, shredded',
      '1.5 cups clear chicken broth',
      '1 cup bok choy or spinach',
      '1 clove garlic, lightly toasted'
    ],
    instructions: [
      'Simmer the clear chicken broth with toasted garlic in a saucepan for 3 minutes.',
      'Add the bok choy and rice noodles, cooking for 2 minutes until tender.',
      'Top with shredded Halal chicken breast and serve hot.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_13',
    externalId: 'curated_bf_13',
    sourceProvider: 'curated',
    title: 'Warm Quinoa & Berry Breakfast Porridge',
    imageUrl: 'https://www.themealdb.com/images/media/meals/smoa3h1762341142.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 315,
    protein: 10,
    carbs: 52,
    fat: 7,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup cooked quinoa',
      '1/2 cup unsweetened oat milk',
      '1/2 cup mixed berries (blueberries & raspberries)',
      '1 tbsp sunflower seeds',
      '1/2 tsp vanilla extract & cinnamon'
    ],
    instructions: [
      'Warm the cooked quinoa with oat milk, vanilla, and cinnamon in a small saucepan for 4 minutes.',
      'Spoon the warm quinoa porridge into a bowl.',
      'Top with fresh mixed berries and sunflower seeds.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_14',
    externalId: 'curated_bf_14',
    sourceProvider: 'curated',
    title: 'Savory Mushroom & Spinach Oatmeal Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/bfok4w1780242078.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 290,
    protein: 11,
    carbs: 44,
    fat: 8,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1/2 cup rolled oats',
      '1 cup vegetable broth',
      '1 cup sliced mushrooms',
      '1 cup baby spinach',
      '1 tsp olive oil & garlic powder'
    ],
    instructions: [
      'Sauté sliced mushrooms in olive oil with garlic powder for 4 minutes until tender, then stir in spinach until wilted.',
      'In a separate small pot, simmer rolled oats in vegetable broth for 5 minutes.',
      'Transfer the savory oats to a bowl and top with the sautéed mushrooms and spinach.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_15',
    externalId: 'curated_bf_15',
    sourceProvider: 'curated',
    title: 'Lean Beef & Potato Morning Skillet',
    imageUrl: 'https://www.themealdb.com/images/media/meals/5tf8j11782236249.jpg',
    category: 'breakfast',
    cuisine: 'American',
    calories: 410,
    protein: 33,
    carbs: 34,
    fat: 15,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '100g extra-lean Halal ground beef',
      '1 medium potato, diced small',
      '1/2 green bell pepper, diced',
      '1/4 cup diced onion',
      '1 tsp olive oil, black pepper & paprika'
    ],
    instructions: [
      'Cook the diced potatoes in olive oil in a covered skillet over medium heat for 8 minutes until tender.',
      'Push potatoes to the side and brown the lean Halal ground beef with diced onion, bell pepper, and paprika for 6 minutes.',
      'Toss everything together in the skillet and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_16',
    externalId: 'curated_bf_16',
    sourceProvider: 'curated',
    title: 'Scrambled Eggs with Spinach & Tomatoes',
    imageUrl: 'https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 310,
    protein: 22,
    carbs: 18,
    fat: 16,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '3 large whole eggs, whisked',
      '1 cup fresh spinach',
      '1/2 cup diced tomatoes',
      '1 slice whole wheat toast',
      '1 tsp olive oil'
    ],
    instructions: [
      'Heat olive oil in a non-stick skillet over medium heat and sauté tomatoes and spinach for 2 minutes.',
      'Pour in the whisked eggs and gently fold with a spatula for 2 to 3 minutes until softly set.',
      'Serve alongside the toasted whole wheat bread.'
    ],
    dietaryTags: ['Halal', 'Vegetarian', 'High-Protein', 'Low-Carb'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_17',
    externalId: 'curated_bf_17',
    sourceProvider: 'curated',
    title: 'Greek Yogurt & Fresh Berry Parfait',
    imageUrl: 'https://www.themealdb.com/images/media/meals/8ovxf41763253962.jpg',
    category: 'breakfast',
    cuisine: 'Mediterranean',
    calories: 290,
    protein: 20,
    carbs: 36,
    fat: 6,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 cup plain low-fat Greek yogurt',
      '1/2 cup fresh mixed berries',
      '3 tbsp rolled oat granola',
      '1 tsp pure honey',
      '1 tsp chia seeds'
    ],
    instructions: [
      'Spoon half of the Greek yogurt into the bottom of a glass or bowl.',
      'Add a layer of fresh berries and rolled oat granola, then repeat with the remaining yogurt and berries.',
      'Drizzle with pure honey and sprinkle chia seeds on top.'
    ],
    dietaryTags: ['Halal', 'Vegetarian', 'High-Protein'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_18',
    externalId: 'curated_bf_18',
    sourceProvider: 'curated',
    title: 'Peanut Butter & Banana Protein Oatmeal',
    imageUrl: 'https://www.themealdb.com/images/media/meals/pvfkz61761595976.jpg',
    category: 'breakfast',
    cuisine: 'American',
    calories: 440,
    protein: 16,
    carbs: 58,
    fat: 16,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '2/3 cup rolled oats',
      '1 cup oat milk',
      '1.5 tbsp natural peanut butter',
      '1 medium banana, sliced',
      '1 tsp chia seeds'
    ],
    instructions: [
      'Simmer the rolled oats in oat milk over medium heat for 5 minutes until thick.',
      'Transfer to a bowl and swirl in the natural peanut butter while warm.',
      'Top with banana slices and chia seeds.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_19',
    externalId: 'curated_bf_19',
    sourceProvider: 'curated',
    title: 'Warm Cinnamon Banana & Chia Rice Porridge',
    imageUrl: 'https://www.themealdb.com/images/media/meals/hbte551782770868.jpg',
    category: 'breakfast',
    cuisine: 'Asian',
    calories: 300,
    protein: 8,
    carbs: 54,
    fat: 6,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '3/4 cup cooked brown rice',
      '3/4 cup unsweetened oat milk',
      '1/2 ripe banana, sliced',
      '1 tbsp chia seeds',
      '1/2 tsp ground cinnamon'
    ],
    instructions: [
      'Simmer the cooked brown rice with oat milk and ground cinnamon in a small saucepan for 5 minutes until warm and creamy.',
      'Spoon into a breakfast bowl.',
      'Top with fresh banana slices and chia seeds.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_20',
    externalId: 'curated_bf_20',
    sourceProvider: 'curated',
    title: 'Roasted Sweet Potato, Avocado & Spinach Morning Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1525874812.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 325,
    protein: 9,
    carbs: 44,
    fat: 13,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1 medium roasted sweet potato, cubed',
      '1/2 ripe avocado, sliced',
      '1.5 cups fresh baby spinach',
      '1 tbsp pumpkin seeds',
      '1 tsp extra virgin olive oil & lemon juice'
    ],
    instructions: [
      'Warm the cubed sweet potato in a skillet with olive oil for 3 minutes, then toss in baby spinach until slightly wilted.',
      'Transfer to a bowl and arrange sliced avocado on top.',
      'Sprinkle with pumpkin seeds and a squeeze of lemon juice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_21',
    externalId: 'curated_bf_21',
    sourceProvider: 'curated',
    title: 'Cocoa, Berry & Sunflower Seed Oatmeal Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/xwutvy1511555540.jpg',
    category: 'breakfast',
    cuisine: 'International',
    calories: 315,
    protein: 10,
    carbs: 49,
    fat: 8,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '1/2 cup rolled oats',
      '1 cup unsweetened oat milk',
      '1 tsp unsweetened cocoa powder',
      '1/2 cup fresh strawberries and blueberries',
      '1 tbsp sunflower seeds'
    ],
    instructions: [
      'Simmer rolled oats, oat milk, and cocoa powder in a small pot over medium heat for 5 minutes.',
      'Pour into a bowl.',
      'Top with fresh strawberries, blueberries, and sunflower seeds.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },

  // ============================================================================
  // LUNCH (23 recipes)
  // ============================================================================
  {
    id: 'curated_ln_1',
    externalId: 'curated_ln_1',
    sourceProvider: 'curated',
    title: 'Grilled Chicken Breast with Brown Rice & Steamed Broccoli',
    imageUrl: 'https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg',
    category: 'lunch',
    cuisine: 'International',
    calories: 450,
    protein: 42,
    carbs: 44,
    fat: 10,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '150g Halal skinless chicken breast',
      '3/4 cup cooked brown rice',
      '1.5 cups broccoli florets',
      '1 tsp extra virgin olive oil',
      '1 tsp lemon juice, garlic powder & dried oregano'
    ],
    instructions: [
      'Season the Halal chicken breast with garlic powder, oregano, lemon juice, salt, and pepper.',
      'Grill or pan-sear the chicken in olive oil over medium-high heat for 5 to 6 minutes per side until cooked through.',
      'Steam the broccoli florets for 4 minutes until tender-crisp and serve alongside the brown rice and sliced chicken.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Balanced'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_2',
    externalId: 'curated_ln_2',
    sourceProvider: 'curated',
    title: 'Lemon Herb Chicken & Quinoa Power Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/st9shl1763755808.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 440,
    protein: 40,
    carbs: 42,
    fat: 12,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, cubed',
      '3/4 cup cooked quinoa',
      '1/2 cup diced cucumber',
      '1/2 cup cherry tomatoes, halved',
      '1 tbsp olive oil & fresh lemon juice',
      '2 tbsp chopped fresh parsley'
    ],
    instructions: [
      'Toss the cubed Halal chicken breast with half the olive oil, lemon juice, and herbs, then sear in a skillet for 7 to 8 minutes.',
      'Assemble cooked quinoa, cucumber, cherry tomatoes, and parsley in a bowl.',
      'Top with the warm lemon herb chicken and drizzle with remaining lemon juice and olive oil.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Balanced'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_3',
    externalId: 'curated_ln_3',
    sourceProvider: 'curated',
    title: 'Lean Beef & Broccoli Stir-Fry with Steamed Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg',
    category: 'lunch',
    cuisine: 'Asian',
    calories: 480,
    protein: 38,
    carbs: 48,
    fat: 14,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g lean Halal beef sirloin, thinly sliced',
      '1.5 cups broccoli florets',
      '3/4 cup cooked steamed rice',
      '2 cloves garlic & 1 tsp fresh ginger, minced',
      '1 tbsp low-sodium soy sauce or coconut aminos',
      '1 tsp olive or avocado oil'
    ],
    instructions: [
      'Blanch the broccoli florets in boiling water for 2 minutes, then drain.',
      'Heat oil in a hot wok or skillet, sear the thinly sliced Halal beef with garlic and ginger for 3 minutes.',
      'Toss in the broccoli and soy sauce, stir-fry for 2 minutes, and serve over warm steamed rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_4',
    externalId: 'curated_ln_4',
    sourceProvider: 'curated',
    title: 'Mediterranean Chickpea, Cucumber & Quinoa Salad',
    imageUrl: 'https://www.themealdb.com/images/media/meals/w8umt11583268117.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 390,
    protein: 15,
    carbs: 56,
    fat: 12,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup cooked chickpeas, rinsed',
      '1/2 cup cooked quinoa',
      '1/2 cup diced English cucumber',
      '1/2 cup diced Roma tomatoes',
      '2 cups mixed salad greens',
      '1 tbsp olive oil & 1 tbsp lemon juice'
    ],
    instructions: [
      'Place the mixed salad greens, cooked quinoa, and chickpeas into a large salad bowl.',
      'Add the diced cucumber and Roma tomatoes.',
      'Whisk olive oil, lemon juice, salt, and oregano together, pour over the bowl, and toss gently.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_5',
    externalId: 'curated_ln_5',
    sourceProvider: 'curated',
    title: 'Shredded Chicken & Vegetable Clear Soup',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg',
    category: 'lunch',
    cuisine: 'International',
    calories: 360,
    protein: 35,
    carbs: 34,
    fat: 8,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, poached and shredded',
      '2 cups low-sodium chicken broth',
      '1 medium carrot & 1 stalk celery, sliced',
      '1/2 cup diced potato',
      '1 cup fresh spinach & chopped parsley'
    ],
    instructions: [
      'Bring the chicken broth, sliced carrot, celery, and diced potato to a boil and simmer for 10 minutes until vegetables are tender.',
      'Add the shredded Halal chicken breast and fresh spinach, simmering for 2 more minutes.',
      'Ladle into a warm bowl and garnish with fresh parsley.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Low-Calorie'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_6',
    externalId: 'curated_ln_6',
    sourceProvider: 'curated',
    title: 'Roasted Turkey & Avocado Whole Wheat Wrap',
    imageUrl: 'https://www.themealdb.com/images/media/meals/mp9z0i1782238092.jpg',
    category: 'lunch',
    cuisine: 'American',
    calories: 410,
    protein: 34,
    carbs: 36,
    fat: 14,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '1 large whole wheat tortilla',
      '110g sliced Halal roasted turkey breast',
      '1/3 ripe avocado, sliced',
      '1 cup shredded romaine lettuce',
      '1/2 medium tomato, sliced',
      '1 tsp Dijon mustard'
    ],
    instructions: [
      'Lay the whole wheat tortilla flat and spread Dijon mustard evenly across the center.',
      'Layer the Halal turkey breast, avocado slices, tomato, and shredded romaine lettuce.',
      'Fold in the sides, roll tightly into a wrap, and slice in half.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_7',
    externalId: 'curated_ln_7',
    sourceProvider: 'curated',
    title: 'Hearty Red Lentil & Vegetable Soup',
    imageUrl: 'https://www.themealdb.com/images/media/meals/lx1kkj1593349302.jpg',
    category: 'lunch',
    cuisine: 'Middle Eastern',
    calories: 370,
    protein: 19,
    carbs: 58,
    fat: 6,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '1/2 cup dry red lentils, rinsed',
      '2 cups vegetable broth',
      '1 medium carrot & 1/2 onion, diced',
      '1 cup chopped spinach',
      '1 tsp ground cumin & 1/2 tsp turmeric',
      '1 tbsp fresh lemon juice'
    ],
    instructions: [
      'Sauté diced onion and carrot with cumin and turmeric in a pot for 3 minutes.',
      'Add rinsed red lentils and vegetable broth; simmer covered for 15 minutes until lentils are soft.',
      'Stir in chopped spinach and fresh lemon juice before serving warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_8',
    externalId: 'curated_ln_8',
    sourceProvider: 'curated',
    title: 'Stir-Fried Tofu, Tempeh & Crisp Green Beans',
    imageUrl: 'https://www.themealdb.com/images/media/meals/4xcfai1763765676.jpg',
    category: 'lunch',
    cuisine: 'Asian',
    calories: 405,
    protein: 24,
    carbs: 42,
    fat: 14,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '80g firm tofu & 60g tempeh, cubed',
      '1.5 cups fresh green beans, trimmed',
      '1/2 cup cooked brown rice',
      '2 cloves garlic, minced',
      '1 tbsp coconut aminos',
      '1 tsp olive oil'
    ],
    instructions: [
      'Pan-sear the tofu and tempeh cubes in olive oil over medium-high heat for 5 minutes until golden.',
      'Add minced garlic and trimmed green beans with 2 tablespoons of water, stir-frying for 4 minutes.',
      'Season with coconut aminos, toss well, and serve alongside warm brown rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_9',
    externalId: 'curated_ln_9',
    sourceProvider: 'curated',
    title: 'Grilled Chicken Fajita Rice Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/ypxvwv1505333929.jpg',
    category: 'lunch',
    cuisine: 'Mexican',
    calories: 460,
    protein: 39,
    carbs: 48,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, cut into strips',
      '1/2 red bell pepper & 1/2 green bell pepper, sliced',
      '1/4 cup sliced red onion',
      '3/4 cup cooked brown or basmati rice',
      '1 tsp olive oil, cumin & paprika',
      '2 tbsp fresh tomato salsa'
    ],
    instructions: [
      'Toss the chicken strips with cumin, paprika, salt, and olive oil.',
      'Cook the chicken strips, bell peppers, and onion in a hot skillet for 8 minutes until charred and cooked through.',
      'Spoon over warm rice and top with fresh tomato salsa.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_10',
    externalId: 'curated_ln_10',
    sourceProvider: 'curated',
    title: 'Black Bean, Roasted Sweet Potato & Avocado Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1549542994.jpg',
    category: 'lunch',
    cuisine: 'Mexican',
    calories: 420,
    protein: 14,
    carbs: 62,
    fat: 13,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '3/4 cup cooked black beans, warmed',
      '1 medium roasted sweet potato, cubed',
      '1/4 ripe avocado, diced',
      '1/2 cup sweet corn kernels',
      '1 cup shredded romaine lettuce',
      '1 tbsp fresh lime juice & cilantro'
    ],
    instructions: [
      'Arrange the shredded romaine lettuce in the base of a wide bowl.',
      'Top with warm cubed sweet potato, black beans, sweet corn, and diced avocado.',
      'Squeeze fresh lime juice over the bowl and garnish with chopped cilantro.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_11',
    externalId: 'curated_ln_11',
    sourceProvider: 'curated',
    title: 'Spiced Ground Beef & Green Peas with Basmati Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg',
    category: 'lunch',
    cuisine: 'Middle Eastern',
    calories: 475,
    protein: 36,
    carbs: 48,
    fat: 14,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '130g extra-lean Halal ground beef',
      '1/2 cup green peas',
      '3/4 cup cooked basmati rice',
      '1/2 cup diced tomatoes & 1/4 onion',
      '1 tsp ground cumin, coriander & turmeric'
    ],
    instructions: [
      'Brown the Halal ground beef and diced onion in a skillet over medium heat for 6 minutes.',
      'Stir in the spices, diced tomatoes, and green peas, simmering covered for 6 minutes.',
      'Serve warm alongside fluffy basmati rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_12',
    externalId: 'curated_ln_12',
    sourceProvider: 'curated',
    title: 'Roasted Chicken & Sweet Potato Harvest Salad',
    imageUrl: 'https://www.themealdb.com/images/media/meals/wvqpwt1468339226.jpg',
    category: 'lunch',
    cuisine: 'International',
    calories: 415,
    protein: 37,
    carbs: 38,
    fat: 12,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g roasted Halal chicken breast, sliced',
      '1/2 cup roasted sweet potato cubes',
      '2 cups baby spinach & mixed greens',
      '1/2 apple, thinly sliced',
      '1 tbsp olive oil & apple cider vinegar dressing'
    ],
    instructions: [
      'Toss the baby spinach, mixed greens, and apple slices in a salad bowl with the olive oil and vinegar dressing.',
      'Top with warm roasted sweet potato cubes and sliced Halal chicken breast.',
      'Season with freshly cracked black pepper and serve immediately.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_13',
    externalId: 'curated_ln_13',
    sourceProvider: 'curated',
    title: 'Garlic Ginger Chicken & Bok Choy Stir-Fry',
    imageUrl: 'https://www.themealdb.com/images/media/meals/nmxec11782498644.jpg',
    category: 'lunch',
    cuisine: 'Asian',
    calories: 425,
    protein: 38,
    carbs: 42,
    fat: 10,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, sliced',
      '2 cups baby bok choy, halved',
      '1/2 cup sliced mushrooms',
      '3/4 cup cooked jasmine or brown rice',
      '1 tsp grated ginger, 2 cloves garlic & 1 tsp olive oil'
    ],
    instructions: [
      'Heat olive oil in a skillet and stir-fry sliced Halal chicken with garlic and ginger for 5 minutes.',
      'Add mushrooms and baby bok choy, cooking for 3 minutes until greens are tender-crisp.',
      'Serve hot over cooked jasmine or brown rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_14',
    externalId: 'curated_ln_14',
    sourceProvider: 'curated',
    title: 'Warm Lentil, Spinach & Roasted Vegetable Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/zry07j1763779321.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 385,
    protein: 18,
    carbs: 54,
    fat: 10,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '3/4 cup cooked green or brown lentils',
      '1 cup roasted zucchini and bell peppers',
      '1.5 cups fresh baby spinach',
      '1 tsp extra virgin olive oil',
      '1 tbsp lemon herb dressing'
    ],
    instructions: [
      'Warm the cooked lentils and roasted vegetables in a skillet over medium heat for 4 minutes.',
      'Fold in the fresh baby spinach until slightly wilted.',
      'Transfer to a bowl and drizzle with lemon herb dressing and olive oil.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_15',
    externalId: 'curated_ln_15',
    sourceProvider: 'curated',
    title: 'Grilled Chicken Skewers with Rice & Cucumber Salad',
    imageUrl: 'https://www.themealdb.com/images/media/meals/hcg6l91763596970.jpg',
    category: 'lunch',
    cuisine: 'Middle Eastern',
    calories: 455,
    protein: 41,
    carbs: 45,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '150g Halal chicken breast, cubed',
      '3/4 cup cooked basmati rice',
      '1/2 cup diced cucumber & tomato salad',
      '1 tsp olive oil, lemon juice, garlic & paprika'
    ],
    instructions: [
      'Marinate cubed Halal chicken breast in lemon juice, olive oil, garlic, and paprika for 5 minutes.',
      'Thread onto skewers or pan-grill for 8 to 10 minutes until golden and cooked through.',
      'Serve alongside basmati rice and fresh cucumber tomato salad.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_16',
    externalId: 'curated_ln_16',
    sourceProvider: 'curated',
    title: 'Baked Salmon with Quinoa & Steamed Asparagus',
    imageUrl: 'https://www.themealdb.com/images/media/meals/0iryz91763778419.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 470,
    protein: 38,
    carbs: 36,
    fat: 18,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g wild salmon fillet',
      '3/4 cup cooked quinoa',
      '1 cup asparagus spears, trimmed',
      '1 tsp olive oil & lemon wedges',
      '1/2 tsp dried dill & garlic powder'
    ],
    instructions: [
      'Season the salmon fillet with dill, garlic powder, lemon juice, and olive oil.',
      'Bake at 200°C (400°F) or pan-sear for 10 to 12 minutes alongside the asparagus spears.',
      'Serve over warm quinoa with fresh lemon wedges.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_17',
    externalId: 'curated_ln_17',
    sourceProvider: 'curated',
    title: 'Mediterranean Chickpea, Quinoa & Avocado Salad Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/k29viq1585565980.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 410,
    protein: 15,
    carbs: 54,
    fat: 14,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup cooked chickpeas, rinsed',
      '3/4 cup cooked quinoa',
      '1/4 ripe avocado, diced',
      '1/2 cup diced cucumber & cherry tomatoes',
      '1 tbsp lemon juice & 1 tsp extra virgin olive oil'
    ],
    instructions: [
      'Combine the cooked quinoa and rinsed chickpeas in a wide lunch bowl.',
      'Top with diced cucumber, halved cherry tomatoes, and diced avocado.',
      'Drizzle with fresh lemon juice and olive oil, toss gently, and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_18',
    externalId: 'curated_ln_18',
    sourceProvider: 'curated',
    title: 'Warm Red Kidney Bean & Brown Rice Fiesta Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/c6ghxm1763335584.jpg',
    category: 'lunch',
    cuisine: 'Mexican',
    calories: 415,
    protein: 16,
    carbs: 68,
    fat: 8,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup cooked red kidney beans',
      '3/4 cup cooked brown rice',
      '1/2 cup roasted bell peppers & sweet corn',
      '2 tbsp fresh tomato salsa',
      '1/2 tsp ground cumin & fresh cilantro'
    ],
    instructions: [
      'Warm the red kidney beans with ground cumin and a splash of water in a small saucepan for 4 minutes.',
      'Spoon the warm brown rice into a bowl and top with spiced kidney beans, roasted bell peppers, and corn.',
      'Finish with fresh tomato salsa and chopped cilantro.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_19',
    externalId: 'curated_ln_19',
    sourceProvider: 'curated',
    title: 'Crispy Baked Falafel-Spiced Chickpeas with Rice & Greens',
    imageUrl: 'https://www.themealdb.com/images/media/meals/t5rgav1784659936.jpg',
    category: 'lunch',
    cuisine: 'Middle Eastern',
    calories: 395,
    protein: 15,
    carbs: 58,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '3/4 cup chickpeas, patted dry',
      '1/2 cup cooked basmati rice',
      '2 cups chopped romaine lettuce & cucumber',
      '1 tsp ground cumin, coriander & garlic powder',
      '1 tsp olive oil & lemon wedges'
    ],
    instructions: [
      'Toss the dried chickpeas with olive oil, cumin, coriander, and garlic powder.',
      'Pan-roast in a skillet over medium heat for 8 minutes until golden and crisp.',
      'Serve over chopped romaine, cucumber, and warm basmati rice with lemon wedges.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_20',
    externalId: 'curated_ln_20',
    sourceProvider: 'curated',
    title: 'Ginger Garlic Edamame, Broccoli & Quinoa Stir-Fry',
    imageUrl: 'https://www.themealdb.com/images/media/meals/pk8wtn1763758591.jpg',
    category: 'lunch',
    cuisine: 'Asian',
    calories: 390,
    protein: 19,
    carbs: 48,
    fat: 12,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup shelled edamame beans',
      '1.5 cups broccoli florets',
      '3/4 cup cooked quinoa',
      '1 tsp grated ginger & 2 cloves garlic',
      '1 tbsp coconut aminos & 1 tsp olive oil'
    ],
    instructions: [
      'Heat olive oil in a skillet and stir-fry broccoli florets and shelled edamame with garlic and ginger for 5 minutes.',
      'Add cooked quinoa and coconut aminos, tossing over medium heat for 2 minutes.',
      'Transfer to a lunch bowl and serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_21',
    externalId: 'curated_ln_21',
    sourceProvider: 'curated',
    title: 'Tuscan White Bean, Spinach & Tomato Rice Skillet',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/q7w4xu1487603180.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 380,
    protein: 16,
    carbs: 58,
    fat: 8,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup cooked white cannellini beans',
      '1/2 cup cooked brown rice',
      '2 cups fresh baby spinach',
      '1/2 cup diced tomatoes',
      '1 tsp olive oil, garlic & dried oregano'
    ],
    instructions: [
      'Sauté garlic and oregano in olive oil in a skillet for 1 minute, then add diced tomatoes and white beans.',
      'Simmer for 5 minutes, then fold in baby spinach until wilted.',
      'Serve warm over cooked brown rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_22',
    externalId: 'curated_ln_22',
    sourceProvider: 'curated',
    title: 'Roasted Zucchini, Chickpea & Sweet Potato Power Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg',
    category: 'lunch',
    cuisine: 'International',
    calories: 405,
    protein: 14,
    carbs: 62,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1 medium sweet potato, cubed and roasted',
      '1/2 cup cooked chickpeas',
      '1 medium zucchini, diced and sautéed',
      '1.5 cups mixed salad greens',
      '1 tbsp lemon olive oil dressing'
    ],
    instructions: [
      'Sauté diced zucchini and chickpeas in a skillet for 6 minutes until lightly golden.',
      'Arrange mixed salad greens in a bowl and top with warm roasted sweet potato cubes and zucchini-chickpea mix.',
      'Drizzle with lemon olive oil dressing and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_23',
    externalId: 'curated_ln_23',
    sourceProvider: 'curated',
    title: 'Spiced Black Lentil & Vegetable Rice Pilaf',
    imageUrl: 'https://www.themealdb.com/images/media/meals/9bl20p1763248192.jpg',
    category: 'lunch',
    cuisine: 'Middle Eastern',
    calories: 410,
    protein: 17,
    carbs: 64,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1/2 cup cooked black or green lentils',
      '1/2 cup cooked basmati rice',
      '1/2 cup diced carrots & green peas',
      '1/4 onion, thinly sliced',
      '1 tsp olive oil & 1/2 tsp ground cumin'
    ],
    instructions: [
      'Sauté sliced onion, diced carrots, and green peas in olive oil with ground cumin for 5 minutes.',
      'Fold in the cooked lentils and basmati rice, heating through for 3 minutes.',
      'Transfer to a plate and serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },

  // ============================================================================
  // DINNER (23 recipes — including 12 Vegan + Gluten-Free + Allergen-Free)
  // ============================================================================
  {
    id: 'curated_dn_1',
    externalId: 'curated_dn_1',
    sourceProvider: 'curated',
    title: 'Herb Roasted Chicken Breast with Sweet Potato & Green Beans',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 440,
    protein: 40,
    carbs: 42,
    fat: 11,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '150g Halal skinless chicken breast',
      '1 medium sweet potato, cubed',
      '1.5 cups green beans, trimmed',
      '1 tsp olive oil',
      '1 tsp dried rosemary, thyme & garlic powder'
    ],
    instructions: [
      'Rub the Halal chicken breast and sweet potato cubes with olive oil, rosemary, thyme, and garlic powder.',
      'Roast or pan-cook for 15 to 18 minutes until chicken is juicy and sweet potatoes are tender.',
      'Steam the green beans for 4 minutes and plate alongside the chicken and sweet potatoes.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Balanced'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_2',
    externalId: 'curated_dn_2',
    sourceProvider: 'curated',
    title: 'Lean Beef Strips with Bell Peppers & Brown Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 465,
    protein: 37,
    carbs: 45,
    fat: 14,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g lean Halal beef sirloin strips',
      '1 cup sliced mixed bell peppers',
      '1/2 medium onion, sliced',
      '3/4 cup cooked brown rice',
      '1 tsp olive oil, garlic & black pepper'
    ],
    instructions: [
      'Heat olive oil in a skillet over high heat and sear the Halal beef strips for 3 minutes.',
      'Add sliced bell peppers, onion, garlic, and black pepper, stir-frying for 4 minutes until tender-crisp.',
      'Serve warm over cooked brown rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_3',
    externalId: 'curated_dn_3',
    sourceProvider: 'curated',
    title: 'Clear Chicken, Mushroom & Spinach Soup',
    imageUrl: 'https://www.themealdb.com/images/media/meals/fl4brj1764361323.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 320,
    protein: 34,
    carbs: 22,
    fat: 8,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, sliced',
      '1 cup sliced button or cremini mushrooms',
      '1.5 cups fresh spinach',
      '2 cups low-sodium chicken broth',
      '1/2 cup cooked brown rice or diced potato'
    ],
    instructions: [
      'Simmer the chicken broth with sliced mushrooms and diced potato or rice for 8 minutes.',
      'Add the sliced Halal chicken breast and cook gently for 5 minutes until opaque.',
      'Stir in the fresh spinach until wilted and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Low-Carb', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_4',
    externalId: 'curated_dn_4',
    sourceProvider: 'curated',
    title: 'Chickpea & Spinach Curry with Basmati Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/prjve31763486864.jpg',
    category: 'dinner',
    cuisine: 'Indian',
    calories: 410,
    protein: 15,
    carbs: 64,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '3/4 cup cooked chickpeas',
      '2 cups fresh spinach',
      '1/2 cup crushed tomatoes',
      '1/2 cup cooked basmati rice',
      '1 tsp garam masala, cumin & garlic',
      '1 tsp olive oil'
    ],
    instructions: [
      'Sauté garlic, cumin, and garam masala in olive oil for 1 minute until fragrant.',
      'Add crushed tomatoes and chickpeas, simmering for 8 minutes until thickened.',
      'Fold in fresh spinach until wilted and serve with basmati rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_5',
    externalId: 'curated_dn_5',
    sourceProvider: 'curated',
    title: 'Grilled Turkey Breast Patties with Roasted Zucchini',
    imageUrl: 'https://www.themealdb.com/images/media/meals/wruvqv1511880994.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 395,
    protein: 38,
    carbs: 28,
    fat: 13,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g lean Halal ground turkey breast',
      '1 medium zucchini, sliced into rounds',
      '1/2 cup cooked quinoa',
      '1 tsp dried oregano, garlic powder & parsley',
      '1 tsp olive oil'
    ],
    instructions: [
      'Form the lean Halal ground turkey with oregano, garlic powder, and parsley into two small patties.',
      'Pan-grill the patties in olive oil for 5 minutes per side alongside the zucchini rounds.',
      'Serve hot with a side of fluffy quinoa.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Low-Carb', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_6',
    externalId: 'curated_dn_6',
    sourceProvider: 'curated',
    title: 'Garlic Tofu & Broccoli Stir-Fry with Jasmine Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/bmbvjk1782770310.jpg',
    category: 'dinner',
    cuisine: 'Asian',
    calories: 385,
    protein: 21,
    carbs: 48,
    fat: 12,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '140g extra-firm tofu, cubed',
      '1.5 cups broccoli florets',
      '3/4 cup cooked jasmine or brown rice',
      '2 cloves garlic & 1 tsp grated ginger',
      '1 tbsp coconut aminos & 1 tsp olive oil'
    ],
    instructions: [
      'Crisp the cubed tofu in a non-stick skillet with olive oil over medium-high heat for 5 minutes.',
      'Add broccoli florets, garlic, ginger, and a splash of water; cover and steam-fry for 3 minutes.',
      'Toss with coconut aminos and serve over rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_7',
    externalId: 'curated_dn_7',
    sourceProvider: 'curated',
    title: 'Moroccan Spiced Chicken & Vegetable Stew',
    imageUrl: 'https://www.themealdb.com/images/media/meals/7kb44y1763589084.jpg',
    category: 'dinner',
    cuisine: 'Middle Eastern',
    calories: 420,
    protein: 36,
    carbs: 42,
    fat: 11,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, cubed',
      '1/2 cup cooked chickpeas',
      '1 medium carrot & 1/2 zucchini, diced',
      '1 cup tomato herb broth',
      '1 tsp cumin, cinnamon & turmeric'
    ],
    instructions: [
      'Brown the cubed Halal chicken breast with cumin, turmeric, and a pinch of cinnamon in a pot for 4 minutes.',
      'Add diced carrot, zucchini, chickpeas, and tomato herb broth.',
      'Simmer covered for 12 to 15 minutes until tender and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_8',
    externalId: 'curated_dn_8',
    sourceProvider: 'curated',
    title: 'Lentil & Vegetable Shepherd’s Bowl with Sweet Potato Mash',
    imageUrl: 'https://www.themealdb.com/images/media/meals/m0p0j81765568742.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 395,
    protein: 17,
    carbs: 64,
    fat: 7,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '3/4 cup cooked brown lentils',
      '1/2 cup mixed carrots, peas, and corn',
      '1 medium sweet potato, steamed and mashed',
      '1/2 cup vegetable broth & 1 tbsp tomato paste',
      '1/2 tsp dried thyme & rosemary'
    ],
    instructions: [
      'Simmer the cooked lentils, mixed vegetables, vegetable broth, tomato paste, and herbs in a skillet for 6 minutes.',
      'Mash the steamed sweet potato with a pinch of sea salt and black pepper.',
      'Spoon the savory lentil mixture into a bowl and top with warm sweet potato mash.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_9',
    externalId: 'curated_dn_9',
    sourceProvider: 'curated',
    title: 'Lemon Garlic Chicken with Steamed Asparagus & Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/uuuspp1511297945.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 430,
    protein: 39,
    carbs: 40,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '150g Halal chicken breast, butterflied',
      '1 cup fresh asparagus spears',
      '2/3 cup cooked brown or basmati rice',
      '2 cloves garlic, minced & 1 tbsp lemon juice',
      '1 tsp extra virgin olive oil'
    ],
    instructions: [
      'Sear the Halal chicken breast in olive oil with minced garlic for 5 minutes per side.',
      'Add asparagus spears and lemon juice to the pan, cooking for 3 minutes until crisp-tender.',
      'Plate with warm rice and spoon pan juices over the chicken.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_10',
    externalId: 'curated_dn_10',
    sourceProvider: 'curated',
    title: 'Vegetable & White Bean Minestrone Soup',
    imageUrl: 'https://www.themealdb.com/images/media/meals/xrxz7h1782592711.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 345,
    protein: 15,
    carbs: 54,
    fat: 7,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '3/4 cup cooked cannellini or white beans',
      '1.5 cups tomato vegetable broth',
      '1/2 cup diced zucchini, carrot, and celery',
      '1 cup fresh spinach',
      '1 tsp Italian herbs & 1 tsp olive oil'
    ],
    instructions: [
      'Sauté diced carrot, celery, and zucchini in olive oil with Italian herbs for 4 minutes.',
      'Pour in the tomato vegetable broth and white beans, simmering for 10 minutes.',
      'Stir in the fresh spinach until wilted and serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_11',
    externalId: 'curated_dn_11',
    sourceProvider: 'curated',
    title: 'Grilled Beef Kofta Skewers with Roasted Vegetables',
    imageUrl: 'https://www.themealdb.com/images/media/meals/04axct1763793018.jpg',
    category: 'dinner',
    cuisine: 'Middle Eastern',
    calories: 460,
    protein: 36,
    carbs: 38,
    fat: 16,
    prepTime: 22,
    servings: 1,
    ingredients: [
      '140g lean Halal ground beef',
      '2 tbsp finely chopped parsley & grated onion',
      '1 tsp ground cumin & coriander',
      '1 cup roasted bell peppers and tomatoes',
      '1/2 cup cooked basmati rice'
    ],
    instructions: [
      'Mix the lean Halal ground beef with parsley, grated onion, cumin, and coriander, then shape into logs.',
      'Grill or pan-sear the kofta for 8 to 10 minutes alongside bell peppers and tomatoes.',
      'Serve warm over basmati rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_12',
    externalId: 'curated_dn_12',
    sourceProvider: 'curated',
    title: 'Shredded Chicken Lettuce Wraps with Brown Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1529446352.jpg',
    category: 'dinner',
    cuisine: 'Asian',
    calories: 375,
    protein: 35,
    carbs: 36,
    fat: 9,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '130g cooked Halal chicken breast, diced',
      '4 large crisp romaine lettuce leaves',
      '1/2 cup cooked brown rice',
      '1/2 cup shredded carrots & diced cucumber',
      '1 tbsp ginger garlic glaze'
    ],
    instructions: [
      'Warm the diced Halal chicken breast in a skillet with the ginger garlic glaze for 3 minutes.',
      'Arrange the crisp romaine lettuce leaves on a plate and spoon in brown rice and chicken.',
      'Top with shredded carrots and cucumber and enjoy.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_13',
    externalId: 'curated_dn_13',
    sourceProvider: 'curated',
    title: 'Black Pepper Tempeh & Vegetable Stir-Fry',
    imageUrl: 'https://www.themealdb.com/images/media/meals/4mhr3u1763481087.jpg',
    category: 'dinner',
    cuisine: 'Asian',
    calories: 390,
    protein: 22,
    carbs: 44,
    fat: 13,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '120g tempeh, sliced into strips',
      '1 cup broccoli & sliced bell peppers',
      '1/2 cup cooked brown rice',
      '1 tsp coarse black pepper & 2 cloves garlic',
      '1 tbsp coconut aminos & 1 tsp olive oil'
    ],
    instructions: [
      'Pan-sear the tempeh strips in olive oil for 4 minutes until lightly crisp.',
      'Add garlic, broccoli, and bell peppers, stir-frying for 4 minutes.',
      'Season with black pepper and coconut aminos and serve with brown rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_14',
    externalId: 'curated_dn_14',
    sourceProvider: 'curated',
    title: 'Roasted Chicken & Cauliflower Rice Skillet',
    imageUrl: 'https://www.themealdb.com/images/media/meals/vdwloy1713225718.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 340,
    protein: 38,
    carbs: 18,
    fat: 12,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, diced',
      '1.5 cups riced cauliflower',
      '1/2 cup diced zucchini and bell pepper',
      '2 cloves garlic, minced',
      '1 tsp olive oil & Italian herbs'
    ],
    instructions: [
      'Cook the diced Halal chicken breast with olive oil, garlic, and herbs in a skillet for 6 minutes.',
      'Add diced zucchini, bell pepper, and riced cauliflower, sautéing for 5 minutes until tender.',
      'Season to taste and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Low-Carb', 'Keto', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_15',
    externalId: 'curated_dn_15',
    sourceProvider: 'curated',
    title: 'Hearty Beef, Potato & Carrot Stew',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 445,
    protein: 35,
    carbs: 42,
    fat: 14,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '130g lean Halal stewing beef, cubed small',
      '1 medium potato, cubed',
      '1 medium carrot & 1 stalk celery, chopped',
      '1.5 cups beef broth',
      '1 tsp dried thyme & 1 tbsp tomato paste'
    ],
    instructions: [
      'Sear the cubed Halal beef in a pot over medium-high heat for 4 minutes.',
      'Add potato, carrot, celery, tomato paste, thyme, and beef broth.',
      'Simmer covered for 18 minutes until beef and potatoes are fork-tender.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_16',
    externalId: 'curated_dn_16',
    sourceProvider: 'curated',
    title: 'Baked Lemon Herb Cod with Steamed Broccoli',
    imageUrl: 'https://www.themealdb.com/images/media/meals/jg4r991779916649.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 350,
    protein: 36,
    carbs: 28,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '150g fresh cod or tilapia fillet',
      '1.5 cups broccoli florets',
      '1/2 cup cooked brown rice',
      '1 tbsp lemon juice & 1 tsp olive oil',
      '1/2 tsp paprika & garlic powder'
    ],
    instructions: [
      'Brush the fish fillet with olive oil, lemon juice, paprika, and garlic powder.',
      'Bake at 200°C (400°F) for 12 minutes until flaky and opaque.',
      'Serve alongside steamed broccoli florets and brown rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_17',
    externalId: 'curated_dn_17',
    sourceProvider: 'curated',
    title: 'Red Lentil & Coconut Spinach Dal with Basmati Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/o5fuq51764789643.jpg',
    category: 'dinner',
    cuisine: 'Indian',
    calories: 405,
    protein: 18,
    carbs: 62,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1/2 cup dry red lentils, rinsed',
      '1/2 cup cooked basmati rice',
      '1.5 cups fresh spinach',
      '1/4 cup light coconut milk & 1.5 cups vegetable broth',
      '1 tsp turmeric, cumin & grated ginger'
    ],
    instructions: [
      'Simmer rinsed red lentils in vegetable broth with turmeric, cumin, and ginger for 14 minutes until soft.',
      'Stir in light coconut milk and fresh spinach until wilted.',
      'Serve warm with fluffy basmati rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_18',
    externalId: 'curated_dn_18',
    sourceProvider: 'curated',
    title: 'Roasted Cauliflower, Chickpea & Quinoa Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sl6vqv1763335988.jpg',
    category: 'dinner',
    cuisine: 'Middle Eastern',
    calories: 390,
    protein: 15,
    carbs: 56,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1.5 cups cauliflower florets',
      '1/2 cup cooked chickpeas',
      '3/4 cup cooked quinoa',
      '1 tsp ground cumin, paprika & olive oil',
      '1 tbsp lemon herb dressing'
    ],
    instructions: [
      'Toss cauliflower florets and chickpeas with olive oil, cumin, and paprika.',
      'Roast or pan-sear for 12 minutes until tender and charred at the edges.',
      'Serve over warm quinoa and drizzle with lemon herb dressing.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_19',
    externalId: 'curated_dn_19',
    sourceProvider: 'curated',
    title: 'Black Bean, Sweet Corn & Zucchini Enchilada Skillet',
    imageUrl: 'https://www.themealdb.com/images/media/meals/7b862e1763194846.jpg',
    category: 'dinner',
    cuisine: 'Mexican',
    calories: 380,
    protein: 15,
    carbs: 60,
    fat: 9,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '3/4 cup cooked black beans',
      '1/2 cup sweet corn & 1 diced zucchini',
      '1/2 cup cooked brown rice',
      '1/2 cup mild red tomato sauce',
      '1/4 ripe avocado, sliced'
    ],
    instructions: [
      'Sauté diced zucchini and sweet corn in a skillet for 4 minutes until tender.',
      'Stir in black beans, cooked brown rice, and mild tomato sauce; simmer for 5 minutes.',
      'Top with sliced avocado and serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_20',
    externalId: 'curated_dn_20',
    sourceProvider: 'curated',
    title: 'Moroccan Chickpea, Carrot & Sweet Potato Tagine',
    imageUrl: 'https://www.themealdb.com/images/media/meals/g373701551450225.jpg',
    category: 'dinner',
    cuisine: 'Middle Eastern',
    calories: 395,
    protein: 13,
    carbs: 66,
    fat: 8,
    prepTime: 22,
    servings: 1,
    ingredients: [
      '3/4 cup cooked chickpeas',
      '1 medium sweet potato & 1 carrot, cubed',
      '1 cup tomato vegetable broth',
      '1/2 cup baby spinach',
      '1 tsp cumin, coriander & cinnamon'
    ],
    instructions: [
      'Simmer cubed sweet potato, carrot, and chickpeas in tomato vegetable broth with Moroccan spices for 15 minutes.',
      'Stir in baby spinach until wilted.',
      'Ladle into a warm bowl and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_21',
    externalId: 'curated_dn_21',
    sourceProvider: 'curated',
    title: 'Crispy Tofu, Mushroom & Bok Choy Rice Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/jvjnoh1780086318.jpg',
    category: 'dinner',
    cuisine: 'Asian',
    calories: 385,
    protein: 20,
    carbs: 46,
    fat: 12,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '130g firm tofu, cubed',
      '1 cup sliced mushrooms & 1.5 cups bok choy',
      '3/4 cup cooked jasmine rice',
      '1 tbsp coconut aminos & 1 tsp grated ginger',
      '1 tsp olive oil'
    ],
    instructions: [
      'Pan-sear cubed tofu in olive oil for 5 minutes until golden.',
      'Add sliced mushrooms, bok choy, ginger, and coconut aminos, stir-frying for 4 minutes.',
      'Serve hot over cooked jasmine rice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_22',
    externalId: 'curated_dn_22',
    sourceProvider: 'curated',
    title: 'Hearty Green Lentil, Potato & Spinach Stew',
    imageUrl: 'https://www.themealdb.com/images/media/meals/uyqrrv1511553350.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 375,
    protein: 16,
    carbs: 58,
    fat: 8,
    prepTime: 22,
    servings: 1,
    ingredients: [
      '3/4 cup cooked green lentils',
      '1 medium potato, cubed',
      '1.5 cups vegetable broth',
      '1.5 cups fresh spinach',
      '1 tsp olive oil, garlic & dried thyme'
    ],
    instructions: [
      'Simmer cubed potato in vegetable broth with garlic and thyme for 12 minutes until tender.',
      'Add cooked green lentils and fresh spinach, cooking for 3 more minutes.',
      'Drizzle with olive oil and serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_23',
    externalId: 'curated_dn_23',
    sourceProvider: 'curated',
    title: 'Mediterranean Stuffed Bell Pepper Skillet with Rice & Beans',
    imageUrl: 'https://www.themealdb.com/images/media/meals/lgmnff1763789847.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 390,
    protein: 14,
    carbs: 62,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1/2 cup cooked white or kidney beans',
      '1/2 cup cooked brown rice',
      '1 cup diced bell peppers & tomatoes',
      '1 tsp Italian herbs & garlic powder',
      '1 tsp extra virgin olive oil'
    ],
    instructions: [
      'Sauté diced bell peppers in olive oil with garlic powder and Italian herbs for 5 minutes.',
      'Stir in diced tomatoes, cooked beans, and brown rice; cover and simmer for 5 minutes.',
      'Transfer to a bowl and serve hot.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },

  // ============================================================================
  // SNACKS (18 recipes — 100% authentic light snacks with verified TheMealDB photos and comprehensive instructions)
  // ============================================================================
  {
  "id": "curated_sn_1",
  "externalId": "curated_sn_1",
  "sourceProvider": "curated",
  "title": "Crispy Oven-Baked Falafel Bites",
  "imageUrl": "https://www.themealdb.com/images/media/meals/xrrsvt1511814969.jpg",
  "category": "snack",
  "cuisine": "Middle Eastern",
  "calories": 175,
  "protein": 8,
  "carbs": 22,
  "fat": 6,
  "prepTime": 15,
  "servings": 1,
  "ingredients": [
    "3/4 cup cooked chickpeas, drained and patted dry",
    "1 clove garlic, finely minced",
    "2 tbsp fresh flat-leaf parsley, chopped",
    "1/2 tsp ground cumin & coriander",
    "1 tsp extra virgin olive oil",
    "Pinch of sea salt and black pepper"
  ],
  "instructions": [
    "Preheat your oven to 200°C (400°F) and line a baking sheet with parchment paper.",
    "In a food processor, pulse the dry chickpeas, minced garlic, fresh parsley, ground cumin, coriander, salt, and pepper until coarse but cohesive.",
    "Scoop and shape the mixture into 4 compact, bite-sized falafel patties using your hands.",
    "Place the patties on the baking sheet and lightly brush the tops with extra virgin olive oil.",
    "Bake for 18 to 20 minutes, flipping once halfway through, until the exterior is deeply golden and crisp.",
    "Transfer to a snack plate and serve warm with a squeeze of fresh lemon juice."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "High-Fiber"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_2",
  "externalId": "curated_sn_2",
  "sourceProvider": "curated",
  "title": "Classic Garlic Hummus Dip with Crisp Veggie Sticks",
  "imageUrl": "https://www.themealdb.com/images/media/meals/1529444113.jpg",
  "category": "snack",
  "cuisine": "Mediterranean",
  "calories": 160,
  "protein": 6,
  "carbs": 18,
  "fat": 7,
  "prepTime": 8,
  "servings": 1,
  "ingredients": [
    "1/3 cup creamy chickpea hummus",
    "1 medium sweet carrot, peeled and cut into batons",
    "1/2 crisp English cucumber, sliced into sticks",
    "1/2 red bell pepper, cut into dipping strips",
    "1/4 tsp smoked Spanish paprika",
    "1/2 tsp extra virgin olive oil"
  ],
  "instructions": [
    "Rinse the fresh carrot, cucumber, and bell pepper under cold running water and pat thoroughly dry.",
    "Slice the carrot and cucumber into uniform 3-inch finger batons and slice the bell pepper into wide dipping scoops.",
    "Spoon the chickpea hummus into the center of a small dipping ramekin or snack bowl.",
    "Create a shallow well in the center of the hummus with the back of a spoon and drizzle in extra virgin olive oil.",
    "Dust the hummus lightly with smoked Spanish paprika for a warm aromatic finish.",
    "Arrange the colorful fresh vegetable sticks around the bowl and serve immediately."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_3",
  "externalId": "curated_sn_3",
  "sourceProvider": "curated",
  "title": "Roasted Rosemary Almonds & Walnuts",
  "imageUrl": "https://www.themealdb.com/images/media/meals/5vhbzt1782239221.jpg",
  "category": "snack",
  "cuisine": "Mediterranean",
  "calories": 185,
  "protein": 6,
  "carbs": 6,
  "fat": 16,
  "prepTime": 10,
  "servings": 1,
  "ingredients": [
    "15g raw unsalted whole almonds",
    "15g raw English walnut halves",
    "1/2 tsp fresh rosemary needles, finely minced",
    "1/2 tsp extra virgin olive oil",
    "Pinch of flaky sea salt & cracked black pepper"
  ],
  "instructions": [
    "Preheat a dry cast-iron or heavy skillet over medium-low heat for 2 minutes.",
    "Add the raw almonds and walnuts to the warm dry skillet in a single layer without crowding.",
    "Toast the nuts gently for 3 to 4 minutes, shaking the skillet continuously until fragrant and lightly golden.",
    "Drizzle with olive oil, sprinkle in the minced fresh rosemary, flaky sea salt, and black pepper, and toss for 30 seconds.",
    "Remove the skillet from the heat immediately to prevent the nuts from overbrowning.",
    "Pour the warm rosemary nuts onto a parchment-lined dish to cool for 3 minutes until crunchy, then serve."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Low-Carb",
    "Keto",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_4",
  "externalId": "curated_sn_4",
  "sourceProvider": "curated",
  "title": "Steamed Sea Salt Edamame Pods",
  "imageUrl": "https://www.themealdb.com/images/media/meals/1548772327.jpg",
  "category": "snack",
  "cuisine": "Asian",
  "calories": 125,
  "protein": 12,
  "carbs": 10,
  "fat": 4,
  "prepTime": 8,
  "servings": 1,
  "ingredients": [
    "1 cup young green edamame pods in shell",
    "2 cups water for steaming",
    "1/2 tsp coarse flaky sea salt",
    "1/4 tsp toasted sesame seeds"
  ],
  "instructions": [
    "Bring 2 cups of water to a vigorous rolling boil in a small saucepan fitted with a steamer basket.",
    "Rinse the green edamame pods under cold water and trim any excess stems if necessary.",
    "Add the edamame pods into the steamer basket, cover with a tight-fitting lid, and steam over medium-high heat for 5 minutes.",
    "Check that the pods are vibrant emerald green, tender yet firm to the bite.",
    "Remove from heat, transfer immediately into a serving bowl, and toss with coarse flaky sea salt and toasted sesame seeds.",
    "Serve warm, squeezing the tender beans directly from the salted pods."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "High-Protein",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_5",
  "externalId": "curated_sn_5",
  "sourceProvider": "curated",
  "title": "Baba Ghanoush Roasted Eggplant Dip with Veggies",
  "imageUrl": "https://www.themealdb.com/images/media/meals/dlmh401760524897.jpg",
  "category": "snack",
  "cuisine": "Middle Eastern",
  "calories": 145,
  "protein": 4,
  "carbs": 14,
  "fat": 9,
  "prepTime": 15,
  "servings": 1,
  "ingredients": [
    "1/2 cup roasted eggplant pulp, mashed",
    "1 tbsp pure sesame tahini",
    "1 clove garlic, finely grated",
    "1 tbsp fresh lemon juice",
    "1/2 tsp extra virgin olive oil",
    "1 cup crisp cucumber and radish slices",
    "Pinch of sea salt and ground cumin"
  ],
  "instructions": [
    "In a mixing bowl, combine the roasted eggplant pulp, sesame tahini, grated garlic, and fresh lemon juice.",
    "Whisk vigorously with a fork until the eggplant breaks down into a creamy, smoky textured dip.",
    "Season with sea salt and a pinch of ground cumin to taste.",
    "Transfer the baba ghanoush into a snack bowl and drizzle the top with extra virgin olive oil.",
    "Thinly slice fresh cucumber rounds and crisp red radishes.",
    "Arrange the fresh vegetable crisps around the bowl and serve chilled."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Low-Carb",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_6",
  "externalId": "curated_sn_6",
  "sourceProvider": "curated",
  "title": "Crispy Baked Yuca Fries with Lime Dip",
  "imageUrl": "https://www.themealdb.com/images/media/meals/j223gc1784579841.jpg",
  "category": "snack",
  "cuisine": "International",
  "calories": 170,
  "protein": 2,
  "carbs": 34,
  "fat": 3,
  "prepTime": 20,
  "servings": 1,
  "ingredients": [
    "120g yuca root, peeled, boiled tender, and cut into baton fries",
    "1 tsp extra virgin olive oil",
    "1/2 tsp garlic powder & smoked paprika",
    "1 tbsp light unsweetened coconut yogurt with fresh lime juice",
    "Pinch of sea salt"
  ],
  "instructions": [
    "Preheat your oven to 215°C (425°F) or preheat an air fryer to 200°C (400°F).",
    "Ensure the boiled yuca batons are completely dry, removing any fibrous woody central string.",
    "Toss the yuca batons in a bowl with olive oil, garlic powder, smoked paprika, and sea salt until evenly coated.",
    "Spread in a single layer on a parchment-lined baking sheet or in the air fryer basket without overlapping.",
    "Bake for 15 to 18 minutes, shaking halfway through, until golden, shatteringly crisp outside and fluffy inside.",
    "Mix the light coconut yogurt with lime juice and serve immediately with the warm crispy yuca fries."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_7",
  "externalId": "curated_sn_7",
  "sourceProvider": "curated",
  "title": "Air-Crisped Vegetable Spring Rolls",
  "imageUrl": "https://www.themealdb.com/images/media/meals/grhn401765687086.jpg",
  "category": "snack",
  "cuisine": "Asian",
  "calories": 160,
  "protein": 5,
  "carbs": 24,
  "fat": 5,
  "prepTime": 15,
  "servings": 1,
  "ingredients": [
    "2 vegetable spring rolls filled with shredded cabbage, carrots, and glass noodles",
    "1/2 tsp sesame oil for brushing",
    "1 tbsp sweet chili dipping sauce",
    "Pinch of toasted sesame seeds"
  ],
  "instructions": [
    "Preheat your air fryer to 195°C (385°F) or standard oven to 205°C (400°F).",
    "Lightly brush both vegetable spring rolls with a few drops of sesame oil to promote even crisping.",
    "Arrange the spring rolls in the basket seam-side down, leaving space for airflow.",
    "Air-fry for 10 to 12 minutes, turning gently at the 6-minute mark, until the pastry is blistered, amber-golden, and ultra-crisp.",
    "Allow the spring rolls to rest for 1 minute on a wire rack so the wrapper remains crisp.",
    "Slice diagonally into bite-sized halves, garnish with sesame seeds, and serve with sweet chili sauce."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_8",
  "externalId": "curated_sn_8",
  "sourceProvider": "curated",
  "title": "Zesty Guacamole with Crisp Bell Pepper Scoops",
  "imageUrl": "https://www.themealdb.com/images/media/meals/se5vhk1764114880.jpg",
  "category": "snack",
  "cuisine": "Mexican",
  "calories": 150,
  "protein": 3,
  "carbs": 11,
  "fat": 12,
  "prepTime": 8,
  "servings": 1,
  "ingredients": [
    "1/2 ripe Haas avocado, seeded and scooped",
    "1 tbsp fresh lime juice",
    "1 tbsp red onion, finely minced",
    "1 tbsp fresh cilantro, chopped",
    "1 large bell pepper (yellow or red), cut into wide triangular dipping scoops",
    "Pinch of sea salt and crushed red chili flakes"
  ],
  "instructions": [
    "In a shallow bowl, mash the ripe avocado with fresh lime juice and sea salt using a fork to your desired consistency.",
    "Fold in the minced red onion, chopped fresh cilantro, and a pinch of crushed red chili flakes.",
    "Taste and adjust seasoning with an extra squeeze of lime juice if needed.",
    "Wash the bell pepper, discard the core and seeds, and slice into sturdy triangular dipping chips.",
    "Spoon the freshly prepared guacamole into a serving dish.",
    "Arrange the crisp bell pepper scoops alongside for an energizing, low-carb crunchy snack."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Low-Carb",
    "Keto",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_9",
  "externalId": "curated_sn_9",
  "sourceProvider": "curated",
  "title": "Crispy Baked Pita Herb Chips with Olive Oil Dip",
  "imageUrl": "https://www.themealdb.com/images/media/meals/sr7chd1780264758.jpg",
  "category": "snack",
  "cuisine": "Mediterranean",
  "calories": 165,
  "protein": 5,
  "carbs": 26,
  "fat": 5,
  "prepTime": 12,
  "servings": 1,
  "ingredients": [
    "1 small whole wheat pita round, cut into 8 chip triangles",
    "1 tsp extra virgin olive oil",
    "1/2 tsp dried oregano, thyme & garlic powder",
    "Pinch of coarse sea salt"
  ],
  "instructions": [
    "Preheat your oven to 190°C (375°F) and prepare a rimmed baking sheet.",
    "Slice the whole wheat pita round into 8 neat chip triangles and gently separate the two layers if desired for extra crunch.",
    "Arrange the triangles in a single layer on the baking sheet.",
    "Lightly brush or spray with extra virgin olive oil, then sprinkle evenly with dried oregano, thyme, garlic powder, and sea salt.",
    "Bake for 7 to 9 minutes until the chips are toasted, golden-brown, and audibly crisp.",
    "Let cool for 2 minutes on the tray to crisp up completely, then serve warm."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_10",
  "externalId": "curated_sn_10",
  "sourceProvider": "curated",
  "title": "Stuffed Lemon Herb Vine Leaves (Dolma Bites)",
  "imageUrl": "https://www.themealdb.com/images/media/meals/uvuyxu1503067369.jpg",
  "category": "snack",
  "cuisine": "Mediterranean",
  "calories": 140,
  "protein": 3,
  "carbs": 22,
  "fat": 5,
  "prepTime": 5,
  "servings": 1,
  "ingredients": [
    "4 tender grape vine leaves stuffed with seasoned herb rice",
    "1 tbsp fresh lemon juice",
    "1/2 tsp extra virgin olive oil",
    "Lemon wedges and fresh mint for garnish"
  ],
  "instructions": [
    "Arrange the prepared stuffed vine leaves neatly on a chilled appetizer plate.",
    "Drizzle the tops gently with fresh lemon juice and a touch of extra virgin olive oil.",
    "Sprinkle with finely chopped fresh mint leaves.",
    "Garnish the side with fresh lemon wedges for extra acidity.",
    "Serve cold or at room temperature as a refreshing, authentic Mediterranean finger food."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_11",
  "externalId": "curated_sn_11",
  "sourceProvider": "curated",
  "title": "Crispy Boulangère Herb Potato Bites",
  "imageUrl": "https://www.themealdb.com/images/media/meals/qywups1511796761.jpg",
  "category": "snack",
  "cuisine": "French",
  "calories": 155,
  "protein": 3,
  "carbs": 28,
  "fat": 4,
  "prepTime": 15,
  "servings": 1,
  "ingredients": [
    "1 medium Yukon gold potato, thinly sliced into rounds",
    "1/2 tsp olive oil",
    "1/4 tsp dried thyme, rosemary & sea salt",
    "Pinch of cracked black pepper"
  ],
  "instructions": [
    "Preheat your oven to 200°C (400°F) and grease a small baking dish or line with parchment.",
    "Wash and thinly slice the potato into 1/8-inch uniform rounds using a chef knife or mandoline.",
    "Pat the slices dry with paper towels to eliminate excess surface moisture.",
    "Toss the potato rounds with olive oil, dried thyme, crushed rosemary, sea salt, and black pepper.",
    "Shingle the rounds slightly overlapping in the dish and bake for 15 to 18 minutes until the edges are crispy and golden.",
    "Let stand for 2 minutes before transferring to a snack plate to enjoy warm."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_12",
  "externalId": "curated_sn_12",
  "sourceProvider": "curated",
  "title": "Crunchy Spiced Chickpeas with Paprika & Cumin",
  "imageUrl": "https://www.themealdb.com/images/media/meals/ejht7k1780092390.jpg",
  "category": "snack",
  "cuisine": "Middle Eastern",
  "calories": 165,
  "protein": 7,
  "carbs": 24,
  "fat": 5,
  "prepTime": 15,
  "servings": 1,
  "ingredients": [
    "3/4 cup cooked chickpeas, thoroughly drained and dry",
    "1 tsp extra virgin olive oil",
    "1/2 tsp smoked paprika, ground cumin, and garlic powder",
    "Pinch of fine sea salt"
  ],
  "instructions": [
    "Preheat oven to 200°C (400°F) or set air fryer to 195°C (385°F).",
    "Spread the chickpeas onto a clean kitchen towel and roll gently to remove any loose skins and moisture.",
    "Toss the completely dry chickpeas with olive oil, smoked paprika, ground cumin, garlic powder, and sea salt.",
    "Spread evenly across a baking tray or inside the air-fryer basket.",
    "Roast for 14 to 16 minutes, tossing every 5 minutes, until deeply crunchy and rattling dry.",
    "Turn off the heat and leave inside the warm oven for 3 minutes for maximum crunch, then pour into a snack bowl."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "High-Fiber",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_13",
  "externalId": "curated_sn_13",
  "sourceProvider": "curated",
  "title": "Algerian Honey-Glazed Carrots with Fresh Mint",
  "imageUrl": "https://www.themealdb.com/images/media/meals/o2cd4r1764113576.jpg",
  "category": "snack",
  "cuisine": "North African",
  "calories": 110,
  "protein": 2,
  "carbs": 22,
  "fat": 2,
  "prepTime": 12,
  "servings": 1,
  "ingredients": [
    "2 slender carrots, peeled and sliced on bias",
    "1 tsp pure honey or maple syrup",
    "1/2 tsp olive oil",
    "1/4 tsp ground cinnamon & cumin",
    "Fresh mint leaves, torn"
  ],
  "instructions": [
    "Heat the olive oil in a small non-stick pan over medium heat.",
    "Add the sliced carrots and sauté gently for 4 minutes until they begin to soften.",
    "Add 2 tablespoons of water, cover, and steam for 3 minutes until tender-crisp.",
    "Uncover, stir in the honey, ground cinnamon, and cumin, and cook for 1 minute until glazed and glossy.",
    "Remove from heat, transfer to a small plate, and scatter torn fresh mint leaves on top.",
    "Serve warm as a nourishing, naturally sweet North African snack."
  ],
  "dietaryTags": [
    "Halal",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_14",
  "externalId": "curated_sn_14",
  "sourceProvider": "curated",
  "title": "Soft-Boiled Farm Eggs with Herb Sea Salt",
  "imageUrl": "https://www.themealdb.com/images/media/meals/1550440197.jpg",
  "category": "snack",
  "cuisine": "International",
  "calories": 140,
  "protein": 13,
  "carbs": 1,
  "fat": 9,
  "prepTime": 10,
  "servings": 1,
  "ingredients": [
    "2 large farm fresh eggs",
    "Cold water and ice cubes for ice bath",
    "1/4 tsp flaky sea salt",
    "1/4 tsp crushed black pepper & dried dill"
  ],
  "instructions": [
    "Bring a small saucepan of water to a gentle rolling boil over medium-high heat.",
    "Lower the cold eggs gently into the water with a slotted spoon to prevent cracking.",
    "Reduce the heat slightly to maintain a gentle simmer and cook for exactly 6 minutes and 30 seconds for a jammy yolk.",
    "Immediately transfer the eggs into an ice water bath for 3 minutes to stop the cooking process.",
    "Gently tap and peel the shells under cold running water.",
    "Halve the jammy eggs onto a plate, season with flaky sea salt, black pepper, and dill, and enjoy immediately."
  ],
  "dietaryTags": [
    "Halal",
    "Vegetarian",
    "High-Protein",
    "Low-Carb",
    "Keto",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_15",
  "externalId": "curated_sn_15",
  "sourceProvider": "curated",
  "title": "Crisp Apple Slices with Pure Sunflower Seed Butter",
  "imageUrl": "https://www.themealdb.com/images/media/meals/1543774956.jpg",
  "category": "snack",
  "cuisine": "International",
  "calories": 165,
  "protein": 4,
  "carbs": 24,
  "fat": 8,
  "prepTime": 5,
  "servings": 1,
  "ingredients": [
    "1 medium crisp Honeycrisp or Gala apple, cored",
    "1 tbsp creamy unsweetened sunflower seed butter",
    "1/4 tsp ground cinnamon"
  ],
  "instructions": [
    "Wash the fresh apple thoroughly under cold water and pat dry with a kitchen towel.",
    "Cut the apple into quarters, remove the central core and seeds, and slice each quarter into 3 neat wedges.",
    "Arrange the apple wedges radiating in a circle around a snack plate.",
    "Spoon the sunflower seed butter into a small ramekin in the center.",
    "Dust the apple slices lightly with ground cinnamon for fragrance.",
    "Serve fresh for dipping."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free",
    "Nut-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_16",
  "externalId": "curated_sn_16",
  "sourceProvider": "curated",
  "title": "Chilled Watermelon & Fresh Mint Cubes",
  "imageUrl": "https://www.themealdb.com/images/media/meals/oaqz9f1766593912.jpg",
  "category": "snack",
  "cuisine": "Mediterranean",
  "calories": 95,
  "protein": 2,
  "carbs": 23,
  "fat": 0,
  "prepTime": 5,
  "servings": 1,
  "ingredients": [
    "2 cups chilled ripe seedless watermelon, cut into 1-inch cubes",
    "4 fresh mint leaves, finely chiffonaded",
    "1 tsp fresh lime juice",
    "Pinch of coarse sea salt (optional)"
  ],
  "instructions": [
    "Slice cold watermelon into uniform 1-inch bite-sized cubes, discarding the rind.",
    "Transfer the chilled melon cubes into an individual chilled glass bowl.",
    "Drizzle fresh lime juice lightly across the top to brighten the natural fruit sweetness.",
    "Stack and thinly slice the fresh mint leaves into fine ribbons.",
    "Scatter the mint ribbons across the watermelon cubes and add a tiny pinch of sea salt if desired.",
    "Serve immediately with cocktail forks for a refreshing, hydrating snack."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free",
    "Gluten-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_17",
  "externalId": "curated_sn_17",
  "sourceProvider": "curated",
  "title": "Golden Crispy Blini Bites with Creamy Herb Dip",
  "imageUrl": "https://www.themealdb.com/images/media/meals/0206h11699013358.jpg",
  "category": "snack",
  "cuisine": "Eastern European",
  "calories": 155,
  "protein": 5,
  "carbs": 22,
  "fat": 5,
  "prepTime": 12,
  "servings": 1,
  "ingredients": [
    "3 mini golden blini pancakes, warmed",
    "1 tbsp dairy-free cream cheese or mashed avocado",
    "1 tbsp fresh dill, chopped",
    "4 thin cucumber ribbons",
    "Pinch of sea salt and lemon zest"
  ],
  "instructions": [
    "Warm the mini blini pancakes in a dry skillet over medium heat for 1 minute per side until heated through and soft.",
    "Transfer the warm blinis onto an appetizer plate.",
    "Spread each blini with a dollop of dairy-free cream cheese or seasoned mashed avocado.",
    "Roll thin cucumber ribbons and place neatly on top of the spread.",
    "Garnish each bite with fresh dill, lemon zest, and a tiny pinch of sea salt.",
    "Serve warm as an elegant, light party-style snack."
  ],
  "dietaryTags": [
    "Halal",
    "Vegetarian",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},
  {
  "id": "curated_sn_18",
  "externalId": "curated_sn_18",
  "sourceProvider": "curated",
  "title": "Bolani Crispy Herb & Potato Turnovers",
  "imageUrl": "https://www.themealdb.com/images/media/meals/de0sns1779555283.jpg",
  "category": "snack",
  "cuisine": "Middle Eastern",
  "calories": 170,
  "protein": 4,
  "carbs": 26,
  "fat": 6,
  "prepTime": 15,
  "servings": 1,
  "ingredients": [
    "1 small thin flatbread turnover filled with mashed spiced potato and scallions",
    "1/2 tsp olive oil for skillet searing",
    "1 tbsp fresh cilantro-garlic dip",
    "Pinch of ground coriander and cumin"
  ],
  "instructions": [
    "Heat a heavy skillet or griddle over medium heat and lightly coat with a brush of olive oil.",
    "Place the thin potato-filled turnover in the hot skillet.",
    "Cook for 3 to 4 minutes on the first side until golden-brown and crisp with dark blistered spots.",
    "Flip carefully and cook the second side for another 3 minutes until crisp throughout.",
    "Remove from heat, transfer to a cutting board, and cut into 4 triangular snack wedges.",
    "Serve warm alongside the fresh cilantro-garlic dip."
  ],
  "dietaryTags": [
    "Halal",
    "Vegan",
    "Vegetarian",
    "Dairy-Free"
  ],
  "halalStatus": "HALAL_VERIFIED"
},

  // ============================================================================
  // DRINKS (16 recipes — all 16 free of egg, peanuts, seafood, cheese/dairy)
  // ============================================================================
  {
    id: 'curated_dr_1',
    externalId: 'curated_dr_1',
    sourceProvider: 'curated',
    title: 'Warm Ginger, Honey & Lemon Tea',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/uptxtv1468876415.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 45,
    protein: 0,
    carbs: 11,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 cup hot water',
      '3 slices fresh ginger root',
      '1 tbsp fresh lemon juice',
      '1 tsp maple syrup or honey'
    ],
    instructions: [
      'Steep the fresh ginger slices in hot water for 4 minutes.',
      'Stir in fresh lemon juice and sweetener until dissolved.',
      'Serve warm in a mug.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_2',
    externalId: 'curated_dr_2',
    sourceProvider: 'curated',
    title: 'Iced Green Tea with Fresh Mint & Lemon',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/xwqvur1468876473.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 25,
    protein: 0,
    carbs: 6,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 bag pure green tea',
      '1 cup water & ice cubes',
      '4 fresh mint leaves',
      '2 slices fresh lemon'
    ],
    instructions: [
      'Brew the green tea bag in hot water for 3 minutes, then remove the bag and let cool slightly.',
      'Pour over a glass filled with ice cubes.',
      'Garnish with fresh mint leaves and lemon slices.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Low-Carb', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_3',
    externalId: 'curated_dr_3',
    sourceProvider: 'curated',
    title: 'Fresh Mango & Orange Vitamin Smoothie',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/vuquyv1468876052.jpg',
    category: 'drink',
    cuisine: 'Tropical',
    calories: 135,
    protein: 2,
    carbs: 32,
    fat: 1,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '3/4 cup ripe mango chunks',
      '1/2 cup fresh squeezed orange juice',
      '1/2 cup cold water & ice cubes',
      '1 tsp chia seeds'
    ],
    instructions: [
      'Place mango chunks, orange juice, water, and ice cubes in a blender.',
      'Blend on high speed for 45 seconds until completely smooth.',
      'Pour into a chilled glass and stir in chia seeds.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_4',
    externalId: 'curated_dr_4',
    sourceProvider: 'curated',
    title: 'Cucumber, Lemon & Mint Hydrating Water',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/uqxqsy1468876703.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 15,
    protein: 0,
    carbs: 3,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1.5 cups cold filtered water',
      '5 thin slices English cucumber',
      '3 slices fresh lemon',
      '5 fresh mint leaves'
    ],
    instructions: [
      'Gently muddle the mint leaves and lemon slices at the bottom of a tall glass.',
      'Add cucumber slices, ice cubes, and cold filtered water.',
      'Stir gently and let infuse for 3 minutes before drinking.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Low-Carb', 'Keto', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_5',
    externalId: 'curated_dr_5',
    sourceProvider: 'curated',
    title: 'Berry, Spinach & Banana Oat Smoothie',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/syusvw1468876634.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 185,
    protein: 5,
    carbs: 36,
    fat: 3,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1/2 cup mixed berries',
      '1/2 medium banana',
      '1 cup fresh baby spinach',
      '2 tbsp rolled oats',
      '1 cup unsweetened oat milk'
    ],
    instructions: [
      'Combine oat milk, baby spinach, banana, mixed berries, and rolled oats in a blender.',
      'Blend on high for 60 seconds until creamy and smooth.',
      'Pour into a tall glass and serve immediately.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_6',
    externalId: 'curated_dr_6',
    sourceProvider: 'curated',
    title: 'Pure Coconut Water with Fresh Lime',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/3nbu4a1487603196.jpg',
    category: 'drink',
    cuisine: 'Tropical',
    calories: 55,
    protein: 1,
    carbs: 13,
    fat: 0,
    prepTime: 3,
    servings: 1,
    ingredients: [
      '1 cup pure unsweetened coconut water',
      '1 tbsp fresh lime juice',
      'Ice cubes & lime wheel'
    ],
    instructions: [
      'Fill a chilled glass with ice cubes and pour in the pure coconut water.',
      'Squeeze in the fresh lime juice and stir gently.',
      'Garnish with a lime wheel and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_7',
    externalId: 'curated_dr_7',
    sourceProvider: 'curated',
    title: 'Iced Matcha Oat Milk Latte',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/rtwwsx1472720307.jpg',
    category: 'drink',
    cuisine: 'Asian',
    calories: 110,
    protein: 3,
    carbs: 18,
    fat: 3,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 tsp culinary grade matcha green tea powder',
      '2 tbsp warm water',
      '1 cup unsweetened oat milk',
      '1 tsp maple syrup',
      'Ice cubes'
    ],
    instructions: [
      'Whisk the matcha powder with warm water and maple syrup until smooth and frothy.',
      'Fill a glass with ice cubes and pour in the cold oat milk.',
      'Pour the whisked matcha over the oat milk, stir, and enjoy.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_8',
    externalId: 'curated_dr_8',
    sourceProvider: 'curated',
    title: 'Golden Turmeric & Ginger Oat Milk Latte',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/mzgaqu1504389248.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 115,
    protein: 3,
    carbs: 19,
    fat: 3,
    prepTime: 6,
    servings: 1,
    ingredients: [
      '1 cup unsweetened oat milk',
      '1/2 tsp ground turmeric',
      '1/4 tsp ground ginger & cinnamon',
      '1 tsp maple syrup',
      'Pinch of black pepper'
    ],
    instructions: [
      'Warm the oat milk with turmeric, ginger, cinnamon, and black pepper in a small saucepan over medium-low heat.',
      'Whisk gently for 3 minutes until steaming and frothy.',
      'Remove from heat, stir in maple syrup, and pour into a mug.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_9',
    externalId: 'curated_dr_9',
    sourceProvider: 'curated',
    title: 'Fresh Watermelon & Lime Cooler',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/jbqrhv1487603186.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 80,
    protein: 1,
    carbs: 19,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1.5 cups seedless watermelon cubes',
      '1 tbsp fresh lime juice',
      '4 fresh mint leaves',
      '1/2 cup crushed ice'
    ],
    instructions: [
      'Place watermelon cubes, lime juice, mint leaves, and crushed ice in a blender.',
      'Blend for 30 seconds until smooth and slushy.',
      'Pour into a glass and serve cold.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_10',
    externalId: 'curated_dr_10',
    sourceProvider: 'curated',
    title: 'Warm Chamomile & Lemon Herbal Infusion',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/wsyvrt1468876267.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 35,
    protein: 0,
    carbs: 9,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 chamomile herbal tea bag',
      '1 cup boiling water',
      '1 tsp agave or maple syrup',
      '1 slice fresh lemon'
    ],
    instructions: [
      'Steep the chamomile tea bag in boiling water for 4 minutes.',
      'Remove the tea bag and stir in sweetener.',
      'Add a slice of fresh lemon and enjoy warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_11',
    externalId: 'curated_dr_11',
    sourceProvider: 'curated',
    title: 'Strawberry & Banana Oat Milk Shake',
    imageUrl: 'https://www.themealdb.com/images/media/meals/spswqs1511558697.jpg',
    category: 'drink',
    cuisine: 'American',
    calories: 165,
    protein: 4,
    carbs: 33,
    fat: 2,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '3/4 cup fresh or frozen strawberries',
      '1/2 ripe banana',
      '1 cup unsweetened oat milk',
      '1/2 tsp vanilla extract'
    ],
    instructions: [
      'Add strawberries, banana, oat milk, and vanilla extract to a blender.',
      'Blend on high until velvety and smooth.',
      'Pour into a chilled glass and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_12',
    externalId: 'curated_dr_12',
    sourceProvider: 'curated',
    title: 'Fresh Carrot, Apple & Ginger Juice',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/qyqtpv1468876144.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 105,
    protein: 2,
    carbs: 25,
    fat: 0,
    prepTime: 7,
    servings: 1,
    ingredients: [
      '2 medium carrots, chopped',
      '1 crisp apple, cored and chopped',
      '1/2 inch fresh ginger root',
      '1/2 cup cold water & 1 tsp lemon juice'
    ],
    instructions: [
      'Blend chopped carrots, apple, ginger, and cold water on high speed until finely pureed.',
      'Strain through a fine mesh sieve if desired, then stir in fresh lemon juice.',
      'Serve chilled over ice.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_13',
    externalId: 'curated_dr_13',
    sourceProvider: 'curated',
    title: 'Iced Hibiscus & Berry Refresher',
    imageUrl: 'https://www.themealdb.com/images/media/meals/qysyss1511558054.jpg',
    category: 'drink',
    cuisine: 'Mediterranean',
    calories: 40,
    protein: 0,
    carbs: 10,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 hibiscus herbal tea bag',
      '1 cup water',
      '4 fresh raspberries or sliced strawberries',
      '1 tsp maple syrup & ice cubes'
    ],
    instructions: [
      'Steep the hibiscus tea bag in hot water for 4 minutes, then stir in maple syrup and cool.',
      'Fill a glass with ice cubes and fresh berries.',
      'Pour the ruby-red hibiscus tea over the ice and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_14',
    externalId: 'curated_dr_14',
    sourceProvider: 'curated',
    title: 'Pineapple, Spinach & Coconut Green Smoothie',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/uvypss1472720581.jpg',
    category: 'drink',
    cuisine: 'Tropical',
    calories: 130,
    protein: 3,
    carbs: 29,
    fat: 1,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '3/4 cup fresh pineapple chunks',
      '1 cup baby spinach leaves',
      '1 cup pure coconut water',
      '1 tsp chia seeds'
    ],
    instructions: [
      'Place pineapple chunks, baby spinach, and coconut water in a blender.',
      'Blend on high until bright green and smooth.',
      'Stir in chia seeds and serve cold.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_15',
    externalId: 'curated_dr_15',
    sourceProvider: 'curated',
    title: 'Warm Peppermint & Lemon Herbal Tea',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/xwuqvw1473201811.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 20,
    protein: 0,
    carbs: 5,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 peppermint tea bag or 8 fresh mint leaves',
      '1 cup hot water',
      '1 tsp fresh lemon juice'
    ],
    instructions: [
      'Steep the peppermint in hot water for 4 minutes.',
      'Add fresh lemon juice and stir gently.',
      'Serve warm for soothing digestion.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Low-Carb', 'Keto', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dr_16',
    externalId: 'curated_dr_16',
    sourceProvider: 'curated',
    title: 'Cocoa, Banana & Oat Recovery Smoothie',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/yrtxxp1472719367.jpg',
    category: 'drink',
    cuisine: 'International',
    calories: 210,
    protein: 6,
    carbs: 40,
    fat: 4,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 medium ripe banana',
      '1 tbsp unsweetened cocoa powder',
      '2 tbsp rolled oats',
      '1 cup unsweetened oat milk',
      'Ice cubes'
    ],
    instructions: [
      'Combine banana, cocoa powder, rolled oats, oat milk, and ice in a blender.',
      'Blend for 45 seconds until thick and chocolatey.',
      'Pour into a glass and enjoy.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },

  // ============================================================================
  // DESSERTS (16 recipes — 15 free of egg, peanuts, seafood, cheese/dairy)
  // ============================================================================
  {
    id: 'curated_ds_1',
    externalId: 'curated_ds_1',
    sourceProvider: 'curated',
    title: 'Vanilla Chia Pudding with Fresh Strawberries',
    imageUrl: 'https://www.themealdb.com/images/media/meals/h031jy1782853081.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 175,
    protein: 5,
    carbs: 22,
    fat: 7,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '2 tbsp chia seeds',
      '3/4 cup unsweetened oat milk',
      '1/2 tsp pure vanilla extract',
      '1 tsp maple syrup',
      '1/2 cup sliced fresh strawberries'
    ],
    instructions: [
      'Whisk chia seeds, oat milk, vanilla extract, and maple syrup in a small bowl or jar.',
      'Refrigerate for at least 2 hours until thick and pudding-like.',
      'Top with fresh sliced strawberries before serving.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_2',
    externalId: 'curated_ds_2',
    sourceProvider: 'curated',
    title: 'Frozen Mango & Lime Fruit Sorbet',
    imageUrl: 'https://www.themealdb.com/images/media/meals/ruwpww1511817242.jpg',
    category: 'dessert',
    cuisine: 'Tropical',
    calories: 130,
    protein: 1,
    carbs: 32,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1.5 cups frozen mango chunks',
      '1 tbsp fresh lime juice',
      '2 tbsp cold water'
    ],
    instructions: [
      'Place frozen mango chunks, fresh lime juice, and cold water in a food processor or blender.',
      'Pulse and blend until smooth and scoopable like sorbet.',
      'Scoop into a chilled dessert bowl and serve immediately.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_3',
    externalId: 'curated_ds_3',
    sourceProvider: 'curated',
    title: 'Baked Cinnamon Apples with Oat Crumble',
    imageUrl: 'https://www.themealdb.com/images/media/meals/oaqz9f1766593912.jpg',
    category: 'dessert',
    cuisine: 'American',
    calories: 195,
    protein: 4,
    carbs: 38,
    fat: 4,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '1 medium sweet apple, sliced',
      '3 tbsp rolled oats',
      '1 tsp coconut oil',
      '1 tsp maple syrup',
      '1/2 tsp ground cinnamon'
    ],
    instructions: [
      'Toss the apple slices with half the cinnamon and place in a small baking dish.',
      'Mix rolled oats, coconut oil, maple syrup, and remaining cinnamon, then scatter over the apples.',
      'Bake at 190°C (375°F) for 15 minutes until apples are bubbling and oats are golden.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_4',
    externalId: 'curated_ds_4',
    sourceProvider: 'curated',
    title: 'One-Ingredient Frozen Banana Nice Cream',
    imageUrl: 'https://www.themealdb.com/images/media/meals/feh9k21784665694.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 140,
    protein: 2,
    carbs: 34,
    fat: 1,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1.5 medium ripe bananas, sliced and frozen',
      '2 tbsp unsweetened oat milk',
      '1/4 tsp ground cinnamon or vanilla'
    ],
    instructions: [
      'Place frozen banana slices, oat milk, and cinnamon into a blender or food processor.',
      'Blend until creamy with the texture of soft-serve ice cream.',
      'Scoop into a bowl and serve right away.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_5',
    externalId: 'curated_ds_5',
    sourceProvider: 'curated',
    title: 'Dark Cocoa & Avocado Silk Mousse',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1550441882.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 190,
    protein: 4,
    carbs: 20,
    fat: 12,
    prepTime: 8,
    servings: 1,
    ingredients: [
      '1/2 ripe avocado',
      '1.5 tbsp unsweetened dark cocoa powder',
      '3 tbsp unsweetened oat milk',
      '1 tbsp maple syrup',
      '4 fresh raspberries for garnish'
    ],
    instructions: [
      'Combine ripe avocado, dark cocoa powder, oat milk, and maple syrup in a blender.',
      'Blend for 60 seconds until glossy and silky smooth.',
      'Spoon into a dessert cup and top with fresh raspberries.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_6',
    externalId: 'curated_ds_6',
    sourceProvider: 'curated',
    title: 'Fresh Mixed Berry & Mint Fruit Salad',
    imageUrl: 'https://www.themealdb.com/images/media/meals/qwrtut1468418027.jpg',
    category: 'dessert',
    cuisine: 'Mediterranean',
    calories: 110,
    protein: 2,
    carbs: 26,
    fat: 1,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1/2 cup fresh strawberries, quartered',
      '1/2 cup fresh blueberries & blackberries',
      '1/2 kiwi, peeled and diced',
      '1 tsp fresh orange juice & torn mint leaves'
    ],
    instructions: [
      'Gently toss the strawberries, blueberries, blackberries, and diced kiwi in a bowl.',
      'Drizzle with fresh orange juice and scatter torn mint leaves over the top.',
      'Serve chilled.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Low-Carb', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_7',
    externalId: 'curated_ds_7',
    sourceProvider: 'curated',
    title: 'Warm Banana & Cinnamon Oat Bake',
    imageUrl: 'https://www.themealdb.com/images/media/meals/jc6oub1763196663.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 205,
    protein: 5,
    carbs: 39,
    fat: 4,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '1 ripe banana, mashed',
      '1/3 cup rolled oats',
      '1/3 cup unsweetened oat milk',
      '1/2 tsp ground cinnamon & vanilla',
      '1 tsp dark cocoa nibs or raisins'
    ],
    instructions: [
      'Mix the mashed banana, rolled oats, oat milk, cinnamon, and vanilla in a small oven-safe ramekin.',
      'Sprinkle cocoa nibs or raisins on top and bake at 190°C (375°F) for 14 minutes until golden and set.',
      'Serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_8',
    externalId: 'curated_ds_8',
    sourceProvider: 'curated',
    title: 'Pandan & Coconut Water Fruit Jelly Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/qpxvuq1511798906.jpg',
    category: 'dessert',
    cuisine: 'Asian',
    calories: 115,
    protein: 1,
    carbs: 27,
    fat: 0,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1 cup pure coconut water',
      '1 tsp agar-agar powder (plant gelatin)',
      '1/2 cup diced mango and strawberries',
      '1 tsp maple syrup'
    ],
    instructions: [
      'Simmer coconut water, maple syrup, and agar-agar powder in a small pot for 2 minutes until dissolved.',
      'Pour into a bowl over diced fruit and chill for 30 minutes until set.',
      'Serve cold.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_9',
    externalId: 'curated_ds_9',
    sourceProvider: 'curated',
    title: 'Warm Pear Poached with Cinnamon & Ginger',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1543774956.jpg',
    category: 'dessert',
    cuisine: 'Mediterranean',
    calories: 135,
    protein: 1,
    carbs: 34,
    fat: 0,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1 ripe pear, halved and cored',
      '1 cup water & 2 tbsp orange juice',
      '1 cinnamon stick & 2 slices fresh ginger',
      '1 tsp maple syrup'
    ],
    instructions: [
      'Simmer water, orange juice, cinnamon, ginger, and maple syrup in a small saucepan.',
      'Add the pear halves and poach covered for 10 to 12 minutes until tender.',
      'Transfer the warm pear to a bowl and spoon the spiced syrup over the top.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_10',
    externalId: 'curated_ds_10',
    sourceProvider: 'curated',
    title: 'Purple Sweet Potato & Dark Cocoa Bites',
    imageUrl: 'https://www.themealdb.com/images/media/meals/uwvxpv1511557015.jpg',
    category: 'dessert',
    cuisine: 'Asian',
    calories: 170,
    protein: 3,
    carbs: 35,
    fat: 2,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '1 small steamed purple or orange sweet potato, mashed',
      '1 tsp unsweetened cocoa powder',
      '1 tsp maple syrup',
      '1 tsp shredded coconut'
    ],
    instructions: [
      'Mash the warm steamed sweet potato with maple syrup until smooth.',
      'Roll into 3 small bite-sized spheres and dust lightly with cocoa powder and shredded coconut.',
      'Serve warm or chilled.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_11',
    externalId: 'curated_ds_11',
    sourceProvider: 'curated',
    title: 'Strawberry & Kiwi Chia Parfait',
    imageUrl: 'https://www.themealdb.com/images/media/meals/o93jur1782769321.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 165,
    protein: 4,
    carbs: 26,
    fat: 5,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '1.5 tbsp chia seeds soaked in 1/2 cup oat milk',
      '1/2 cup diced fresh strawberries',
      '1 kiwi, peeled and sliced',
      '1 tbsp toasted rolled oats'
    ],
    instructions: [
      'Layer the chilled chia oat pudding into the base of a glass.',
      'Add alternating layers of diced strawberries and sliced kiwi.',
      'Top with toasted rolled oats for crunch.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_12',
    externalId: 'curated_ds_12',
    sourceProvider: 'curated',
    title: 'Warm Pumpkin & Banana Cinnamon Compote',
    imageUrl: 'https://www.themealdb.com/images/media/meals/ro8mzj1763800655.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 160,
    protein: 3,
    carbs: 36,
    fat: 1,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup cubed pumpkin or butternut squash',
      '1/2 firm banana, sliced',
      '3/4 cup oat milk',
      '1/2 tsp ground cinnamon & nutmeg'
    ],
    instructions: [
      'Simmer the cubed pumpkin in oat milk with cinnamon and nutmeg for 10 minutes until tender.',
      'Add sliced banana and simmer for 2 more minutes.',
      'Serve warm in a dessert bowl.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_13',
    externalId: 'curated_ds_13',
    sourceProvider: 'curated',
    title: 'Mixed Berry & Peach Frozen Sorbet',
    imageUrl: 'https://www.themealdb.com/images/media/meals/sqrtwu1511721265.jpg',
    category: 'dessert',
    cuisine: 'International',
    calories: 125,
    protein: 2,
    carbs: 30,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '3/4 cup frozen peaches',
      '3/4 cup frozen raspberries and strawberries',
      '2 tbsp splash of orange juice'
    ],
    instructions: [
      'Blend frozen peaches, berries, and orange juice until smooth and icy.',
      'Scoop into a chilled bowl and serve immediately.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_14',
    externalId: 'curated_ds_14',
    sourceProvider: 'curated',
    title: 'Cocoa Oat & Date Truffle Bites',
    imageUrl: 'https://www.themealdb.com/images/media/meals/xxrxux1503070723.jpg',
    category: 'dessert',
    cuisine: 'Middle Eastern',
    calories: 185,
    protein: 4,
    carbs: 36,
    fat: 3,
    prepTime: 10,
    servings: 1,
    ingredients: [
      '3 pitted Medjool dates, softened',
      '1/4 cup rolled oats',
      '1 tbsp unsweetened cocoa powder',
      '1 tsp chia seeds & 1 tbsp water'
    ],
    instructions: [
      'Pulse the pitted dates, rolled oats, cocoa powder, chia seeds, and water in a small processor until sticky.',
      'Roll into 3 smooth truffle bites.',
      'Chill for 5 minutes and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_15',
    externalId: 'curated_ds_15',
    sourceProvider: 'curated',
    title: 'Chilled Watermelon, Berry & Lime Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/qxytrx1511304021.jpg',
    category: 'dessert',
    cuisine: 'Mediterranean',
    calories: 105,
    protein: 2,
    carbs: 25,
    fat: 0,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '1 cup cubed seedless watermelon',
      '1/2 cup fresh blueberries and strawberries',
      '1 tsp lime zest & fresh lime juice'
    ],
    instructions: [
      'Combine chilled watermelon cubes, blueberries, and strawberries in a dessert bowl.',
      'Toss gently with fresh lime juice and lime zest.',
      'Serve cold.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ds_16',
    externalId: 'curated_ds_16',
    sourceProvider: 'curated',
    title: 'Greek Yogurt & Honey Berry Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/thazgm1555350962.jpg',
    category: 'dessert',
    cuisine: 'Mediterranean',
    calories: 180,
    protein: 15,
    carbs: 24,
    fat: 3,
    prepTime: 5,
    servings: 1,
    ingredients: [
      '3/4 cup plain Greek yogurt',
      '1/2 cup fresh raspberries and blueberries',
      '1 tsp pure blossom honey',
      '1 tbsp rolled oats'
    ],
    instructions: [
      'Spoon the chilled Greek yogurt into a dessert bowl.',
      'Top with fresh raspberries, blueberries, and rolled oats.',
      'Drizzle with pure honey and serve.'
    ],
    dietaryTags: ['Halal', 'Vegetarian', 'High-Protein'],
    halalStatus: 'HALAL_VERIFIED'
  },

  // ============================================================================
  // EVERYDAY HALAL CLASSICS FOR UNIVERSAL COOKBOOK SEARCH
  // ============================================================================
  {
    id: 'curated_bf_22',
    externalId: 'curated_bf_22',
    sourceProvider: 'curated',
    title: 'Fluffy Banana & Oat Pancakes (Egg-Free & Dairy-Free)',
    imageUrl: 'https://www.themealdb.com/images/media/meals/eqnf3p1779649407.jpg',
    category: 'breakfast',
    cuisine: 'American',
    calories: 340,
    protein: 10,
    carbs: 58,
    fat: 7,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup rolled oat flour',
      '1 ripe banana, mashed',
      '1/2 cup unsweetened oat milk',
      '1 tsp baking powder & 1/2 tsp cinnamon',
      '1/2 cup fresh berries & 1 tsp maple syrup'
    ],
    instructions: [
      'Whisk the oat flour, baking powder, cinnamon, mashed banana, and oat milk in a bowl until a smooth pancake batter forms.',
      'Pour 3 rounds onto a lightly oiled non-stick griddle over medium heat and cook for 2 to 3 minutes per side until golden and fluffy.',
      'Stack on a warm plate and top with fresh berries and a drizzle of maple syrup.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_23',
    externalId: 'curated_bf_23',
    sourceProvider: 'curated',
    title: 'Golden Crispy Oat & Berry Belgian Waffles',
    imageUrl: 'https://www.themealdb.com/images/media/meals/0206h11699013358.jpg',
    category: 'breakfast',
    cuisine: 'American',
    calories: 355,
    protein: 11,
    carbs: 56,
    fat: 9,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '3/4 cup whole-grain oat flour',
      '2/3 cup unsweetened oat milk',
      '1 tbsp olive or coconut oil & 1 tsp baking powder',
      '1/2 tsp vanilla extract & cinnamon',
      '1/2 cup sliced strawberries and blueberries'
    ],
    instructions: [
      'Whisk the oat flour, baking powder, cinnamon, oat milk, oil, and vanilla until smooth.',
      'Pour into a preheated waffle iron (or skillet) and cook for 4 to 5 minutes until golden brown and crisp.',
      'Top with fresh sliced strawberries and blueberries and serve warm.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_24',
    externalId: 'curated_bf_24',
    sourceProvider: 'curated',
    title: 'Savory Chickpea Flour, Spinach & Herb Omelette (Egg-Free)',
    imageUrl: 'https://www.themealdb.com/images/media/meals/1550440197.jpg',
    category: 'breakfast',
    cuisine: 'Mediterranean',
    calories: 295,
    protein: 16,
    carbs: 34,
    fat: 9,
    prepTime: 12,
    servings: 1,
    ingredients: [
      '1/2 cup chickpea flour (besan)',
      '1/2 cup warm water & 1/4 tsp turmeric',
      '1 cup baby spinach & diced tomatoes',
      '2 tbsp diced bell peppers & fresh herbs',
      '1 tsp extra virgin olive oil'
    ],
    instructions: [
      'Whisk the chickpea flour, warm water, turmeric, and a pinch of salt until a smooth omelette batter forms.',
      'Sauté baby spinach, tomatoes, and bell peppers in olive oil in a non-stick skillet for 2 minutes.',
      'Pour the batter over the vegetables, cook covered for 3 minutes per side until golden, fold in half, and serve.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_bf_25',
    externalId: 'curated_bf_25',
    sourceProvider: 'curated',
    title: 'North African Spiced Tomato & Chickpea Shakshuka Skillet',
    imageUrl: 'https://www.themealdb.com/images/media/meals/rwvw8q1765660071.jpg',
    category: 'breakfast',
    cuisine: 'Middle Eastern',
    calories: 330,
    protein: 15,
    carbs: 42,
    fat: 11,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '1 cup crushed ripe tomatoes',
      '1/2 cup cooked chickpeas or silken tofu',
      '1/2 red bell pepper, diced',
      '1 tsp ground cumin, smoked paprika & garlic',
      '1 tsp olive oil & fresh parsley'
    ],
    instructions: [
      'Sauté diced red bell pepper, garlic, cumin, and smoked paprika in olive oil for 3 minutes.',
      'Pour in the crushed tomatoes and chickpeas, simmering gently for 8 minutes until thick and rich.',
      'Garnish with chopped fresh parsley and serve warm from the skillet.'
    ],
    dietaryTags: ['Halal', 'Vegan', 'Vegetarian', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_24',
    externalId: 'curated_ln_24',
    sourceProvider: 'curated',
    title: 'Grilled Halal Chicken & Roasted Tomato Basil Pasta',
    imageUrl: 'https://www.themealdb.com/images/media/meals/uquqtu1511178042.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 445,
    protein: 38,
    carbs: 48,
    fat: 10,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, cut into bite-sized pieces',
      '75g brown rice or whole-grain penne pasta',
      '1 cup cherry tomatoes & fresh spinach',
      '2 cloves garlic, minced & fresh basil leaves',
      '1 tsp extra virgin olive oil'
    ],
    instructions: [
      'Boil the pasta in salted water for 8 to 10 minutes until al dente, then drain.',
      'Sear the Halal chicken pieces with garlic and cherry tomatoes in olive oil over medium-high heat for 6 minutes.',
      'Toss the cooked pasta and fresh spinach into the skillet with basil until coated and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_25',
    externalId: 'curated_ln_25',
    sourceProvider: 'curated',
    title: 'Classic Halal Lean Beef Burger with Avocado & Crisp Greens',
    imageUrl: 'https://www.themealdb.com/images/media/meals/k420tj1585565244.jpg',
    category: 'lunch',
    cuisine: 'American',
    calories: 460,
    protein: 39,
    carbs: 38,
    fat: 16,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '140g extra-lean Halal ground beef patty',
      '1 whole-grain or gluten-free burger bun, toasted',
      '1/4 ripe avocado, sliced',
      '2 slices ripe tomato, red onion & crisp romaine lettuce',
      '1/2 tsp garlic powder, black pepper & sea salt'
    ],
    instructions: [
      'Season the lean Halal ground beef patty with garlic powder, black pepper, and sea salt.',
      'Sear on a hot grill pan or skillet for 4 to 5 minutes per side until cooked through and juicy.',
      'Assemble inside the toasted bun with crisp lettuce, tomato slices, red onion, and sliced avocado.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_26',
    externalId: 'curated_ln_26',
    sourceProvider: 'curated',
    title: 'Roasted Vegetable & Halal Chicken Margherita Flatbread Pizza',
    imageUrl: 'https://www.themealdb.com/images/media/meals/x0lk931587671540.jpg',
    category: 'lunch',
    cuisine: 'Mediterranean',
    calories: 430,
    protein: 35,
    carbs: 46,
    fat: 11,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '1 whole-grain or gluten-free artisan flatbread',
      '120g shredded roasted Halal chicken breast',
      '1/3 cup herb tomato pizza marinara sauce',
      '1/2 cup sliced bell peppers, mushrooms & cherry tomatoes',
      '1 tsp olive oil, dried oregano & fresh basil'
    ],
    instructions: [
      'Preheat oven or skillet to 200°C (400°F) and spread the herb tomato marinara evenly across the flatbread.',
      'Top with shredded Halal chicken breast, bell peppers, mushrooms, and cherry tomatoes.',
      'Bake for 10 minutes until the crust is crisp, garnish with fresh basil and oregano, and slice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_27',
    externalId: 'curated_ln_27',
    sourceProvider: 'curated',
    title: 'Aromatic Halal Chicken Biryani with Cucumber Mint Herb Salad',
    imageUrl: 'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg',
    category: 'lunch',
    cuisine: 'Indian',
    calories: 470,
    protein: 38,
    carbs: 52,
    fat: 12,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, cubed',
      '3/4 cup aged basmati rice, rinsed',
      '1/2 onion, thinly sliced & 2 cloves garlic',
      '1 tsp garam masala, turmeric, cumin & fresh ginger',
      '1/2 cup diced cucumber, tomato & fresh mint'
    ],
    instructions: [
      'Sauté sliced onion, garlic, ginger, and biryani spices in a pot for 3 minutes, then sear the cubed Halal chicken.',
      'Add rinsed basmati rice and 1.25 cups warm broth; cover tightly and simmer on low for 15 minutes until fluffy.',
      'Fluff with a fork and serve alongside crisp cucumber, tomato, and mint salad.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_28',
    externalId: 'curated_ln_28',
    sourceProvider: 'curated',
    title: 'Halal Grilled Chicken & Avocado Corn Tortilla Tacos',
    imageUrl: 'https://www.themealdb.com/images/media/meals/qrqywr1503066605.jpg',
    category: 'lunch',
    cuisine: 'Mexican',
    calories: 420,
    protein: 36,
    carbs: 42,
    fat: 12,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, diced and seasoned',
      '3 soft corn tortillas, warmed',
      '1/4 ripe avocado, diced',
      '1/2 cup shredded cabbage, tomato & cilantro salsa',
      '1 tbsp fresh lime juice & 1 tsp cumin'
    ],
    instructions: [
      'Sear the cumin-seasoned Halal chicken breast in a hot skillet for 6 minutes until lightly charred and cooked through.',
      'Warm the soft corn tortillas in a dry pan for 30 seconds per side.',
      'Fill each tortilla with grilled chicken, shredded cabbage, tomato cilantro salsa, diced avocado, and lime juice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_29',
    externalId: 'curated_ln_29',
    sourceProvider: 'curated',
    title: 'Crispy Toasted Chicken, Black Bean & Avocado Quesadilla',
    imageUrl: 'https://www.themealdb.com/images/media/meals/quuxsx1511476154.jpg',
    category: 'lunch',
    cuisine: 'Mexican',
    calories: 435,
    protein: 37,
    carbs: 44,
    fat: 12,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '130g cooked Halal chicken breast, shredded',
      '1 large whole-grain or gluten-free tortilla',
      '1/4 cup seasoned black beans & sweet corn',
      '1/4 ripe avocado, mashed as creamy binder',
      '2 tbsp fresh pico de gallo salsa'
    ],
    instructions: [
      'Spread mashed avocado across half of the tortilla and layer with shredded Halal chicken, black beans, and corn.',
      'Fold the tortilla in half and toast in a dry skillet over medium heat for 3 minutes per side until golden and crisp.',
      'Cut into wedges and serve warm with fresh pico de gallo salsa.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_30',
    externalId: 'curated_ln_30',
    sourceProvider: 'curated',
    title: 'Wok-Tossed Halal Chicken & Vegetable Fried Rice',
    imageUrl: 'https://www.themealdb.com/images/media/meals/11bvtm1764795135.jpg',
    category: 'lunch',
    cuisine: 'Asian',
    calories: 430,
    protein: 36,
    carbs: 48,
    fat: 10,
    prepTime: 15,
    servings: 1,
    ingredients: [
      '130g Halal chicken breast, finely diced',
      '3/4 cup cooked jasmine or brown rice',
      '1/2 cup diced carrots, green peas & scallions',
      '2 cloves garlic & 1 tsp fresh grated ginger',
      '1 tbsp coconut aminos & 1 tsp olive oil'
    ],
    instructions: [
      'Stir-fry the diced Halal chicken breast with garlic and ginger in a hot wok or skillet for 5 minutes.',
      'Add carrots and green peas, cooking for 2 minutes until tender-crisp.',
      'Toss in the cooked rice, coconut aminos, and sliced scallions, stir-frying on high heat for 3 minutes before serving.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_31',
    externalId: 'curated_ln_31',
    sourceProvider: 'curated',
    title: 'Middle Eastern Halal Chicken Shawarma Wrap with Garlic Tahini',
    imageUrl: 'https://www.themealdb.com/images/media/meals/i8l2fu1763742525.jpg',
    category: 'lunch',
    cuisine: 'Middle Eastern',
    calories: 440,
    protein: 38,
    carbs: 42,
    fat: 13,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, thinly sliced',
      '1 whole-wheat or gluten-free flatbread wrap',
      '1 cup shredded romaine, cucumber & tomato',
      '1 tbsp lemon garlic herb dressing',
      '1 tsp shawarma spice blend (cumin, coriander, paprika, turmeric)'
    ],
    instructions: [
      'Toss the sliced Halal chicken breast in shawarma spices and lemon juice, then sear in a hot skillet for 6 to 7 minutes.',
      'Warm the flatbread wrap and layer with shredded romaine, diced cucumber, and tomatoes.',
      'Add the hot shawarma chicken, drizzle with lemon garlic herb dressing, roll tightly, and serve.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_ln_32',
    externalId: 'curated_ln_32',
    sourceProvider: 'curated',
    title: 'Crispy Teriyaki Halal Chicken & Avocado Sushi Roll (Seafood-Free)',
    imageUrl: 'https://www.themealdb.com/images/media/meals/dd7t4d1764877271.jpg',
    category: 'lunch',
    cuisine: 'Asian',
    calories: 395,
    protein: 28,
    carbs: 50,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '110g cooked Halal chicken breast strips',
      '3/4 cup seasoned sushi rice',
      '2 sheets roasted nori seaweed',
      '1/4 ripe avocado & 1/2 cucumber, julienned',
      '1 tbsp ginger coconut aminos glaze'
    ],
    instructions: [
      'Spread seasoned sushi rice evenly over the roasted nori sheets.',
      'Arrange warm Halal chicken strips, julienned cucumber, and sliced avocado along the center.',
      'Roll tightly, slice into 8 bite-sized sushi pieces, and drizzle with ginger coconut aminos glaze.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_24',
    externalId: 'curated_dn_24',
    sourceProvider: 'curated',
    title: 'Rich Halal Chicken & Mushroom Ramen Noodle Bowl',
    imageUrl: 'https://www.themealdb.com/images/media/meals/2wx8cm1763373419.jpg',
    category: 'dinner',
    cuisine: 'Asian',
    calories: 420,
    protein: 37,
    carbs: 46,
    fat: 9,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, sliced',
      '75g rice ramen or buckwheat noodles',
      '2 cups rich ginger garlic Halal chicken broth',
      '1 cup baby bok choy & sliced shiitake mushrooms',
      '2 scallions, thinly sliced'
    ],
    instructions: [
      'Simmer the Halal chicken broth with ginger, garlic, and sliced mushrooms in a pot for 6 minutes.',
      'Add the sliced Halal chicken breast and baby bok choy, poaching gently for 5 minutes until tender.',
      'Cook the ramen noodles separately, transfer to a deep bowl, and ladle the steaming broth, chicken, and greens over top.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_25',
    externalId: 'curated_dn_25',
    sourceProvider: 'curated',
    title: 'Pan-Seared Halal Beef Sirloin Steak with Roasted Garlic Potatoes',
    imageUrl: 'https://www.themealdb.com/images/media/meals/z0ageb1583189517.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 475,
    protein: 42,
    carbs: 38,
    fat: 16,
    prepTime: 22,
    servings: 1,
    ingredients: [
      '150g lean Halal beef sirloin or ribeye steak',
      '1 medium potato, cubed and roasted',
      '1 cup steamed asparagus or green beans',
      '2 cloves garlic & fresh rosemary sprig',
      '1 tsp extra virgin olive oil & cracked black pepper'
    ],
    instructions: [
      'Roast or pan-sear the cubed potatoes with olive oil and rosemary for 12 minutes until golden and crisp.',
      'Season the Halal beef steak with sea salt and cracked black pepper, then sear in a hot skillet with garlic for 3 to 4 minutes per side.',
      'Rest the steak for 3 minutes, slice against the grain, and plate with roasted potatoes and green beans.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_26',
    externalId: 'curated_dn_26',
    sourceProvider: 'curated',
    title: 'Baked Halal Lean Beef & Vegetable Skillet Lasagna',
    imageUrl: 'https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 450,
    protein: 37,
    carbs: 44,
    fat: 13,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '130g extra-lean Halal ground beef',
      '3 brown-rice or whole-grain lasagna sheets, broken',
      '1 cup crushed tomato basil marinara',
      '1 cup diced zucchini & baby spinach',
      '2 tbsp creamy dairy-free oat béchamel drizzle'
    ],
    instructions: [
      'Brown the lean Halal ground beef with diced zucchini and Italian herbs in a skillet for 5 minutes.',
      'Stir in crushed tomato marinara, 1/2 cup water, and broken lasagna sheets; cover and simmer for 12 minutes until tender.',
      'Fold in baby spinach, top with creamy oat béchamel drizzle, and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_27',
    externalId: 'curated_dn_27',
    sourceProvider: 'curated',
    title: 'Grilled Halal Lamb & Chicken Shish Kebab with Rice Pilaf',
    imageUrl: 'https://www.themealdb.com/images/media/meals/5r5rvx1763287943.jpg',
    category: 'dinner',
    cuisine: 'Middle Eastern',
    calories: 460,
    protein: 40,
    carbs: 42,
    fat: 14,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '150g cubed Halal chicken breast & lean lamb/beef',
      '3/4 cup cooked basmati rice pilaf',
      '1 cup bell pepper & red onion chunks',
      '1 tbsp lemon juice, olive oil, oregano & sumac'
    ],
    instructions: [
      'Marinate the Halal meat cubes, bell peppers, and onion in lemon juice, olive oil, and oregano.',
      'Grill or pan-sear the kebab skewers over medium-high heat for 8 to 10 minutes, turning occasionally.',
      'Serve hot over fluffy basmati rice pilaf with a sprinkle of sumac.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_28',
    externalId: 'curated_dn_28',
    sourceProvider: 'curated',
    title: 'West African Smokey Jollof Rice with Grilled Halal Chicken',
    imageUrl: 'https://www.themealdb.com/images/media/meals/er4d081765186828.jpg',
    category: 'dinner',
    cuisine: 'African',
    calories: 465,
    protein: 38,
    carbs: 52,
    fat: 11,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, seasoned and grilled',
      '3/4 cup parboiled long-grain rice',
      '1 cup blended roasted red bell pepper, tomato & onion base',
      '1 tsp thyme, curry powder, bay leaf & ginger',
      '1 tsp olive oil'
    ],
    instructions: [
      'Simmer the blended tomato, red bell pepper, onion, ginger, thyme, and curry powder in olive oil for 6 minutes.',
      'Stir in the rinsed rice and 1 cup chicken broth; cover tightly and steam on low heat for 15 minutes until tender.',
      'Serve the smokey Jollof rice topped with sliced grilled Halal chicken.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_29',
    externalId: 'curated_dn_29',
    sourceProvider: 'curated',
    title: 'Creamy Coconut-Cashew Free Halal Butter Chicken (Dairy-Free)',
    imageUrl: 'https://www.themealdb.com/images/media/meals/yxsurp1511304301.jpg',
    category: 'dinner',
    cuisine: 'Indian',
    calories: 455,
    protein: 38,
    carbs: 46,
    fat: 13,
    prepTime: 22,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, cubed',
      '3/4 cup cooked basmati rice',
      '3/4 cup crushed tomato puree & 1/4 cup light coconut milk',
      '1 tsp garam masala, fenugreek (methi), cumin & ginger',
      '1 tsp olive oil & fresh cilantro'
    ],
    instructions: [
      'Sear the spiced Halal chicken breast cubes in a skillet with ginger and garlic for 5 minutes.',
      'Pour in the crushed tomato puree, garam masala, and light coconut milk; simmer gently for 10 minutes until velvety.',
      'Garnish with fresh cilantro and serve hot over basmati rice.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_30',
    externalId: 'curated_dn_30',
    sourceProvider: 'curated',
    title: 'Wok-Tossed Halal Chicken & Tamarind Pad Thai',
    imageUrl: 'https://www.themealdb.com/images/media/meals/ntafxw1763586291.jpg',
    category: 'dinner',
    cuisine: 'Asian',
    calories: 440,
    protein: 36,
    carbs: 48,
    fat: 11,
    prepTime: 18,
    servings: 1,
    ingredients: [
      '140g Halal chicken breast, thinly sliced',
      '100g flat brown rice Pad Thai noodles, soaked',
      '1 cup crisp bean sprouts, scallions & julienned carrots',
      '2 tbsp tangy tamarind, lime juice & coconut aminos sauce',
      '1 tbsp toasted pumpkin & sunflower seeds'
    ],
    instructions: [
      'Stir-fry the thinly sliced Halal chicken breast with garlic in a hot wok for 5 minutes until golden.',
      'Add the soaked flat rice noodles and tangy tamarind-lime sauce, tossing over high heat for 4 minutes until glossy.',
      'Fold in crisp bean sprouts and scallions, and top with toasted seeds and fresh lime wedges.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_31',
    externalId: 'curated_dn_31',
    sourceProvider: 'curated',
    title: 'Creamy Golden Butternut & Herb Halal Mac and Cheese (Dairy-Free)',
    imageUrl: 'https://www.themealdb.com/images/media/meals/xr0n4r1576788363.jpg',
    category: 'dinner',
    cuisine: 'International',
    calories: 425,
    protein: 32,
    carbs: 50,
    fat: 11,
    prepTime: 20,
    servings: 1,
    ingredients: [
      '85g whole-grain or chickpea elbow macaroni pasta',
      '120g diced grilled Halal chicken breast',
      '3/4 cup velvety roasted butternut, oat milk & nutritional yeast golden sauce',
      '1/2 tsp garlic powder, smoked paprika, turmeric & sea salt',
      '1 cup steamed broccoli florets'
    ],
    instructions: [
      'Boil the elbow macaroni in salted water for 8 minutes until al dente, adding broccoli florets during the final 2 minutes.',
      'Whisk the warm roasted butternut, unsweetened oat milk, nutritional yeast, garlic powder, and smoked paprika in a saucepan until smooth and golden.',
      'Fold the drained macaroni and grilled Halal chicken into the velvety golden sauce and serve warm.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free'],
    halalStatus: 'HALAL_VERIFIED'
  },
  {
    id: 'curated_dn_32',
    externalId: 'curated_dn_32',
    sourceProvider: 'curated',
    title: 'Spanish Saffron & Halal Chicken Valencia Paella',
    imageUrl: 'https://www.themealdb.com/images/media/meals/hblwvg1763478203.jpg',
    category: 'dinner',
    cuisine: 'Mediterranean',
    calories: 460,
    protein: 38,
    carbs: 52,
    fat: 11,
    prepTime: 25,
    servings: 1,
    ingredients: [
      '150g Halal chicken breast & thigh pieces, seasoned',
      '3/4 cup Spanish short-grain paella rice',
      '1.5 cups warm saffron & garlic herb broth',
      '1 cup roasted bell peppers, green peas & Roma tomatoes',
      '1 tsp smoked paprika, olive oil & fresh lemon wedges'
    ],
    instructions: [
      'Sear the seasoned Halal chicken pieces with olive oil, garlic, and smoked paprika in a wide skillet for 6 minutes.',
      'Stir in the diced tomatoes, bell peppers, and short-grain rice, then pour in the warm saffron broth.',
      'Simmer uncovered for 15 minutes until the rice absorbs the broth and forms a golden crust; scatter green peas on top and serve with lemon.'
    ],
    dietaryTags: ['Halal', 'High-Protein', 'Dairy-Free', 'Gluten-Free'],
    halalStatus: 'HALAL_VERIFIED'
  }
];

const usedCuratedInitPhotos = new Set<string>();
export const CURATED_HALAL_RECIPES: AuthoritativeRecipe[] = RAW_CURATED_HALAL_RECIPES.map(raw =>
  toAuthoritativeRecipe(raw, usedCuratedInitPhotos)
);

const SEARCH_STOPWORDS = new Set([
  'and', 'with', 'the', 'for', 'from', 'into', 'over', 'under', 'style', 'free', 'halal', 'bowl', 'plate', 'dish', 'a', 'an', 'in', 'of', 'to'
]);

const GENERIC_MODIFIER_WORDS = new Set([
  'chicken', 'beef', 'lamb', 'turkey', 'meat', 'fish', 'seafood', 'shrimp', 'prawn',
  'egg', 'eggs', 'cheese', 'rice', 'veg', 'vegetable', 'vegetables', 'vegan', 'vegetarian',
  'spicy', 'grilled', 'fried', 'baked', 'roasted', 'steamed', 'sweet', 'hot', 'cold',
  'fresh', 'warm', 'creamy', 'crispy', 'homemade', 'healthy', 'herb', 'garlic'
]);

const DISTINCT_DISH_ARCHETYPES = new Set([
  'pizza', 'burger', 'burgers', 'shawarma', 'biryani', 'jollof', 'paella',
  'taco', 'tacos', 'quesadilla', 'pancake', 'pancakes', 'waffle', 'waffles',
  'omelette', 'omelet', 'shakshuka', 'lasagna', 'lasagne', 'ramen', 'pad thai',
  'sushi', 'dumpling', 'dumplings', 'pierogi', 'gyoza', 'falafel', 'kebab', 'kebabs',
  'kofta', 'chapati', 'roti', 'naan', 'paratha', 'steak', 'sirloin', 'curry',
  'sandwich', 'soup', 'salad', 'pasta', 'spaghetti', 'macaroni', 'noodle', 'noodles',
  'oat', 'oats', 'oatmeal', 'porridge'
]);

const STRICT_DISH_SYNONYMS: Record<string, string[]> = {
  oats: ['oat', 'oats', 'oatmeal', 'porridge'],
  oat: ['oat', 'oats', 'oatmeal', 'porridge'],
  oatmeal: ['oat', 'oats', 'oatmeal', 'porridge'],
  porridge: ['porridge', 'oatmeal', 'oats'],
  pasta: ['pasta', 'spaghetti', 'penne', 'fettuccine', 'macaroni', 'rigatoni', 'tagliatelle'],
  noodles: ['noodle', 'noodles', 'ramen', 'udon', 'soba', 'pad thai', 'chow mein', 'lo mein'],
  noodle: ['noodle', 'noodles', 'ramen', 'udon', 'soba', 'pad thai'],
  ramen: ['ramen'],
  burger: ['burger', 'burgers', 'slider', 'sliders'],
  burgers: ['burger', 'burgers', 'slider', 'sliders'],
  pizza: ['pizza', 'pizzas'],
  pancakes: ['pancake', 'pancakes', 'flapjack', 'hotcake'],
  pancake: ['pancake', 'pancakes', 'flapjack', 'hotcake'],
  waffles: ['waffle', 'waffles'],
  waffle: ['waffle', 'waffles'],
  omelette: ['omelette', 'omelet', 'frittata'],
  omelet: ['omelette', 'omelet', 'frittata'],
  shakshuka: ['shakshuka'],
  steak: ['steak', 'sirloin', 'ribeye', 'tenderloin'],
  sushi: ['sushi', 'maki'],
  tacos: ['taco', 'tacos'],
  taco: ['taco', 'tacos'],
  quesadilla: ['quesadilla', 'quesadillas'],
  curry: ['curry', 'curries', 'masala', 'korma'],
  biryani: ['biryani', 'biriyani'],
  shawarma: ['shawarma', 'doner', 'gyro', 'gyros'],
  kebab: ['kebab', 'kebabs', 'kofta', 'shish kebab'],
  kebabs: ['kebab', 'kebabs', 'kofta', 'shish kebab'],
  dumplings: ['dumpling', 'dumplings', 'pierogi', 'gyoza', 'momo', 'wonton'],
  dumpling: ['dumpling', 'dumplings', 'pierogi', 'gyoza', 'momo', 'wonton'],
  paella: ['paella'],
  chapati: ['chapati', 'roti', 'paratha'],
  falafel: ['falafel'],
  lasagna: ['lasagna', 'lasagne'],
  'butter chicken': ['butter chicken', 'murgh makhani', 'chicken makhani'],
  'mac and cheese': ['mac and cheese', 'mac & cheese', 'macaroni', 'mac and dairy'],
  'jollof rice': ['jollof'],
  'fried rice': ['fried rice', 'nasi goreng'],
  'pad thai': ['pad thai'],
  'seafood paella': ['paella']
};

function hasWholeWordOrPhrase(text: string, phrase: string): boolean {
  const cleanPhrase = phrase.trim().toLowerCase();
  if (!cleanPhrase) return false;
  const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i').test(text);
}

/**
 * Strictly determines whether a candidate recipe genuinely represents the user's searched meal
 * so unrelated dishes that merely share a secondary ingredient or generic protein are never returned.
 */
export function doesRecipeRepresentSearchQuery(
  recipeTitle: string,
  ingredientsText: string,
  searchQuery: string
): { matches: boolean; score: number } {
  const q = (searchQuery || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return { matches: true, score: 1 };

  // Strip "(...-Free)" badges and "Dairy-Free" from title before matching search terms
  const titleClean = (recipeTitle || '')
    .toLowerCase()
    .replace(/\b[a-z]+-free\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const ingClean = (ingredientsText || '')
    .toLowerCase()
    .replace(/\b[a-z]+-free\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Direct full-phrase or exact synonym phrase match in the recipe title
  const exactSynonyms = STRICT_DISH_SYNONYMS[q] || [];
  if (hasWholeWordOrPhrase(titleClean, q)) {
    return { matches: true, score: 100 };
  }
  for (const syn of exactSynonyms) {
    if (hasWholeWordOrPhrase(titleClean, syn)) {
      return { matches: true, score: 95 };
    }
  }

  const rawTokens = q
    .split(/[\s,.\-&]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !SEARCH_STOPWORDS.has(t));

  if (rawTokens.length === 0) {
    return { matches: false, score: 0 };
  }

  const matchesTokenOrSynonymInTitle = (token: string): boolean => {
    const singular = token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token;
    const tokenSyns = new Set<string>([
      token,
      singular,
      ...(STRICT_DISH_SYNONYMS[token] || []),
      ...(STRICT_DISH_SYNONYMS[singular] || [])
    ]);
    for (const candidateTerm of Array.from(tokenSyns)) {
      if (hasWholeWordOrPhrase(titleClean, candidateTerm)) {
        return true;
      }
    }
    return false;
  };

  // 2. Multi-word query (e.g., "butter chicken", "fried rice", "jollof rice", "seafood paella", "mac and cheese")
  if (rawTokens.length >= 2) {
    // Check if EVERY token (or its strict dish synonym) appears in the recipe title
    const allTokensInTitle = rawTokens.every(t => matchesTokenOrSynonymInTitle(t));
    if (allTokensInTitle) {
      return { matches: true, score: 85 };
    }

    // If the query has a distinct dish archetype token (like "paella" in "seafood paella", "shawarma" in "chicken shawarma",
    // "biryani" in "lamb biryani", "jollof" in "jollof rice", "pizza" in "cheese pizza", "burger" in "beef burger")
    // AND does NOT have a conflicting dish qualifier (like "butter" in "butter chicken" or "fried" in "fried rice"),
    // allow matching when all non-generic tokens are in the title.
    const specificTokens = rawTokens.filter(t => !GENERIC_MODIFIER_WORDS.has(t));
    if (specificTokens.length > 0) {
      const allSpecificInTitle = specificTokens.every(t => matchesTokenOrSynonymInTitle(t));
      const hasDistinctDishArchetype = specificTokens.some(
        t => DISTINCT_DISH_ARCHETYPES.has(t) || DISTINCT_DISH_ARCHETYPES.has(t.replace(/s$/, ''))
      );
      if (allSpecificInTitle && hasDistinctDishArchetype) {
        return { matches: true, score: 75 };
      }
    }

    return { matches: false, score: 0 };
  }

  // 3. Single-word query (e.g., "pizza", "oats", "burger", "biryani", "shawarma", "avocado", "chickpea")
  const singleToken = rawTokens[0];
  if (matchesTokenOrSynonymInTitle(singleToken)) {
    return { matches: true, score: 80 };
  }

  // Only allow ingredient-level fallback if the single word is a raw ingredient (NOT a prepared dish archetype like "pizza", "burger", "sushi", "ramen")
  const singularToken = singleToken.endsWith('s') && singleToken.length > 3 ? singleToken.slice(0, -1) : singleToken;
  const isPreparedArchetype =
    DISTINCT_DISH_ARCHETYPES.has(singleToken) || DISTINCT_DISH_ARCHETYPES.has(singularToken);

  if (!isPreparedArchetype && hasWholeWordOrPhrase(ingClean, singleToken)) {
    return { matches: true, score: 35 };
  }

  return { matches: false, score: 0 };
}

export class CuratedRecipeProvider implements RecipeProvider {
  public name = 'curated';

  public async searchRecipes(criteria: RecipeSearchCriteria = {}): Promise<AuthoritativeRecipe[]> {
    let candidates = [...CURATED_HALAL_RECIPES];

    if (criteria.meal_category) {
      candidates = candidates.filter(r => r.meal_category === criteria.meal_category);
    }

    if (criteria.allergies?.length || criteria.disliked_foods?.length) {
      candidates = candidates.filter(
        r => checkAllergensAndDislikes(r, criteria.allergies || [], criteria.disliked_foods || []).safe
      );
    }

    if (criteria.query && criteria.query.trim()) {
      const q = criteria.query.trim();
      candidates = candidates
        .map(recipe => {
          const ingText = recipe.ingredients.map(i => i.item).join(' ');
          const evalMatch = doesRecipeRepresentSearchQuery(recipe.title, ingText, q);
          return { recipe, matches: evalMatch.matches, score: evalMatch.score };
        })
        .filter(item => item.matches && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.recipe);
    }

    if (criteria.limit && criteria.limit > 0) {
      return candidates.slice(0, criteria.limit);
    }
    return candidates;
  }

  public async getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null> {
    const found = CURATED_HALAL_RECIPES.find(
      r => r.external_id === externalId || r.id === externalId
    );
    return found || null;
  }
}

