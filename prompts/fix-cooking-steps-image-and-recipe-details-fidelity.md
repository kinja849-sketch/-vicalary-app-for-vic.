# Implementation Plan: Fix Cooking Steps & Ingredients Visual Fidelity

## 1. Problem Identification
1. **Bogus Cooking Steps/Overview Images**:
   - In `app/_pages/RecipeDetails.tsx` (lines 351-389), the `fetchImage` function was making calls to `https://loremflickr.com/1024/768/${cleanKeyword},food,cooking/all`.
   - `loremflickr.com` returns random, uncontrolled stock photos from Flickr that completely contradict the actual recipe, resulting in inaccurate visuals when viewing steps and ingredients.
2. **Recipe & Image Fidelity**:
   - In `RecipeDetails.tsx`, step and ingredients imagery must strictly resolve to the recipe's canonical verified photography (`recipe.image_url`) or verified culinary dish mappings from `FoodImageService`, combined with clear step markers and Chef Avatar animations.
3. **Database Lookups for Recipe Details**:
   - In `app/api/recipe-details/route.ts`, guard all Postgres UUID queries to only use `.eq('id', ...)` for valid UUIDs to prevent 400 Bad Request query errors.

---

## 2. Proposed Changes

### [MODIFY] `app/_pages/RecipeDetails.tsx`
- Remove `loremflickr.com` calls completely.
- Bind step and overview images strictly to `recipe.image_url` (the canonical verified dish photo) or verified culinary photography mappings from `FoodImageService`.
- Display high-fidelity step guidance with the authentic recipe photo, rich ingredient breakdowns, and Chef Vic animation overlay.

### [MODIFY] `app/api/recipe-details/route.ts`
- Fix the `cached_recipes` query to safely handle both UUIDs and external IDs without causing Postgres column type errors.

---

## 3. Verification Plan
1. **Typecheck**: `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Navigate to `http://localhost:3000/cookbook`.
   - Click on any recipe (e.g. "Nasi Merah Ayam Bakar", "Soto Ayam", "Oatmeal").
   - Click "Let's start cooking" (interactive voice/guided mode) or review steps & ingredients.
   - Confirm that the displayed image matches the recipe and that no random Flickr photos appear.
