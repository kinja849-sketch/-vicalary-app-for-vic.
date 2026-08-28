# Implementation Plan: AI Meal Safety Gate, Canonical Identity & Image Validation Pipeline

## 1. Objective
Transform the meal recommendation engine from a direct generator into a **Multi-Stage Validated Pipeline**:
1. **Clinical & Dietary Safety Gate**:
   - Ingest user onboarding profile: `allergies` (hard exclusion), `dietary_lifestyle`, `dietary_preference`, `restrictions`, `preferred_cuisines`, `goal`, `calorie_target`.
   - **Deep Allergy Scanner**: Deeply scans dish names, descriptions, ingredients, seasonings, and hidden derivatives (e.g. seafood allergy blocks fish, shrimp, crab, squid, clams, oyster sauce, shrimp paste/terasi, fish sauce, seafood broth).
   - **Preference vs Location Separation**: Location informs local ingredient accessibility/pricing; user preferences dictate what the user actually eats.
   - **12-Choice Replacement Loop**: If any candidate is rejected by the safety gate, the engine automatically generates and validates replacements until exactly 12 compliant dishes exist per category.
2. **Canonical Recipe Identity & Database Persistence**:
   - Generate normalized `canonical_recipe_key` (e.g. `grilled_chicken_breast_brown_rice`) to prevent duplicate dishes across different days.
   - Assign genuine RFC4122 PostgreSQL UUIDs (`crypto.randomUUID()`) to every approved dish.
   - Persist full structured recipe (name, category, description, exact ingredients with grams, step-by-step instructions, calories, macros, clinical justification, `image_status`) to `recipes` and `cached_recipes` in Supabase.
3. **Deterministic Recipe-to-Image Binding**:
   - Bind image generation/resolution directly to the approved canonical recipe data (`recipe.id`, `recipe.title`, `recipe.ingredients`, `recipe.instructions`).
   - Store resulting `image_url` in `recipes` against `recipe.id`. Never allow failed images to borrow another meal's image.
4. **Clean Frontend Rendering & Traceability**:
   - React components render `meal.image_url` directly from the database record.
   - Add structured logging: `[MealEngine] recipe_id → recipe_name → canonical_key → image_url → image_status`.

---

## 2. Architectural Blueprint

```
                      USER PROFILE
     (Allergies, Diet, Preferences, Calories, History)
                           │
                           ▼
                 CANDIDATE GENERATOR
                 (12+ Candidate Meals)
                           │
                           ▼
                 RECIPE SAFETY GATE
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
  Allergy Scan     Preference Scan      7-Day History
(Hard Exclusion)  (User Dislikes)      (Duplicate Scan)
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                   REPLACEMENT LOOP
        (Replaces rejected until 12 valid)
                           │
                           ▼
               CANONICAL UUID ASSIGNED
           (Persisted to Supabase `recipes`)
                           │
                           ▼
               DETERMINISTIC IMAGE BINDING
         (Prompt derived from exact ingredients)
                           │
                           ▼
                  FRONTEND DISPLAY
             (Reads `recipe.image_url`)
```

---

## 3. Implementation Steps

### Step 1: Create `lib/services/RecipeValidationGate.ts`
- Deep allergy dictionary covering seafood/shellfish (including oyster sauce, shrimp paste, fish sauce), nuts, dairy, gluten, eggs, soy, pork/non-halal.
- Canonical key generator `normalizeCanonicalKey(title)`.
- Candidate validation function `validateCandidate(meal, userContext, historySet)`.
- 12-item category assembler with automated replacement generation.

### Step 2: Update `app/api/daily-meal-plan/route.ts`
- Ingest user profile, onboarding responses, and 7-day history from `daily_meal_served`.
- Execute `RecipeValidationGate` across all 6 categories (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts).
- Persist approved recipes with UUIDs and `image_status: 'completed'` to `recipes` and `cached_recipes`.
- Log trace: `[MealEngine] recipe_id -> recipe_name -> canonical_key -> image_url -> image_status`.

### Step 3: Update `lib/services/FoodImageService.ts`
- Ensure culinary photography resolution maps dish titles and ingredients without violating allergy constraints.

### Step 4: Verification & Test Plan
- Run `npm.cmd run typecheck` to guarantee 0 TypeScript errors.
- Test with seafood allergy: confirm zero seafood dishes or seafood sauces appear.
- Test Favorite Heart on localhost: confirm seamless toggle with genuine PostgreSQL UUIDs.
