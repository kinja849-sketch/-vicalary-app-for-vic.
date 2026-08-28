# Implementation Plan: Precise Database Schema Alignment & Canonical Recipe Persistence

## 1. Verified PostgreSQL Schema
From the authoritative migration `supabase/migrations/20240524_meal_plan_infrastructure.sql`:
`user_daily_meal_plans` strictly contains:
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `plan_date` (DATE)
- `breakfast` (JSONB)
- `lunch` (JSONB)
- `dinner` (JSONB)
- `snacks` (JSONB)
- `drinks` (JSONB)
- `desserts` (JSONB)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- Unique constraint: `UNIQUE (user_id, plan_date)`

`recipes` strictly contains:
- `id` (UUID, PK)
- `external_id` (TEXT, UNIQUE)
- `provider` (TEXT)
- `title` (TEXT)
- `description` (TEXT)
- `image_url` (TEXT)
- `cuisine_type` (TEXT)
- `dietary_tags` (JSONB)
- `ingredients` (JSONB)
- `instructions` (JSONB)
- `prep_time_minutes` (INTEGER)
- `cook_time_minutes` (INTEGER)
- `total_calories` (INTEGER)
- `protein_g` (INTEGER / DECIMAL)
- `carbs_g` (INTEGER / DECIMAL)
- `fat_g` (INTEGER / DECIMAL)

---

## 2. Root Cause of Previous Save Failure
- `lib/api/recipes.ts` and `app/api/daily-meal-plan/route.ts` were attempting to insert `{ plan_data: ... }` and select `plan_data`.
- Because `plan_data` does not exist in the database, Supabase returned `PGRST204: Could not find the 'plan_data' column of 'user_daily_meal_plans' in the schema cache` and rejected the insert.
- Because the insert failed, stale data remained in the database.

---

## 3. Proposed Changes

### [MODIFY] `lib/api/recipes.ts`
- Remove all references to `plan_data` across `getDailyMealSuggestions` and other helpers.
- Query strictly: `.select('id, user_id, plan_date, breakfast, lunch, dinner, snacks, drinks, desserts, updated_at')`.
- Upsert strictly with: `{ user_id, plan_date, breakfast, lunch, dinner, snacks, drinks, desserts, updated_at }` with `{ onConflict: 'user_id,plan_date' }`.
- Check that the retrieved plan has 12 valid dishes in `breakfast` with verified images.

### [MODIFY] `app/api/daily-meal-plan/route.ts`
- Upsert to `user_daily_meal_plans` strictly with columns `{ user_id, plan_date, breakfast, lunch, dinner, snacks, drinks, desserts, updated_at }`.
- Upsert to `recipes` with all canonical columns.

### [MODIFY] `app/api/recipe-details/route.ts`
- Read `breakfast, lunch, dinner, snacks, drinks, desserts` directly from `user_daily_meal_plans`.
- Return exact matched recipe.

---

## 4. Verification Plan
1. **Typecheck**: Run `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Navigate to `http://localhost:3000/cookbook`.
   - Verify that there are 0 PostgREST errors in the browser console.
   - Confirm that the new 72-dish plan saves and persists cleanly.
   - Click on any recipe. Confirm that `/recipe/[id]` loads the exact same dish with photo, ingredients, and instructions.
