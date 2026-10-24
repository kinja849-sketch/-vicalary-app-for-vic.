# Implementation Prompt: Daily Calorie Progress Accumulation, Cap Notification & Celebration Confetti

## 1. Executive Summary & Objective
Fix meal progress logging and daily intake enforcement in VICALARY:
1. **Cumulative Daily Progress (Fix Overwrite Bug)**:
   - When a meal is analyzed and logged, it must add cumulatively to `daily_progress` for today (e.g. 24% + 22% = 46%), never overwriting or resetting prior logged meals.
   - Standardize logging across Camera, Scanner, and Dashboard so daily intake correctly accumulates.
2. **Daily Calorie Cap Enforcement & Advisory Message**:
   - When the user's daily calorie intake has reached or exceeded 100% of their daily calorie goal:
     - Further meals are not recorded into daily totals.
     - Display a message: *"Your daily calorie goal has been achieved today! Try to be considerate and watch your calorie intake for the rest of the day."*
3. **Celebration Confetti on Goal Achievement**:
   - When the user reaches 100% of their daily calorie intake, trigger a celebration confetti animation directly on the Dashboard section.
4. **Accurate, Non-Distortive Camera Food Analysis**:
   - Ensure the vision model outputs authentic portions and realistic plate geometry bounds without inflated guesses.
   - Maintain zero code breakage and preserve existing UI styles.

---

## 2. Root Cause Analysis

### Bug A: Why logging a new product/meal wipes or resets the previous meal percentage
In `lib/api/progress.ts` (`logMeal`) and `app/_pages/Dashboard.tsx` (`handleLogProduct` / `handleLogMeal`):
1. In `app/_pages/Dashboard.tsx`, `handleLogProduct` was doing both:
   `saveFoodAnalysis(user.id, productData, true)` AND `logMeal(user.id, mealToLog)`.
2. In `lib/api/food.ts`, `saveFoodAnalysis` was also calling `updateDailyProgress`, while `logMeal` was also writing to `daily_progress`.
3. In `app/_pages/Camera.tsx`, `handleSave` only called `saveFoodAnalysis(activeUserId, analysisResult)` without calling `logMeal`, whereas in `Dashboard.tsx`, `handleLogMeal` called `logMeal(user.id, analysisData)`.
4. In `app/_pages/Dashboard.tsx`, the query key was `['daily-progress', user?.id, today]`, but `queryClient.invalidateQueries` in several places only invalidated `['daily-progress']` or did not invalidate the exact key, leading to cached or partially stale state refreshes.
5. In `lib/api/progress.ts`, `logMeal` was updating:
   ```ts
   calories_consumed: (currentProgress.calories_consumed || 0) + totalMealCalories
   ```
   However, if `currentProgress.calories_consumed` was a Decimal object returned by Supabase (`{ toString: ... }`), JS string concatenation or decimal parsing could produce unexpected replacement or nan values, resetting the intake.

---

## 3. Implementation Plan & Scope

### A. Unified Cumulative Progress in `lib/api/progress.ts` and `lib/api/food.ts`
1. **Atomic & Idempotent Progress Update**:
   - In `logMeal` and `updateDailyProgress`, enforce that `daily_progress` is updated cumulatively by safely parsing numbers: `Number(currentProgress.calories_consumed || 0) + Number(totalMealCalories)`.
   - Check if the goal is already reached:
     - If `Number(currentProgress.calories_consumed || 0) >= Number(currentProgress.calories_goal || 2000)`:
       - Do **NOT** record the additional calories into `daily_progress`.
       - Return `{ goalAchieved: true, alreadyExceeded: true, message: "Your daily calorie goal has been achieved today! Try to be considerate and watch your calorie intake for the rest of the day." }`.
     - If the new meal reaches or crosses the goal:
       - Increment up to or including the meal, and return `{ goalAchieved: true, justAchieved: true }`.
2. **Align All Logging Callers**:
   - Standardize `app/_pages/Camera.tsx`, `app/_pages/Dashboard.tsx`, and `components/MealAnalysis.tsx` so all meal diary additions pass through the unified `logMeal` method with consistent cache invalidation.

### B. Celebration Confetti Component on Dashboard
1. Create a lightweight, high-performance canvas celebration component (`components/CelebrationConfetti.tsx`) (zero heavy external packages).
2. Wire it into `app/_pages/Dashboard.tsx`:
   - Triggers when `percentage >= 100` is achieved or when `logMeal` returns `justAchieved: true`.
   - Auto-fades after 4 seconds with vibrant celebratory particles.
3. Display an encouraging advisory banner / alert when calorie goal is reached:
   - *"🎉 Congratulations! You have achieved your daily calorie goal today. Try to be considerate and mindful of your calories for the rest of the day."*

### C. Camera Meal Analysis Accuracy
1. Review `app/api/analyze-food-image/route.ts` to ensure strict portion scaling:
   - Single serving bounds (standard plate ~350–650 kcal unless dense multi-dish banquet).
   - Clear distinction between discrete meal items (e.g. rice vs chicken vs vegetables).
   - Explicit confidence rating and no exaggerated portion multipliers.

---

## 4. Verification & Acceptance Criteria
1. **Accumulation Test**:
   - Log Meal 1 (e.g., 400 kcal on 2000 kcal goal = 20%).
   - Log Meal 2 (e.g., 500 kcal = 25%).
   - Verify progress card shows **45% (900 kcal / 2000 kcal)**, not just 25%.
2. **Cap Enforcement Test**:
   - Log a meal that completes the goal (e.g., reaches 2000 kcal = 100%).
   - Verify celebration confetti triggers on the Dashboard.
   - Attempt to log an additional meal: verify it is NOT added to daily intake, and a considerate advisory message is shown to the user.
3. **Typecheck & Dev Server**:
   - Run `npx tsc --noEmit` to verify clean compilation.
   - Verify dev server at `http://localhost:8080`.
