# Implementation Blueprint: Decouple Scanned Budgeted Products from Today's Progress Card

## 1. Executive Summary & Objective
When a user scans a barcode product and taps the **"Budget"** button, the intent is strictly a financial expenditure action (deducting the item's purchase price from their daily/monthly food budget ledger). The scanned product is **not** an eaten meal and must **never** be logged into daily nutritional progress or displayed on the **Today's Progress Card** (which tracks calories eaten, macros, and meals logged).

Currently, budgeting a scanned product incorrectly causes the product's calories and macros to count towards the user's daily consumed intake on the Today's Progress Card. This blueprint specifies the precise root causes, architecture, changes, and verification plan to ensure scanned budgeted items only affect the budget ledger while completely bypassing the daily calorie progress card.

---

## 2. Root Cause Analysis

### How the Bug Occurs:
1. **Budget Action in Product Details**:
   - In [`components/ProductDetails.tsx`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx#L329-L377), when the user taps `t('budget')`, `handleConfirmLog` constructs `analysisToSave` with `is_scanner_product: true` and calls `saveFoodAnalysis(user.id, analysisToSave, true)`.
2. **Missing Metadata in Food Analysis History**:
   - In [`lib/api/food.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts#L312-L353), `saveFoodAnalysis` correctly skips `updateDailyProgress` when `analysis.is_scanner_product` is true.
   - However, `saveFoodAnalysis` unconditionally inserts the item into the `food_analysis_history` table with:
     - `calories_consumed = Number(analysis.calories || 0)` (instead of 0)
     - `analysis_type = null` (instead of `'scanner_product'`)
     - `analysis_data` omitting `is_scanner_product: true`.
3. **Invalidation of Daily Progress**:
   - In [`components/ProductDetails.tsx`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx#L370-L371), `handleConfirmLog` calls `queryClient.invalidateQueries({ queryKey: ['daily-progress'] })` and `['progress']`, even though budgeting is purely a financial action.
4. **Self-Healing Reconciliation Overwrite**:
   - When `['daily-progress']` is invalidated or when Dashboard loads, [`lib/api/progress.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/progress.ts#L58-L105) executes `getDailyProgress(userId, date)`.
   - `getDailyProgress` runs an automatic "self-healing" check that queries all rows in `food_analysis_history` for today:
     ```typescript
     const { data: meals } = await supabase
       .from('food_analysis_history')
       .select('calories, calories_consumed, protein, carbs, fat, local_date, created_at')
       .eq('user_id', userId)
       .or(`local_date.eq.${date},and(created_at.gte.${date}T00:00:00.000Z,created_at.lte.${date}T23:59:59.999Z)`);
     ```
   - Because `food_analysis_history` contained the newly saved scanned product with `calories = 120` and `calories_consumed = 120`, `getDailyProgress` treated it as an eaten meal, summed it into `totalCal`, and immediately executed an `upsert`/`update` on `daily_progress` setting `calories_consumed = 120` and `meals_logged = 1`.
5. **Dashboard Rendering**:
   - [`components/ProgressCard.tsx`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProgressCard.tsx#L18-L23) reads `dailyProgress.calories_consumed` and renders 120 kcal as eaten on the circular progress wheel and in the "Eaten" stat card.

---

## 3. Scope Boundaries & Zero-Distortion Rule
- **Strictly In Scope**:
  - Distinguishing scanned/budgeted products from consumed meals in `food_analysis_history`.
  - Preventing scanned budgeted products from ever contributing calories, macros, or meal counts to `daily_progress` or the Today's Progress Card.
  - Updating the reconciliation routines in `lib/api/progress.ts` and `lib/api/food.ts` so they strictly ignore scanner/budget records.
  - Removing spurious progress query invalidations from `ProductDetails.tsx`.
  - Cleaning up the corrupted today's progress entry for the active user in Supabase so the Progress Card immediately reflects true logged meals (0 kcal consumed).
- **Strictly Out of Scope**:
  - No changes to visual styling, Tailwind classes, or layout of `ProgressCard`, `ProductDetails`, or `Dashboard`.
  - No changes to financial transaction persistence or budget deduction mechanics (`/api/expenses`, `financial_transactions`, `budget_transactions`).
  - No changes to camera meal logging (e.g. photographing a meal and clicking "Log to Food Diary" must continue to update progress accurately).

---

## 4. Architecture & Technical Design

### A. Data Flow Separation
```
Barcode Scan → ProductDetails Modal
     │
     └── User Taps "Budget" (handleConfirmLog)
            │
            ├── 1. Financial Recording:
            │      POST /api/expenses → writes to financial_transactions & budget_transactions
            │      Invalidates: ['active-budget'], ['budget'], ['financial-transactions']
            │
            ├── 2. Catalog/Analysis Persistence (saveFoodAnalysis):
            │      Writes to food_items
            │      Writes to food_analysis_history with:
            │         - analysis_type: 'scanner_product'
            │         - calories_consumed: 0
            │         - analysis_data: { ...data, is_scanner_product: true }
            │         - is_logged: false
            │
            └── 3. Daily Progress / Today's Progress Card:
                   - Completely BYPASSED.
                   - Progress queries NOT invalidated.
                   - getDailyProgress / updateDailyProgress reconciliation filters out scanner products.
```

### B. Files and Services Involved
1. [`lib/api/food.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts):
   - In `saveFoodAnalysis`: Check `analysis.is_scanner_product`. If true, set `calories_consumed: 0`, `analysis_type: 'scanner_product'`, `analysis_data.is_scanner_product: true`, and `is_logged: false`.
   - In `updateDailyProgress`: When querying `todayMeals` from `food_analysis_history`, filter out rows where `analysis_type === 'scanner_product'` or `analysis_data->>'is_scanner_product' = 'true'`.
2. [`lib/api/progress.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/progress.ts):
   - In `getDailyProgress`: In the self-healing reconciliation check, select `analysis_type` and `analysis_data`. Filter out scanner products (`analysis_type === 'scanner_product'` or `analysis_data?.is_scanner_product === true`). Only count genuine consumed meals.
   - In `logMeal`: Similarly filter out scanner products in the non-fatal meal history check so scanner products never act as an artificial floor for calorie accumulation.
3. [`components/ProductDetails.tsx`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx):
   - Remove `queryClient.invalidateQueries({ queryKey: ['daily-progress'] })` and `['progress']` from `handleConfirmLog`.
4. [`lib/api/daily-summary-service.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/daily-summary-service.ts):
   - In `mealHistory` query, exclude scanner products so the evening coach summary doesn't recount budgeted groceries as eaten meals.
5. **Database Rectification**:
   - Patch existing scanned product record `5bef03e3-6446-444b-b02c-01d44b1a4bb0` in `food_analysis_history` to `analysis_type = 'scanner_product'`, `calories_consumed = 0`, and `analysis_data->'is_scanner_product' = true`.
   - Reset today's `daily_progress` record for user `cb29ca08-585f-403a-8e32-9d8669760931` (`calories_consumed = 0`, `meals_logged = 0`, `protein_consumed = 0`, `carbs_consumed = 0`, `fat_consumed = 0`).

---

## 5. Acceptance Criteria
1. When a user scans any barcode product and clicks **"Budget"**:
   - The item's price is deducted from their budget ledger.
   - Financial transactions are recorded.
   - **Today's Progress Card remains completely untouched** (calories consumed stays 0 if no meals were eaten, or retains only the calories of actual logged meals).
2. When a user logs a meal (via Camera photo or Meal Deck "Log Meal"):
   - Today's Progress Card updates calories, macros, and meal count as expected.
3. Navigating between Scanner, Budget, and Dashboard does not trigger any self-healing overwrite from budgeted products.
4. Existing historical data for today is cleaned up so the user's Today's Progress Card immediately reflects accurate intake.
5. All TypeScript type checks pass with 0 errors.

---

## 6. Verification Steps
1. Run `npx tsc --noEmit` to verify type safety.
2. Query Supabase database to confirm today's `daily_progress` and `food_analysis_history` are clean.
3. Launch dev server on `http://localhost:3000` and use `chrome-devtools-mcp` to inspect:
   - Dashboard Today's Progress Card displays `0` calories eaten (or exact calories of actual logged meals).
   - Scanning a barcode product and tapping "Budget" redirects to `/budget`, records the expense, and returning to Dashboard shows Today's Progress Card remains at `0` calories eaten.
