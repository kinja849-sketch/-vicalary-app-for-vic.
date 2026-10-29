# Scanner Product Facts, Nutrition, Safety, and Pricing Truth Blueprint

## 1. Objective & Problem Statement
When a scanned barcode product passes the boycott gate (`status: "APPROVED"`), the user must receive **100% authentic, non-hallucinated product intelligence**:
1. **Accurate Brand & Ownership Context**: Resolve brand from Open Food Facts (`brands`, `brand_owner`, `brands_tags`) and surface any resolved parent company from `company_relationships` as factual manufacturer context.
2. **Full Authoritative Ingredients & Accurate Food Coloring Analysis**:
   - Extract real declared ingredients from Open Food Facts (`ingredients_text`, all localized `ingredients_text_*` variants, `ingredients_text_with_allergens*`, structured `ingredients` array, or `ingredients_tags`) or optional nutrition/ingredients panel OCR when an actual package/panel photo is present.
   - Remove silent fake ingredient fabrication (`NutritionNormalizer.resolvePackagedProductIngredients`) so generic category guesses (e.g., inventing Indonesian soda or noodle ingredients for unrelated products) never pollute the ingredient list or food coloring detector.
   - Run `FoodColoringService.analyze` strictly on real declared ingredients and `additives_tags`. When ingredients are missing/unavailable, return an explicit `unknown` coloring state (`status: 'unknown'`) rather than falsely displaying `"No added food colorings detected"`.
3. **Authoritative Calories, Macros, Sodium & Serving Basis**:
   - Remove silent fake nutrition fabrication (`NutritionNormalizer.resolvePackagedProductNutrition`) for non-water products.
   - Fix Open Food Facts nutriment extraction so `*_serving` and `*_100g` values are never mixed across macros, `0` values are preserved (not dropped by falsy checks), and Open Food Facts `sodium_100g` / `sodium_serving` (stored in **grams**) is properly converted to **milligrams (`mg`)** instead of rounding `<1g` down to `0mg`.
   - When nutrition is genuinely absent from the catalog (and no nutrition panel image is available for OCR), return explicit `null` values and display an honest unavailable state—never `"Calorie Data Pending"` and never fake zeros.
4. **Informative, Fact-Grounded Description & Advisor Narrative**:
   - Pass complete verified facts (brand, parent/manufacturer, origin country, quantity, serving size, category, Nutri-Score/NOVA group when available, declared ingredients, food colorings, and exact macros with basis) into `ProductAdvisor.analyze`.
   - Enforce deterministic post-validation on `ProductAdvisor` output so missing nutrition is never described as `0g` or invented numbers, and provide a rich multi-sentence deterministic fallback description if AI generation is unavailable.
5. **Explicit Profile-Aware Safety & Goal Fit Highlighting**:
   - Upgrade `SafetyEngine.evaluateProductSafety` to deterministically check all major allergen families (milk/dairy/lactose/whey/casein, eggs, fish, shellfish/crustaceans, peanuts, tree nuts, wheat/gluten/celiac, soy, sesame, sulfites, plus user-declared custom allergies), medical conditions (diabetes sugar gate, hypertension sodium gate), and **active user goal fit** (weight loss / calorie deficit vs. high sugar/calorie density, muscle gain vs. protein density, heart health vs. sodium/saturated fat).
   - Hard-highlight triggered allergy warnings, medical warnings, and goal-fit verdicts in the API response and in `components/ProductDetails.tsx` (including fixing the header badge so `healthStatus === 'POOR'` displays `'Avoid'` / `'Poor Fit'` in rose rather than `'Good'`).
6. **Non-Hallucinated Local Pricing**:
   - Follow strict priority order in `RetailPriceProvider`:
     1. Verified `product_price_cache` (or prior user-confirmed expense record in `expenses` for that barcode).
     2. Optional verified market web search (`SERPAPI_API_KEY` when configured), labeled as an estimate (`status: 'estimated'`, `needs_user_price: true`).
     3. Otherwise return `status: 'needs_user_price'`, `needs_user_price: true`, `price: null` (with an optional clearly labeled reference range hint in metadata, never pre-filled or saved as an authoritative shelf price without user input).
7. **Strict Gate Ordering in `ScannerDecisionEngine`**:
   - Step 1: Identify product (`BarcodeService.identifyProduct`).
   - Step 2: Run Parent-First Boycott Gate (`BoycottScreeningService.screenBrand`). If `FLAGGED`, stop immediately and return `FLAGGED` without running OCR or pricing lookups.
   - Step 3: Only when `APPROVED`, finalize product facts/OCR (`BarcodeService.enrichApprovedProductFacts`) and fetch localized price (`BarcodeService.priceProvider.getPrice`).

---

## 2. Source of Truth Map

| Displayed / Stored Value | Authoritative Source | Fallback / Unavailable State |
| :--- | :--- | :--- |
| `name`, `brand`, `category`, `serving_size`, `origin_country` | Open Food Facts v2 / v0 (`product_name*`, `brands`, `brand_owner`, `brands_tags`, `categories`, `serving_size`, `quantity`, `countries`) + `company_relationships` parent lookup | Explicit `'Unbranded'` / `'Unspecified'` |
| `ingredients` | Open Food Facts (`ingredients_text*`, `ingredients` array, `ingredients_tags`) → optional package panel OCR (`image_ingredients_url` / `packageImage`) | `null` (`ingredients_status: 'unavailable'`), never fabricated category recipes |
| `coloring` | `FoodColoringService.analyze(realIngredients, realAdditives)` | When ingredients & additives are both absent: `{ status: 'unknown', has_colorings: false, is_unknown: true, summary: 'Ingredients unavailable — food coloring cannot be verified' }` |
| `calories`, `protein`, `carbs`, `fat`, `sugar`, `fiber`, `sodium_mg`, `serving_basis` | Open Food Facts `nutriments` (consistent `serving` or `100g` basis; `sodium` converted from g to mg; Atwater kcal from declared macros if kcal key omitted; `0` for plain water) → optional nutrition label OCR | `null` (`nutrition_status: 'unavailable'`), never `"Calorie Data Pending"` and never fake `0` |
| `safety` & `goal_fit` | `SafetyEngine.evaluateProductSafety(product, nutrition, userSafetyProfile)` using Supabase `onboarding_responses` & `user_profiles` | Deterministic `isSafe`, `verdict`, `allergyWarnings`, `medicalWarnings`, and `goalFit` |
| `description`, `vitamins_and_nutrition`, `recommendation` | `ProductAdvisor.analyze` grounded strictly in verified product/nutrition/safety packet + deterministic fallback | Fact-grounded multi-sentence deterministic paragraphs |
| `price`, `price_metadata` | `product_price_cache` → user `expenses` barcode history → optional `SERPAPI_API_KEY` search → `needs_user_price` | `{ amount: null, status: 'needs_user_price', needs_user_price: true, reference_estimate: ... }` |

---

## 3. Files to Modify

1. [`lib/products/ProductProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/ProductProvider.ts)
   - Extend `NormalizedProduct`, `NormalizedProductNutrition`, and `ProductPrice` types to carry `manufacturer`, `origin_country`, `nutriscore_grade`, `nova_group`, `ingredients_status` (`'verified' | 'ocr' | 'unavailable'`), `nutrition_status` (`'verified' | 'ocr' | 'unavailable'`), and `ProductPrice.status` (`'verified' | 'estimated' | 'needs_user_price'`).
2. [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/BarcodeService.ts)
   - **`OpenFoodFactsProvider`**:
     - Expand OFF v2 fields and merge with v0/variant lookups when `ingredients_text` or `nutriments` is incomplete.
     - Extract `brand` from `brands`, `brand_owner`, or `brands_tags`.
     - Extract `ingredients` from all `ingredients_text*` keys (cleaning OFF underscore/HTML markup), structured `p.ingredients`, or `p.ingredients_tags`. Remove the call to `NutritionNormalizer.resolvePackagedProductIngredients`.
     - Extract `nutriments` with strict basis consistency (`serving` vs `100g`), preserve `0` values, convert OFF `sodium` from grams to `mg` (`* 1000` when in grams, or `salt * 400`), and compute Atwater kcal only when protein, carbs, and fat are all declared on the label. Remove the call to `NutritionNormalizer.resolvePackagedProductNutrition` for non-water items.
     - Separate fast catalog identification (`identifyProduct`) from post-boycott enrichment (`enrichApprovedProductFacts`) so panel OCR only runs on `APPROVED` products when catalog data is missing.
   - **`RetailPriceProvider`**:
     - Check `product_price_cache` first, then prior verified `expenses` for that barcode.
     - If not found and `SERPAPI_API_KEY` is configured, query Google Shopping and mark as `status: 'estimated'`, `needs_user_price: true`.
     - Otherwise return `status: 'needs_user_price'`, `price: 0`, `needs_user_price: true`, and attach the category heuristic only as `reference_estimate` so it is never mistaken for an authoritative cached price.
3. [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/nutrition/NutritionNormalizer.ts)
   - Remove silent fake category fills in `resolvePackagedProductNutrition` (keep only true zero-calorie plain mineral water recognition) and `resolvePackagedProductIngredients` so scanner flows never receive fabricated nutrition or ingredients. (Leave camera meal calculation `calculateMealNutrition` untouched as meal-camera behavior is out of scope).
4. [`lib/products/FoodColoringService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/FoodColoringService.ts)
   - Expand `COLOR_DATABASE` with additional US/EU/ID aliases (`red #40`, `yellow #5`, `yellow #6`, `blue #1`, `blue #2`, `red #3`, `green #3`, `lake` pigments, `e104`, `e120` carmine/cochineal, `e123`, `e131`, `e142`, `e151`, `e153`, `e155`, `e160d`, `e161b`, `e172`).
   - When `ingredientsText` is null/unavailable and `additiveTags` is empty, return `status: 'unknown'`, `is_unknown: true`, `has_colorings: false`, and `summary: 'Ingredients unavailable in catalog — food coloring status cannot be verified'`.
5. [`lib/scanner/ScannerDecisionEngine.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/scanner/ScannerDecisionEngine.ts)
   - Enforce strict sequence:
     1. `BarcodeService.identifyProduct(barcode)`
     2. `BoycottScreeningService.screenBrand(...)` → return `FLAGGED` immediately if boycotted.
     3. For `APPROVED` products only: resolve parent company context (if any non-boycotted parent exists in `company_relationships`), run `BarcodeService.enrichApprovedProductFacts(product, packageImage)`, and fetch price via `BarcodeService.priceProvider.getPrice(...)`.
6. [`lib/services/SafetyEngine.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/SafetyEngine.ts)
   - Expand `evaluateProductSafety` with comprehensive deterministic allergen synonym maps (dairy/milk/lactose/whey/casein, egg, fish, shellfish, peanut, tree nuts, wheat/gluten, soy, sesame, sulfites, plus custom user allergies), medical gates (diabetes sugar threshold, hypertension sodium threshold), and deterministic **Goal Fit evaluation** (`goalFit: { status: 'GOOD' | 'MODERATE' | 'POOR', headline: string, reason: string, targetGoal: string }`).
7. [`lib/ai/ProductAdvisor.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ProductAdvisor.ts)
   - Feed full verified product metadata, coloring summary, and `SafetyEngine` evaluation into `ProductAdvisor.analyze`.
   - Prevent the advisor or its fallback from outputting `0g` for `undefined`/`null` macros or inventing numbers when nutrition is unavailable.
   - Build a rich, informative deterministic fallback description using brand, manufacturer/parent, category, size, origin country, and declared ingredient highlights.
8. [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-product-barcode/route.ts)
   - Run `FoodColoringService.analyze` on real `p.ingredients` and `p.additives`.
   - Run `SafetyEngine.evaluateProductSafety` BEFORE `ProductAdvisor.analyze` so the advisor incorporates hard allergy/goal-fit findings, and enforce deterministic `healthStatus`, `safety_warnings`, and `goal_fit` in the response payload.
   - Preserve `needs_user_price`, `status`, and `reference_estimate` in `price_metadata`; return `price: null` when price is unverified so heuristic estimates are never passed as authoritative prices.
9. [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)
   - Fix header status pill so `healthStatus === 'POOR'` renders `'Avoid'` / `'Poor Fit'` in rose styling.
   - Render unknown food coloring state honestly when ingredients are unavailable instead of showing `"No added food colorings detected"`.
   - Render nutrition basis clearly (`Per Serving` vs `Per 100g`) and show explicit unavailable state when `calories === null`.
   - Highlight `safety_warnings` (Allergy / Medical alerts) and `goal_fit` (Objective alignment badge & explanation) prominently inside the Recommendation section.
   - Render `price_metadata` honestly: show verified prices directly, and when `needs_user_price` is true, prompt the user to enter/confirm the shelf price (displaying any reference estimate strictly as a labeled unverified hint).

---

## 4. Verification & Acceptance Criteria
1. **Known Barcode with OFF Data** (e.g., Indomie Mi Goreng `089686010947` / Barilla Spaghetti `8076800195057` / Loacker / Pocari Sweat / Ultra Milk):
   - Resolves accurate `name`, `brand`, full `ingredients` list, consistent `coloring` analysis, numeric `calories` and macros (`protein`, `carbs`, `fat`, `sugar`, `fiber`, `sodium_mg` properly in `mg`) with accurate `serving_basis`, informative multi-sentence `description`, and honest `price_metadata`.
2. **Allergy & Goal Fit Highlighting**:
   - When a user profile has an allergy (e.g., `milk`/`dairy`, `wheat`/`gluten`, `peanuts`, `eggs`, `soy`) or goal (`weight loss`, `muscle gain`, `diabetes`), scanning a matching product explicitly flags the allergen and highlights goal fit in both API response and `ProductDetails` UI.
3. **Missing Nutrition / Missing Ingredients**:
   - When a product has no nutriments or ingredients in OFF, returns `calories: null` and `ingredients: null` with explicit unavailable messaging and `coloring.is_unknown: true`—never `"Calorie Data Pending"`, never fake `0 kcal`, and never `"No added food colorings detected"`.
4. **Boycott FLAGGED Path Unchanged**:
   - Scanning a product under a boycotted parent (e.g., Oreo, Nescafé, Coca-Cola) still immediately returns `status: "FLAGGED"` with parent company highlighted.
