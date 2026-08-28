export interface NormalizedProduct {
  barcode: string;
  name: string;
  brand?: string;
  size?: string;
  unit?: string;
  category?: string;
  image?: string;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
  };
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
