import { AuthoritativeRecipe, RecipeProvider, RecipeSearchCriteria } from './RecipeProvider';
import { SpoonacularRecipeProvider } from './SpoonacularRecipeProvider';
import { CuratedRecipeProvider } from './CuratedRecipeProvider';

export class RecipeProviderService {
  private static instance: RecipeProviderService;
  private providers: RecipeProvider[] = [];

  private constructor() {
    this.providers.push(new SpoonacularRecipeProvider());
    this.providers.push(new CuratedRecipeProvider());
  }

  public static getInstance(): RecipeProviderService {
    if (!RecipeProviderService.instance) {
      RecipeProviderService.instance = new RecipeProviderService();
    }
    return RecipeProviderService.instance;
  }

  /**
   * Searches recipes across active providers with fallback support.
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
