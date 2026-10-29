export interface NormalizedProductNutrition {
  calories?: number;
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
  vitamins?: string[];
  minerals?: string[];
  basis?: 'serving' | '100g';
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
  status?: 'verified' | 'ocr' | 'unavailable';
}

export interface NormalizedProduct {
  barcode: string;
  name: string;
  generic_name?: string;
  brand?: string;
  manufacturer?: string;
  origin_country?: string;
  size?: string;
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
  ingredients_status?: 'verified' | 'ocr' | 'unavailable';
  allergens?: string[];
  traces?: string[];
  additives?: string[];
  nutriscore_grade?: string;
  nova_group?: number;
  coloring?: any;
  nutrition?: NormalizedProductNutrition;
}

export interface ProductPrice {
  productId: string;
  retailer?: string;
  country: string;
  ip_country_name?: string;
  ip_address?: string;
  currency: string;
  price: number | null;
  price_min?: number;
  price_max?: number;
  price_range?: string;
  status: 'verified' | 'estimated' | 'needs_user_price';
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
    brand?: string
  ): Promise<ProductPrice | null>;
}
