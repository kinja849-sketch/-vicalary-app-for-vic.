# Strategic Fix Blueprint: Camera Meal Component Decomposition, Description Restoration & Protected UI Revert

## 1. Root-Cause Diagnosis ("What Went Wrong" in the Screenshot)

From inspecting the uploaded screenshot (plate of **Stewed Potatoes, Tomatoes, Onions, and White Rice**) and tracing the execution path through [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts), [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/ai/ai-fallback.ts), [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts), and [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx), four specific defects caused the observed failure:

1. **JSON Truncation on Backup Vision & Synthesis Calls (`max_tokens: 800` / `1000` with `gemini-2.5-flash`)**:
   - In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/ai/ai-fallback.ts), when OpenAI fails over to Google Gemini (`gemini-2.5-flash`), `gemini-2.5-flash` consumes internal "thinking" tokens out of `max_tokens`.
   - Because [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts) passed `max_tokens: 800` on the vision call and `max_tokens: 1000` on the paragraph synthesis call, the response was cut off mid-JSON (`finish_reason: "length"`).
   - `parseJSONSafely()` failed to parse the truncated JSON and silently returned `{}`.

2. **Silent Fallback to a Single Fake Item (`"Meal Analysis"`, `~220g`)**:
   - When `visionParsed` returned `{}`, lines 217–222 of [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts) fell back to:
     ```ts
     const mealTitle = visionParsed.meal_title || 'Meal Analysis';
     const identifiedFoods = [{ name: mealTitle, estimated_portion_g: 220, portion_description: '1 standard serving (~220g)' }];
     ```
   - Instead of listing the actual visible components on the plate (**Potatoes**, **Tomatoes**, **Onions**, **White Rice**), it created a single tile named `"Meal Analysis"` (`~220g`).
   - Similarly, because the second synthesis call also truncated, `synthesisData.meal_description` was empty and fell back to the generic one-liner `visualUncertainties` instead of the full 4–6 sentence clinical meal description.

3. **USDA API False-Positive Match on the Word `"Meal"` (`383 kcal/100g` $\times 220\text{ g} = 842.6\text{ kcal}$)**:
   - [`lib/nutrition/USDAFoodDataService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/USDAFoodDataService.ts) queried the live USDA FoodData Central API with the fallback string `"meal analysis cooked"`.
   - USDA FDC matched the word `"meal"` to dry grain/corn meal (`383 kcal/100g`), which multiplied by `220g` produced the bogus `842.6 kcal` shown on the single tile.

4. **Unwanted UI Banners & Controls Added to Protected UI Surfaces**:
   - In [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx), a yellow confirmation banner (`"Multiple items or portion range detected. Tap any food tile below to confirm or adjust its exact weight (g). [CONFIRM]"`) and tile badges/weight adjusters were added.
   - In [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx), extra UI banners were added.
   - Per the user's clarification and `AGENTS.md` Section 1 (*UI Surface Protection*), the UI must remain clean and identical to how it was initially, with all accuracy and anti-hallucination guarantees operating deterministically underneath.

---

## 2. Strategic Engineering Plan

### Phase 1: Revert Protected UI Components to Their Original Clean Design
- **Files**:
  - [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx)
  - [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx)
- **Changes**:
  - Remove the yellow `CONFIRM` banner (`requiresConfirmation`), the interactive weight-adjustment bar, and the `USDA`/`TKPI`/`Inferred` overlay badges from [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx), restoring the exact original layout, meal description section, horizontal food item tiles (image + item name + `~grams` + `kcal`), and `TOTAL` bar.
  - Revert the extra UI boxes in [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx) back to its original clean layout while keeping the non-hallucinating ingredient display when ingredients are unavailable.

### Phase 2: Eliminate AI JSON Truncation & Guarantee Multi-Component Visual Decomposition
- **Files**:
  - [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/ai/ai-fallback.ts)
  - [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts)
- **Changes**:
  - In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/ai/ai-fallback.ts):
    - Replace non-existent backup model names (`gemini-3.5-flash-lite`) with valid, fast multimodal Gemini models (`gemini-2.0-flash`, `gemini-2.5-flash`).
    - When routing to Gemini backup with `response_format: { type: 'json_object' }`, ensure `max_tokens` is at least `4096` so thinking tokens never truncate the JSON response.
  - In [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts):
    - Upgrade `parseJSONSafely` with truncated-JSON recovery and markdown code-fence stripping.
    - Increase `max_tokens` on Step 1 (vision decomposition) and Step 3 (clinical paragraph synthesis) so rich 4–6 sentence descriptions (`meal_description`, `vitamins_and_nutrition`, `recommendation`) are always generated in full.
    - Add a deterministic decomposition guard: if Step 1 ever returns an empty `foods` array, a generic title (`"Meal Analysis"`), or a single lumped stew/mixed-dish string (e.g., `"Potato and tomato stew with rice"`), automatically decompose it into its constituent visible items (e.g., **Potatoes**, **Tomatoes**, **Onions**, **White Rice**) so the horizontal food carousel always shows every item on the plate with its isolated image and accurate calories.

### Phase 3: Prevent USDA False-Positive Matches & Unobserved Tile Injection
- **Files**:
  - [`lib/nutrition/USDAFoodDataService.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/USDAFoodDataService.ts)
  - [`lib/nutrition/NutritionNormalizer.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/nutrition/NutritionNormalizer.ts)
  - [`lib/orchestration/FoodAnalysisOrchestrator.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/orchestration/FoodAnalysisOrchestrator.ts)
  - [`lib/services/FoodItemImageResolver.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/services/FoodItemImageResolver.ts)
- **Changes**:
  - Block generic non-food placeholders (`"meal analysis"`, `"meal"`, `"food"`, `"dish"`, `"plate"`) from querying USDA FDC so `"meal"` can never match dry cornmeal (`383 kcal/100g`).
  - Ensure [`lib/orchestration/FoodAnalysisOrchestrator.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/orchestration/FoodAnalysisOrchestrator.ts) preserves the exact visually identified items on the plate (`identifiedFoods`) for the UI tiles rather than replacing visible items or injecting unphotographed items into the visual tile carousel.
  - Verify [`lib/services/FoodItemImageResolver.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/services/FoodItemImageResolver.ts) resolves distinct, accurate isolated thumbnails for **Potatoes** (stewed/boiled), **Tomatoes** (stewed/raw), **Onions** (cooked/sautéed), **White Rice**, and all common meal components.

---

## 3. Verification & Acceptance Criteria
1. **UI Fidelity**: [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/MealAnalysis.tsx) and [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/ProductDetails.tsx) have zero confirmation banners or extra controls; the original description and component tile layout are completely restored.
2. **Component Highlighting & Accuracy**: Analyzing the potato, tomato, onion, and white rice meal returns the descriptive dish title, separate component tiles for **Potatoes**, **Tomatoes**, **Onions**, and **White Rice** with their isolated images and verified USDA/TKPI calories (totalling ~360–410 kcal instead of a single `"Meal Analysis"` tile with `842.6 kcal`), and full clinical paragraphs for `meal_description`, `vitamins_and_nutrition`, and `recommendation`.
3. **Zero Hallucination**: Packaged product calories, ingredients, and retail prices remain strictly sourced from verified providers (Open Food Facts / verified retail listings) without AI fabrication.
4. **Typecheck, Benchmark & Live DevTools Check**: `npx tsc --noEmit`, `npx tsx scripts/run-accuracy-benchmark.ts`, and live Chrome DevTools inspection on `http://localhost:8080` pass with zero errors.

