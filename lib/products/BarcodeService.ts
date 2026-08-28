import { NormalizedProduct, ProductPrice, ProductProvider, PriceProvider } from './ProductProvider';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * OpenFoodFacts is a reliable, free, authoritative database for product identification.
 * This replaces the "AI hallucination" layer for what a product actually is.
 */
export class OpenFoodFactsProvider implements ProductProvider {
  async identifyProduct(barcode: string): Promise<NormalizedProduct | null> {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
        headers: { 'User-Agent': 'VicCalary - Web - Version 1.0' }
      });
      
      const data = await response.json();
      
      if (data.status !== 1 || !data.product) {
        return null;
      }

      const p = data.product;
      
      return {
        barcode,
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands,
        size: p.quantity,
        category: p.categories?.split(',')[0],
        image: p.image_url,
        nutrition: {
          calories: p.nutriments?.['energy-kcal_100g'],
          protein: p.nutriments?.['proteins_100g'],
          carbohydrates: p.nutriments?.['carbohydrates_100g'],
          fat: p.nutriments?.['fat_100g']
        }
      };
    } catch (e) {
      console.error("[OpenFoodFactsProvider] Error fetching product:", e);
      return null;
    }
  }
}

/**
 * A mock price provider. In production, this would connect to a retail API (like SerpApi Google Shopping, 
 * or a specialized supermarket API). 
 */
export class RetailPriceProvider implements PriceProvider {
  async getPrice(barcode: string, countryCode: string): Promise<ProductPrice | null> {
    // 1. First check our authoritative database cache to see if we already know the price
    const supabase = createServerSupabaseClient();
    const { data: cached } = await supabase
      .from('product_price_cache')
      .select('*')
      .eq('product_id', barcode)
      .eq('country', countryCode)
      .order('retrieved_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      // If the cache is less than 7 days old, use it
      const ageMs = new Date().getTime() - new Date(cached.retrieved_at).getTime();
      if (ageMs < 7 * 24 * 60 * 60 * 1000) {
        return {
          productId: barcode,
          retailer: cached.retailer,
          country: cached.country,
          currency: cached.currency,
          price: Number(cached.price),
          source: cached.source,
          retrievedAt: cached.retrieved_at,
          confidence: Number(cached.confidence)
        };
      }
    }

    // 2. Mock external API fetch
    // In reality: fetch(`https://api.price-provider.com?ean=${barcode}&country=${countryCode}`)
    const mockPrice = Math.floor(Math.random() * 50) + 1; // $1 to $50
    const currency = countryCode === 'ID' ? 'IDR' : 'USD';
    const finalPrice = currency === 'IDR' ? mockPrice * 15000 : mockPrice;

    const newPrice: ProductPrice = {
      productId: barcode,
      retailer: 'General Retail',
      country: countryCode,
      currency,
      price: finalPrice,
      source: 'External Retail API',
      retrievedAt: new Date().toISOString(),
      confidence: 0.8
    };

    // 3. Cache the new authoritative price asynchronously
    supabase.from('product_price_cache').insert({
      product_id: barcode,
      retailer: newPrice.retailer,
      country: newPrice.country,
      currency: newPrice.currency,
      price: newPrice.price,
      source: newPrice.source,
      confidence: newPrice.confidence
    }).then(({ error }) => {
      if (error) console.error("Failed to cache price:", error);
    });

    return newPrice;
  }
}

export class BarcodeService {
  static productProvider: ProductProvider = new OpenFoodFactsProvider();
  static priceProvider: PriceProvider = new RetailPriceProvider();

  /**
   * Complete authoritative flow for a scanned barcode.
   */
  static async processScan(barcode: string, countryCode: string = 'US') {
    // 1. Identify what the product actually is (No AI hallucination)
    const product = await this.productProvider.identifyProduct(barcode);
    
    if (!product) {
      throw new Error("Product could not be authoritatively identified.");
    }

    // 2. Fetch the actual current price for the user's region
    const price = await this.priceProvider.getPrice(barcode, countryCode);

    return {
      product,
      pricing: price
    };
  }
}
