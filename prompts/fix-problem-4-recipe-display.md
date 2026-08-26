# Implementation Plan: Problem 4 — Food Recipe Not Shown (Error / Empty)

## Objective
Fix recipe loading and display failures so that valid recipes from any source (TheMealDB, TheCocktailDB, cached recipes, or Supabase DB) render fully with title, image, ingredients, instructions, and nutrition details, while distinguishing between true 404 "Not Found" and server errors.

## Root Cause Analysis
1. `app/api/recipe-details/route.ts` only checked `cached_recipes` by `id` and `recipes` by `external_id`. It did not check `recipes` by primary key `id` (UUID) or `spoonacular_id`.
2. When recipes originate from external search results (TheMealDB / TheCocktailDB IDs like `52772` or `11000`) without prior recommendation caching, `POST /api/recipe-details` returned a 404 error instead of fetching and caching the recipe details from the provider.
3. `app/_pages/RecipeDetails.tsx` rendered a generic `recipe_missing` alert for all failures (including network errors and server 500s) without error categorization or retry capability.

## Proposed Changes

### 1. Robust Recipe Details API (`app/api/recipe-details/route.ts`)
- Check `cached_recipes` by `id`.
- Check `recipes` by `id` (UUID), `external_id`, and `spoonacular_id`.
- Add live upstream fallback for external IDs (TheMealDB `lookup.php?i={id}` and TheCocktailDB `lookup.php?i={id}`).
- Parse and normalize ingredients (array of `{ item, amount, unit }`), instructions (array of step strings), preparation time, and nutritional macros.
- Auto-persist fetched external recipes to `cached_recipes` for instant future lookups.
- Return appropriate HTTP status codes (400 for missing ID, 404 for truly non-existent recipe, 500 for unexpected backend error).

### 2. Client API Helper (`lib/api/recipes.ts`)
- Ensure `getRecipeDetails(id)` handles string/numeric IDs, parses errors accurately, and falls back to Supabase client directly if the local API route is temporarily unreachable.

### 3. UI Error & Empty States (`app/_pages/RecipeDetails.tsx`)
- Differentiate between loading, network/server error (with retry button), and true 404 not-found.
- Ensure safe rendering of ingredients, instructions, nutrition badges, and metadata even if some optional fields are missing.

## Acceptance Criteria
- [x] Opening a known recipe (e.g. from search, recommendations, or ID) renders complete content (title, image, nutrition, ingredients, instructions).
- [x] Invalid recipe ID displays a clear "Recipe Not Found" state with back navigation.
- [x] Server/network failure displays a retryable error message instead of silent blank failure.
