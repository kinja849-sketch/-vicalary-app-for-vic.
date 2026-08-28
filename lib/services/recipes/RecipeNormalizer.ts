import { AuthoritativeRecipe, Ingredient, Instruction, MealCategory, Nutrition } from './RecipeProvider';

export function normalizeRecipePayload(raw: any, defaultCategory: MealCategory = 'lunch', provider = 'spoonacular'): AuthoritativeRecipe {
  // 1. Ingredients normalization
  const ingredients: Ingredient[] = [];
  if (Array.isArray(raw.extendedIngredients)) {
    raw.extendedIngredients.forEach((ing: any) => {
      ingredients.push({
        item: ing.name || ing.originalName || ing.original || 'Ingredient',
        amount: ing.amount || 1,
        unit: ing.unit || '',
        normalized_name: (ing.nameClean || ing.name || '').toLowerCase()
      });
    });
  } else if (Array.isArray(raw.ingredients)) {
    raw.ingredients.forEach((ing: any) => {
      if (typeof ing === 'string') {
        ingredients.push({ item: ing, amount: '', unit: '' });
      } else {
        ingredients.push({
          item: ing.item || ing.name || 'Ingredient',
          amount: ing.amount || '',
          unit: ing.unit || ''
        });
      }
    });
  }

  // 2. Instructions normalization
  const instructions: Instruction[] = [];
  if (Array.isArray(raw.analyzedInstructions) && raw.analyzedInstructions.length > 0 && Array.isArray(raw.analyzedInstructions[0].steps)) {
    raw.analyzedInstructions[0].steps.forEach((s: any, idx: number) => {
      instructions.push({
        step: s.number || idx + 1,
        instruction: s.step || String(s)
      });
    });
  } else if (Array.isArray(raw.instructions)) {
    raw.instructions.forEach((s: any, idx: number) => {
      instructions.push({
        step: typeof s === 'object' && s.step ? s.step : idx + 1,
        instruction: typeof s === 'object' && s.instruction ? s.instruction : String(s)
      });
    });
  } else if (typeof raw.instructions === 'string') {
    raw.instructions.split(/\r?\n+/).forEach((line: string, idx: number) => {
      const clean = line.replace(/^\d+[\.\)]\s*/, '').trim();
      if (clean) instructions.push({ step: idx + 1, instruction: clean });
    });
  }

  // 3. Nutrition normalization
  const calories = raw.nutrition?.calories || raw.calories || raw.total_calories || (raw.nutrition?.nutrients?.find((n: any) => n.name === 'Calories')?.amount) || 400;
  const protein_g = raw.nutrition?.protein || raw.protein_g || (raw.nutrition?.nutrients?.find((n: any) => n.name === 'Protein')?.amount) || 20;
  const carbs_g = raw.nutrition?.carbs || raw.carbs_g || (raw.nutrition?.nutrients?.find((n: any) => n.name === 'Carbohydrates')?.amount) || 30;
  const fat_g = raw.nutrition?.fat || raw.fat_g || (raw.nutrition?.nutrients?.find((n: any) => n.name === 'Fat')?.amount) || 10;

  const nutrition: Nutrition = {
    calories: Math.round(Number(calories)),
    protein_g: Math.round(Number(protein_g)),
    carbs_g: Math.round(Number(carbs_g)),
    fat_g: Math.round(Number(fat_g))
  };

  return {
    id: raw.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.id) ? raw.id : undefined,
    external_id: String(raw.external_id || raw.id || `rec_${Date.now()}`),
    provider,
    title: raw.title || raw.name || 'Untitled Dish',
    description: raw.description || raw.summary || '',
    image_url: raw.image || raw.image_url || raw.strMealThumb || '',
    meal_category: raw.meal_category || defaultCategory,
    cuisine: raw.cuisine || raw.cuisine_type || raw.strArea || 'International',
    prep_time_minutes: Number(raw.readyInMinutes || raw.prep_time_minutes || 15),
    cook_time_minutes: Number(raw.cook_time_minutes || 15),
    servings: Number(raw.servings || 2),
    ingredients,
    instructions: instructions.length > 0 ? instructions : [{ step: 1, instruction: 'Prepare ingredients and cook until done.' }],
    nutrition,
    dietary_tags: Array.isArray(raw.dietary_tags) ? raw.dietary_tags : (raw.diets || []),
    clinical_justification: raw.clinical_justification || ''
  };
}
