# Implementation Plan: Production AI Meal Recommendation Engine Architecture

## 1. Objective
Replace all static/vague meal placeholders with the **5-Layer Meal Recommendation Engine** designed by the user, ensuring:
1. **Rich, Non-Vague Culinary Intelligence**: Every meal candidate includes exact ingredient measurements (grams/units), detailed cooking steps, clinical nutritional justifications, prep/cook timing, and local market relevance.
2. **Strict Elimination of Duplicate Cards & Images**:
   - Zero duplicate meal names across the 12 options in any category.
   - Zero shared image URLs across cards on the same screen (each card is guaranteed a unique, authentic high-res food image).
3. **Database-Enforced Exclusion & Repetition Engine**:
   - Ingests user history from `daily_meal_served` (meals shown in the last 7 days).
   - Hard-excludes previously `SHOWN` dishes across 7 days unless they are in the user's `FAVORITES` pool.
   - Separate lifecycle states: `SHOWN` $\neq$ `EATEN`.
4. **Canonical Database Identity (PostgreSQL UUID)**:
   - Every candidate is assigned an RFC4122 UUID and persisted into `recipes` and `cached_recipes`.
   - All client interactions (`FavoriteButton`, `RecipeDetails`, `logMealAsEaten`) operate on canonical database UUIDs.
5. **Diversity & Macro Allocation Layer**:
   - Proportional calorie & macro targets per category (Breakfast 20%, Lunch 30%, Dinner 25%, Snacks 10%, Drinks 5%, Desserts 10%).
   - 12 distinct archetypes per category (High-Protein, Local Traditional, Quick Prep, Fiber-Dense, Seafood/Omega-3, Plant-Based, Broth/Soup, etc.).

---

## 2. Architectural Layers

### Layer 1: Context & Exclusion Ingestion
- Reads `onboarding_responses`, `user_profiles.location_metadata`, `user_settings`.
- Queries Supabase:
  - `daily_meal_served`: All `meal_title` / `meal_id` with `shown_date >= now - 7 days` $\to$ `EXCLUSION_SET`.
  - `user_recipe_interactions`: `favorited` $\to$ `FAVORITE_POOL` (eligible for weighted re-entry).

### Layer 2: Dynamic Candidate Generation & Clinical Nutrition
- For all 6 categories (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts):
  - Generates 12 specific candidates per category (72 daily options) tailored to country (e.g. Indonesia / Southeast Asia / Western), language (`id`/`en`), prep time constraints, and calorie goals.
  - Generates precise ingredient arrays with realistic weights (e.g. `150g dada ayam fillet`, `100g beras merah`, `1 sdm minyak zaitun`).
  - Generates detailed 4-5 step cooking instructions.
  - Generates "Why We Chose This For You" clinical justifications.

### Layer 3: Uniqueness & Photography Engine
- `FoodImageService`: Implements a hash-based / title-specific unique photo resolver mapping each unique dish to a distinct high-resolution Unsplash culinary photography URL.
- Guarantees that across all 72 generated recommendations, no two cards share the same image URL.

### Layer 4: Persistence & State Isolation
- Upserts all 72 recipes into `recipes` and `cached_recipes` with canonical UUIDs.
- Upserts user plan into `user_daily_meal_plans`.
- Records `status: 'SHOWN'` in `daily_meal_served` (only marking `EATEN` when the user cooks or logs the meal in their food diary).

---

## 3. Verification Plan
- Typecheck verification: `npm.cmd run typecheck` (0 errors).
- Localhost testing:
  - Verify [http://localhost:3000/cookbook](http://localhost:3000/cookbook) displays 12 completely distinct, detailed recipes per category with unique photos on every single card.
  - Verify clicking any card opens rich ingredients (with grams/amounts) and cooking instructions.
  - Verify favorite button works seamlessly on every card.
