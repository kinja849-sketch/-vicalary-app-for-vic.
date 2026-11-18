# Implementation Prompt: Frictionless Targeted Onboarding Resolution & Budget Lock-Out Elimination

## Goal
Implement a single, non-breaking improvement to the onboarding experience so that whenever a user has skipped any onboarding question or provided a vague/incomplete answer, they are never locked out of the budget section or shown the dead-end "Budget Profile Missing" blocking message. Instead, the application gently, smoothly, and clearly redirects them straight to the exact onboarding question that needs a proper answer, pre-fills their existing answers, saves their response, and brings them right back to their destination with almost zero friction.

## Root Cause Analysis
1. **The Lock-out Trap**:
   - In `app/_pages/Onboarding.tsx`, users can click "Skip" (`handleContinue` without setting a value for `currentQuestion.key`).
   - If a user skips Question 16 (`weekly_budget`), `onboarding_responses.weekly_budget` is left `null` or `0`.
   - At the final step, `saveMutation` marks `user_profiles.onboarding_completed = true`.
   - When the user navigates to `/budget` (e.g. clicking "Bajeti" in Swahili or "Budget" in English), `BudgetEngine` / `BudgetNormalizationService` cannot calculate a budget without `weekly_budget` or `budget`, so `/api/budget/daily` returns `{ success: true, needs_setup: true, summary: null }`.
   - In `app/_pages/Budget.tsx` (lines 86-91), `!activeBudget` displays a blocking error banner:
     ```tsx
     <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl mb-8 border border-red-100 dark:border-red-800">
         <AlertTriangle className="text-red-500 mb-2" />
         <h2 className="text-lg font-bold text-red-700 dark:text-red-400">{t('budget_profile_missing')}</h2>
         <p className="text-sm text-red-600 dark:text-red-300 mb-4">{t('budget_profile_missing_desc')}</p>
     </div>
     ```
   - This screen is a complete dead-end with no CTA, no button, and no guidance.
   - If the user tries to manually navigate to `/onboarding`, line 252 of `Onboarding.tsx` executes:
     `if (profile.onboarding_completed && !isPreview) router.push("/dashboard");`
     bouncing them back to `/dashboard`!
   - Result: The user is permanently locked out of the Budget feature.

2. **Missing Targeted Question Support**:
   - `Onboarding.tsx` starts at step 0 and assumes a blank `responses = {}`. It has no support for query params like `?question=weekly_budget` or `?returnTo=/budget`.
   - It does not load the user's existing saved responses from `onboarding_responses`, so visiting onboarding risked overwriting previously answered questions.

3. **Vague / Incomplete Answers Unchecked**:
   - No central validator existed to identify which questions were skipped or answered vaguely (e.g., placeholder text, zero values, or missing required attributes).

## Proposed Architecture & Targeted Plan

### 1. Centralized Onboarding Completeness Validator
Create [`lib/onboarding/validator.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/onboarding/validator.ts):
- Defines clean, deterministic validation rules for all 18 onboarding questions:
  1. `full_name`: Not empty, length >= 2, not placeholder words (`"none"`, `"n/a"`, `"skip"`, `"test"`, `"-"`, `"?"`).
  2. `age`: Number > 0, within realistic human bounds (13 - 110).
  3. `gender`: Non-empty selection.
  4. `height_cm`: Number within bounds (50 - 250 cm).
  5. `weight_kg`: Number within bounds (20 - 300 kg).
  6. `goal`: Non-empty string.
  7. `activity_level`: Non-empty selection.
  8. `sleep_duration`: Number within bounds (2 - 18 hours).
  9. `sleep_quality`: Non-empty selection.
  10. `stress_level`: Non-empty selection.
  11. `dietary_preference`: Non-empty selection.
  12. `dietary_lifestyle`: Array with at least one selection (or explicit `'none'`).
  13. `medical_conditions`: Non-empty answer or explicit `"none"` / `"healthy"`.
  14. `allergies`: Non-empty answer or explicit `"none"`.
  15. `meal_prep_time`: Non-empty selection.
  16. `cooking_skill`: Non-empty selection.
  17. `weekly_budget`: Number > 0 (essential for BudgetEngine).
  18. `daily_reminders`: Non-empty selection.
- Provides utility functions:
  - `isQuestionIncompleteOrVague(key: string, value: any): boolean`
  - `getMissingOrVagueQuestions(responses: any): string[]`
  - `getFirstIncompleteQuestion(responses: any): string | null`
  - `getQuestionIndexByKey(key: string): number`

### 2. Targeted Deep-Linking & State Recovery in Onboarding
Update [`app/_pages/Onboarding.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Onboarding.tsx):
- Parse URL query parameters:
  - `question`: Key of the target question (e.g. `weekly_budget`, `full_name`, etc.).
  - `step`: Direct numerical step index (0-17).
  - `returnTo`: Destination route to redirect after saving (e.g. `/budget`).
- When `question` or `step` is present (Targeted Mode):
  - **Bypass auto-redirect to dashboard**: Do not bounce the user to `/dashboard` even if `profile.onboarding_completed` is `true`.
  - **Pre-load existing responses**: Fetch the user's saved answers via `getOnboardingResponses(user.id)` and populate `responses` state so no existing data is lost.
  - **Jump directly to step**: Set `currentStep` directly to the matching question index.
  - **Helpful Context Chip**: Show a subtle, non-intrusive banner indicating why they are on this question (e.g., *"Complete this answer to personalize your Budget"*).
  - **Smooth Handoff**: Once the question is answered and user clicks Continue / Finish:
    - Save updated responses via `saveMutation`.
    - If `returnTo` is provided (e.g. `/budget`), immediately and smoothly route to `returnTo` using `router.push(returnTo)`.
    - If no `returnTo`, check if other questions are incomplete and advance to the next incomplete question, or route to `/dashboard` if all are answered.

### 3. Eliminate Lock-Out & Add Gentle Redirect in Budget
Update [`app/_pages/Budget.tsx`](file:///c:/Users/acer/-vicalary-app-for-vic.-main/app/_pages/Budget.tsx):
- Remove the dead-end "Budget Profile Missing" blocking error banner.
- When `!activeBudget` or when `getBudgetStatus` indicates setup is required:
  - Check if the user's `weekly_budget` is missing, skipped, or <= 0.
  - Gently and automatically redirect the user to `/onboarding?question=weekly_budget&returnTo=/budget`.
  - Show a friendly, brief toast: *"Let's set your weekly food budget to personalize your budget dashboard."*
  - Display a smooth, non-blocking loading / transition state while redirecting.
  - Also provide a friendly fallback button *"Set Up Your Budget"* pointing to `/onboarding?question=weekly_budget&returnTo=/budget` in the UI so the user always has clear, friction-free control.

### 4. API & Data Layer Consistency
Update [`lib/api/budget.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/budget.ts):
- When `/api/budget/daily` returns `needs_setup: true`:
  - Return `{ needs_setup: true, missingField: 'weekly_budget' }` instead of bare `null`, allowing frontend components to make targeted redirect decisions deterministically.

## Target Files
1. [`lib/onboarding/validator.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/onboarding/validator.ts) (New helper)
2. [`app/_pages/Onboarding.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Onboarding.tsx)
3. [`app/_pages/Budget.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/_pages/Budget.tsx)
4. [`lib/api/budget.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/budget.ts)

## Acceptance Criteria
- [ ] No user is ever locked out of the budget section or shown the dead-end "Budget Profile Missing" blocking message.
- [ ] When a user with skipped/unanswered/vague `weekly_budget` visits `/budget`, they are gently and smoothly redirected straight to `/onboarding?question=weekly_budget&returnTo=/budget`.
- [ ] Onboarding opens directly on the exact question (Question 16 `weekly_budget`) with all existing answers pre-loaded and preserved.
- [ ] Submitting the question saves the response and redirects straight back to `/budget`.
- [ ] `/budget` calculates and displays the user's localized budget immediately without error.
- [ ] The same targeted redirect pattern applies cleanly to any onboarding question that is skipped or answered vaguely.
- [ ] All existing UI styling, navigation, and features remain completely intact and unbroken.
