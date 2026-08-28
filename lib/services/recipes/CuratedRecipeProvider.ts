import { AuthoritativeRecipe, MealCategory, RecipeProvider, RecipeSearchCriteria } from './RecipeProvider';

export class CuratedRecipeProvider implements RecipeProvider {
  public name = 'curated';

  private catalog: AuthoritativeRecipe[] = [
    // BREAKFAST
    {
      external_id: 'curated_bf_turmeric_oats',
      provider: 'curated',
      title: 'Savory Turmeric Chicken Oatmeal',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Rolled oats', amount: '50', unit: 'g', normalized_name: 'oat' },
        { item: 'Shredded chicken breast', amount: '100', unit: 'g', normalized_name: 'chicken' },
        { item: 'Turmeric chicken broth', amount: '250', unit: 'ml', normalized_name: 'chicken broth' },
        { item: 'Garlic & scallions', amount: '1', unit: 'tbsp', normalized_name: 'garlic' }
      ],
      instructions: [
        { step: 1, instruction: 'Simmer turmeric broth and garlic in a small pot.' },
        { step: 2, instruction: 'Stir in oats and cook for 3-4 minutes until smooth.' },
        { step: 3, instruction: 'Pour into serving bowl and top with shredded chicken and scallions.' }
      ],
      nutrition: { calories: 380, protein_g: 28, carbs_g: 42, fat_g: 8 },
      dietary_tags: ['High Protein', 'Halal']
    },
    {
      external_id: 'curated_bf_spinach_tofu_omelette',
      provider: 'curated',
      title: 'Spinach & Tofu Garlic Omelette',
      image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Asian',
      prep_time_minutes: 5,
      cook_time_minutes: 8,
      servings: 1,
      ingredients: [
        { item: 'Eggs', amount: '2', unit: 'pcs', normalized_name: 'egg' },
        { item: 'Firm tofu', amount: '60', unit: 'g', normalized_name: 'tofu' },
        { item: 'Baby spinach', amount: '40', unit: 'g', normalized_name: 'spinach' },
        { item: 'Olive oil', amount: '1', unit: 'tsp', normalized_name: 'olive oil' }
      ],
      instructions: [
        { step: 1, instruction: 'Whisk eggs with a pinch of sea salt and black pepper.' },
        { step: 2, instruction: 'Sauté garlic, diced tofu, and spinach in a pan for 1 minute.' },
        { step: 3, instruction: 'Pour whisked eggs over pan and cook on low heat until set.' }
      ],
      nutrition: { calories: 340, protein_g: 24, carbs_g: 8, fat_g: 14 },
      dietary_tags: ['High Protein', 'Gluten Free']
    },
    {
      external_id: 'curated_bf_brown_rice_egg',
      provider: 'curated',
      title: 'Brown Rice with Sunny Egg & Fresh Cucumber',
      image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Indonesian',
      prep_time_minutes: 5,
      cook_time_minutes: 10,
      servings: 1,
      ingredients: [
        { item: 'Cooked brown rice', amount: '120', unit: 'g', normalized_name: 'rice' },
        { item: 'Egg', amount: '1', unit: 'pc', normalized_name: 'egg' },
        { item: 'Cucumber & tomato', amount: '60', unit: 'g', normalized_name: 'cucumber' }
      ],
      instructions: [
        { step: 1, instruction: 'Plate warm steamed brown rice.' },
        { step: 2, instruction: 'Fry egg sunny side up until white is set.' },
        { step: 3, instruction: 'Serve egg on rice with fresh cucumber slices.' }
      ],
      nutrition: { calories: 410, protein_g: 18, carbs_g: 52, fat_g: 10 },
      dietary_tags: ['Complex Carbs', 'Vegetarian']
    },
    {
      external_id: 'curated_bf_avocado_toast',
      provider: 'curated',
      title: 'Whole Grain Avocado Toast with Soft Egg',
      image_url: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=800&q=80',
      meal_category: 'breakfast',
      cuisine: 'Western',
      prep_time_minutes: 5,
      cook_time_minutes: 7,
      servings: 1,
      ingredients: [
        { item: 'Whole wheat toast', amount: '2', unit: 'slices', normalized_name: 'wheat' },
        { item: 'Ripe avocado', amount: '50', unit: 'g', normalized_name: 'avocado' },
        { item: 'Boiled egg', amount: '1', unit: 'pc', normalized_name: 'egg' }
      ],
      instructions: [
        { step: 1, instruction: 'Toast bread slices until golden brown.' },
        { step: 2, instruction: 'Mash avocado with lemon juice and spread across toast.' },
        { step: 3, instruction: 'Top with sliced boiled egg and cracked pepper.' }
      ],
      nutrition: { calories: 370, protein_g: 18, carbs_g: 35, fat_g: 14 },
      dietary_tags: ['Healthy Fats']
    },

    // LUNCH
    {
      external_id: 'curated_lunch_ayam_bakar_rujak',
      provider: 'curated',
      title: 'Grilled Turmeric Chicken with Brown Rice',
      image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Chicken breast', amount: '160', unit: 'g', normalized_name: 'chicken' },
        { item: 'Brown rice', amount: '120', unit: 'g', normalized_name: 'rice' },
        { item: 'Shallots, garlic, turmeric', amount: '2', unit: 'tbsp', normalized_name: 'shallot' },
        { item: 'Steamed green beans', amount: '60', unit: 'g', normalized_name: 'green beans' }
      ],
      instructions: [
        { step: 1, instruction: 'Marinate chicken in blended turmeric, shallots, and garlic paste.' },
        { step: 2, instruction: 'Grill chicken on cast iron pan until caramelized and cooked through.' },
        { step: 3, instruction: 'Serve with steamed brown rice and tender green beans.' }
      ],
      nutrition: { calories: 580, protein_g: 46, carbs_g: 58, fat_g: 12 },
      dietary_tags: ['High Protein', 'Halal']
    },
    {
      external_id: 'curated_lunch_pepes_tahu_jamur',
      provider: 'curated',
      title: 'Steamed Herb Tofu & Mushroom in Banana Leaf',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'White tofu', amount: '180', unit: 'g', normalized_name: 'tofu' },
        { item: 'Oyster mushrooms', amount: '60', unit: 'g', normalized_name: 'mushroom' },
        { item: 'Lemon basil (kemangi)', amount: '20', unit: 'g', normalized_name: 'basil' },
        { item: 'Steamed red rice', amount: '120', unit: 'g', normalized_name: 'rice' }
      ],
      instructions: [
        { step: 1, instruction: 'Mash tofu and mix with sliced mushrooms, aromatics, and basil.' },
        { step: 2, instruction: 'Wrap securely in banana leaf or parchment paper.' },
        { step: 3, instruction: 'Steam for 15 minutes until fragrant and set.' }
      ],
      nutrition: { calories: 460, protein_g: 26, carbs_g: 56, fat_g: 10 },
      dietary_tags: ['Vegan', 'Plant-Based', 'Halal']
    },
    {
      external_id: 'curated_lunch_soto_ayam_bening',
      provider: 'curated',
      title: 'Aromatic Clear Chicken Soto Broth',
      image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
      meal_category: 'lunch',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Shredded chicken breast', amount: '140', unit: 'g', normalized_name: 'chicken' },
        { item: 'Lemongrass turmeric broth', amount: '350', unit: 'ml', normalized_name: 'chicken broth' },
        { item: 'Bean sprouts & cabbage', amount: '80', unit: 'g', normalized_name: 'cabbage' },
        { item: 'Steamed rice', amount: '100', unit: 'g', normalized_name: 'rice' }
      ],
      instructions: [
        { step: 1, instruction: 'Simmer chicken breast with lemongrass, kaffir lime leaves, and turmeric.' },
        { step: 2, instruction: 'Shred cooked chicken and blanch cabbage and bean sprouts.' },
        { step: 3, instruction: 'Assemble in bowl, pour boiling clear broth over, and garnish with lime.' }
      ],
      nutrition: { calories: 510, protein_g: 40, carbs_g: 54, fat_g: 10 },
      dietary_tags: ['Hydrating', 'Halal']
    },

    // DINNER
    {
      external_id: 'curated_din_chicken_teriyaki_quinoa',
      provider: 'curated',
      title: 'Glazed Chicken Teriyaki with Quinoa & Broccoli',
      image_url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Japanese',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 1,
      ingredients: [
        { item: 'Chicken breast fillet', amount: '150', unit: 'g', normalized_name: 'chicken' },
        { item: 'Cooked quinoa', amount: '110', unit: 'g', normalized_name: 'quinoa' },
        { item: 'Steamed broccoli', amount: '90', unit: 'g', normalized_name: 'broccoli' },
        { item: 'Low-sodium teriyaki sauce', amount: '1.5', unit: 'tbsp', normalized_name: 'teriyaki' }
      ],
      instructions: [
        { step: 1, instruction: 'Sear chicken fillet in a pan for 4 minutes per side.' },
        { step: 2, instruction: 'Brush with teriyaki glaze and reduce sauce to light syrup.' },
        { step: 3, instruction: 'Slice chicken and plate over warm quinoa with steamed broccoli.' }
      ],
      nutrition: { calories: 490, protein_g: 44, carbs_g: 46, fat_g: 10 },
      dietary_tags: ['High Protein', 'Balanced']
    },
    {
      external_id: 'curated_din_sup_ayam_wortel_kentang',
      provider: 'curated',
      title: 'Hearty Chicken & Garden Vegetable Stew',
      image_url: 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dinner',
      cuisine: 'Indonesian',
      prep_time_minutes: 10,
      cook_time_minutes: 20,
      servings: 1,
      ingredients: [
        { item: 'Chicken breast cubes', amount: '140', unit: 'g', normalized_name: 'chicken' },
        { item: 'Baby carrots & potatoes', amount: '100', unit: 'g', normalized_name: 'carrot' },
        { item: 'Garlic celery broth', amount: '350', unit: 'ml', normalized_name: 'chicken broth' }
      ],
      instructions: [
        { step: 1, instruction: 'Sauté garlic and shallots in 1 tsp olive oil until fragrant.' },
        { step: 2, instruction: 'Add chicken, carrots, and potatoes with water or broth.' },
        { step: 3, instruction: 'Simmer on low for 15-20 minutes until vegetables are tender.' }
      ],
      nutrition: { calories: 430, protein_g: 38, carbs_g: 40, fat_g: 9 },
      dietary_tags: ['Comfort Food', 'Halal']
    },

    // SNACK
    {
      external_id: 'curated_snack_edamame_sea_salt',
      provider: 'curated',
      title: 'Steamed Organic Edamame with Sea Salt',
      image_url: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?auto=format&fit=crop&w=800&q=80',
      meal_category: 'snack',
      cuisine: 'Asian',
      prep_time_minutes: 2,
      cook_time_minutes: 5,
      servings: 1,
      ingredients: [
        { item: 'Fresh edamame pods', amount: '120', unit: 'g', normalized_name: 'edamame' },
        { item: 'Flaky sea salt', amount: '0.5', unit: 'tsp', normalized_name: 'salt' }
      ],
      instructions: [
        { step: 1, instruction: 'Boil or steam edamame pods in lightly salted water for 4-5 minutes.' },
        { step: 2, instruction: 'Drain thoroughly, sprinkle with sea salt, and serve warm.' }
      ],
      nutrition: { calories: 150, protein_g: 14, carbs_g: 10, fat_g: 5 },
      dietary_tags: ['Vegan', 'High Fiber']
    },

    // DRINK
    {
      external_id: 'curated_drink_green_matcha_tea',
      provider: 'curated',
      title: 'Antioxidant Ceremonial Green Matcha Infusion',
      image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80',
      meal_category: 'drink',
      cuisine: 'Japanese',
      prep_time_minutes: 2,
      cook_time_minutes: 0,
      servings: 1,
      ingredients: [
        { item: 'Ceremonial matcha powder', amount: '2', unit: 'g', normalized_name: 'matcha' },
        { item: 'Warm filtered water (80°C)', amount: '200', unit: 'ml', normalized_name: 'water' }
      ],
      instructions: [
        { step: 1, instruction: 'Sift matcha powder into a ceremonial tea bowl.' },
        { step: 2, instruction: 'Pour hot water (80°C) and whisk in zigzag motion until frothy.' }
      ],
      nutrition: { calories: 15, protein_g: 1, carbs_g: 2, fat_g: 0 },
      dietary_tags: ['Antioxidant', 'Zero Sugar']
    },

    // DESSERT
    {
      external_id: 'curated_dessert_chia_mango_parfait',
      provider: 'curated',
      title: 'Tropical Mango Chia Seed Pudding',
      image_url: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
      meal_category: 'dessert',
      cuisine: 'Tropical',
      prep_time_minutes: 5,
      cook_time_minutes: 0,
      servings: 1,
      ingredients: [
        { item: 'Chia seeds', amount: '25', unit: 'g', normalized_name: 'chia' },
        { item: 'Almond or coconut milk', amount: '120', unit: 'ml', normalized_name: 'almond milk' },
        { item: 'Fresh sweet mango puree', amount: '50', unit: 'g', normalized_name: 'mango' }
      ],
      instructions: [
        { step: 1, instruction: 'Stir chia seeds into plant milk and chill for 2 hours until gelled.' },
        { step: 2, instruction: 'Layer with fresh mango puree and serve chilled.' }
      ],
      nutrition: { calories: 180, protein_g: 5, carbs_g: 22, fat_g: 7 },
      dietary_tags: ['Dairy Free', 'Vegan']
    }
  ];

  public async searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]> {
    return this.catalog.filter(r => r.meal_category === criteria.meal_category);
  }

  public async getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null> {
    return this.catalog.find(r => r.external_id === externalId) || null;
  }
}
