# Implementation Blueprint: Dynamic IP Country Budget Synchronization & Precision Calculation Engine

## Executive Overview
When a user changes their IP address (e.g. via VPN, international travel, or network handover) and the IP reflects a different country, the budget currently fails to reflect the new country and does not accurately calculate the user's budget plan in the new local currency. 

This document identifies the four distinct root causes across the client geolocation cache, backend currency resolution precedence, currency cross-conversion mathematical engine, and transaction ledger conversion, and provides the complete architectural plan to comprehensively fix this behavior without modifying or degrading any other application functionality or UI surfaces.

---

## 1. Deep Root Cause Analysis

### Root Cause 1: 24-Hour Blind Geolocation Cache in `lib/api/location.ts`
- **Location**: [`lib/api/location.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/location.ts#L108-L122)
- **Defect**: `detectLocation()` reads `localStorage.getItem('vicalary_location_v4')`. If present and younger than 24 hours (`Date.now() - timestamp < 24 * 60 * 60 * 1000`), it immediately returns `{ ...data, method: 'CACHE' }` without checking if the user's network or public IP has changed.
- **Impact**: When the user switches on a VPN or connects through a different country, the client remains locked to yesterday's country, currency, and locale for up to 24 hours.

### Root Cause 2: Stale `user_settings.currency` Precedence in `app/api/budget/daily/route.ts`
- **Location**: [`app/api/budget/daily/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/budget/daily/route.ts#L25-L52)
- **Defect**: The route prioritized `user_settings.currency` over `x-user-currency` and `x-user-country` request headers:
  ```ts
  if (userSettings?.currency) {
      const curr = userSettings.currency;
      const country = userSettings.country_code || clientHeaderCountry || 'US';
      geo = { ... };
  } else if (clientHeaderCurrency) { ... }
  ```
- **Impact**: Every user account in Supabase has `user_settings.currency` populated at registration or onboarding. Because `userSettings?.currency` is always truthy, the server discarded the client's live detected IP country and currency headers (`x-user-currency`, `x-user-country`) and discarded the server-side edge IP geolocation, freezing the budget to the historical country.

### Root Cause 3: Incomplete One-Way "Legacy USD" Conversion in `BudgetNormalizationService`
- **Location**: [`lib/financial/BudgetNormalizationService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/financial/BudgetNormalizationService.ts#L69-L98) and [`lib/financial/BudgetNormalizationService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/financial/BudgetNormalizationService.ts#L258-L280)
- **Defect**: The normalization service only supported converting small legacy USD amounts to non-USD currencies (`isLegacyUsdBudget`).
  - If `targetCurrencyCode === 'USD'`, `isLegacyUsdBudget` explicitly returned `false`.
  - If `rawMonthly > 2500` (e.g. IDR 1,248,660, JPY 50,000, KRW 200,000), `isLegacyUsdBudget` returned `false`.
  - In all other cases, it bypassed conversion entirely and simply reassigned the target currency symbol to the unconverted number (`result.monthlyBudget = rawMonthly; result.currency = geo.currencyCode;`).
- **Impact**:
  - An Indonesian user with a weekly budget of `1,248,660 IDR` switching IP to the United States was displayed a monthly budget of **$1,248,660 USD** and a daily allowance of **$41,622 USD**!
  - Switching to Japan displayed **¥1,248,660 JPY**.
  - Switching to the UK displayed **£1,248,660 GBP**.
  - A user with a USD budget moving to a non-USD country did not convert if their profile had already been touched.

### Root Cause 4: Multi-Currency Ledger Mismatch in `BudgetEngine.ts`
- **Location**: [`lib/financial/BudgetEngine.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/financial/BudgetEngine.ts#L120-L134)
- **Defect**: The engine queried `financial_transactions` and naively summed `tx.amount` without converting each transaction's currency to the active display currency.
- **Impact**: If a user recorded a 25,000 IDR snack purchase in Indonesia and then connected to a US IP address, the engine added 25,000 directly into USD spent today, showing they spent $25,000 today.

---

## 2. Target Architecture & Mathematical Precision Model

### Source of Truth Hierarchy
1. **User's Canonical Budget Plan**:
   - `onboarding_responses.weekly_budget` (or `onboarding_responses.budget`) stores the baseline numeric value chosen by the user during onboarding.
   - `user_budget_profiles.currency` (or `user_settings.currency` at registration) establishes the **source currency** in which the budget plan was originally created.
2. **Current IP & Country Context**:
   - Client detects public IP via `geojs.io` (fast, unthrottled, live public IP check).
   - If the detected IP differs from the cached IP, or if cache is stale, cache is immediately updated.
   - Client sends live `x-user-currency` and `x-user-country` to the backend.
   - Backend respects `x-user-currency` and `x-user-country` as authoritative for the current request.
3. **Universal Cross-Currency Conversion Engine**:
   - Supports arbitrary source currency $C_{source}$ to arbitrary target currency $C_{target}$.
   - Live exchange rates fetched via `https://open.er-api.com/v6/latest/USD` with 1-hour in-memory cache and a robust comprehensive offline fallback rates table.
   - Cross-rate formula:
     $$\text{Rate}(C_{source} \to C_{target}) = \frac{\text{Rate}_{USD}(C_{target})}{\text{Rate}_{USD}(C_{source})}$$
   - When $C_{source} = C_{target}$, $\text{Rate} = 1.0$ (zero precision loss, zero floating-point artifacts).
   - Monthly and Weekly Budget calculation:
     $$\text{WeeklyBudget}_{target} = \text{WeeklyBudget}_{source} \times \text{Rate}$$
     $$\text{MonthlyBudget}_{target} = \text{WeeklyBudget}_{target} \times 4.33$$
     $$\text{DailyAllowance}_{target} = \frac{\text{WeeklyBudget}_{target}}{7}$$
4. **Zero-Decimal vs Two-Decimal Financial Rounding**:
   - Currencies without minor units (`IDR`, `JPY`, `KRW`, `VND`, `CLP`, `HUF`): `Math.round(value)` (e.g. `Rp 178,380`, `¥1,250`).
   - Standard currencies (`USD`, `EUR`, `GBP`, `SGD`, `CAD`, `AUD`, etc.): `Math.round(value * 100) / 100` (e.g. `$11.43`, `£9.03`).
5. **Transaction Ledger Normalization**:
   - For every transaction in `financial_transactions`:
     - If `tx.currency === targetCurrency`: `amountInTarget = tx.amount`.
     - If `tx.currency !== targetCurrency`: `amountInTarget = tx.amount * Rate(tx.currency -> targetCurrency)`.
   - `spentToday = \sum \text{amountInTarget}_{today}`.
   - `spentThisMonth = \sum \text{amountInTarget}_{month}`.
   - `remainingToday = \max(0, \text{dailyAllowance} - \text{spentToday})`.
   - `remainingBudget = \max(0, \text{monthlyBudget} - \text{spentThisMonth})`.

---

## 3. Detailed File Modification Plan

### File 1: [`lib/api/location.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/location.ts)
- **Objective**: Ensure client dynamically notices when IP address or country changes, while maintaining fast load times and offline resiliency.
- **Changes**:
  1. Store the detected `ip` alongside the timestamp in `vicalary_location_v4`.
  2. Implement an active network probe with a short timeout (~2.5s) to `geojs.io`.
  3. If the network call returns a new IP or country different from cached data, immediately refresh cache and return the new location.
  4. If network fails or user is offline, gracefully fall back to the cached location.
  5. Add an export `checkIfIpChanged()` or expose `forceRefresh` support for window focus/visibility events.

### File 2: [`lib/CurrencyContext.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/CurrencyContext.tsx)
- **Objective**: Listen for window focus/visibility change and re-verify IP location so VPN toggling or network switching updates currency instantly without requiring a full browser restart.
- **Changes**:
  1. Keep existing manual override check (`localStorage.getItem('currency_override')`).
  2. When no manual override exists, check location on mount and on `window.addEventListener('focus', ...)` (debounced).
  3. When country or currency changes, update `countryCode`, `currencyCode`, `currencySymbol`, and `exchangeRate`.

### File 3: [`app/api/budget/daily/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/budget/daily/route.ts)
- **Objective**: Fix geo resolution priority so client-detected IP headers (`x-user-currency`, `x-user-country`) take precedence over stale database columns.
- **Changes**:
  1. Read headers: `clientHeaderCurrency = request.headers.get('x-user-currency')`, `clientHeaderCountry = request.headers.get('x-user-country')`.
  2. Priority order:
     - Priority 1: `clientHeaderCurrency` & `clientHeaderCountry` (reflects live client IP detection or explicit client manual override).
     - Priority 2: Live server request IP geolocation (if running behind CDN/proxy with real IP).
     - Priority 3: `user_settings` saved preferences (fallback).
     - Priority 4: Default fallback (`US`, `USD`, `$`).
  3. Pass the resolved `geo` to `BudgetEngine.calculateBudgetStatus(user.id, geo)`.

### File 4: [`lib/financial/BudgetNormalizationService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/financial/BudgetNormalizationService.ts)
- **Objective**: Implement the universal cross-currency conversion engine.
- **Changes**:
  1. Add `fetchCrossExchangeRate(sourceCurrency: string, targetCurrency: string)`.
     - Queries `https://open.er-api.com/v6/latest/USD`.
     - Calculates cross-rate: $\text{Rate}_{target} / \text{Rate}_{source}$.
     - Fallback to embedded static exchange rate table for resilience.
  2. In `createOrNormalizeBudgetProfile(userId: string, geo: GeoContext)`:
     - Identify `sourceCurrency`: inspect `existingProfile?.currency`, then `user_settings?.currency`, default to `'USD'`.
     - Identify `sourceWeeklyBudget`: from `onboarding.weekly_budget` (or `onboarding.budget / 4.33` or `existingProfile.monthly_budget / 4.33`).
     - If `sourceCurrency !== geo.currencyCode`:
       - Fetch cross-rate $R$.
       - Convert: `weeklyBudget = sourceWeeklyBudget * R`.
       - Calculate: `monthlyBudget = weeklyBudget * 4.33`, `dailyAllowance = weeklyBudget / 7`.
       - Format according to target currency zero-decimal rules.
       - Return `wasConverted: true`, `originalAmount: sourceWeeklyBudget`, `originalCurrency: sourceCurrency`, `exchangeRate: R`.
     - If `sourceCurrency === geo.currencyCode`:
       - Calculate directly: `weeklyBudget = sourceWeeklyBudget`, `monthlyBudget = weeklyBudget * 4.33`, `dailyAllowance = weeklyBudget / 7`.
       - Return `wasConverted: false`.
  3. Ensure the original base currency and profile are not corrupted.

### File 5: [`lib/financial/BudgetEngine.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/financial/BudgetEngine.ts)
- **Objective**: Normalize financial transaction amounts when computing `spentToday` and `spentThisMonth`.
- **Changes**:
  1. In section 4 (Calculate monthly and daily expenditure), inspect each transaction's `tx.currency`.
  2. If `tx.currency` differs from `currency` (target currency), convert `amt` using the cross-exchange rate before adding to `spentThisMonth` and `spentToday`.
  3. Compute `remainingToday = Math.max(0, recommendedDailySpend - spentToday)`.
  4. Compute `remainingBudget = Math.max(0, monthlyBudget - spentThisMonth)`.
  5. Compute `percentUsed = monthlyBudget > 0 ? (spentThisMonth / monthlyBudget) * 100 : 0`.
  6. Return the accurately calculated `BudgetSummary`.

### File 6: [`app/_pages/Budget.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Budget.tsx)
- **Objective**: Ensure visual presentation is 100% faithful to the design, zero UI changes, and cleanly formats amounts in any target currency.
- **Changes**:
  - Keep all existing JSX, Tailwind classes, cards, headers, icons, and layout 100% identical.
  - Verification of `formatBudgetCurrency` to confirm smooth rendering of any currency symbol and zero-decimal currencies.

---

## 4. Verification & Testing Protocol

1. **Pre-flight & Compilation Check**:
   - Run Next.js typecheck (`npx tsc --noEmit` / `npm run build` or dev server check).
2. **Localhost Real-time Verification**:
   - Dev server monitored via background task.
   - Verification via Chrome DevTools (`chrome-devtools-mcp`) at `http://localhost:3000/budget`.
3. **Multi-Country IP & Currency Simulation Matrix**:
   - **Simulation A (Indonesia - IDR)**:
     - Onboarding weekly budget: `1,248,660 IDR`.
     - Expected: Currency `IDR`, Symbol `Rp`, Daily Allowance `Rp 178,380`, Monthly Budget `Rp 5,406,698`. No decimals, no `$`.
   - **Simulation B (United States - USD via VPN/IP change)**:
     - Onboarding weekly budget: `1,248,660 IDR`.
     - Rate: ~0.0000641 USD/IDR.
     - Expected: Currency `USD`, Symbol `$`, Weekly Budget `~$80.00`, Daily Allowance `~$11.43`, Monthly Budget `~$346.57`. Exactly reflects the user's plan converted to USD! Zero `$1,248,660` absurd values.
   - **Simulation C (United Kingdom - GBP via VPN/IP change)**:
     - Expected: Currency `GBP`, Symbol `£`, Daily Allowance `~£9.03`, Monthly Budget `~£273.79`.
   - **Simulation D (Japan - JPY via VPN/IP change)**:
     - Expected: Currency `JPY`, Symbol `¥`, Daily Allowance `~¥1,772`, Monthly Budget `~¥53,718`. No decimals.
   - **Simulation E (Reverse: USD Onboarding to IDR via IP change)**:
     - Onboarding weekly budget: `$100 USD`.
     - Expected in IDR: Currency `IDR`, Symbol `Rp`, Weekly Budget `Rp 1,560,000`, Daily Allowance `Rp 222,857`, Monthly Budget `Rp 6,754,800`.
4. **Transaction Conversion Verification**:
   - Verify that an IDR transaction (e.g. 21,000 IDR) is converted to ~$1.35 when viewed in USD, rather than adding $21,000.
5. **No Regressions**:
   - Zero modifications to colors, fonts, layouts, navigation, or unrelated modules.
   - Clean console logs with zero unhandled exceptions or 401s.

---

## 5. Explicit Approval Gate
This blueprint guarantees complete mathematical accuracy and instant reflection of the new country when an IP address changes, while preserving 100% of the existing UI and codebase integrity.
