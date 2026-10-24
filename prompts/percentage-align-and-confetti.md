# Implementation Plan: Percentage Alignment & 100% Calorie Celebration Confetti

## User Request
1. "The percentage symbol should be properly aligned."
   - In the progress card, `100` and `%` currently wrap across two lines due to `text-6xl` overflowing `flex-1`.
   - The percentage symbol must be properly aligned on the same line (`100%`) with horizontal baseline alignment and `whitespace-nowrap`.
2. "I have noticed that there is no confetti at all. When the 100% has been hit, there should be confetti. This should be done."
   - Confetti did not fire because the goal evaluation checked `dailyProgress.calories_goal > 0`, but `daily_progress.calories_goal` in Supabase is `null` (the goal is actually stored on `profile.goal_calories = 1912`).
   - Additionally, `CelebrationConfetti` was inside a container with `[overflow-x:clip]` without using React portal to `document.body`.
   - When 100% is hit (`consumed >= goal` where `percentage >= 100`), confetti must burst across the screen with high visibility.

---

## Architecture & Root Cause Analysis

### 1. Percentage Alignment Bug
- **File**: `components/ProgressCard.tsx`
- **Root Cause**: Line 55-57 uses `<p className="text-6xl font-black text-slate-900 dark:text-white leading-tight drop-shadow-md">{percentage}%</p>` inside `<div className="flex-1">` next to `<div className="size-[130px] shrink-0">`. On narrow viewports (~360-400px), `text-6xl` for `100%` exceeds the available container width, forcing the `%` symbol to wrap to the next line.
- **Solution**:
  - Update container with `flex items-baseline whitespace-nowrap`.
  - Display the number with `text-5xl sm:text-6xl font-black` and `%` with `text-3xl sm:text-4xl font-extrabold ml-1`.
  - This ensures `100%` is permanently on one line and perfectly aligned at the baseline.

### 2. Confetti Never Firing Bug
- **Files**:
  - `app/_pages/Dashboard.tsx`
  - `components/CelebrationConfetti.tsx`
  - `components/ProgressCard.tsx`
- **Root Cause**:
  1. `dailyProgress.calories_goal` is nullable in database (`daily_progress.calories_goal` is `null`). The actual goal is on `profile.goal_calories` (1912). The previous effect in `Dashboard.tsx` checked `Number(dailyProgress.calories_goal) > 0`, which was `0 > 0 = false`, so it never executed!
  2. The confetti canvas was rendered inside `<div className="relative mx-auto ... [overflow-x:clip]">` without a React Portal. Any ancestor CSS clipping or stacking context could obscure the fixed canvas.
  3. `CelebrationConfetti` only rendered a single small burst without multi-cannon confetti physics or high-DPI scaling.
- **Solution**:
  1. Align goal calculation across `Dashboard.tsx` and `ProgressCard.tsx`:
     ```ts
     const effectiveGoal = Number(
       dailyProgress?.calories_goal ||
       profile?.goal_calories ||
       onboarding?.daily_calorie_goal ||
       2000
     );
     const effectiveConsumed = Number(dailyProgress?.calories_consumed || 0);
     const is100Percent = effectiveGoal > 0 && effectiveConsumed >= effectiveGoal;
     ```
  2. Trigger `setShowCelebration(true)` whenever `is100Percent` is true on dashboard load and whenever a meal is logged that achieves or stays at 100%.
  3. Rebuild `CelebrationConfetti.tsx` with:
     - `createPortal(..., document.body)` so it mounts directly to the DOM root with `z-[999999]` and cannot be clipped.
     - Multi-burst cannon physics: Left cannon (shooting up-right), right cannon (shooting up-left), and center firework burst.
     - 160 colorful particles, ribbons, and star shapes with realistic flutter, rotation, and gravity.
     - Full viewport auto-sizing and DPI-aware scaling.
     - Interactive celebration trigger: tapping the circular 100% ring in `ProgressCard` also launches confetti!

---

## Files To Modify
1. `components/ProgressCard.tsx`: Fix `%` alignment with `whitespace-nowrap flex items-baseline`, add `onCelebrate` trigger on the 100% ring.
2. `components/CelebrationConfetti.tsx`: Implement `createPortal`, multi-cannon celebratory confetti particle engine with full screen coverage.
3. `app/_pages/Dashboard.tsx`: Fix goal calculation fallback so `is100Percent` evaluates accurately even when `dailyProgress.calories_goal` is null; pass `onCelebrate` to `ProgressCard`.

---

## Acceptance Criteria
- [x] In `ProgressCard`, `100%` renders cleanly on a single line with `%` properly baseline-aligned and never wrapping.
- [x] Confetti bursts across the screen when 100% daily calorie target is hit.
- [x] Loading or viewing the dashboard at 100% triggers celebratory confetti.
- [x] Tapping the 100% progress ring re-triggers the celebration.
- [x] Zero TypeScript errors (`npx tsc --noEmit`).
- [x] Dev server running smoothly on `http://localhost:8080`.
