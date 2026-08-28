# Implementation Plan: Comprehensive Recipe Details Resolution & Cache Invalidation

## 1. Problem Identification
1. **Old Broken Cache in Database**:
   - `user_daily_meal_plans` in Supabase Postgres was holding an old meal plan generated before the collision-free pipeline was added.
   - `getDailyMealSuggestions` was returning this old plan because it existed for `today`, preventing the new 100% unique 72-dish plan from appearing on localhost.
2. **Recipe Details Lookup Failure**:
   - In `app/api/recipe-details/route.ts`, the `user_daily_meal_plans` query was selecting `breakfast, lunch, ...` as separate column names rather than reading `plan_data`.
   - Because `plan_data` was not read, when a user clicked on a meal card, `/api/recipe-details` could not find the recipe in the daily plan.
   - It then fell through to `TheCocktailDB` / `TheMealDB` external APIs, which threw a SyntaxError and returned 404 or a wrong generic recipe.

---

## 2. Proposed Changes

### [MODIFY] `lib/api/recipes.ts`
- Invalidate cached daily plans if they contain duplicate image URLs or non-UUID IDs, triggering clean regeneration with the new collision-free pipeline.

### [MODIFY] `app/api/recipe-details/route.ts`
- Fix `user_daily_meal_plans` lookup to parse `plan_data` correctly and extract all meals.
- Check `recipes`, `cached_recipes`, `user_daily_meal_plans`, and curated base plan directly by ID / title.
- Eliminate all external API fallback errors.

### [MODIFY] `app/_pages/Cookbook.tsx` & `components/FoodCarousel.tsx`
- Ensure full visual synchronization: clicking any meal card routes to `/recipe/[id]` where all data (title, authentic photography, full ingredients, numbered step-by-step instructions, and macros) match 100%.

---

## 3. Verification Plan
1. **Typecheck**: `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Navigate to `http://localhost:3000/cookbook`.
   - Confirm that each category renders 12 completely distinct dishes with unique culinary photos.
   - Click each dish across Breakfast, Lunch, and Dinner.
   - Confirm that the recipe details page loads instantly with the exact dish name, matching photo, ingredient quantities, and step-by-step cooking instructions.
