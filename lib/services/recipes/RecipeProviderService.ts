import { AuthoritativeRecipe, MealCategory, RecipeProvider, RecipeSearchCriteria } from './RecipeProvider';
import { TheMealDBRecipeProvider } from './TheMealDBRecipeProvider';
import { CuratedRecipeProvider } from './CuratedRecipeProvider';

export interface NormalizedRecipe {
  id: string;
  externalId: string;
  sourceProvider: 'curated' | 'themealdb' | 'database';
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
  halalStatus: 'HALAL_VERIFIED' | 'HARAM_DETECTED' | 'HALAL_UNVERIFIED';
}

export class RecipeProviderService {
  private static instance: RecipeProviderService;
  private providers: RecipeProvider[] = [];

  private constructor() {
    this.providers.push(new CuratedRecipeProvider());
    this.providers.push(new TheMealDBRecipeProvider());
  }

  public static getInstance(): RecipeProviderService {
    if (!RecipeProviderService.instance) {
      RecipeProviderService.instance = new RecipeProviderService();
    }
    return RecipeProviderService.instance;
  }

  /**
   * Searches recipes across active providers (Curated Halal Catalog + TheMealDB).
   */
  public async searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]> {
    const combined: AuthoritativeRecipe[] = [];

    for (const provider of this.providers) {
      try {
        const results = await provider.searchRecipes(criteria);
        if (Array.isArray(results) && results.length > 0) {
          combined.push(...results);
        }
      } catch (providerErr) {
        console.warn(`[RecipeProviderService] Provider ${provider.name} failed:`, providerErr);
      }
    }

    return combined;
  }

  /**
   * Retrieves an authoritative recipe by external ID across registered providers.
   */
  public async getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null> {
    for (const provider of this.providers) {
      try {
        const recipe = await provider.getRecipeById(externalId);
        if (recipe) return recipe;
      } catch (err) {
        console.warn(`[RecipeProviderService] Error querying ${provider.name} for ${externalId}:`, err);
      }
    }
    return null;
  }
}

export type { RecipeProvider };
