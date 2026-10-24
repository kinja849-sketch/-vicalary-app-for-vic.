# Implementation Prompt: Scanner Truthfulness — Ingredients, Calories, Price, and Medication Identity (Zero Pending / Zero Hallucination)

## 1. Executive Summary & Objective
Transform barcode, package, meal, and medication scanning in VicCalary to return strictly grounded, authentic facts:
1. **Packaging Ingredients**: Always surface authentic ingredients from Open Food Facts (OFF) language variants, ingredient arrays, or dedicated vision OCR of the "Ingredients:" panel. Never drop ingredients in client state or replace them with AI narrative. If unknown, show explicit: *"Ingredients not listed in database; photograph the ingredients panel"* — never blank, never "pending".
2. **Calories & Macros (Zero Pending / Zero Fake Zeros)**: Eradicate the `"Calorie Data Pending"` UI copy. Prefer serving-basis, then 100g OFF nutriments. When nutriments are null, run second-pass Nutrition Facts OCR from package images (front/back or user photo) to extract calories, fat, carbs, protein, fiber, sugar, sodium, and serving size. Only set numeric 0 when verified on label or for true zero-energy items (e.g., plain water). Never pass fake 0g to LLM narrative prompts or silently save missing calories as 0 in daily intake logs.
3. **Price Anti-Hallucination**: Priority order: User-confirmed → `product_price_cache` → optional paid retail search → low-confidence labeled estimate (`needs_user_price: true`). Heuristic category fallbacks must never be presented as authoritative facts; they must prompt the user for shelf price, which writes back to `product_price_cache`.
4. **Medication Clinical Identity**: Expand `max_tokens` and strengthen vision prompts in `/api/analyze-medication` to extract exact trade names, generic INNs, active ingredients with strengths (e.g., "Guaifenesin 100mg/5mL", "Sodium citrate 45mg/5mL"), inactive excipients, and specific mechanisms/indications. Reject/retry if the result contains boilerplate like *"Scanned Medication"*, *"Pharmaceutical Product"*, or *"Medication indication"*. Surface brand + generic + actives + mechanism first in the UI.
5. **Preserved UI Surface**: Maintain all existing styles, layouts, dark/light modes, navigation, and mobile behavior while fixing data integrity underneath.

---

## 2. Root Cause Analysis of User Screenshots

| Issue | Observed Symptom | Technical Root Cause |
|---|---|---|
| **Screenshot 1: Medication** | "Scanned Medication", brand "Pharmacy", generic "Pharmaceutical Product", purpose "Medication indication", boilerplate admitting "indication is currently undefined" | `app/api/analyze-medication/route.ts` capped `max_tokens: 500` for an 8-field clinical prompt. JSON truncated, `parseJSONSafely` swallowed the syntax error, returning `{}`. Fallbacks `Scanned Medication`, `Pharmacy`, `Pharmaceutical Product`, and `Medication indication` were passed to the clinical synthesis step, producing empty boilerplate. Furthermore, `ProductDetails.tsx` never rendered `active_ingredients`. |
| **Screenshot 2: Nutrition** | "Calorie Data Pending", macros "-", narrative claiming "0g or 0mg" | In `ProductAdvisor.ts`, lines 18-24 defaulted missing macros to `0g` / `0mg` in the LLM prompt (`- Protein: ${n.protein !== undefined ? ... : '0g'}`). The LLM faithfully repeated that protein/carbs/fat/sugar/sodium were 0g/0mg. In `ProductDetails.tsx`, line 629 hardcoded `"Calorie Data Pending"`. No second-pass Nutrition Facts OCR was executed. |
| **Screenshot 3: Package Label** | Campbell's can showing "Nutrition Facts 230 Calories, 8g Fat, 37g Carbs, 3g Protein" & "INGREDIENTS: WATER, TOMATO PASTE..." | OFF lacks nutriments or ingredients for this barcode variant, but the package image clearly contains the full Nutrition Facts and Ingredients panel. The pipeline lacked a vision OCR fallback to extract this data. |
| **Dashboard State Drop** | Scanned product card missing ingredients | `Dashboard.tsx` (`handleBarcodeScan`) manually constructed `formattedProduct` and omitted `ingredients: data.ingredients`, `price_metadata`, `active_ingredients`, etc. |

---

## 3. Architecture & Data Flow

```
[ Barcode / Package Image / Meal Photo ]
                │
                ▼
      ┌──────────────────┐
      │  Scan Decision   │
      │      Engine      │
      └─────────┬────────┘
                │
   ┌────────────┴────────────┐
   │ (Food Barcode)          │ (Medication Photo)
   ▼                         ▼
┌──────────────────────┐  ┌───────────────────────────────────┐
│ BarcodeService       │  │ /api/analyze-medication           │
│ - OFF Provider       │  │ - Dedicated Vision Prompt         │
│ - Language Variants  │  │   (max_tokens: 1200)              │
│ - Ingredients Array  │  │ - Extract Brand, Generic INN,     │
│ - If null: Vision    │  │   Actives + Strengths, Purpose    │
│   Label OCR          │  │ - Validate against placeholders   │
│ - RetailPriceProvider│  │ - SafetyEngine: Gate on Actives   │
│   (needs_user_price) │  └─────────────────┬─────────────────┘
└──────────┬───────────┘                    │
           │                                │
           ▼                                ▼
┌──────────────────────┐  ┌───────────────────────────────────┐
│ /api/analyze-product │  │ ProductDetails.tsx                │
│ - ProductAdvisor     │  │ - Real Brand & Generic INN        │
│   (no fake 0g)       │  │ - Active Ingredients Chips        │
│ - Ban "Pending" copy │  │ - Mechanism & Purpose             │
│ - Accurate macros    │  │ - Medical Disclaimer              │
└──────────┬───────────┘  └───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ ProductDetails.tsx (Food)            │
│ - Calories: Real ~kcal or            │
│   "Not available — scan label"       │
│ - Ingredients: Packaging list or     │
│   "Ingredients not listed in db"     │
│ - Price: Verified Cache or           │
│   "Estimated (tap to confirm)"       │
└──────────────────────────────────────┘
```

---

## 4. Detailed Implementation Tasks

### Task 1: Package Food & Barcode Ingredients Extraction (`lib/products/BarcodeService.ts`, `lib/nutrition/NutritionNormalizer.ts`)
- In `OpenFoodFactsProvider.fetchOFFProduct`:
  - Request comprehensive fields: `product_name,product_name_en,brands,quantity,serving_size,categories,image_url,image_front_url,image_nutrition_url,image_ingredients_url,ingredients_text,ingredients_text_en,ingredients_text_id,ingredients_text_fr,ingredients_text_de,ingredients,ingredients_tags,allergens_tags,additives_tags,nutriments`.
- In `OpenFoodFactsProvider.identifyProduct`:
  - Extract declared ingredients checking: `ingredients_text`, language variations (`ingredients_text_id`, `ingredients_text_en`, `ingredients_text_fr`, `ingredients_text_de`), and `ingredients` array (`p.ingredients.map(i => i.text)`).
  - If still missing, check `NutritionNormalizer.resolvePackagedProductIngredients`.
  - If still missing and a package image URL is present (`image_ingredients_url` or `image_front_url` or `image_url`), call vision helper `extractIngredientsFromImage(imageUrl)` to OCR the text following "Ingredients:".
  - If still unknown, return explicit: `"Ingredients not listed in database; photograph the ingredients panel"`.

### Task 2: Calories & Macros Grounding — Eliminate "Pending" & Fake Zeros (`lib/products/BarcodeService.ts`, `lib/ai/ProductAdvisor.ts`, `components/ProductDetails.tsx`)
- In `OpenFoodFactsProvider.identifyProduct`:
  - Check serving-basis and 100g basis nutriments for calories, protein, carbs, fat, fiber, sugar, sodium.
  - If calories is still null/undefined and a package image is available (`image_nutrition_url`, `image_front_url`, `image_url`), call vision helper `extractNutritionFactsFromImage(imageUrl)` to OCR: `calories`, `protein`, `carbohydrates`, `fat`, `fiber`, `sugar`, `sodium_mg`, `serving_size`.
  - True zero-energy items: If product is water (`water`, `mineral water`, `air mineral`), set calories to 0. Otherwise, preserve `null`/`undefined` if no data exists.
- In `lib/ai/ProductAdvisor.ts`:
  - Fix lines 18-24: If a macro is `undefined`, output `- Protein: Not documented / unlisted` instead of `0g`!
  - Add explicit rule to the system prompt: *"If nutritional data is unlisted or unknown, explicitly state that nutritional facts are not documented on the packaging; DO NOT claim or assume 0g or 0mg unless the product is verified zero-energy (like plain water)."*
- In `components/ProductDetails.tsx`:
  - Ban `"Calorie Data Pending"`.
  - When calories is null/undefined: render `<span className="text-xl font-bold text-slate-500 dark:text-slate-400">Not available — scan nutrition label</span>`.
  - For the macro grid: when null/undefined, render `–` with a subtle tooltip/caption indicating "Not documented".
  - In the Ingredients section: If ingredients equals `"Ingredients not listed in database; photograph the ingredients panel"`, do not display the "Authentic Label" badge; display the helpful prompt instead.

### Task 3: Anti-Hallucination Pricing (`lib/products/BarcodeService.ts`, `app/api/analyze-product-barcode/route.ts`, `components/ProductDetails.tsx`)
- In `RetailPriceProvider`:
  - Strict priority:
    1. User-confirmed price
    2. `product_price_cache` (valid 30 days)
    3. Optional paid retail search (e.g. SerpAPI)
    4. Local market estimate based on category and volume:
       - Set `confidence: 0.35` (low confidence).
       - Set `needs_user_price: true`.
       - Set `source: 'Estimated Local Market Price (Unconfirmed)'`.
- In `components/ProductDetails.tsx`:
  - When `price_metadata?.needs_user_price === true`:
    - Display label: `"Estimated shelf price (tap to confirm)"`.
    - Allow single tap to edit and enter shelf price.
    - When confirmed, upsert to `product_price_cache` with `source: 'User Confirmed Shelf Price'`, `confidence: 1.0`.

### Task 4: Medication Vision Extraction & UI Fidelity (`app/api/analyze-medication/route.ts`, `components/ProductDetails.tsx`)
- In `app/api/analyze-medication/route.ts`:
  - Increase `max_tokens` from 500 to 1200 to eliminate token truncation.
  - Set image detail to `high` when image is sent.
  - Require the vision model to extract:
    - `name`: Exact commercial/brand name on the box (e.g., "Guaifenesin Sodium citrate Syrup").
    - `generic_name`: INN generic name(s).
    - `active_ingredients`: Array of actives with dosages/strengths (e.g., `["Guaifenesin", "Sodium citrate"]`).
    - `inactive_ingredients`: Visible excipients (syrup, sweeteners, colorings).
    - `purpose`: Precise clinical indication and mechanism (e.g., "Expectorant and mucolytic cough syrup to thin mucus and relieve productive chest cough").
    - `warnings`, `side_effects`, `interactions`.
  - Validation gate: If `name` is still `"Scanned Medication"` or `purpose` is `"Medication indication"`, retry with a secondary high-focus text-extraction prompt.
  - Pass extracted active ingredients to `SafetyEngine` for allergy, diabetic (syrups/sugars), and hypertension contraindications.
- In `components/ProductDetails.tsx`:
  - Render Medication details:
    - Brand Name in the hero banner.
    - Generic INN badge (`Generic: ${generic_name}`).
    - Active Ingredients chip list: `Guaifenesin`, `Sodium citrate` with strengths.
    - Mechanism & Purpose box with clear clinical indication.
    - Warnings, Side Effects, Interactions.
    - Prominent clinical educational disclaimer: *"VicCalary provides educational health information and is not a substitute for professional medical advice, diagnosis, or treatment."*

### Task 5: Meal Camera Analysis, Accurate Meal Distinction, Informative Descriptions & Intake Grounding (`app/api/analyze-food-image/route.ts`, `lib/ai/ProductAdvisor.ts`, `lib/api/food.ts`, `app/_pages/Dashboard.tsx`)
- In `app/api/analyze-food-image/route.ts`:
  - Enhance vision identification prompt:
    - **Accurate Meal Distinction**: Mandate distinguishing each individual culinary component cleanly (e.g., grilled protein, specific grain/starch, cooked/raw vegetables, sauces/dressings, side items) rather than grouping whole meals into an undifferentiated lump.
    - **Accurate Calorie Calculation**: Require realistic portion estimation in grams grounded in visual volume, standard plate dimensions, and food density. Avoid systematic inflation (e.g. overestimating 150g fries as 400g) or underestimation.
    - **Informative, Substantive Descriptions**: Generate a rich, informative paragraph in `meal_description` articulating exactly what the dish is, how each distinct ingredient appears prepared (e.g. pan-seared, roasted, steamed), textures, and visible portion sizing, rather than superficial 1-sentence summaries.
  - In `vitamins_and_nutrition`: Provide an articulate clinical evaluation of the meal's nutrient profile (satiety index, micronutrients, glycemic balance).
- In `lib/ai/ProductAdvisor.ts`:
  - Provide an informative, well-grounded product description (2 to 4 rich sentences) covering brand background, manufacturing type, culinary usage, and certified attributes, without boilerplate filler or hallucinations.
- In `lib/api/food.ts` (`saveFoodAnalysis`):
  - Do NOT silently convert `null` calories into `0`! Store `calories: analysis.calories ?? null`.
- In `app/_pages/Dashboard.tsx` (`handleBarcodeScan` and `handleQRManualCapture`):
  - Fix state mapping so `ingredients`, `price_metadata`, `active_ingredients`, `coloring`, `vitamins`, `minerals`, `serving_basis`, and `price` are all preserved in `formattedProduct`.

### Task 6: Verification, Server Restart & Automated Regression Tests (`scripts/test-scanner-truth.ts`)
- Write standalone verification script `scripts/test-scanner-truth.ts` covering:
  1. Food barcode with full OFF data: verifies non-empty ingredients, numeric calories, and macros.
  2. Barcode with empty nutriments + nutrition label photo (Campbell's can): verifies OCR extracts 230 kcal, 8g fat, 37g carbs, 3g protein.
  3. Indonesian 899 barcode price path: verifies estimated price with `needs_user_price: true` and labeled estimate.
  4. Guaifenesin syrup package photo: verifies extracted name, actives (Guaifenesin, Sodium citrate), and indication without "Scanned Medication" placeholders.
  5. Water: verified 0 kcal without "Calorie Data Pending".
- Kill any existing dev server and restart cleanly (`next dev -p 8080`) as a background daemon process.
- Verify localhost via DevTools MCP at `http://localhost:8080`.

---

## 5. Affected Files & References

- [lib/products/BarcodeService.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/BarcodeService.ts)
- [lib/products/ProductProvider.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/ProductProvider.ts)
- [lib/nutrition/NutritionNormalizer.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/nutrition/NutritionNormalizer.ts)
- [lib/ai/ProductAdvisor.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ProductAdvisor.ts)
- [app/api/analyze-product-barcode/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-product-barcode/route.ts)
- [app/api/analyze-medication/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-medication/route.ts)
- [app/api/analyze-food-image/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-food-image/route.ts)
- [components/ProductDetails.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)
- [app/_pages/Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx)
- [lib/api/food.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/food.ts)
- [scripts/test-scanner-truth.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/scripts/test-scanner-truth.ts)
