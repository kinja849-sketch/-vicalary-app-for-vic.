import { AuthoritativeRecipe, MealCategory, RecipeProvider, RecipeSearchCriteria } from './RecipeProvider';

export class CuratedRecipeProvider implements RecipeProvider {
  public name = 'curated';

  private catalog: AuthoritativeRecipe[] = [
    // ========================================================================
    // BREAKFAST (12 Authenticated Halal Dishes)
    // ========================================================================
    {
      external_id: 'curated_bf_turmeric_oats',
      provider: 'curated',
      title: 'Bubur Oatmeal Ayam Suwir Kuning',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Rolled oats', amount: '50', unit: 'g', normalized_name: 'oat' },
        { item: 'Halal chicken breast shredded', amount: '100', unit: 'g', normalized_name: 'chicken' },
        { item: 'Turmeric chicken broth', amount: '250', unit: 'ml', normalized_name: 'chicken broth' },
        { item: 'Garlic & scallions', amount: '1', unit: 'tbsp', normalized_name: 'garlic' }
      ],
      instructions: [
        { step: 1, instruction: 'Simmer turmeric broth and minced garlic in a small pot.' },
        { step: 2, instruction: 'Stir in rolled oats and cook for 3-4 minutes until creamy.' },
        { step: 3, instruction: 'Pour into bowl, top with shredded halal chicken and scallions.' }
      ],
      nutrition: { calories: 360, protein_g: 28, carbs_g: 42, fat_g: 8 },
      dietary_tags: ['Halal', 'High Protein', 'Complex Carbs']
    },
    {
      external_id: 'curated_bf_spinach_tofu_omelette',
      provider: 'curated',
      title: 'Omelet Tahu Bayam Bumbu Bawang',
      image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Asian',
      prep_time_minutes: 5,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Farm fresh eggs', amount: '2', unit: 'pcs', normalized_name: 'egg' },
        { item: 'Firm white tofu diced', amount: '60', unit: 'g', normalized_name: 'tofu' },
        { item: 'Baby spinach leaves', amount: '40', unit: 'g', normalized_name: 'spinach' },
        { item: 'Olive oil', amount: '1', unit: 'tsp', normalized_name: 'olive oil' }
      ],
      instructions: [
        { step: 1, instruction: 'Whisk eggs with sea salt and cracked black pepper.' },
        { step: 2, instruction: 'Sauté minced garlic, tofu cubes, and spinach in olive oil for 1 minute.' },
        { step: 3, instruction: 'Pour whisked eggs over the pan and cook on low heat until set.' }
      ],
      nutrition: { calories: 310, protein_g: 24, carbs_g: 8, fat_g: 14 },
      dietary_tags: ['Halal', 'High Protein', 'Vegetarian']
    },
    {
      external_id: 'curated_bf_brown_rice_egg',
      provider: 'curated',
      title: 'Nasi Merah Telur Ceplok & Lalapan',
      image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Steamed brown rice', amount: '120', unit: 'g', normalized_name: 'rice' },
        { item: 'Egg fried sunny side up', amount: '1', unit: 'pc', normalized_name: 'egg' },
        { item: 'Cucumber slices and tomato', amount: '60', unit: 'g', normalized_name: 'cucumber' }
      ],
      instructions: [
        { step: 1, instruction: 'Warm steamed brown rice in a serving bowl.' },
        { step: 2, instruction: 'Fry egg sunny side up with minimal olive oil.' },
        { step: 3, instruction: 'Top rice with egg and accompany with fresh cucumber and tomato.' }
      ],
      nutrition: { calories: 380, protein_g: 18, carbs_g: 52, fat_g: 10 },
      dietary_tags: ['Halal', 'Vegetarian', 'Complex Carbs']
    },
    {
      external_id: 'curated_bf_avocado_toast',
      provider: 'curated',
      title: 'Roti Gandum Alpukat Telur Rebus',
      image_url: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Western',
      prep_time_minutes: 5,
      cook_time_minutes: 7,
      servings: 1,
      ingredients: [
        { item: 'Whole wheat toast', amount: '2', unit: 'slices', normalized_name: 'wheat' },
        { item: 'Mashed ripe avocado', amount: '50', unit: 'g', normalized_name: 'avocado' },
        { item: 'Soft boiled egg', amount: '1', unit: 'pc', normalized_name: 'egg' }
      ],
      instructions: [
        { step: 1, instruction: 'Toast whole wheat bread slices until crisp and golden.' },
        { step: 2, instruction: 'Spread freshly mashed avocado with lemon juice over toast.' },
        { step: 3, instruction: 'Slice soft boiled egg and arrange on top with cracked black pepper.' }
      ],
      nutrition: { calories: 340, protein_g: 16, carbs_g: 35, fat_g: 14 },
      dietary_tags: ['Halal', 'Vegetarian', 'Healthy Fats']
    },
    {
      external_id: 'curated_bf_smoothie_bowl',
      provider: 'curated',
      title: 'Smoothie Bowl Pisang Buah Naga Chia',
      image_url: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Healthy',
      prep_time_minutes: 7,
      cook_time_minutes: 0,
      servings: 1,
      ingredients: [
        { item: 'Frozen ripe banana', amount: '1', unit: 'pc', normalized_name: 'banana' },
        { item: 'Red dragonfruit puree', amount: '80', unit: 'g', normalized_name: 'dragonfruit' },
        { item: 'Organic chia seeds', amount: '1', unit: 'tbsp', normalized_name: 'chia' },
        { item: 'Almond milk', amount: '100', unit: 'ml', normalized_name: 'almond milk' }
      ],
      instructions: [
        { step: 1, instruction: 'Blend frozen banana, dragonfruit, and almond milk until thick and smooth.' },
        { step: 2, instruction: 'Pour into bowl and sprinkle organic chia seeds and sliced banana on top.' }
      ],
      nutrition: { calories: 290, protein_g: 7, carbs_g: 54, fat_g: 5 },
      dietary_tags: ['Halal', 'Vegan', 'High Fiber']
    },
    {
      external_id: 'curated_bf_scrambled_eggs_mushroom',
      provider: 'curated',
      title: 'Scrambled Eggs Jamur Tiram & Tomat',
      image_url: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Western',
      prep_time_minutes: 5,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Eggs', amount: '2', unit: 'pcs', normalized_name: 'egg' },
        { item: 'Oyster mushrooms sliced', amount: '50', unit: 'g', normalized_name: 'mushroom' },
        { item: 'Cherry tomatoes halved', amount: '40', unit: 'g', normalized_name: 'tomato' }
      ],
      instructions: [
        { step: 1, instruction: 'Sauté sliced oyster mushrooms and cherry tomatoes in olive oil for 2 minutes.' },
        { step: 2, instruction: 'Pour beaten eggs into skillet and gently fold on low heat.' }
      ],
      nutrition: { calories: 270, protein_g: 19, carbs_g: 7, fat_g: 16 },
      dietary_tags: ['Halal', 'High Protein', 'Vegetarian']
    },
    {
      external_id: 'curated_bf_bubur_manado',
      provider: 'curated',
      title: 'Bubur Manado Sehat Tanpa Santan',
      image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Cooked rice porridge', amount: '150', unit: 'g', normalized_name: 'rice' },
        { item: 'Yellow sweet potato cubes', amount: '50', unit: 'g', normalized_name: 'sweet potato' },
        { item: 'Spinach and sweet corn', amount: '60', unit: 'g', normalized_name: 'corn' },
        { item: 'Kemangi (lemon basil)', amount: '10', unit: 'g', normalized_name: 'basil' }
      ],
      instructions: [
        { step: 1, instruction: 'Boil sweet potato and corn in water until tender.' },
        { step: 2, instruction: 'Add rice and spinach, simmering until thick.' },
        { step: 3, instruction: 'Stir in fresh kemangi leaves and serve hot.' }
      ],
      nutrition: { calories: 320, protein_g: 9, carbs_g: 65, fat_g: 3 },
      dietary_tags: ['Halal', 'Vegan', 'Traditional']
    },
    {
      external_id: 'curated_bf_oat_pancake',
      provider: 'curated',
      title: 'Pancake Oatmeal Pisang Kayu Manis',
      image_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Healthy',
      prep_time_minutes: 5,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Rolled oat flour', amount: '60', unit: 'g', normalized_name: 'oat' },
        { item: 'Mashed ripe banana', amount: '1', unit: 'pc', normalized_name: 'banana' },
        { item: 'Egg whites', amount: '2', unit: 'pcs', normalized_name: 'egg' },
        { item: 'Ground cinnamon', amount: '0.5', unit: 'tsp', normalized_name: 'cinnamon' }
      ],
      instructions: [
        { step: 1, instruction: 'Mix oat flour, mashed banana, egg whites, and cinnamon into a batter.' },
        { step: 2, instruction: 'Cook on non-stick skillet for 2 minutes per side until golden.' }
      ],
      nutrition: { calories: 330, protein_g: 17, carbs_g: 53, fat_g: 5 },
      dietary_tags: ['Halal', 'High Protein', 'Vegetarian']
    },
    {
      external_id: 'curated_bf_chicken_sandwich',
      provider: 'curated',
      title: 'Sandwich Dada Ayam Panggang Gandum',
      image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Western',
      prep_time_minutes: 5,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Whole wheat bread', amount: '2', unit: 'slices', normalized_name: 'wheat' },
        { item: 'Grilled halal chicken breast', amount: '100', unit: 'g', normalized_name: 'chicken' },
        { item: 'Lettuce and sliced tomato', amount: '50', unit: 'g', normalized_name: 'lettuce' }
      ],
      instructions: [
        { step: 1, instruction: 'Grill halal chicken breast with pinch of garlic powder and salt.' },
        { step: 2, instruction: 'Layer lettuce, tomato, and sliced chicken inside whole wheat bread.' }
      ],
      nutrition: { calories: 390, protein_g: 34, carbs_g: 38, fat_g: 9 },
      dietary_tags: ['Halal', 'High Protein']
    },
    {
      external_id: 'curated_bf_bihun_kuah',
      provider: 'curated',
      title: 'Bihun Kuah Sayur Dada Ayam',
      image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Asian',
      prep_time_minutes: 7,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Rice vermicelli (bihun)', amount: '60', unit: 'g', normalized_name: 'rice noodle' },
        { item: 'Halal chicken breast', amount: '90', unit: 'g', normalized_name: 'chicken' },
        { item: 'Bok choy and carrot slices', amount: '70', unit: 'g', normalized_name: 'bok choy' },
        { item: 'Clear garlic chicken broth', amount: '350', unit: 'ml', normalized_name: 'chicken broth' }
      ],
      instructions: [
        { step: 1, instruction: 'Bring clear chicken broth to a boil with garlic and white pepper.' },
        { step: 2, instruction: 'Add chicken slices and vegetables, simmer 3 minutes.' },
        { step: 3, instruction: 'Place soaked bihun in bowl and ladle boiling broth and toppings over.' }
      ],
      nutrition: { calories: 350, protein_g: 27, carbs_g: 48, fat_g: 6 },
      dietary_tags: ['Halal', 'Comfort Food']
    },
    {
      external_id: 'curated_bf_yogurt_parfait',
      provider: 'curated',
      title: 'Greek Yogurt Parfait Buah Segar',
      image_url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Healthy',
      prep_time_minutes: 5,
      cook_time_minutes: 0,
      servings: 1,
      ingredients: [
        { item: 'Plain Greek yogurt', amount: '150', unit: 'g', normalized_name: 'yogurt' },
        { item: 'Mixed fresh berries & mango', amount: '80', unit: 'g', normalized_name: 'berries' },
        { item: 'Toasted oats', amount: '20', unit: 'g', normalized_name: 'oat' },
        { item: 'Pure honey', amount: '1', unit: 'tsp', normalized_name: 'honey' }
      ],
      instructions: [
        { step: 1, instruction: 'Spoon thick Greek yogurt into a glass.' },
        { step: 2, instruction: 'Layer with diced fresh fruit and toasted oats.' },
        { step: 3, instruction: 'Drizzle with pure honey and serve chilled.' }
      ],
      nutrition: { calories: 260, protein_g: 19, carbs_g: 34, fat_g: 5 },
      dietary_tags: ['Halal', 'High Protein', 'Vegetarian']
    },
    {
      external_id: 'curated_bf_pepes_tahu_jamur',
      provider: 'curated',
      title: 'Pepes Tahu Jamur Kukus Gurih',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Indonesian',
      prep_time_minutes: 8,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'White tofu mashed', amount: '150', unit: 'g', normalized_name: 'tofu' },
        { item: 'Oyster mushrooms shredded', amount: '50', unit: 'g', normalized_name: 'mushroom' },
        { item: 'Kemangi and shallots', amount: '20', unit: 'g', normalized_name: 'basil' },
        { item: 'Egg', amount: '1', unit: 'pc', normalized_name: 'egg' }
      ],
      instructions: [
        { step: 1, instruction: 'Mix mashed tofu, shredded mushrooms, egg, and herbs.' },
        { step: 2, instruction: 'Wrap tightly in banana leaf or parchment paper.' },
        { step: 3, instruction: 'Steam for 15 minutes until aromatic and firm.' }
      ],
      nutrition: { calories: 220, protein_g: 18, carbs_g: 10, fat_g: 11 },
      dietary_tags: ['Halal', 'Vegetarian', 'Low Carb']
    },

    // ========================================================================
    // LUNCH (12 Authenticated Halal Dishes)
    // ========================================================================
    {
      external_id: 'curated_lunch_ayam_bakar_rujak',
      provider: 'curated',
      title: 'Nasi Merah Ayam Bakar Bumbu Rujak',
      image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast', amount: '160', unit: 'g', normalized_name: 'chicken' },
        { item: 'Steamed brown rice', amount: '120', unit: 'g', normalized_name: 'rice' },
        { item: 'Aromatic rujak spice paste', amount: '2', unit: 'tbsp', normalized_name: 'chili' },
        { item: 'Steamed long beans', amount: '60', unit: 'g', normalized_name: 'green beans' }
      ],
      instructions: [
        { step: 1, instruction: 'Marinate halal chicken breast in blended shallot, chili, and turmeric paste.' },
        { step: 2, instruction: 'Grill chicken on pan until caramelized and cooked through.' },
        { step: 3, instruction: 'Serve with warm steamed brown rice and tender green beans.' }
      ],
      nutrition: { calories: 520, protein_g: 45, carbs_g: 55, fat_g: 11 },
      dietary_tags: ['Halal', 'High Protein', 'Traditional']
    },
    {
      external_id: 'curated_lunch_sate_ayam',
      provider: 'curated',
      title: 'Sate Dada Ayam Panggang Bumbu Kacang',
      image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 15,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast cubed', amount: '160', unit: 'g', normalized_name: 'chicken' },
        { item: 'Roasted peanut sauce', amount: '2', unit: 'tbsp', normalized_name: 'peanut' },
        { item: 'Steamed rice cake / lontong', amount: '100', unit: 'g', normalized_name: 'rice' },
        { item: 'Shallots and cucumber pickle', amount: '40', unit: 'g', normalized_name: 'cucumber' }
      ],
      instructions: [
        { step: 1, instruction: 'Thread marinated halal chicken cubes onto bamboo skewers.' },
        { step: 2, instruction: 'Grill skewers turning frequently until charred and juicy.' },
        { step: 3, instruction: 'Drizzle with warm peanut sauce and accompany with cucumber.' }
      ],
      nutrition: { calories: 450, protein_g: 42, carbs_g: 38, fat_g: 14 },
      dietary_tags: ['Halal', 'High Protein']
    },
    {
      external_id: 'curated_lunch_capcay_seafood',
      provider: 'curated',
      title: 'Capcay Goreng Seafood & Tahu',
      image_url: 'https://images.unsplash.com/photo-1546069901-d66a285109b0?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Asian',
      prep_time_minutes: 10,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Fresh tiger shrimp peeled', amount: '100', unit: 'g', normalized_name: 'shrimp' },
        { item: 'Firm white tofu cubed', amount: '70', unit: 'g', normalized_name: 'tofu' },
        { item: 'Broccoli, carrot, and cauliflower', amount: '150', unit: 'g', normalized_name: 'broccoli' },
        { item: 'Garlic and low-sodium oyster sauce', amount: '1', unit: 'tbsp', normalized_name: 'garlic' }
      ],
      instructions: [
        { step: 1, instruction: 'Stir fry garlic and shrimp in a hot wok until pink.' },
        { step: 2, instruction: 'Add mixed vegetables and tofu cubes, splashing with clear vegetable stock.' },
        { step: 3, instruction: 'Cook until crisp-tender and serve hot.' }
      ],
      nutrition: { calories: 380, protein_g: 32, carbs_g: 30, fat_g: 12 },
      dietary_tags: ['Halal', 'Seafood', 'High Fiber']
    },
    {
      external_id: 'curated_lunch_gado_gado',
      provider: 'curated',
      title: 'Gado-Gado Siram Bumbu Kacang Sehat',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 15,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Boiled egg halved', amount: '1', unit: 'pc', normalized_name: 'egg' },
        { item: 'Steamed tempeh and tofu', amount: '80', unit: 'g', normalized_name: 'tempeh' },
        { item: 'Blanched spinach, cabbage, bean sprouts', amount: '120', unit: 'g', normalized_name: 'spinach' },
        { item: 'Traditional peanut dressing', amount: '2.5', unit: 'tbsp', normalized_name: 'peanut' }
      ],
      instructions: [
        { step: 1, instruction: 'Arrange blanched vegetables, warm tempeh, and tofu on a plate.' },
        { step: 2, instruction: 'Top with halved boiled egg and pour peanut sauce evenly.' }
      ],
      nutrition: { calories: 410, protein_g: 22, carbs_g: 38, fat_g: 19 },
      dietary_tags: ['Halal', 'Vegetarian', 'High Fiber']
    },
    {
      external_id: 'curated_lunch_ayam_teriyaki',
      provider: 'curated',
      title: 'Ayam Teriyaki Wijen Nasi Coklat',
      image_url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Asian',
      prep_time_minutes: 8,
      cook_time_minutes: 12,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast fillet', amount: '150', unit: 'g', normalized_name: 'chicken' },
        { item: 'Alcohol-free teriyaki glaze', amount: '2', unit: 'tbsp', normalized_name: 'teriyaki' },
        { item: 'Steamed brown rice', amount: '120', unit: 'g', normalized_name: 'rice' },
        { item: 'Toasted white sesame seeds', amount: '1', unit: 'tsp', normalized_name: 'sesame' }
      ],
      instructions: [
        { step: 1, instruction: 'Sear halal chicken breast in pan until golden.' },
        { step: 2, instruction: 'Coat with alcohol-free ginger soy glaze until thickened.' },
        { step: 3, instruction: 'Slice and serve over brown rice sprinkled with toasted sesame.' }
      ],
      nutrition: { calories: 490, protein_g: 43, carbs_g: 52, fat_g: 11 },
      dietary_tags: ['Halal', 'High Protein']
    },
    {
      external_id: 'curated_lunch_tumis_tempe_tahu',
      provider: 'curated',
      title: 'Tumis Tempe Tahu Buncis Saus Tiram',
      image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Fresh tempeh cubed', amount: '80', unit: 'g', normalized_name: 'tempeh' },
        { item: 'Yellow tofu cubed', amount: '70', unit: 'g', normalized_name: 'tofu' },
        { item: 'Green beans cut angled', amount: '80', unit: 'g', normalized_name: 'green beans' },
        { item: 'Sweet soy sauce and shallots', amount: '1', unit: 'tbsp', normalized_name: 'shallot' }
      ],
      instructions: [
        { step: 1, instruction: 'Sauté sliced shallots and garlic in vegetable oil.' },
        { step: 2, instruction: 'Add tempeh, tofu, and green beans.' },
        { step: 3, instruction: 'Season with halal sweet soy sauce and cook until fragrant.' }
      ],
      nutrition: { calories: 370, protein_g: 26, carbs_g: 34, fat_g: 13 },
      dietary_tags: ['Halal', 'Vegan', 'High Protein']
    },
    {
      external_id: 'curated_lunch_pepes_ikan_nila',
      provider: 'curated',
      title: 'Pepes Ikan Nila Kemangi Bumbu Kuning',
      image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 12,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Fresh tilapia fish fillet', amount: '180', unit: 'g', normalized_name: 'fish' },
        { item: 'Yellow turmeric herb paste', amount: '2', unit: 'tbsp', normalized_name: 'turmeric' },
        { item: 'Fresh kemangi basil leaves', amount: '20', unit: 'g', normalized_name: 'basil' },
        { item: 'Lemongrass and salam leaf', amount: '1', unit: 'stalk', normalized_name: 'lemongrass' }
      ],
      instructions: [
        { step: 1, instruction: 'Coat fresh tilapia fillet thoroughly with aromatic yellow spice paste.' },
        { step: 2, instruction: 'Wrap securely in banana leaf with kemangi and lemongrass.' },
        { step: 3, instruction: 'Steam for 20 minutes until fish is tender and infused with herbs.' }
      ],
      nutrition: { calories: 420, protein_g: 44, carbs_g: 12, fat_g: 18 },
      dietary_tags: ['Halal', 'Seafood', 'High Protein']
    },
    {
      external_id: 'curated_lunch_soto_ayam',
      provider: 'curated',
      title: 'Soto Ayam Bening Segar Jeruk Nipis',
      image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast shredded', amount: '140', unit: 'g', normalized_name: 'chicken' },
        { item: 'Aromatic lemongrass turmeric broth', amount: '350', unit: 'ml', normalized_name: 'chicken broth' },
        { item: 'Shredded cabbage and sprouts', amount: '80', unit: 'g', normalized_name: 'cabbage' },
        { item: 'Steamed rice', amount: '100', unit: 'g', normalized_name: 'rice' }
      ],
      instructions: [
        { step: 1, instruction: 'Simmer halal chicken breast with lemongrass, kaffir lime leaf, and turmeric.' },
        { step: 2, instruction: 'Shred cooked chicken and blanch vegetables.' },
        { step: 3, instruction: 'Assemble bowl with rice and vegetables, pour boiling clear broth, squeeze fresh lime.' }
      ],
      nutrition: { calories: 410, protein_g: 38, carbs_g: 48, fat_g: 8 },
      dietary_tags: ['Halal', 'Comfort Food', 'High Protein']
    },
    {
      external_id: 'curated_lunch_tumis_kangkung',
      provider: 'curated',
      title: 'Tumis Kangkung Bawang Putih & Tahu',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Fresh water spinach (kangkung)', amount: '180', unit: 'g', normalized_name: 'kangkung' },
        { item: 'Firm tofu diced', amount: '60', unit: 'g', normalized_name: 'tofu' },
        { item: 'Garlic and red chili', amount: '2', unit: 'cloves', normalized_name: 'garlic' }
      ],
      instructions: [
        { step: 1, instruction: 'Sauté garlic and chili in 1 tsp olive oil over high heat.' },
        { step: 2, instruction: 'Add kangkung and tofu cubes, toss quickly for 2 minutes until just wilted.' }
      ],
      nutrition: { calories: 180, protein_g: 12, carbs_g: 16, fat_g: 7 },
      dietary_tags: ['Halal', 'Vegan', 'Low Calorie']
    },
    {
      external_id: 'curated_lunch_tongkol_balado',
      provider: 'curated',
      title: 'Ikan Tongkol Balado Rendah Minyak',
      image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Tongkol tuna fillet chunks', amount: '160', unit: 'g', normalized_name: 'fish' },
        { item: 'Crushed red chili tomato sambal', amount: '2', unit: 'tbsp', normalized_name: 'chili' },
        { item: 'Steamed red rice', amount: '100', unit: 'g', normalized_name: 'rice' }
      ],
      instructions: [
        { step: 1, instruction: 'Steam tongkol tuna chunks until firm.' },
        { step: 2, instruction: 'Simmer crushed red chili, tomato, and kaffir lime leaf with 1 tsp oil.' },
        { step: 3, instruction: 'Toss fish into sauce until well coated and serve over warm red rice.' }
      ],
      nutrition: { calories: 430, protein_g: 44, carbs_g: 38, fat_g: 10 },
      dietary_tags: ['Halal', 'Seafood', 'High Protein']
    },
    {
      external_id: 'curated_lunch_sapi_cah_brokoli',
      provider: 'curated',
      title: 'Daging Sapi Cah Brokoli Saus Tiram',
      image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Asian',
      prep_time_minutes: 10,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Halal lean beef strips', amount: '130', unit: 'g', normalized_name: 'beef' },
        { item: 'Fresh broccoli florets', amount: '120', unit: 'g', normalized_name: 'broccoli' },
        { item: 'Garlic and halal oyster sauce', amount: '1', unit: 'tbsp', normalized_name: 'garlic' }
      ],
      instructions: [
        { step: 1, instruction: 'Sauté minced garlic in sesame oil.' },
        { step: 2, instruction: 'Flash sear lean halal beef strips for 2 minutes.' },
        { step: 3, instruction: 'Add blanched broccoli and halal oyster sauce, tossing for 1 minute.' }
      ],
      nutrition: { calories: 480, protein_g: 40, carbs_g: 28, fat_g: 16 },
      dietary_tags: ['Halal', 'High Protein']
    },
    {
      external_id: 'curated_lunch_sup_jagung_ayam',
      provider: 'curated',
      title: 'Sup Jagung Telur Dada Ayam',
      image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Asian',
      prep_time_minutes: 8,
      cook_time_minutes: 12,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast diced', amount: '120', unit: 'g', normalized_name: 'chicken' },
        { item: 'Sweet corn kernels', amount: '80', unit: 'g', normalized_name: 'corn' },
        { item: 'Egg beaten ribboned', amount: '1', unit: 'pc', normalized_name: 'egg' },
        { item: 'Clear vegetable chicken broth', amount: '350', unit: 'ml', normalized_name: 'chicken broth' }
      ],
      instructions: [
        { step: 1, instruction: 'Bring broth and sweet corn to a gentle boil.' },
        { step: 2, instruction: 'Add halal chicken breast cubes and cook for 4 minutes.' },
        { step: 3, instruction: 'Slowly stir in beaten egg ribbons and season with white pepper.' }
      ],
      nutrition: { calories: 340, protein_g: 34, carbs_g: 28, fat_g: 8 },
      dietary_tags: ['Halal', 'High Protein']
    },

    // ========================================================================
    // DINNER (12 Authenticated Halal Dishes)
    // ========================================================================
    {
      external_id: 'curated_din_sup_ikan_kakap',
      provider: 'curated',
      title: 'Sup Ikan Kakap Kuah Bening Asam Segar',
      image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Red snapper fillet cubes', amount: '170', unit: 'g', normalized_name: 'fish' },
        { item: 'Green tomatoes and lemongrass', amount: '50', unit: 'g', normalized_name: 'tomato' },
        { item: 'Fresh lime juice and kemangi', amount: '1', unit: 'tbsp', normalized_name: 'basil' },
        { item: 'Clear aromatic broth', amount: '350', unit: 'ml', normalized_name: 'broth' }
      ],
      instructions: [
        { step: 1, instruction: 'Boil water with ginger, lemongrass, shallots, and green tomato.' },
        { step: 2, instruction: 'Add red snapper chunks and gently simmer 4 minutes.' },
        { step: 3, instruction: 'Turn off heat, stir in lime juice and fresh basil leaves.' }
      ],
      nutrition: { calories: 340, protein_g: 40, carbs_g: 14, fat_g: 6 },
      dietary_tags: ['Halal', 'Seafood', 'High Protein', 'Low Fat']
    },
    {
      external_id: 'curated_din_ayam_rosemary',
      provider: 'curated',
      title: 'Dada Ayam Panggang Bumbu Rosemary Lemon',
      image_url: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Western',
      prep_time_minutes: 8,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast', amount: '160', unit: 'g', normalized_name: 'chicken' },
        { item: 'Fresh rosemary and lemon juice', amount: '1', unit: 'tbsp', normalized_name: 'lemon' },
        { item: 'Steamed green beans and baby carrots', amount: '100', unit: 'g', normalized_name: 'carrot' }
      ],
      instructions: [
        { step: 1, instruction: 'Rub chicken breast with rosemary, garlic, sea salt, and lemon juice.' },
        { step: 2, instruction: 'Pan grill for 6 minutes per side until golden and cooked through.' },
        { step: 3, instruction: 'Serve alongside crisp steamed garden vegetables.' }
      ],
      nutrition: { calories: 380, protein_g: 44, carbs_g: 16, fat_g: 9 },
      dietary_tags: ['Halal', 'High Protein', 'Low Carb']
    },
    {
      external_id: 'curated_din_tumis_brokoli_tahu',
      provider: 'curated',
      title: 'Tumis Brokoli Kangkung Bawang Putih & Tahu',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Asian',
      prep_time_minutes: 8,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Broccoli florets', amount: '120', unit: 'g', normalized_name: 'broccoli' },
        { item: 'Firm white tofu cubed', amount: '90', unit: 'g', normalized_name: 'tofu' },
        { item: 'Crushed garlic and olive oil', amount: '1', unit: 'tbsp', normalized_name: 'garlic' }
      ],
      instructions: [
        { step: 1, instruction: 'Pan-sear tofu cubes until light golden.' },
        { step: 2, instruction: 'Add garlic and broccoli florets with 2 tbsp water.' },
        { step: 3, instruction: 'Cover for 3 minutes until broccoli is vibrant green.' }
      ],
      nutrition: { calories: 290, protein_g: 22, carbs_g: 20, fat_g: 12 },
      dietary_tags: ['Halal', 'Vegan', 'High Fiber']
    },
    {
      external_id: 'curated_din_nila_bakar_madu',
      provider: 'curated',
      title: 'Ikan Nila Bakar Madu Pedas Ringan',
      image_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Fresh tilapia fillet', amount: '170', unit: 'g', normalized_name: 'fish' },
        { item: 'Pure honey and sweet soy marinade', amount: '1.5', unit: 'tbsp', normalized_name: 'honey' },
        { item: 'Fresh cucumber and tomato slices', amount: '60', unit: 'g', normalized_name: 'cucumber' }
      ],
      instructions: [
        { step: 1, instruction: 'Brush tilapia with honey, sweet soy, and lime juice marinade.' },
        { step: 2, instruction: 'Grill turning once until caramelized on exterior and tender within.' }
      ],
      nutrition: { calories: 390, protein_g: 40, carbs_g: 24, fat_g: 10 },
      dietary_tags: ['Halal', 'Seafood', 'High Protein']
    },
    {
      external_id: 'curated_din_sup_ayam_jamur',
      provider: 'curated',
      title: 'Sup Ayam Jamur Sayuran Bening',
      image_url: 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Halal chicken breast cubes', amount: '130', unit: 'g', normalized_name: 'chicken' },
        { item: 'Oyster mushrooms & button mushrooms', amount: '70', unit: 'g', normalized_name: 'mushroom' },
        { item: 'Carrot slices & celery', amount: '60', unit: 'g', normalized_name: 'carrot' },
        { item: 'Clear garlic broth', amount: '350', unit: 'ml', normalized_name: 'chicken broth' }
      ],
      instructions: [
        { step: 1, instruction: 'Simmer carrots and garlic broth.' },
        { step: 2, instruction: 'Add halal chicken breast cubes and mushrooms.' },
        { step: 3, instruction: 'Cook 5 minutes, garnish with fresh celery and scallions.' }
      ],
      nutrition: { calories: 310, protein_g: 35, carbs_g: 18, fat_g: 7 },
      dietary_tags: ['Halal', 'High Protein', 'Comfort Food']
    },
    {
      external_id: 'curated_din_tumis_tauge_tahu',
      provider: 'curated',
      title: 'Tumis Tauge Tahu Tempe Daun Bawang',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Crisp bean sprouts', amount: '120', unit: 'g', normalized_name: 'bean sprouts' },
        { item: 'Yellow tofu cubes', amount: '70', unit: 'g', normalized_name: 'tofu' },
        { item: 'Tempeh diced small', amount: '50', unit: 'g', normalized_name: 'tempeh' }
      ],
      instructions: [
        { step: 1, instruction: 'Flash fry garlic and scallions in skillet.' },
        { step: 2, instruction: 'Toss tofu, tempeh, and fresh sprouts together for 2 minutes.' }
      ],
      nutrition: { calories: 240, protein_g: 20, carbs_g: 16, fat_g: 10 },
      dietary_tags: ['Halal', 'Vegan', 'Low Calorie']
    },
    {
      external_id: 'curated_din_steak_tempe',
      provider: 'curated',
      title: 'Steak Tempe Saus Lada Hitam',
      image_url: 'https://images.unsplash.com/photo-1546069901-d66a285109b0?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Fusion',
      prep_time_minutes: 10,
      cook_time_minutes: 12,
      servings: 1,
      ingredients: [
        { item: 'Whole steamed tempeh slab', amount: '150', unit: 'g', normalized_name: 'tempeh' },
        { item: 'Cracked black pepper sauce', amount: '2', unit: 'tbsp', normalized_name: 'pepper' },
        { item: 'Steamed green beans & carrot', amount: '80', unit: 'g', normalized_name: 'green beans' }
      ],
      instructions: [
        { step: 1, instruction: 'Score tempeh slab and pan-sear with olive oil until crisp.' },
        { step: 2, instruction: 'Ladle hot black pepper sauce over steak and serve with garden veggies.' }
      ],
      nutrition: { calories: 350, protein_g: 28, carbs_g: 30, fat_g: 12 },
      dietary_tags: ['Halal', 'Vegan', 'High Protein']
    },
    {
      external_id: 'curated_din_salad_ayam_wijen',
      provider: 'curated',
      title: 'Salad Dada Ayam Panggang Saus Wijen',
      image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Healthy',
      prep_time_minutes: 10,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Grilled halal chicken breast', amount: '150', unit: 'g', normalized_name: 'chicken' },
        { item: 'Romaine lettuce and red cabbage', amount: '120', unit: 'g', normalized_name: 'lettuce' },
        { item: 'Toasted sesame dressing', amount: '1.5', unit: 'tbsp', normalized_name: 'sesame' }
      ],
      instructions: [
        { step: 1, instruction: 'Toss mixed crisp greens and shredded red cabbage.' },
        { step: 2, instruction: 'Top with sliced warm grilled chicken and drizzle toasted sesame dressing.' }
      ],
      nutrition: { calories: 360, protein_g: 42, carbs_g: 12, fat_g: 11 },
      dietary_tags: ['Halal', 'High Protein', 'Low Carb']
    },
    {
      external_id: 'curated_din_udang_bawang_putih',
      provider: 'curated',
      title: 'Udang Tumis Bawang Putih Daun Ketumbar',
      image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Asian',
      prep_time_minutes: 8,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Fresh tiger shrimp peeled', amount: '160', unit: 'g', normalized_name: 'shrimp' },
        { item: 'Minced fresh garlic & cilantro', amount: '2', unit: 'tbsp', normalized_name: 'garlic' },
        { item: 'Extra virgin olive oil', amount: '1', unit: 'tsp', normalized_name: 'olive oil' }
      ],
      instructions: [
        { step: 1, instruction: 'Heat olive oil in pan and sauté garlic until fragrant.' },
        { step: 2, instruction: 'Add shrimp and toss for 3 minutes until succulent and pink.' },
        { step: 3, instruction: 'Toss in fresh chopped cilantro and serve immediately.' }
      ],
      nutrition: { calories: 320, protein_g: 38, carbs_g: 6, fat_g: 10 },
      dietary_tags: ['Halal', 'Seafood', 'High Protein']
    },
    {
      external_id: 'curated_din_sup_tomat_telur',
      provider: 'curated',
      title: 'Sup Tomat Telur Serabut Lembut',
      image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Asian',
      prep_time_minutes: 5,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Ripe vine tomatoes diced', amount: '150', unit: 'g', normalized_name: 'tomato' },
        { item: 'Eggs whisked', amount: '2', unit: 'pcs', normalized_name: 'egg' },
        { item: 'Scallions and sesame oil', amount: '1', unit: 'tsp', normalized_name: 'scallion' }
      ],
      instructions: [
        { step: 1, instruction: 'Sauté tomatoes until soft and saucy, add 300ml water.' },
        { step: 2, instruction: 'Bring to boil and swirl whisked eggs to form delicate ribbons.' }
      ],
      nutrition: { calories: 220, protein_g: 15, carbs_g: 12, fat_g: 12 },
      dietary_tags: ['Halal', 'Vegetarian', 'Low Calorie']
    },
    {
      external_id: 'curated_din_ayam_sambal_matah',
      provider: 'curated',
      title: 'Ayam Suwir Kukus Sambal Matah Rendah Minyak',
      image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 12,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Steamed halal chicken breast shredded', amount: '160', unit: 'g', normalized_name: 'chicken' },
        { item: 'Lemongrass, shallots, bird eye chili', amount: '3', unit: 'tbsp', normalized_name: 'shallot' },
        { item: 'Coconut oil & lime juice', amount: '1', unit: 'tsp', normalized_name: 'lime' }
      ],
      instructions: [
        { step: 1, instruction: 'Steam chicken breast until juicy, then shred finely.' },
        { step: 2, instruction: 'Thinly slice shallots, lemongrass, and chilies.' },
        { step: 3, instruction: 'Mix aromatics with hot coconut oil and lime juice, toss over chicken.' }
      ],
      nutrition: { calories: 370, protein_g: 44, carbs_g: 8, fat_g: 14 },
      dietary_tags: ['Halal', 'High Protein', 'Traditional']
    },
    {
      external_id: 'curated_din_sayur_bening_bayam',
      provider: 'curated',
      title: 'Sayur Bening Bayam Jagung Manis',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 6,
      servings: 1,
      ingredients: [
        { item: 'Fresh green spinach leaves', amount: '120', unit: 'g', normalized_name: 'spinach' },
        { item: 'Sweet corn cut rounds', amount: '80', unit: 'g', normalized_name: 'corn' },
        { item: 'Shallots and temu kunci', amount: '1', unit: 'piece', normalized_name: 'shallot' }
      ],
      instructions: [
        { step: 1, instruction: 'Boil water with sliced shallots and bruised temu kunci.' },
        { step: 2, instruction: 'Add sweet corn and cook 3 minutes.' },
        { step: 3, instruction: 'Drop spinach leaves in, cook for 1 minute, and season lightly.' }
      ],
      nutrition: { calories: 160, protein_g: 7, carbs_g: 28, fat_g: 2 },
      dietary_tags: ['Halal', 'Vegan', 'Low Calorie']
    },

    // ========================================================================
    // SNACK, DRINK, DESSERT
    // ========================================================================
    {
      external_id: 'curated_snack_edamame_sea_salt',
      provider: 'curated',
      title: 'Edamame Rebus Garam Laut',
      image_url: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&w=800&q=80',
      meal_category: 'snack',
      cuisine: 'Asian',
      prep_time_minutes: 2,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Fresh organic edamame pods', amount: '120', unit: 'g', normalized_name: 'edamame' },
        { item: 'Flaky sea salt', amount: '0.5', unit: 'tsp', normalized_name: 'salt' }
      ],
      instructions: [
        { step: 1, instruction: 'Boil edamame pods in lightly salted water for 5 minutes.' },
        { step: 2, instruction: 'Drain and toss with coarse sea salt.' }
      ],
      nutrition: { calories: 150, protein_g: 14, carbs_g: 10, fat_g: 5 },
      dietary_tags: ['Halal', 'Vegan', 'High Fiber']
    },
    {
      external_id: 'curated_snack_pisang_panggang',
      provider: 'curated',
      title: 'Pisang Panggang Madu Kayu Manis',
      image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
      meal_category: 'snack',
      cuisine: 'Healthy',
      prep_time_minutes: 2,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Ripe banana', amount: '1', unit: 'pc', normalized_name: 'banana' },
        { item: 'Pure honey & ground cinnamon', amount: '1', unit: 'tsp', normalized_name: 'honey' }
      ],
      instructions: [
        { step: 1, instruction: 'Grill banana in non-stick skillet for 3 minutes per side.' },
        { step: 2, instruction: 'Drizzle honey and sprinkle cinnamon before serving warm.' }
      ],
      nutrition: { calories: 140, protein_g: 2, carbs_g: 34, fat_g: 0 },
      dietary_tags: ['Halal', 'Vegetarian', 'Clean']
    },
    {
      external_id: 'curated_drink_wedang_jahe',
      provider: 'curated',
      title: 'Wedang Jahe Lemon Madu Hangat',
      image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80',
      meal_category: 'drink',
      cuisine: 'Indonesian',
      prep_time_minutes: 3,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Bruised fresh red ginger', amount: '2', unit: 'knobs', normalized_name: 'ginger' },
        { item: 'Fresh lemon juice', amount: '1', unit: 'tbsp', normalized_name: 'lemon' },
        { item: 'Pure blossom honey', amount: '1', unit: 'tbsp', normalized_name: 'honey' }
      ],
      instructions: [
        { step: 1, instruction: 'Boil crushed ginger in 250ml water for 5 minutes.' },
        { step: 2, instruction: 'Strain into cup, stir in fresh lemon juice and honey.' }
      ],
      nutrition: { calories: 55, protein_g: 0, carbs_g: 14, fat_g: 0 },
      dietary_tags: ['Halal', 'Immunity Boost', 'Zero Fat']
    },
    {
      external_id: 'curated_drink_green_matcha_tea',
      provider: 'curated',
      title: 'Teh Hijau Matcha Hangat Antioksidan',
      image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',
      meal_category: 'drink',
      cuisine: 'Japanese',
      prep_time_minutes: 2,
      cook_time_minutes: 0,
      servings: 1,
      ingredients: [
        { item: 'Ceremonial matcha green tea powder', amount: '2', unit: 'g', normalized_name: 'matcha' },
        { item: 'Warm filtered water (80°C)', amount: '200', unit: 'ml', normalized_name: 'water' }
      ],
      instructions: [
        { step: 1, instruction: 'Sift matcha into ceramic cup.' },
        { step: 2, instruction: 'Whisk in warm water until frothy and smooth.' }
      ],
      nutrition: { calories: 15, protein_g: 1, carbs_g: 2, fat_g: 0 },
      dietary_tags: ['Halal', 'Antioxidant', 'Zero Sugar']
    },
    {
      external_id: 'curated_dessert_chia_mango_parfait',
      provider: 'curated',
      title: 'Puding Chia Mangga Santan Sehat',
      image_url: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dessert',
      cuisine: 'Tropical',
      prep_time_minutes: 5,
      cook_time_minutes: 0,
      servings: 1,
      ingredients: [
        { item: 'Organic chia seeds', amount: '25', unit: 'g', normalized_name: 'chia' },
        { item: 'Light coconut milk', amount: '120', unit: 'ml', normalized_name: 'coconut milk' },
        { item: 'Fresh sweet mango puree', amount: '50', unit: 'g', normalized_name: 'mango' }
      ],
      instructions: [
        { step: 1, instruction: 'Soak chia seeds in light coconut milk for 30 minutes.' },
        { step: 2, instruction: 'Top with freshly pureed sweet mango.' }
      ],
      nutrition: { calories: 180, protein_g: 5, carbs_g: 22, fat_g: 7 },
      dietary_tags: ['Halal', 'Vegan', 'Dairy Free']
    }
  ];

  public async searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]> {
    return this.catalog.filter(r => {
      if (criteria.meal_category && r.meal_category !== criteria.meal_category) {
        return false;
      }
      return true;
    });
  }

  public async getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null> {
    return this.catalog.find(r => r.external_id === externalId) || null;
  }
}
