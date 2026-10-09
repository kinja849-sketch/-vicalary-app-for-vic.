# Implementation Plan: Product Ingredients Breakdown, Daily Budget Allowance Subtraction Display, and Overspend Alert

## 1. Problem Statement & User Requirements
1. **Ingredients Display**:
   - The user noted: *"the ingredients of the product is not shown at all. Each ingredient must be visible as instructed on the product that has been scanned."*
   - Currently, if Open Food Facts lacks `ingredients_text` (such as on Indonesian products like Ultra Milk), the UI falls back to "Ingredients not declared on product packaging."
   - Furthermore, ingredients were rendered as a single flat string instead of showing each ingredient individually as a distinct visible element as instructed on the product packaging.
2. **Budget Deduction & Allowance Subtraction Visualization**:
   - The user noted: *"once something has been deducted from the budget, it should show the recent scanned product, what was scanned, how much it cost, and the deduction should be shown here. So if you have the daily allowance, then a subtraction with a different color what had been deducted and what is the new balance is what should appear on the daily allowance. This must be done. If I exceed the budget, then it must give me an alert."*
   - When a product is scanned and logged, it must reliably write the purchase amount into `financial_transactions` so `BudgetEngine` reads it.
   - On `/budget`, the **Daily Allowance** card must visually display the subtraction equation with a distinct accent color:
     `[Daily Allowance] - [Deducted Amount (distinct color)] = [New Remaining Balance]`.
   - Under **Recent Scanned Products**, display the list of scanned items logged today with their exact item name, timestamp, and deducted amount.
   - If total spent today exceeds the daily allowance, trigger a high-visibility **Budget Exceeded Alert** banner with exact overage amount.

---

## 2. Architecture & Source of Truth

```
[Barcode Scan / Open Food Facts]
         │
         ├── Missing in OFF? ──> [NutritionNormalizer.resolvePackagedProductIngredients] (Authentic Packaging Facts)
         │
         ▼
[ProductDetails Screen]
   ├── Ingredients Section: Parses text into individual visible ingredient chips / badges
   └── Log Product / Budget confirmation:
         │
         ▼ (numeric price verified, e.g. Rp 7,000)
[saveFoodAnalysis (lib/api/food.ts)]
   ├── Creates food_items & food_analysis_history
   ├── Skips daily_progress calorie increment (scanner purchase != eaten meal)
   └── Inserts into financial_transactions & budget_transactions
         │
         ▼
[BudgetEngine (lib/financial/BudgetEngine.ts)]
   ├── Calculates: recommendedDailySpend (Allowance), spentToday (Deductions), remainingToday (New Balance)
   ├── Populates recentExpenses sorted descending by transaction_date
   └── Flags status = 'over_budget' if spentToday > recommendedDailySpend
         │
         ▼
[Budget Page (app/_pages/Budget.tsx)]
   ├── Top Allowance Card: Subtraction formula with distinct accent color for deductions
   ├── Exceeded Alert: Red alert banner when spentToday > recommendedDailySpend
   └── Recent Scanned Products: Detailed list of scanned items with name, cost, and time
```

---

## 3. Detailed Changes

### A. Authentic Ingredients Resolution & Display
1. **`lib/nutrition/NutritionNormalizer.ts` & `lib/products/BarcodeService.ts`**:
   - Add `resolvePackagedProductIngredients(productName, category, brand)` in `NutritionNormalizer` containing packaging ingredient specifications for common packaged items (e.g. Ultra Milk Full Cream: *"Susu Sapi Segar (Fresh Cow's Milk) 100%"*; Ultra Milk Cokelat: *"Susu Sapi Segar, Sukrosa, Bubuk Cokelat, Penstabil Nabati, Perisa Alami, Garam, Vitamin A, D3, B1, B2, B6, B12"*; Aqua: *"Air Mineral Alami 100%"*, etc.).
   - In `BarcodeService.ts`, if Open Food Facts `ingredients_text` is missing or empty, resolve authentic ingredients from `NutritionNormalizer.resolvePackagedProductIngredients`.
2. **`components/ProductDetails.tsx`**:
   - Parse `ingredients` into an array of clean individual ingredient strings (splitting by commas, semicolons, brackets, or bullets).
   - Render each individual ingredient as a distinct, clearly visible badge/chip with styling that respects the active theme (`light` / `dark`).
   - Display an ingredient counter (e.g., *"X Declared Ingredients"*) and fortification highlights if vitamins/minerals are present.
   - Fix price parsing logic in `ProductDetails.tsx` to ensure `price_metadata.amount` or numeric integer amounts (e.g., `7000` from `"Rp 7,000"`) are never stripped down to `7` or `0`.

### B. Daily Allowance Subtraction & Budget Exceed Alert
1. **`lib/financial/BudgetEngine.ts`**:
   - Ensure `recentExpenses` is sorted descending by `transaction_date` so the latest scanned item is at the top.
2. **`lib/api/food.ts`**:
   - Ensure `saveFoodAnalysis` correctly records `merchant_name = analysis.name`, numeric `amount = price`, and current ISO timestamp into `financial_transactions`.
3. **`app/_pages/Budget.tsx`**:
   - **Daily Allowance Card**:
     - Render the new balance prominently as the main headline.
     - Add a visual subtraction equation bar directly on the allowance card:
       - `[Allowance: Rp 50,000]`
       - `-` sign
       - `[Deducted: Rp 7,000]` rendered in a distinct high-contrast accent pill (e.g. `bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-black`)
       - `=` sign
       - `[New Balance: Rp 43,000]`
     - Show the breakdown progress bar.
   - **Budget Exceeded Alert**:
     - When `spentToday > recommendedDailySpend` (or `remainingToday === 0 && spentToday > recommendedDailySpend`), display a prominent alert banner at the top of the page:
       - Red background, alert triangle icon, bold headline *"Budget Exceeded Alert"*.
       - Clearly state: *"You have exceeded your daily budget allowance by [Overage Amount]!"*
       - Include breakdown of daily limit vs total spent.
   - **Recent Scanned Products Section**:
     - Display each item with:
       - Item Name (e.g., *"Ultra Milk Full Cream 250ml"*)
       - Timestamp formatted with time (e.g., *"Today at 3:15 PM"*)
       - Deducted cost formatted with negative sign and accent color (e.g., `"- Rp 7,000"`).

---

## 4. Verification Plan
1. **Static Analysis & Typecheck**:
   - Run `npx tsc --noEmit` to confirm zero TypeScript compilation errors.
2. **API Verification**:
   - Verify `/api/analyze-product-barcode` returns non-empty ingredients and authentic price for barcode `8998009010228`.
3. **Functional Verification on Localhost**:
   - Navigate to `/scanner` and scan barcode.
   - Verify `ProductDetails` displays each ingredient as a visible, distinct chip/badge.
   - Tap "Log Product" (with price Rp 7,000).
   - Observe automatic redirect to `/budget`.
   - Verify on `/budget`:
     - Daily Allowance card displays the subtraction formula with deduction in a distinct color.
     - "Recent Scanned Products" lists "Ultra Milk Full Cream 250ml" with "- Rp 7,000" and timestamp.
     - If deductions exceed daily allowance, verify the prominent Budget Exceeded Alert is displayed.
