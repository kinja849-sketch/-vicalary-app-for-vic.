/**
 * Nutritional Label Recognition & Verbatim OCR Service (Section 4)
 *
 * Extracts nutritional declarations and ingredient lists directly from photographs
 * of product packaging:
 * - Preserves original text and units (e.g. "420 kJ" per serving retained as original_energy_value=420,
 *   original_energy_unit='kJ' before converting deterministically to 100.4 kcal).
 * - Never mistakes a decimal separator, serving-size quantity, or nutrient heading for another value.
 * - Marks unreadable or ambiguous fields as uncertain (`uncertain_fields`) rather than completing
 *   them via AI inference.
 * - Compares extracted physical label values against barcode database records, preserves both records
 *   when they disagree, flags the discrepancy, and prioritizes the legible confirmed physical package label.
 */

import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';
import { DeterministicCalculationEngine, NutrientReferenceValues } from '@/lib/nutrition/DeterministicCalculationEngine';

export interface ExtractedLabelRecord {
  product_name: string | null;
  brand: string | null;
  serving_size: string | null;
  serving_quantity_g: number | null;
  serving_quantity_ml: number | null;
  package_quantity: string | null;
  package_quantity_g: number | null;
  servings_per_container: number | null;
  basis: 'serving' | '100g' | '100ml';
  original_energy_text: string | null;
  original_energy_value: number | null;
  original_energy_unit: 'kcal' | 'kJ' | null;
  calories: number | null;
  energy_kj: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  saturated_fat: number | null;
  trans_fat: number | null;
  fiber: number | null;
  sugar: number | null;
  added_sugar: number | null;
  sodium_mg: number | null;
  ingredients: string | null;
  allergens: string[];
  uncertain_fields: string[];
  is_legible: boolean;
  confidence: number;
  verification_status: 'label-extracted' | 'requires-confirmation';
  requires_confirmation: boolean;
  extracted_at: string;
}

export type LabelOCRResult = ExtractedLabelRecord;

export interface LabelDiscrepancyResolution {
  discrepancy_detected: boolean;
  prioritized_source: 'physical_package_label' | 'barcode_database';
  discrepancy_fields: Array<{
    field: string;
    database_value: number | string | null;
    label_value: number | string | null;
    resolution_note: string;
  }>;
  database_record: NutrientReferenceValues | null;
  label_record: ExtractedLabelRecord | null;
}

export class NutritionalLabelOCRService {
  /**
   * Deterministic parser for raw label text or structured OCR payloads (also used in unit/benchmark tests
   * and post-processing of vision OCR outputs).
   */
  static normalizeExtractedLabelPayload(raw: any): ExtractedLabelRecord {
    const toFiniteOrNull = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'string') {
        const cleaned = val.replace(',', '.').replace(/[^0-9.-]/g, '');
        if (!cleaned) return null;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      }
      const num = Number(val);
      return Number.isFinite(num) && num >= 0 ? num : null;
    };

    const uncertainFields: string[] = Array.isArray(raw?.uncertain_fields)
      ? raw.uncertain_fields.map((s: any) => String(s))
      : [];

    // Parse original energy text and unit (kcal vs kJ)
    let origEnergyText: string | null = typeof raw?.original_energy_text === 'string' ? raw.original_energy_text.trim() : null;
    let origEnergyVal = toFiniteOrNull(raw?.original_energy_value);
    let origEnergyUnit: 'kcal' | 'kJ' | null =
      raw?.original_energy_unit === 'kJ' || raw?.original_energy_unit === 'kj'
        ? 'kJ'
        : raw?.original_energy_unit === 'kcal'
          ? 'kcal'
          : null;

    if (origEnergyText && (origEnergyVal === null || origEnergyUnit === null)) {
      const kjMatch = origEnergyText.match(/(\d+(?:[.,]\d+)?)\s*kj\b/i);
      const kcalMatch = origEnergyText.match(/(\d+(?:[.,]\d+)?)\s*(?:kcal|kalori|cal)\b/i);
      if (kjMatch && !kcalMatch) {
        origEnergyVal = parseFloat(kjMatch[1].replace(',', '.'));
        origEnergyUnit = 'kJ';
      } else if (kcalMatch) {
        origEnergyVal = parseFloat(kcalMatch[1].replace(',', '.'));
        origEnergyUnit = 'kcal';
      }
    }

    let kcal = toFiniteOrNull(raw?.calories);
    let kj = toFiniteOrNull(raw?.energy_kj);

    if (origEnergyUnit === 'kJ' && origEnergyVal !== null) {
      kj = origEnergyVal;
      // Preserve exact conversion 420 kJ -> 100.4 kcal unless explicit kcal was also printed on label
      if (kcal === null || Math.abs(kcal - origEnergyVal) < 0.01) {
        kcal = DeterministicCalculationEngine.convertKjToKcal(origEnergyVal);
      }
    } else if (origEnergyUnit === 'kcal' && origEnergyVal !== null) {
      if (kcal === null) kcal = origEnergyVal;
      if (kj === null) kj = DeterministicCalculationEngine.convertKcalToKj(origEnergyVal);
    } else if (kcal !== null && kj === null) {
      origEnergyVal = kcal;
      origEnergyUnit = 'kcal';
      kj = DeterministicCalculationEngine.convertKcalToKj(kcal);
    } else if (kj !== null && kcal === null) {
      origEnergyVal = kj;
      origEnergyUnit = 'kJ';
      kcal = DeterministicCalculationEngine.convertKjToKcal(kj);
    }

    const servingSizeStr =
      typeof raw?.serving_size === 'string' && raw.serving_size.trim() ? raw.serving_size.trim() : null;
    const parsedSrv = DeterministicCalculationEngine.parseQuantityAndUnit(servingSizeStr);
    const servingQtyG =
      toFiniteOrNull(raw?.serving_quantity_g) ?? (parsedSrv?.unit === 'g' ? parsedSrv.value : null);
    const servingQtyMl =
      toFiniteOrNull(raw?.serving_quantity_ml) ?? (parsedSrv?.unit === 'ml' ? parsedSrv.value : null);

    const pkgSizeStr =
      typeof raw?.package_quantity === 'string' && raw.package_quantity.trim()
        ? raw.package_quantity.trim()
        : null;
    const parsedPkg = DeterministicCalculationEngine.parseQuantityAndUnit(pkgSizeStr);
    const pkgQtyG =
      toFiniteOrNull(raw?.package_quantity_g) ?? (parsedPkg?.unit === 'g' ? parsedPkg.value : null);

    let sodiumMg = toFiniteOrNull(raw?.sodium_mg);
    if (sodiumMg === null && toFiniteOrNull(raw?.salt_g) !== null) {
      // 1g salt = 400mg sodium
      sodiumMg = Math.round(toFiniteOrNull(raw.salt_g)! * 400);
    }

    const basis: 'serving' | '100g' | '100ml' =
      raw?.basis === '100g' || raw?.basis === '100ml' || raw?.basis === 'serving'
        ? raw.basis
        : servingSizeStr && !/^100\s*(?:g|ml)$/i.test(servingSizeStr)
          ? 'serving'
          : '100g';

    const ingredients =
      typeof raw?.ingredients === 'string' && raw.ingredients.trim().length > 1
        ? raw.ingredients.trim()
        : null;

    return {
      product_name: typeof raw?.product_name === 'string' && raw.product_name.trim() ? raw.product_name.trim() : null,
      brand: typeof raw?.brand === 'string' && raw.brand.trim() ? raw.brand.trim() : null,
      serving_size: servingSizeStr,
      serving_quantity_g: servingQtyG,
      serving_quantity_ml: servingQtyMl,
      package_quantity: pkgSizeStr,
      package_quantity_g: pkgQtyG,
      servings_per_container: toFiniteOrNull(raw?.servings_per_container),
      basis,
      original_energy_text: origEnergyText || (origEnergyVal !== null && origEnergyUnit ? `${origEnergyVal} ${origEnergyUnit}` : null),
      original_energy_value: origEnergyVal,
      original_energy_unit: origEnergyUnit,
      calories: kcal,
      energy_kj: kj,
      protein: toFiniteOrNull(raw?.protein),
      carbohydrates: toFiniteOrNull(raw?.carbohydrates ?? raw?.carbs),
      fat: toFiniteOrNull(raw?.fat),
      saturated_fat: toFiniteOrNull(raw?.saturated_fat),
      trans_fat: toFiniteOrNull(raw?.trans_fat),
      fiber: toFiniteOrNull(raw?.fiber),
      sugar: toFiniteOrNull(raw?.sugar),
      added_sugar: toFiniteOrNull(raw?.added_sugar),
      sodium_mg: sodiumMg,
      ingredients,
      allergens: Array.isArray(raw?.allergens) ? raw.allergens.map((a: any) => String(a)) : [],
      uncertain_fields: uncertainFields,
      is_legible: raw?.is_legible !== undefined ? Boolean(raw.is_legible) : kcal !== null || ingredients !== null,
      confidence: toFiniteOrNull(raw?.confidence) ?? (kcal !== null ? 0.92 : 0.5),
      verification_status: uncertainFields.length > 0 ? 'requires-confirmation' : 'label-extracted',
      requires_confirmation: uncertainFields.length > 0 || kcal === null,
      extracted_at: new Date().toISOString()
    };
  }

  /**
   * Alias for extractFromPackageImage
   */
  static async extractFromImage(imageUrlOrDataUri: string): Promise<ExtractedLabelRecord | null> {
    return this.extractFromPackageImage(imageUrlOrDataUri);
  }

  /**
   * Extracts structured nutritional declaration and ingredients from a packaging photograph using Vision OCR.
   */
  static async extractFromPackageImage(imageUrlOrDataUri: string): Promise<ExtractedLabelRecord | null> {
    if (!imageUrlOrDataUri) return null;

    try {
      const prompt = `You are a precision clinical OCR engine extracting a food product's printed Nutritional Label and Ingredient Declaration.
Read the visible text on the package photograph carefully.

STRICT OCR RULES:
1. Extract ONLY values that are visibly printed on the label. Never guess, infer, or complete missing numbers.
2. Preserve the EXACT original energy value and unit ('kcal' vs 'kJ') in "original_energy_text", "original_energy_value", and "original_energy_unit".
   - If the label states "420 kJ", set original_energy_value: 420 and original_energy_unit: "kJ". Do NOT mistake kJ for kcal.
3. Pay strict attention to decimal separators (e.g. "2,5 g" -> 2.5), serving sizes (e.g. "25 g"), and package net weight.
4. Extract the verbatim ingredient declaration (starting after INGREDIENTS:, KOMPOSISI:, RAMUAN:, etc.) into "ingredients". If no ingredient list is visible, set "ingredients": null.
5. List any field that is blurry, cut off, or unreadable in "uncertain_fields" and set its value to null.

Return ONLY a valid JSON object matching this schema:
{
  "product_name": string | null,
  "brand": string | null,
  "serving_size": string | null,
  "serving_quantity_g": number | null,
  "package_quantity": string | null,
  "package_quantity_g": number | null,
  "servings_per_container": number | null,
  "basis": "serving" | "100g" | "100ml",
  "original_energy_text": string | null,
  "original_energy_value": number | null,
  "original_energy_unit": "kcal" | "kJ" | null,
  "calories": number | null,
  "energy_kj": number | null,
  "protein": number | null,
  "carbohydrates": number | null,
  "fat": number | null,
  "saturated_fat": number | null,
  "trans_fat": number | null,
  "fiber": number | null,
  "sugar": number | null,
  "added_sugar": number | null,
  "sodium_mg": number | null,
  "ingredients": string | null,
  "allergens": string[],
  "uncertain_fields": string[],
  "is_legible": boolean,
  "confidence": number
}`;

      const res = await callChatCompletionWithFallback({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrlOrDataUri,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.0,
        max_tokens: 650,
        response_format: { type: 'json_object' }
      });

      const content = res.choices[0]?.message?.content;
      if (!content) return null;
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
        return this.normalizeExtractedLabelPayload(parsed);
      }
    } catch (err) {
      console.warn('[NutritionalLabelOCRService] Package OCR failed:', err);
    }

    return null;
  }

  /**
   * Compares a barcode database nutritional record against a confirmed physical package label record.
   * Implements Section 4 & Section 16 Example A:
   * - Where the barcode record (e.g. 80 kcal in OFF) and the actual package label (e.g. 100 kcal on label)
   *   disagree, preserves both records, identifies the discrepancy, and prioritizes the confirmed physical
   *   package label without silently merging conflicting information.
   */
  static resolveDatabaseAndLabelDiscrepancy(
    databaseNutrition: NutrientReferenceValues | null | undefined,
    labelRecord: ExtractedLabelRecord | null | undefined
  ): LabelDiscrepancyResolution {
    if (!labelRecord || !labelRecord.is_legible) {
      return {
        discrepancy_detected: false,
        prioritized_source: 'barcode_database',
        discrepancy_fields: [],
        database_record: databaseNutrition || null,
        label_record: labelRecord || null
      };
    }

    const discrepancies: LabelDiscrepancyResolution['discrepancy_fields'] = [];
    const db = databaseNutrition || {};

    const compareNumeric = (
      field: string,
      dbVal: number | null | undefined,
      lblVal: number | null | undefined,
      tolerance: number = 1
    ) => {
      if (dbVal !== undefined && dbVal !== null && lblVal !== undefined && lblVal !== null) {
        if (Math.abs(dbVal - lblVal) > tolerance) {
          discrepancies.push({
            field,
            database_value: dbVal,
            label_value: lblVal,
            resolution_note: `Physical package label states ${lblVal} while barcode database reported ${dbVal}; prioritizing confirmed physical package label.`
          });
        }
      }
    };

    compareNumeric('calories', db.calories, labelRecord.calories, 1);
    compareNumeric('protein', db.protein, labelRecord.protein, 0.5);
    compareNumeric('carbs', db.carbs, labelRecord.carbohydrates, 0.5);
    compareNumeric('fat', db.fat, labelRecord.fat, 0.5);
    compareNumeric('sugar', db.sugar, labelRecord.sugar, 0.5);
    compareNumeric('fiber', db.fiber, labelRecord.fiber, 0.5);
    compareNumeric('sodium_mg', db.sodium_mg, labelRecord.sodium_mg, 10);

    return {
      discrepancy_detected: discrepancies.length > 0,
      prioritized_source: 'physical_package_label',
      discrepancy_fields: discrepancies,
      database_record: databaseNutrition || null,
      label_record: labelRecord
    };
  }
}

export const resolveDatabaseAndLabelDiscrepancy = (
  databaseNutrition: NutrientReferenceValues | null | undefined,
  labelRecord: ExtractedLabelRecord | null | undefined
) => NutritionalLabelOCRService.resolveDatabaseAndLabelDiscrepancy(databaseNutrition, labelRecord);


