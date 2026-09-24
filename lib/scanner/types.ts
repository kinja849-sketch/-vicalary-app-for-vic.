export interface ScannedProduct {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  nutrition?: any;
}

export interface BoycottStatus {
  flagged: boolean;
  campaignId?: string;
  campaignName?: string;
  reason?: string;
  relationshipType?: 'parent' | 'subsidiary' | 'direct';
  sourceUrl?: string;
  verifiedAt?: string;
}

export interface ScannerResult {
  status:
    | "success"
    | "product_not_found"
    | "barcode_not_detected"
    | "error";

  barcode?: string;

  product?: {
    id: string;
    name: string;
    brand: string;
    size?: string;
    category: string;
    imageUrl?: string;
    source: string;
  };

  nutrition?: {
    source: string;
    servingSize?: string;
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    sugarG?: number;
    fatG?: number;
    saturatedFatG?: number;
    fiberG?: number;
    sodiumMg?: number;
  };

  price?: {
    status: "verified" | "estimated" | "unavailable";
    amount?: number;
    currency?: string;
    retailer?: string;
    source?: string;
    observedAt?: string;
  };

  boycott?: {
    status: "clear" | "flagged" | "unknown";
    campaign?: string;
    reason?: string;
    sourceUrl?: string;
    verifiedAt?: string;
  };
}

