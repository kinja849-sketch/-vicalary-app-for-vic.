# Implementation Prompt: Budget Daily Allowance Synchronization with Onboarding Backend

## Goal
Synchronize the Budget feature between frontend and backend. Eliminate demo-like USD values (`$180,223.26` / `$5,406,697.80`) and ensure the Daily Allowance is computed directly from the authenticated user's `onboarding_responses` (`weekly_budget` / `budget`) and rendered in their authoritative local currency (`IDR` / `Rp`) as configured in `user_settings`.

## Root Cause Analysis
1. **Currency Resolution**: `app/api/budget/daily/route.ts` only looked at `clientIp` (which defaulted to `8.8.8.8` — US / USD / `$`) and completely ignored the user's `user_settings` (`currency: 'IDR'`, `country_code: 'ID'`).
2. **Onboarding Budget Multiplied and Mislabeled as USD**: The user's onboarding `weekly_budget` was `1,248,660` IDR. When treated as USD, it was multiplied by 4.33 to `$5,406,697.80` and divided by 30 days to `$180,223.26`, rendering as absurd demo/dummy numbers with a dollar sign.
3. **Daily Allowance Calculation**: A user's weekly grocery budget of `1,248,660` implies an authoritative daily allowance of `weekly_budget / 7 = 178,380` IDR (`Rp 178,380`), not an arbitrary cycle-day division.
4. **Database Constraint & Schema Mismatch**: `BudgetNormalizationService` attempted `.upsert(..., { onConflict: 'user_id' })` with columns (`is_normalized`, `original_amount`) that do not exist in `user_budget_profiles`, and `user_id` lacked a unique constraint. This failed silently with `PGRST204` / `42P10`, leaving `user_budget_profiles` unpersisted.
5. **Formatting**: `formatBudgetCurrency` in `Budget.tsx` was forced to format as USD with decimals (`.26`), instead of IDR zero-decimal formatting (`Rp 178,380`).

## Target Files
1. [`app/api/budget/daily/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/budget/daily/route.ts)
   - Read `user_settings` for `user.id` to retrieve authoritative user preference (`currency`, `country_code`).
   - Read request headers `x-user-currency` and `x-user-country` if passed from client.
   - Resolve authoritative `geo` with priority: `user_settings` > request headers > IP geolocation > default fallback.
   - Use `BudgetNormalizationService.getCurrencySymbol(currencyCode)` for exact symbol.
2. [`lib/financial/BudgetEngine.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/financial/BudgetEngine.ts)
   - Read `onboarding_responses` directly for `weekly_budget` and `budget`.
   - Calculate authoritative Daily Allowance from the onboarding response:
     - If `weekly_budget` is set: `dailyAllowance = Number(onboarding.weekly_budget) / 7`.
     - If `budget` (monthly) is set: `dailyAllowance = Number(onboarding.budget) / 30`.
     - Round to integer for zero-decimal currencies (`IDR`, `JPY`, etc.) or 2 decimal places for currencies with decimals (`USD`, `EUR`, etc.).
   - Calculate monthly budget from onboarding response:
     - If `weekly_budget` is set: `Math.round(Number(onboarding.weekly_budget) * 4.33)`.
     - If `budget` is set: `Number(onboarding.budget)`.
   - Set `recommendedDailySpend = dailyAllowance`.
   - Calculate `spentToday` and `recentExpenses` from `financial_transactions` for today.
   - Calculate `remainingToday = Math.max(0, dailyAllowance - spentToday)`.
   - Calculate `spentThisMonth` and `remainingBudget` and `percentUsed`.
   - Persist to `user_budget_profiles` safely: check if row exists for `user_id`, then update or insert using only valid schema columns.
   - Upsert snapshot to `daily_budget_status`.
   - Return clean summary with authoritative currency, symbol, daily allowance, spent today, remaining today, monthly overview, and diagnostics.
3. [`lib/financial/BudgetNormalizationService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/financial/BudgetNormalizationService.ts)
   - Update profile upsert logic to check-then-insert/update using only table columns that exist in Supabase PostgREST.
   - Avoid legacy USD conversion if the currency is already matched to user settings.
4. [`lib/api/budget.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/budget.ts)
   - Accept optional `clientCurrency` and `clientCountry` parameters in `getBudgetStatus`.
   - Forward `x-user-currency` and `x-user-country` in fetch headers to keep frontend and backend in lockstep.
5. [`app/_pages/Budget.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Budget.tsx)
   - Pass `currencyCode` and `countryCode` from `useCurrency()` to `getBudgetStatus`.
   - Ensure `formatBudgetCurrency` displays zero-decimal currencies cleanly with proper spacing (e.g. `Rp 178,380` or `Rp 0`) and never displays fractional cents.
   - Keep UI layout, cards, and colors exactly intact.

## Acceptance Criteria
- [ ] Daily Allowance displays `Rp 178,380` (computed from onboarding `weekly_budget: 1248660 / 7`).
- [ ] No `$` dollar sign is shown for IDR users; currency symbol is `Rp`.
- [ ] Zero decimals shown for IDR amounts (`Rp 178,380`, `Rp 0`, `Rp 5,406,698`).
- [ ] `user_budget_profiles` and `daily_budget_status` persist accurately in Supabase without PostgREST errors.
- [ ] Frontend and backend communicate cleanly without mock/demo fallbacks.
- [ ] UI remains visually identical in design, typography, cards, and structure.
