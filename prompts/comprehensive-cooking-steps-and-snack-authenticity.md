# Implementation Prompt: Comprehensive Cooking Instructions & Snack Dish/Image Authenticity

## Problem Statement
The user reported:
> "There are a few adjustments I must make. The first thing is that the steps and the instruction seem to be very short for some sections of some meals... and the steps on how to cook should be non-negotiable, and they should be realistic rather than how they are, brief, more so like just three lines, which is erratic. It should start from the beginning all the way to the end of the meal, rather than how it is right now. This is totally unacceptable.
> Another thing I've noticed is that there is no clear distinction on the meals suggested. For example, when I go to snacks, what is reflected or shown there is like a whole meal. For example, if I go to snacks, I will see brown rice, a cake with mashed avocado, some stuff like this, or I will see roasted unsalted almonds and walnuts, and yet in the image it shows rice, fish, stuff like this.
> Make sure that snacks represent snacks with appropriate images, and the steps on how to cook should be non-negotiable... And the meal search should represent the appropriate image for that meal, calories, and history of the meal, and also the instructions and the ingredients should also be accurate... Once I do that, I want you to kill the server, restart it again, provide me with the URL link for the localhost."

### Root Causes Identified
1. **Mismatched Snack Image URLs in Curated Catalog**:
   - In `CuratedRecipeProvider.ts`, snack recipes had mismatched TheMealDB image URLs:
     - `Roasted Unsalted Almonds & Walnuts` was pointing to `vwrpps1503068729.jpg` (which is **Katsu Chicken Curry** in TheMealDB—rice and breaded chicken cutlet!).
     - `Brown Rice Cakes with Mashed Avocado & Tomato` pointed to `9ya6o71780262651.jpg` (which is **Bengali Chicken Curry** in TheMealDB!).
     - `Fresh Berry & Pumpkin Seed Cup` pointed to `ysxwuq1487323065.jpg` (which is **Fish Pie** in TheMealDB!).
     - `Classic Hummus with Carrot & Cucumber Sticks` pointed to `r7mcjm1780261264.jpg` (which is **Bangladeshi Fish Curry** in TheMealDB!).
2. **Confusing Snack Concepts**:
   - The snack catalog included heavy or awkward dish titles (like brown rice cakes with avocado mash) that read like small meals instead of clear, universally recognized, light healthy snacks (hummus with crisp vegetables, roasted spiced nuts, baked pita chips, edamame pods, falafel bites, cucumber roll-ups, fruit & seed bowls).
3. **Abbreviated 3-Line Instructions**:
   - In `CuratedRecipeProvider.ts` and `TheMealDBRecipeProvider.ts`, instructions were compressed into 3 short sentences.
   - In `RecipeInstructionNormalizer.ts`, `needsCompletenessEnhancement` only checked `steps.length <= 1`, allowing 3-line summaries to pass unexpanded rather than enforcing 5–8 thorough, sequential culinary steps covering:
     1. Mise en place & ingredient preparation (washing, chopping, peeling, measuring).
     2. Seasoning, marinating, spice blooming, or batter/dip mixing.
     3. Heat management, pan/oven preheating, and searing/baking.
     4. Cooking, sautéing, boiling, or roasting with realistic temperature and timing.
     5. Simmering, sauce reduction, or texture/doneness checks.
     6. Resting, plating, and final garnish/presentation.

---

## Intended Architecture & Implementation Plan

### 1. Refactor Snack Catalog & Exact Image Alignment ([`CuratedRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts))
- Curate 18 authentic, light, practical healthy snack recipes (120–220 kcal):
  - Crispy Oven-Baked Falafel Bites
  - Classic Garlic Hummus Dip with Crisp Veggies
  - Roasted Rosemary Almonds & Walnuts
  - Steamed Sea Salt Edamame Pods
  - Baked Spiced Chickpea Crunch
  - Crispy Baked Yuca Fries with Herb Dip
  - Fresh Guacamole with Crisp Bell Pepper Scoops
  - Baba Ghanoush Roasted Eggplant Dip with Whole Wheat Crisps
  - Air-Crisped Vegetable Spring Rolls with Sweet Chili Dip
  - Crunchy Spiced Pumpkin Seeds & Sunflower Mix
  - Apple Slices with Pure Sunflower Seed Butter
  - Chilled Watermelon & Fresh Mint Cubes
  - Rolled Turkey & Cucumber Pinwheel Bites
  - Soft-Boiled Eggs with Herb Sea Salt
  - Zesty Herb Guacamole with Sliced Radish Chips
  - Crispy Baked Pita Herb Chips with Olive Oil Dip
  - Spiced Roasted Broad Beans & Edamame
  - Warm Herb-Infused Mung Bean Snack Cup
- Map each snack to an **exact matching TheMealDB CDN photograph** (e.g., Falafel to TheMealDB's verified Falafel photo `https://www.themealdb.com/images/media/meals/xrrsvt1511814969.jpg`, Baba Ghanoush to `dlmh401760524897.jpg`, Yuca Fries to `j223gc1784579841.jpg`, Spring Rolls to `grhn401765687086.jpg`, etc.).
- Ensure zero fish, zero rice curry, and zero whole dinner images appear for snacks.

### 2. Comprehensive, Sequential Cooking Instructions (Start to Finish)
- In [`CuratedRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts):
  - Expand all recipe instructions to **5 to 8 detailed, sequential cooking steps** detailing exact prep, pan/oven temperatures, cooking times, doneness cues, and plating.
- In [`RecipeInstructionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeInstructionNormalizer.ts):
  - Enhance `needsCompletenessEnhancement()` so that any recipe with fewer than 5 steps or brief sentences is expanded into a complete, sequential culinary instruction suite from preparation to presentation.
- In [`TheMealDBRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/TheMealDBRecipeProvider.ts):
  - Expand generated universal search variations (`buildUniversalHalalRecipesForQuery`) to provide 6 comprehensive, realistic culinary cooking steps from mise en place to final plating.

### 3. Clear Categorical Distinction
- In [`app/api/daily-meal-plan/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts):
  - Enforce strict category integrity gate so that snacks cannot contain main course meals (`calories <= 280`, no heavy rice/pasta mains).

### 4. Server Restart & Verification
- Terminate the running background server process on port 8080.
- Restart `next dev -p 8080` fresh as a monitored daemon.
- Run automated verification testing snack images, search results, and step counts ($\ge 5$ steps).
- Visually verify via Chrome DevTools MCP (`http://localhost:8080/cookbook`).

---

## Files to Modify
1. [`lib/services/recipes/CuratedRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts): Snack catalog overhaul, accurate TheMealDB images, and 5-8 step detailed cooking instructions.
2. [`lib/services/recipes/RecipeInstructionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeInstructionNormalizer.ts): Enforce minimum 5 detailed cooking steps across all recipes.
3. [`lib/services/recipes/TheMealDBRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/TheMealDBRecipeProvider.ts): Expand universal search variation instructions to 6 detailed steps.
4. [`lib/services/FoodImageService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/FoodImageService.ts): Align snack/appetizer photo pool strictly with authentic snack photography.
5. [`app/api/daily-meal-plan/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts): Add strict calorie/dish gate for snacks ($\le 280$ kcal, distinct from main meals).
