export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'dessert';

export interface Ingredient {
  item: string;
  amount: string | number;
  unit: string;
  normalized_name?: string;
  allergen_groups?: string[];
}

export interface Instruction {
  step: number;
  instruction: string;
}

export interface Nutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface AuthoritativeRecipe {
  id?: string; // Canonical Supabase UUID
  external_id: string; // Provider-specific ID (e.g. 'spoonacular_12345' or 'curated_ayam_bakar')
  provider: string; // 'spoonacular' | 'curated' | 'edamam' | 'themealdb'
  title: string;
  description?: string;
  image_url: string;
  meal_category: MealCategory;
  cuisine: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  nutrition: Nutrition;
  dietary_tags: string[];
  clinical_justification?: string;
  source_url?: string;
}

export interface RecipeSearchCriteria {
  query?: string;
  meal_category: MealCategory;
  cuisine?: string;
  dietary_lifestyle?: string[];
  allergies?: string[];
  disliked_foods?: string[];
  target_calories?: number;
  min_calories?: number;
  max_calories?: number;
  limit?: number;
}

export interface RecipeProvider {
  name: string;
  searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]>;
  getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null>;
}
