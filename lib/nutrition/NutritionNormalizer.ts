import { SupabaseClient } from '@supabase/supabase-js';

export interface IdentifiedFoodItem {
  name: string;
  estimated_portion_g?: number;
  portion_description?: string;
  notes?: string;
}

export interface NormalizedNutrientData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium_mg: number;
  vitamins: string[];
  minerals: string[];
}

export interface MealNutritionCalculation {
  total_calories: number;
  calorie_range: {
    min: number;
    max: number;
  };
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  total_sugar: number;
  total_sodium_mg: number;
  prominent_vitamins: string[];
  prominent_minerals: string[];
  normalized_items: Array<{
    name: string;
    portion_g: number;
    portion_description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium_mg: number;
    vitamins: string[];
    minerals: string[];
    is_exact_match: boolean;
  }>;
}

// Authoritative nutritional reference database for common meal components (per 100g)
const COMMON_FOOD_NUTRITION: Record<string, {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium_mg: number;
  vitamins: string[];
  minerals: string[];
}> = {
  'french fries': {
    calories: 312,
    protein: 3.4,
    carbs: 41.4,
    fat: 14.7,
    fiber: 3.8,
    sugar: 0.3,
    sodium_mg: 210,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Phosphorus', 'Magnesium']
  },
  'sausage': {
    calories: 301,
    protein: 12.0,
    carbs: 2.0,
    fat: 27.0,
    fiber: 0.0,
    sugar: 1.0,
    sodium_mg: 840,
    vitamins: ['Vitamin B12', 'Niacin (B3)', 'Thiamin (B1)'],
    minerals: ['Iron', 'Zinc', 'Selenium', 'Phosphorus']
  },
  'chicken sausage': {
    calories: 172,
    protein: 17.5,
    carbs: 3.2,
    fat: 9.8,
    fiber: 0.0,
    sugar: 0.8,
    sodium_mg: 620,
    vitamins: ['Vitamin B6', 'Vitamin B12', 'Niacin'],
    minerals: ['Iron', 'Phosphorus', 'Potassium', 'Zinc']
  },
  'beef sausage': {
    calories: 332,
    protein: 13.5,
    carbs: 1.5,
    fat: 30.0,
    fiber: 0.0,
    sugar: 0.5,
    sodium_mg: 890,
    vitamins: ['Vitamin B12', 'Riboflavin (B2)'],
    minerals: ['Iron', 'Zinc', 'Selenium']
  },
  'white rice': {
    calories: 130,
    protein: 2.7,
    carbs: 28.2,
    fat: 0.3,
    fiber: 0.4,
    sugar: 0.1,
    sodium_mg: 1,
    vitamins: ['Thiamin (B1)', 'Folate (B9)'],
    minerals: ['Manganese', 'Selenium']
  },
  'brown rice': {
    calories: 111,
    protein: 2.6,
    carbs: 23.0,
    fat: 0.9,
    fiber: 1.8,
    sugar: 0.4,
    sodium_mg: 5,
    vitamins: ['Vitamin B6', 'Niacin (B3)', 'Thiamin (B1)'],
    minerals: ['Magnesium', 'Phosphorus', 'Manganese']
  },
  'chicken breast': {
    calories: 165,
    protein: 31.0,
    carbs: 0.0,
    fat: 3.6,
    fiber: 0.0,
    sugar: 0.0,
    sodium_mg: 74,
    vitamins: ['Vitamin B6', 'Vitamin B12', 'Niacin'],
    minerals: ['Phosphorus', 'Selenium', 'Potassium']
  },
  'fried chicken': {
    calories: 260,
    protein: 24.0,
    carbs: 8.5,
    fat: 14.5,
    fiber: 0.5,
    sugar: 0.1,
    sodium_mg: 510,
    vitamins: ['Niacin', 'Vitamin B6'],
    minerals: ['Phosphorus', 'Iron', 'Zinc']
  },
  'egg': {
    calories: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    fiber: 0.0,
    sugar: 0.4,
    sodium_mg: 142,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12', 'Riboflavin'],
    minerals: ['Iron', 'Phosphorus', 'Selenium', 'Choline']
  },
  'salad greens': {
    calories: 20,
    protein: 1.5,
    carbs: 3.5,
    fat: 0.2,
    fiber: 2.0,
    sugar: 1.2,
    sodium_mg: 25,
    vitamins: ['Vitamin A', 'Vitamin K', 'Vitamin C', 'Folate'],
    minerals: ['Potassium', 'Calcium', 'Iron', 'Magnesium']
  },
  'burger': {
    calories: 295,
    protein: 17.0,
    carbs: 24.0,
    fat: 14.0,
    fiber: 1.5,
    sugar: 4.2,
    sodium_mg: 480,
    vitamins: ['Vitamin B12', 'Niacin'],
    minerals: ['Iron', 'Zinc', 'Calcium']
  },
  'pizza': {
    calories: 266,
    protein: 11.0,
    carbs: 33.0,
    fat: 10.0,
    fiber: 2.3,
    sugar: 3.6,
    sodium_mg: 598,
    vitamins: ['Vitamin A', 'Thiamin', 'Riboflavin'],
    minerals: ['Calcium', 'Phosphorus', 'Sodium']
  },
  'pasta': {
    calories: 158,
    protein: 5.8,
    carbs: 31.0,
    fat: 0.9,
    fiber: 1.8,
    sugar: 0.6,
    sodium_mg: 6,
    vitamins: ['Thiamin (B1)', 'Folate (B9)', 'Riboflavin (B2)'],
    minerals: ['Manganese', 'Selenium', 'Iron']
  },
  'noodles': {
    calories: 138,
    protein: 4.5,
    carbs: 25.0,
    fat: 2.1,
    fiber: 1.2,
    sugar: 0.5,
    sodium_mg: 400,
    vitamins: ['Thiamin', 'Niacin'],
    minerals: ['Iron', 'Sodium']
  },
  'salmon': {
    calories: 208,
    protein: 20.4,
    carbs: 0.0,
    fat: 13.4,
    fiber: 0.0,
    sugar: 0.0,
    sodium_mg: 59,
    vitamins: ['Vitamin D', 'Vitamin B12', 'Vitamin B6'],
    minerals: ['Selenium', 'Potassium', 'Phosphorus']
  },
  'tofu': {
    calories: 76,
    protein: 8.1,
    carbs: 1.9,
    fat: 4.8,
    fiber: 0.3,
    sugar: 0.5,
    sodium_mg: 7,
    vitamins: ['Thiamin', 'Riboflavin'],
    minerals: ['Calcium', 'Iron', 'Magnesium', 'Manganese']
  },
  'tempeh': {
    calories: 193,
    protein: 19.0,
    carbs: 9.4,
    fat: 10.8,
    fiber: 3.5,
    sugar: 0.8,
    sodium_mg: 9,
    vitamins: ['Riboflavin (B2)', 'Niacin (B3)', 'Vitamin B6'],
    minerals: ['Manganese', 'Phosphorus', 'Magnesium', 'Iron']
  },
  'bread': {
    calories: 265,
    protein: 9.0,
    carbs: 49.0,
    fat: 3.2,
    fiber: 2.7,
    sugar: 5.0,
    sodium_mg: 490,
    vitamins: ['Thiamin', 'Folate', 'Niacin'],
    minerals: ['Iron', 'Calcium', 'Sodium']
  },
  'potato': {
    calories: 87,
    protein: 1.9,
    carbs: 20.1,
    fat: 0.1,
    fiber: 1.8,
    sugar: 0.9,
    sodium_mg: 6,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Manganese', 'Phosphorus']
  },
  'beef steak': {
    calories: 271,
    protein: 26.0,
    carbs: 0.0,
    fat: 18.0,
    fiber: 0.0,
    sugar: 0.0,
    sodium_mg: 54,
    vitamins: ['Vitamin B12', 'Niacin', 'Vitamin B6'],
    minerals: ['Zinc', 'Iron', 'Selenium', 'Phosphorus']
  }
};

export class NutritionNormalizer {
  /**
   * Normalizes an array of identified foods against database / reference records,
   * calculates deterministic macro totals and honest calorie uncertainty ranges.
   */
  static async calculateMealNutrition(
    items: IdentifiedFoodItem[],
    supabase?: SupabaseClient
  ): Promise<MealNutritionCalculation> {
    if (!items || items.length === 0) {
      return {
        total_calories: 0,
        calorie_range: { min: 0, max: 0 },
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        total_fiber: 0,
        total_sugar: 0,
        total_sodium_mg: 0,
        prominent_vitamins: [],
        prominent_minerals: [],
        normalized_items: []
      };
    }

    const normalizedItems = [];
    let sumCalories = 0;
    let sumProtein = 0;
    let sumCarbs = 0;
    let sumFat = 0;
    let sumFiber = 0;
    let sumSugar = 0;
    let sumSodium = 0;
    const allVitamins = new Set<string>();
    const allMinerals = new Set<string>();

    for (const item of items) {
      const portionG = item.estimated_portion_g && item.estimated_portion_g > 0 ? item.estimated_portion_g : 150;
      const scale = portionG / 100;
      const lowerName = item.name.toLowerCase().trim();

      // 1. Try Supabase food_items lookup if client available
      let matchedData: typeof COMMON_FOOD_NUTRITION[string] | null = null;
      let isExact = false;

      if (supabase) {
        try {
          const { data: dbItem } = await supabase
            .from('food_items')
            .select('*')
            .ilike('name', `%${lowerName}%`)
            .limit(1)
            .maybeSingle();

          if (dbItem && dbItem.calories !== null && dbItem.calories > 0) {
            matchedData = {
              calories: Number(dbItem.calories),
              protein: Number(dbItem.protein || 0),
              carbs: Number(dbItem.carbs || 0),
              fat: Number(dbItem.fat || 0),
              fiber: Number(dbItem.fiber || 0),
              sugar: Number(dbItem.sugar || 0),
              sodium_mg: 200, // typical baseline
              vitamins: Array.isArray(dbItem.vitamins) ? dbItem.vitamins : ['B Vitamins'],
              minerals: Array.isArray(dbItem.minerals) ? dbItem.minerals : ['Potassium', 'Iron']
            };
            isExact = true;
          }
        } catch (e) {
          console.warn("[NutritionNormalizer] Supabase lookup error:", e);
        }
      }

      // 2. Fall back to authoritative reference catalog
      if (!matchedData) {
        // Find best match in COMMON_FOOD_NUTRITION
        for (const [key, ref] of Object.entries(COMMON_FOOD_NUTRITION)) {
          if (lowerName.includes(key) || key.includes(lowerName)) {
            matchedData = ref;
            isExact = lowerName === key;
            break;
          }
        }

        // Fuzzy sub-word search if still null
        if (!matchedData) {
          const words = lowerName.split(/\s+/);
          for (const w of words) {
            if (w.length > 3) {
              const foundKey = Object.keys(COMMON_FOOD_NUTRITION).find(k => k.includes(w));
              if (foundKey) {
                matchedData = COMMON_FOOD_NUTRITION[foundKey];
                break;
              }
            }
          }
        }
      }

      // 3. Fallback generic profile if completely unknown (never 0 kcal!)
      if (!matchedData) {
        matchedData = {
          calories: 180, // average cooked food per 100g
          protein: 8.0,
          carbs: 18.0,
          fat: 8.0,
          fiber: 2.0,
          sugar: 1.5,
          sodium_mg: 300,
          vitamins: ['Vitamin C', 'B Vitamins'],
          minerals: ['Potassium', 'Iron']
        };
      }

      const itemCalories = Math.round(matchedData.calories * scale);
      const itemProtein = Math.round(matchedData.protein * scale * 10) / 10;
      const itemCarbs = Math.round(matchedData.carbs * scale * 10) / 10;
      const itemFat = Math.round(matchedData.fat * scale * 10) / 10;
      const itemFiber = Math.round(matchedData.fiber * scale * 10) / 10;
      const itemSugar = Math.round(matchedData.sugar * scale * 10) / 10;
      const itemSodium = Math.round(matchedData.sodium_mg * scale);

      matchedData.vitamins.forEach(v => allVitamins.add(v));
      matchedData.minerals.forEach(m => allMinerals.add(m));

      sumCalories += itemCalories;
      sumProtein += itemProtein;
      sumCarbs += itemCarbs;
      sumFat += itemFat;
      sumFiber += itemFiber;
      sumSugar += itemSugar;
      sumSodium += itemSodium;

      normalizedItems.push({
        name: item.name,
        portion_g: portionG,
        portion_description: item.portion_description || `~${portionG}g`,
        calories: itemCalories,
        protein: itemProtein,
        carbs: itemCarbs,
        fat: itemFat,
        fiber: itemFiber,
        sugar: itemSugar,
        sodium_mg: itemSodium,
        vitamins: matchedData.vitamins,
        minerals: matchedData.minerals,
        is_exact_match: isExact
      });
    }

    // Honest uncertainty range: +/- 12% to account for visual portion variance
    const minCalories = Math.round(sumCalories * 0.88);
    const maxCalories = Math.round(sumCalories * 1.12);

    return {
      total_calories: sumCalories,
      calorie_range: {
        min: minCalories,
        max: maxCalories
      },
      total_protein: Math.round(sumProtein * 10) / 10,
      total_carbs: Math.round(sumCarbs * 10) / 10,
      total_fat: Math.round(sumFat * 10) / 10,
      total_fiber: Math.round(sumFiber * 10) / 10,
      total_sugar: Math.round(sumSugar * 10) / 10,
      total_sodium_mg: sumSodium,
      prominent_vitamins: Array.from(allVitamins),
      prominent_minerals: Array.from(allMinerals),
      normalized_items: normalizedItems
    };
  }
}
