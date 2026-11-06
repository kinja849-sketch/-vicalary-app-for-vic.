# Implementation Blueprint: Fix Daily Progress Depreciation & Overwrite Bug

## Executive Summary
When a user logs a food scan/meal, the daily progress card intermittently drops ("depreciates")—for example, dropping from 58% down to 18%—instead of accumulating the new meal's calories with previously logged meals of the day.

This investigation has uncovered the exact database records, timestamps, and architectural root causes behind this issue in Kinja Abdirahman's account (`cb29ca08-585f-403a-8e32-9d8669760931`) on `2026-11-06`.

---

## 1. Root Cause Analysis

### A. The Cumulative Overwrite Flaw in `logMeal` & `updateDailyProgress`
- In [lib/api/progress.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/progress.ts#L244-L289) (`logMeal`), the system performs an unsafe client-side read-then-write:
  ```typescript
  const { data: progressRows } = await supabase.from('daily_progress').select('*').eq('user_id', userId).eq('progress_date', today).limit(1);
  const currentProgress = progressRows?.[0];
  const existingConsumed = Number(currentProgress?.calories_consumed || 0);
  const newConsumed = existingConsumed + totalMealCalories;
  ```
- If `existingConsumed` evaluates to 0 (due to caching, race conditions, or uncoordinated client-side queries), `calories_consumed` gets set directly to `totalMealCalories`.
- Evidence from `system_logs` today:
  1. `05:09:28 UTC`: Meal 1 (Semur Kentang, 564 kcal) logged -> `calories_consumed` = 564 (30%).
  2. `05:33:41 UTC`: Meal 2 (Tumpukan Crepes, 1107 kcal) logged -> `newConsumed` was logged as `1107` instead of `564 + 1107 = 1671` (58%).
  3. `06:41:09 UTC`: Meal 3 (Stack of Pan-Fried Pancakes, 345 kcal) logged -> `newConsumed` was logged as `345` instead of `1671 + 345 = 2016` (18%).
- Each meal completely overwrote `calories_consumed` with its own value rather than accumulating the entire day's caloric intake.

### B. Destructive Reset in `lib/api/auth.ts`
- In [lib/api/auth.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/auth.ts#L380-L387), an `upsert` explicitly forces `calories_consumed: 0` and `meals_logged: 0`:
  ```typescript
  await supabase.from('daily_progress').upsert({
      user_id: userId,
      progress_date: today,
      calories_goal: dailyCalorieGoal,
      calories_consumed: 0,
      meals_logged: 0
  }, { onConflict: 'user_id,progress_date' });
  ```
- Postgres updates the conflict columns (`calories_consumed = 0`, `meals_logged = 0`), which wipes out existing progress while leaving unmentioned macro columns (`protein_consumed`, `carbs_consumed`, `fat_consumed`) intact. This explains why Kinja's macros summed to 77.1g protein and 381.3g carbs while `calories_consumed` was set to 345 and `meals_logged` was set to 1.

### C. Lack of Truth Reconciliation in `getDailyProgress`
- [lib/api/progress.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/progress.ts#L47-L82) (`getDailyProgress`) simply reads whatever number is in `daily_progress`.
- The authoritative ledger of meals eaten is `food_analysis_history`. When `daily_progress` diverges or is corrupted by an overwrite, `getDailyProgress` never reconciles with `food_analysis_history`, leaving the UI displaying the depreciated percentage.

---

## 2. Targeted Engineering Fix

### Step 1: Fix `logMeal` in `lib/api/progress.ts`
- Instead of relying on an untrusted or stale `currentProgress.calories_consumed`, `logMeal` must:
  1. Record the meal in `food_analysis_history`.
  2. Compute today's cumulative intake by aggregating all meals logged for `today` in `food_analysis_history` for this user:
     - `SUM(calories)`
     - `SUM(protein)`
     - `SUM(carbs)`
     - `SUM(fat)`
     - `COUNT(*)` (meals logged)
  3. Ensure that `calories_consumed` is at least `existingConsumed + totalMealCalories`, and matches the aggregated total from `food_analysis_history`.
  4. Write the canonical, strictly non-depreciating total to `daily_progress`.

### Step 2: Fix `updateDailyProgress` in `lib/api/food.ts`
- Apply the same robust cumulative aggregation and floor protection:
  - If a row already exists, never overwrite with a smaller value unless explicitly resetting.
  - Reconcile with `food_analysis_history` if discrepancies exist.

### Step 3: Remove Destructive Reset in `lib/api/auth.ts`
- In [lib/api/auth.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/auth.ts#L380-L387), change the upsert so it does **NOT** overwrite non-zero progress:
  - Check if `daily_progress` already exists for `today`. If it exists, only update `calories_goal` if changed, and **NEVER** overwrite `calories_consumed` or `meals_logged` with 0.

### Step 4: Add Self-Healing Reconciliation to `getDailyProgress`
- In [lib/api/progress.ts](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/progress.ts#L47-L82):
  - When fetching `daily_progress` for `today`, check the sum of calories logged in `food_analysis_history` for `today`.
  - If `food_analysis_history` has valid logged meals whose total exceeds `daily_progress.calories_consumed`, heal `daily_progress` immediately so the user always sees their true, non-depreciated progress.

### Step 5: Heal Kinja Abdirahman's Database Record
- Update Kinja's row (`f1c1c5a7-5739-4bc8-8021-f0ddba4000d4`) for `2026-11-06`:
  - `calories_consumed`: 2016 (564 + 1107 + 345)
  - `meals_logged`: 3
  - Reflecting 105% progress on a 1912 kcal goal.

---

## 3. Verification Criteria
1. Logging meal 1 (e.g. 500 kcal) -> Progress card shows 500 kcal (~26%).
2. Logging meal 2 (e.g. 600 kcal) -> Progress card shows 1100 kcal (~58%).
3. Logging meal 3 (e.g. 345 kcal) -> Progress card shows 1445 kcal (~76%), NEVER drops to 18%.
4. Refreshing the dashboard or logging in never resets `calories_consumed` to 0.
5. Kinja's dashboard displays the accumulated progress immediately.
