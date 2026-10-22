# Implementation Prompt: Fix Meal Suggestions, Spoonacular Integration, Halal & Completeness Gates, and Onboarding Objective Alignment

## 1. Environment & Project Verification
- **Project Root**: `c:\Users\acer\Desktop\my apps\the-app-belong-to-vic--main\the-app-belong-to-vic--main`
- **Active Localhost Port**: `http://localhost:8080` (`next dev -p 8080`)

## 2. Root Causes Identified
1. **Unconfigured Spoonacular Provider & Unfiltered `.limit(200)` DB Query**:
   - `SPOONACULAR_API_KEY` was missing from `.env.local` / `.env`.
   - [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) only queried the first 200 rows of `recipes` (`.limit(200)`), which are dominated by legacy rows with empty `ingredients: []`, empty `instructions: []`, or synthetic titles (`"Balanced Nutrient Bowl Option 7"`), while skipping `SpoonacularRecipeProvider`, `cached_recipes` (85 complete Halal recipes), and complete rows further down in `recipes` (314 complete Halal recipes).
2. **Global Image-URL Deduplication Discarding Valid Meals**:
   - [lib/services/recipes/RecipeDeduplicator.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeDeduplicator.ts) rejected recipes across all 6 categories whenever an image URL had been seen once, discarding 14 dinner, 50 lunch, 8 snack, 27 drink, and 5 dessert candidates.
3. **Substring Keyword Collisions in Category Validation & Inference**:
   - [lib/services/recipes/MealCategoryValidator.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/MealCategoryValidator.ts) and [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) used `.includes()` instead of whole-word boundaries, rejecting `"Steak Tempe"` (matched `"tea"`), `"Pancake"` (matched `"cake"`), and `"Pepes Tahu"` (matched `"es "`), and classifying `"Zucchini Boats"` as breakfast (matched `"oat"`).
4. **Incomplete Snacks/Drinks/Desserts in Curated Catalog & Condensed Steps**:
   - [lib/services/recipes/CuratedRecipeProvider.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts) only had 2 snacks, 2 drinks, and 1 dessert, and several entries had only 2 condensed steps.
5. **Onboarding Dislikes & Cache Invalidation Gaps**:
   - [lib/services/ai/ContextAssembler.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts) did not surface `dislikedFoods` from `onboarding_responses`, and [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts#L47) overwrote `dislikes` with `[]` when `likedFoods` was present.
   - [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts#L570) reused cached plans from `user_daily_meal_plans` even when non-breakfast categories had fewer than 12 meals.
   - [app/_pages/Settings.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Settings.tsx#L185) invalidated `['daily-meal-plan']` instead of also invalidating `['suggestions']` used by [app/_pages/Dashboard.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx#L136).

## 3. Exact Files & Changes Planned
1. **`.env.local` & `.env`**:
   - Add `SPOONACULAR_API_KEY=200a8f3e1973415e815d8a7aa5d6c880` (server-side only; never exposed to browser).
2. **[lib/services/recipes/SpoonacularRecipeProvider.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/SpoonacularRecipeProvider.ts) & [lib/services/recipes/RecipeNormalizer.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeNormalizer.ts)**:
   - Pass `instructionsRequired=true` and `excludeIngredients=pork,bacon,ham,lard,prosciutto,pancetta,chorizo,pepperoni,salami,wine,beer,rum,brandy,vodka,whiskey,bourbon,sake,mirin,champagne,liqueur,alcohol,gelatin` to Spoonacular `complexSearch`.
   - Prefix `external_id` with `spoonacular_` consistently and remove hardcoded `400` calorie / 1-step fallback in `RecipeNormalizer.ts` so only true provider nutrition and real multi-step instructions pass.
3. **[lib/services/recipes/HalalClassifier.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/HalalClassifier.ts)**:
   - Keep zero-tolerance rejection of all pork/swine, alcohol, blood, insect, and unverified ambiguous additives (gelatin, animal rennet, lard, etc.).
   - Allow home-cooked recipes from verified recipe providers (`curated`, `halal_curated`, `internal`, `spoonacular`, `themealdb`) that pass Steps 1 & 2 (zero haram or ambiguous ingredients) so clean poultry/beef/lamb dishes cooked by the user with Halal meat are classified as `HALAL_VERIFIED`.
4. **[lib/services/recipes/MealCategoryValidator.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/MealCategoryValidator.ts) & [lib/services/recipes/RecipeDeduplicator.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeDeduplicator.ts)**:
   - Switch keyword checks to word-boundary regexes (`\bcake\b`, `\btea\b`, `^es\s+|\s+es\s+`, etc.).
   - Deduplicate by recipe ID and canonical dish title signature; scope image-URL deduplication per category rather than globally across all 6 categories.
5. **[lib/services/recipes/CuratedRecipeProvider.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts)**:
   - Ensure all 6 categories (`breakfast`, `lunch`, `dinner`, `snack`, `drink`, `dessert`) have at least 14 complete, Halal-verified recipes with distinct dish-accurate image URLs, verified ingredient lists with amounts/units, accurate calories/macros, and at least 4 clear step-by-step cooking instructions.
6. **[lib/services/ai/ContextAssembler.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts) & [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts)**:
   - Load `dislikedFoods` in `ContextAssembler.ts` and pass it into `checkAllergensAndDislikes` and `GoalOrientedRanker`.
   - Query `SpoonacularRecipeProvider` (guided by user's category calorie budget and allergies), `CuratedRecipeProvider`, complete rows in `recipes`, and `cached_recipes`.
   - Add a **Completeness Gate** rejecting placeholder titles (`Option \d+`) and any candidate without real ingredients ($\ge 2$) and real cooking instructions ($\ge 3$ steps).
   - Ensure every category returns 12 ranked meals tailored to the user's onboarding objective (`goal`, `dailyCalorieGoal`, `allergies`, `dislikedFoods`, `preferredCuisines`, `medicalConditions`) and persists complete recipe records to `recipes` so clicking **Cook** ([app/api/recipe-details/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/recipe-details/route.ts)) always loads the exact ingredients, calories, and cooking steps.
7. **[lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts) & [app/_pages/Settings.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Settings.tsx)**:
   - Require all 6 categories in `user_daily_meal_plans` to have 12 complete items before reusing the daily cache.
   - Invalidate `['suggestions']` in `Settings.tsx` when profile/settings change.

## 4. Verification Plan
1. Run `npm run typecheck`.
2. Call `POST http://localhost:8080/api/daily-meal-plan` and verify that all 6 categories (`breakfast`, `lunch`, `dinner`, `snacks`, `drinks`, `desserts`) return **12 Halal-verified meals**, each with `calories > 0`, `ingredients.length >= 2`, `instructions.length >= 3`, and zero placeholder titles.
3. Call `POST http://localhost:8080/api/recipe-details` for returned meals across categories to verify that the **Cook** feature receives exact ingredients, macros, and step-by-step instructions.
4. Verify in Chrome DevTools on `http://localhost:8080` (network, console, and UI state).
