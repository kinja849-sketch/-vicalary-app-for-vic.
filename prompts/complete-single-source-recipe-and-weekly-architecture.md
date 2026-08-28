# Implementation Plan: Complete Single-Source Recipe, Weekly Plan & Zero-Collision Architecture

## 1. System Architecture & Objectives
Implement the complete 6-phase single-source-of-truth recipe architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                 1. USER ONBOARDING & PROFILE                │
│  Allergies • Dislikes • Cuisines • Target Calories • Loc    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 2. AI ORCHESTRATION LAYER                   │
│  Plans meal themes & macro budgets (Not loose image creator)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            3. AUTHORITATIVE RECIPE FOUNDATION               │
│  Structured records: Title, Unique Photo, Ingredients,      │
│  Numbered Steps, Macros, Servings, Cuisine, Meal Type       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           4. HARD BACKEND SAFETY & VALIDATION               │
│  Hard Allergy Gate (Seafood, Nuts, Eggs, Dairy, Pork)       │
│  Disliked Foods Filter • Calorie Gate • 7-Day History Rule  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            5. CANONICAL DATABASE PERSISTENCE                │
│  Persists to `recipes` & `user_daily_meal_plans`            │
│  (Strict columns: breakfast, lunch, dinner, snacks, drinks) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 6. DUAL SURFACE PRESENTATION                │
│  • Home Suggester: Breakfast, Lunch, Dinner                 │
│  • Cookbook: Meals + Snacks + Drinks + Desserts             │
│  • Detail Page: /recipe/[id] loads the exact same record   │
│    Guaranteed: Card Image = Detail Image = Step Image       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Changes

### [MODIFY] `lib/api/recipes.ts`
- Standardize all queries and mutations to use the exact `user_daily_meal_plans` schema:
  `{ user_id, plan_date, breakfast, lunch, dinner, snacks, drinks, desserts, updated_at }`.
- Clear out stale in-memory / cached plans that contain duplicate photos or legacy placeholders.

### [MODIFY] `app/api/daily-meal-plan/route.ts`
- Ensure all 72 dishes (12 per category) have unique, verified culinary photos, complete ingredients, and step-by-step instructions.
- Enforce hard allergy filter (e.g. seafood, eggs, dairy, nuts).
- Save to `recipes` table and `user_daily_meal_plans` table using the verified PostgreSQL schema.

### [MODIFY] `app/api/recipe-details/route.ts`
- Look up recipes strictly by `recipe.id` from `recipes` and `user_daily_meal_plans`.
- Remove external API title re-searches and fallbacks that caused image and name drift.

### [MODIFY] `app/_pages/Cookbook.tsx` & `components/FoodCarousel.tsx`
- Ensure every card binds `key={meal.id}` and routes to `/recipe/[meal.id]`.
- Guarantee `<MealImage />` renders without global salad/chicken fallbacks.

---

## 3. Verification Plan
1. **Typecheck**: `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Navigate to `http://localhost:3000/cookbook` and `http://localhost:3000/dashboard`.
   - Verify 0 console errors (no `PGRST204` or 400 Bad Request).
   - Inspect cards across all categories: confirm 12 distinct dishes with unique culinary photos per category.
   - Click on any dish (e.g. Breakfast, Lunch, Dinner). Confirm that `/recipe/[id]` loads the identical dish name, photo, ingredients, and instructions.
   - Tap "Let's start cooking" to confirm cooking mode displays the authentic dish image.
   - Refresh the page to confirm that the persisted plan is served cleanly without re-rolling.
