# Implementation Prompt: Authentic Scan Nutrition, Authentic Pricing, Accurate Ingredients/Coloring, and Daily Budget Deduction

## 1. Core Principles & User Requirements
1. **Preserve Analysis Format Exactly**:
   - The UI presentation and structure of analysis screens must remain identical in design, styling, and flow.
   - No redesign. The visual layout, typography, dark slate containers (`bg-slate-900/90 rounded-[2rem]`), and action docks remain intact.
2. **Strict Separation Between Scanner and Camera Progress**:
   - **Camera (`FOOD`)**: Solely analyzes meals and calculates meal calories via photo or live picture. When logged, it updates `daily_progress` (Today's Calorie Progress and macros).
   - **Scanner (`BARCODE`)**: Scans product barcodes, verifies boycott status (flags if boycotted, clears if not), reports authentic calories, reflects actual ingredients and colorings, gives health recommendations, and determines local price via user's IP. **When logged, it deducts from the user's daily budget only; it DOES NOT show up in daily calorie progress.** Daily progress is exclusively for meals that you eat.
3. **Ingredients & Coloring Reflected Accurately**:
   - Ingredients from Open Food Facts must be clearly reflected in the analysis.
   - Food colorings must be accurately identified (distinguishing synthetic colors such as Tartrazine CI 19140, Sunset Yellow, Allura Red from natural colors like Caramel, Beta-carotene, Curcumin, or confirming no artificial colorings detected). No bogus guesses.
4. **Authentic IP-Determined Local Pricing**:
   - Resolved by the user's IP address and country location context (e.g. US IP resolves American market pricing; Indonesian IP resolves Indonesian market pricing).
   - Grounded in authentic cached or reported market records, never distorted category multipliers labeled as 0.95-confidence verified. Users can verify or edit the exact amount before confirming.
5. **Continuous Budget Deduction on Scan Log**:
   - Clicking "Budget" on the product analysis creates the purchase transaction in the budget ledger (`financial_transactions` and `budget_transactions`).
   - The Budget screen's daily allowance and remaining spend reflect this deduction immediately upon logging.

---

## 2. Technical Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│ BARCODE SCAN FLOW                                                      │
│ 1. Barcode resolved via Open Food Facts v2.                           │
│ 2. Boycott Gate: BoycottScreeningService screens brand/company.         │
│ 3. If Ethically Cleared:                                               │
│    - Ingredients: Extracted directly from OFF ingredients_text.        │
│    - Coloring: FoodColoringService detects synthetic vs natural E-tags.│
│    - Nutrition: Label nutriments per serving / per 100g.               │
│    - Price: IP location -> country market cache / verified search.     │
│ 4. User views exact same layout with Ingredients & Coloring added.     │
│ 5. User taps "Budget":                                                 │
│    - saveFoodAnalysis(userId, item, isPurchaseConfirmed=true)          │
│    - is_scanner_product = true: DEDUCTS from daily budget ledger.      │
│    - SKIPS updateDailyProgress (DOES NOT add to calorie progress).     │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ CAMERA MEAL FLOW                                                       │
│ 1. Photo analyzed by vision for items & realistic portions.            │
│ 2. Portion clamping applied (10g - 500g realistic range).              │
│ 3. NutritionNormalizer calculates deterministic calories & macros      │
│    (using expanded USDA + Indonesian dish database).                   │
│ 4. User taps "Log to Diary":                                           │
│    - Updates daily_progress (Today's Calorie Progress).                │
│    - Does NOT deduct from financial budget.                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component & File Changes

### A. [`lib/api/food.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/food.ts)
- In `saveFoodAnalysis(userId, analysis, isPurchaseConfirmed)`:
  - Add `is_scanner_product` boolean check:
    - **If `analysis.is_scanner_product` is true**:
      - **DO NOT call `updateDailyProgress`**. (Calorie progress remains solely for meals eaten).
      - When `isPurchaseConfirmed` is true and `price > 0`:
        - Write expense into `financial_transactions` with user's active currency and timestamp.
        - Check and sync active `user_budgets` and `budget_transactions`.
        - Cache the price into `product_price_cache` with user's country code.
    - **If `analysis.is_scanner_product` is false (Camera Meal)**:
      - Call `updateDailyProgress` to sync calories, protein, carbs, fat, fiber, and sugar to Today's Progress.
      - Do not deduct financial budget unless explicitly confirmed as a purchase.
  - Invalidate React-Query caches (`active-budget`, `budget`, `financial-transactions`, `daily-progress`, `progress`).

### B. [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)
- Keep the exact existing visual format, colors, padding, and layout intact.
- Add `ingredients` and `coloring` props to `ProductDetailsProps`.
- Render verified Ingredients and Coloring within the product information card using the exact existing styling:
  - **Ingredients**: Full verified ingredient list from packaging.
  - **Coloring**: Accurate status (Synthetic coloring badges with specific names like Tartrazine CI 19140 / Sunset Yellow, or Natural coloring badges like Caramel IV / Curcumin, or "No artificial coloring detected").
- Render IP-grounded local price with ability to edit or confirm before logging.
- Set `is_scanner_product: true` when building `analysisToSave` in `handleConfirmLog`.
- When tapping the green "Budget" button: saves purchase, deducts from budget, and redirects to `/budget`.

### C. [`lib/products/FoodColoringService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/FoodColoringService.ts) (New)
- Dedicated deterministic parser for food colorings:
  - Synthetic colors: E102 (Tartrazine / CI 19140 / Yellow 5), E110 (Sunset Yellow / CI 15985), E122 (Carmoisine), E124 (Ponceau 4R), E127 (Erythrosine), E129 (Allura Red / Red 40), E132 (Indigotine), E133 (Brilliant Blue), E142, E143 (Fast Green), E171 (Titanium Dioxide). Indonesian synonyms included.
  - Natural colors: E100 (Curcumin/Kunyit), E101 (Riboflavin), E140/E141 (Chlorophyll), E150a-d (Caramel I-IV), E160a (Beta-carotene), E160b (Annatto), E162 (Beetroot red), E163 (Anthocyanins).
  - Clean detection summary: `has_colorings`, `has_synthetic`, `synthetic_colors`, `natural_colors`, `summary`.

### D. [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/BarcodeService.ts)
- In `OpenFoodFactsProvider`:
  - Fetch `additives_tags`, `additives_original_tags`, `ingredients_text`, `nutriments`.
  - Pass ingredients and additives into normalized product.
- In `RetailPriceProvider`:
  - Determine country and currency strictly from user's IP / location context.
  - Query `product_price_cache` for `(barcode, country)`.
  - Remove fictional `baseUsd * baseMultiplier` category math that claimed 0.95 verified confidence.
  - If no cache exists, return unverified price metadata (`needs_user_price: true`), prompting the user for authentic shelf input.

### E. [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-product-barcode/route.ts)
- If product not found in OFF, return `found: false, needs_crowdsourcing: true`. Never invent fictional calories or products.
- Evaluate `FoodColoringService` on product ingredients and additives.
- Return `ingredients`, `coloring`, authentic `calories`, `recommendation`, and IP-derived local price.

### F. [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/nutrition/NutritionNormalizer.ts)
- Enforce portion clamping (10g - 500g) on visual items to prevent distorted calorie totals.
- Expand reference database with USDA items and Indonesian staples (Nasi Putih, Nasi Goreng, Ayam Goreng, Ayam Bakar, Rendang Sapi, Sate Ayam, Telur Dadar/Ceplok, Tahu/Tempe Goreng, Gado-Gado, Soto Ayam, Bakso Sapi, Mie Goreng, Sambal, etc.).
- Maintain strict deterministic totals in [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-food-image/route.ts).

---

## 4. Acceptance Criteria & Verification

1. **Barcode Scan Format & Content**:
   - Product details screen maintains identical visual appearance.
   - Shows what the product is and its brand.
   - Boycott flag / clearance gate operates perfectly as before.
   - Calories and nutrition match packaging data without distortion.
   - Ingredients are clearly reflected.
   - Food coloring is accurately reported (synthetic vs natural vs none).
   - Recommendation is grounded in real facts.
   - Local price corresponds to user's IP country (American for US, IDR for ID).
2. **Scanner Log -> Budget Deduction (No Calorie Progress)**:
   - Tapping "Budget" logs the item and deducts price from daily budget.
   - Calorie progress on Dashboard / Progress screen remains untouched.
3. **Camera Meal -> Calorie Progress (No Budget Deduction)**:
   - Taking a food photo calculates accurate calories.
   - Tapping "Log to Diary" updates Today's Progress calories/macros.
   - Does not alter financial spending budget.
4. **Code Quality**:
   - Clean compilation, zero lint or type errors on modified files.
