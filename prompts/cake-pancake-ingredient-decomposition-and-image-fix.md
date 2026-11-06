# Implementation Blueprint: Universal Culinary Component Measurement, Per-Unit API Calorie Calculation & Authentic Thumbnail Resolution Across Every Photographed Meal

## 1. Core Objective & Universal Application Purpose

Whenever a user takes or uploads a photograph of **any meal** in VicCalary—whether it is:
1. **A plate with countable whole items** (e.g., 4 boiled/fried eggs, 3 tomatoes, 2 chicken breasts, 4 pancakes, 2 slices of toast),
2. **A cooked multi-component dish or stew** (e.g., stewed potatoes, tomatoes, onions, and steamed white rice; nasi goreng; chicken curry), or
3. **A baked or batter-based culinary creation on the table** (e.g., 1 whole round chocolate chiffon cake, a stack of 4 pancakes, waffles, muffins, brownies, pastries, bread, pizza),

the system must **never** return a vague monolithic tile or a guessed calorie number, and must **never** show an unrelated fallback image (such as a bowl of white rice). Instead, for **every meal photographed**, the system must:

1. **Break the Meal Down into Its Real Culinary Components with Concrete Culinary Measurements**:
   - **Directly Countable Items (`Nx`)**: When items are clearly countable (e.g., `4 eggs`, `2 tomatoes`, `3 sausages`), explicitly state the count (`Eggs (4x)`), the per-unit calorie value from the authenticated API, and the total (`4 × 72 kcal (~200g)` → **`286 kcal`**).
   - **Cup / Tablespoon / Piece Measured Components (Scaled to Observed Dish Size)**: When the meal is a round cake, a stack of pancakes, or a cooked dish, measure each component realistically based on the observed quantity on the table:
     - Example — **1 Whole Round Chocolate Chiffon Cake (`~750–850g` baked)**:
       - `Wheat Flour (2 cups)` — `2 cups (~240g)` → **`874 kcal`** (USDA FDC `#169761`: `364 kcal/100g`)
       - `Eggs (5x)` — `5 × 72 kcal (~250g)` → **`358 kcal`** (USDA FDC `#171287`: `143 kcal/100g`, `50g/egg`)
       - `Sugar (3/4 cup)` — `3/4 cup (~150g)` → **`581 kcal`** (USDA FDC `#169655`: `387 kcal/100g`)
       - `Vegetable Oil (1/3 cup)` — `1/3 cup (~75g)` → **`663 kcal`** (USDA FDC `#172336`: `884 kcal/100g`)
       - `Cocoa Powder (1/3 cup)` — `1/3 cup (~30g)` → **`68 kcal`** (USDA FDC `#169593`: `228 kcal/100g`)
       - `Whole Milk (1/2 cup)` — `1/2 cup (~120g)` → **`73 kcal`** (USDA FDC `#171265`: `61 kcal/100g`)
     - Example — **4 Pancakes on a Plate**:
       - `Wheat Flour (1 cup)` — `1 cup (~120g)` → **`437 kcal`** (USDA FDC `#169761`)
       - `Eggs (1x)` — `1 × 72 kcal (~50g)` → **`72 kcal`** (USDA FDC `#171287`)
       - `Whole Milk (3/4 cup)` — `3/4 cup (~180g)` → **`110 kcal`** (USDA FDC `#171265`)
       - `Butter (2 tbsp)` — `2 tbsp (~28g)` → **`201 kcal`** (USDA FDC `#173410`: `717 kcal/100g`)
       - `Sugar (1 tbsp)` — `1 tbsp (~12g)` → **`46 kcal`** (USDA FDC `#169655`)
     - Example — **Plate with 4 Eggs, 2 Whole Tomatoes, Potatoes & White Rice**:
       - `Eggs (4x)` — `4 × 72 kcal (~200g)` → **`286 kcal`** (USDA FDC `#171287`)
       - `Tomatoes (2x)` — `2 × 22 kcal (~240g)` → **`43 kcal`** (USDA FDC `#170457`: `18 kcal/100g`, `120g/tomato`)
       - `Potatoes (1 cup)` — `1 cup chunks (~150g)` → **`131 kcal`** (USDA FDC `#170030`: `87 kcal/100g`)
       - `White Rice (1 cup)` — `1 cup cooked (~158g)` → **`205 kcal`** (USDA FDC `#168878`: `130 kcal/100g`)

2. **Derive Every Component's Calories Deterministically from Authenticated APIs (USDA FoodData Central v1 & TKPI)**:
   - Every single item in `foods[]` is resolved against `USDAFoodDataService` (`/fdc/v1/foods/search` + verified USDA Foundation/SR Legacy catalog) or `TKPIDatasetService` to obtain its authoritative `per_100g` nutrient profile.
   - `DeterministicCalculationEngine` computes:
     - `unit_calories = round((calories_per_100g * unit_weight_g) / 100)`
     - `total_component_calories = round((calories_per_100g * total_portion_g) / 100)`
     - `meal_total_calories = sum(total_component_calories)`
   - Zero AI hallucination of calorie numbers is permitted.

3. **Display Explicit Per-Unit / Household Measure Math on Each Tile & in the Clinical Description**:
   - In [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts):
     - When `numeric_count > 1` (e.g., `4x` eggs, `2x` tomatoes, `3x` sausages), automatically format `portion_description` to show the exact unit math:
       `4 × 72 kcal (~200g)` (so the user immediately sees the count, calories per unit, total grams, and total calories on the tile!).
     - When a household culinary measure is used (`1 cup`, `2 cups`, `1/2 cup`, `2 tbsp`), format `portion_description` clearly as:
       `2 cups (~240g)` or `2 tbsp (~28g)`.
   - In [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts):
     - Instruct Step 3 (`synthesisPrompt`) to explicitly cite the component measurements, unit counts (`e.g. 4 eggs × 72 kcal = 286 kcal`, `2 cups wheat flour = 874 kcal`), and authenticated USDA/TKPI totals in `meal_description` and `vitamins_and_nutrition`.

4. **Guarantee Authentic, Isolated Food Thumbnails (Eliminate the White-Rice Fallback Bug)**:
   - In [`lib/services/FoodItemImageResolver.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/services/FoodItemImageResolver.ts):
     - Map all culinary components, whole foods, cooked items, and baking building blocks (`Wheat Flour`, `Eggs`, `Sugar`, `Cocoa Powder`, `Chocolate`, `Butter`, `Vegetable Oil`, `Milk`, `Cheese`, `Cream`, `Honey`, `Potatoes`, `Tomatoes`, `Onions`, `White Rice`, `Chicken`, `Beef`, `Fish`, `Tofu`, `Tempeh`, `Bread`, `Fruits`, `Vegetables`) to verified, working isolated images.
     - Remove the blind `${cap}.png` guess that generated 404 URLs like `Chiffon.png`.
     - Remove the hardcoded bowl-of-white-rice fallback URL from both [`lib/services/FoodItemImageResolver.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/services/FoodItemImageResolver.ts) and [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx).

---

## 2. Exact Files to Modify (Scoped & Isolated)

1. **[`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts)**:
   - Upgrade `visionSystemPrompt` so the vision model universally breaks down **every photographed meal**:
     - Multi-item plates & stews → separate each visible food item with exact counts (`count: "4x"`, `"2x"`) or culinary cup/piece measures (`count: "1 cup"`, `"1.5 cups"`) and realistic gram weights.
     - Composite baked/griddled/dough meals (whole cake, sliced cake, N pancakes, waffles, muffins, brownies, cookies, pastries, pizza, burger) → break down into the **actual culinary building blocks scaled to the visible quantity on the table** (e.g., `Wheat Flour` in cups, `Eggs` in count `Nx`, `Sugar` in cups/tbsp, `Butter` or `Vegetable Oil` in cup/tbsp, `Milk` in cups, `Cocoa Powder` / `Chocolate` / toppings in cups/tbsp/grams).
   - Upgrade [`ensureGranularFoodDecomposition`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts#L118-L172) to deterministically scale and decompose any monolithic baked/griddled dish (whole cake vs cake slice vs N pancakes/waffles) AND preserve all savory plate component extraction rules.
   - Update `synthesisPrompt` so the clinical narrative explicitly states the per-item unit math (`e.g. 4 eggs at ~72 kcal each = 286 kcal; 2 cups of wheat flour (~240g) = 874 kcal`).

2. **[`lib/nutrition/USDAFoodDataService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/USDAFoodDataService.ts)**:
   - Add verified USDA Foundation / SR Legacy records to `VERIFIED_USDA_REFERENCE_CATALOG` for:
     - `Wheat Flour` (`fdc_id: '169761'`, `364 kcal/100g`, `default_unit_weight_g: 120` for 1 cup)
     - `Sugar` (`fdc_id: '169655'`, `387 kcal/100g`, `default_unit_weight_g: 200` for 1 cup)
     - `Cocoa Powder` (`fdc_id: '169593'`, `228 kcal/100g`, `default_unit_weight_g: 85` for 1 cup)
     - `Butter` (`fdc_id: '173410'`, `717 kcal/100g`, `default_unit_weight_g: 14` for 1 tbsp)
     - `Vegetable Oil` (`fdc_id: '172336'`, `884 kcal/100g`, `default_unit_weight_g: 14` for 1 tbsp)
     - `Whole Milk` (`fdc_id: '171265'`, `61 kcal/100g`, `default_unit_weight_g: 240` for 1 cup)
     - `Chocolate` (`fdc_id: '170272'`, `546 kcal/100g`, `default_unit_weight_g: 45`)
     - `Honey` (`fdc_id: '169640'`, `304 kcal/100g`, `default_unit_weight_g: 21` for 1 tbsp)
     - `Cheese / Cheddar` (`fdc_id: '173414'`, `403 kcal/100g`, `default_unit_weight_g: 28` for 1 slice/oz)

3. **[`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts)**:
   - Add corresponding entries in `COMMON_FOOD_NUTRITION`.
   - Enhance portion & count resolution so:
     - Household culinary measures (`"2 cups"`, `"1/2 cup"`, `"3/4 cup"`, `"1/3 cup"`, `"2 tbsp"`) are preserved in `displayCount` and `portion_description` (e.g., `2 cups (~240g)`).
     - Multi-count items (`parsedCount > 1` for discrete items like eggs, tomatoes, sausages, chicken pieces) display explicit per-unit calorie math in `portion_description`: e.g., `4 × 72 kcal (~200g)`.
     - Single discrete items (`1 whole tomato`, `1 egg`) display their authentic unit weight and USDA calorie value (e.g., `1 medium (~120g)` → `21.6 kcal` for 1 raw tomato; `1 large (~50g)` → `71.5 kcal` for 1 boiled egg).

4. **[`lib/services/FoodItemImageResolver.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/services/FoodItemImageResolver.ts)** & **[`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx)**:
   - Add complete, verified ingredient & food thumbnail mappings in `KNOWN_FOOD_ITEM_IMAGES`.
   - Replace blind TheMealDB URL guessing with a verified TheMealDB ingredient whitelist.
   - Replace the hardcoded bowl-of-white-rice fallback in `FoodItemImageResolver.ts` and `MealAnalysis.tsx` so no failed or unknown item ever displays a bowl of white rice.

---

## 3. Verification Criteria
- `npx tsc --noEmit` passes with 0 errors.
- `npx tsx scripts/run-accuracy-benchmark.ts` passes all **306 / 306 cases (100% accuracy)**.
- Live localhost verification (`http://localhost:8080`) on:
  1. **The uploaded Chocolate Chiffon Ring Cake (`media_1793942041728_7c723194.jpg`)** → returns individual culinary building-block tiles (`Wheat Flour`, `Eggs`, `Sugar`, `Vegetable Oil`, `Cocoa Powder`, `Whole Milk`) measured in cups / egg count based on 1 whole round cake, each with its exact USDA calorie calculation and authentic isolated thumbnail.
  2. **The uploaded Potato, Tomato, Onion & White Rice dish (`media_1793870187858_b429d6fb.jpg`)** → continues to return separate `White Rice`, `Potatoes`, `Tomatoes`, and `Onions` tiles with zero regression.
