import { AuthoritativeRecipe, RecipeProvider, RecipeSearchCriteria } from './RecipeProvider';
import { normalizeRecipePayload } from './RecipeNormalizer';

export class SpoonacularRecipeProvider implements RecipeProvider {
  public name = 'spoonacular';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SPOONACULAR_API_KEY || process.env.NEXT_PUBLIC_SPOONACULAR_API_KEY || '';
  }

  public isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 5;
  }

  public async searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]> {
    if (!this.isConfigured()) return [];

    try {
      const typeParam = criteria.meal_category === 'breakfast' ? 'breakfast'
        : criteria.meal_category === 'lunch' || criteria.meal_category === 'dinner' ? 'main course'
        : criteria.meal_category === 'snack' ? 'snack'
        : criteria.meal_category === 'drink' ? 'beverage'
        : criteria.meal_category === 'dessert' ? 'dessert' : 'main course';

      const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('type', typeParam);
      url.searchParams.set('addRecipeInformation', 'true');
      url.searchParams.set('addRecipeNutrition', 'true');
      url.searchParams.set('fillIngredients', 'true');
      url.searchParams.set('number', String(criteria.limit || 12));

      if (criteria.query) url.searchParams.set('query', criteria.query);
      if (criteria.cuisine) url.searchParams.set('cuisine', criteria.cuisine);
      if (criteria.allergies && criteria.allergies.length > 0) {
        const intolerances = criteria.allergies.filter(a => a && a !== 'none').join(',');
        if (intolerances) url.searchParams.set('intolerances', intolerances);
      }
      if (criteria.min_calories) url.searchParams.set('minCalories', String(criteria.min_calories));
      if (criteria.max_calories) url.searchParams.set('maxCalories', String(criteria.max_calories));

      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) {
        console.warn(`[SpoonacularProvider] HTTP ${res.status}: ${await res.text()}`);
        return [];
      }

      const data = await res.json();
      if (!data?.results || !Array.isArray(data.results)) return [];

      return data.results.map((item: any) => normalizeRecipePayload(item, criteria.meal_category, 'spoonacular'));
    } catch (err) {
      console.warn('[SpoonacularProvider] search error:', err);
      return [];
    }
  }

  public async getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null> {
    if (!this.isConfigured()) return null;

    try {
      const cleanId = externalId.replace(/^spoonacular_/i, '');
      const url = `https://api.spoonacular.com/recipes/${cleanId}/information?includeNutrition=true&apiKey=${this.apiKey}`;
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) return null;

      const data = await res.json();
      return normalizeRecipePayload(data, 'lunch', 'spoonacular');
    } catch (err) {
      console.warn('[SpoonacularProvider] getRecipeById error:', err);
      return null;
    }
  }
}
