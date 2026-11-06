export interface SourceNutrientBasisValues {
  calories_kcal?: number;
  energy_kj?: number;
  protein_g?: number;
  carbohydrates_g?: number;
  fat_g?: number;
  saturated_fat_g?: number;
  trans_fat_g?: number;
  cholesterol_mg?: number;
  fiber_g?: number;
  sugar_g?: number;
  added_sugar_g?: number;
  sodium_mg?: number;
}

export interface NormalizedProductNutrition {
  calories?: number;
  calories_exact?: number;
  energy_kj?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  saturated_fat?: number;
  trans_fat?: number;
  cholesterol_mg?: number;
  fiber?: number;
  sugar?: number;
  added_sugar?: number;
  sodium_mg?: number;
  servings_per_container?: string;
  servings_per_package?: number;
  vitamins?: string[];
  minerals?: string[];
  basis?: 'serving' | '100g' | '100ml' | 'package';
  daily_values?: {
    fat?: number;
    saturated_fat?: number;
    cholesterol?: number;
    sodium?: number;
    carbohydrates?: number;
    fiber?: number;
    added_sugar?: number;
    protein?: number;
  };
  original_source_values?: {
    per_100g?: SourceNutrientBasisValues;
    per_100ml?: SourceNutrientBasisValues;
    per_serving?: SourceNutrientBasisValues & {
      serving_size?: string;
      serving_weight_g?: number;
    };
    per_package?: {
      calories_kcal?: number;
      package_weight_g?: number;
      servings_per_package?: number;
    };
  };
  calculated_consumption?: {
    servings_consumed: number;
    consumed_weight_g?: number;
    calories: number;
    calories_exact: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    saturated_fat_g?: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
    basis_used: 'per_serving' | 'per_100g' | 'per_100ml' | 'per_package';
    formula_audit: string[];
  };
  source_api?: string;
  retrieved_at?: string;
  completeness_score?: number;
  status?: 'verified' | 'database-derived' | 'label-extracted' | 'estimated' | 'requires-confirmation' | 'ocr' | 'unavailable';
}

export interface NormalizedProduct {
  barcode: string;
  name: string;
  generic_name?: string;
  brand?: string;
  manufacturer?: string;
  origin_country?: string;
  origin_country_code?: string;
  shopping_market_country?: string;
  size?: string;
  package_quantity_g?: number;
  servings_per_package?: number;
  unit?: string;
  category?: string;
  categories_list?: string[];
  image?: string;
  image_nutrition_url?: string;
  image_ingredients_url?: string;
  serving_size?: string;
  serving_quantity_g?: number;
  ingredients?: string | null;
  factory_ingredients_statement?: string;
  contains_statement?: string;
  factory_ingredients_breakdown?: Array<{
    name: string;
    sub_ingredients?: string;
    percentage?: string;
  }>;
  ingredients_status?: 'verified' | 'database-derived' | 'label-extracted' | 'ocr' | 'unavailable';
  ingredients_source?: string;
  allergens?: string[];
  traces?: string[];
  additives?: string[];
  nutriscore_grade?: string;
  nova_group?: number;
  coloring?: any;
  nutrition?: NormalizedProductNutrition;
  completeness?: {
    has_name: boolean;
    has_brand: boolean;
    has_nutrition: boolean;
    has_serving_size: boolean;
    has_ingredients: boolean;
    score: number;
    status: 'complete' | 'partial' | 'incomplete';
  };
  discrepancy?: {
    discrepancy_detected: boolean;
    database_record?: {
      calories_per_serving?: number;
      calories_per_100g?: number;
      serving_size?: string;
      source?: string;
    };
    label_record?: {
      calories_per_serving?: number;
      calories_per_100g?: number;
      serving_size?: string;
      source?: string;
    };
    prioritized_source: 'physical_package_label' | 'database_record';
    explanation: string;
  };
}

export interface ProductPrice {
  productId: string;
  retailer?: string;
  country: string;
  origin_country?: string;
  shopping_market_country?: string;
  ip_country_name?: string;
  ip_address?: string;
  currency: string;
  price: number | null;
  price_min?: number;
  price_max?: number;
  price_range?: string;
  status: 'verified' | 'database-derived' | 'estimated' | 'needs_user_price' | 'unavailable';
  source: string;
  retrievedAt: string;
  confidence: number;
  needs_user_price?: boolean;
  reference_estimate?: {
    amount: number;
    currency: string;
    formatted: string;
    label: string;
  };
}

export interface ProductProvider {
  identifyProduct(barcode: string, packageImage?: string): Promise<NormalizedProduct | null>;
}

export interface PriceProvider {
  getPrice(
    barcode: string,
    countryCode: string,
    productCategory?: string,
    productName?: string,
    ipAddress?: string,
    sizeStr?: string,
    brand?: string,
    originCountry?: string
  ): Promise<ProductPrice | null>;
}
