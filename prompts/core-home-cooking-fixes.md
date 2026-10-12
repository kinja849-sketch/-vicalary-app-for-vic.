# Implementation Plan: Milestone UX, Avatar Upload, Favorites Crash, Cooking Orchestration, and Recipe Details

## Objective
Fix five user-facing failures so core home and cooking flows work reliably:
1. **Milestone UX & Calendar Selection**: Scrollable modal body, bottom navbar hidden while modal is active, non-milestone days non-interactive.
2. **Avatar Upload**: Resilient server-assisted avatar upload with client-side compression, invalidation, and clear error surfacing.
3. **Favorites Navigation Crash**: Null-safety guards in Cookbook and favorites API preventing `Cannot read properties of null (reading 'internal_id')`.
4. **Cooking Orchestration**: Harden `/api/cooking-assistant/orchestrate` and `RecipeDetails.tsx` with validation, fallback session generator, and disable button when no instructions exist.
5. **Recipe Details Normalization & Hydration**: Complete ingredient/instruction/macro resolution from canonical rows, preserving full meal-plan payloads and eliminating deceptive 0g macros.

---

## Issue 1 — Milestone week modal and calendar selection

### Current Source of Truth
- [CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx)
- [MilestoneModal.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MilestoneModal.tsx)
- [BottomNavbar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/BottomNavbar.tsx)
- [analysisStore.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/store/analysisStore.ts)

### Root Cause
1. `MilestoneModal` is rendered with `z-50` while `BottomNavbar` has `z-[999]`.
2. `MilestoneModal` has `overflow-hidden` on its container with no scroll region or bottom safe-area padding.
3. `isNavbarHidden` in `useAnalysisStore` is never set to `true` when `MilestoneModal` opens.
4. `CheckpointCalendar.tsx` `handleDayClick` invokes `onEditProgress(date)` on all non-milestone, non-today days.

### Implementation Plan
- In [MilestoneModal.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MilestoneModal.tsx):
  - Convert modal dialog to a flex column layout: sticky header, scrollable body (`overflow-y-auto max-h-[75vh] flex-1 pr-1`), and sticky bottom Save action with `safe-area-bottom pb-4`.
  - Set modal overlay z-index to `z-[1000]`.
  - In a `useEffect`, set `useAnalysisStore.getState().setNavbarHidden(true)` when open, and revert to `false` on close or unmount.
- In [CheckpointCalendar.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CheckpointCalendar.tsx):
  - In `handleDayClick`, if `isMilestone`, open `MilestoneModal`; if `isToday`, call `onEditProgress(date)`; otherwise return immediately (no-op).
  - Apply `cursor-pointer active:scale-95` only to milestone days and today. Non-milestone, non-today days are visual timeline indicators with `cursor-default`.

---

## Issue 2 — Avatar upload fails (“Failed to upload avatar”)

### Current Source of Truth
- [lib/api/auth.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/auth.ts)
- [ProgressCard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProgressCard.tsx)
- [Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx)
- [Profile.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Profile.tsx)

### Root Cause
1. Supabase Storage `user-avatars` bucket currently rejects authenticated browser client uploads with RLS `403 new row violates row-level security policy`.
2. Mobile phone images (HEIC or uncompressed 8-15MB photos) fail MIME type check or exceed 5MB limit.
3. `Dashboard.tsx` hardcodes the toast error string to `'Failed to upload avatar'`, masking the underlying reason.

### Implementation Plan
- Create protected API route [app/api/user/avatar/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/user/avatar/route.ts):
  - Authenticate the request via Supabase auth cookies/headers (`supabase.auth.getUser()`).
  - Validate image data and upload to `user-avatars` bucket under `{userId}/{timestamp}.{ext}` using the server-side admin client (`service_role` key), which reliably succeeds.
  - Update `user_profiles.avatar_url` and auth metadata.
  - Return `{ success: true, avatar_url: publicUrl }`.
- In [lib/api/auth.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/auth.ts):
  - Add client-side canvas downscaling (max dimensions 1024x1024, JPEG/WEBP, ~200KB) before upload, converting any format (including HEIC where decoded) to a standard JPEG/PNG blob.
  - Dispatch to `/api/user/avatar` with fallback to direct upload.
  - Return informative error messages (file size, format, auth).
- In [Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx) and [Profile.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Profile.tsx):
  - Ensure toast error is dynamic: `error: (err: any) => err?.message || 'Failed to upload avatar'`.
  - Invalidate `['profile', user.id]` query on success.

---

## Issue 3 — Favorites navigation crash (`Cannot read properties of null (reading 'internal_id')`)

### Current Source of Truth
- [Cookbook.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Cookbook.tsx)
- [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts)

### Root Cause
1. `getFavoriteRecipes` queries `user_recipe_interactions` and maps `interaction.recipes = recipes.find(...) || null`. If a recipe ID is not found, `recipes` is `null`.
2. `Cookbook.tsx` renders `favorites.map(fav => <CookbookCard item={fav.recipes} />)`.
3. `CookbookCard` line 253 executes `const id = item.internal_id || item.id;` without checking if `item` is null, crashing the entire view.

### Implementation Plan
- In [Cookbook.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Cookbook.tsx):
  - In `CookbookCard`: add null guard `if (!item) return null;` and safe id extraction: `const id = item?.internal_id || item?.external_id || item?.id;`.
  - In the favorites list tab: filter out null recipe entries before rendering (`favorites.filter(fav => fav?.recipes != null)`), or render a clean fallback placeholder.
- In [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts):
  - In `getFavoriteRecipes`, for any interactions where `recipes` is null, attempt secondary lookup against `cached_recipes` or match by `external_id` so valid cached/external meals are recovered.

---

## Issue 4 — Start Cooking shows `orchestration_failed`

### Current Source of Truth
- [RecipeDetails.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)
- [app/api/cooking-assistant/orchestrate/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/orchestrate/route.ts)

### Root Cause
1. When a recipe has empty instructions (`recipe.instructions: []`), clicking Start Cooking calls `/api/cooking-assistant/orchestrate`.
2. The AI prompt requires exact step count match for empty instructions, which fails, or AI returns an unparseable response, or OpenAI returns an error, leading to a 500 status code.
3. `RecipeDetails.tsx` catches the failure and triggers `toast.error(t('orchestration_failed'))` without offering any non-AI step fallback.

### Implementation Plan
- In [app/api/cooking-assistant/orchestrate/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/orchestrate/route.ts):
  - Check if `recipe.instructions` is empty. If empty, return a clear 400 error indicating no instructions are available.
  - Wrap AI completion with a deterministic fallback: if the AI call fails or times out, construct a valid guided session directly from `recipe.instructions` and `recipe.ingredients`.
- In [RecipeDetails.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
  - Disable "Start Cooking" button when `isLoading` or when `!recipe?.instructions || recipe.instructions.length === 0`.
  - When disabled due to lack of instructions, display an informative tooltip/subtitle: "Instructions not available for guided cooking."
  - Normalize ingredients and instructions arrays before calling the orchestrator.
  - If orchestration API fails, fall back to stored step list in guided mode so cooking is not blocked.

---

## Issue 5 — Recipe details with no ingredients, no instructions, and zero macros

### Current Source of Truth
- [app/api/recipe-details/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/recipe-details/route.ts)
- [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts)
- [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts)
- [RecipeDetails.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)

### Root Cause
1. `app/api/daily-meal-plan/route.ts` strips `ingredients`, `instructions`, `protein_g`, `carbs_g`, `fat_g` when creating `responsePayload` and storing items in `user_daily_meal_plans`.
2. `ensureRecipesUuids` creates stub recipes in `recipes` with `ingredients: []`, `instructions: []`, and null macros.
3. In `recipes`, there are already full canonical rows for dishes like "Coq au vin" and "Bengali Chicken Curry with Potatoes", but `/api/recipe-details` hits the stub row with empty arrays.
4. `RecipeDetails.tsx` prints `0g PROT`, `0g CARB`, `0g FAT` for incomplete data even when calories are non-zero.

### Implementation Plan
- In [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts):
  - Preserve `ingredients`, `instructions`, `protein_g`, `carbs_g`, `fat_g` in `responsePayload` and in `user_daily_meal_plans`.
- In [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts):
  - In `ensureRecipesUuids`, do not overwrite existing recipes with empty arrays if the database already contains non-empty ingredients/instructions.
- In [app/api/recipe-details/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/recipe-details/route.ts):
  - If a matched recipe has empty `ingredients` or `instructions`, perform a canonical lookup in `recipes` by title where `ingredients` is populated, or check `cached_recipes` or `user_daily_meal_plans` to enrich the recipe before returning.
- In [RecipeDetails.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
  - If macro values are missing/0 while calories > 50, render `—` rather than advertising `0g`.
  - When ingredients or instructions are genuinely empty, display clear helper text and keep "Start Cooking" disabled.

---

## Verification Plan
1. **Issue 1**: On mobile viewport (`http://localhost:3000/dashboard`), tap milestone days vs regular days. Verify only milestone days open the modal. Verify bottom navbar disappears while modal is open. Verify modal body is scrollable and Save button remains accessible above home indicator.
2. **Issue 2**: Upload a photo from Dashboard ProgressCard and Profile Settings. Verify photo succeeds, persists to Supabase Storage, and updates avatar on page refresh.
3. **Issue 3**: Navigate to Cookbook -> Favorites (`/cookbook` -> Favorites tab). Verify no ErrorBoundary or crash. Verify saved recipes render properly.
4. **Issue 4**: Open recipe details with valid instructions, click Start Cooking. Verify guided cooking starts without `orchestration_failed` toast. Open an incomplete recipe, verify Start Cooking is disabled with clear guidance.
5. **Issue 5**: Open "Coq au vin" or "Bengali Chicken Curry" or meal plan items. Verify ingredients, instructions, and macros render real values instead of "0g" and "No specific ingredients listed".
