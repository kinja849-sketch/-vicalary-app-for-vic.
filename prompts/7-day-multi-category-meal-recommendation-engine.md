# Implementation Plan: 7-Day Multi-Category Meal Recommendation Engine

## 1. Objective & Requirements
Build a production-grade **5-Layer Meal Recommendation Engine** for VICALARY that delivers:
1. **6 Categories × 12 Selectable Choices per Day** (72 tailored options/day across Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts).
2. **7-Day Dynamic Meal Plan Generation**:
   - Progressive generation of daily meal plans with instant 72-item daily delivery.
   - Distinct variety archetypes per category (Local Authentic, High-Protein, Quick Prep, Budget-Friendly, Plant-based, Comfort Soup, etc.).
3. **Repetition Management & State Isolation**:
   - Strict separation between `SHOWN`, `SELECTED`, and `EATEN` states in `daily_meal_served` / `meal_history`.
   - Never repeat a previously `SHOWN` meal across 7 days unless it has been explicitly ❤️ Favorited.
   - Favorites have a weighted re-entry algorithm preventing daily spamming.
4. **Structured Recipe Schema & Verified Imagery**:
   - Every single recommendation includes full structured data: `id`, `name`, `category`, `clinical_justification` ("Why this meal?"), `calories`, `macros` (protein, carbs, fat), `ingredients` with exact measurements, `preparation` steps, `prep_time_minutes`, `cook_time_minutes`, `difficulty`, `estimated_cost`, `currency`, `cuisine`, and exact dish photography (`getFoodImageUrl`).
   - Auto-saved to Supabase `recipes` & `cached_recipes` so every clicked card opens a complete rich recipe view.
5. **Dynamic Calorie Budget Allocation**:
   - Proportional macro & calorie allocation based on user's target (e.g. 2,000 kcal: Breakfast 400, Lunch 550, Dinner 550, Snacks 200, Drinks 100, Desserts 200).

---

## 2. Architecture & File Structure

### Layer 1: User Context & Biometrics
- Ingests `onboarding_responses` (`goal`, `dietary_lifestyle`, `dietary_preference`, `allergies`, `restrictions`, `preferred_cuisines`, `meal_prep_time`, `daily_calorie_goal`).
- Ingests `user_profiles.location_metadata` and `user_settings` (`timezone`, `currency`, `language`).

### Layer 2: Meal Candidate Engine (`app/api/daily-meal-plan/route.ts`)
- Computes target calorie distribution per category.
- Checks `daily_meal_served` for meals shown within the last 7 days and `user_recipe_interactions` for favorited items.
- Generates 12 curated, distinct culinary dishes per category tailored to location, language, and prep time constraints.
- Attaches structured `clinical_justification` explaining why the meal supports the user's goal.

### Layer 3: Persistence & Cache Layer (`app/api/daily-meal-plan/route.ts` & Supabase)
- Persists all 72 items per day into `cached_recipes` and `recipes`.
- Saves the daily plan into `user_daily_meal_plans`.
- Records `SHOWN` events in `daily_meal_served` without erroneously claiming the meal was `EATEN`.

### Layer 4: Client Interaction & Recipe Display (`lib/api/recipes.ts`, `app/_pages/Cookbook.tsx`, `app/_pages/Dashboard.tsx`)
- `Dashboard.tsx`: Displays the 12 items for the current meal session with swipeable cards.
- `Cookbook.tsx`: Provides the 6 category tabs with all 12 options per category, search, favorites, and detailed recipe viewing.
- "Why This Meal?" badge highlighting clinical benefit.

---

## 3. Verification Plan
- Automated compilation check: `npm.cmd run typecheck` (0 errors).
- Verify `/api/daily-meal-plan` returns 12 distinct items for all 6 categories (72 items total).
- Verify opening any recipe card renders complete ingredients, instructions, and macro breakdown.
- Verify favorited meals are stored in `user_recipe_interactions` and eligible for re-entry.
