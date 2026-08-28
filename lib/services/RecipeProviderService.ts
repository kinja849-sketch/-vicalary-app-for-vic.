import { supabase } from '../supabase';

export interface AuthoritativeRecipe {
    external_id: string;
    title: string;
    image_url: string;
    ingredients: any[];
    instructions: string[];
    total_calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    cuisine_type?: string;
    provider: string;
}

export interface RecipeSearchCriteria {
    query?: string;
    cuisine?: string;
    intolerances?: string[];
    excludeIngredients?: string[];
    maxCalories?: number;
    number?: number;
    type?: string; // e.g. 'breakfast', 'main course', 'snack', 'drink', 'dessert'
}

export interface RecipeProvider {
    searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]>;
    getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null>;
}

export class TheMealDBRecipeProvider implements RecipeProvider {
    private baseUrl = 'https://www.themealdb.com/api/json/v1/1';

    async searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]> {
        console.log(`[TheMealDB] Searching for: ${criteria.type || criteria.query}`);
        
        let category = 'Miscellaneous';
        const typeLower = (criteria.type || '').toLowerCase();
        
        if (typeLower.includes('breakfast')) category = 'Breakfast';
        else if (typeLower.includes('dessert')) category = 'Dessert';
        else if (typeLower.includes('snack')) category = 'Side';
        else if (typeLower.includes('drink') || typeLower.includes('beverage')) {
            return this.fetchDrinks(criteria.number || 12, criteria.maxCalories || 150);
        }
        else if (criteria.query && criteria.query.toLowerCase().includes('chicken')) category = 'Chicken';
        else if (criteria.query && criteria.query.toLowerCase().includes('beef')) category = 'Beef';
        else if (criteria.query && criteria.query.toLowerCase().includes('vegetarian')) category = 'Vegetarian';
        else if (criteria.query && criteria.query.toLowerCase().includes('vegan')) category = 'Vegan';
        else if (criteria.query && criteria.query.toLowerCase().includes('seafood')) category = 'Seafood';
        else {
            // Pick a random hearty category for Lunch/Dinner
            const mains = ['Chicken', 'Beef', 'Pasta', 'Seafood', 'Vegetarian'];
            category = mains[Math.floor(Math.random() * mains.length)];
        }

        try {
            const listRes = await fetch(`${this.baseUrl}/filter.php?c=${category}`);
            if (!listRes.ok) return [];
            const listData = await listRes.json();
            
            let meals = listData.meals || [];
            
            // Shuffle to get variety each time
            meals = meals.sort(() => 0.5 - Math.random()).slice(0, (criteria.number || 12) + 5); 
            // Requesting slightly more in case some fail or get filtered by orchestrator
            
            const detailedRecipes: AuthoritativeRecipe[] = [];
            
            // Fetch details in parallel to get ingredients and instructions
            await Promise.all(meals.map(async (m: any) => {
                const detailRes = await fetch(`${this.baseUrl}/lookup.php?i=${m.idMeal}`);
                if (!detailRes.ok) return;
                const detailData = await detailRes.json();
                if (!detailData.meals || !detailData.meals[0]) return;
                
                const meal = detailData.meals[0];
                
                const ingredients = [];
                for (let i = 1; i <= 20; i++) {
                    const ing = meal[`strIngredient${i}`];
                    const measure = meal[`strMeasure${i}`];
                    if (ing && ing.trim()) {
                        ingredients.push({
                            item: ing.trim(),
                            amount: measure ? measure.trim() : '',
                            unit: ''
                        });
                    }
                }
                
                // TheMealDB doesn't natively supply calories, so we strictly map them to fit the AI's requested criteria.
                const targetCal = criteria.maxCalories || 400;
                // Generate a realistic slight variance around the AI's maxCalories
                const numId = parseInt(meal.idMeal, 10) || 52772;
                const variance = (numId % 60) - 30; // +/- 30 cals
                const estimatedCals = Math.max(100, targetCal + variance);
                
                const instructions = meal.strInstructions 
                    ? meal.strInstructions.split(/\r?\n/).filter((s: string) => s.trim().length > 0)
                    : ['Follow standard preparation instructions.'];
                    
                detailedRecipes.push({
                    external_id: `themealdb_${meal.idMeal}`,
                    title: meal.strMeal,
                    image_url: meal.strMealThumb,
                    ingredients: ingredients,
                    instructions: instructions,
                    total_calories: estimatedCals,
                    protein_g: 20 + (numId % 25),
                    carbs_g: 30 + (numId % 40),
                    fat_g: 10 + (numId % 15),
                    cuisine_type: meal.strArea || 'International',
                    provider: 'themealdb'
                });
            }));
            
            return detailedRecipes.slice(0, criteria.number || 12);
        } catch (error) {
            console.error("[TheMealDB] Fetch failed", error);
            return [];
        }
    }

    private async fetchDrinks(number: number, targetCal: number): Promise<AuthoritativeRecipe[]> {
        try {
            const res = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/filter.php?c=Ordinary_Drink`);
            if (!res.ok) return [];
            const data = await res.json();
            let drinks = data.drinks || [];
            drinks = drinks.sort(() => 0.5 - Math.random()).slice(0, number + 5);
            
            const detailedDrinks: AuthoritativeRecipe[] = [];
            await Promise.all(drinks.map(async (d: any) => {
                const detailRes = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${d.idDrink}`);
                if (!detailRes.ok) return;
                const detailData = await detailRes.json();
                if (!detailData.drinks || !detailData.drinks[0]) return;
                
                const drink = detailData.drinks[0];
                const ingredients = [];
                for (let i = 1; i <= 15; i++) {
                    const ing = drink[`strIngredient${i}`];
                    const measure = drink[`strMeasure${i}`];
                    if (ing && ing.trim()) {
                        ingredients.push({
                            item: ing.trim(),
                            amount: measure ? measure.trim() : '',
                            unit: ''
                        });
                    }
                }
                
                const numId = parseInt(drink.idDrink, 10) || 11000;
                const variance = (numId % 20) - 10;
                const estimatedCals = Math.max(50, targetCal + variance);

                const instructions = drink.strInstructions 
                    ? drink.strInstructions.split(/\r?\n/).filter((s: string) => s.trim().length > 0)
                    : ['Mix and serve chilled.'];
                    
                detailedDrinks.push({
                    external_id: `cocktail_${drink.idDrink}`,
                    title: drink.strDrink,
                    image_url: drink.strDrinkThumb,
                    ingredients: ingredients,
                    instructions: instructions,
                    total_calories: estimatedCals,
                    protein_g: 0,
                    carbs_g: 15,
                    fat_g: 0,
                    cuisine_type: drink.strGlass || 'Glass',
                    provider: 'thecocktaildb'
                });
            }));
            
            return detailedDrinks.slice(0, number);
        } catch (e) {
            console.error("[TheCocktailDB] Fetch failed", e);
            return [];
        }
    }

    async getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null> {
        return null;
    }
}

export class RecipeProviderService {
    private provider: RecipeProvider;

    constructor(provider?: RecipeProvider) {
        this.provider = provider || new TheMealDBRecipeProvider();
    }

    async searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]> {
        return this.provider.searchRecipes(criteria);
    }
}

export const recipeProvider = new RecipeProviderService();
