# Implementation Prompt: Budget Zero Amount Calculation Rectification & Reload Navigation Lag Fix

## 1. Executive Summary
- **Primary Objectives**:
  1. **Fix Zero Budget / `RM0.05` Calculation Bug**: When the user switches locations (e.g. to Malaysia, South Korea, etc.), ensure the daily allowance and monthly cycle total are computed with 100% mathematical accuracy from the user's authoritative onboarding budget plan (e.g. converting a $49 USD/wk plan into ~RM31.29/day and ~RM948.40/mo in Malaysia `MYR`, or ~₩9,660/day and ~₩292,795/mo in South Korea `KRW`), completely eliminating the defect where low numerical budgets are misattributed to high-rate currencies resulting in `RM0` / `Total: RM0.05`.
  2. **Fix Page Reload Redirection & Lag**: Prevent page reloads on `/budget` from prematurely treating the user as unauthenticated and navigating them through `/auth` -> `/dashboard` with a jarring "welcome back" toast. Ensure auth session initialization is atomic and smooth, eliminating lag and state flicker.
  3. **Preserve UI & Design Integrity**: Keep all cards, gradients, typography, spacings, badges, and layout structures in `app/_pages/Budget.tsx` exactly as designed.

---

## 2. Root Cause Analysis

### A. Root Cause of `RM0` / `Total: RM0.05`
1. **The Inversion of Source Currency and Base Amount**:
   - In `onboarding_responses`, the user has `weekly_budget = 49` (selected on the standard USD slider scale: $20 to $500/week).
   - In `user_budget_profiles`, a legacy conversion or previous session had written `monthly_budget = 895632.00` with `currency = 'IDR'`.
   - In `lib/financial/BudgetNormalizationService.ts`, lines 213-230:
     - `rawWeeklyBudget` was extracted from `onboarding_responses.weekly_budget` (`49`).
     - But `sourceCurrency` was resolved as `existingProfile?.currency` (`'IDR'`).
   - Consequently, the system treated `rawWeeklyBudget` as **49 Indonesian Rupiah** (literally $0.003 USD).
   - When converted to Malaysian Ringgit (`MYR`):
     - `49 IDR * (4.47 / 15,650) = 0.014 MYR/week`
     - Daily allowance: `0.014 / 7 = 0.002 MYR` -> rounds to `RM0`.
     - Monthly total: `212.17 IDR * (4.47 / 15,650) = 0.05 MYR` -> renders as `Total: RM0.05`.
   - The user sees `DAILY BUDGET RM0`, `DAILY ALLOWANCE RM0`, and `Total: RM0.05`.

### B. Root Cause of Reload Redirection to Dashboard / "Welcome Back"
1. **Premature `loading: false` in `AuthContext.tsx`**:
   - In `lib/AuthContext.tsx`, `loading` starts as `true`.
   - On initial client render, `user` is initially `null` while `supabase.auth.getSession()` is asynchronous.
   - The profile `useEffect` ran immediately on mount:
     ```ts
     useEffect(() => {
       if (!user) {
         setProfile(null);
         setLoading(false); // <--- PREMATURE!
         return;
       }
     ```
   - This flipped `loading` to `false` before `getSession()` completed!
2. **Instant Redirect to `/auth` in `Budget.tsx`**:
   - `Budget.tsx` saw `!authLoading && !user` and immediately called `router.push('/auth')`.
3. **Automatic Redirect to `/dashboard` with Welcome Message in `Auth.tsx`**:
   - Once `/auth` loaded, `supabase.auth.getSession()` resolved the authenticated user.
   - `Auth.tsx` ran `syncAndNavigate()`, saw `profile.onboarding_completed === true`, triggered `toast.success("Welcome back [Name]!")`, and navigated to `/dashboard`.
   - Result: reloading `/budget` kicked the user out to `/dashboard` with a "welcome back" toast.

---

## 3. Detailed Architecture & Implementation Plan

### A. Centralized Source Currency & Base Budget Disambiguation (`BudgetNormalizationService.ts`)
1. **Deterministic Currency Scale Rules**:
   - If `onboarding.weekly_budget` is between `1` and `1000`:
     - Low-unit currencies (`IDR`, `VND`, `KRW`, `JPY`, `KES`, `CLP`, `HUF`) do not have grocery budgets under 1,000. (49 IDR is 0.3 cents, 49 KRW is 3.5 cents).
     - Any budget <= 1000 entered on the onboarding slider was entered on the base `USD` scale ($20-$500).
     - Authoritative source: `sourceCurrency = 'USD'`.
     - `rawWeeklyBudget = Number(onboarding.weekly_budget)`.
     - `rawMonthlyBudget = rawWeeklyBudget * 4.33`.
   - If `onboarding.weekly_budget > 1000`:
     - The user entered their budget in a high-denomination currency (e.g. `1,248,660 IDR`, `5,200 KES`, `65,000 KRW`).
     - Authoritative source: `sourceCurrency = (userSettings?.currency || existingProfile?.currency || 'IDR').toUpperCase()`.
     - `rawWeeklyBudget = Number(onboarding.weekly_budget)`.
     - `rawMonthlyBudget = rawWeeklyBudget * 4.33`.
   - If `onboarding.weekly_budget` is null, but `existingProfile.monthly_budget` exists:
     - Use `existingProfile.monthly_budget` with `existingProfile.currency`.
     - `rawMonthlyBudget = Number(existingProfile.monthly_budget)`.
     - `rawWeeklyBudget = rawMonthlyBudget / 4.33`.
2. **Cross-Currency Conversion Engine**:
   - Fetch live rates from `open.er-api.com` with cached fallback matrix.
   - Convert `rawWeeklyBudget` and `rawMonthlyBudget` from `sourceCurrency` into `targetCurrency` (e.g. `MYR`, `KRW`, `IDR`, `JPY`, `EUR`, `USD`).
   - Round zero-decimal currencies (`KRW`, `JPY`, `IDR`, `VND`) to whole integers, and standard currencies (`MYR`, `USD`, `EUR`) to 2 decimal places.

### B. Atomic Auth State Restoration (`AuthContext.tsx`)
1. **Track Initial Session Check Completion**:
   - Add `initialSessionChecked` ref / state so `loading` is NEVER set to `false` before `supabase.auth.getSession()` finishes evaluating existing session cookies/tokens.
   - When the user refreshes `/budget`, `authLoading` remains `true` until the session is confirmed.
   - `Budget.tsx` displays its clean loading skeleton instead of triggering premature redirection to `/auth`.

### C. Eliminate Lag & Navigation Flicker (`Budget.tsx`)
1. **TanStack Query Cache Optimization**:
   - Set `staleTime: 30000` (30 seconds) and `gcTime: 1000 * 60 * 5` (5 minutes) instead of `staleTime: 0` and `gcTime: 0`.
   - Remove redundant `useEffect(() => { refetch(); }, [refetch])` which caused double API calls on every mount.
   - Maintain `refetchOnWindowFocus: true` so VPN or network changes still update dynamically when switching back to the browser tab.

---

## 4. Verification Plan
1. **Mathematical Accuracy Verification**:
   - Query `/api/budget/daily` for target user `cb29ca08-585f-403a-8e32-9d8669760931` across multiple header currencies:
     - `MYR`: Daily ~RM31.29, Monthly ~RM948.40 (matches 49 USD/wk * 4.47).
     - `KRW`: Daily ~₩9,660, Monthly ~₩292,795 (matches 49 USD/wk * 1380).
     - `USD`: Daily $7.00, Monthly $212.17.
     - `IDR`: Daily ~Rp 109,550, Monthly ~Rp 3,320,460.
2. **Page Reload Verification**:
   - Reload `http://localhost:8080/budget` directly in the browser.
   - Verify that the page stays on `/budget` without flickering to `/auth` or `/dashboard`.
   - Verify that no "Welcome back" toast appears on reload.
3. **UI Fidelity Check**:
   - Verify that the cards, green-to-teal gradient, icons, badges, and fonts remain 100% identical to the reference design.
