# Implementation Plan: 100% Cap, Red Highlight on Eaten, Zero Left, Agitated Health Coach Alert, and Log Button Inactive Upon Goal Reached

## User Requirements
1. **Percentage**: Cap at `100%` (`Math.min(100, Math.round((caloriesConsumed / caloriesGoal) * 100))`). When the goal is achieved or exceeded, it displays `100%`.
2. **Left**: Must remain `0` (`Math.max(0, caloriesGoal - caloriesConsumed)`) because the daily goal has already been taken.
3. **Eaten**: When `caloriesConsumed > caloriesGoal`, the **EATEN** number and card must be highlighted in **red** (`text-red-600 dark:text-red-500` with alert styling) to clearly show that the calorie goal has been exceeded.
4. **Progress Ring**: The circular progress ring surrounding the avatar must be **red** (`#ef4444`) with an alert glow when exceeded.
5. **Health Coach Immediate Agitated Alert**: When calories exceed the goal, the Health Coach sends an immediate message in an **agitated, urgent tone**, warning the user about the extra calories, explaining the physiological consequences (aggressive fat storage, insulin spike, sabotaging progress), and demanding that this must be avoided immediately.
6. **Log Meal Button Disabled/Dimmed When Goal Achieved**: When someone scans meals again and the target goal has already been achieved (`caloriesConsumed >= caloriesGoal`), the **Log Meal** button must be **dimmed and inactive** (`opacity-40 cursor-not-allowed pointer-events-none disabled`), displaying a locked state and only becoming active again when today's progress is reset.

---

## Files To Modify
1. [`components/ProgressCard.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProgressCard.tsx):
   - Set `percentage = Math.min(100, Math.round((caloriesConsumed / caloriesGoal) * 100));`
   - Set `caloriesLeft = Math.max(0, caloriesGoal - caloriesConsumed);` (displays `0` when at or above goal).
   - Add `isExceeded = caloriesGoal > 0 && caloriesConsumed > caloriesGoal;`
   - Highlight **EATEN** in bold red when `isExceeded` is true.
   - Keep circular progress ring `#ef4444` (red) with red drop-shadow when `isExceeded` is true.
2. [`lib/api/coach.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/coach.ts):
   - Update `sendCoachCalorieExceededAlert` with an agitated, urgent, high-stakes coaching tone detailing the added calories, physiological risks (insulin spikes, accelerated fat storage, cardiovascular strain), and demanding strict avoidance.
3. [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MealAnalysis.tsx):
   - Check if today's calorie goal has already been achieved (`caloriesConsumed >= caloriesGoal`).
   - If achieved, render the Log Meal button in a dimmed, disabled state (`opacity-40 cursor-not-allowed pointer-events-none`) labeled "Daily Goal Reached (Locked)" with an alert notice banner, unlocking only when progress resets.

---

## Acceptance Criteria
- [x] Percentage displays `100%` (not 235%).
- [x] Left displays `0` (not negative).
- [x] EATEN is highlighted in prominent red (`#ef4444` / `text-red-600`) when calories exceed the target.
- [x] Circular progress ring surrounding the avatar is red when exceeded.
- [x] Health Coach alert is sent in an agitated, urgent, serious tone detailing the exact excess and health consequences.
- [x] When a meal is scanned while the daily goal is already achieved, the Log Meal button is dimmed, inactive, and locked until progress is reset.
- [x] `npx tsc --noEmit` passes with 0 errors.
- [x] Dev server running smoothly on `http://localhost:8080`.
