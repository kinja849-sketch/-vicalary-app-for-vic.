# Implementation Plan: Revert Daily Budget Card Layout and Ensure Scanned Deductions Display in Recent Products

## 1. Problem Statement & User Rectification
1. **Remove Deducted Row from Top Card**:
   - The user specified: *"The deducted today should not appear over there at all. Revert it back how it was. Any deduction should appear where it states recent scanned products. It should be in that section. It should not be on the highlighted sale."*
   - Remove the 3-box subtraction row (`DAILY ALLOWANCE`, `- DEDUCTED TODAY`, `= NEW BALANCE`) from the top green gradient card.
   - Remove the label `"DAILY ALLOWANCE LEDGER"` and restore the clean title `"Daily Budget"`.
   - The main headline on the card must be the automatically updated remaining budget: `{formatBudgetCurrency(activeBudget.remainingToday)}`.
   - Beneath it, restore the clean 2-pill layout:
     - `Daily Allowance: {formatBudgetCurrency(activeBudget.recommendedDailySpend)}`
     - `Spent Today: {formatBudgetCurrency(activeBudget.spentToday)}`
   - Keep the Monthly Cycle Overview progress bar.

2. **Deductions Strictly Under Recent Scanned Products**:
   - The user specified: *"Any deduction should appear where it states recent scanned products. It should be in that section... Any deducted indicator should be shown. Any deducted item or product should be shown as soon as the product is scanned and budgeted. Once that's done, it is when under the section where it says 'No products scanned today', it should indicate the product name or product item and the price that the product costs."*
   - Under **Recent Scanned Products**:
     - When a product is scanned and budgeted, it must immediately appear here with:
       - Product name (e.g. `Ultra Milk Full Cream`)
       - Deduction price (e.g. `− Rp 21,000` with the deduction indicator `−` in accent color)
       - Time of scan (`Deducted today at ...`).
   - Audit and ensure that confirming a scan on `ProductDetails.tsx` (`handleConfirmLog`) writes to `financial_transactions` cleanly with error handling, ensuring `recentExpenses` is populated and `active-budget` cache is immediately invalidated and refetched.

---

## 2. Architecture & Data Flow

```
[ProductDetails Screen]
   User taps "Budget" (Confirm Log)
          │
          ▼
[saveFoodAnalysis (lib/api/food.ts)]
   Inserts into financial_transactions:
     - user_id
     - amount: confirmedPrice
     - merchant_name: analysis.name
     - transaction_date: ISO string
     - category: 'Food & Dining'
     - reconciliation_status: 'pending'
          │
          ▼
[Budget Page (app/_pages/Budget.tsx)]
   Query: getBudgetStatus -> BudgetEngine.calculateBudget
     - remainingToday = recommendedDailySpend - spentToday (Updates Hero Amount)
     - recentExpenses = items scanned today sorted newest first
          │
          ▼
   - Top Card: Clean "Daily Budget" hero ({remainingToday}) + Daily Allowance & Spent Today pills
   - Bottom Section: "Recent Scanned Products" lists the deducted product item & price
```

---

## 3. Detailed File Changes

### A. [app/_pages/Budget.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Budget.tsx)
1. **Revert Top Card**:
   - Change `"Daily Allowance Ledger"` to `"Daily Budget"`.
   - Remove the 3-box subtraction block (`DAILY ALLOWANCE`, `- DEDUCTED TODAY`, `= NEW BALANCE`).
   - Main hero number: `{formatBudgetCurrency(activeBudget.remainingToday)}` (updates automatically on deduction).
   - Restore clean 2-column grid:
     - Left pill: `Daily Allowance` (`{formatBudgetCurrency(activeBudget.recommendedDailySpend)}`)
     - Right pill: `Spent Today` (`{formatBudgetCurrency(activeBudget.spentToday)}`)
   - Preserve Monthly Cycle Overview.
2. **Recent Scanned Products Section**:
   - Render each item with product name, formatted deduction amount (`− {formatBudgetCurrency(expense.amount)}`), and time.

### B. [lib/api/food.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/food.ts)
- Add explicit error logging and validation on the `financial_transactions` insert in `saveFoodAnalysis` so if any issue occurs it is surfaced, and ensure timestamps align with today's cycle.

### C. [components/ProductDetails.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)
- Ensure query cache invalidation for `['active-budget']` also triggers an immediate refetch when navigating to `/budget`.

---

## 4. Acceptance Criteria
1. Top green card displays `"Daily Budget"`, has no stacked subtraction boxes, and shows the updated balance `{remainingToday}` prominently with `Daily Allowance` and `Spent Today` sub-pills.
2. Under `"Recent Scanned Products"`, scanned items immediately display the product name, the price deducted (`− Rp X,XXX`), and timestamp.
3. Zero TypeScript or runtime console errors.
