# Implementation Plan: Recipe API Provider Engine & AI Decision Orchestration

## 1. System Architecture: Clear Division of Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                 1. USER ONBOARDING & PROFILE                │
│  Allergies • Dislikes • Cuisines • Target Calories • Loc    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            2. AI AS THE BRAIN / ORCHESTRATION LAYER         │
│  • Reads user constraints & dietary requirements             │
│  • Formulates precise API query parameters & macro targets  │
│  • NEVER invents recipes, images, ingredients, or steps     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            3. AUTHORITATIVE RECIPE API PROVIDER             │
│  (Spoonacular / Structured Verified Recipe Catalog)         │
│  • Real Provider Recipe ID                                  │
│  • Real Dish Name & Authentic Culinary Image URL            │
│  • Real Ingredient List with Exact Amounts & Units          │
│  • Real Step-by-Step Numbered Cooking Directions            │
│  • Real Nutritional Profile (Calories, Protein, Carbs, Fat) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           4. HARD BACKEND SAFETY & VALIDATION LAYER         │
│  • Allergy Barrier: Hard reject (Seafood, Nuts, Eggs, Dairy)│
│  • Dislike Exclusion: Discard forbidden ingredients         │
│  • Calorie Range Verification                               │
│  • Collision-Free Guarantee: No duplicate IDs or photos     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            5. CANONICAL DATABASE PERSISTENCE                │
│  • Persists verified recipes to `recipes` table             │
│  • Persists meal choices to `user_daily_meal_plans`         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            6. 100% FAITHFUL FRONTEND CONSUMPTION            │
│  • Displays exact database records                          │
│  • Clicking a card opens `/recipe/[id]`                     │
│  • Card Image = Detail Image = Cooking Mode Visual          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Changes

### [NEW] `lib/services/RecipeProviderService.ts`
- Create a dedicated provider-agnostic service interface (`RecipeProvider`):
  - `searchRecipes(criteria: RecipeSearchCriteria): Promise<AuthoritativeRecipe[]>`
  - `getRecipeById(externalId: string): Promise<AuthoritativeRecipe | null>`
- Implement `SpoonacularRecipeProvider` connecting to Spoonacular complex search & recipe information endpoints.
- Implement structured fallback catalog providing real authenticated recipes with genuine photography and instructions.

### [MODIFY] `app/api/daily-meal-plan/route.ts`
- Convert route from an AI recipe creator to an AI orchestration layer:
  - Step 1: AI analyzes user profile & constraints, outputting query stipulations per category.
  - Step 2: Query `RecipeProviderService` to fetch real candidate recipes.
  - Step 3: Run `RecipeValidationGate` (allergen filtering, dislike exclusion, calorie budget).
  - Step 4: Persist verified recipes to `recipes` and plan to `user_daily_meal_plans`.

### [MODIFY] `app/api/recipe-details/route.ts`
- Look up recipe strictly by `recipe.id` from `recipes` table or query `RecipeProviderService.getRecipeById(external_id)`.
- Never invent recipe steps or search random stock photos.

---

## 3. Verification Plan
1. **Typecheck**: Run `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Navigate to `http://localhost:3000/cookbook`.
   - Verify all 12 dishes per category originate from authoritative recipe data with genuine culinary photos.
   - Click on any recipe card to open `/recipe/[id]`. Confirm the exact title, genuine image, measured ingredients, and numbered cooking instructions match 100%.
   - Verify that users with seafood / egg allergies receive 0 seafood or egg dishes in their plans.
