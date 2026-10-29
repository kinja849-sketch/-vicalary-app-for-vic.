import { NormalizedProduct, ProductPrice, ProductProvider, PriceProvider } from './ProductProvider';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NutritionNormalizer } from '@/lib/nutrition/NutritionNormalizer';
import { FoodColoringService } from './FoodColoringService';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';

/**
 * Helper to OCR Nutrition Facts directly from packaging photo when database nutriments are empty.
 * Runs ONLY on APPROVED (non-boycotted) products when catalog nutrition is missing.
 */
async function extractNutritionFactsFromImage(imageUrl: string): Promise<{
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
  serving_size?: string;
} | null> {
  try {
    const prompt = `You are a clinical OCR engine extracting Nutrition Facts from a food package photo.
Carefully read the printed Nutrition Facts label on this package.
Extract ONLY verified numbers printed on the label. DO NOT guess or hallucinate.
If a value is not printed or unreadable, set it to null.

Return ONLY a valid JSON object matching this schema:
{
  "calories": number | null,
  "protein": number | null,
  "carbohydrates": number | null,
  "fat": number | null,
  "fiber": number | null,
  "sugar": number | null,
  "sodium_mg": number | null,
  "serving_size": string | null
}`;

    const res = await callChatCompletionWithFallback({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high'
            }
          }
        ]
      }],
      temperature: 0.0,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
      return {
        calories: typeof parsed.calories === 'number' && !isNaN(parsed.calories) ? parsed.calories : undefined,
        protein: typeof parsed.protein === 'number' && !isNaN(parsed.protein) ? parsed.protein : undefined,
        carbohydrates: typeof parsed.carbohydrates === 'number' && !isNaN(parsed.carbohydrates) ? parsed.carbohydrates : undefined,
        fat: typeof parsed.fat === 'number' && !isNaN(parsed.fat) ? parsed.fat : undefined,
        fiber: typeof parsed.fiber === 'number' && !isNaN(parsed.fiber) ? parsed.fiber : undefined,
        sugar: typeof parsed.sugar === 'number' && !isNaN(parsed.sugar) ? parsed.sugar : undefined,
        sodium_mg: typeof parsed.sodium_mg === 'number' && !isNaN(parsed.sodium_mg) ? parsed.sodium_mg : undefined,
        serving_size: typeof parsed.serving_size === 'string' && parsed.serving_size.trim() ? parsed.serving_size.trim() : undefined
      };
    }
  } catch (e) {
    console.warn('[BarcodeService] OCR Nutrition extraction failed:', e);
  }
  return null;
}

/**
 * Helper to OCR declared ingredients directly from packaging photo when database text is missing.
 * Runs ONLY on APPROVED (non-boycotted) products when catalog ingredients are missing.
 */
async function extractIngredientsFromImage(imageUrl: string): Promise<string | null> {
  try {
    const prompt = `You are an expert OCR engine for food packaging.
Carefully read the declared ingredients on this package photo. Locate the section starting with 'INGREDIENTS:', 'Ingredients:', or 'KOMPOSISI:'.
Extract ONLY the exact comma-separated declared ingredients list printed on the packaging.
DO NOT summarize, do NOT rewrite, do NOT hallucinate ingredients.
If no ingredients panel is visible or legible in the image, return {"ingredients": null}.

Return ONLY a valid JSON object:
{
  "ingredients": "string of comma-separated ingredients, or null"
}`;

    const res = await callChatCompletionWithFallback({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high'
            }
          }
        ]
      }],
      temperature: 0.0,
      max_tokens: 450,
      response_format: { type: 'json_object' }
    });

    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
      if (typeof parsed.ingredients === 'string' && parsed.ingredients.trim()) {
        return parsed.ingredients.trim();
      }
    }
  } catch (e) {
    console.warn('[BarcodeService] OCR Ingredients extraction failed:', e);
  }
  return null;
}

function toFiniteNonNegative(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

function cleanOFFIngredientText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '') // Strip HTML tags like <span class="allergen">
    .replace(/_([^_]+)_/g, '$1') // Strip OFF underscore emphasis _milk_
    .replace(/\s+/g, ' ')
    .trim();
}

function parseServingQuantityGrams(servingSize?: string, servingQuantity?: any): number | undefined {
  const direct = toFiniteNonNegative(servingQuantity);
  if (direct && direct > 0 && direct <= 2000) return direct;
  if (!servingSize || typeof servingSize !== 'string') return undefined;
  // Look for patterns like "30 g", "30g", "(28g)", "250 ml", "250ml"
  const parenMatch = servingSize.match(/\(\s*(\d+(?:\.\d+)?)\s*(?:g|gram|grams|ml|mili)\s*\)/i);
  if (parenMatch) {
    const val = parseFloat(parenMatch[1]);
    if (val > 0 && val <= 2000) return val;
  }
  const unitMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams|ml|mili)\b/i);
  if (unitMatch) {
    const val = parseFloat(unitMatch[1]);
    if (val > 0 && val <= 2000) return val;
  }
  return undefined;
}

/**
 * OpenFoodFacts is the authoritative database for product identification,
 * declared ingredients, allergens, additives, and packaging nutriments.
 */
export class OpenFoodFactsProvider implements ProductProvider {
  private async fetchOFFProductV2(code: string): Promise<any | null> {
    const fields = [
      'code',
      'product_name',
      'product_name_en',
      'product_name_id',
      'product_name_fr',
      'product_name_es',
      'product_name_de',
      'product_name_ar',
      'generic_name',
      'generic_name_en',
      'brands',
      'brand_owner',
      'brands_tags',
      'quantity',
      'serving_size',
      'serving_quantity',
      'nutrition_data_per',
      'categories',
      'categories_tags',
      'countries',
      'countries_tags',
      'origins',
      'manufacturing_places',
      'nutriscore_grade',
      'nova_group',
      'image_url',
      'image_front_url',
      'image_nutrition_url',
      'image_ingredients_url',
      'ingredients_text',
      'ingredients_text_en',
      'ingredients_text_id',
      'ingredients_text_fr',
      'ingredients_text_de',
      'ingredients_text_es',
      'ingredients_text_ar',
      'ingredients_text_pt',
      'ingredients_text_nl',
      'ingredients_text_it',
      'ingredients_text_with_allergens',
      'ingredients_text_with_allergens_en',
      'ingredients',
      'ingredients_tags',
      'allergens',
      'allergens_tags',
      'traces',
      'traces_tags',
      'additives_tags',
      'additives_original_tags',
      'ingredients_analysis_tags',
      'nutriments'
    ].join(',');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}?fields=${fields}`, {
        headers: { 'User-Agent': 'VicCalary - Web - Version 2.0' },
        signal: controller.signal
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.product) return data.product;
      }
    } catch (_e) {
      // Fall through to v0
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  }

  private async fetchOFFProductV0(code: string): Promise<any | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`, {
        headers: { 'User-Agent': 'VicCalary - Web - Version 2.0' },
        signal: controller.signal
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.product) return data.product;
      }
    } catch (_e) {
      // Ignore network timeout
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  }

  private hasIngredientsInRecord(p: any): boolean {
    if (!p) return false;
    if (p.ingredients_text || p.ingredients_text_en || p.ingredients_text_id || p.ingredients_text_with_allergens) {
      return true;
    }
    if (Array.isArray(p.ingredients) && p.ingredients.length > 0) return true;
    for (const key of Object.keys(p)) {
      if (key.startsWith('ingredients_text') && typeof p[key] === 'string' && p[key].trim().length > 2) {
        return true;
      }
    }
    return false;
  }

  private hasNutrimentsInRecord(p: any): boolean {
    const n = p?.nutriments;
    if (!n || typeof n !== 'object') return false;
    return (
      toFiniteNonNegative(n['energy-kcal_100g']) !== undefined ||
      toFiniteNonNegative(n['energy-kcal_serving']) !== undefined ||
      toFiniteNonNegative(n['energy-kcal']) !== undefined ||
      toFiniteNonNegative(n['energy_100g']) !== undefined ||
      toFiniteNonNegative(n['energy_serving']) !== undefined ||
      toFiniteNonNegative(n['proteins_100g']) !== undefined ||
      toFiniteNonNegative(n['proteins_serving']) !== undefined
    );
  }

  private mergeOFFProductRecords(primary: any, secondary: any): any {
    if (!primary) return secondary;
    if (!secondary) return primary;

    const merged = { ...secondary, ...primary };

    // Keep fuller strings/arrays when primary is empty
    for (const key of Object.keys(secondary)) {
      const pVal = primary[key];
      const sVal = secondary[key];
      const isPrimaryEmpty =
        pVal === undefined ||
        pVal === null ||
        pVal === '' ||
        (Array.isArray(pVal) && pVal.length === 0) ||
        (typeof pVal === 'object' && !Array.isArray(pVal) && Object.keys(pVal).length === 0);
      if (isPrimaryEmpty && sVal !== undefined && sVal !== null && sVal !== '') {
        merged[key] = sVal;
      }
    }

    // Merge nutriments object keys
    if (secondary.nutriments || primary.nutriments) {
      merged.nutriments = {
        ...(secondary.nutriments || {}),
        ...(primary.nutriments || {})
      };
    }

    return merged;
  }

  private async fetchOFFProduct(code: string): Promise<any | null> {
    let p = await this.fetchOFFProductV2(code);

    // If v2 failed or lacks ingredients/nutriments, query v0 unrestricted JSON and merge
    if (!p || !this.hasIngredientsInRecord(p) || !this.hasNutrimentsInRecord(p)) {
      const pV0 = await this.fetchOFFProductV0(code);
      p = this.mergeOFFProductRecords(p, pV0);
    }

    return p;
  }

  private extractDeclaredIngredients(p: any): string | null {
    if (!p) return null;

    // 1. Direct ingredients_text fields (prefer English, generic, Indonesian, then any regional language)
    const priorityKeys = [
      'ingredients_text_en',
      'ingredients_text',
      'ingredients_text_id',
      'ingredients_text_with_allergens_en',
      'ingredients_text_with_allergens',
      'ingredients_text_fr',
      'ingredients_text_de',
      'ingredients_text_es',
      'ingredients_text_ar',
      'ingredients_text_pt',
      'ingredients_text_nl',
      'ingredients_text_it'
    ];

    for (const key of priorityKeys) {
      if (typeof p[key] === 'string' && p[key].trim().length > 1) {
        const cleaned = cleanOFFIngredientText(p[key]);
        if (cleaned.length > 1) return cleaned;
      }
    }

    // Check any other localized ingredients_text_* key present on the OFF object
    for (const key of Object.keys(p)) {
      if (key.startsWith('ingredients_text') && typeof p[key] === 'string' && p[key].trim().length > 1) {
        const cleaned = cleanOFFIngredientText(p[key]);
        if (cleaned.length > 1) return cleaned;
      }
    }

    // 2. Structured ingredients array from Open Food Facts
    if (Array.isArray(p.ingredients) && p.ingredients.length > 0) {
      const formatIngredientNode = (node: any): string | null => {
        if (!node || typeof node.text !== 'string') return null;
        const baseText = cleanOFFIngredientText(node.text);
        if (!baseText) return null;
        if (Array.isArray(node.ingredients) && node.ingredients.length > 0) {
          const subItems = node.ingredients.map(formatIngredientNode).filter(Boolean);
          if (subItems.length > 0) {
            return `${baseText} (${subItems.join(', ')})`;
          }
        }
        return baseText;
      };

      const parts = p.ingredients.map(formatIngredientNode).filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }

    // 3. Fallback to structured ingredients_tags ONLY if present in OFF
    if (Array.isArray(p.ingredients_tags) && p.ingredients_tags.length > 0) {
      const tagItems = p.ingredients_tags
        .map((t: string) =>
          String(t)
            .replace(/^[a-z]{2,3}:/i, '')
            .replace(/-/g, ' ')
            .trim()
        )
        .filter((t: string) => t.length > 1)
        .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));

      if (tagItems.length > 0) {
        return tagItems.join(', ');
      }
    }

    return null;
  }

  private extractNutriments(p: any, productName: string, category?: string, servingSize?: string, quantity?: string) {
    const n = p?.nutriments || {};
    const servingQuantityG = parseServingQuantityGrams(servingSize, p?.serving_quantity);

    const resolveEnergyKcal = (suffix: '_serving' | '_100g' | ''): number | undefined => {
      const kcalDirect =
        toFiniteNonNegative(n[`energy-kcal${suffix}`]) ??
        toFiniteNonNegative(n[`energy-kcal_prepared${suffix}`]) ??
        (suffix === '' ? toFiniteNonNegative(n['energy-kcal_value']) : undefined);

      if (kcalDirect !== undefined) return kcalDirect;

      const kjDirect =
        toFiniteNonNegative(n[`energy-kj${suffix}`]) ??
        toFiniteNonNegative(n[`energy-kj_prepared${suffix}`]);
      if (kjDirect !== undefined) return Math.round(kjDirect / 4.184);

      const rawEnergy =
        toFiniteNonNegative(n[`energy${suffix}`]) ??
        toFiniteNonNegative(n[`energy_prepared${suffix}`]);
      if (rawEnergy !== undefined) {
        const unit = String(n[`energy_unit`] || 'kJ').toLowerCase();
        return unit === 'kcal' ? rawEnergy : Math.round(rawEnergy / 4.184);
      }

      return undefined;
    };

    const resolveMacro = (baseKey: string, suffix: '_serving' | '_100g' | ''): number | undefined => {
      return (
        toFiniteNonNegative(n[`${baseKey}${suffix}`]) ??
        toFiniteNonNegative(n[`${baseKey}_prepared${suffix}`]) ??
        (suffix === '' ? toFiniteNonNegative(n[`${baseKey}_value`]) : undefined)
      );
    };

    const resolveSodiumMg = (suffix: '_serving' | '_100g' | ''): number | undefined => {
      const rawSodium =
        toFiniteNonNegative(n[`sodium${suffix}`]) ??
        toFiniteNonNegative(n[`sodium_prepared${suffix}`]);

      if (rawSodium !== undefined) {
        if (rawSodium === 0) return 0;
        // Open Food Facts normalizes sodium_100g and sodium_serving into grams (e.g. 0.45g = 450mg).
        // If rawSodium is <= 20, it is in grams; convert to mg.
        if (rawSodium <= 20) {
          return Math.round(rawSodium * 1000);
        }
        return Math.round(rawSodium);
      }

      const rawSalt =
        toFiniteNonNegative(n[`salt${suffix}`]) ??
        toFiniteNonNegative(n[`salt_prepared${suffix}`]);

      if (rawSalt !== undefined) {
        if (rawSalt === 0) return 0;
        // 1g salt = 400mg sodium (if salt is in grams <= 50)
        return rawSalt <= 50 ? Math.round(rawSalt * 400) : Math.round(rawSalt * 0.4);
      }

      return undefined;
    };

    // Gather per-serving candidate
    let srvKcal = resolveEnergyKcal('_serving');
    let srvProt = resolveMacro('proteins', '_serving');
    let srvCarbs = resolveMacro('carbohydrates', '_serving');
    let srvFat = resolveMacro('fat', '_serving');
    let srvSatFat = resolveMacro('saturated-fat', '_serving');
    let srvFiber = resolveMacro('fiber', '_serving');
    let srvSugar = resolveMacro('sugars', '_serving');
    let srvSodium = resolveSodiumMg('_serving');

    if (srvKcal === undefined && srvProt !== undefined && srvCarbs !== undefined && srvFat !== undefined) {
      srvKcal = Math.round(srvProt * 4 + srvCarbs * 4 + srvFat * 9);
    }

    // Gather per-100g candidate
    let per100Kcal = resolveEnergyKcal('_100g') ?? resolveEnergyKcal('');
    let per100Prot = resolveMacro('proteins', '_100g') ?? resolveMacro('proteins', '');
    let per100Carbs = resolveMacro('carbohydrates', '_100g') ?? resolveMacro('carbohydrates', '');
    let per100Fat = resolveMacro('fat', '_100g') ?? resolveMacro('fat', '');
    let per100SatFat = resolveMacro('saturated-fat', '_100g') ?? resolveMacro('saturated-fat', '');
    let per100Fiber = resolveMacro('fiber', '_100g') ?? resolveMacro('fiber', '');
    let per100Sugar = resolveMacro('sugars', '_100g') ?? resolveMacro('sugars', '');
    let per100Sodium = resolveSodiumMg('_100g') ?? resolveSodiumMg('');

    if (per100Kcal === undefined && per100Prot !== undefined && per100Carbs !== undefined && per100Fat !== undefined) {
      per100Kcal = Math.round(per100Prot * 4 + per100Carbs * 4 + per100Fat * 9);
    }

    // Choose consistent basis:
    // 1. If per-serving has energy AND at least one core macro (or all 0 for zero-calorie beverage), use 'serving'.
    //    Fill any missing per-serving macro strictly by scaling the corresponding per-100g macro by (servingQuantityG / 100) if servingQuantityG is known.
    // 2. Else if per-100g has energy AND servingQuantityG is known (and servingSize was explicitly provided),
    //    we can either report per 'serving' (scaled uniformly from 100g) or per '100g'.
    //    Reporting per 'serving' when servingQuantityG is explicitly declared on the package (e.g. "30 g")
    //    makes single-serve comparisons accurate, while keeping '100g' whenever servingQuantityG is unknown.
    let basis: 'serving' | '100g' = '100g';
    let rawKcal: number | undefined;
    let rawProtein: number | undefined;
    let rawCarbs: number | undefined;
    let rawFat: number | undefined;
    let rawSatFat: number | undefined;
    let rawFiber: number | undefined;
    let rawSugar: number | undefined;
    let rawSodium: number | undefined;

    const scaleFrom100 = (val100: number | undefined, factor: number): number | undefined =>
      val100 !== undefined ? Math.round(val100 * factor * 10) / 10 : undefined;

    const hasServingData =
      srvKcal !== undefined &&
      (srvProt !== undefined || srvCarbs !== undefined || srvFat !== undefined || srvKcal === 0);

    if (hasServingData) {
      basis = 'serving';
      const factor = servingQuantityG ? servingQuantityG / 100 : undefined;
      rawKcal = srvKcal;
      rawProtein = srvProt ?? (factor ? scaleFrom100(per100Prot, factor) : undefined);
      rawCarbs = srvCarbs ?? (factor ? scaleFrom100(per100Carbs, factor) : undefined);
      rawFat = srvFat ?? (factor ? scaleFrom100(per100Fat, factor) : undefined);
      rawSatFat = srvSatFat ?? (factor ? scaleFrom100(per100SatFat, factor) : undefined);
      rawFiber = srvFiber ?? (factor ? scaleFrom100(per100Fiber, factor) : undefined);
      rawSugar = srvSugar ?? (factor ? scaleFrom100(per100Sugar, factor) : undefined);
      rawSodium = srvSodium ?? (factor && per100Sodium !== undefined ? Math.round(per100Sodium * factor) : undefined);
    } else if (per100Kcal !== undefined) {
      if (servingQuantityG && servingQuantityG > 0 && servingQuantityG <= 500) {
        basis = 'serving';
        const factor = servingQuantityG / 100;
        rawKcal = Math.round(per100Kcal * factor);
        rawProtein = scaleFrom100(per100Prot, factor);
        rawCarbs = scaleFrom100(per100Carbs, factor);
        rawFat = scaleFrom100(per100Fat, factor);
        rawSatFat = scaleFrom100(per100SatFat, factor);
        rawFiber = scaleFrom100(per100Fiber, factor);
        rawSugar = scaleFrom100(per100Sugar, factor);
        rawSodium = per100Sodium !== undefined ? Math.round(per100Sodium * factor) : undefined;
      } else {
        basis = '100g';
        rawKcal = per100Kcal;
        rawProtein = per100Prot;
        rawCarbs = per100Carbs;
        rawFat = per100Fat;
        rawSatFat = per100SatFat;
        rawFiber = per100Fiber;
        rawSugar = per100Sugar;
        rawSodium = per100Sodium;
      }
    }

    // Extract identified vitamins & minerals from OFF nutriments
    const vitamins: string[] = [];
    const minerals: string[] = [];

    if (n['vitamin-a_100g'] || n['vitamin-a_serving'] || n['vitamin-a_prepared']) vitamins.push('Vitamin A');
    if (n['vitamin-c_100g'] || n['vitamin-c_serving'] || n['vitamin-c_prepared']) vitamins.push('Vitamin C');
    if (n['vitamin-d_100g'] || n['vitamin-d_serving'] || n['vitamin-d_prepared'] || n['vitamin-d3_prepared']) vitamins.push('Vitamin D');
    if (n['vitamin-e_100g'] || n['vitamin-e_serving']) vitamins.push('Vitamin E');
    if (
      n['vitamin-b1_100g'] || n['vitamin-b2_100g'] || n['vitamin-b6_100g'] || n['vitamin-b12_100g'] ||
      n['vitamin-b1_serving'] || n['vitamin-b2_serving'] || n['vitamin-b6_serving'] || n['vitamin-b12_serving'] ||
      n['vitamin-pp_100g'] || n['vitamin-b9_100g']
    ) {
      vitamins.push('B Vitamins');
    }

    if (n['calcium_100g'] || n['calcium_serving'] || n['calcium_prepared']) minerals.push('Calcium');
    if (n['iron_100g'] || n['iron_serving'] || n['iron_prepared']) minerals.push('Iron');
    if (n['potassium_100g'] || n['potassium_serving'] || n['potassium_prepared']) minerals.push('Potassium');
    if (n['magnesium_100g'] || n['magnesium_serving'] || n['magnesium_prepared']) minerals.push('Magnesium');
    if (n['zinc_100g'] || n['zinc_serving'] || n['zinc_prepared']) minerals.push('Zinc');
    if (n['phosphorus_100g'] || n['phosphorus_serving'] || n['phosphorus_prepared']) minerals.push('Phosphorus');

    // Deterministic plain water check (ONLY plain water is 0 kcal when nutriments are omitted)
    if (rawKcal === undefined) {
      const refWater = NutritionNormalizer.resolvePackagedProductNutrition(productName, category, servingSize, quantity);
      if (refWater) {
        rawKcal = refWater.calories;
        rawProtein = refWater.protein;
        rawCarbs = refWater.carbs;
        rawFat = refWater.fat;
        rawFiber = refWater.fiber;
        rawSugar = refWater.sugar;
        rawSodium = rawSodium ?? refWater.sodium_mg;
        if (minerals.length === 0 && refWater.minerals) minerals.push(...refWater.minerals);
        basis = servingSize ? 'serving' : '100g';
      }
    }

    const hasVerifiedNutrition = rawKcal !== undefined;

    return {
      calories: rawKcal !== undefined ? Math.round(rawKcal) : undefined,
      protein: rawProtein !== undefined ? Math.round(rawProtein * 10) / 10 : undefined,
      carbohydrates: rawCarbs !== undefined ? Math.round(rawCarbs * 10) / 10 : undefined,
      fat: rawFat !== undefined ? Math.round(rawFat * 10) / 10 : undefined,
      saturated_fat: rawSatFat !== undefined ? Math.round(rawSatFat * 10) / 10 : undefined,
      fiber: rawFiber !== undefined ? Math.round(rawFiber * 10) / 10 : undefined,
      sugar: rawSugar !== undefined ? Math.round(rawSugar * 10) / 10 : undefined,
      sodium_mg: rawSodium !== undefined ? Math.round(rawSodium) : undefined,
      vitamins,
      minerals,
      basis,
      status: hasVerifiedNutrition ? ('verified' as const) : ('unavailable' as const)
    };
  }

  async identifyProduct(barcode: string, packageImage?: string): Promise<NormalizedProduct | null> {
    try {
      const cleanBarcode = barcode.trim().replace(/\D/g, '');
      if (!cleanBarcode) return null;

      // 1. Try raw barcode
      let p = await this.fetchOFFProduct(cleanBarcode);

      // 2. Try normalized barcode variants (UPC-A 12-digit vs EAN-13 leading 0) and merge if needed
      if (cleanBarcode.length === 12) {
        if (!p || !this.hasIngredientsInRecord(p) || !this.hasNutrimentsInRecord(p)) {
          const p13 = await this.fetchOFFProduct('0' + cleanBarcode);
          p = this.mergeOFFProductRecords(p, p13);
        }
      } else if (cleanBarcode.length === 13 && cleanBarcode.startsWith('0')) {
        if (!p || !this.hasIngredientsInRecord(p) || !this.hasNutrimentsInRecord(p)) {
          const p12 = await this.fetchOFFProduct(cleanBarcode.substring(1));
          p = this.mergeOFFProductRecords(p, p12);
        }
      }

      // 3. Exact code search fallback on Open Food Facts if direct lookup missed
      if (!p) {
        try {
          const searchRes = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?code=${cleanBarcode}&search_simple=1&action=process&json=1`,
            { headers: { 'User-Agent': 'VicCalary - Web - Version 2.0' } }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (Array.isArray(searchData.products) && searchData.products.length > 0) {
              const exactMatch = searchData.products.find((cand: any) => String(cand.code) === cleanBarcode) || searchData.products[0];
              p = exactMatch;
            }
          }
        } catch (_e) {}
      }

      // 4. Secondary exact barcode catalog fallback: UPCItemDB trial lookup
      if (!p) {
        try {
          const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`);
          if (upcRes.ok) {
            const upcData = await upcRes.json();
            if (Array.isArray(upcData.items) && upcData.items.length > 0) {
              const item = upcData.items[0];
              return {
                barcode: cleanBarcode,
                name: item.title || 'Scanned Grocery Item',
                brand: item.brand || item.publisher || undefined,
                category: item.category || 'Packaged Product',
                image: item.images?.[0] || packageImage,
                ingredients: null,
                ingredients_status: 'unavailable',
                serving_size: undefined,
                nutrition: {
                  basis: '100g',
                  status: 'unavailable'
                }
              };
            }
          }
        } catch (_e) {}
      }

      if (!p) return null;

      const productName =
        p.product_name ||
        p.product_name_en ||
        p.product_name_id ||
        p.product_name_fr ||
        p.product_name_es ||
        p.product_name_de ||
        p.product_name_ar ||
        p.generic_name_en ||
        p.generic_name ||
        'Unknown Product';

      // Extract authoritative brand (brands -> brand_owner -> brands_tags)
      let resolvedBrand: string | undefined = undefined;
      if (typeof p.brands === 'string' && p.brands.trim()) {
        resolvedBrand = p.brands.split(',')[0].trim();
      } else if (typeof p.brand_owner === 'string' && p.brand_owner.trim()) {
        resolvedBrand = p.brand_owner.trim();
      } else if (Array.isArray(p.brands_tags) && p.brands_tags.length > 0) {
        resolvedBrand = String(p.brands_tags[0])
          .replace(/^[a-z]{2,3}:/i, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .trim();
      }

      const quantity = typeof p.quantity === 'string' && p.quantity.trim() ? p.quantity.trim() : undefined;
      const servingSize = typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim() : undefined;
      const servingQuantityG = parseServingQuantityGrams(servingSize, p.serving_quantity);

      const categoriesList = typeof p.categories === 'string'
        ? p.categories.split(',').map((c: string) => c.trim()).filter(Boolean)
        : [];
      const category = categoriesList[0] || (
        Array.isArray(p.categories_tags) && p.categories_tags.length > 0
          ? String(p.categories_tags[0]).replace(/^[a-z]{2,3}:/i, '').replace(/-/g, ' ')
          : undefined
      );

      // Origin country extraction
      let originCountry: string | undefined = undefined;
      if (typeof p.origins === 'string' && p.origins.trim()) {
        originCountry = p.origins.split(',')[0].trim();
      } else if (typeof p.manufacturing_places === 'string' && p.manufacturing_places.trim()) {
        originCountry = p.manufacturing_places.split(',')[0].trim();
      } else if (typeof p.countries === 'string' && p.countries.trim()) {
        originCountry = p.countries.split(',')[0].replace(/^[a-z]{2,3}:/i, '').trim();
      }

      // Extract additives tags
      const rawAdditiveTags = [
        ...(Array.isArray(p.additives_tags) ? p.additives_tags : []),
        ...(Array.isArray(p.additives_original_tags) ? p.additives_original_tags : [])
      ];
      const additives = Array.from(
        new Set(rawAdditiveTags.map((a: string) => String(a).replace(/^[a-z]+:/i, '').toLowerCase().trim()).filter(Boolean))
      );

      // Extract allergens & traces
      const rawAllergens = [
        ...(Array.isArray(p.allergens_tags) ? p.allergens_tags : []),
        ...(typeof p.allergens === 'string' ? p.allergens.split(',') : [])
      ];
      const allergens = Array.from(
        new Set(
          rawAllergens
            .map((a: string) => String(a).replace(/^[a-z]{2,3}:/i, '').replace(/-/g, ' ').trim().toLowerCase())
            .filter(Boolean)
        )
      );

      const traces = Array.isArray(p.traces_tags)
        ? p.traces_tags.map((t: string) => String(t).replace(/^[a-z]{2,3}:/i, '').replace(/-/g, ' ').trim().toLowerCase()).filter(Boolean)
        : undefined;

      // Extract real declared ingredients from OFF record (no fake fills)
      const resolvedIngredients = this.extractDeclaredIngredients(p);

      // Extract real nutriments from OFF record (no fake fills)
      const nutrition = this.extractNutriments(p, productName, category, servingSize, quantity);

      return {
        barcode: cleanBarcode,
        name: productName,
        generic_name: p.generic_name_en || p.generic_name || undefined,
        brand: resolvedBrand,
        manufacturer: typeof p.brand_owner === 'string' && p.brand_owner.trim() ? p.brand_owner.trim() : undefined,
        origin_country: originCountry,
        size: quantity || servingSize,
        serving_size: servingSize || (nutrition.basis === '100g' ? '100g' : undefined),
        serving_quantity_g: servingQuantityG,
        category,
        categories_list: categoriesList.length > 0 ? categoriesList.slice(0, 4) : undefined,
        image: p.image_url || p.image_front_url || packageImage,
        image_nutrition_url: p.image_nutrition_url || undefined,
        image_ingredients_url: p.image_ingredients_url || undefined,
        ingredients: resolvedIngredients,
        ingredients_status: resolvedIngredients ? 'verified' : 'unavailable',
        allergens: allergens.length > 0 ? allergens : undefined,
        traces: traces && traces.length > 0 ? traces : undefined,
        additives,
        nutriscore_grade: typeof p.nutriscore_grade === 'string' && p.nutriscore_grade.length === 1 ? p.nutriscore_grade.toUpperCase() : undefined,
        nova_group: typeof p.nova_group === 'number' ? p.nova_group : undefined,
        coloring: FoodColoringService.analyze(resolvedIngredients, additives),
        nutrition
      };
    } catch (e) {
      console.error('[OpenFoodFactsProvider] Error fetching product:', e);
      return null;
    }
  }
}

/**
 * Authoritative price provider.
 * Follows strict priority order:
 * 1. product_price_cache (verified record for barcode and country)
 * 2. expenses (verified prior user-logged expense for this barcode)
 * 3. Optional verified market web search (SERPAPI_API_KEY when configured) -> labeled as estimate
 * 4. Otherwise needs_user_price = true, price = null (with category heuristic only as reference_estimate hint)
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

  public formatCurrencyAmount(amount: number, currency: string): string {
    const formattedNum = amount.toLocaleString();
    if (currency === 'IDR') return `Rp ${formattedNum}`;
    if (currency === 'USD') return `$${formattedNum}`;
    return `${currency} ${formattedNum}`;
  }

  estimateLocalPrice(barcode: string, countryCode: string, productName?: string, category?: string, sizeStr?: string): { price: number; currency: string; source: string; confidence: number } {
    const isIndoBarcode = barcode.startsWith('899');
    const normCountry = (countryCode === 'ID' || isIndoBarcode) ? 'ID' : (countryCode || 'US').toUpperCase();
    const { currency } = this.getCurrencyForCountry(normCountry);

    const name = (productName || '').toLowerCase();
    const cat = (category || '').toLowerCase();
    const size = (sizeStr || '').toLowerCase();

    let volumeMl = 0;
    const mlMatch = size.match(/(\d+(?:\.\d+)?)\s*(?:ml|mili|g|gram)/i) || name.match(/(\d+(?:\.\d+)?)\s*(?:ml|mili|g|gram)/i);
    const literMatch = size.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|litre)/i) || name.match(/(\d+(?:\.\d+)?)\s*(?:l|liter|litre)/i);
    if (literMatch) {
      volumeMl = parseFloat(literMatch[1]) * 1000;
    } else if (mlMatch) {
      volumeMl = parseFloat(mlMatch[1]);
    }

    if (normCountry === 'ID') {
      if (name.includes('milk') || name.includes('susu') || cat.includes('dairy') || cat.includes('milk') || name.includes('yogurt')) {
        if (volumeMl >= 800) {
          return { price: 21000, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
        } else if (volumeMl >= 180 && volumeMl <= 300) {
          return { price: 7000, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
        } else if (volumeMl > 0 && volumeMl < 180) {
          return { price: 4200, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
        }
        return { price: 7500, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
      }

      if (name.includes('water') || name.includes('aqua') || name.includes('minerale') || name.includes('air mineral')) {
        if (volumeMl >= 1000) {
          return { price: 6500, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
        } else if (volumeMl >= 500) {
          return { price: 3800, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
        }
        return { price: 3000, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
      }

      if (name.includes('mie') || name.includes('noodle') || name.includes('indomie') || name.includes('sedap')) {
        return { price: 3500, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      if (name.includes('snack') || name.includes('chips') || name.includes('chitato') || name.includes('biskuit') || name.includes('wafer')) {
        return { price: 8500, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      if (name.includes('teh') || name.includes('tea') || name.includes('kopi') || name.includes('coffee') || name.includes('jus') || name.includes('juice')) {
        return { price: 4500, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      return { price: 12500, currency: 'IDR', source: 'Unverified Category Reference', confidence: 0.35 };
    }

    if (normCountry === 'US') {
      if (name.includes('milk') || cat.includes('dairy') || cat.includes('milk')) {
        return volumeMl >= 800
          ? { price: 3.49, currency: 'USD', source: 'Unverified Category Reference', confidence: 0.35 }
          : { price: 1.85, currency: 'USD', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      if (name.includes('water') || cat.includes('water')) {
        return { price: 1.49, currency: 'USD', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      if (name.includes('snack') || name.includes('chips') || name.includes('cookie')) {
        return { price: 2.99, currency: 'USD', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      if (name.includes('soda') || name.includes('drink') || name.includes('beverage')) {
        return { price: 2.29, currency: 'USD', source: 'Unverified Category Reference', confidence: 0.35 };
      }
      return { price: 3.99, currency: 'USD', source: 'Unverified Category Reference', confidence: 0.35 };
    }

    return { price: 2.50, currency, source: 'Unverified Category Reference', confidence: 0.35 };
  }

  async getPrice(
    barcode: string,
    countryCode: string,
    productCategory?: string,
    productName?: string,
    _ipAddress?: string,
    sizeStr?: string
  ): Promise<ProductPrice | null> {
    try {
      const isIndoBarcode = barcode.startsWith('899');
      const normCountry = (countryCode === 'ID' || isIndoBarcode) ? 'ID' : (countryCode || 'US').toUpperCase();
      const { currency } = this.getCurrencyForCountry(normCountry);

      // Priority 1 & 2: Check product_price_cache and verified user expenses in Supabase
      try {
        const supabase = createServerSupabaseClient();
        const { data: cached } = await supabase
          .from('product_price_cache')
          .select('*')
          .eq('product_id', barcode)
          .eq('country', normCountry)
          .order('retrieved_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached && Number(cached.price) > 0) {
          const sourceLower = String(cached.source || '').toLowerCase();
          const isUnconfirmedHeuristic = sourceLower.includes('unconfirmed') || sourceLower.includes('unverified');
          const ageMs = Date.now() - new Date(cached.retrieved_at).getTime();

          if (!isUnconfirmedHeuristic && ageMs < 30 * 24 * 60 * 60 * 1000) {
            return {
              productId: barcode,
              retailer: cached.retailer || 'Local Market Registry',
              country: cached.country,
              currency: cached.currency || currency,
              price: Number(cached.price),
              status: 'verified',
              source: cached.source || 'Verified Local Price Cache',
              retrievedAt: cached.retrieved_at,
              confidence: Number(cached.confidence || 0.95),
              needs_user_price: false
            };
          }
        }

        // Check if any user previously logged an expense for this exact barcode in the same currency
        const { data: priorExpense } = await supabase
          .from('expenses')
          .select('unit_price, currency, created_at')
          .eq('barcode', barcode)
          .eq('currency', currency)
          .gt('unit_price', 0)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (priorExpense && Number(priorExpense.unit_price) > 0) {
          return {
            productId: barcode,
            retailer: 'Verified User Purchase Log',
            country: normCountry,
            currency: priorExpense.currency || currency,
            price: Number(priorExpense.unit_price),
            status: 'verified',
            source: 'Verified User Purchase Log',
            retrievedAt: priorExpense.created_at || new Date().toISOString(),
            confidence: 0.9,
            needs_user_price: false
          };
        }
      } catch (_cacheErr) {
        // Continue to search / needs_user_price state
      }

      // Priority 3: Optional verified market web search if SERPAPI_API_KEY is configured
      const serpApiKey = process.env.SERPAPI_API_KEY;
      if (serpApiKey && productName) {
        try {
          const query = encodeURIComponent(`${productName} ${barcode} price`);
          const serpRes = await fetch(
            `https://serpapi.com/search.json?engine=google_shopping&q=${query}&gl=${normCountry.toLowerCase()}&api_key=${serpApiKey}`
          );
          if (serpRes.ok) {
            const serpData = await serpRes.json();
            const firstResult = serpData.shopping_results?.[0];
            if (firstResult && firstResult.extracted_price) {
              const estAmount = Number(firstResult.extracted_price);
              return {
                productId: barcode,
                retailer: firstResult.source || 'Google Shopping',
                country: normCountry,
                currency,
                price: estAmount,
                status: 'estimated',
                source: `Market Search Estimate (${firstResult.source || 'Web Retail'})`,
                retrievedAt: new Date().toISOString(),
                confidence: 0.65,
                needs_user_price: true
              };
            }
          }
        } catch (searchErr) {
          console.warn('[RetailPriceProvider] Web retail search error:', searchErr);
        }
      }

      // Priority 4: No verified price in cache or search -> return explicit needs_user_price state
      // Attach category reference strictly as a labeled hint, NEVER as an authoritative price.
      const ref = this.estimateLocalPrice(barcode, normCountry, productName, productCategory, sizeStr);

      return {
        productId: barcode,
        retailer: 'Local Shelf Price Required',
        country: normCountry,
        currency: ref.currency,
        price: null,
        status: 'needs_user_price',
        source: 'Unverified — Enter shelf price (or use local category reference)',
        retrievedAt: new Date().toISOString(),
        confidence: 0.0,
        needs_user_price: true,
        reference_estimate: {
          amount: ref.price,
          currency: ref.currency,
          formatted: this.formatCurrencyAmount(ref.price, ref.currency),
          label: `Typical category reference: ~${this.formatCurrencyAmount(ref.price, ref.currency)} (Unverified)`
        }
      };
    } catch (e) {
      console.warn('[RetailPriceProvider] Price lookup error:', e);
      return null;
    }
  }
}

export class BarcodeService {
  static productProvider: ProductProvider = new OpenFoodFactsProvider();
  static priceProvider: RetailPriceProvider = new RetailPriceProvider();

  /**
   * Step 1: Authoritative catalog identification (no OCR / pricing overhead before boycott gate).
   */
  static async identifyProduct(barcode: string, packageImage?: string): Promise<NormalizedProduct | null> {
    return this.productProvider.identifyProduct(barcode, packageImage);
  }

  /**
   * Step 2 (Only on APPROVED products): Enrich missing nutrition or ingredients via dedicated panel OCR
   * when an authentic nutrition/ingredients label image is available, and recompute food coloring.
   */
  static async enrichApprovedProductFacts(product: NormalizedProduct, packageImage?: string): Promise<NormalizedProduct> {
    const n = product.nutrition || { basis: '100g', status: 'unavailable' };

    // Optional nutrition panel OCR ONLY if catalog calories are missing AND a nutrition/package photo exists
    if (n.calories === undefined || n.calories === null) {
      const nutritionImgCandidate = packageImage || product.image_nutrition_url;
      if (nutritionImgCandidate) {
        const ocrNutrition = await extractNutritionFactsFromImage(nutritionImgCandidate);
        if (ocrNutrition && typeof ocrNutrition.calories === 'number' && !isNaN(ocrNutrition.calories)) {
          n.calories = Math.round(ocrNutrition.calories);
          if (typeof ocrNutrition.protein === 'number') n.protein = Math.round(ocrNutrition.protein * 10) / 10;
          if (typeof ocrNutrition.carbohydrates === 'number') n.carbohydrates = Math.round(ocrNutrition.carbohydrates * 10) / 10;
          if (typeof ocrNutrition.fat === 'number') n.fat = Math.round(ocrNutrition.fat * 10) / 10;
          if (typeof ocrNutrition.fiber === 'number') n.fiber = Math.round(ocrNutrition.fiber * 10) / 10;
          if (typeof ocrNutrition.sugar === 'number') n.sugar = Math.round(ocrNutrition.sugar * 10) / 10;
          if (typeof ocrNutrition.sodium_mg === 'number') n.sodium_mg = Math.round(ocrNutrition.sodium_mg);
          if (ocrNutrition.serving_size) {
            product.serving_size = ocrNutrition.serving_size;
            n.basis = 'serving';
          }
          n.status = 'ocr';
        }
      }
    }

    // Optional ingredients panel OCR ONLY if catalog ingredients are missing AND an ingredients/package photo exists
    if (!product.ingredients) {
      const ingredientsImgCandidate = packageImage || product.image_ingredients_url;
      if (ingredientsImgCandidate) {
        const ocrIngredients = await extractIngredientsFromImage(ingredientsImgCandidate);
        if (ocrIngredients) {
          product.ingredients = ocrIngredients;
          product.ingredients_status = 'ocr';
        }
      }
    }

    product.nutrition = n;
    product.coloring = FoodColoringService.analyze(product.ingredients, product.additives);

    return product;
  }

  /**
   * Full scan helper (preserves backwards compatibility for any direct callers).
   */
  static async processScan(barcode: string, countryCode: string = 'US', ipAddress?: string, packageImage?: string) {
    const rawProduct = await this.identifyProduct(barcode, packageImage);

    if (!rawProduct) {
      throw new Error('Product could not be authoritatively identified.');
    }

    const enrichedProduct = await this.enrichApprovedProductFacts(rawProduct, packageImage);

    const price = await this.priceProvider.getPrice(
      barcode,
      countryCode,
      enrichedProduct.category,
      enrichedProduct.name,
      ipAddress,
      enrichedProduct.size || enrichedProduct.serving_size
    );

    return {
      product: enrichedProduct,
      pricing: price
    };
  }
}
