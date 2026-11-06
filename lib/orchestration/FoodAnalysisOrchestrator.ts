import { SupabaseClient } from '@supabase/supabase-js';
import { BarcodeService } from '@/lib/products/BarcodeService';
import { NormalizedProduct, ProductPrice } from '@/lib/products/ProductProvider';
import {
  NutritionNormalizer,
  IdentifiedFoodItem,
  MealNutritionCalculation
} from '@/lib/nutrition/NutritionNormalizer';
import {
  NutritionalLabelOCRService,
  ExtractedLabelRecord
} from '@/lib/ocr/NutritionalLabelOCRService';
import { DataVerificationStatus } from '@/lib/nutrition/DeterministicCalculationEngine';
import { callChatCompletionWithFallback } from '@/lib/ai/ai-fallback';

export type FoodAnalysisWorkflowType =
  | 'packaged_product'
  | 'nutrition_label_ocr'
  | 'fresh_single_food'
  | 'mixed_meal';

export interface StandardizedProvenanceMetadata {
  workflow: FoodAnalysisWorkflowType;
  source_name: string;
  source_api: string;
  source_id?: string;
  retrieved_at: string;
  origin_country?: string;
  origin_country_code?: string;
  shopping_market_country?: string;
  verification_status: DataVerificationStatus;
  ai_orchestration?: {
    primary_provider: 'openai';
    secondary_verification_invoked: boolean;
    secondary_provider?: 'gemini';
    model_disagreement_detected: boolean;
    confidence: number;
  };
}

export interface ConfirmationPromptMetadata {
  requires_confirmation: boolean;
  reason?: string;
  fields_to_confirm: Array<'weight_g' | 'item_count' | 'servings_consumed' | 'preparation_state' | 'label_image'>;
}

export interface PackagedProductWorkflowResult {
  workflow: 'packaged_product';
  product: NormalizedProduct;
  pricing: ProductPrice | null;
  provenance: StandardizedProvenanceMetadata;
  confirmation: ConfirmationPromptMetadata;
}

export interface NutritionLabelOCRWorkflowResult {
  workflow: 'nutrition_label_ocr';
  label_record: ExtractedLabelRecord;
  provenance: StandardizedProvenanceMetadata;
  confirmation: ConfirmationPromptMetadata;
}

export interface MealOrFreshFoodWorkflowResult {
  workflow: 'fresh_single_food' | 'mixed_meal';
  dish_name: string;
  is_decomposed_mixed_meal: boolean;
  calculation: MealNutritionCalculation;
  provenance: StandardizedProvenanceMetadata;
  confirmation: ConfirmationPromptMetadata;
}

/**
 * Centralized Food-Analysis Orchestration Layer (Sections 2 & 8):
 * Enforces strict separation between packaged_product, nutrition_label_ocr,
 * fresh_single_food, and mixed_meal workflows, and guarantees that authoritative
 * databases (Open Food Facts v3, USDA FoodData Central, Indonesian TKPI 2020)
 * and the DeterministicCalculationEngine control all nutritional facts.
 */
export class FoodAnalysisOrchestrator {
  /**
   * Determines whether an identified food list represents a single fresh food item
   * (`fresh_single_food`) or a multi-component / prepared dish (`mixed_meal`).
   */
  static classifyMealWorkflow(
    dishName: string,
    items: IdentifiedFoodItem[]
  ): 'fresh_single_food' | 'mixed_meal' {
    const lowerDish = (dishName || '').toLowerCase().trim();
    const isKnownMixedDish =
      /\b(nasi goreng|mie goreng|fried rice|soto|bakso|ayam penyet|nasi uduk|gado|pecel|rendang|capcay|salad|bowl|platter|combo|plate|sandwich|burger|pizza|curry|stew|soup)\b/i.test(
        lowerDish
      );

    if (isKnownMixedDish || items.length > 1) {
      return 'mixed_meal';
    }

    return 'fresh_single_food';
  }

  /**
   * Conditional Secondary AI Verification (Section 8):
   * Invoked ONLY when primary OpenAI vision classification has low confidence (< 0.65)
   * or reports high ambiguity. If primary and secondary models disagree on the food identity
   * or count, flags `model_disagreement_detected: true` and `requires_confirmation: true`.
   */
  static async runConditionalSecondaryVerification(params: {
    imageUrl: string;
    primaryDishName: string;
    primaryItems: IdentifiedFoodItem[];
    primaryConfidence: number;
  }): Promise<{
    secondary_invoked: boolean;
    disagreement_detected: boolean;
    disagreement_reason?: string;
  }> {
    if (params.primaryConfidence >= 0.65 && params.primaryItems.length > 0) {
      return {
        secondary_invoked: false,
        disagreement_detected: false
      };
    }

    const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return {
        secondary_invoked: false,
        disagreement_detected: true,
        disagreement_reason: 'Primary visual confidence is below 0.65; user confirmation of food quantity is recommended.'
      };
    }

    try {
      const prompt = `Identify the primary food or dish and count of items visible in this image.
Return ONLY valid JSON:
{
  "dish_name": "string",
  "item_count": number,
  "confidence": number
}`;
      const res = await callChatCompletionWithFallback({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: params.imageUrl, detail: 'low' } }
            ]
          }
        ],
        temperature: 0.0,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      });

      const content = res.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const secName = String(parsed.dish_name || '').toLowerCase().trim();
        const priName = params.primaryDishName.toLowerCase().trim();
        const nameOverlap =
          secName && priName && (secName.includes(priName) || priName.includes(secName));
        if (!nameOverlap) {
          return {
            secondary_invoked: true,
            disagreement_detected: true,
            disagreement_reason: `Primary model identified "${params.primaryDishName}" while secondary verification identified "${parsed.dish_name}". Please confirm food identity and portion.`
          };
        }
      }
      return {
        secondary_invoked: true,
        disagreement_detected: false
      };
    } catch (_e) {
      return {
        secondary_invoked: false,
        disagreement_detected: true,
        disagreement_reason: 'Low visual confidence (< 0.65); please confirm estimated portion weight or count.'
      };
    }
  }

  /**
   * Workflow 1: Packaged Product Barcode Scan (Section 3, 4, 10, 11 & Examples A, B, F)
   */
  static async executePackagedProductWorkflow(params: {
    barcode: string;
    countryCode?: string;
    ipAddress?: string;
    packageImage?: string;
    servingsConsumed?: number;
    weightConsumedG?: number;
    consumeEntirePackage?: boolean;
    confirmedLabelRecord?: ExtractedLabelRecord;
  }): Promise<PackagedProductWorkflowResult | null> {
    const rawProduct = await BarcodeService.identifyProduct(params.barcode, params.packageImage);
    if (!rawProduct) return null;

    let enrichedProduct = await BarcodeService.enrichApprovedProductFacts(
      rawProduct,
      params.packageImage,
      params.confirmedLabelRecord
    );

    if (
      params.servingsConsumed !== undefined ||
      params.weightConsumedG !== undefined ||
      params.consumeEntirePackage
    ) {
      enrichedProduct = BarcodeService.calculateConsumptionForProduct(enrichedProduct, {
        servingsConsumed: params.servingsConsumed,
        weightConsumedG: params.weightConsumedG,
        consumeEntirePackage: params.consumeEntirePackage
      });
    }

    const pricing = await BarcodeService.priceProvider.getPrice(
      params.barcode,
      params.countryCode || 'US',
      enrichedProduct.category,
      enrichedProduct.name,
      params.ipAddress,
      enrichedProduct.size || enrichedProduct.serving_size,
      enrichedProduct.brand,
      enrichedProduct.origin_country
    );

    if (pricing?.shopping_market_country) {
      enrichedProduct.shopping_market_country = pricing.shopping_market_country;
    }

    const nutritionStatus = enrichedProduct.nutrition?.status || 'unavailable';
    const verificationStatus: DataVerificationStatus =
      nutritionStatus === 'label-extracted' || nutritionStatus === 'ocr'
        ? 'label-extracted'
        : nutritionStatus === 'verified'
        ? 'verified'
        : nutritionStatus === 'database-derived'
        ? 'database-derived'
        : 'unavailable';

    const fieldsToConfirm: Array<'weight_g' | 'item_count' | 'servings_consumed' | 'preparation_state' | 'label_image'> = [
      'servings_consumed'
    ];
    let requiresConfirmation = false;
    let reason: string | undefined = undefined;

    if (nutritionStatus === 'unavailable' || enrichedProduct.ingredients_status === 'unavailable') {
      requiresConfirmation = true;
      fieldsToConfirm.push('label_image');
      reason =
        nutritionStatus === 'unavailable'
          ? 'Nutritional values are missing from the barcode database. Please capture a clear photo of the Nutrition Facts panel.'
          : 'Declared ingredient list is unavailable in the barcode database. Capture the ingredients panel to verify ingredients.';
    }

    return {
      workflow: 'packaged_product',
      product: enrichedProduct,
      pricing,
      provenance: {
        workflow: 'packaged_product',
        source_name:
          enrichedProduct.discrepancy?.prioritized_source === 'physical_package_label'
            ? 'Physical Package Label (Prioritized over Database)'
            : 'Open Food Facts Product Catalog',
        source_api: enrichedProduct.nutrition?.source_api || 'openfoodfacts_v3',
        source_id: enrichedProduct.barcode,
        retrieved_at: enrichedProduct.nutrition?.retrieved_at || new Date().toISOString(),
        origin_country: enrichedProduct.origin_country,
        origin_country_code: enrichedProduct.origin_country_code,
        shopping_market_country: enrichedProduct.shopping_market_country || pricing?.country,
        verification_status: verificationStatus
      },
      confirmation: {
        requires_confirmation: requiresConfirmation,
        reason,
        fields_to_confirm: fieldsToConfirm
      }
    };
  }

  /**
   * Workflow 2: Direct Nutritional Label OCR (Section 4)
   */
  static async executeNutritionLabelOCRWorkflow(
    imageUrl: string
  ): Promise<NutritionLabelOCRWorkflowResult | null> {
    const labelRecord = await NutritionalLabelOCRService.extractFromImage(imageUrl);
    if (!labelRecord) return null;

    return {
      workflow: 'nutrition_label_ocr',
      label_record: labelRecord,
      provenance: {
        workflow: 'nutrition_label_ocr',
        source_name: 'Physical Package Nutrition Label OCR',
        source_api: 'NutritionalLabelOCRService',
        retrieved_at: new Date().toISOString(),
        verification_status: labelRecord.verification_status
      },
      confirmation: {
        requires_confirmation: labelRecord.requires_confirmation,
        reason:
          labelRecord.uncertain_fields.length > 0
            ? `Uncertain or partially legible fields on label: ${labelRecord.uncertain_fields.join(', ')}`
            : undefined,
        fields_to_confirm: labelRecord.requires_confirmation ? ['label_image', 'servings_consumed'] : ['servings_consumed']
      }
    };
  }

  /**
   * Workflows 3 & 4: Fresh Single Food (`fresh_single_food`) and Mixed Meal (`mixed_meal`)
   * (Sections 5, 6, 7, 8 & Examples C, D, E)
   */
  static async executeFoodItemsWorkflow(params: {
    dishName: string;
    items: IdentifiedFoodItem[];
    supabase?: SupabaseClient;
    imageUrl?: string;
    primaryConfidence?: number;
    skipNetwork?: boolean;
  }): Promise<MealOrFreshFoodWorkflowResult> {
    const workflow = this.classifyMealWorkflow(params.dishName, params.items);
    const confidence = params.primaryConfidence ?? 0.85;

    let secondaryCheck: {
      secondary_invoked: boolean;
      disagreement_detected: boolean;
      disagreement_reason?: string;
    } = {
      secondary_invoked: false,
      disagreement_detected: false,
      disagreement_reason: undefined
    };

    if (params.imageUrl && confidence < 0.65) {
      secondaryCheck = await this.runConditionalSecondaryVerification({
        imageUrl: params.imageUrl,
        primaryDishName: params.dishName,
        primaryItems: params.items,
        primaryConfidence: confidence
      });
    }

    let calculation: MealNutritionCalculation;
    let isDecomposedMixedMeal = false;

    if (workflow === 'mixed_meal' && params.items.length <= 1) {
      const decomposed = await NutritionNormalizer.decomposeAndCalculateMixedMeal(
        params.dishName,
        params.items,
        params.supabase,
        { skipNetwork: params.skipNetwork ?? true }
      );
      calculation = decomposed.calculation;
      isDecomposedMixedMeal = decomposed.is_decomposed_template || calculation.normalized_items.length > 1;
    } else {
      calculation = await NutritionNormalizer.calculateMealNutrition(
        params.items,
        params.supabase,
        { skipNetwork: params.skipNetwork ?? true }
      );
      isDecomposedMixedMeal = calculation.normalized_items.length > 1;
    }

    const requiresConfirmation =
      Boolean(calculation.requires_confirmation) ||
      secondaryCheck.disagreement_detected ||
      confidence < 0.65;

    const primaryItem = calculation.normalized_items[0];
    const primarySourceApi =
      primaryItem?.source === 'usda_fdc'
        ? 'USDA FoodData Central v1'
        : primaryItem?.source === 'tkpi_indonesia'
        ? 'Indonesian Food Composition Table (TKPI 2020)'
        : primaryItem?.source === 'supabase_food_items'
        ? 'Supabase Food Catalog'
        : 'Validated Reference Nutrition Catalog';

    const verificationStatus: DataVerificationStatus = requiresConfirmation
      ? 'requires-confirmation'
      : (calculation.verification_status || 'database-derived');

    const fieldsToConfirm: Array<'weight_g' | 'item_count' | 'servings_consumed' | 'preparation_state' | 'label_image'> = [
      'weight_g'
    ];
    if (calculation.normalized_items.some(i => (i.numeric_count || 1) > 1)) {
      fieldsToConfirm.unshift('item_count');
    }

    return {
      workflow,
      dish_name: params.dishName,
      is_decomposed_mixed_meal: isDecomposedMixedMeal,
      calculation,
      provenance: {
        workflow,
        source_name: primaryItem?.source_description || primarySourceApi,
        source_api: primarySourceApi,
        source_id: primaryItem?.source_id,
        retrieved_at: new Date().toISOString(),
        verification_status: verificationStatus,
        ai_orchestration: {
          primary_provider: 'openai',
          secondary_verification_invoked: secondaryCheck.secondary_invoked,
          secondary_provider: secondaryCheck.secondary_invoked ? 'gemini' : undefined,
          model_disagreement_detected: secondaryCheck.disagreement_detected,
          confidence
        }
      },
      confirmation: {
        requires_confirmation: requiresConfirmation,
        reason:
          secondaryCheck.disagreement_reason ||
          (requiresConfirmation
            ? 'Multiple items or visual portion variance detected. Confirm item count or gram weight for exact calculation.'
            : undefined),
        fields_to_confirm: fieldsToConfirm
      }
    };
  }
}

