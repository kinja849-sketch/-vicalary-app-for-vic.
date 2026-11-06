# Nutritional Accuracy, Food Recognition, Product Scanning, API Integration & Data Retrieval Architecture — Implementation Blueprint

## 1. Executive Summary & Architectural Authority Order

The objective of this implementation is to upgrade VicCalary's food-scanning, barcode-recognition, nutritional-label OCR, fresh-food recognition, mixed-meal decomposition, deterministic calorie calculation, and location-aware pricing pipelines so that **accuracy, provenance, and deterministic calculation take strict priority over AI guesswork**.

In accordance with [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md), this architecture operates within the existing Next.js 14 App Router, React 18, Supabase, OpenAI, Google Gemini, and IP-geolocation stack without redesigning protected UI surfaces or breaking existing frontend/API contracts.

### Global Authority Order
```text
Authenticated User & Market Context
  → Centralized Food-Analysis Orchestrator (Workflow Router)
  → AI Visual Classification / Structured Label OCR (OpenAI Primary, Gemini Conditional Secondary)
  → Authoritative External & Regional Databases (Open Food Facts v3/v2, USDA FoodData Central API, Indonesian TKPI, Verified Manufacturer/Label Records)
  → Deterministic Validation, Conflict Resolution & Calculation Engine
  → Supabase Provenance & Canonical Persistence
  → Standardized API Response & Faithful Frontend Rendering
```

---

## 2. Technical Root-Cause Audit of Existing Defects

Our inspection of the repository identified six specific architectural defects that caused inaccurate or fabricated outputs:

1. **AI-Fabricated Ingredients on Missing Barcode Records (Violates Section 3 & Example B)**:
   - In [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts#L1102-L1154), `resolveIngredientsForIdentifiedProduct()` falls back to prompting `gpt-4o-mini` to *generate a "standard declared packaging ingredients list"* when Open Food Facts lacks `ingredients_text`, and marks `ingredients_status = 'verified'`.
   - Furthermore, [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx#L671) renders a fabricated fallback string (`INGREDIENTS: ${productName.toUpperCase()} STANDARD COMMERCIAL FORMULATION.`) when `ingredients` is `null`.
   - **Fix**: Remove AI ingredient invention and fake UI fallback text. Only retrieve ingredients from (a) the exact barcode record in Open Food Facts v3/v2/v0, (b) verified manufacturer/reference label records for that exact barcode, or (c) physical package label OCR (`status: 'label-extracted'`). If none exist, return `ingredients: null`, `ingredients_status: 'unavailable'`, and explicitly display that ingredient information is unavailable.

2. **Hardcoded 30g Tomato Garnish Clamp & Missing USDA FoodData Central Integration (Violates Section 5 & Examples C & D)**:
   - In [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts#L1041-L1047), any single identified `"tomato"` with `portionG > 50` is forcibly overwritten to `30g` (~5 kcal) under the assumption that it is a "small slice / plate garnish". Consequently, photographing one whole raw tomato (`120g` at `18 kcal/100g` = `21.6 kcal`) returns the wrong weight and wrong calories.
   - Furthermore, `NutritionNormalizer.ts` does not call the official **USDA FoodData Central API** (`https://api.nal.usda.gov/fdc/v1/foods/search` and `/fdc/v1/food/{fdcId}`) and lacks a structured **Indonesian Food Composition Table (TKPI)** dataset with food codes and dataset versions.
   - **Fix**: Remove the destructive 30g clamp for whole produce; integrate `USDAFoodDataService` (prioritizing `Foundation`, `SR Legacy`, and `Survey (FNDDS)` records over `Branded` records for fresh foods) and `TKPIDatasetService` (for Indonesian fresh foods and regional dishes); preserve decimal accuracy (`21.6 kcal` for a `120g` raw tomato at `18 kcal/100g`).

3. **Missing Separation of Workflows & Missing Label vs. Database Discrepancy Resolution (Violates Sections 2, 3, 4 & Example A)**:
   - Currently, [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts) treats every photo as a generic multi-item plate, and [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts#L1689-L1708) only runs OCR when `n.calories === undefined`.
   - If Open Food Facts reports an outdated value (e.g., `80 kcal` per serving on a biscuit package) while the physical package label (via label photo OCR or verified label reference) states `100 kcal` per serving, the current code blindly accepts `80 kcal` and never runs label comparison.
   - **Fix**: Implement a centralized `FoodAnalysisOrchestrator` separating **4 workflows** (`packaged_product`, `nutrition_label_ocr`, `fresh_single_food`, `mixed_meal`). In `packaged_product`, query Open Food Facts API v3 (`/api/v3/product/{barcode}`) first (with v2/v0 fallback), preserve both `per_100g` and `per_serving` source values and original units (`kJ` vs `kcal`), compare against physical label OCR or verified reference label when present, preserve both records on conflict, flag `discrepancy_detected: true`, and prioritize the confirmed current physical package label (`100 kcal` per serving).

4. **Missing Multi-Serving / Package Consumption Multiplier in Deterministic Calculation Engine (Violates Sections 3 & 9)**:
   - In [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts#L733-L776), `extractNutriments()` mutates `rawKcal` in-place when scaling from `100g` to `serving`, discarding the separate `per_100g`, `per_serving`, and `per_package` structures and lacking a deterministic calculation for consumed servings (e.g., `2 servings` of a `25g` biscuit at `100 kcal/serving` = `200 kcal`; `4 servings` / full package = `400 kcal`).
   - **Fix**: Build a standalone `DeterministicCalculationEngine` (`lib/nutrition/DeterministicCalculationEngine.ts`) that preserves `original_source_values` (`per_100g`, `per_100ml`, `per_serving`, `energy_kj`, `energy_kcal`) separately from `calculated_values` (`servings_consumed`, `consumed_weight_g`, `calories_consumed`, macros consumed) and prevents double-applying serving conversions or confusing `kJ` with `kcal` ($1\text{ kcal} = 4.184\text{ kJ}$).

5. **Mixed-Meal Hidden Ingredients & Portion Estimation Priority (Violates Sections 6 & 7, Examples D & E)**:
   - Currently, mixed meals do not distinguish `directly_observed` components from `inferred_ingredient` components (such as cooking oil, sambal, or absorbed frying fat in *nasi goreng*) or `user_confirmed` quantities, nor can users override estimated weights/counts/servings with measured values to trigger deterministic recalculation.
   - **Fix**: Tag every component with `observation_type` (`'directly_observed' | 'inferred_ingredient' | 'user_confirmed'`), `preparation_state`, `estimated_weight_g`, and `weight_range_g`. Enforce the strict quantity priority order (`user_confirmed_weight_g` > `verified_package_quantity_g` > `validated_portion_measurement_g` > `ai_visual_estimate_g`) and allow interactive weight/count/serving confirmation in both API endpoints and UI modals.

6. **AI-Invented Retail Prices Marked as `'verified'` (Violates Section 11 & Example F)**:
   - In [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts#L1408-L1662), `RetailPriceProvider` asks `gpt-4o-mini` (`resolveProductPriceRangeWithAI`) or category heuristics (`estimateLocalPriceRange`) to invent a retail price when no verified database or marketplace listing exists, and returns `status: 'verified'`.
   - **Fix**: Separate pricing into `MarketPricingService` (`lib/products/MarketPricingService.ts`). Distinguish product origin/manufacturer/barcode prefix (e.g., Malaysia `955` prefix) from the user's shopping market (e.g., Indonesia `ID` via IP or manual country override). Retrieve prices only from verified Supabase market records (`regional_pricing`, verified `product_price_cache`), authorized catalog records, or live Google Shopping (`SERPAPI_API_KEY`). If no real listing exists for that product in the target market, return `status: 'unavailable'`, `price: null`, `needs_user_price: true` — never fabricating a price via OpenAI/Gemini.

---

## 3. Plan Mode Challenge Questions (Section 42 of `AGENTS.md`)

1. **Why is any new module or schema extension necessary instead of reusing existing ones?**
   - We reuse [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts), [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-product-barcode/route.ts), [`lib/scanner/ScannerDecisionEngine.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/scanner/ScannerDecisionEngine.ts), [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts), [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts), [`lib/services/SafetyEngine.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/services/SafetyEngine.ts), [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/ai/ai-fallback.ts), [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx), and [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx).
   - Focused service modules (`FoodAnalysisOrchestrator.ts`, `DeterministicCalculationEngine.ts`, `USDAFoodDataService.ts`, `TKPIDatasetService.ts`, `NutritionalLabelOCRService.ts`) are created under `lib/` to cleanly modularize external API adapters, deterministic math, and workflow routing without bloating route handlers.
   - For Supabase persistence, we reuse existing tables (`products`, `food_items`, `food_analysis_history`, `regional_pricing`, `product_price_cache`) and add a non-breaking migration [`supabase/migrations/20261105_nutrition_provenance_and_cache.sql`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/supabase/migrations/20261105_nutrition_provenance_and_cache.sql) that adds `nutrition_reference_cache` and provenance JSONB metadata columns (`provenance_metadata`, `original_source_data`, `verification_status`) with full RLS policies.
2. **Can this version avoid unnecessary schema or contract complexity?**
   - Yes. Every existing top-level response field consumed by `Camera.tsx`, `Dashboard.tsx`, `MealAnalysis.tsx`, `ProductDetails.tsx`, and `lib/api/food.ts` is preserved with 100% backwards compatibility. New provenance, original-vs-calculated nutrition, and confirmation fields are added alongside existing fields.
3. **What existing callers, routes, or UI states could break if implemented this way?**
   - None: `Camera.tsx`, `Dashboard.tsx`, `MealAnalysis.tsx`, `ProductDetails.tsx`, Boycott screening (`BoycottScreeningService.ts`), Allergy/Medical gates (`SafetyEngine.ts`), and Scanner-to-Budget expenditure logging (`saveFoodAnalysis` -> `/api/expenses`) remain completely intact.

---

## 4. Source of Truth & Value Provenance Map

| Value / Domain Object | Authoritative Source | Fallback / Uncertainty Behavior |
| :--- | :--- | :--- |
| **Packaged Product Identity (`barcode`, `name`, `brand`, `manufacturer`, `origin_country`)** | Open Food Facts API v3 (`/api/v3/product/{code}`) → v2 → v0 → Verified Barcode Catalog → Confirmed Packaging OCR | Return `status: 'PRODUCT_NOT_FOUND'` or `requires-confirmation`; never substitute a visually similar product |
| **Packaged Product Nutrition (`per_100g`, `per_100ml`, `per_serving`, `energy_kj`, `energy_kcal`)** | Physical Package Label OCR (when confirmed & legible on conflict) → Verified Label Reference → Open Food Facts `nutriments` | Preserve both DB and Label records on conflict (`discrepancy_detected: true`); if missing, `nutrition_status: 'unavailable'` |
| **Packaged Product Ingredients (`ingredients`, `factory_ingredients_statement`)** | Open Food Facts `ingredients_text*` / `ingredients` array → Verified Manufacturer Reference → Physical Label OCR | Return `ingredients: null`, `ingredients_status: 'unavailable'`; **never** use AI to guess ingredients |
| **Fresh Individual Food Nutrition (`per_100g`)** | Official USDA FoodData Central API (`Foundation`, `SR Legacy`, `Survey (FNDDS)`) & Indonesian `TKPI` dataset | Cache in Supabase/memory; mark `verification_status: 'database-derived'` with `fdcId` or `tkpiCode` |
| **Mixed Meal Component Nutrition** | Regional Prepared Dish Record (`TKPI` / `USDA`) OR Sum of Decomposed Component Records (`directly_observed` + `inferred_ingredient`) | Explicitly separate observed vs inferred components (e.g., cooking oil range); flag `requires-confirmation` when uncertain |
| **Portion Weight (`grams`, `servings`, `count`)** | 1. `user_confirmed` → 2. `verified_package_quantity` → 3. `validated_portion_measurement` → 4. `ai_visual_estimate` (with min–max range) | Always communicate `weight_range_g` when visually estimated; recalculate deterministically when user enters weight/count/servings |
| **Calorie & Nutrient Math** | `DeterministicCalculationEngine` ($\text{Weight}_g \times \text{Per100g} \div 100$ or $\text{Servings} \times \text{PerServing}$, $1\text{ kcal} = 4.184\text{ kJ}$) | Never delegated to OpenAI or Gemini |
| **Shopping Market & Local Retail Price** | User Manual Market Override → IP Geolocation (`lib/api/location.ts` / `/api/location`) → Verified Retail Catalog / `regional_pricing` / `product_price_cache` / `SERPAPI` | If no verified price exists for the product in the target market, return `status: 'unavailable'`, `price: null` (never AI-guessed) |

---

## 5. Detailed File-by-File Implementation Plan

### 5.1 Deterministic Nutritional Calculation Engine
**New File**: [`lib/nutrition/DeterministicCalculationEngine.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/DeterministicCalculationEngine.ts)
- Implements pure, deterministic backend math completely independent of AI models:
  - `convertKjToKcal(kj: number): number` → $\text{round}(\text{kj} / 4.184 \times 10) / 10$ (preserving exact 1-decimal precision for low-calorie items and integer/1-decimal label standards).
  - `calculateFromPer100g(per100g: NutrientBasisRecord, weightGrams: number)`:
    $$\text{Consumed} = \frac{\text{weightGrams} \times \text{valuePer100g}}{100}$$
    Preserves exact 1-decimal precision for calories when $< 100\text{ kcal}$ or non-integer (e.g., `120g` tomato at `18 kcal/100g` = `21.6 kcal`), plus `calories_rounded: 22` where integer display is needed, so both exact (`21.6`) and rounded values are available.
  - `calculatePackagedConsumption(options)`:
    - Handles `per_serving`, `per_100g`, `per_100ml`, and `per_package` bases without double-converting serving sizes.
    - Example: Biscuit package with `100 kcal` per serving (`25g`), `4 servings` per package (`100g`):
      - `1 serving` (`25g`) → `100 kcal`
      - `2 servings` (`50g`) → `200 kcal`
      - `0.5 serving` (`12.5g`) → `50 kcal`
      - `full package` (`4 servings` / `100g`) → `400 kcal`
    - Rejects invalid grams↔ml conversions unless a valid density or explicit serving mapping exists.
  - `resolveQuantityPriority(input)`:
    - Enforces priority: `user_confirmed` > `known_package_quantity` > `validated_portion_reference` > `ai_visual_estimate`.

### 5.2 Official USDA FoodData Central API & Indonesian TKPI Dataset
**New Files**:
- [`lib/nutrition/USDAFoodDataService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/USDAFoodDataService.ts)
  - Integrates with `https://api.nal.usda.gov/fdc/v1/foods/search` and `https://api.nal.usda.gov/fdc/v1/food/{fdcId}` using `process.env.USDA_API_KEY || process.env.FDC_API_KEY || 'DEMO_KEY'`.
  - Prioritizes `dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)']` for fresh/generic foods and explicitly excludes `Branded` records when analyzing ordinary raw/cooked produce or meats.
  - Extracts official USDA nutrient numbers (`1008` / `2047` Energy kcal, `1062` Energy kJ, `1003` Protein, `1005` Carbohydrate, `1004` Total lipid/fat, `1079` Fiber, `2000` Sugars, `1093` Sodium, plus vitamins/minerals) normalized per `100g`.
  - Caches retrieved records in memory and Supabase (`nutrition_reference_cache`) with `fdcId`, `dataType`, `description`, `publicationDate`, and `retrievedAt`.
  - Includes a deterministic verified USDA Foundation/SR Legacy seed catalog for core fresh foods (e.g., raw tomato `FDC 170457` = `18 kcal/100g`, apple `52 kcal/100g`, banana `89 kcal/100g`, cucumber `15 kcal/100g`, raw/boiled egg `143 kcal/100g`, cooked chicken breast `165 kcal/100g`, raw/boiled potato `87 kcal/100g`, etc.) so rate limits on `DEMO_KEY` or offline sandboxes never degrade accuracy.
- [`lib/nutrition/TKPIDatasetService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/TKPIDatasetService.ts)
  - Provides validated **Indonesian Food Composition Table (TKPI 2020 — Kementerian Kesehatan RI)** records with official TKPI codes, Indonesian & English names, preparation states (`mentah`/`raw`, `rebus`/`boiled`, `kukus`/`steamed`, `goreng`/`fried`, `bakar`/`grilled`), and per-100g macro/micronutrient profiles for Indonesian ingredients and prepared dishes (`nasi goreng`, `nasi uduk`, `ayam penyet`, `soto ayam`, `bakso`, `mie goreng`, `rendang`, `gado-gado`, `sate ayam`, `tempe goreng`, `tahu goreng`, `telur dadar`, `sayur asem`, `kangkung`, `sambal`, `kerupuk`, etc.), plus recipe-level component templates for Indonesian mixed meals.

### 5.3 Nutritional Label Recognition & Verbatim OCR Service
**New File**: [`lib/ocr/NutritionalLabelOCRService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/ocr/NutritionalLabelOCRService.ts)
- Extracts structured nutritional declarations and ingredient lists from packaging photographs:
  - Preserves `raw_text`, `original_energy_value`, and `original_energy_unit` (`'kJ'` vs `'kcal'`). For example, `420 kJ` per serving is retained as `{ original_value: 420, original_unit: 'kJ', normalized_kcal: 100.4 }`.
  - Extracts `product_name`, `brand`, `serving_size`, `serving_quantity_g`, `package_quantity`, `servings_per_container`, `calories`, `protein`, `carbohydrates`, `fat`, `saturated_fat`, `trans_fat`, `fiber`, `sugar`, `added_sugar`, `sodium_mg`, and verbatim `ingredients`.
  - Per-field confidence and `uncertain_fields: string[]`: any unreadable value is set to `null` and listed in `uncertain_fields` rather than inferred.
  - `compareLabelWithDatabaseRecord(dbProduct, labelData)`:
    - Detects discrepancies (e.g., Example A: OFF database says `80 kcal` per serving while physical label states `100 kcal` per serving).
    - Preserves both `database_record` and `label_record`, sets `discrepancy_detected: true`, and prioritizes the legible confirmed physical label (`status: 'label-extracted'`).

### 5.4 Open Food Facts API v3 Upgrade, Honest Ingredients & Market Pricing Separation
**Modified File**: [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts) & [`lib/products/ProductProvider.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/ProductProvider.ts)
- **Open Food Facts API v3 Primary Integration**:
  - Add `fetchOFFProductV3(code)` querying `https://world.openfoodfacts.org/api/v3/product/${code}` with proper `User-Agent` and parsing v3 `product` schema + completeness/quality indicators (`completeness`, `states_tags`, `data_quality_errors_tags`), falling back to v2 and v0 when needed.
- **Verified Reference Label Catalog & Conflict Resolution (Example A & Regional SKUs)**:
  - Support verified reference package labels and live label OCR comparison so that if Open Food Facts has an outdated calorie count (e.g. `80 kcal` vs confirmed label `100 kcal`) or if both a barcode record and a package label photo are supplied, both records are retained in `provenance.database_record` and `provenance.label_record`, the discrepancy is flagged, and the confirmed physical label value (`100 kcal`) is prioritized.
- **Preserve Both Per-100g/100ml and Per-Serving Source Values**:
  - Store `original_source_values: { per_100g, per_serving, energy_kj_100g, energy_kj_serving, energy_kcal_100g, energy_kcal_serving, raw_basis, serving_size, package_quantity }` on `NormalizedProductNutrition`.
  - Support `servings_consumed` / `consumed_weight_g` calculation via `DeterministicCalculationEngine.calculatePackagedConsumption`.
- **Eliminate AI Ingredient Hallucination (Example B)**:
  - Remove the `gpt-4o-mini` ingredient invention block in `resolveIngredientsForIdentifiedProduct()`.
  - Only return ingredients from (1) Open Food Facts barcode record, (2) verified manufacturer reference record for that exact barcode, or (3) physical package label OCR (`ingredients_status: 'label-extracted'`). Otherwise return `ingredients: null` and `ingredients_status: 'unavailable'`.
- **Honest Market Pricing Service (Section 11 & Example F)**:
  - Remove `resolveProductPriceRangeWithAI()` and category price fabrication from returning `status: 'verified'`.
  - Distinguish `origin_country` / `barcode_prefix_country` (e.g., Malaysia for a `955` barcode) from `shopping_market_country` (e.g., Indonesia `ID` from IP or manual country override).
  - Query verified retail prices from:
    1. Supabase `regional_pricing` & verified `product_price_cache`
    2. Verified regional retail barcode catalog (Indonesian `IDR` and Malaysian `MYR` verified retail listings)
    3. Live Google Shopping via `SERPAPI_API_KEY` (when configured)
  - If no verified price exists for that barcode in the shopping market, return `status: 'unavailable'`, `price: null`, `estimated_price: null`, `needs_user_price: true`.

### 5.5 Centralized Food-Analysis Orchestration Layer & 4 Workflows
**New File**: [`lib/orchestration/FoodAnalysisOrchestrator.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/orchestration/FoodAnalysisOrchestrator.ts)
- Central entry point that routes requests into four distinct, non-overlapping workflows:
  1. **`packaged_product` Workflow**:
     - Exact barcode lookup (OFF v3 → v2 → v0 → verified catalog), completeness validation, label discrepancy check (if package photo or verified label override is present), deterministic calculation for `servingsConsumed` / `weightConsumedG`, deterministic allergy/medical/boycott gates, and location-aware market price lookup.
  2. **`nutrition_label_ocr` Workflow**:
     - Triggered when an image is classified or requested as a Nutrition Facts / packaging label scan. Runs `NutritionalLabelOCRService`, preserves original `kJ`/`kcal` units, validates internal macro-calorie consistency ($4P+4C+9F$), and calculates consumed nutrients deterministically.
  3. **`fresh_single_food` Workflow (Examples C & D)**:
     - Triggered when an image contains a single fresh ingredient (e.g., 1 raw tomato or 5 raw tomatoes).
     - Vision AI (OpenAI primary, Gemini conditional secondary when confidence $< 0.65$) returns standardized food name, alternative candidates, preparation state (`raw` vs `cooked`), countable item count (`1` vs `5`), and visual weight estimate with uncertainty range (`100–130g` for 1 medium tomato; `500–650g` for 5 medium tomatoes).
     - Queries `USDAFoodDataService` (and `TKPIDatasetService` for regional produce) for authoritative per-100g nutrition (e.g., raw tomato `18 kcal/100g`).
     - Calls `DeterministicCalculationEngine` using `user_confirmed_weight_g` (if provided, e.g., `120g` → `21.6 kcal`) or visual estimate (`~120g` → `21.6 kcal`, range `18.0–23.4 kcal`), setting `verification_status: userConfirmedWeight ? 'database-derived' : 'estimated'` and `requires_confirmation: !userConfirmedWeight && itemCount > 1`.
  4. **`mixed_meal` Workflow (Example E)**:
     - Triggered when an image contains a prepared dish or multiple components (e.g., *Nasi Goreng* with rice, fried egg, chicken, vegetables, cooking oil, sambal).
     - Decomposes into individual components tagged as `directly_observed`, `inferred_ingredient` (e.g., cooking oil / absorbed fat with uncertainty range), or `user_confirmed`.
     - Matches each component against `TKPIDatasetService` (for Indonesian components) and `USDAFoodDataService` (for generic components) according to its exact `preparation_state` (`raw` vs `cooked`/`fried`/`boiled`).
     - Sums deterministic component calculations into the meal total and uncertainty range.

### 5.6 Updating [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts)
- Remove the `portionG = 30` tomato garnish override so whole tomatoes (`120g` for 1 tomato, or `count * ~115g` for multiple whole tomatoes unless sliced/garnish is explicitly specified) retain their true weight.
- Integrate `USDAFoodDataService` and `TKPIDatasetService` into `NutritionNormalizer.calculateMealNutrition()` so every item is resolved against USDA FoodData Central / TKPI / Supabase `food_items` and carries full provenance (`source`, `source_id`, `data_basis: '100g'`, `per_100g`, `observation_type`, `preparation_state`, `weight_source`, `verification_status`, `exact_calories`).

### 5.7 Updating API Routes & Supabase Persistence
**Modified Files**:
- [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts)
  - Route requests through `FoodAnalysisOrchestrator`.
  - Support optional `confirmedItems` / `confirmedWeightG` / `confirmedCount` / `workflowOverride` in the request body so when a user confirms or edits a portion weight (e.g., entering `120g` for a tomato or `5` tomatoes = `580g`) on the frontend, the backend deterministically recalculates the exact calories (`21.6 kcal`) without re-running vision AI.
  - Persist analysis session & provenance metadata to Supabase when `userId` is authenticated.
- [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-product-barcode/route.ts)
  - Route barcode scans through `FoodAnalysisOrchestrator` / `ScannerDecisionEngine`.
  - Support optional `servingsConsumed` / `consumedWeightG` / `shoppingCountry` / `labelOverride` in the request body.
  - Return standardized provenance fields (`verification_status`, `original_source_values`, `calculated_values`, `discrepancy`, `completeness`, `shopping_market_country`, `origin_country`) while preserving all existing response fields.

### 5.8 Frontend Provenance Badges & Quantity Confirmation (Preserving Protected UI Design)
**Modified Files**:
- [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx)
  - Preserve the exact existing layout, styling, cards, and colors.
  - Display clear source & verification status pill (`Database-Derived (USDA / TKPI)` vs `Estimated Weight — Confirm Grams` vs `User-Confirmed Weight`).
  - Allow the user to tap any component tile (or the total weight control) to confirm/edit the actual weight in grams (`g`) or item count (`x`), immediately recalculating the deterministic calories and macros (including exact decimal display like `21.6 kcal` when `< 100 kcal` or measured).
  - Clearly label `Directly Observed` vs `Inferred (Cooking Oil / Sauce)` components on mixed meals.
- [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx)
  - Preserve the exact existing layout, Boycott card, Allergy card, Nutrition Facts panel, and action buttons.
  - Fix line 671: When `ingredients` is `null` / `ingredients_status === 'unavailable'`, display `"Ingredient declaration unavailable in barcode database. Scan or upload a photo of the physical package label to extract ingredients via OCR."` — **never** display `"STANDARD COMMERCIAL FORMULATION"`.
  - Display both `Per Serving` and `Per 100g` original values when available, plus a compact **Servings Consumed** selector (`0.5x`, `1x`, `2x`, `Full Package`) that deterministically updates the consumed calories/macros via the calculation engine formula.
  - If `discrepancy_detected === true` (Example A), display a clear provenance notice showing that the physical package label (`100 kcal`) took priority over the outdated catalog record (`80 kcal`).
  - In the price section, if `price_metadata.status === 'unavailable'`, explicitly show `"Retail price unavailable for this market"` instead of a fabricated number.

### 5.9 Dedicated Accuracy-Testing & Benchmarking Suite (Section 15 & Section 16 Examples A–F)
**New Files**:
- [`lib/testing/NutritionalAccuracyBenchmark.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/testing/NutritionalAccuracyBenchmark.ts)
  - Contains the controlled benchmark datasets and evaluation runner required by Section 15:
    - **100 Indonesian Packaged Products** (known `899...` barcodes, reference labels, serving sizes, and ingredients)
    - **100 Malaysian Packaged Products** (known `955...` barcodes, reference labels, serving sizes, and ingredients)
    - **50 Fresh Individual Food Items** (weighed items with USDA FoodData Central / TKPI reference records, raw vs cooked)
    - **50 Mixed Meals** (including Indonesian dishes like *Nasi Goreng*, *Nasi Uduk*, *Ayam Penyet*, *Soto Ayam*, *Bakso*, *Mie Goreng* with reference ingredient weights and preparation methods)
    - **Explicit Verification Tests for Section 16 Examples A, B, C, D, E, and F**.
  - Computes and outputs measurable **Baseline (Before) vs. Post-Implementation (After)** accuracy metrics across all 9 dimensions required by Section 15.
- [`scripts/run-accuracy-benchmark.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/scripts/run-accuracy-benchmark.ts)
  - CLI benchmark runner that executes the full test suite and writes the verified benchmark report.

---

## 6. Verification & Acceptance Criteria

1. **Example A (Barcode vs. Physical Label Discrepancy)**: Scanning a biscuit package where Open Food Facts reports `80 kcal/serving` (`25g`) and the physical label states `100 kcal/serving` (`25g`) preserves both records, flags the discrepancy, prioritizes the physical label (`100 kcal`), and calculates `200 kcal` for 2 servings and `400 kcal` for 4 servings (full package).
2. **Example B (Packaged Product Missing Ingredients)**: Scanning a barcode whose record has name and calories but no ingredients returns `ingredients: null` and `ingredients_status: 'unavailable'` (unless OCR extracts them from a real package photo) — zero AI-invented ingredients.
3. **Example C (Single Fresh Tomato — 120g)**: Identifying 1 raw tomato (`120g`) matches USDA raw tomato (`18 kcal/100g`) and deterministically calculates `21.6 kcal` (never `30g / 5 kcal` and never an AI-guessed `80–100 kcal`).
4. **Example D (Five Fresh Tomatoes)**: Identifying 5 raw tomatoes estimates combined weight with an explicit range, flags `requires_confirmation: true`, and recalculates deterministically from the total confirmed or estimated weight.
5. **Example E (Mixed Indonesian Meal — Nasi Goreng)**: Decomposes *Nasi Goreng* into cooked rice, egg, chicken, vegetables, and inferred cooking oil/sambal, matches TKPI/USDA records by preparation state, distinguishes observed vs inferred components, and sums component calories deterministically.
6. **Example F (Imported Malaysian Product Scanned in Indonesia)**: Scanning a Malaysian product (`955...`) from an Indonesian IP preserves the Malaysian product identity, origin, nutrition, and ingredients while resolving the shopping market as Indonesia (`ID` / `IDR`) for pricing.
7. **End-to-End Verification**: TypeScript (`npm run typecheck`), Benchmark Suite (`npx tsx scripts/run-accuracy-benchmark.ts`), background Dev Server (`npm run dev`), and live Chrome DevTools (`chrome-devtools-mcp`) verification.

