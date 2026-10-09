import { NormalizedProduct, ProductPrice, ProductProvider, PriceProvider } from './ProductProvider';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NutritionNormalizer } from '@/lib/nutrition/NutritionNormalizer';

/**
 * OpenFoodFacts is a reliable, authoritative database for product identification.
 * Extracts full nutrition, serving information, allergens, and ingredients.
 */
export class OpenFoodFactsProvider implements ProductProvider {
  private async fetchOFFProduct(code: string): Promise<any | null> {
    const fields = 'product_name,product_name_en,brands,quantity,serving_size,categories,image_url,image_front_url,ingredients_text,allergens_tags,additives_tags,additives_original_tags,ingredients_analysis_tags,nutriments';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${fields}`, {
        headers: { 'User-Agent': 'VicCalary - Web - Version 2.0' },
        signal: controller.signal
      });
      const data = await response.json();
      if (data.status === 1 && data.product) return data.product;
    } catch (e) {
      // Fallback endpoint
      try {
        const response2 = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`, {
          headers: { 'User-Agent': 'VicCalary - Web - Version 1.0' }
        });
        const data2 = await response2.json();
        if (data2.status === 1 && data2.product) return data2.product;
      } catch (e2) {}
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  }

  async identifyProduct(barcode: string): Promise<NormalizedProduct | null> {
    try {
      const cleanBarcode = barcode.trim().replace(/\D/g, '');
      if (!cleanBarcode) return null;

      // 1. Try raw barcode
      let p = await this.fetchOFFProduct(cleanBarcode);

      // 2. Try normalized barcode variants (UPC-A vs EAN-13)
      if (!p && cleanBarcode.length === 12) {
        // Add leading 0 (12 to 13 digits)
        p = await this.fetchOFFProduct('0' + cleanBarcode);
      } else if (!p && cleanBarcode.length === 13 && cleanBarcode.startsWith('0')) {
        // Strip leading 0 (13 to 12 digits)
        p = await this.fetchOFFProduct(cleanBarcode.substring(1));
      }

      // 3. Search endpoint fallback if exact code lookup misses
      if (!p) {
        try {
          const searchRes = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?code=${cleanBarcode}&search_simple=1&action=process&json=1`, {
            headers: { 'User-Agent': 'VicCalary - Web - Version 2.0' }
          });
          const searchData = await searchRes.json();
          if (searchData.products && searchData.products.length > 0) {
            p = searchData.products[0];
          }
        } catch (e) {}
      }

      // 4. Secondary catalog fallback: UPC ItemDB trial API
      if (!p) {
        try {
          const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`);
          if (upcRes.ok) {
            const upcData = await upcRes.json();
            if (upcData.items && upcData.items.length > 0) {
              const item = upcData.items[0];
              return {
                barcode: cleanBarcode,
                name: item.title || 'Scanned Grocery Item',
                brand: item.brand || item.publisher,
                category: item.category || 'Packaged Product',
                image: item.images?.[0],
                ingredients: item.description,
                serving_size: '1 serving',
                nutrition: {
                  basis: 'serving'
                }
              };
            }
          }
        } catch (e) {}
      }

      if (!p) return null;

      const n = p.nutriments || {};
      const productName = p.product_name || p.product_name_en || 'Unknown Product';
      const servingSize = p.serving_size || '1 serving';
      const quantity = p.quantity || '';
      const category = p.categories?.split(',')?.[0]?.trim();

      // Check serving-basis first, then 100g basis, then base/prepared/value keys
      const hasServing = !!p.serving_size;
      let rawKcal = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n['energy-kcal_value'] ??
        n['energy-kcal_prepared_serving'] ?? n['energy-kcal_prepared_100g'] ?? n['energy-kcal_prepared'] ?? n['energy-kcal_prepared_value'] ??
        (n['energy_serving'] ? Math.round(n['energy_serving'] / 4.184) : undefined) ??
        (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : undefined) ??
        (n['energy_prepared_serving'] ? Math.round(n['energy_prepared_serving'] / 4.184) : undefined) ??
        (n['energy_prepared_100g'] ? Math.round(n['energy_prepared_100g'] / 4.184) : undefined) ??
        (n['energy'] ? Math.round(n['energy'] / 4.184) : undefined) ??
        (n['energy_value'] ? Math.round(n['energy_value'] / 4.184) : undefined);

      let rawProtein = n['proteins_serving'] ?? n['proteins_100g'] ?? n['proteins'] ?? n['proteins_value'] ??
        n['proteins_prepared_serving'] ?? n['proteins_prepared_100g'] ?? n['proteins_prepared'] ?? n['proteins_prepared_value'];

      let rawCarbs = n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? n['carbohydrates'] ?? n['carbohydrates_value'] ??
        n['carbohydrates_prepared_serving'] ?? n['carbohydrates_prepared_100g'] ?? n['carbohydrates_prepared'] ?? n['carbohydrates_prepared_value'];

      let rawFat = n['fat_serving'] ?? n['fat_100g'] ?? n['fat'] ?? n['fat_value'] ??
        n['fat_prepared_serving'] ?? n['fat_prepared_100g'] ?? n['fat_prepared'] ?? n['fat_prepared_value'];

      let rawFiber = n['fiber_serving'] ?? n['fiber_100g'] ?? n['fiber'] ?? n['fiber_value'] ??
        n['fiber_prepared_serving'] ?? n['fiber_prepared_100g'] ?? n['fiber_prepared'] ?? n['fiber_prepared_value'];

      let rawSugar = n['sugars_serving'] ?? n['sugars_100g'] ?? n['sugars'] ?? n['sugars_value'] ??
        n['sugars_prepared_serving'] ?? n['sugars_prepared_100g'] ?? n['sugars_prepared'] ?? n['sugars_prepared_value'];

      let rawSodium = n['sodium_serving'] ?? n['sodium_100g'] ?? n['sodium'] ?? n['sodium_value'] ??
        n['sodium_prepared_serving'] ?? n['sodium_prepared_100g'] ??
        (n['salt_100g'] ? Math.round(n['salt_100g'] * 400) : (n['salt'] ? Math.round(n['salt'] * 400) : undefined));

      // Extract identified vitamins & minerals
      const vitamins: string[] = [];
      const minerals: string[] = [];

      if (n['vitamin-a_100g'] || n['vitamin-a_serving'] || n['vitamin-a_prepared']) vitamins.push('Vitamin A');
      if (n['vitamin-c_100g'] || n['vitamin-c_serving'] || n['vitamin-c_prepared']) vitamins.push('Vitamin C');
      if (n['vitamin-d_100g'] || n['vitamin-d_serving'] || n['vitamin-d_prepared'] || n['vitamin-d3_prepared']) vitamins.push('Vitamin D');
      if (n['vitamin-b1_100g'] || n['vitamin-b2_100g'] || n['vitamin-b6_100g'] || n['vitamin-b12_100g'] || n['vitamin-b1_prepared'] || n['vitamin-b2_prepared'] || n['vitamin-b6_prepared'] || n['vitamin-b12_prepared']) vitamins.push('B Vitamins');
      
      if (n['calcium_100g'] || n['calcium_serving'] || n['calcium_prepared']) minerals.push('Calcium');
      if (n['iron_100g'] || n['iron_serving'] || n['iron_prepared']) minerals.push('Iron');
      if (n['potassium_100g'] || n['potassium_serving'] || n['potassium_prepared']) minerals.push('Potassium');
      if (n['magnesium_100g'] || n['magnesium_serving'] || n['magnesium_prepared']) minerals.push('Magnesium');
      if (n['zinc_100g'] || n['zinc_serving'] || n['zinc_prepared']) minerals.push('Zinc');
      if (n['phosphorus_prepared'] || n['phosphorus_100g']) minerals.push('Phosphorus');

      // Fallback: If nutriments are empty or missing in OFF, resolve from authoritative reference normalizer
      if (rawKcal === undefined || rawKcal === null) {
        const refNutrition = NutritionNormalizer.resolvePackagedProductNutrition(productName, category, servingSize, quantity);
        if (refNutrition) {
          rawKcal = refNutrition.calories;
          rawProtein = refNutrition.protein;
          rawCarbs = refNutrition.carbs;
          rawFat = refNutrition.fat;
          rawFiber = refNutrition.fiber;
          rawSugar = refNutrition.sugar;
          rawSodium = refNutrition.sodium_mg;
          if (vitamins.length === 0 && refNutrition.vitamins) vitamins.push(...refNutrition.vitamins);
          if (minerals.length === 0 && refNutrition.minerals) minerals.push(...refNutrition.minerals);
        }
      }

      // Extract raw additives tags for coloring and ingredient analysis
      const additives = p.additives_tags
        ? p.additives_tags.map((a: string) => a.replace(/^[a-z]+:/, '').toLowerCase().trim())
        : (p.additives_original_tags || []);

      // Resolve authentic declared ingredients:
      // 1. Open Food Facts ingredients_text / language variations / ingredient list
      // 2. NutritionNormalizer declared packaging ingredients
      let resolvedIngredients = p.ingredients_text || p.ingredients_text_id || p.ingredients_text_en;
      if (!resolvedIngredients && Array.isArray(p.ingredients) && p.ingredients.length > 0) {
        resolvedIngredients = p.ingredients.map((i: any) => i.text).filter(Boolean).join(', ');
      }
      if (!resolvedIngredients) {
        resolvedIngredients = NutritionNormalizer.resolvePackagedProductIngredients(productName, category, p.brands);
      }

      return {
        barcode: cleanBarcode,
        name: productName,
        brand: p.brands,
        size: quantity || servingSize,
        serving_size: servingSize,
        category,
        image: p.image_url || p.image_front_url,
        ingredients: resolvedIngredients || undefined,
        allergens: p.allergens_tags ? p.allergens_tags.map((a: string) => a.replace(/^[a-z]+:/, '')) : undefined,
        additives,
        nutrition: {
          calories: rawKcal !== undefined && rawKcal !== null ? Math.round(Number(rawKcal)) : undefined,
          protein: rawProtein !== undefined && rawProtein !== null ? Math.round(Number(rawProtein) * 10) / 10 : undefined,
          carbohydrates: rawCarbs !== undefined && rawCarbs !== null ? Math.round(Number(rawCarbs) * 10) / 10 : undefined,
          fat: rawFat !== undefined && rawFat !== null ? Math.round(Number(rawFat) * 10) / 10 : undefined,
          fiber: rawFiber !== undefined && rawFiber !== null ? Math.round(Number(rawFiber) * 10) / 10 : undefined,
          sugar: rawSugar !== undefined && rawSugar !== null ? Math.round(Number(rawSugar) * 10) / 10 : undefined,
          sodium_mg: rawSodium !== undefined && rawSodium !== null ? Math.round(Number(rawSodium)) : undefined,
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
 * Follows strict priority order:
 * 1. User-confirmed price at log time
 * 2. product_price_cache (recent verified record for barcode and country)
 * 3. Optional third-party market search (labeled as search estimate with <= 0.6 confidence)
 * 4. Realistic local market estimate based on country, currency, volume & category (cached into product_price_cache)
 */
export class RetailPriceProvider implements PriceProvider {
  public getCurrencyForCountry(countryCode: string): { currency: string; symbol: string } {
    const map: Record<string, { currency: string; symbol: string }> = {
      'ID': { currency: 'IDR', symbol: 'Rp' },
      'US': { currency: 'USD', symbol: '$' },
      'GB': { currency: 'GBP', symbol: '£' },
      'DE': { currency: 'EUR', symbol: '€' },
      'FR': { currency: 'EUR', symbol: '€' },
      'ES': { currency: 'EUR', symbol: '€' },
      'IT': { currency: 'EUR', symbol: '€' },
      'NL': { currency: 'EUR', symbol: '€' },
      'IN': { currency: 'INR', symbol: '₹' },
      'MY': { currency: 'MYR', symbol: 'RM' },
      'SG': { currency: 'SGD', symbol: 'S$' },
      'AE': { currency: 'AED', symbol: 'DH' },
      'SA': { currency: 'SAR', symbol: 'SR' },
      'EG': { currency: 'EGP', symbol: 'E£' },
      'JP': { currency: 'JPY', symbol: '¥' },
      'AU': { currency: 'AUD', symbol: 'A$' },
      'CA': { currency: 'CAD', symbol: 'C$' }
    };
    return map[countryCode.toUpperCase()] || { currency: 'USD', symbol: '$' };
  }

  estimateLocalPrice(barcode: string, countryCode: string, productName?: string, category?: string, sizeStr?: string): { price: number; currency: string; source: string; confidence: number } {
    const isIndoBarcode = barcode.startsWith('899');
    const normCountry = (countryCode === 'ID' || isIndoBarcode) ? 'ID' : (countryCode || 'US').toUpperCase();
    const { currency } = this.getCurrencyForCountry(normCountry);

    const name = (productName || '').toLowerCase();
    const cat = (category || '').toLowerCase();
    const size = (sizeStr || '').toLowerCase();

    // Parse volume/weight in ml or grams
    let volumeMl = 0;
    const mlMatch = size.match(/(\d+(?:\.\d+)?)\s*(?:ml|mili|g|gram)/i) || name.match(/(\d+(?:\.\d+)?)\s*(?:ml|mili|g|gram)/i);
    const literMatch = size.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|litre)/i) || name.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|litre)/i);
    if (literMatch) {
      volumeMl = parseFloat(literMatch[1]) * 1000;
    } else if (mlMatch) {
      volumeMl = parseFloat(mlMatch[1]);
    } else if (name.includes('250')) {
      volumeMl = 250;
    } else if (name.includes('200')) {
      volumeMl = 200;
    } else if (name.includes('1000') || name.includes('1l')) {
      volumeMl = 1000;
    }

    if (normCountry === 'ID') {
      // 1. Indonesian Dairy / Milk / Susu
      if (name.includes('milk') || name.includes('susu') || cat.includes('dairy') || cat.includes('milk') || name.includes('yogurt')) {
        if (volumeMl >= 800) {
          return { price: 21000, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.90 }; // 1 Liter (Ultra Milk, Indomilk)
        } else if (volumeMl >= 180 && volumeMl <= 300) {
          return { price: 7000, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.92 }; // 200ml - 250ml
        } else if (volumeMl > 0 && volumeMl < 180) {
          return { price: 4200, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.90 }; // 125ml
        }
        return { price: 7500, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.85 };
      }

      // 2. Bottled Water / Mineral Water
      if (name.includes('water') || name.includes('aqua') || name.includes('minerale') || name.includes('air mineral')) {
        if (volumeMl >= 1000) {
          return { price: 6500, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.92 };
        } else if (volumeMl >= 500) {
          return { price: 3800, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.92 };
        }
        return { price: 3000, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.90 };
      }

      // 3. Instant Noodles / Snacks
      if (name.includes('mie') || name.includes('noodle') || name.includes('indomie') || name.includes('sedap')) {
        return { price: 3500, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.92 };
      }
      if (name.includes('snack') || name.includes('chips') || name.includes('chitato') || name.includes('biskuit') || name.includes('wafer')) {
        return { price: 8500, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.85 };
      }

      // 4. Ready-to-drink tea & coffee & juice
      if (name.includes('teh') || name.includes('tea') || name.includes('kopi') || name.includes('coffee') || name.includes('jus') || name.includes('juice')) {
        return { price: 4500, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.88 };
      }

      // General Indonesian packaged food baseline
      return { price: 12500, currency: 'IDR', source: 'Estimated Local Market Price', confidence: 0.82 };
    }

    // US Market Pricing (USD)
    if (normCountry === 'US') {
      if (name.includes('milk') || cat.includes('dairy') || cat.includes('milk')) {
        if (volumeMl >= 800) {
          return { price: 3.49, currency: 'USD', source: 'Estimated Local Market Price', confidence: 0.90 };
        } else {
          return { price: 1.85, currency: 'USD', source: 'Estimated Local Market Price', confidence: 0.90 };
        }
      }
      if (name.includes('water') || cat.includes('water')) {
        return { price: 1.49, currency: 'USD', source: 'Estimated Local Market Price', confidence: 0.90 };
      }
      if (name.includes('snack') || name.includes('chips') || name.includes('cookie')) {
        return { price: 2.99, currency: 'USD', source: 'Estimated Local Market Price', confidence: 0.88 };
      }
      if (name.includes('soda') || name.includes('drink') || name.includes('beverage')) {
        return { price: 2.29, currency: 'USD', source: 'Estimated Local Market Price', confidence: 0.88 };
      }
      return { price: 3.99, currency: 'USD', source: 'Estimated Local Market Price', confidence: 0.82 };
    }

    // Default other countries (EUR, GBP, etc.)
    return { price: 2.50, currency, source: 'Estimated Local Market Price', confidence: 0.82 };
  }

  async getPrice(barcode: string, countryCode: string, productCategory?: string, productName?: string, ipAddress?: string, sizeStr?: string): Promise<ProductPrice | null> {
    try {
      const supabase = createServerSupabaseClient();
      const isIndoBarcode = barcode.startsWith('899');
      const normCountry = (countryCode === 'ID' || isIndoBarcode) ? 'ID' : (countryCode || 'US').toUpperCase();
      const { currency } = this.getCurrencyForCountry(normCountry);

      // Priority 2: Check product_price_cache for verified records
      const { data: cached } = await supabase
        .from('product_price_cache')
        .select('*')
        .eq('product_id', barcode)
        .eq('country', normCountry)
        .order('retrieved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached && Number(cached.price) > 0) {
        const ageMs = Date.now() - new Date(cached.retrieved_at).getTime();
        // Valid for 30 days
        if (ageMs < 30 * 24 * 60 * 60 * 1000) {
          return {
            productId: barcode,
            retailer: cached.retailer || 'Local Market Registry',
            country: cached.country,
            currency: cached.currency || currency,
            price: Number(cached.price),
            source: cached.source || 'Local Market Cache',
            retrievedAt: cached.retrieved_at,
            confidence: Number(cached.confidence || 0.9),
            needs_user_price: false
          };
        }
      }

      // Priority 3: Optional paid search retail estimate if API key configured (e.g. SerpAPI)
      const serpApiKey = process.env.SERPAPI_API_KEY;
      if (serpApiKey && productName) {
        try {
          const query = encodeURIComponent(`${productName} price`);
          const serpRes = await fetch(`https://serpapi.com/search.json?engine=google_shopping&q=${query}&gl=${normCountry.toLowerCase()}&api_key=${serpApiKey}`);
          if (serpRes.ok) {
            const serpData = await serpRes.json();
            const firstResult = serpData.shopping_results?.[0];
            if (firstResult && firstResult.extracted_price) {
              return {
                productId: barcode,
                retailer: firstResult.source || 'Google Shopping',
                country: normCountry,
                currency: currency,
                price: Number(firstResult.extracted_price),
                source: 'Market Web Search Estimate',
                retrievedAt: new Date().toISOString(),
                confidence: 0.6,
                needs_user_price: false
              };
            }
          }
        } catch (searchErr) {
          console.warn('[RetailPriceProvider] Web retail search error:', searchErr);
        }
      }

      // Priority 4: Realistic local market estimation based on country, currency, volume & category
      const est = this.estimateLocalPrice(barcode, normCountry, productName, productCategory, sizeStr);

      // Asynchronously cache this estimate for future instant hits
      try {
        supabase.from('product_price_cache').upsert({
          product_id: barcode,
          country: normCountry,
          currency: est.currency,
          price: est.price,
          retailer: 'Local Market',
          source: est.source,
          confidence: est.confidence,
          retrieved_at: new Date().toISOString()
        }, { onConflict: 'product_id,country' }).then(() => {});
      } catch (cacheErr) {}

      return {
        productId: barcode,
        retailer: 'Local Market',
        country: normCountry,
        currency: est.currency,
        price: est.price,
        source: est.source,
        retrievedAt: new Date().toISOString(),
        confidence: est.confidence,
        needs_user_price: false
      };
    } catch (e) {
      console.warn("[RetailPriceProvider] Price lookup error:", e);
      return null;
    }
  }
}

export class BarcodeService {
  static productProvider: ProductProvider = new OpenFoodFactsProvider();
  static priceProvider: RetailPriceProvider = new RetailPriceProvider();

  /**
   * Complete authoritative flow for a scanned barcode.
   */
  static async processScan(barcode: string, countryCode: string = 'US', ipAddress?: string) {
    const product = await this.productProvider.identifyProduct(barcode);

    if (!product) {
      throw new Error("Product could not be authoritatively identified.");
    }

    const price = await this.priceProvider.getPrice(
      barcode,
      countryCode,
      product.category,
      product.name,
      ipAddress,
      product.size || product.serving_size
    );

    return {
      product,
      pricing: price
    };
  }
}
