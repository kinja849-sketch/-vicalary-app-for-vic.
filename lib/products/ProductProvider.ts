export interface NormalizedProductNutrition {
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
  vitamins?: string[];
  minerals?: string[];
  basis?: 'serving' | '100g';
}

export interface NormalizedProduct {
  barcode: string;
  name: string;
  brand?: string;
  size?: string;
  unit?: string;
  category?: string;
  image?: string;
  serving_size?: string;
  ingredients?: string;
  allergens?: string[];
  nutrition?: NormalizedProductNutrition;
}

export interface ProductPrice {
  productId: string;
  retailer?: string;
  country: string;
  currency: string;
  price: number;
  source: string;
  retrievedAt: string;
  confidence: number;
}

export interface ProductProvider {
  identifyProduct(barcode: string): Promise<NormalizedProduct | null>;
}

export interface PriceProvider {
  getPrice(barcode: string, countryCode: string): Promise<ProductPrice | null>;
}
