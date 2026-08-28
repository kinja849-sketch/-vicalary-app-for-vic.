# Implementation Plan: Fix Plan Date Schema & User Settings 401 Authentication

## 1. Objectives
Resolve the two database/API failures identified in the runtime logs:
1. **Schema Mismatch on `user_daily_meal_plans`**:
   - The PostgreSQL table schema uses `plan_date` and unique constraint `(user_id, plan_date)`.
   - Remove all references to the non-existent `date` column across `lib/api/recipes.ts` and `app/api/daily-meal-plan/route.ts`.
   - Use `onConflict: 'user_id,plan_date'` on all upsert operations.
   - Distinguish genuine database errors from "no plan exists" to prevent accidental duplicate generation loops.
2. **`user_settings` 401 Unauthorized**:
   - Check auth session before executing browser queries against `user_settings`.
   - Guard against invalid non-UUID user IDs (e.g. `'default_user'`) making unauthorized PostgREST requests.
   - On the server, ensure `createServerSupabaseClient()` is used with proper permissions.

---

## 2. Proposed Changes

### [MODIFY] `lib/api/recipes.ts`
- Replace `.or('date.eq...,plan_date.eq...')` with `.eq('user_id', userId).eq('plan_date', today)`.
- Use `.upsert(planToInsert, { onConflict: 'user_id,plan_date' })`.
- Check `supabase.auth.getSession()` before requesting `user_settings` in browser.
- Log full error JSON `JSON.stringify(error, null, 2)` when database errors occur.

### [MODIFY] `app/api/daily-meal-plan/route.ts`
- Align table upsert to `user_daily_meal_plans`:
  `{ user_id: userId, plan_date: todayIso, plan_data: responsePayload, total_target_calories: calorieGoal, updated_at: new Date().toISOString() }`
  with `onConflict: 'user_id,plan_date'`.

### [MODIFY] `lib/api/settings.ts`
- Validate `userId` format and check active browser session before querying `user_settings` to eliminate 401 Unauthorized console errors.

---

## 3. Verification Plan
1. **Typecheck**: Run `npm.cmd run typecheck` (0 errors).
2. **Localhost Testing**:
   - Open `http://localhost:3000/cookbook` and `http://localhost:3000/dashboard`.
   - Verify browser console: zero `401 Unauthorized` for `user_settings` and zero `400 Bad Request / column date does not exist` for `user_daily_meal_plans`.
   - Verify today's meal plan is fetched and cached seamlessly.
