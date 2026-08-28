# Implementation Plan: Unbreakable Single-Source Recipe Identity, Zero-Fallback Images & Permanent Persistence

## 1. Objectives & Architecture
Implement all 10 priorities of the single-source-of-truth recipe architecture:

### Priority 1: Eliminate All Photo Fallbacks on Error
- Remove all `onError` handlers that reassigned broken images to default food photos (which caused multiple cards to morph into the same salad/chicken photo).
- Implement a dedicated `<MealImage />` component with a neutral modern culinary placeholder (subtle branded gradient + utensil icon) when an image is loading or fails.

### Priority 2: Deterministic Daily Plan Persistence
- Check `user_daily_meal_plans` for `(user_id, plan_date)`.
- If an existing plan is found for today, return it immediately without reshuffling, re-rolling, or recalculating.
- Ensure daily plan is generated once and persists immutably throughout the calendar day.

### Priority 3: Single-Source Database Identity
- Every displayed dish strictly binds:
  `recipe.id (UUID) -> recipe.title -> recipe.image_url -> recipe.ingredients -> recipe.instructions`
  All columns belong permanently to one database record.

### Priority 4: Direct Detail Navigation by UUID
- On `/recipe/[id]`, fetch the exact record from `recipes`, `cached_recipes`, or `user_daily_meal_plans` by `id`.
- Completely remove live external title-based lookups from TheMealDB on the detail page to prevent image drift.

### Priority 5: Full Generation Validation Pipeline
- Hard allergy exclusion scan (seafood, shellfish, fish derivatives, nuts, dairy, pork).
- Calorie distribution matching user daily budget.
- 7-Day non-favorite exclusion rule.
- 100% unique image URL constraint across all 72 daily dishes.

---

## 2. Proposed Changes

### [NEW] `components/MealImage.tsx`
- Neutral, robust image renderer that handles errors gracefully without falling back to shared food photos.

### [MODIFY] `components/FoodCarousel.tsx`
- Use `<MealImage />` component.
- Strict `key={meal.id}`.

### [MODIFY] `app/_pages/Cookbook.tsx`
- Use `<MealImage />` component in `CookbookCard`.
- Strict `key={meal.id}`.

### [MODIFY] `app/_pages/RecipeDetails.tsx`
- Use `<MealImage />` in the header and guided cooking mode.
- Render authentic recipe ingredients and instructions directly from the loaded record.

### [MODIFY] `app/api/recipe-details/route.ts`
- Query `recipes`, `cached_recipes`, and `user_daily_meal_plans` directly by `id`.
- Remove external API title re-searches.

---

## 3. Verification Plan
1. **Typecheck**: `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Open `http://localhost:3000/cookbook` and `http://localhost:3000/dashboard`.
   - Verify every card has its own distinct photo and identity.
   - Click a recipe to open `/recipe/[id]`. Confirm header image, steps, and ingredients are identical to the cookbook card.
   - Refresh the page multiple times: confirm dishes and photos remain 100% stable with zero re-rolling.
