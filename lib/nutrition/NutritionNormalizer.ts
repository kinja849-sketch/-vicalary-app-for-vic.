import { SupabaseClient } from '@supabase/supabase-js';
import { FoodItemImageResolver } from '@/lib/services/FoodItemImageResolver';
import {
  DeterministicCalculationEngine,
  DataVerificationStatus,
  QuantitySourcePriority,
  ComponentObservationType
} from './DeterministicCalculationEngine';
import { USDAFoodDataService } from './USDAFoodDataService';
import { TKPIDatasetService } from './TKPIDatasetService';

export interface IdentifiedFoodItem {
  name: string;
  count?: string | number;
  variant_or_method?: string;
  preparation_state?: 'raw' | 'cooked' | 'fried' | 'boiled' | 'steamed' | 'grilled' | 'roasted' | 'stewed' | 'baked';
  estimated_portion_g?: number;
  user_confirmed_weight_g?: number;
  user_confirmed_count?: number;
  validated_portion_g?: number;
  portion_description?: string;
  confidence?: number;
  observation_type?: ComponentObservationType;
  is_cooked_ingredient?: boolean;
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

export interface NormalizedMealItemResult {
  name: string;
  count?: string | number;
  numeric_count?: number;
  variant_or_method?: string;
  preparation_state?: string;
  portion_g: number;
  portion_description: string;
  uncertainty_range_g?: {
    min_g: number;
    max_g: number;
  };
  calories: number;
  calories_exact: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium_mg: number;
  vitamins: string[];
  minerals: string[];
  image_url: string;
  is_exact_match: boolean;
  source: 'usda_fdc' | 'tkpi_indonesia' | 'supabase_food_items' | 'reference_catalog' | 'ai_estimate';
  source_id?: string;
  source_description?: string;
  per_100g: {
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  observation_type: ComponentObservationType;
  quantity_source: QuantitySourcePriority;
  verification_status: DataVerificationStatus;
  requires_confirmation: boolean;
  is_cooked_ingredient?: boolean;
  formula_audit: string;
}

export interface MealNutritionCalculation {
  total_calories: number;
  total_calories_exact: number;
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
  verification_status?: DataVerificationStatus;
  requires_confirmation?: boolean;
  normalized_items: NormalizedMealItemResult[];
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
  'grilled chicken breast': {
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
  'grilled chicken': {
    calories: 185,
    protein: 28.0,
    carbs: 0.0,
    fat: 7.5,
    fiber: 0.0,
    sugar: 0.0,
    sodium_mg: 85,
    vitamins: ['Vitamin B6', 'Vitamin B12', 'Niacin'],
    minerals: ['Phosphorus', 'Selenium', 'Potassium']
  },
  'roasted chicken': {
    calories: 190,
    protein: 27.0,
    carbs: 0.0,
    fat: 8.5,
    fiber: 0.0,
    sugar: 0.0,
    sodium_mg: 82,
    vitamins: ['Niacin', 'Vitamin B6'],
    minerals: ['Phosphorus', 'Selenium']
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
  'eggs': {
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
  'boiled egg': {
    calories: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    fiber: 0.0,
    sugar: 0.4,
    sodium_mg: 142,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12'],
    minerals: ['Iron', 'Phosphorus', 'Selenium']
  },
  'poached egg': {
    calories: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    fiber: 0.0,
    sugar: 0.4,
    sodium_mg: 142,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12'],
    minerals: ['Iron', 'Phosphorus', 'Selenium']
  },
  'fried egg': {
    calories: 196,
    protein: 13.6,
    carbs: 0.8,
    fat: 15.0,
    fiber: 0.0,
    sugar: 0.4,
    sodium_mg: 180,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12'],
    minerals: ['Iron', 'Phosphorus', 'Choline']
  },
  'tomato': {
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    fiber: 1.2,
    sugar: 2.6,
    sodium_mg: 5,
    vitamins: ['Vitamin C', 'Vitamin K', 'Folate', 'Vitamin A'],
    minerals: ['Potassium', 'Manganese']
  },
  'tomatoes': {
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    fiber: 1.2,
    sugar: 2.6,
    sodium_mg: 5,
    vitamins: ['Vitamin C', 'Vitamin K', 'Folate', 'Vitamin A'],
    minerals: ['Potassium', 'Manganese']
  },
  'cucumber': {
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
    fiber: 0.5,
    sugar: 1.7,
    sodium_mg: 2,
    vitamins: ['Vitamin K', 'Vitamin C'],
    minerals: ['Potassium', 'Magnesium']
  },
  'cucumbers': {
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
    fiber: 0.5,
    sugar: 1.7,
    sodium_mg: 2,
    vitamins: ['Vitamin K', 'Vitamin C'],
    minerals: ['Potassium', 'Magnesium']
  },
  'onion': {
    calories: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
    fiber: 1.7,
    sugar: 4.2,
    sodium_mg: 4,
    vitamins: ['Vitamin C', 'Vitamin B6', 'Folate'],
    minerals: ['Potassium', 'Manganese']
  },
  'onions': {
    calories: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
    fiber: 1.7,
    sugar: 4.2,
    sodium_mg: 4,
    vitamins: ['Vitamin C', 'Vitamin B6', 'Folate'],
    minerals: ['Potassium', 'Manganese']
  },
  'cooked onions': {
    calories: 44,
    protein: 1.4,
    carbs: 10.2,
    fat: 0.2,
    fiber: 1.9,
    sugar: 4.7,
    sodium_mg: 6,
    vitamins: ['Vitamin C', 'B Vitamins'],
    minerals: ['Potassium']
  },
  'stewed onions': {
    calories: 44,
    protein: 1.4,
    carbs: 10.2,
    fat: 0.2,
    fiber: 1.9,
    sugar: 4.7,
    sodium_mg: 6,
    vitamins: ['Vitamin C', 'B Vitamins'],
    minerals: ['Potassium']
  },
  'stewed tomatoes': {
    calories: 25,
    protein: 1.2,
    carbs: 5.5,
    fat: 0.2,
    fiber: 1.6,
    sugar: 3.5,
    sodium_mg: 12,
    vitamins: ['Vitamin C', 'Vitamin A', 'Folate'],
    minerals: ['Potassium', 'Manganese']
  },
  'stewed potatoes': {
    calories: 87,
    protein: 1.9,
    carbs: 20.1,
    fat: 0.1,
    fiber: 1.8,
    sugar: 0.9,
    sodium_mg: 6,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Manganese']
  },
  'wheat flour': {
    calories: 364,
    protein: 10.3,
    carbs: 76.3,
    fat: 1.0,
    fiber: 2.7,
    sugar: 0.3,
    sodium_mg: 2,
    vitamins: ['Thiamin (B1)', 'Riboflavin (B2)', 'Niacin (B3)', 'Folate (B9)'],
    minerals: ['Iron', 'Selenium', 'Manganese']
  },
  'flour': {
    calories: 364,
    protein: 10.3,
    carbs: 76.3,
    fat: 1.0,
    fiber: 2.7,
    sugar: 0.3,
    sodium_mg: 2,
    vitamins: ['Thiamin (B1)', 'Riboflavin (B2)', 'Niacin (B3)', 'Folate (B9)'],
    minerals: ['Iron', 'Selenium', 'Manganese']
  },
  'sugar': {
    calories: 387,
    protein: 0.0,
    carbs: 100.0,
    fat: 0.0,
    fiber: 0.0,
    sugar: 100.0,
    sodium_mg: 1,
    vitamins: ['Riboflavin (B2)'],
    minerals: ['Calcium', 'Potassium']
  },
  'granulated sugar': {
    calories: 387,
    protein: 0.0,
    carbs: 100.0,
    fat: 0.0,
    fiber: 0.0,
    sugar: 100.0,
    sodium_mg: 1,
    vitamins: ['Riboflavin (B2)'],
    minerals: ['Calcium', 'Potassium']
  },
  'cocoa powder': {
    calories: 228,
    protein: 19.6,
    carbs: 57.9,
    fat: 13.7,
    fiber: 33.2,
    sugar: 1.8,
    sodium_mg: 21,
    vitamins: ['Niacin (B3)', 'Vitamin K', 'Vitamin B6'],
    minerals: ['Iron', 'Magnesium', 'Potassium', 'Zinc']
  },
  'butter': {
    calories: 717,
    protein: 0.9,
    carbs: 0.1,
    fat: 81.1,
    fiber: 0.0,
    sugar: 0.1,
    sodium_mg: 643,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin E'],
    minerals: ['Calcium', 'Phosphorus']
  },
  'vegetable oil': {
    calories: 884,
    protein: 0.0,
    carbs: 0.0,
    fat: 100.0,
    fiber: 0.0,
    sugar: 0.0,
    sodium_mg: 0,
    vitamins: ['Vitamin E', 'Vitamin K'],
    minerals: ['Choline']
  },
  'whole milk': {
    calories: 61,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.3,
    fiber: 0.0,
    sugar: 5.1,
    sodium_mg: 43,
    vitamins: ['Vitamin D', 'Vitamin B12', 'Riboflavin (B2)', 'Vitamin A'],
    minerals: ['Calcium', 'Phosphorus', 'Potassium']
  },
  'chocolate': {
    calories: 546,
    protein: 4.9,
    carbs: 61.2,
    fat: 31.3,
    fiber: 7.0,
    sugar: 47.9,
    sodium_mg: 24,
    vitamins: ['Vitamin B12', 'Vitamin K'],
    minerals: ['Iron', 'Magnesium', 'Copper']
  },
  'honey': {
    calories: 304,
    protein: 0.3,
    carbs: 82.4,
    fat: 0.0,
    fiber: 0.2,
    sugar: 82.1,
    sodium_mg: 4,
    vitamins: ['Vitamin C', 'Riboflavin (B2)'],
    minerals: ['Potassium', 'Calcium']
  },
  'chiffon cake': {
    calories: 297,
    protein: 7.3,
    carbs: 53.6,
    fat: 6.1,
    fiber: 0.6,
    sugar: 32.4,
    sodium_mg: 228,
    vitamins: ['Riboflavin (B2)', 'Thiamin (B1)', 'Folate (B9)', 'Vitamin A'],
    minerals: ['Selenium', 'Phosphorus', 'Iron']
  },
  'chocolate chiffon cake': {
    calories: 324,
    protein: 6.8,
    carbs: 51.4,
    fat: 10.6,
    fiber: 1.8,
    sugar: 31.0,
    sodium_mg: 235,
    vitamins: ['Riboflavin (B2)', 'Niacin (B3)', 'Folate (B9)'],
    minerals: ['Iron', 'Magnesium', 'Phosphorus', 'Potassium']
  },
  'chocolate cake': {
    calories: 324,
    protein: 6.8,
    carbs: 51.4,
    fat: 10.6,
    fiber: 1.8,
    sugar: 31.0,
    sodium_mg: 235,
    vitamins: ['Riboflavin (B2)', 'Niacin (B3)', 'Folate (B9)'],
    minerals: ['Iron', 'Magnesium', 'Phosphorus', 'Potassium']
  },
  'sponge cake': {
    calories: 297,
    protein: 7.3,
    carbs: 53.6,
    fat: 6.1,
    fiber: 0.6,
    sugar: 32.4,
    sodium_mg: 228,
    vitamins: ['Riboflavin (B2)', 'Thiamin (B1)', 'Folate (B9)'],
    minerals: ['Selenium', 'Phosphorus', 'Iron']
  },
  'potato and tomato stew': {
    calories: 78,
    protein: 1.8,
    carbs: 16.2,
    fat: 0.9,
    fiber: 1.9,
    sugar: 2.1,
    sodium_mg: 145,
    vitamins: ['Vitamin C', 'Vitamin B6', 'Vitamin A', 'Folate (B9)'],
    minerals: ['Potassium', 'Phosphorus', 'Manganese']
  },
  'potato stew': {
    calories: 78,
    protein: 1.8,
    carbs: 16.2,
    fat: 0.9,
    fiber: 1.9,
    sugar: 2.1,
    sodium_mg: 145,
    vitamins: ['Vitamin C', 'Vitamin B6', 'Vitamin A'],
    minerals: ['Potassium', 'Phosphorus']
  },
  'plain bao bun': {
    calories: 235,
    protein: 7.0,
    carbs: 48.0,
    fat: 1.5,
    fiber: 1.5,
    sugar: 6.0,
    sodium_mg: 220,
    vitamins: ['Thiamin', 'Niacin'],
    minerals: ['Iron', 'Calcium']
  },
  'bao bun': {
    calories: 235,
    protein: 7.0,
    carbs: 48.0,
    fat: 1.5,
    fiber: 1.5,
    sugar: 6.0,
    sodium_mg: 220,
    vitamins: ['Thiamin', 'Niacin'],
    minerals: ['Iron', 'Calcium']
  },
  'soup / broth': {
    calories: 20,
    protein: 3.0,
    carbs: 1.0,
    fat: 0.5,
    fiber: 0.0,
    sugar: 0.5,
    sodium_mg: 380,
    vitamins: ['B Vitamins'],
    minerals: ['Sodium', 'Potassium']
  },
  'broth': {
    calories: 20,
    protein: 3.0,
    carbs: 1.0,
    fat: 0.5,
    fiber: 0.0,
    sugar: 0.5,
    sodium_mg: 380,
    vitamins: ['B Vitamins'],
    minerals: ['Sodium', 'Potassium']
  },
  'soup': {
    calories: 30,
    protein: 2.0,
    carbs: 3.5,
    fat: 0.8,
    fiber: 0.5,
    sugar: 1.0,
    sodium_mg: 350,
    vitamins: ['Vitamin A', 'Vitamin C'],
    minerals: ['Sodium', 'Potassium']
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
  'sourdough bread': {
    calories: 250,
    protein: 8.5,
    carbs: 50.0,
    fat: 1.2,
    fiber: 2.5,
    sugar: 1.5,
    sodium_mg: 450,
    vitamins: ['Thiamin', 'Folate'],
    minerals: ['Iron', 'Manganese']
  },
  'toast': {
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
  'potatoes': {
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
  'boiled potato': {
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
  'boiled potatoes': {
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
  'roasted potatoes': {
    calories: 140,
    protein: 2.3,
    carbs: 23.5,
    fat: 4.5,
    fiber: 2.5,
    sugar: 1.2,
    sodium_mg: 180,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Magnesium']
  },
  'baked potato': {
    calories: 93,
    protein: 2.5,
    carbs: 21.0,
    fat: 0.2,
    fiber: 2.2,
    sugar: 1.0,
    sodium_mg: 10,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Iron']
  },
  'mashed potatoes': {
    calories: 113,
    protein: 2.0,
    carbs: 17.0,
    fat: 4.2,
    fiber: 1.5,
    sugar: 1.5,
    sodium_mg: 280,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Phosphorus']
  },
  'potato wedges': {
    calories: 140,
    protein: 2.3,
    carbs: 23.5,
    fat: 4.5,
    fiber: 2.5,
    sugar: 1.2,
    sodium_mg: 180,
    vitamins: ['Vitamin C', 'Vitamin B6'],
    minerals: ['Potassium', 'Magnesium']
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
  },
  'nasi putih': {
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
  'nasi goreng': {
    calories: 168,
    protein: 5.0,
    carbs: 21.0,
    fat: 7.2,
    fiber: 1.5,
    sugar: 1.2,
    sodium_mg: 380,
    vitamins: ['Vitamin A', 'B Vitamins'],
    minerals: ['Iron', 'Sodium', 'Potassium']
  },
  'ayam goreng': {
    calories: 245,
    protein: 22.0,
    carbs: 3.5,
    fat: 15.8,
    fiber: 0.2,
    sugar: 0.1,
    sodium_mg: 420,
    vitamins: ['Niacin (B3)', 'Vitamin B6'],
    minerals: ['Phosphorus', 'Iron', 'Zinc']
  },
  'ayam bakar': {
    calories: 185,
    protein: 25.0,
    carbs: 4.0,
    fat: 7.5,
    fiber: 0.2,
    sugar: 2.5,
    sodium_mg: 390,
    vitamins: ['Vitamin B6', 'Niacin'],
    minerals: ['Potassium', 'Phosphorus', 'Iron']
  },
  'rendang': {
    calories: 215,
    protein: 19.5,
    carbs: 5.2,
    fat: 13.0,
    fiber: 1.2,
    sugar: 1.5,
    sodium_mg: 460,
    vitamins: ['Vitamin B12', 'Iron'],
    minerals: ['Zinc', 'Selenium', 'Phosphorus']
  },
  'sate ayam': {
    calories: 218,
    protein: 18.0,
    carbs: 9.5,
    fat: 12.2,
    fiber: 1.8,
    sugar: 4.5,
    sodium_mg: 410,
    vitamins: ['Niacin', 'Vitamin E'],
    minerals: ['Magnesium', 'Phosphorus', 'Zinc']
  },
  'telur dadar': {
    calories: 195,
    protein: 11.5,
    carbs: 1.2,
    fat: 16.0,
    fiber: 0.2,
    sugar: 0.4,
    sodium_mg: 280,
    vitamins: ['Vitamin A', 'Vitamin D', 'Vitamin B12'],
    minerals: ['Iron', 'Choline', 'Selenium']
  },
  'tahu goreng': {
    calories: 115,
    protein: 9.2,
    carbs: 3.5,
    fat: 7.1,
    fiber: 1.5,
    sugar: 0.5,
    sodium_mg: 120,
    vitamins: ['Thiamin', 'Riboflavin'],
    minerals: ['Calcium', 'Iron', 'Magnesium']
  },
  'tempe goreng': {
    calories: 225,
    protein: 18.5,
    carbs: 12.0,
    fat: 12.0,
    fiber: 3.8,
    sugar: 0.8,
    sodium_mg: 150,
    vitamins: ['Vitamin B6', 'Riboflavin', 'Niacin'],
    minerals: ['Manganese', 'Phosphorus', 'Iron', 'Magnesium']
  },
  'gado-gado': {
    calories: 135,
    protein: 5.2,
    carbs: 12.5,
    fat: 7.5,
    fiber: 3.2,
    sugar: 3.8,
    sodium_mg: 310,
    vitamins: ['Vitamin A', 'Vitamin C', 'Folate'],
    minerals: ['Potassium', 'Calcium', 'Iron']
  },
  'soto ayam': {
    calories: 75,
    protein: 7.0,
    carbs: 4.5,
    fat: 3.2,
    fiber: 0.8,
    sugar: 0.5,
    sodium_mg: 420,
    vitamins: ['Vitamin B6', 'Vitamin C'],
    minerals: ['Sodium', 'Potassium', 'Iron']
  },
  'bakso': {
    calories: 120,
    protein: 9.0,
    carbs: 8.5,
    fat: 5.5,
    fiber: 0.8,
    sugar: 1.0,
    sodium_mg: 480,
    vitamins: ['B Vitamins', 'Iron'],
    minerals: ['Zinc', 'Phosphorus', 'Sodium']
  },
  'mie goreng': {
    calories: 190,
    protein: 5.5,
    carbs: 28.0,
    fat: 6.5,
    fiber: 1.8,
    sugar: 2.5,
    sodium_mg: 520,
    vitamins: ['Thiamin', 'Niacin'],
    minerals: ['Iron', 'Sodium']
  },
  'sayur sop': {
    calories: 35,
    protein: 1.5,
    carbs: 6.0,
    fat: 0.5,
    fiber: 1.8,
    sugar: 1.5,
    sodium_mg: 280,
    vitamins: ['Vitamin A', 'Vitamin C'],
    minerals: ['Potassium', 'Calcium']
  },
  'sayur asem': {
    calories: 38,
    protein: 1.4,
    carbs: 7.2,
    fat: 0.6,
    fiber: 2.1,
    sugar: 2.8,
    sodium_mg: 290,
    vitamins: ['Vitamin C', 'Vitamin A', 'Folate'],
    minerals: ['Potassium', 'Magnesium']
  },
  'sambal': {
    calories: 90,
    protein: 1.8,
    carbs: 10.0,
    fat: 4.5,
    fiber: 2.8,
    sugar: 3.5,
    sodium_mg: 540,
    vitamins: ['Vitamin C', 'Vitamin A'],
    minerals: ['Potassium', 'Sodium']
  },
  'kerupuk': {
    calories: 480,
    protein: 2.0,
    carbs: 68.0,
    fat: 22.0,
    fiber: 1.2,
    sugar: 1.5,
    sodium_mg: 620,
    vitamins: ['Vitamin E'],
    minerals: ['Sodium']
  },
  'kangkung': {
    calories: 58,
    protein: 2.2,
    carbs: 4.0,
    fat: 3.8,
    fiber: 2.5,
    sugar: 1.0,
    sodium_mg: 340,
    vitamins: ['Vitamin A', 'Vitamin C', 'Iron'],
    minerals: ['Calcium', 'Potassium']
  },
  'capcay': {
    calories: 65,
    protein: 2.8,
    carbs: 7.5,
    fat: 2.5,
    fiber: 2.8,
    sugar: 2.2,
    sodium_mg: 360,
    vitamins: ['Vitamin C', 'Vitamin K', 'Folate'],
    minerals: ['Potassium', 'Calcium']
  },
  'ikan goreng': {
    calories: 205,
    protein: 21.0,
    carbs: 2.5,
    fat: 12.0,
    fiber: 0.1,
    sugar: 0.0,
    sodium_mg: 320,
    vitamins: ['Vitamin D', 'Vitamin B12'],
    minerals: ['Selenium', 'Phosphorus', 'Potassium']
  },
  'ikan bakar': {
    calories: 145,
    protein: 22.5,
    carbs: 1.5,
    fat: 5.5,
    fiber: 0.1,
    sugar: 0.8,
    sodium_mg: 290,
    vitamins: ['Vitamin D', 'Vitamin B6', 'Vitamin B12'],
    minerals: ['Selenium', 'Potassium', 'Phosphorus']
  },
  'milk': {
    calories: 62,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.4,
    fiber: 0.0,
    sugar: 4.8,
    sodium_mg: 45,
    vitamins: ['Vitamin D', 'Vitamin A', 'Vitamin B12', 'Riboflavin (B2)'],
    minerals: ['Calcium', 'Phosphorus', 'Potassium', 'Magnesium']
  },
  'full cream milk': {
    calories: 62,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.4,
    fiber: 0.0,
    sugar: 4.8,
    sodium_mg: 45,
    vitamins: ['Vitamin D', 'Vitamin A', 'Vitamin B12', 'Riboflavin (B2)'],
    minerals: ['Calcium', 'Phosphorus', 'Potassium', 'Magnesium']
  },
  'susu': {
    calories: 62,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.4,
    fiber: 0.0,
    sugar: 4.8,
    sodium_mg: 45,
    vitamins: ['Vitamin D', 'Vitamin A', 'Vitamin B12'],
    minerals: ['Calcium', 'Phosphorus', 'Potassium']
  },
  'susu uht': {
    calories: 62,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.4,
    fiber: 0.0,
    sugar: 4.8,
    sodium_mg: 45,
    vitamins: ['Vitamin D', 'Vitamin A', 'Vitamin B12'],
    minerals: ['Calcium', 'Phosphorus', 'Potassium']
  },
  'yogurt': {
    calories: 59,
    protein: 3.5,
    carbs: 4.7,
    fat: 3.3,
    fiber: 0.0,
    sugar: 4.7,
    sodium_mg: 36,
    vitamins: ['Vitamin B12', 'Riboflavin'],
    minerals: ['Calcium', 'Phosphorus']
  }
};

export class NutritionNormalizer {
  /**
   * Resolves deterministic zero-calorie nutrition ONLY for plain unflavored mineral/drinking water
   * when label nutriments are omitted on packaging. Never fabricates category heuristics for food products.
   */
  static resolvePackagedProductNutrition(
    productName: string,
    category?: string,
    _servingSizeStr?: string,
    _quantityStr?: string
  ): NormalizedNutrientData | null {
    const name = (productName || '').toLowerCase().trim();
    const cat = (category || '').toLowerCase().trim();

    const isFlavoredOrSweetened =
      name.includes('flavored') ||
      name.includes('flavoured') ||
      name.includes('sparkling') && (name.includes('juice') || name.includes('lemonade') || name.includes('syrup')) ||
      name.includes('vitamin water') ||
      name.includes('coconut water') ||
      name.includes('air kelapa') ||
      name.includes('tonic water') ||
      name.includes('soda water') && name.includes('sweet');

    const isPlainWater =
      !isFlavoredOrSweetened &&
      (name === 'water' ||
        name.includes('mineral water') ||
        name.includes('spring water') ||
        name.includes('drinking water') ||
        name.includes('purified water') ||
        name.includes('air mineral') ||
        name.includes('air minum') ||
        cat === 'waters' ||
        cat === 'mineral waters' ||
        cat === 'spring waters');

    if (isPlainWater) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium_mg: 0,
        vitamins: [],
        minerals: ['Calcium', 'Magnesium', 'Potassium']
      };
    }

    return null;
  }

  /**
   * Never fabricate or guess ingredients from product category heuristics.
   * Declared ingredients must come strictly from authoritative catalog records or packaging OCR.
   */
  static resolvePackagedProductIngredients(_productName?: string, _category?: string, _brand?: string): string | null {
    return null;
  }
  /**
   * Normalizes an array of identified foods against authoritative USDA FoodData Central,
   * Indonesian TKPI 2020, and reference records, and calculates deterministic macro totals
   * with full provenance and quantity source priority.
   */
  static async calculateMealNutrition(
    items: IdentifiedFoodItem[],
    supabase?: SupabaseClient,
    options?: { skipNetwork?: boolean }
  ): Promise<MealNutritionCalculation> {
    if (!items || items.length === 0) {
      return {
        total_calories: 0,
        total_calories_exact: 0,
        calorie_range: { min: 0, max: 0 },
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        total_fiber: 0,
        total_sugar: 0,
        total_sodium_mg: 0,
        prominent_vitamins: [],
        prominent_minerals: [],
        verification_status: 'unavailable',
        requires_confirmation: false,
        normalized_items: []
      };
    }

    const normalizedItems: NormalizedMealItemResult[] = [];
    let sumCaloriesExact = 0;
    let sumProtein = 0;
    let sumCarbs = 0;
    let sumFat = 0;
    let sumFiber = 0;
    let sumSugar = 0;
    let sumSodium = 0;
    let anyRequiresConfirmation = false;
    const allVitamins = new Set<string>();
    const allMinerals = new Set<string>();

    for (const item of items) {
      const lowerName = item.name.toLowerCase().trim();
      const lowerMethod = (item.variant_or_method || item.preparation_state || '').toLowerCase().trim();
      const compositeKey = `${lowerMethod} ${lowerName}`.trim();

      // Determine preparation state deterministically
      let prepState: 'raw' | 'cooked' | 'fried' | 'boiled' | 'steamed' | 'grilled' | 'roasted' | 'stewed' | 'baked' =
        item.preparation_state || 'cooked';
      if (!item.preparation_state) {
        if (lowerMethod.includes('raw') || lowerMethod.includes('fresh') || lowerName.includes('raw ') || lowerName.includes('fresh ') || lowerName.includes('mentah')) {
          prepState = 'raw';
        } else if (lowerMethod.includes('fry') || lowerMethod.includes('fried') || lowerMethod.includes('goreng') || lowerName.includes('goreng') || lowerName.includes('fried')) {
          prepState = 'fried';
        } else if (lowerMethod.includes('boil') || lowerMethod.includes('rebus') || lowerName.includes('rebus') || lowerName.includes('boiled')) {
          prepState = 'boiled';
        } else if (lowerMethod.includes('steam') || lowerMethod.includes('kukus')) {
          prepState = 'steamed';
        } else if (lowerMethod.includes('grill') || lowerMethod.includes('bakar') || lowerName.includes('bakar')) {
          prepState = 'grilled';
        } else if (lowerMethod.includes('roast') || lowerMethod.includes('panggang')) {
          prepState = 'roasted';
        } else if (lowerMethod.includes('stew')) {
          prepState = 'stewed';
        }
      }

      // Parse item count (e.g. "4x", "(4x)", or explicit count / user_confirmed_count field)
      // while preserving household culinary volume measures (e.g. "2 cups", "3/4 cup", "1/3 cup", "2 tbsp")
      let parsedCount: number | null = null;
      let householdMeasure: string | undefined = undefined;
      const rawCountStr = item.count !== undefined && item.count !== null ? String(item.count).trim() : '';
      const isHouseholdVolumeMeasure = /\b(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ml)\b/i.test(rawCountStr);

      if (typeof item.user_confirmed_count === 'number' && item.user_confirmed_count > 0) {
        parsedCount = item.user_confirmed_count;
      } else if (isHouseholdVolumeMeasure) {
        householdMeasure = rawCountStr;
        parsedCount = null;
      } else if (rawCountStr !== '') {
        const discreteMatch = rawCountStr.match(/^(\d+)\s*x?$/i) || rawCountStr.match(/^(\d+)\s+(?:items?|pieces?|slices?|eggs?|whole)\b/i);
        if (discreteMatch && discreteMatch[1]) {
          const num = parseInt(discreteMatch[1], 10);
          if (!isNaN(num) && num > 0) parsedCount = num;
        }
      } else {
        const countMatch = lowerName.match(/\((\d+)x\)/i) || lowerName.match(/\b(\d+)x\b/i) || lowerName.match(/^(\d+)\s+/);
        if (countMatch && countMatch[1]) {
          parsedCount = parseInt(countMatch[1], 10);
        }
      }

      // 1. Authoritative nutrition per-100g resolution:
      // Priority A: Indonesian TKPI 2020 for Indonesian/regional terms or explicit TKPI matches
      // Priority B: Official USDA FoodData Central (Foundation / SR Legacy / Survey FNDDS) for fresh produce & whole foods
      // Priority C: Reference catalog COMMON_FOOD_NUTRITION
      // Priority D: Supabase food_items
      let matchedData: NormalizedNutrientData | null = null;
      let isExact = false;
      let sourceType: 'usda_fdc' | 'tkpi_indonesia' | 'supabase_food_items' | 'reference_catalog' | 'ai_estimate' = 'reference_catalog';
      let sourceId: string | undefined = undefined;
      let sourceDescription: string | undefined = undefined;
      let defaultUnitWeightG: number | undefined = undefined;

      const isIndonesianTerm =
        /\b(nasi|mie|ayam|tempe|tahu|sambal|kerupuk|krupuk|telur|minyak|sayur|lalapan|bakso|soto|rendang|gado|pecel|capcay|kangkung|bayam|pisang|pepaya|jeruk|mangga|semangka|alpukat|tomat|kentang|wortel|mentimun|timun)\b/i.test(
          compositeKey
        );

      if (isIndonesianTerm) {
        const tkpiMatch = TKPIDatasetService.lookupFood(compositeKey, prepState) || TKPIDatasetService.lookupFood(lowerName, prepState);
        if (tkpiMatch) {
          matchedData = {
            calories: tkpiMatch.per_100g.calories_kcal,
            protein: tkpiMatch.per_100g.protein_g,
            carbs: tkpiMatch.per_100g.carbs_g,
            fat: tkpiMatch.per_100g.fat_g,
            fiber: tkpiMatch.per_100g.fiber_g,
            sugar: tkpiMatch.per_100g.sugar_g,
            sodium_mg: tkpiMatch.per_100g.sodium_mg,
            vitamins: tkpiMatch.vitamins,
            minerals: tkpiMatch.minerals
          };
          isExact = true;
          sourceType = 'tkpi_indonesia';
          sourceId = tkpiMatch.tkpi_code;
          sourceDescription = `${tkpiMatch.name_id} (${tkpiMatch.name_en}) [TKPI ${tkpiMatch.tkpi_code}]`;
          defaultUnitWeightG = tkpiMatch.standard_serving_g;
        }
      }

      // Check USDA FoodData Central for fresh foods and single whole ingredients (Examples C & D)
      if (!matchedData) {
        const usdaMatch = await USDAFoodDataService.lookupFreshFood(lowerName, prepState, {
          supabase,
          skipNetwork: options?.skipNetwork ?? true
        });
        if (usdaMatch) {
          matchedData = {
            calories: usdaMatch.per_100g.calories_kcal,
            protein: usdaMatch.per_100g.protein_g,
            carbs: usdaMatch.per_100g.carbs_g,
            fat: usdaMatch.per_100g.fat_g,
            fiber: usdaMatch.per_100g.fiber_g,
            sugar: usdaMatch.per_100g.sugar_g,
            sodium_mg: usdaMatch.per_100g.sodium_mg,
            vitamins: usdaMatch.vitamins,
            minerals: usdaMatch.minerals
          };
          isExact = true;
          sourceType = 'usda_fdc';
          sourceId = String(usdaMatch.fdc_id);
          sourceDescription = `${usdaMatch.description} [USDA FDC #${usdaMatch.fdc_id} - ${usdaMatch.data_type}]`;
          defaultUnitWeightG = usdaMatch.default_unit_weight_g;
          prepState = usdaMatch.preparation_state;
        }
      }

      // Check TKPI if USDA didn't match
      if (!matchedData && !isIndonesianTerm) {
        const tkpiMatch = TKPIDatasetService.lookupFood(compositeKey, prepState) || TKPIDatasetService.lookupFood(lowerName, prepState);
        if (tkpiMatch) {
          matchedData = {
            calories: tkpiMatch.per_100g.calories_kcal,
            protein: tkpiMatch.per_100g.protein_g,
            carbs: tkpiMatch.per_100g.carbs_g,
            fat: tkpiMatch.per_100g.fat_g,
            fiber: tkpiMatch.per_100g.fiber_g,
            sugar: tkpiMatch.per_100g.sugar_g,
            sodium_mg: tkpiMatch.per_100g.sodium_mg,
            vitamins: tkpiMatch.vitamins,
            minerals: tkpiMatch.minerals
          };
          isExact = true;
          sourceType = 'tkpi_indonesia';
          sourceId = tkpiMatch.tkpi_code;
          sourceDescription = `${tkpiMatch.name_id} (${tkpiMatch.name_en}) [TKPI ${tkpiMatch.tkpi_code}]`;
          defaultUnitWeightG = tkpiMatch.standard_serving_g;
        }
      }

      // Check COMMON_FOOD_NUTRITION reference catalog
      if (!matchedData) {
        if (compositeKey && COMMON_FOOD_NUTRITION[compositeKey]) {
          matchedData = COMMON_FOOD_NUTRITION[compositeKey];
          isExact = true;
          sourceType = 'reference_catalog';
          sourceDescription = `Reference Nutrition Catalog (${compositeKey})`;
        } else if (COMMON_FOOD_NUTRITION[lowerName]) {
          matchedData = COMMON_FOOD_NUTRITION[lowerName];
          isExact = true;
          sourceType = 'reference_catalog';
          sourceDescription = `Reference Nutrition Catalog (${lowerName})`;
        } else {
          for (const [key, ref] of Object.entries(COMMON_FOOD_NUTRITION)) {
            if (compositeKey && (compositeKey.includes(key) || key.includes(compositeKey))) {
              matchedData = ref;
              isExact = true;
              sourceType = 'reference_catalog';
              sourceDescription = `Reference Nutrition Catalog (${key})`;
              break;
            }
            if (lowerName.includes(key) || key.includes(lowerName)) {
              matchedData = ref;
              isExact = lowerName === key;
              sourceType = 'reference_catalog';
              sourceDescription = `Reference Nutrition Catalog (${key})`;
              break;
            }
          }
        }
      }

      // Check Supabase food_items table
      if (!matchedData && supabase) {
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
              sodium_mg: 200,
              vitamins: Array.isArray(dbItem.vitamins) ? dbItem.vitamins : ['B Vitamins'],
              minerals: Array.isArray(dbItem.minerals) ? dbItem.minerals : ['Potassium', 'Iron']
            };
            isExact = true;
            sourceType = 'supabase_food_items';
            sourceId = String(dbItem.id);
            sourceDescription = `Supabase Food Catalog (${dbItem.name})`;
          }
        } catch (e) {
          console.warn('[NutritionNormalizer] Supabase lookup error:', e);
        }
      }

      // Fallback generic profile if completely unknown (explicitly marked as 'estimated' & requires_confirmation)
      if (!matchedData) {
        matchedData = {
          calories: 160,
          protein: 7.0,
          carbs: 18.0,
          fat: 6.0,
          fiber: 2.0,
          sugar: 1.5,
          sodium_mg: 250,
          vitamins: ['Vitamin C', 'B Vitamins'],
          minerals: ['Potassium', 'Iron']
        };
        isExact = false;
        sourceType = 'ai_estimate';
        sourceDescription = 'Fallback Nutritional Estimate (Unverified Food Entry)';
      }

      // 2. Resolve Portion Weight using Section 7 Priority Order:
      // Priority 1: user_confirmed_weight_g or user_confirmed_count
      // Priority 2: validated_portion_g
      // Priority 3: ai_visual_estimate (respecting unit count for multi-item fresh foods like 5 tomatoes)
      const isExplicitGarnishSlice =
        lowerName.includes('slice') ||
        lowerName.includes('garnish') ||
        lowerMethod.includes('slice') ||
        lowerMethod.includes('garnish');

      let unitRefWeightG = defaultUnitWeightG || 120;
      if (lowerName.includes('egg') || lowerName.includes('telur')) {
        unitRefWeightG = 50;
      } else if (lowerName.includes('bun') || lowerName.includes('bao')) {
        unitRefWeightG = 45;
      } else if (lowerName.includes('tomato') || lowerName.includes('tomat')) {
        unitRefWeightG = isExplicitGarnishSlice ? 30 : 120; // Whole medium tomato = 120g (Example C & D)
      }

      let aiEstimatedTotalG = item.estimated_portion_g && item.estimated_portion_g > 0 ? item.estimated_portion_g : undefined;

      // If multiple countable items are detected (e.g., 5 raw tomatoes in Example D), ensure total weight scales by count
      // if the caller supplied a single-unit weight or omitted total weight.
      if (parsedCount && parsedCount > 1 && !item.user_confirmed_weight_g) {
        if (!aiEstimatedTotalG || aiEstimatedTotalG <= unitRefWeightG * 1.4) {
          aiEstimatedTotalG = parsedCount * unitRefWeightG;
        }
      } else if (!aiEstimatedTotalG) {
        if (isExplicitGarnishSlice && (lowerName.includes('tomato') || lowerName.includes('cucumber'))) {
          aiEstimatedTotalG = 30;
        } else {
          aiEstimatedTotalG = defaultUnitWeightG || 150;
        }
      }

      const portionResolution = DeterministicCalculationEngine.resolvePortionWeight({
        userConfirmedWeightG: item.user_confirmed_weight_g,
        userConfirmedCount: item.user_confirmed_count,
        validatedPortionWeightG: item.validated_portion_g,
        aiEstimatedWeightG: aiEstimatedTotalG,
        aiEstimatedCount: parsedCount ?? undefined,
        standardUnitWeightG: unitRefWeightG,
        confidence: item.confidence
      });

      // Clamp portion between 2g (e.g. cooking oil / spices) and 2500g (multi-item produce)
      const portionG = Math.max(2, Math.min(2500, portionResolution.weight_g));

      // 3. Deterministic Calculation from per-100g record (1-decimal exact precision preserved)
      const calcResult = DeterministicCalculationEngine.calculateComponentFromPer100g(
        {
          calories_kcal: matchedData.calories,
          protein_g: matchedData.protein,
          carbs_g: matchedData.carbs,
          fat_g: matchedData.fat,
          fiber_g: matchedData.fiber,
          sugar_g: matchedData.sugar,
          sodium_mg: matchedData.sodium_mg
        },
        portionG
      );

      const observationType: ComponentObservationType =
        item.user_confirmed_weight_g !== undefined || item.user_confirmed_count !== undefined
          ? 'user_confirmed'
          : item.observation_type || 'directly_observed';

      const requiresConfirmation =
        sourceType === 'ai_estimate' ||
        portionResolution.requires_confirmation ||
        (parsedCount !== null && parsedCount >= 3 && item.user_confirmed_weight_g === undefined && item.user_confirmed_count === undefined);

      if (requiresConfirmation) {
        anyRequiresConfirmation = true;
      }

      const verificationStatus: DataVerificationStatus =
        sourceType === 'ai_estimate'
          ? 'estimated'
          : requiresConfirmation
            ? 'requires-confirmation'
            : portionResolution.quantity_source === 'user_confirmed'
              ? 'verified'
              : 'database-derived';

      matchedData.vitamins.forEach(v => allVitamins.add(v));
      matchedData.minerals.forEach(m => allMinerals.add(m));

      sumCaloriesExact = Math.round((sumCaloriesExact + calcResult.calories_exact) * 10) / 10;
      sumProtein = Math.round((sumProtein + calcResult.protein_g) * 10) / 10;
      sumCarbs = Math.round((sumCarbs + calcResult.carbs_g) * 10) / 10;
      sumFat = Math.round((sumFat + calcResult.fat_g) * 10) / 10;
      sumFiber = Math.round((sumFiber + calcResult.fiber_g) * 10) / 10;
      sumSugar = Math.round((sumSugar + calcResult.sugar_g) * 10) / 10;
      sumSodium += calcResult.sodium_mg;

      // Deterministically resolve authentic clean food image
      const itemImage = FoodItemImageResolver.resolveImageUrl(item.name, item.variant_or_method || prepState);

      // Clean display count badge (e.g. "4x" for discrete multi-items, or "2 cups" / "3/4 cup" for culinary volume measures)
      const displayCount = householdMeasure
        ? householdMeasure
        : parsedCount && parsedCount > 1
          ? `${parsedCount}x`
          : (item.count ? String(item.count) : undefined);

      // Preserve exact decimal calories (e.g., 21.6 kcal for 120g raw tomato)
      const displayItemCalories =
        calcResult.calories_exact % 1 !== 0 ? calcResult.calories_exact : calcResult.calories;

      // Build explicit per-unit or culinary-measure portion description so every tile shows authentic math
      const singleUnitKcal = parsedCount && parsedCount > 1
        ? Math.round(calcResult.calories_exact / parsedCount)
        : Math.round(calcResult.calories_exact);

      const resolvedPortionDescription = item.is_cooked_ingredient
        ? (item.portion_description || 'Used in dish')
        : parsedCount && parsedCount > 1
          ? `${parsedCount} × ${singleUnitKcal} kcal (~${portionG}g)`
          : householdMeasure
            ? `${householdMeasure} (~${portionG}g)`
            : item.portion_description || `~${portionG}g`;

      normalizedItems.push({
        name: item.name,
        count: item.is_cooked_ingredient ? undefined : displayCount,
        numeric_count: parsedCount ?? 1,
        variant_or_method: item.variant_or_method || prepState,
        preparation_state: prepState,
        portion_g: portionG,
        portion_description: resolvedPortionDescription,
        uncertainty_range_g: portionResolution.uncertainty_range_g,
        calories: displayItemCalories,
        calories_exact: calcResult.calories_exact,
        protein: calcResult.protein_g,
        carbs: calcResult.carbs_g,
        fat: calcResult.fat_g,
        fiber: calcResult.fiber_g,
        sugar: calcResult.sugar_g,
        sodium_mg: calcResult.sodium_mg,
        vitamins: matchedData.vitamins,
        minerals: matchedData.minerals,
        image_url: itemImage,
        is_exact_match: isExact,
        source: sourceType,
        source_id: sourceId,
        source_description: sourceDescription,
        per_100g: {
          calories_kcal: matchedData.calories,
          protein_g: matchedData.protein,
          carbs_g: matchedData.carbs,
          fat_g: matchedData.fat,
          fiber_g: matchedData.fiber,
          sugar_g: matchedData.sugar,
          sodium_mg: matchedData.sodium_mg
        },
        observation_type: observationType,
        quantity_source: portionResolution.quantity_source,
        verification_status: verificationStatus,
        requires_confirmation: requiresConfirmation,
        is_cooked_ingredient: item.is_cooked_ingredient || false,
        formula_audit: calcResult.formula_audit
      });
    }

    // Honest uncertainty range: +/- 12% to account for visual portion variance
    const minCalories = Math.round(sumCaloriesExact * 0.88);
    const maxCalories = Math.round(sumCaloriesExact * 1.12);

    // If single item has exact decimal (e.g., 21.6 kcal for 120g raw tomato), preserve it in total_calories as well
    const totalCaloriesDisplay =
      normalizedItems.length === 1 && sumCaloriesExact % 1 !== 0
        ? sumCaloriesExact
        : Math.round(sumCaloriesExact);

    return {
      total_calories: totalCaloriesDisplay,
      total_calories_exact: sumCaloriesExact,
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
      verification_status: anyRequiresConfirmation ? 'requires-confirmation' : 'database-derived',
      requires_confirmation: anyRequiresConfirmation,
      normalized_items: normalizedItems
    };
  }

  /**
   * Mixed Meal & Recipe-Level Decomposition (Section 6 & Example E):
   * Decomposes a mixed meal (such as Nasi Goreng, Ayam Penyet, Soto Ayam, Mie Goreng)
   * into its constituent directly-observed and inferred components (such as cooking oil),
   * retrieves per-100g nutritional profiles from TKPI / USDA, and calculates deterministic totals.
   */
  static async decomposeAndCalculateMixedMeal(
    dishName: string,
    observedItems?: IdentifiedFoodItem[],
    supabase?: SupabaseClient,
    options?: { skipNetwork?: boolean }
  ): Promise<{
    is_decomposed_template: boolean;
    dish_name: string;
    calculation: MealNutritionCalculation;
  }> {
    const template = TKPIDatasetService.getMixedMealTemplate(dishName);

    if (template) {
      let componentList: IdentifiedFoodItem[] = [];

      if (observedItems && observedItems.length > 1) {
        // Use observed items and append any missing inferred ingredients (e.g., cooking oil) from the template
        componentList = observedItems.map(item => ({
          ...item,
          observation_type: item.observation_type || 'directly_observed'
        }));

        for (const tplComp of template.components) {
          if (tplComp.observation_type === 'inferred_ingredient') {
            const alreadyPresent = componentList.some(c =>
              c.name.toLowerCase().includes('oil') ||
              c.name.toLowerCase().includes('minyak') ||
              c.name.toLowerCase().includes('santan') ||
              c.name.toLowerCase().includes('coconut milk')
            );
            if (!alreadyPresent) {
              componentList.push({
                name: tplComp.component_name,
                variant_or_method: tplComp.preparation_state,
                preparation_state: tplComp.preparation_state,
                estimated_portion_g: tplComp.default_weight_g,
                observation_type: 'inferred_ingredient',
                notes: tplComp.notes
              });
            }
          }
        }
      } else {
        // Decompose single dish label (e.g., "Nasi Goreng") into full component breakdown
        componentList = template.components.map(c => ({
          name: c.component_name,
          variant_or_method: c.preparation_state,
          preparation_state: c.preparation_state,
          estimated_portion_g: c.default_weight_g,
          observation_type: c.observation_type,
          notes: c.notes
        }));
      }

      const calculation = await this.calculateMealNutrition(componentList, supabase, options);
      return {
        is_decomposed_template: true,
        dish_name: template.dish_name_id,
        calculation
      };
    }

    // Non-template mixed meal: ensure if fried dish lacks explicit cooking oil component, add inferred cooking oil
    const workingItems: IdentifiedFoodItem[] = (observedItems || []).map(item => ({
      ...item,
      observation_type: item.observation_type || 'directly_observed'
    }));

    const lowerDish = (dishName || '').toLowerCase();
    const isFriedMixedDish =
      lowerDish.includes('fried rice') ||
      lowerDish.includes('nasi goreng') ||
      lowerDish.includes('mie goreng') ||
      lowerDish.includes('kwetiau goreng') ||
      lowerDish.includes('bihun goreng') ||
      lowerDish.includes('stir fry') ||
      lowerDish.includes('tumis');

    if (isFriedMixedDish && workingItems.length > 0) {
      const hasOil = workingItems.some(
        i => i.name.toLowerCase().includes('oil') || i.name.toLowerCase().includes('minyak')
      );
      if (!hasOil) {
        workingItems.push({
          name: 'Cooking Oil (Minyak Goreng)',
          variant_or_method: 'fried',
          preparation_state: 'fried',
          estimated_portion_g: 10,
          observation_type: 'inferred_ingredient',
          notes: 'Inferred cooking oil absorbed during stir-frying'
        });
      }
    }

    const calculation = await this.calculateMealNutrition(workingItems, supabase, options);
    return {
      is_decomposed_template: false,
      dish_name: dishName,
      calculation
    };
  }
}

export const normalizeMealNutrition = (
  items: IdentifiedFoodItem[],
  supabase?: SupabaseClient
) => NutritionNormalizer.calculateMealNutrition(items, supabase);

export const decomposeAndCalculateMixedMeal = (
  dishName: string,
  observedItems?: IdentifiedFoodItem[],
  supabase?: SupabaseClient
) => NutritionNormalizer.decomposeAndCalculateMixedMeal(dishName, observedItems, supabase);

