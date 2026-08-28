# Implementation Plan: Canonical Recipe Identity, Persistence & Zero-Collision Image Architecture

## 1. Objectives & Root Cause Resolution
Address the 12 architectural points identified in the system review:
1. **Canonical Database Identity**: Eliminate all ephemeral/frontend IDs (`recipe_ai_...`). Every AI recipe is generated with a canonical RFC4122 UUID and immediately persisted in the Supabase `recipes` and `cached_recipes` tables.
2. **Deterministic Recipe-to-Image Binding**: Images are bound to the specific canonical recipe data (title, cuisine, ingredients, preparation), never to frontend array indices or positional mappings.
3. **Database Schema & Cache Alignment**: Align `user_daily_meal_plans` schema (`plan_date` vs `date`) between `app/api/daily-meal-plan/route.ts` and `lib/api/recipes.ts` so today's plan is reliably retrieved from cache rather than triggering continuous regeneration on re-render.
4. **Clean Frontend State & Image Uniqueness**:
   - Clean up `FoodCarousel.tsx` and `app/_pages/Cookbook.tsx` to remove duplicate hardcoded fallback image URLs.
   - Always render `meal.image_url` directly from the persisted recipe object.
5. **Database-Backed Duplicate Rejection & Favorites**:
   - Query `daily_meal_served` for the last 7 days to eliminate previously shown dishes.
   - Separate `SHOWN` from `EATEN`.
   - Ensure `<FavoriteButton />` only writes genuine PostgreSQL UUIDs into `user_recipe_interactions`.

---

## 2. Proposed Changes

### Layer 1: Schema & Query Synchronization
#### [MODIFY] `lib/api/recipes.ts`
- Sync `user_daily_meal_plans` query columns (`plan_date` / `date`).
- Set TanStack Query `staleTime: 1000 * 60 * 60 * 12` for meal suggestions to prevent unnecessary re-generation on page focus or fast refresh.

### Layer 2: Backend Persistence & Recipe Generation
#### [MODIFY] `app/api/daily-meal-plan/route.ts`
- Ensure every generated recipe record has:
  - Canonical `id: UUID`
  - Deep ingredients with exact weights/measurements
  - Step-by-step numbered cooking instructions
  - Unique verified photography URL generated from the recipe's exact title and metadata
  - Persisted directly to `recipes` and `cached_recipes` tables before returning to client.

### Layer 3: Frontend Cleanup & Direct Image Binding
#### [MODIFY] `components/FoodCarousel.tsx`
- Remove all duplicate fallback image URLs.
- Render `meal.image_url` strictly from the canonical recipe object.
#### [MODIFY] `app/_pages/Cookbook.tsx`
- Ensure 12 unique items per category render directly with their database UUIDs and unique images.

---

## 3. Verification Plan
1. **Typecheck**: `npm.cmd run typecheck` (verify 0 errors).
2. **Localhost Testing**:
   - Open `http://localhost:3000/cookbook` and `http://localhost:3000/dashboard`.
   - Confirm zero duplicate images across all 12 cards in each category.
   - Confirm clicking Favorite ❤️ works immediately with zero UUID errors in the browser console.
   - Confirm clicking a card opens full ingredient grams and cooking instructions.
