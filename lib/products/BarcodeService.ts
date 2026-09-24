import { NormalizedProduct, ProductPrice, ProductProvider, PriceProvider } from './ProductProvider';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * OpenFoodFacts is a reliable, authoritative database for product identification.
 * Extracts full nutrition, serving information, allergens, and ingredients.
 */
export class OpenFoodFactsProvider implements ProductProvider {
  async identifyProduct(barcode: string): Promise<NormalizedProduct | null> {
    try {
      const fields = 'product_name,product_name_en,brands,quantity,serving_size,categories,image_url,image_front_url,ingredients_text,allergens_tags,nutriments';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response: Response;
      try {
        response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`, {
          headers: { 'User-Agent': 'VicCalary - Web - Version 2.0' },
          signal: controller.signal
        });
      } catch {
        // Fallback to standard endpoint
        response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
          headers: { 'User-Agent': 'VicCalary - Web - Version 1.0' }
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json();

      if (data.status !== 1 || !data.product) {
        return null;
      }

      const p = data.product;
      const n = p.nutriments || {};

      // Check serving-basis first, then 100g basis
      const hasServing = !!p.serving_size;
      const calories = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? (n['energy_serving'] ? Math.round(n['energy_serving'] / 4.184) : undefined) ?? (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : undefined);
      const protein = n['proteins_serving'] ?? n['proteins_100g'] ?? undefined;
      const carbohydrates = n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? undefined;
      const fat = n['fat_serving'] ?? n['fat_100g'] ?? undefined;
      const fiber = n['fiber_serving'] ?? n['fiber_100g'] ?? undefined;
      const sugar = n['sugars_serving'] ?? n['sugars_100g'] ?? undefined;
      const sodium = n['sodium_serving'] ?? n['sodium_100g'] ?? (n['salt_100g'] ? Math.round(n['salt_100g'] * 400) : undefined);

      // Extract identified vitamins & minerals
      const vitamins: string[] = [];
      const minerals: string[] = [];

      if (n['vitamin-a_100g'] || n['vitamin-a_serving']) vitamins.push('Vitamin A');
      if (n['vitamin-c_100g'] || n['vitamin-c_serving']) vitamins.push('Vitamin C');
      if (n['vitamin-d_100g'] || n['vitamin-d_serving']) vitamins.push('Vitamin D');
      if (n['vitamin-b1_100g'] || n['vitamin-b2_100g'] || n['vitamin-b6_100g'] || n['vitamin-b12_100g']) vitamins.push('B Vitamins');
      
      if (n['calcium_100g'] || n['calcium_serving']) minerals.push('Calcium');
      if (n['iron_100g'] || n['iron_serving']) minerals.push('Iron');
      if (n['potassium_100g'] || n['potassium_serving']) minerals.push('Potassium');
      if (n['magnesium_100g'] || n['magnesium_serving']) minerals.push('Magnesium');
      if (n['zinc_100g'] || n['zinc_serving']) minerals.push('Zinc');

      return {
        barcode,
        name: p.product_name || p.product_name_en || 'Unknown Product',
        brand: p.brands,
        size: p.quantity,
        serving_size: p.serving_size || '1 serving',
        category: p.categories?.split(',')?.[0]?.trim(),
        image: p.image_url || p.image_front_url,
        ingredients: p.ingredients_text,
        allergens: p.allergens_tags ? p.allergens_tags.map((a: string) => a.replace(/^[a-z]+:/, '')) : undefined,
        nutrition: {
          calories: calories !== undefined ? Math.round(Number(calories)) : undefined,
          protein: protein !== undefined ? Math.round(Number(protein) * 10) / 10 : undefined,
          carbohydrates: carbohydrates !== undefined ? Math.round(Number(carbohydrates) * 10) / 10 : undefined,
          fat: fat !== undefined ? Math.round(Number(fat) * 10) / 10 : undefined,
          fiber: fiber !== undefined ? Math.round(Number(fiber) * 10) / 10 : undefined,
          sugar: sugar !== undefined ? Math.round(Number(sugar) * 10) / 10 : undefined,
          sodium_mg: sodium !== undefined ? Math.round(Number(sodium) * 1000) : undefined,
          vitamins,
          minerals,
          basis: hasServing ? 'serving' : '100g'
        }
      };
    } catch (e) {
      console.error("[OpenFoodFactsProvider] Error fetching product:", e);
      return null;
    }
  }
}

/**
 * Authoritative price provider.
 * Looks up verified localized market pricing from product_price_cache.
 * If no credible price is recorded, strictly returns null (so UI displays "Price unavailable").
 * NEVER invents mock random prices or artificial estimates like "Rp3 (market est.)".
 */
export class RetailPriceProvider implements PriceProvider {
  async getPrice(barcode: string, countryCode: string): Promise<ProductPrice | null> {
    try {
      const supabase = createServerSupabaseClient();
      const { data: cached } = await supabase
        .from('product_price_cache')
        .select('*')
        .eq('product_id', barcode)
        .eq('country', countryCode)
        .order('retrieved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached && Number(cached.price) > 0) {
        // Cache is valid for up to 14 days
        const ageMs = Date.now() - new Date(cached.retrieved_at).getTime();
        if (ageMs < 14 * 24 * 60 * 60 * 1000) {
          return {
            productId: barcode,
            retailer: cached.retailer || 'Verified Retailer',
            country: cached.country,
            currency: cached.currency,
            price: Number(cached.price),
            source: cached.source || 'Local Market Registry',
            retrievedAt: cached.retrieved_at,
            confidence: Number(cached.confidence || 1.0)
          };
        }
      }

      // If no verified record in database, return null
      return null;
    } catch (e) {
      console.warn("[RetailPriceProvider] Price lookup error:", e);
      return null;
    }
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
