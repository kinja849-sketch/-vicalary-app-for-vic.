# Implementation Blueprint: Authentic Plate-Level Calorie Calculation for Cooked/Baked Meals vs. Individual Item Calculation for Clearly Separable Plate Foods

## 1. Core Architectural Principle

To preserve 100% nutritional authenticity and never distort calorie counts:

### Mode A: Cooked / Baked / Blended Dishes (`meal_composition_type: "cooked_dish"`)
- **Examples**: Cakes (Chiffon Cake, Chocolate Cake, Sponge Cake), Pancakes, Waffles, Pastries, Cooked Stews (Potato-Tomato-Onion Stew), Curries, Soups, Casseroles, Stir-Fries, Nasi Goreng, Mixed Cooked Dishes.
- **How Calories Are Calculated**:
  - Calories and macronutrients are calculated **strictly from what is visibly on the plate/table as a finished cooked dish** using authoritative USDA FoodData Central / TKPI cooked-food records and the visible cooked portion weight on the plate (e.g., USDA Sponge/Chiffon Cake `~290–320 kcal/100g` for the visible cake portion, or the USDA cooked stew + cooked rice portion on the plate)—**never** by guessing raw ingredient quantities (`2 cups flour`, `5 raw eggs`, `3/4 cup sugar`) and summing raw baking ingredients.
- **How the Items Used to Cook Are Displayed**:
  - The horizontal carousel tiles and `meal_description` clearly list and highlight the **items/ingredients used to cook or prepare that meal** (e.g., `Eggs`, `Wheat Flour`, `Cocoa Powder`, `Milk`, `Sugar`, `Vegetable Oil` for Chocolate Chiffon Cake; or `Potatoes`, `Tomatoes`, `Onions`, `White Rice` for the Potato-Tomato Stew with Rice) with their **authentic isolated food/ingredient images** (`Egg.png`, `Flour.png`, `Cocoa%20Powder.png`, `Potatoes.png`, `Tomato.png`, `Onion.png`, etc.).
  - Instead of displaying a guessed individual calorie number on each cooked-in ingredient tile, those tiles set `is_cooked_ingredient: true` (or `display_mode: "ingredient_used"`) and display **`Used in meal`** (or **`Cooked ingredient`**) in the tile footer, while the **TOTAL** bar and Nutrition section display the single, authentic USDA/TKPI calorie total of the cooked meal on the plate.

### Mode B: Clearly Separable & Countable Plate Items (`meal_composition_type: "separable_items"`)
- **Examples**: A plate clearly showing **Eggs and Salad/Lettuce**, **Boiled Eggs and Raw Tomatoes**, **Grilled Chicken Breast, Steamed Broccoli, and Sliced Cucumber**, **Steak and Asparagus**, or **Whole Fruits**.
- **How Calories Are Calculated & Displayed**:
  - Because each food item on the plate is directly visible, distinct, and countable/measurable (e.g., `2 boiled eggs`, `1 cup lettuce salad`, `2 raw tomatoes`), the system calculates each visible item's exact USDA/TKPI calories from its observed count/weight (`Eggs (2x)` → `143 kcal`, `Lettuce / Salad` → `15 kcal`) and displays the individual `kcal` on each tile, summing deterministically to the plate total.

---

## 2. Exact Files & Changes

1. **[`lib/nutrition/USDAFoodDataService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/USDAFoodDataService.ts)** & **[`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts)**:
   - Add verified USDA SR Legacy / Foundation cooked/baked dish records to `VERIFIED_USDA_REFERENCE_CATALOG` and `COMMON_FOOD_NUTRITION`:
     - **Chiffon / Sponge Cake (`fdc_id: '172686'`, `297 kcal/100g`)** and **Chocolate Cake / Chiffon Cake (`fdc_id: '172687'`, `352 kcal/100g`)**
     - **Pancakes, plain, prepared (`fdc_id: '172786'`, `227 kcal/100g`)**
     - **Waffles, plain, prepared (`fdc_id: '172800'`, `291 kcal/100g`)**
     - **Potato & Tomato Vegetable Stew (`fdc_id: '170030'`, `85 kcal/100g`)**
     - **Lettuce / Green Salad, raw (`fdc_id: '169248'`, `15 kcal/100g`)**
   - Support `is_cooked_ingredient?: boolean` on `IdentifiedFoodItem` and `NormalizedMealItemResult` so that when a meal is a `cooked_dish`, the plate's total nutrition is calculated from the visible cooked dish(es) on the plate while `normalized_items` preserves the list of items used to cook the dish with `is_cooked_ingredient: true` and their isolated images.

2. **[`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts)**:
   - Update Step 1 (`visionSystemPrompt`) to classify whether the photographed meal is:
     - `"separable_items"`: Clearly distinct, countable/separable foods on the plate (e.g., Eggs + Salad/Lettuce, Chicken Breast + Broccoli, Whole Fruits/Tomatoes). Here, return each visible food item in `foods[]` with its exact visible count (`"2x"`, `"4x"`) and portion weight for individual calorie calculation.
     - `"cooked_dish"`: A cooked, baked, or blended meal (e.g., Cake, Chiffon Cake, Pancakes, Stew, Curry, Soup, Stir-Fry) where ingredients were combined during cooking/baking. Here:
       1. Return the visible cooked dish(es) on the plate in `plate_dishes[]` (e.g., `Chocolate Chiffon Cake` on the table, or `Potato-Tomato Stew` + `Steamed White Rice` on the plate) so the **total calories are calculated strictly from what is seen on the plate**.
       2. Return the **items used to cook/bake the meal** in `cooked_ingredients[]` (e.g., `Wheat Flour`, `Eggs`, `Cocoa Powder`, `Milk`, `Sugar`, `Vegetable Oil` for the Chocolate Chiffon Cake; or `Potatoes`, `Tomatoes`, `Onions`, `White Rice` for the cooked stew) so they are displayed as the items used to prepare the meal without distorting or inflating the calorie count.
   - Update Step 3 (`synthesisPrompt`) so `meal_description` clearly states what items/ingredients were used to cook the meal while explaining the authentic calorie total of the dish on the plate.

3. **[`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx)**:
   - In the horizontal food item tile row (lines 206–244), preserve the exact card design:
     - When `item.is_cooked_ingredient` is `true` (an item used to cook/bake a `cooked_dish`), display the item's clean isolated thumbnail and name, `"Used in dish"` as its subtitle, and `"Cooked item"` in the bottom badge instead of a guessed individual calorie number.
     - When `item.is_cooked_ingredient` is `false`/`undefined` (clearly separable items on the plate like **Eggs and Salad**), display the item's count (`Eggs (2x)`), portion (`2 × 72 kcal (~100g)`), and individual `kcal` badge (`143 kcal`) as before.

---

## 3. Verification Gates
1. `npx tsc --noEmit` passes with 0 errors.
2. `npx tsx scripts/run-accuracy-benchmark.ts` passes all **306 / 306 cases (100% accuracy)**.
3. Live localhost verification (`http://localhost:8080`) on:
   - **Cooked/Baked Meal (Chocolate Chiffon Ring Cake)** → Total calories calculated strictly from the visible cake on the plate (no raw-flour/raw-sugar calorie distortion), and the carousel tiles display the items used to bake it (`Wheat Flour`, `Eggs`, `Cocoa Powder`, `Milk`, `Sugar`, `Vegetable Oil`) with their authentic isolated images and `"Cooked item"` indicator.
   - **Cooked Stew Meal (Potatoes, Tomatoes, Onions & White Rice)** → Total calories calculated strictly from the visible stew and rice on the plate (`~370–420 kcal`), while highlighting `Potatoes`, `Tomatoes`, `Onions`, and `White Rice` as the items used in the meal.
   - **Clearly Separable Plate (Eggs and Salad/Lettuce)** → Individual calories calculated and displayed for each item (`Eggs (2x)` → `143 kcal`, `Lettuce / Salad` → `15 kcal`, Total → `158 kcal`).
