# Implementation Prompt & Engineering Blueprint: Meal Camera — Decomposed Cooked Ingredients, Informative Description, Scroll-Gated Actions, and Accurate Reference Calories

## 1. Executive Summary & Objective

In response to direct evaluation of meal camera output (specifically dishes like "Potato and Tomato Stew with White Rice"):
1. **Decompose Composite Dishes into Cooked Ingredients**: The vision pipeline must NEVER lump mixed stews, curries, or stir-fries into a single generic item name (e.g., do not output a single "Potato and tomato stew" card). It must decompose the dish into the actual constituent ingredients used to cook it (e.g., Potatoes, Tomatoes, Onions, White Rice).
2. **Accurate Calorie & Gram Derivation from Grounded Reference Tables**: Eliminate distorted calorie calculations (such as assigning 5 kcal to a whole potato & tomato dish). Each constituent item must resolve to its authentic reference density (e.g., Potatoes ~87 kcal/100g, Cooked White Rice ~130 kcal/100g, Sautéed/Stewed Onions ~40 kcal/100g, Stewed Tomatoes ~18 kcal/100g). Total calories must equal the exact sum of all components.
3. **Fluffy Cooked Bowl Image for Rice (No Raw Rice Sacks)**: Replace raw ingredient/packaging visuals (like TheMealDB's raw rice sack) with clean, authentic, isolated images of cooked foods (e.g., a clean bowl of fluffy cooked white rice, isolated onions, cut potatoes).
4. **Informative, Substantive Meal Description**: The meal description must be rich, articulate, and clinically descriptive—detailing specific visible ingredients, cooking techniques (braised, simmered, steamed), textures, and component proportions, rather than vague or rushed summaries.
5. **Scroll-Gated Action Buttons ("Log Meal" & "Health Coach")**: The bottom action buttons must NOT be permanently floating over the content. They must only become visible once the user has scrolled to the end of the section, ensuring they review the components, informative description, and nutritional breakdown before logging.
6. **Strict Protection**: Do not alter, redesign, or break any existing styling, layout, or components not requested.

---

## 2. Technical Root Causes & System Solutions

### Root Cause 1: Vision Prompt Permitted Lumping Stews
- **Current Issue**: The vision prompt had an exception stating *"Only homogenous stews or indivisible curries should be a single item."* As a result, the model treated a plate of potato-and-tomato stew with rice as just two items: `"Potato and tomato stew"` and `"White rice"`.
- **Solution**: Explicitly instruct the vision model to decompose both side dishes and composite stews into their primary culinary cooking ingredients (e.g., Potatoes, Tomatoes, Onions, Rice).

### Root Cause 2: Substring Match Inversion in Normalizer
- **Current Issue**: When `"Potato and tomato stew"` was passed, substring search matched `"tomato"` first, assigning 28g / 5 kcal to a dish containing ~150g of potatoes!
- **Solution**: 
  - Vision outputs clean canonical ingredient names: `"Potatoes"`, `"Tomatoes"`, `"Onions"`, `"White Rice"`.
  - Normalizer has explicit entries for `onions`, `potatoes`, `tomatoes`, `rice`, with exact nutrient densities per 100g.
  - Normalizer matches whole words and exact keys first, preventing substring misclassification.

### Root Cause 3: TheMealDB Raw Rice Sack Image
- **Current Issue**: `https://www.themealdb.com/images/ingredients/Rice.png` is an image of a plastic/burlap sack of uncooked rice grains.
- **Solution**: In [lib/services/FoodItemImageResolver.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/FoodItemImageResolver.ts), map `rice`, `white rice`, and `steamed rice` to a clean, isolated bowl of fluffy cooked white rice (`https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80` or `https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=300&q=80`).

### Root Cause 4: Vague / Rushed Meal Description
- **Current Issue**: `max_tokens: 520` in `route.ts` with `gpt-4o-mini` forced the model to rush and summarize in vague sentences to avoid truncation.
- **Solution**: Provide all decomposed ingredients explicitly into the synthesis prompt, increase `max_tokens` to `1000`, and instruct the model to write an articulate, detailed culinary description of each ingredient, preparation technique, textures, and proportions.

### Root Cause 5: Action Dock Permanently Pinned at Bottom
- **Current Issue**: The `footer` in [components/MealAnalysis.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MealAnalysis.tsx) was a fixed sticky dock on screen at all times.
- **Solution**: Attach a scroll listener to `<main>`. Track when the user has scrolled near the bottom (`scrollTop + clientHeight >= scrollHeight - 60` or when content is fully visible). Render the action buttons smoothly with `framer-motion` only once scrolling has sufficed.

---

## 3. Detailed File Changes & Specifications

### 1. Vision Decomposition Prompt & Synthesis Narrative: [app/api/analyze-food-image/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-food-image/route.ts)
- **Prompt Mandate**:
  ```text
  1. DECOMPOSE PLATES & COMPOSITE DISHES INTO VISIBLE COOKED INGREDIENTS:
     - DO NOT lump mixed dishes, stews, sautés, curries, or stir-fries into a single composite entry (e.g. NEVER return "Potato and tomato stew").
     - Identify and decompose the dish into the actual constituent ingredients used to prepare it:
       * E.g. for Potato and Tomato Stew with White Rice:
         - "Potatoes" (stewed/boiled potato chunks, ~140-160g)
         - "Tomatoes" (simmered tomato chunks/reduction, ~60-80g)
         - "Onions" (cooked/sautéed onions, ~30-50g)
         - "White Rice" (steamed long-grain rice, ~150-160g)
     - For each constituent item provide:
       * name: Standard food noun (e.g. "Potatoes", "Tomatoes", "Onions", "White Rice", "Chicken Breast").
       * variant_or_method: Preparation technique ("stewed", "boiled", "sautéed", "steamed", "grilled", "fried").
       * estimated_portion_g: Conservative weight in grams based on plate geometry.
       * portion_description: Clear human-readable portion (e.g. "chunky potato pieces (~150g)", "stewed tomatoes (~70g)", "cooked onions (~35g)", "1 bowl steamed rice (~160g)").

  2. INFORMATIVE MEAL DESCRIPTION:
     - Formulate a comprehensive, highly articulate culinary paragraph:
       * Name each constituent ingredient observed in the dish.
       * Describe the preparation technique (e.g. simmered in a light tomato reduction with onions, served over fluffy steamed rice).
       * Detail visible textures, aromatics, garnishes, and component balance.
       * Forbid generic or vague phrases like "evaluated relative portions".
  ```
- **Token Budget & Temperature**:
  - `gpt-4o` vision: `temperature: 0.1`, `max_tokens: 900`.
  - `synthesisPrompt`: `max_tokens: 1000` to prevent rushed or cut-off descriptions.

### 2. Nutritional Density & Food Items: [lib/nutrition/NutritionNormalizer.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/nutrition/NutritionNormalizer.ts)
- Add authoritative entries to `COMMON_FOOD_NUTRITION`:
  - `'onion'`: calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium_mg: 4
  - `'onions'`: calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, sodium_mg: 4
  - `'cooked onions'`: calories: 44, protein: 1.4, carbs: 10.2, fat: 0.2, fiber: 1.9, sugar: 4.7, sodium_mg: 5
  - `'stewed tomatoes'`: calories: 25, protein: 1.2, carbs: 5.5, fat: 0.2, fiber: 1.6, sugar: 3.5, sodium_mg: 12
  - `'stewed potatoes'`: calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8, sugar: 0.9, sodium_mg: 6
- Exact Name Matching First:
  - Exact token match against `COMMON_FOOD_NUTRITION` before fuzzy matching to prevent "Potato and tomato..." matching `tomato` instead of `potato`.
- Sum calculation:
  - Total Calories = `sum(item.calories)`.

### 3. Cooked Food Images (Fluffy Rice, Onions, Potatoes): [lib/services/FoodItemImageResolver.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/FoodItemImageResolver.ts)
- Replace dry rice sack with authentic bowl of cooked white rice:
  - `'white rice'`: `https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80` (fluffy white rice in clean bowl)
  - `'rice'`: `https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80`
  - `'steamed rice'`: `https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=300&q=80`
- Add isolated onion and potato visuals:
  - `'onion'` / `'onions'`: `https://www.themealdb.com/images/ingredients/Onion.png`
  - `'potato'` / `'potatoes'`: `https://www.themealdb.com/images/ingredients/Potatoes.png`
  - `'tomato'` / `'tomatoes'`: `https://www.themealdb.com/images/ingredients/Tomato.png`

### 4. Scroll-Gated Actions ("Log Meal" & "Health Coach"): [components/MealAnalysis.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MealAnalysis.tsx)
- Add scroll listener to `<main ref={mainRef} onScroll={handleScroll}>`:
  ```tsx
  const mainRef = useRef<HTMLElement>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);

  const handleScroll = () => {
    if (!mainRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      setHasScrolledToEnd(true);
    }
  };

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 40) {
      setHasScrolledToEnd(true);
    }
  }, []);
  ```
- Wrap the bottom action dock with `AnimatePresence` and conditional rendering on `hasScrolledToEnd`:
  - When scrolling begins at the top, the dock is hidden, leaving the screen clean and unobstructed.
  - When the user scrolls through the components, description, vitamins, and recommendations, the buttons smoothly slide up into view.

---

## 4. Acceptance Criteria & Test Scenarios

1. **Constituent Decomposition for "Potato and Tomato Stew with White Rice"**:
   - The dish is decomposed into:
     - Potatoes (~150g, ~131 kcal, isolated potato image)
     - Tomatoes (~70g, ~13 kcal, isolated tomato image)
     - Onions (~40g, ~16 kcal, isolated onion image)
     - White Rice (~160g, ~208 kcal, fluffy cooked rice bowl image)
   - Total Sum = ~368 kcal (accurately derived, no hallucinated or 5 kcal errors).
2. **Authentic Cooked Images**:
   - White rice displays a clean bowl of fluffy cooked white rice—NOT a burlap or plastic grocery sack of raw rice.
3. **Informative Description**:
   - The meal description explicitly identifies the potatoes, tomatoes, onions, and rice, explaining the simmered preparation technique, aromatics, and nutritional texture.
4. **Scroll-Gated Buttons**:
   - On initial page render, "Log Meal" and "Health Coach" are hidden.
   - When the user scrolls through the meal analysis content to the bottom, the buttons smoothly appear.
5. **Quality & Zero Regressions**:
   - `npx tsc --noEmit` passes with 0 errors.
   - Visual verification via Chrome DevTools at `http://localhost:8080`.
