# Implementation Prompt: Recipe Cooking Steps & Timing Correction

## 1. Executive Summary & Problem Isolation
- **Problem**: Certain recipes in the VicCalary platform (such as "Rice and Beans", ID `1b4d057c-c579-48b9-9a4a-f0c1dbec893f`) display an incomplete, single-paragraph instruction with an unrealistic cooking time (e.g., 15 minutes for cooking rice and dried kidney beans from scratch) and an outdated section heading "INSTRUCTIONS" instead of "STEPS".
- **Root Cause**:
  1. Supabase `recipes` table row stores `instructions` as a single string paragraph: `["Cook beans until tender, add rice, coconut milk, onion, black pepper and salt, and add enough water to just cover the ingredients. Place Scotch Bonnet peppers on top, careful not to burst them. Simmer until rice is tender. Remove pepper before serving."]`.
  2. `parseInstructions()` in `app/api/recipe-details/route.ts` only splits on newlines (`\r?\n`), so single-paragraph instructions remain a single un-numbered step.
  3. `prep_time_minutes` and `cook_time_minutes` are `null` in the database, causing the API to fall back to `15` and `0`, yielding an unrealistic total time of `15 MIN`.
  4. In `RecipeDetails.tsx`, the section heading renders `{t('instructions') || 'Instructions'}` rather than "STEPS".
  5. The AI Cooking Assistant (`/api/cooking-assistant/orchestrate`) receives this compressed 1-step array, preventing step-by-step cooking voice guidance.
- **Strict Scope Boundaries**:
  - Zero UI redesign: Keep the exact card layout, hero image, calorie/macro badges, favorite button, timer, and modal animations.
  - Halal-Only & Zero-Hallucination: No alcohol, pork, or unverified ingredients. No inventing ingredients outside the listed recipe ingredients.
  - Deterministic step normalization and time calibration.

---

## 2. Architecture & File Breakdown

### Files to Create
1. [`lib/services/recipes/RecipeInstructionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeInstructionNormalizer.ts):
   - Deterministic instruction analyzer and step expander.
   - Converts single-paragraph or fragmented instructions into authentic, sequential, numbered cooking phases (Mise en place / Preparation $\rightarrow$ Aromatics & Flavor base $\rightarrow$ Liquid & Seasoning $\rightarrow$ Main cooking / Simmering $\rightarrow$ Doneness check & Resting $\rightarrow$ Finishing & Serving).
   - Validates that every step references only the recipe's declared ingredients.
   - Calculates realistic prep, cook, and total times based on the dish type and cooking activities (e.g. 15 min prep + 35 min cook = 50 min total for Rice and Beans).
   - Provides factual, grounded culinary background/description where missing.
2. [`scripts/verify-recipe-cooking-steps.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/scripts/verify-recipe-cooking-steps.ts):
   - Comprehensive test suite verifying:
     - Sequential step completeness (>= 5 distinct steps for Rice and Beans).
     - Cooking time realistic thresholds (e.g. Rice and Beans > 30 minutes, not 15 min).
     - Halal compliance across all generated instructions.
     - Ingredient containment: no phantom ingredients introduced.
     - Section heading verification ("STEPS").
     - Multi-recipe testing across salads, soups, curries, and rice dishes.

### Files to Modify
1. [`app/api/recipe-details/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/recipe-details/route.ts):
   - Integrate `RecipeInstructionNormalizer.normalizeRecipeDetails(recipe)` for all retrieval paths (`cached_recipes`, `recipes`, `user_daily_meal_plans`, `TheMealDB`, `TheCocktailDB`).
   - Automatically persist repaired complete instructions and realistic times back to Supabase so that once normalized, data remains fast and authoritative.
2. [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
   - Update visible section heading from `{t('instructions') || 'Instructions'}` to `{t('steps') || 'Steps'}` (rendered as "STEPS" in uppercase).
   - Display prep time, cook time, and total time cleanly in cooking information cards.
   - Ensure the Brief History / Background card renders the factual origin/description.
   - Pass the verified, sequential steps into `startVoiceGuidance()` for the AI Chef.
3. [`lib/translations/en.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/en.ts) (and related translations):
   - Add translation key `steps: "Steps"`.

---

## 3. Data Flow & Sequential Logic

```
1. Client requests Recipe Details (`/recipes/[id]`)
2. `getRecipeDetails(id)` calls `POST /api/recipe-details`
3. Route retrieves raw recipe from Supabase `recipes` or `cached_recipes`
4. `RecipeInstructionNormalizer.normalizeRecipeDetails(rawRecipe)` evaluates:
   a. Are instructions compressed in a single paragraph or <= 1 step?
   b. Are prep_time / cook_time null or unrealistically low (< 20 min for rice & beans)?
   c. Is description / culinary background missing?
5. Normalizer expands steps into authentic, sequential phases:
   - Step 1: Prep & Measure (rinse rice, drain or soak beans, measure coconut milk & spices)
   - Step 2: Aromatics (dice onion, prepare garlic or thyme if listed)
   - Step 3: Flavor Base (sauté onion in pot over medium heat until translucent)
   - Step 4: Liquids & Seasonings (add coconut milk, water, salt, black pepper)
   - Step 5: Rice & Beans (stir in beans and rice, distributing evenly)
   - Step 6: Scotch Bonnet Pepper (gently rest whole pepper on top without piercing)
   - Step 7: Simmer Covered (bring to a boil, reduce to low, cover tight, simmer 25-30 min)
   - Step 8: Rest & Fluff (remove pepper, let stand covered 5 min, fluff with fork, serve)
6. Calibrate time: Prep 10 min, Cook 25-35 min -> Total 35-45 min.
7. Persist repaired recipe in Supabase for permanent consistency.
8. Frontend renders:
   - Calorie & macro badges (516 kcal, 26g P, 56g C, 11g F)
   - Cooking info: 35-45 MIN Total Time, 2 PERS Servings
   - Background card: Jamaican / Caribbean culinary history
   - Ingredients: Exact listed measurements
   - Heading: "STEPS"
   - Steps: Numbered 1 to 8 sequential steps
   - "Start Cooking" triggers Chef voice guidance through all 8 steps.
```

---

## 4. Acceptance Criteria & Verification Gates
1. [x] Section heading in RecipeDetails reads **"STEPS"** (not "INSTRUCTIONS").
2. [x] Rice and Beans recipe (`1b4d057c-c579-48b9-9a4a-f0c1dbec893f`) displays complete sequential steps from prep to finish (>= 6 steps).
3. [x] Total cooking time is realistic and consistent with cooking rice and beans (not 15 minutes).
4. [x] Every step references only the declared recipe ingredients (zero invented ingredients).
5. [x] 100% Halal-compliant (no wines, pork, or unverified additives introduced).
6. [x] Background/history card displays factually grounded origin for the recipe.
7. [x] Start Cooking / AI Chef voice guidance consumes the complete sequential steps.
8. [x] All 66 tests from previous verification suite remain passing.
9. [x] New test suite `scripts/verify-recipe-cooking-steps.ts` passes 100%.
10. [x] Verified in live browser at `http://localhost:8080/recipes/1b4d057c-c579-48b9-9a4a-f0c1dbec893f`.
