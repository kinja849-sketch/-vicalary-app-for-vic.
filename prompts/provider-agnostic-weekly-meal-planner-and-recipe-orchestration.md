# Implementation Plan: Provider-Agnostic Recipe Orchestration & Weekly Meal Planner Architecture

## 1. Executive Summary & Architecture
Elevate the AI engine from an ungrounded generator into an **intelligent nutrition decision & orchestration layer**, backed by authoritative structured recipe records (Spoonacular / verified catalog) where:
`1 Recipe ID = 1 Real Recipe = 1 Real Image = 1 Real Ingredient List = 1 Real Nutrition Profile`

```
┌─────────────────────────────────────────────────────────────┐
│                     1. USER PROFILE IN SUPABASE             │
│  Allergies • Dislikes • Cuisines • Target Cals • Location   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 2. AI ORCHESTRATION LAYER                   │
│  Plans optimal meal requirements & macro targets per slot   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            3. AUTHORITATIVE RECIPE PROVIDER                 │
│  Retrieves structured recipes with real photos & nutrition  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           4. HARD BACKEND SAFETY & VALIDATION               │
│  Hard Allergy Filter • Calorie Range • 7-Day History Rule   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            5. IMMUTABLE CANONICAL PERSISTENCE               │
│  Saves to `recipes` & `user_daily_meal_plans` (12 choices)  │
│  Guaranteed: Card Image = Detail Image = Cooking Mode Image │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### Pillar 1: Authoritative Recipe Data & Provider-Agnostic Interface
- Recipes retrieved or generated are anchored to structured recipe data:
  - Canonical `id` (UUID)
  - `provider` (e.g. `'spoonacular'` or `'curated'`)
  - `provider_recipe_id`
  - `title`, `image_url`, `ingredients`, `instructions`, `total_calories`, `protein_g`, `carbs_g`, `fat_g`, `cuisine_type`, `meal_type`
- Once saved to Supabase, this record is permanent and immutable.

### Pillar 2: Hard Backend Safety Gate (Pre- & Post-AI)
- Programmatic allergy filter (seafood, nuts, gluten, dairy, eggs, soy, pork) executes as a hard gate. If a candidate recipe contains a forbidden item or derivative, it is discarded immediately.
- Calorie target validation ensures each category meets its target budget.
- 7-Day history scan: previously served meals are excluded unless favorited (`❤️`).

### Pillar 3: Single-Source Detail Navigation & Cooking Mode
- `/recipe/[id]` queries strictly by `recipe.id` from `recipes` table.
- Eliminates title-based external API re-searching. The recipe card, the recipe detail view, and the interactive guided cooking mode all display the identical photo, ingredients, and instructions.

### Pillar 4: 12-Choice Multi-Category Daily Plan Generation
- Generates exactly 12 validated choices per category (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts).
- Persisted once per day with `(user_id, plan_date)` constraint. Reloading the app serves the existing plan from cache with zero re-rolling.

---

## 3. Proposed File Changes

### [MODIFY] `lib/services/RecipeValidationGate.ts`
- Implement deep pre-ranking and post-ranking validation gates.
- Enforce strict allergy, calorie, and duplicate filtering.

### [MODIFY] `lib/services/FoodImageService.ts`
- Maintain 100% collision-free verified photography map for all culinary entities.

### [MODIFY] `app/api/daily-meal-plan/route.ts`
- Integrate provider data ingestion with structured recipe persistence.
- Output diagnostic telemetry:
  `[MealEngine] recipe_id -> title -> provider_id -> image_url -> calories`

### [MODIFY] `app/api/recipe-details/route.ts`
- Strict ID lookup against `recipes` and `user_daily_meal_plans`.

---

## 4. Verification Plan
1. **Typecheck**: `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Navigate to `http://localhost:3000/cookbook`.
   - Inspect all 6 categories (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts).
   - Click any dish to open `/recipe/[id]`. Confirm image, ingredients, and instructions match the card 100%.
   - Start cooking mode. Confirm visual layer matches the dish photo.
   - Refresh the page to verify immutable daily persistence.
