# Implementation Plan: Canonical Recipe Provider Engine & Multi-Tier AI Orchestration Architecture

## 1. Executive Summary & Core Architecture
Establish a production-grade, single-source-of-truth recipe system where:
- **AI**: Acts strictly as the **Personalization & Orchestration Layer** (formulates search criteria, macro targets, and variety rules based on user onboarding). AI never invents recipes, calories, ingredients, or images.
- **Recipe Provider Engine**: Retrieves **real, authoritative recipe records** (from Spoonacular API & verified curated provider catalogs) with authentic dish photography, measured ingredients, step-by-step instructions, and verified nutritional macros.
- **Backend Validation Gate**: Enforces **hard deterministic safety rules** (Allergen Dictionary with derivative matching, strict category boundaries, calorie range enforcement, and collision-free image deduplication).
- **Supabase Persistence**: Stores canonical recipes in `recipes` and user meal choices in `user_daily_meal_plans` matching the verified PostgreSQL schema.
- **Frontend**: Pure consumer. **Card Image = Detail Page Image = Cooking Mode Visual** (guaranteed 100% data fidelity).

```
┌──────────────────────────────────────────────────────────────┐
│                  USER ONBOARDING / PROFILE                   │
│                                                              │
│ Allergies • Intolerances • Dislikes • Diet • Cuisine         │
│ Calories • Goals • Location • Budget • Meal Preferences      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 AI ORCHESTRATION LAYER                       │
│                                                              │
│ Reads user profile & determines query stipulations:          │
│ • Breakfast / Lunch / Dinner nutritional requirements        │
│ • Cuisine preferences & dietary targets                      │
│ • Variety rules (no repetition within 7 days)                │
│ • NEVER creates recipes or loose images                      │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 RECIPE PROVIDER ENGINE                       │
│                                                              │
│ Spoonacular API + Curated Authoritative Provider Catalog     │
│ • external_id • title • image_url • ingredients + quantities │
│ • instructions • nutrition (cal/protein/carbs/fat)           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                BACKEND VALIDATION GATE                       │
│                                                              │
│ HARD DETERMINISTIC RULES (NOT AI DECISIONS)                  │
│ ✓ AllergenDictionary derivative matching (egg, seafood, etc.)│
│ ✓ MealCategoryValidator (Strict Breakfast/Lunch/Dinner)      │
│ ✓ RecipeDeduplicator (Collision-free image & recipe IDs)     │
│ ✓ Nutrition & calorie range checks                           │
│ ✓ Completeness check (requires valid title, image, steps)    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    SUPABASE SOURCE OF TRUTH                  │
│                                                              │
│ `recipes` (id, external_id, provider, title, image_url, etc.)│
│ `user_daily_meal_plans` (user_id, plan_date, breakfast, ...) │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (REACT UI)                      │
│                                                              │
│ • Home: Breakfast, Lunch, Dinner only                        │
│ • Cookbook: Meals + Snacks + Drinks + Desserts               │
│ • Detail Page: /recipe/[id] queries exact database record    │
│ • Card Image = Detail Image = Cooking Mode Visual            │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Technical Specifications

### A. Recipe Provider Abstraction (`lib/services/recipes/`)
1. **`RecipeProvider.ts`**: Interface defining `searchRecipes(criteria)`, `getRecipeById(externalId)`, `AuthoritativeRecipe`, `MealCategory`, `Ingredient`, `Instruction`, `Nutrition`.
2. **`SpoonacularRecipeProvider.ts`**: Implements Spoonacular complexSearch & recipe information endpoints.
3. **`CuratedRecipeProvider.ts`**: Authoritative provider containing 100% verified dishes with unique photography, measured ingredients, and numbered cooking steps.
4. **`RecipeProviderService.ts`**: Multi-provider dispatcher and fallback manager.
5. **`RecipeNormalizer.ts`**: Normalizes all external/provider payloads into canonical `AuthoritativeRecipe`.
6. **`AllergenDictionary.ts` & `AllergenMatcher.ts`**: Deep allergen dictionary covering root terms and derivatives:
   - **Egg**: `egg`, `eggs`, `whole egg`, `egg white`, `egg yolk`, `mayonnaise`, `aioli`, `meringue`, `albumen`, `telur`.
   - **Seafood/Fish**: `fish`, `salmon`, `tuna`, `cod`, `tilapia`, `snapper`, `shrimp`, `prawn`, `crab`, `lobster`, `squid`, `octopus`, `calamari`, `clam`, `mussel`, `oyster`, `fish sauce`, `oyster sauce`, `terasi`, `belacan`, `ikan`, `udang`, `cumi`, `kepiting`.
   - **Dairy**: `milk`, `cheese`, `butter`, `cream`, `yogurt`, `whey`, `casein`, `susu`, `keju`.
   - **Nuts/Peanuts**: `peanut`, `almond`, `walnut`, `cashew`, `pecan`, `pistachio`, `kacang tanah`, `kacang mete`.
   - **Gluten/Wheat**: `wheat`, `barley`, `rye`, `flour`, `terigu`, `gluten`.
   - **Pork**: `pork`, `bacon`, `ham`, `lard`, `prosciutto`, `pancetta`, `babi`.
7. **`MealCategoryValidator.ts`**: Strict category validation ensuring desserts/drinks never enter breakfast/lunch/dinner slots.
8. **`RecipeDeduplicator.ts`**: Ensures 100% unique recipe IDs and distinct image URLs across the entire plan.
9. **`RecipeValidationGate.ts`**: Complete orchestrator executing all safety gates.

### B. Daily Meal Plan Orchestration (`app/api/daily-meal-plan/route.ts`)
- Ingests user profile from Supabase (`user_profiles`, `onboarding_responses`, `user_settings`).
- AI builds category-specific query parameters and macro constraints.
- Fetches candidate recipes from `RecipeProviderService`.
- Runs candidate recipes through `RecipeValidationGate`.
- Persists canonical records to `recipes` table.
- Persists category selections into `user_daily_meal_plans` using the verified schema (`user_id`, `plan_date`, `breakfast`, `lunch`, `dinner`, `snacks`, `drinks`, `desserts`, `updated_at`).

### C. Single-Source Recipe Detail Navigation (`app/api/recipe-details/route.ts`)
- Accepts `id` (UUID or external ID).
- Resolves strictly from `recipes` table, `user_daily_meal_plans`, or `RecipeProviderService.getRecipeById()`.
- Guaranteed: Detail page returns the identical recipe record with authentic dish photo, measured ingredients, and numbered cooking steps.

### D. Data Migration & Cache Cleanup (`lib/api/recipes.ts`)
- Invalidate and replace stale database rows containing duplicate image URLs or legacy placeholder IDs.
- Ensure all queries use discrete JSONB category columns without referencing non-existent `plan_data`.

---

## 3. Proposed Changes

### [NEW] `lib/services/recipes/RecipeProvider.ts`
### [NEW] `lib/services/recipes/RecipeNormalizer.ts`
### [NEW] `lib/services/recipes/AllergenDictionary.ts`
### [NEW] `lib/services/recipes/AllergenMatcher.ts`
### [NEW] `lib/services/recipes/MealCategoryValidator.ts`
### [NEW] `lib/services/recipes/RecipeDeduplicator.ts`
### [NEW] `lib/services/recipes/CuratedRecipeProvider.ts`
### [NEW] `lib/services/recipes/SpoonacularRecipeProvider.ts`
### [NEW] `lib/services/recipes/RecipeProviderService.ts`
### [MODIFY] `lib/services/RecipeValidationGate.ts`
### [MODIFY] `app/api/daily-meal-plan/route.ts`
### [MODIFY] `app/api/recipe-details/route.ts`
### [MODIFY] `lib/api/recipes.ts`
### [MODIFY] `app/_pages/Cookbook.tsx` & `components/FoodCarousel.tsx`

---

## 4. Acceptance Criteria & Verification Plan
1. **Category Separation**: Breakfast contains breakfast only; lunch contains lunch only; dinner contains dinner only. Snacks/Drinks/Desserts remain in their own collections.
2. **Allergy Block**: User with egg/seafood allergy receives 0 recipes containing egg, seafood, or their derivatives.
3. **Identity & Image Consistency**: Card photo = Detail page photo = Guided cooking visual.
4. **Collision-Free Plan**: No duplicate recipe IDs or shared image URLs across the 12 selections per category.
5. **Persistence**: 0 `PGRST204` or 400 Bad Request errors. Daily plan persists reliably in Supabase.
6. **Typecheck**: `npm.cmd run typecheck` passes with 0 errors.
