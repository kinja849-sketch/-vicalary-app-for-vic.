# Universal Barcode Local Pricing Engine — Implementation Blueprint

## 1. Executive Summary & Objective
When a user scans a food or packaged product barcode, the application successfully authenticates and displays calories, macros, ingredients, allergens, and ethical status. However, the **local retail price currently fails to resolve** and returns `null`, forcing the user to manually type the price into an input box to deduct it from their budget.

**The Objective**:
Ensure that the local retail price is automatically and authoritatively resolved for the scanned barcode across **every single country** without requiring manual user input:
1. It looks into authenticated global and local retail sources (Open Food Facts Open Prices, live retail market search via SearchApi / Google Shopping, verified cache).
2. When an exact store receipt does not exist yet, it computes an authentic, country-specific market estimate based on product category, package size, local Consumer Price Index (CPI), and live exchange rates.
3. It pre-populates the local price and price range in the user's local currency automatically, making manual entry optional rather than mandatory.
4. It preserves all existing camera, barcode scanning, boycott gates, nutrition calculations, and UI layouts without regression.

---

## 2. API Key Role, Protection & Benefits
The provided API key (`live_tstEmFIp8YyrhJiJRGWVFW3hu_epmiVa`):
- **What it does**: Authenticates against SearchApi / Google Shopping API to execute live regional search engine queries for product barcodes, brands, and product titles against localized merchant indexes.
- **How it meets the objective**: By passing `gl={userCountryCode}` (e.g. `gl=id`, `gl=us`, `gl=gb`, `gl=de`, `gl=my`, `gl=sa`, etc.), it extracts live retail shelf listings, actual store names (Walmart, Indomaret, Tesco, Carrefour, etc.), and extracted market prices directly in the user's local currency.
- **Security & Secret Protection**:
  - The key is saved in `.env.local` as `SEARCHAPI_API_KEY` and `SERPAPI_API_KEY`.
  - `.env.local` is strictly ignored by `.gitignore` (`.env`, `.env.*`, `*.local`).
  - The key has **no** `NEXT_PUBLIC_` prefix and is executed strictly in server-side Next.js route handlers / Node services (`lib/products/BarcodeService.ts`). It will never be exposed to browser bundles or client network logs.

---

## 3. Architecture & Cascading Pricing Pipeline

The new `RetailPriceProvider.getPrice()` implementation follows a robust, deterministic 4-tier cascading resolution:

```
[ Barcode Scanned ]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Tier 1: Supabase Price Cache (`product_price_cache`)   │
│ - Check exact barcode + country within last 30 days    │
└──────────────────────────┬─────────────────────────────┘
                           │ Miss
                           ▼
┌────────────────────────────────────────────────────────┐
│ Tier 2: Open Food Facts Open Prices API                │
│ - `prices.openfoodfacts.org/api/v1/prices`             │
│ - Filter by `product_code={barcode}` & country/currency │
│ - Calculate median retail price & verified range       │
└──────────────────────────┬─────────────────────────────┘
                           │ Miss
                           ▼
┌────────────────────────────────────────────────────────┐
│ Tier 3: Real-Time Local Retail Search Intelligence     │
│ - Powered by SEARCHAPI_API_KEY / SERPAPI_API_KEY       │
│ - Query live Google Shopping: `engine=google_shopping` │
│   with `q=${brand} ${name} ${barcode}` & `gl=${country}`│
│ - Extract verified local store price, range & retailer │
└──────────────────────────┬─────────────────────────────┘
                           │ Miss
                           ▼
┌────────────────────────────────────────────────────────┐
│ Tier 4: Category Econometric Benchmark Engine (100%)   │
│ - Categorize product (instant noodles, dairy, snacks,  │
│   beverages, cooking oil, sauces, meat, produce, etc.) │
│ - Scale baseline unit price by package weight/volume   │
│ - Adjust by Country Food CPI ratio + Live FX Rates     │
│ - Output realistic local currency price & range        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Auto-Cache to Supabase `product_price_cache`           │
│ - Store resolved price for future instant hits (0ms)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Seamless Frontend Display (`ProductDetails.tsx`)       │
│ - Pre-populate price automatically in local currency    │
│ - Display price range & retailer source                │
│ - Manual entry is optional adjustment, not required    │
└────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component & Service Specifications

### 4.1 Tier 1: Supabase Cache (`product_price_cache`)
- Check `product_price_cache` table for `product_id = barcode` and `country = normCountry`.
- If a valid entry exists within 30 days with `price > 0`, return it immediately with status `'verified'` or `'estimated'`.

### 4.2 Tier 2: Open Food Facts Open Prices API
- Endpoint: `https://prices.openfoodfacts.org/api/v1/prices?product_code={cleanBarcode}&page_size=20`
- Parse items matching `currency === userCurrency` or `country === normCountry`.
- Compute:
  - `price`: Median of matching prices.
  - `price_min`: Lowest observed price.
  - `price_max`: Highest observed price.
  - `retailer`: Most frequent store name (e.g., "Carrefour", "Indomaret", "Walmart").
  - `status`: `'verified'`.
  - `source`: `"Open Prices Crowdsourced Retail Record"`.

### 4.3 Tier 3: Real-Time Local Retail Search Intelligence (`SEARCHAPI_API_KEY`)
- When Tier 2 yields no record, perform a localized retail search query:
  - Supports SearchApi Google Shopping:
    `https://www.searchapi.io/api/v1/search?engine=google_shopping&q=${query}&gl=${normCountry.toLowerCase()}&api_key=${apiKey}`
  - Also supports standard SerpApi endpoint fallback.
  - Parses `shopping_results`: extracts `extracted_price`, calculates `price_min`, `price_max`, median `price`, and captures the store `source` (e.g. "Alfamart", "Target", "Tesco").
  - Status: `'verified'`.

### 4.4 Tier 4: Category Econometric Benchmark Engine (100% Coverage Guarantee)
- Covers 30+ standardized food and grocery categories:
  - Beverages (soda, fruit juice, bottled water, coffee, tea)
  - Dairy (fresh milk, yogurt, cheese, butter)
  - Bakery & Grains (sliced bread, white rice, pasta, noodles)
  - Packaged Snacks (chips, biscuits, chocolate, nuts)
  - Condiments & Staples (cooking oil, soy sauce, sugar, salt)
  - Canned & Prepared Foods (canned tuna, beans, soup)
- Baseline reference prices established in international USD/IDR standards.
- Real-time adjustment formula:
  $$\text{Adjusted Price} = \text{Base Price} \times \left(\frac{\text{Country Food CPI}}{\text{Ref CPI}}\right) \times \text{Exchange Rate} \times \left(\frac{\text{Package Weight}}{\text{Standard Weight}}\right)$$
- Always formats in the user's localized currency (`IDR`, `USD`, `EUR`, `GBP`, `MYR`, `SAR`, `AED`, `JPY`, etc.).
- Returned with `status: 'estimated'` and `source: 'Regional Food Price Index (${retailerName})'`, with `needs_user_price: false`.

### 4.5 Tier 5: Persistence to `product_price_cache`
- Whenever a price is resolved via Tier 2, Tier 3, or Tier 4, execute an upsert into Supabase `product_price_cache` in the background:
  - `product_id`: `cleanBarcode`
  - `country`: `normCountry`
  - `currency`: `currency`
  - `price`: `numericPrice`
  - `retailer`: `retailerSource`
  - `source`: `sourceDescription`
  - `confidence`: `0.95` (verified) or `0.85` (estimated)
  - `retrieved_at`: ISO timestamp

### 4.6 Frontend Improvements (`components/ProductDetails.tsx`)
- In [`ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx#L1150-L1210):
  - Always render the resolved local price and price range in Section 4.
  - Replace the warning `"Price unavailable in local market"` with the authoritative price / price range badge.
  - Automatically initialize `manualPriceInput` with the resolved price so that any budget deduction event seamlessly uses the accurate local price without user intervention.
  - Keep the input field accessible as a gentle "Edit shelf price" option for users who want to adjust for specific store promos, rather than a blocking error.

---

## 5. Scope Boundaries & Protection of Existing Features
- **DO NOT TOUCH** camera stream initialization, flip camera, or barcode scanning frame in `app/_pages/Camera.tsx`.
- **DO NOT TOUCH** Open Food Facts nutrition normalizer (`NutritionNormalizer.ts`) or Atwater energy calculators.
- **DO NOT TOUCH** Boycott screening rules, BDS campaign registries, or corporate parent relationship mapping.
- **DO NOT TOUCH** Food coloring and additive detection algorithms.
- **DO NOT TOUCH** Medical safety, allergen gates, or daily calorie budget calculations.

---

## 6. Files to Modify
1. [`lib/products/BarcodeService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/products/BarcodeService.ts):
   - Enhance `RetailPriceProvider` with the 4-tier cascade (Open Prices API + SearchApi Google Shopping + Category Econometric CPI/FX benchmark + auto-caching to Supabase).
2. [`app/api/analyze-product-barcode/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-product-barcode/route.ts):
   - Ensure the resolved local price, range, and metadata are cleanly passed to the client with `needs_user_price: false`.
3. [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx):
   - Update Section 4 so the local price is displayed automatically and pre-filled for budget logging with zero manual friction.

---

## 7. Acceptance Criteria & Verification Plan
- **Verification 1**: Typecheck the repository (`npm run typecheck` or `npx tsc --noEmit`) to verify 100% type safety.
- **Verification 2**: Test barcode price resolution for:
  - An exact Indonesian item (e.g., `8992696404441` or any arbitrary Indonesian snack) in `ID` / `IDR`.
  - A US/Global item (e.g., `012000000133` Pepsi or `049000000443` Coca-Cola) in `US` / `USD`.
  - A European/UK item in `GB` / `GBP` or `DE` / `EUR`.
  - An obscure international item with no prior retail listing: verify it resolves a realistic category-adjusted price in the user's currency rather than returning `null`.
- **Verification 3**: Open DevTools and verify visual rendering in `http://localhost:3000/scanner`:
  - Scanned product immediately shows the local retail price and price range.
  - User is not blocked or forced to input the price.
  - Price is correctly passed to the budget deduction flow upon logging.
