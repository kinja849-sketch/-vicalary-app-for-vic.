# Scanner IP-Based Price Estimation, Factory Packaging Ingredients & Product-Matched Calorie / Nutrition Facts — Implementation Blueprint

## 1. Executive Summary & User Intent
When a user scans a barcode on an `APPROVED` (non-boycotted) packaged product, the scanner result must faithfully reflect three authoritative pillars without touching any unrelated features or UI layouts:

1. **Price Estimation Strictly Based on the User's IP Address**:
   - The local retail price range (`price_range`, `price_min`, `price_max`, `price`, `currency`) must be determined strictly from the **user's IP address** (resolving the user's real country and local currency via client + server IP geolocation) and must never be overridden by barcode GS1 prefixes (e.g. `899`) or stale `user_settings.country_code` defaults.
2. **Authentic Factory Packaging Ingredients Format (`INGREDIENTS OF THE PRODUCT`)**:
   - Following the real-world factory packaging label standard (as illustrated in the user's reference nutrition/ingredients label):
     - Display the verbatim factory **`INGREDIENTS:`** declaration in descending order of weight, preserving parenthetical sub-ingredients exactly as printed on the factory packaging — e.g.:
       `INGREDIENTS: WATER, TOMATO PUREE (WATER, TOMATO PASTE), ENRICHED PASTA (WHEAT FLOUR, NIACIN, FERROUS SULFATE, THIAMINE MONONITRATE, RIBOFLAVIN, FOLIC ACID), ...`
     - Display the structured **Factory Ingredients Breakdown** parsed directly from the product's hierarchical factory formulation (each parent ingredient + its parenthetical sub-ingredients/percentages from the label, with zero AI-hallucinated filler).
     - Display the factory **`CONTAINS:`** allergen declaration (e.g., `CONTAINS: WHEAT, SOY, MILK.`) derived deterministically from the packaging's declared allergens/ingredients.
3. **Product-Matched Calorie Calculation & Factory Nutrition Facts Breakdown (`CALORIES`)**:
   - The calorie intake and macronutrient calculation must match the actual scanned product and its real serving/container size:
     - **Serving Size & Servings Per Container**: Accurately resolve `serving_size` (e.g., `200 ml`, `30 g`, `2/3 cup (55g)`) and `servings_per_container` (derived from package net quantity `size` ÷ `serving_quantity_g` when both exist).
     - **Serving vs. Per-100g Reconciliation**: Detect and fix Open Food Facts contributor mismatches where a full single-serve container's calories/macros (e.g., `Green Fields Low Fat Milk` with `86 kcal`, `6.8g protein`, `9.6g carbs`, `2.3g fat` for a `200 ml` carton) were entered under a `100 ml` serving label, or where `energy-kcal` was omitted/recorded in `kJ` while macros are present ($4\text{P} + 4\text{C} + 9\text{F} + 2\text{Fiber}$).
     - **Complete Factory Label Calorie & Nutrient Breakdown**: Extract and pass the full factory Nutrition Facts lines when present in the catalog or packaging OCR:
       - `Calories` (`kcal` per serving / per 100g)
       - `Total Fat` (`g` + `% Daily Value`)
       - `Saturated Fat` (`g` + `% Daily Value`)
       - `Trans Fat` (`g`)
       - `Cholesterol` (`mg` + `% Daily Value`)
       - `Sodium` (`mg` + `% Daily Value`)
       - `Total Carbohydrate` (`g` + `% Daily Value`)
       - `Dietary Fiber` (`g` + `% Daily Value`)
       - `Total Sugars` (`g`) & `Added Sugars` (`g` + `% Daily Value` when available)
       - `Protein` (`g` + `% Daily Value`)
       - Declared Micronutrients (`Vitamin D`, `Calcium`, `Iron`, `Potassium`, etc., with exact amounts/`% DV` when available).

---

## 2. Technical Root Cause Analysis

### 2.1 Why Price Estimation Drifted From the User's IP Address
- **Client IP Lookup (`lib/api/location.ts`)**:
  - `getUserLocationFromIP()` used a single provider (`https://get.geojs.io/v1/ip/geo.json`) with a `1500ms` timeout. When that call timed out on a mobile or local connection, it returned `{ country_code: 'US', currency: 'USD', method: 'FALLBACK' }` and cached that fallback in `localStorage` for 24 hours.
  - Furthermore, `LocationData` did not store `ip: data.ip`, so the client could not forward its resolved public IP address to the server when running on localhost or behind a proxy.
- **Server IP Resolution (`app/api/analyze-product-barcode/route.ts` & `lib/products/BarcodeService.ts`)**:
  - In `app/api/analyze-product-barcode/route.ts`, `userCountry` was computed as:
    `locationContext?.country_code || userSettings?.country_code || undefined`
    meaning a cached `'FALLBACK'` (`US`) or a stale `user_settings.country_code` could override the user's real IP country.
  - In `BarcodeService.ts` (`RetailPriceProvider.resolveCountryFromIp`), if `ipAddress` was `'127.0.0.1'` or `::1` and `geojs.io` failed, it fell back to `barcode.startsWith('899') ? 'ID' : 'US'` instead of trying backup IP geolocation providers (`ipwho.is`, `ipapi.co`).

### 2.2 Why Factory Ingredients Were Sometimes Incomplete or Not in Factory Label Format
- In `OpenFoodFactsProvider.extractDeclaredIngredients` (`lib/products/BarcodeService.ts`):
  - If `ingredients_text` was missing on the primary Open Food Facts record, it fell back to `p.ingredients_tags`, which in Open Food Facts is often a category/commodity tag (e.g., `"Durum wheat semolina pasta"` for Barilla Spaghettini `8076800195057`) rather than the factory ingredients statement (`INGREDIENTS: DURUM WHEAT SEMOLINA, WATER. CONTAINS: WHEAT.`).
  - When `p.ingredients` (the structured OFF array of ingredient objects `{ id, text, percent_estimate, percent, ingredients: [...] }`) was present, its parent-child sub-ingredient hierarchy and `allergens_tags` (`CONTAINS: ...`) were not surfaced in a dedicated factory label format (`INGREDIENTS: ...` + parenthetical sub-ingredients + `CONTAINS: ...`).

### 2.3 Why Calorie Calculation / Calorie Intake Mismatched Some Products
- In `OpenFoodFactsProvider.extractNutriments` (`lib/products/BarcodeService.ts`):
  - **Contributor Serving-Size Mismatch**: For products like `Green Fields Low Fat Milk` (`8993351112022`), Open Food Facts contributors entered `energy-kcal_100g: 86`, `proteins_100g: 6.8`, `carbohydrates_100g: 9.6`, `fat_100g: 2.3`, and `serving_size: "100 ml"`. Physiologically and per Greenfields' actual factory packaging, low-fat cow's milk is `43 kcal` and `3.4g protein` per `100 ml`, and `86 kcal` / `6.8g protein` is the **1-serving (`200 ml`)** intake! Because `serving_size` was mis-entered as `"100 ml"`, the UI displayed `86 kcal Per Serving (100 ml)` instead of matching the true `200 ml` serving size (or `43 kcal` per `100 ml`).
  - **Missing Extended Factory Nutrition Facts**: `trans-fat`, `cholesterol`, `added-sugars`, `servings_per_container`, and deterministic `% Daily Value` calculations were not extracted from `nutriments` or Packaging OCR.
  - **Incomplete Catalog Nutrition**: Some products in Open Food Facts have partial macros or missing `energy-kcal` where Atwater reconciliation ($4\text{P} + 4\text{C} + 9\text{F} + 2\text{Fiber}$) or exact barcode catalog enrichment is needed so the calorie intake matches the physical product.

---

## 3. Source of Truth & Deterministic Data Flow Map

```
User Barcode Scan
  ├── 1. IP Geolocation Resolution (Client + Server Multi-Provider)
  │     ├── Client `getUserLocationFromIP()`: geojs.io -> ipwho.is -> ipapi.co (returns ip, country_code, country_name, city, currency)
  │     └── Server `RetailPriceProvider.resolveIpLocation(requestIp, clientLocationContext)`:
  │           Resolves real IP country & currency strictly from User IP (never barcode prefix or stale profile)
  │           └── Computes local retail price range (`price_min`, `price_max`, `price`, `price_range`, `currency`) in User's IP Currency
  │
  ├── 2. Authoritative Product & Factory Label Extraction (`OpenFoodFactsProvider` + `BarcodeService`)
  │     ├── Factory Ingredients Statement (`ingredients`):
  │     │     Verbatim `INGREDIENTS: ...` with parenthetical sub-ingredients + `CONTAINS: ...` allergen declaration
  │     ├── Structured Factory Sub-Ingredient Breakdown (`factory_ingredients_breakdown`):
  │     │     Parsed top-level factory ingredients + their parenthetical sub-ingredients & declared percentages
  │     └── Factory Nutrition Facts & Reconciled Calorie Intake (`nutrition`):
  │           ├── `calories` (reconciled against $4P + 4C + 9F + 2\text{Fiber}$ and verified serving size)
  │           ├── `serving_size` & `servings_per_container`
  │           ├── `fat`, `saturated_fat`, `trans_fat`, `cholesterol_mg`, `sodium_mg`
  │           ├── `carbohydrates`, `fiber`, `sugar`, `added_sugar`
  │           ├── `protein`
  │           └── `daily_values` (% DV calculated deterministically from FDA 2,000 kcal standard)
  │
  └── 3. UI Presentation (`components/ProductDetails.tsx`)
        ├── `INGREDIENTS OF THE PRODUCT`:
        │     ├── Verbatim Factory Packaging Statement (`INGREDIENTS: ...` + `CONTAINS: ...`)
        │     ├── Structured Factory Ingredients & Sub-Ingredients Breakdown
        │     └── Food Coloring badges (only when present)
        ├── `CALORIES`:
        │     ├── Calorie Intake Hero (`calories kcal`, accurate `Serving size` & `Servings per container`)
        │     ├── Factory Nutrition Facts Breakdown (`Total Fat`, `Saturated Fat`, `Trans Fat`, `Cholesterol`, `Sodium`, `Total Carbohydrate`, `Dietary Fiber`, `Total Sugars`, `Protein` with `% Daily Value`)
        │     └── Vitamins, Minerals & Advisor Narrative
        └── `LOCAL RETAIL PRICE RANGE`:
              └── Displays IP-based price range & average retail price in the user's IP currency
```

---

## 4. Detailed File-by-File Implementation Plan

### 4.1 [`lib/api/location.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/location.ts)
- Add `ip?: string` to `LocationData`.
- Upgrade `getUserLocationFromIP()` to try a resilient multi-provider IP geolocation chain:
  1. `https://get.geojs.io/v1/ip/geo.json` (timeout `3500ms`)
  2. `https://ipwho.is/` (timeout `3500ms`)
  3. `https://ipapi.co/json/` (timeout `3500ms`)
- Map the resolved `country_code` through comprehensive ISO-3166 → ISO-4217 currency mapping (`COUNTRY_TO_CURRENCY`).
- Never cache a `'FALLBACK'` result in `localStorage`; if `localStorage` contains a previously cached `'FALLBACK'` entry, discard it and re-query the user's live IP.

### 4.2 [`lib/products/ProductProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/ProductProvider.ts)
- Extend `NormalizedProductNutrition` with optional factory label fields:
  - `trans_fat?: number;`
  - `cholesterol_mg?: number;`
  - `added_sugar?: number;`
  - `servings_per_container?: string;`
  - `daily_values?: { fat?: number; saturated_fat?: number; cholesterol?: number; sodium?: number; carbohydrates?: number; fiber?: number; added_sugar?: number; protein?: number };`
- Extend `NormalizedProduct` with:
  - `factory_ingredients_statement?: string;` (formatted `INGREDIENTS: ...` statement as printed on factory packaging)
  - `contains_statement?: string;` (formatted `CONTAINS: ...` allergen statement as printed on factory packaging)
  - `factory_ingredients_breakdown?: Array<{ name: string; sub_ingredients?: string; percentage?: string }>;`
- Extend `ProductPrice` with:
  - `ip_country_name?: string;`

### 4.3 [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/products/BarcodeService.ts)
- **IP Geolocation (`RetailPriceProvider.resolveIpLocation`)**:
  - Resolve the user's country and currency strictly from the user's IP (`geojs.io` → `ipwho.is` → `ipapi.co`), using the client's public IP or server request IP.
  - Never override the IP country/currency with barcode prefix (`899`) or stale user settings.
- **Factory Packaging Ingredients Extraction & Formatting**:
  - Extract the complete factory `ingredients_text` / hierarchical `ingredients` list from Open Food Facts (or packaging OCR when catalog text is empty).
  - Detect and replace 1-item category-tag placeholders (such as `"Durum wheat semolina pasta"` when the product's actual factory ingredient list is `"Durum Wheat Semolina, Water"`).
  - Build:
    - `factory_ingredients_statement`: Uppercase/clean factory packaging declaration `INGREDIENTS: ...` preserving parenthetical sub-ingredients (e.g., `ENRICHED PASTA (WHEAT FLOUR, NIACIN, FERROUS SULFATE, THIAMINE MONONITRATE, RIBOFLAVIN, FOLIC ACID)`).
    - `contains_statement`: `CONTAINS: ...` derived from declared allergens (`allergens_tags` and major allergen scan of the factory ingredients).
    - `factory_ingredients_breakdown`: Structured array splitting each top-level factory ingredient from its parenthetical sub-ingredients and declared percentage (e.g. `{ name: "Tomato Puree", sub_ingredients: "Water, Tomato Paste" }`), with zero hallucinated roles or synthetic prose.
- **Product-Matched Calorie Calculation & Nutrition Facts Reconciliation**:
  - Extract `trans-fat`, `cholesterol`, and `added-sugars` alongside `calories`, `fat`, `saturated-fat`, `sodium`, `carbohydrates`, `fiber`, `sugars`, and `protein` in both `extractNutriments` and `extractNutritionFactsFromImage`.
  - Add `reconcileProductCalorieIntake(product)`:
    - Reconciles energy (`calories`) with macronutrients ($4\text{P} + 4\text{C} + 9\text{F} + 2\text{Fiber}$) when `calories` is missing, zeroed erroneously on a caloric food, or entered in `kJ`.
    - Detects and corrects serving-size vs. per-100g contributor mismatches (e.g., when a liquid milk product like `Green Fields Low Fat` has `86 kcal` and `6.8g protein`—which is the exact `200 ml` single-pack nutrition—tagged under `100 ml`, updates the serving basis to `200 ml` so the calorie intake accurately matches the product).
    - Computes `servings_per_container` when package net `size` and `serving_size` are both known (e.g., `1000 ml` container with `200 ml` serving → `5 servings per container`).
    - Computes deterministic FDA `% Daily Value` (`daily_values`) for `fat` (78g), `saturated_fat` (20g), `cholesterol` (300mg), `sodium` (2300mg), `carbohydrates` (275g), `fiber` (28g), `added_sugar` (50g), and `protein` (50g).

### 4.4 [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-product-barcode/route.ts)
- Extract client IP from request headers (`x-nf-client-connection-ip`, `x-forwarded-for`, `x-real-ip`) and `locationContext?.ip`.
- Pass only IP-verified location context (`locationContext.method === 'IP'`) and the request IP to `barcodeService.scanBarcode`, never overriding IP geolocation with `userSettings?.country_code`.
- Return the complete factory ingredients fields (`factory_ingredients_statement`, `contains_statement`, `factory_ingredients_breakdown`), extended nutrition facts (`saturated_fat`, `trans_fat`, `cholesterol_mg`, `added_sugar`, `servings_per_container`, `daily_values`), and IP-derived `price_metadata` in the response payload.

### 4.5 [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)
- Inside **`INGREDIENTS OF THE PRODUCT`**:
  - Render the factory packaging declaration box in authentic packaging format:
    - `INGREDIENTS:` followed by the full factory ingredients statement (with parenthetical sub-ingredients).
    - `CONTAINS:` followed by the declared allergens when present.
  - Render the **Factory Ingredients Breakdown** showing each factory ingredient and its parenthetical sub-ingredients / percentage clearly.
- Inside **`CALORIES`**:
  - Display the reconciled `Calories` (`kcal`), `Serving size`, and `Servings per container` (when available).
  - Display the complete **Factory Nutrition Facts** breakdown (`Total Fat`, `Saturated Fat`, `Trans Fat`, `Cholesterol`, `Sodium`, `Total Carbohydrate`, `Dietary Fiber`, `Total Sugars`, `Protein`, and `% Daily Value*`) matching the product's nutrition panel alongside the macro summary grid and advisor explanation.
- Inside **`LOCAL RETAIL PRICE RANGE`**:
  - Display the IP-based local retail price range and average price in the currency of the user's IP address.

---

## 5. Verification & Acceptance Criteria
1. **Typecheck**: `npx tsc --noEmit` passes with zero errors.
2. **Automated Barcode Suite (`scripts/verify-scanner-product-facts.ts`)**:
   - Verifies that approved products (`8992761139018`, `8996001600146`, `8999999056896`, `8076800195057`, `8993351112022`) return:
     - Authentic `INGREDIENTS:` statement + `CONTAINS:` allergen line + structured sub-ingredient breakdown (no 1-tag placeholder or hallucinated roles).
     - Reconciled calorie intake (`calories`, `serving_size`, `servings_per_container`, macros, and `% Daily Value`) matching the real product.
     - IP-based local retail price range in the IP-detected currency.
3. **Live Browser Verification (`chrome-devtools-mcp` at `http://localhost:8080`)**:
   - Verify live barcode scan rendering on `http://localhost:8080` and confirm zero console or server errors.
