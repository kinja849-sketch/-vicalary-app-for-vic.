/**
 * Deterministic Nutritional Calculation Engine
 *
 * Implements all mathematical conversions, unit reconciliations, serving-basis
 * calculations, and portion-weight priority rules completely outside the AI layer.
 *
 * Key Guarantees:
 * - Standard formula for per-100g/100ml data:
 *   Nutrient Consumed = (Food Weight in g/ml * Nutrient per 100g/100ml) / 100
 * - Preserves 1-decimal precision for calories (e.g. 120g raw tomato @ 18 kcal/100g = 21.6 kcal)
 *   as well as integer rounded values where needed.
 * - Converts energy in kJ to kcal using 1 kcal = 4.184 kJ while retaining original kJ values.
 * - Prevents double-applying serving-size conversions or assuming per-100g/per-serving equals full package.
 * - Rejects invalid grams <-> ml conversions unless an explicit density or serving mapping is provided.
 * - Enforces quantity priority:
 *   1. user_confirmed_weight
 *   2. verified_package_quantity
 *   3. validated_portion_measurement
 *   4. ai_visual_estimate
 */

export type VerificationStatus =
  | 'verified'
  | 'database-derived'
  | 'label-extracted'
  | 'estimated'
  | 'requires-confirmation'
  | 'unavailable';

export type DataVerificationStatus = VerificationStatus;

export type DataBasis = '100g' | '100ml' | 'serving' | 'package';

export type QuantitySourceType =
  | 'user_confirmed'
  | 'verified_package_quantity'
  | 'validated_portion_measurement'
  | 'ai_visual_estimate';

export type QuantitySourcePriority = QuantitySourceType;

export type ComponentObservationType =
  | 'directly_observed'
  | 'inferred_ingredient'
  | 'user_confirmed';

export interface NutrientReferenceValues {
  calories?: number | null;
  calories_kcal?: number | null;
  energy_kj?: number | null;
  protein?: number | null;
  protein_g?: number | null;
  carbs?: number | null;
  carbs_g?: number | null;
  fat?: number | null;
  fat_g?: number | null;
  saturated_fat?: number | null;
  saturated_fat_g?: number | null;
  trans_fat?: number | null;
  trans_fat_g?: number | null;
  cholesterol_mg?: number | null;
  fiber?: number | null;
  fiber_g?: number | null;
  sugar?: number | null;
  sugar_g?: number | null;
  added_sugar?: number | null;
  added_sugar_g?: number | null;
  sodium_mg?: number | null;
  vitamins?: string[];
  minerals?: string[];
}

export interface OriginalSourceNutritionRecord {
  source: string;
  source_id?: string;
  dataset_version?: string;
  retrieved_at: string;
  original_energy_value?: number | null;
  original_energy_unit?: 'kcal' | 'kJ' | null;
  data_basis: DataBasis;
  serving_size_label?: string | null;
  serving_quantity_g?: number | null;
  serving_quantity_ml?: number | null;
  package_quantity_label?: string | null;
  package_quantity_g?: number | null;
  servings_per_package?: number | null;
  per_100g?: NutrientReferenceValues | null;
  per_100ml?: NutrientReferenceValues | null;
  per_serving?: NutrientReferenceValues | null;
  verification_status: VerificationStatus;
}

export interface CalculatedNutritionResult {
  /** Exact calculated calories (1 decimal place preserved, e.g. 21.6 for 120g tomato @ 18 kcal/100g) */
  calories: number | null;
  /** Exact 1-decimal calories value */
  calories_exact: number | null;
  /** Standard integer-rounded calories for legacy UI counters */
  calories_rounded: number | null;
  energy_kj: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  saturated_fat: number | null;
  trans_fat: number | null;
  cholesterol_mg: number | null;
  fiber: number | null;
  sugar: number | null;
  added_sugar: number | null;
  sodium_mg: number | null;
  consumed_weight_g: number | null;
  consumed_volume_ml: number | null;
  servings_consumed: number | null;
  calculation_basis_used: DataBasis;
  quantity_source: QuantitySourceType;
  is_estimated_quantity: boolean;
  weight_range_g?: { min: number; max: number } | null;
  calorie_range?: { min: number; max: number } | null;
  formula_audit: string;
}

export interface QuantityResolutionInput {
  userConfirmedWeightG?: number | null;
  userConfirmedServings?: number | null;
  userConfirmedItemCount?: number | null;
  verifiedPackageServingG?: number | null;
  validatedUnitWeightG?: number | null;
  aiEstimatedWeightG?: number | null;
  aiEstimatedCount?: number | null;
  aiWeightRangeG?: { min: number; max: number } | null;
}

export interface ResolvedQuantity {
  weight_g: number;
  servings?: number;
  item_count?: number;
  source: QuantitySourceType;
  is_estimated: boolean;
  requires_confirmation: boolean;
  weight_range_g: { min: number; max: number };
}

export class DeterministicCalculationEngine {
  /** Standard thermodynamic conversion factor: 1 kcal = 4.184 kJ */
  static readonly KJ_PER_KCAL = 4.184;

  /**
   * Rounds a number to 1 decimal place cleanly (e.g., 21.600000001 -> 21.6, 200.0 -> 200).
   */
  static round1(val: number): number {
    return Math.round((val + Number.EPSILON) * 10) / 10;
  }

  /**
   * Converts kilojoules (kJ) to kilocalories (kcal) using 1 kcal = 4.184 kJ.
   * Retains 1 decimal place for precision (e.g. 420 kJ -> 100.4 kcal).
   */
  static convertKjToKcal(kj: number): number {
    if (!Number.isFinite(kj) || kj < 0) return 0;
    return this.round1(kj / this.KJ_PER_KCAL);
  }

  /**
   * Converts kilocalories (kcal) to kilojoules (kJ).
   */
  static convertKcalToKj(kcal: number): number {
    if (!Number.isFinite(kcal) || kcal < 0) return 0;
    return this.round1(kcal * this.KJ_PER_KCAL);
  }

  /**
   * Parses a quantity string such as "25 g", "250 ml", "100g", "1.5 L" into value and unit.
   */
  static parseQuantityAndUnit(raw?: string | null): { value: number; unit: 'g' | 'ml' } | null {
    if (!raw || typeof raw !== 'string') return null;
    const text = raw.trim();

    // Check liters first
    const literMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter|litre|liters|litres)\b/i);
    if (literMatch) {
      const val = parseFloat(literMatch[1].replace(',', '.'));
      if (Number.isFinite(val) && val > 0) {
        return { value: this.round1(val * 1000), unit: 'ml' };
      }
    }

    // Check kg
    const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilogram|kilograms)\b/i);
    if (kgMatch) {
      const val = parseFloat(kgMatch[1].replace(',', '.'));
      if (Number.isFinite(val) && val > 0) {
        return { value: this.round1(val * 1000), unit: 'g' };
      }
    }

    // Parenthetical e.g. "3 biscuits (25 g)" or "1 cup (240 ml)"
    const parenMatch = text.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(g|gram|grams|gr|ml|mili|milliliter|milliliters)\s*\)/i);
    if (parenMatch) {
      const val = parseFloat(parenMatch[1].replace(',', '.'));
      const rawUnit = parenMatch[2].toLowerCase();
      if (Number.isFinite(val) && val > 0) {
        return { value: val, unit: rawUnit.startsWith('m') ? 'ml' : 'g' };
      }
    }

    // Standard match e.g. "25 g", "200ml"
    const stdMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gram|grams|gr|ml|mili|milliliter|milliliters)\b/i);
    if (stdMatch) {
      const val = parseFloat(stdMatch[1].replace(',', '.'));
      const rawUnit = stdMatch[2].toLowerCase();
      if (Number.isFinite(val) && val > 0) {
        return { value: val, unit: rawUnit.startsWith('m') ? 'ml' : 'g' };
      }
    }

    return null;
  }

  /**
   * Resolves the most reliable food quantity following Section 7 priority order:
   * 1. User-confirmed measured weight / servings / count
   * 2. Verified or known package quantity
   * 3. Validated portion measurement
   * 4. AI-based visual estimation (with uncertainty range)
   */
  static resolveQuantityPriority(input: QuantityResolutionInput): ResolvedQuantity {
    // 1. User-confirmed measured weight in grams
    if (typeof input.userConfirmedWeightG === 'number' && input.userConfirmedWeightG > 0) {
      const w = this.round1(input.userConfirmedWeightG);
      return {
        weight_g: w,
        item_count: input.userConfirmedItemCount ?? undefined,
        servings: input.userConfirmedServings ?? undefined,
        source: 'user_confirmed',
        is_estimated: false,
        requires_confirmation: false,
        weight_range_g: { min: w, max: w }
      };
    }

    // 1b. User-confirmed item count with a validated unit weight
    if (
      typeof input.userConfirmedItemCount === 'number' &&
      input.userConfirmedItemCount > 0 &&
      typeof input.validatedUnitWeightG === 'number' &&
      input.validatedUnitWeightG > 0
    ) {
      const w = this.round1(input.userConfirmedItemCount * input.validatedUnitWeightG);
      return {
        weight_g: w,
        item_count: input.userConfirmedItemCount,
        source: 'user_confirmed',
        is_estimated: false,
        requires_confirmation: false,
        weight_range_g: { min: Math.round(w * 0.92), max: Math.round(w * 1.08) }
      };
    }

    // 2. Verified package serving quantity (potentially multiplied by userConfirmedServings)
    if (typeof input.verifiedPackageServingG === 'number' && input.verifiedPackageServingG > 0) {
      const mult =
        typeof input.userConfirmedServings === 'number' && input.userConfirmedServings > 0
          ? input.userConfirmedServings
          : 1;
      const w = this.round1(input.verifiedPackageServingG * mult);
      return {
        weight_g: w,
        servings: mult,
        source: input.userConfirmedServings ? 'user_confirmed' : 'verified_package_quantity',
        is_estimated: false,
        requires_confirmation: false,
        weight_range_g: { min: w, max: w }
      };
    }

    // 3. Validated standard portion measurement (when AI did not supply a specific weight or count is known)
    if (typeof input.validatedUnitWeightG === 'number' && input.validatedUnitWeightG > 0 && !input.aiEstimatedWeightG) {
      const count = input.aiEstimatedCount && input.aiEstimatedCount > 0 ? input.aiEstimatedCount : 1;
      const w = this.round1(input.validatedUnitWeightG * count);
      return {
        weight_g: w,
        item_count: count,
        source: 'validated_portion_measurement',
        is_estimated: true,
        requires_confirmation: count > 1,
        weight_range_g: input.aiWeightRangeG || {
          min: Math.round(w * 0.85),
          max: Math.round(w * 1.15)
        }
      };
    }

    // 4. AI-based visual estimation
    const estWeight =
      typeof input.aiEstimatedWeightG === 'number' && input.aiEstimatedWeightG > 0
        ? this.round1(input.aiEstimatedWeightG)
        : 120;
    const count = input.aiEstimatedCount && input.aiEstimatedCount > 0 ? input.aiEstimatedCount : 1;
    const range = input.aiWeightRangeG || {
      min: Math.round(estWeight * 0.85),
      max: Math.round(estWeight * 1.15)
    };

    return {
      weight_g: estWeight,
      item_count: count,
      source: 'ai_visual_estimate',
      is_estimated: true,
      requires_confirmation: count > 1 || (range.max - range.min) / Math.max(1, estWeight) > 0.25,
      weight_range_g: range
    };
  }

  /**
   * Standard deterministic calculation for a food with nutritional reference values per 100g or 100ml:
   * Calories consumed = (Food weight in grams * Calories per 100 g) / 100
   *
   * Example:
   * - 250 kcal per 100 g, 80 g consumed -> 200 kcal
   * - 18 kcal per 100 g (raw tomato), 120 g consumed -> 21.6 kcal
   */
  static calculateFromPer100(
    per100: NutrientReferenceValues,
    quantityAmount: number,
    options?: {
      basisUnit?: '100g' | '100ml';
      quantityUnit?: 'g' | 'ml';
      densityGPerMl?: number;
      quantitySource?: QuantitySourceType;
      isEstimated?: boolean;
      weightRangeG?: { min: number; max: number };
    }
  ): CalculatedNutritionResult {
    const basisUnit = options?.basisUnit || '100g';
    const quantityUnit = options?.quantityUnit || (basisUnit === '100ml' ? 'ml' : 'g');

    // Guard against mixing grams and millilitres without density conversion
    let effectiveAmount = quantityAmount;
    if (basisUnit === '100g' && quantityUnit === 'ml') {
      if (!options?.densityGPerMl || options.densityGPerMl <= 0) {
        throw new Error('Cannot convert millilitres (ml) to grams (g) without an explicit density or serving conversion.');
      }
      effectiveAmount = quantityAmount * options.densityGPerMl;
    } else if (basisUnit === '100ml' && quantityUnit === 'g') {
      if (!options?.densityGPerMl || options.densityGPerMl <= 0) {
        throw new Error('Cannot convert grams (g) to millilitres (ml) without an explicit density or serving conversion.');
      }
      effectiveAmount = quantityAmount / options.densityGPerMl;
    }

    const scale = Math.max(0, effectiveAmount) / 100;

    // Resolve per-100 kcal (converting from kJ if only kJ was provided)
    const rawKcal = per100.calories ?? per100.calories_kcal;
    let refKcal: number | null =
      typeof rawKcal === 'number' && Number.isFinite(rawKcal)
        ? rawKcal
        : null;
    const refKj: number | null =
      typeof per100.energy_kj === 'number' && Number.isFinite(per100.energy_kj)
        ? per100.energy_kj
        : refKcal !== null
          ? this.convertKcalToKj(refKcal)
          : null;

    if (refKcal === null && refKj !== null) {
      refKcal = this.convertKjToKcal(refKj);
    }

    const scaleField = (val?: number | null): number | null => {
      if (val === undefined || val === null || !Number.isFinite(val)) return null;
      return this.round1(val * scale);
    };

    const exactCalories = refKcal !== null ? this.round1(refKcal * scale) : null;
    const roundedCalories = exactCalories !== null ? Math.round(exactCalories) : null;
    const calcKj = refKj !== null ? this.round1(refKj * scale) : null;

    const quantitySource = options?.quantitySource || 'ai_visual_estimate';
    const isEstimated = options?.isEstimated ?? (quantitySource === 'ai_visual_estimate');

    const rangeG = options?.weightRangeG || (isEstimated
      ? { min: Math.round(effectiveAmount * 0.88), max: Math.round(effectiveAmount * 1.12) }
      : { min: effectiveAmount, max: effectiveAmount });

    const calorieRange =
      refKcal !== null
        ? {
            min: this.round1((rangeG.min * refKcal) / 100),
            max: this.round1((rangeG.max * refKcal) / 100)
          }
        : null;

    return {
      calories: exactCalories,
      calories_exact: exactCalories,
      calories_rounded: roundedCalories,
      energy_kj: calcKj,
      protein: scaleField(per100.protein ?? per100.protein_g),
      carbs: scaleField(per100.carbs ?? per100.carbs_g),
      fat: scaleField(per100.fat ?? per100.fat_g),
      saturated_fat: scaleField(per100.saturated_fat ?? per100.saturated_fat_g),
      trans_fat: scaleField(per100.trans_fat ?? per100.trans_fat_g),
      cholesterol_mg: per100.cholesterol_mg !== undefined && per100.cholesterol_mg !== null
        ? Math.round(per100.cholesterol_mg * scale)
        : null,
      fiber: scaleField(per100.fiber ?? per100.fiber_g),
      sugar: scaleField(per100.sugar ?? per100.sugar_g),
      added_sugar: scaleField(per100.added_sugar ?? per100.added_sugar_g),
      sodium_mg: per100.sodium_mg !== undefined && per100.sodium_mg !== null
        ? Math.round(per100.sodium_mg * scale)
        : null,
      consumed_weight_g: basisUnit === '100g' ? this.round1(effectiveAmount) : null,
      consumed_volume_ml: basisUnit === '100ml' ? this.round1(effectiveAmount) : null,
      servings_consumed: null,
      calculation_basis_used: basisUnit,
      quantity_source: quantitySource,
      is_estimated_quantity: isEstimated,
      weight_range_g: rangeG,
      calorie_range: calorieRange,
      formula_audit:
        refKcal !== null
          ? `(${this.round1(effectiveAmount)}${basisUnit === '100ml' ? 'ml' : 'g'} × ${refKcal} kcal/${basisUnit}) ÷ 100 = ${exactCalories} kcal`
          : 'Calories unavailable in reference record'
    };
  }

  /**
   * Resolves portion weight with full support for both QuantityResolutionInput and NutritionNormalizer parameters.
   */
  static resolvePortionWeight(input: {
    userConfirmedWeightG?: number | null;
    userConfirmedCount?: number | null;
    userConfirmedItemCount?: number | null;
    userConfirmedServings?: number | null;
    validatedPortionWeightG?: number | null;
    validatedUnitWeightG?: number | null;
    verifiedPackageServingG?: number | null;
    aiEstimatedWeightG?: number | null;
    aiEstimatedCount?: number | null;
    standardUnitWeightG?: number | null;
    confidence?: number | null;
  }): ResolvedQuantity & {
    quantity_source: QuantitySourceType;
    uncertainty_range_g: { min_g: number; max_g: number };
  } {
    const resolved = this.resolveQuantityPriority({
      userConfirmedWeightG: input.userConfirmedWeightG,
      userConfirmedItemCount: input.userConfirmedCount ?? input.userConfirmedItemCount,
      userConfirmedServings: input.userConfirmedServings,
      verifiedPackageServingG: input.verifiedPackageServingG,
      validatedUnitWeightG: input.validatedPortionWeightG ?? input.validatedUnitWeightG ?? input.standardUnitWeightG,
      aiEstimatedWeightG: input.aiEstimatedWeightG,
      aiEstimatedCount: input.aiEstimatedCount
    });
    const requiresConf =
      resolved.requires_confirmation ||
      (typeof input.confidence === 'number' && input.confidence < 0.72);
    return {
      ...resolved,
      requires_confirmation: requiresConf,
      quantity_source: resolved.source,
      uncertainty_range_g: {
        min_g: resolved.weight_range_g.min,
        max_g: resolved.weight_range_g.max
      }
    };
  }

  /**
   * Calculates component nutrition from per-100g values, returning both standard and `_g` macro properties.
   */
  static calculateComponentFromPer100g(
    per100: NutrientReferenceValues,
    weightG: number
  ): {
    calories: number;
    calories_exact: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
    formula_audit: string;
  } {
    const res = this.calculateFromPer100(per100, weightG, { basisUnit: '100g', quantityUnit: 'g' });
    return {
      calories: res.calories_rounded ?? 0,
      calories_exact: res.calories_exact ?? 0,
      protein_g: res.protein ?? 0,
      carbs_g: res.carbs ?? 0,
      fat_g: res.fat ?? 0,
      fiber_g: res.fiber ?? 0,
      sugar_g: res.sugar ?? 0,
      sodium_mg: res.sodium_mg ?? 0,
      formula_audit: res.formula_audit
    };
  }

  /**
   * Calculates consumed nutrition for a packaged product without double-converting serving sizes
   * or confusing per-100g / per-serving with the entire package.
   *
   * Example (Section 3):
   * - Biscuit package: 100 kcal per serving, serving size = 25 g, package = 100 g (4 servings).
   *   - 1 serving consumed -> 100 kcal
   *   - 2 servings consumed -> 200 kcal
   *   - Entire package (4 servings or 100 g) consumed -> 400 kcal
   */
  static calculatePackagedProductConsumption(params: {
    perServing?: NutrientReferenceValues | null;
    per100g?: NutrientReferenceValues | null;
    per100ml?: NutrientReferenceValues | null;
    servingQuantityG?: number | null;
    servingWeightG?: number | null;
    servingQuantityMl?: number | null;
    packageQuantityG?: number | null;
    packageWeightG?: number | null;
    packageQuantityMl?: number | null;
    servingsPerPackage?: number | null;
    servingsConsumed?: number | null;
    weightConsumedG?: number | null;
    volumeConsumedMl?: number | null;
    consumeEntirePackage?: boolean;
  }): CalculatedNutritionResult {
    const {
      perServing,
      per100g,
      per100ml,
      servingQuantityMl,
      packageQuantityMl,
      servingsPerPackage,
      servingsConsumed,
      weightConsumedG,
      volumeConsumedMl,
      consumeEntirePackage
    } = params;
    const servingQuantityG = params.servingQuantityG ?? params.servingWeightG;
    const packageQuantityG = params.packageQuantityG ?? params.packageWeightG;

    const hasEnergy = (rec?: NutrientReferenceValues | null) =>
      Boolean(
        rec &&
          ((rec.calories !== undefined && rec.calories !== null) ||
            (rec.calories_kcal !== undefined && rec.calories_kcal !== null) ||
            (rec.energy_kj !== undefined && rec.energy_kj !== null))
      );

    // Resolve total servings in package if package weight & serving weight are known
    const resolvedServingsPerPkg =
      typeof servingsPerPackage === 'number' && servingsPerPackage > 0
        ? servingsPerPackage
        : packageQuantityG && servingQuantityG && packageQuantityG >= servingQuantityG
          ? this.round1(packageQuantityG / servingQuantityG)
          : packageQuantityMl && servingQuantityMl && packageQuantityMl >= servingQuantityMl
            ? this.round1(packageQuantityMl / servingQuantityMl)
            : null;

    // Case A: Explicit weightConsumedG provided and per100g is available
    if (typeof weightConsumedG === 'number' && weightConsumedG > 0 && hasEnergy(per100g)) {
      const res = this.calculateFromPer100(per100g!, weightConsumedG, {
        basisUnit: '100g',
        quantityUnit: 'g',
        quantitySource: 'user_confirmed',
        isEstimated: false
      });
      if (servingQuantityG && servingQuantityG > 0) {
        res.servings_consumed = this.round1(weightConsumedG / servingQuantityG);
      }
      return res;
    }

    // Case B: Explicit weightConsumedG provided and only perServing + servingQuantityG are available
    if (typeof weightConsumedG === 'number' && weightConsumedG > 0 && perServing && servingQuantityG && servingQuantityG > 0) {
      const derivedServings = weightConsumedG / servingQuantityG;
      return this.scaleServingRecord(perServing, derivedServings, servingQuantityG, servingQuantityMl, 'user_confirmed');
    }

    // Case C: Consume entire package requested
    if (consumeEntirePackage) {
      if (perServing && resolvedServingsPerPkg && resolvedServingsPerPkg > 0) {
        return this.scaleServingRecord(
          perServing,
          resolvedServingsPerPkg,
          servingQuantityG,
          servingQuantityMl,
          'verified_package_quantity'
        );
      }
      if (per100g && packageQuantityG && packageQuantityG > 0) {
        const res = this.calculateFromPer100(per100g, packageQuantityG, {
          basisUnit: '100g',
          quantityUnit: 'g',
          quantitySource: 'verified_package_quantity',
          isEstimated: false
        });
        res.calculation_basis_used = 'package';
        res.servings_consumed = resolvedServingsPerPkg;
        return res;
      }
      if (per100ml && packageQuantityMl && packageQuantityMl > 0) {
        const res = this.calculateFromPer100(per100ml, packageQuantityMl, {
          basisUnit: '100ml',
          quantityUnit: 'ml',
          quantitySource: 'verified_package_quantity',
          isEstimated: false
        });
        res.calculation_basis_used = 'package';
        res.servings_consumed = resolvedServingsPerPkg;
        return res;
      }
    }

    // Case D: Per-serving record is available (multiply strictly by servingsConsumed, default 1 serving — NEVER double-convert!)
    const effectiveServings =
      typeof servingsConsumed === 'number' && servingsConsumed > 0 ? servingsConsumed : 1;

    if (hasEnergy(perServing)) {
      return this.scaleServingRecord(
        perServing!,
        effectiveServings,
        servingQuantityG,
        servingQuantityMl,
        typeof servingsConsumed === 'number' ? 'user_confirmed' : 'verified_package_quantity'
      );
    }

    // Case E: Only per-100g is available
    if (hasEnergy(per100g)) {
      if (servingQuantityG && servingQuantityG > 0) {
        const totalG = servingQuantityG * effectiveServings;
        const res = this.calculateFromPer100(per100g!, totalG, {
          basisUnit: '100g',
          quantityUnit: 'g',
          quantitySource: typeof servingsConsumed === 'number' ? 'user_confirmed' : 'verified_package_quantity',
          isEstimated: false
        });
        res.servings_consumed = effectiveServings;
        res.calculation_basis_used = 'serving';
        return res;
      }
      // No serving size known -> return per 100g strictly labeled as 100g basis
      return this.calculateFromPer100(per100g!, 100 * effectiveServings, {
        basisUnit: '100g',
        quantityUnit: 'g',
        quantitySource: 'verified_package_quantity',
        isEstimated: false
      });
    }

    // Case F: Only per-100ml is available
    if (hasEnergy(per100ml)) {
      const volMl = volumeConsumedMl || (servingQuantityMl ? servingQuantityMl * effectiveServings : 100 * effectiveServings);
      const res = this.calculateFromPer100(per100ml!, volMl, {
        basisUnit: '100ml',
        quantityUnit: 'ml',
        quantitySource: 'verified_package_quantity',
        isEstimated: false
      });
      if (servingQuantityMl) {
        res.servings_consumed = effectiveServings;
        res.calculation_basis_used = 'serving';
      }
      return res;
    }

    return {
      calories: null,
      calories_exact: null,
      calories_rounded: null,
      energy_kj: null,
      protein: null,
      carbs: null,
      fat: null,
      saturated_fat: null,
      trans_fat: null,
      cholesterol_mg: null,
      fiber: null,
      sugar: null,
      added_sugar: null,
      sodium_mg: null,
      consumed_weight_g: null,
      consumed_volume_ml: null,
      servings_consumed: null,
      calculation_basis_used: '100g',
      quantity_source: 'verified_package_quantity',
      is_estimated_quantity: false,
      weight_range_g: null,
      calorie_range: null,
      formula_audit: 'Nutritional reference values unavailable'
    };
  }

  private static scaleServingRecord(
    perServing: NutrientReferenceValues,
    servingsMultiplier: number,
    servingQuantityG?: number | null,
    servingQuantityMl?: number | null,
    quantitySource: QuantitySourceType = 'verified_package_quantity'
  ): CalculatedNutritionResult {
    const mult = Math.max(0, servingsMultiplier);

    const rawSrvKcal = perServing.calories ?? perServing.calories_kcal;
    let srvKcal: number | null =
      typeof rawSrvKcal === 'number' && Number.isFinite(rawSrvKcal)
        ? rawSrvKcal
        : null;
    const srvKj: number | null =
      typeof perServing.energy_kj === 'number' && Number.isFinite(perServing.energy_kj)
        ? perServing.energy_kj
        : srvKcal !== null
          ? this.convertKcalToKj(srvKcal)
          : null;

    if (srvKcal === null && srvKj !== null) {
      srvKcal = this.convertKjToKcal(srvKj);
    }

    const scaleVal = (v?: number | null): number | null => {
      if (v === undefined || v === null || !Number.isFinite(v)) return null;
      return this.round1(v * mult);
    };

    const exactKcal = srvKcal !== null ? this.round1(srvKcal * mult) : null;
    const roundedKcal = exactKcal !== null ? Math.round(exactKcal) : null;
    const totalWeightG =
      typeof servingQuantityG === 'number' && servingQuantityG > 0
        ? this.round1(servingQuantityG * mult)
        : null;
    const totalVolumeMl =
      typeof servingQuantityMl === 'number' && servingQuantityMl > 0
        ? this.round1(servingQuantityMl * mult)
        : null;

    return {
      calories: exactKcal,
      calories_exact: exactKcal,
      calories_rounded: roundedKcal,
      energy_kj: srvKj !== null ? this.round1(srvKj * mult) : null,
      protein: scaleVal(perServing.protein ?? perServing.protein_g),
      carbs: scaleVal(perServing.carbs ?? perServing.carbs_g),
      fat: scaleVal(perServing.fat ?? perServing.fat_g),
      saturated_fat: scaleVal(perServing.saturated_fat ?? perServing.saturated_fat_g),
      trans_fat: scaleVal(perServing.trans_fat ?? perServing.trans_fat_g),
      cholesterol_mg:
        perServing.cholesterol_mg !== undefined && perServing.cholesterol_mg !== null
          ? Math.round(perServing.cholesterol_mg * mult)
          : null,
      fiber: scaleVal(perServing.fiber ?? perServing.fiber_g),
      sugar: scaleVal(perServing.sugar ?? perServing.sugar_g),
      added_sugar: scaleVal(perServing.added_sugar ?? perServing.added_sugar_g),
      sodium_mg:
        perServing.sodium_mg !== undefined && perServing.sodium_mg !== null
          ? Math.round(perServing.sodium_mg * mult)
          : null,
      consumed_weight_g: totalWeightG,
      consumed_volume_ml: totalVolumeMl,
      servings_consumed: this.round1(mult),
      calculation_basis_used: 'serving',
      quantity_source: quantitySource,
      is_estimated_quantity: false,
      weight_range_g: totalWeightG ? { min: totalWeightG, max: totalWeightG } : null,
      calorie_range: exactKcal !== null ? { min: exactKcal, max: exactKcal } : null,
      formula_audit:
        srvKcal !== null
          ? `${this.round1(mult)} serving(s)${servingQuantityG ? ` (${totalWeightG}g)` : ''} × ${srvKcal} kcal/serving = ${exactKcal} kcal`
          : 'Calories per serving unavailable'
    };
  }
}

export const convertKjToKcal = (kj: number) => DeterministicCalculationEngine.convertKjToKcal(kj);
export const resolvePortionWeight = (
  input: Parameters<typeof DeterministicCalculationEngine.resolvePortionWeight>[0]
) => DeterministicCalculationEngine.resolvePortionWeight(input);
export const calculateComponentFromPer100g = (
  per100: NutrientReferenceValues,
  weightG: number
) => DeterministicCalculationEngine.calculateComponentFromPer100g(per100, weightG);
export const calculatePackagedProductConsumption = (
  params: Parameters<typeof DeterministicCalculationEngine.calculatePackagedProductConsumption>[0]
) => DeterministicCalculationEngine.calculatePackagedProductConsumption(params);


