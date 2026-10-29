export interface NormalizedProductNutrition {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  saturated_fat?: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
  vitamins?: string[];
  minerals?: string[];
  basis?: 'serving' | '100g';
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
  currency: string;
  price: number | null;
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
    sizeStr?: string
  ): Promise<ProductPrice | null>;
}
