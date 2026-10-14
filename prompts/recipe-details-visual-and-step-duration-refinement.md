# Implementation Prompt: Recipe Details Visuals, History, Photographic Ingredients & Step-Duration Refinement

## 1. Problem Isolation & Requirements Analysis

### A. Meal Name Blurred / Obscured by Card
- **Problem**: In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx), the title `<h1>` is placed at `bottom-6 left-6 right-6` within the `h-80` hero image container. Because `<main>` has `-mt-10` with `rounded-t-[40px] z-10`, the top curved border of the white card slides 40px up over the hero, cutting off and blurring the bottom half of the recipe name ("RICE AND BEANS").
- **Solution**: Lift the title positioning (`bottom-16` or `bottom-14` with appropriate bottom padding) so the recipe title floats fully unobstructed with clean breathing room above the card curve.

### B. "History of the Meal" Section
- **Problem**: The background section displays `WHY_THIS_MEAL` (with raw translation key fallback and underscores).
- **Solution**: 
  - Change the heading to **"History of the Meal"** (rendered in uppercase as `HISTORY OF THE MEAL`, with zero underscores or hyphens).
  - Present an authentic, factually grounded description of the historical origin, cultural background, and culinary evolution of that exact recipe (e.g. Caribbean/West African culinary heritage for Rice and Beans, Indonesian heritage for Soto/Gado-Gado, etc.).

### C. Ingredients Section: Photographic Food Visuals (Replacing Emojis) with Preserved Vertical Alignment
- **Problem**: Currently ingredients are displayed as plain text lines or generic text.
- **User Reference & Guidance**: Replicate the visual style shown in the reference image (photorealistic food photography on soft rounded card containers with a subtle `+` corner accent), but **strictly preserve the existing vertical alignment** (do NOT make it a horizontal scroll).
- **Solution**:
  - Show total ingredient count in the heading (e.g., `INGREDIENTS (6 ITEMS)`).
  - For each ingredient in the vertical list:
    - Left side: A clean, rounded square container (`size-14` / `rounded-2xl` with subtle border and soft neutral background) displaying a high-resolution, photorealistic image of the exact ingredient (derived from `https://www.themealdb.com/images/ingredients/${name}.png` with high-def culinary asset fallbacks).
    - A subtle `+` badge at the top-right of the ingredient thumbnail matching the reference image.
    - Center: The exact ingredient name (e.g., "Kidney Beans", "Coconut Milk", "Onion", "Scotch Bonnet", "Black Pepper", "Salt") in bold, readable typography.
    - Right side: The exact measurement/quantity (e.g., "1/2 bag", "1 Can", "1 Diced", "3", "1 tablespoon", "1/2 tbs").

### D. Sequential Steps Matching Stated Duration
- **Problem**: The number of steps should correspond to the total duration without compressed gaps. When a 40-minute dish has only 5 brief steps, it creates a mismatch with the duration.
- **Solution**:
  - For a 40-minute dish (like Rice and Beans), provide 8 informative, sequential, unparaphrased steps covering every phase:
    1. **Mise en place / Preparation** (5 min): Sorting/rinsing rice until clear, preparing/rinsing beans.
    2. **Aromatics** (3 min): Dicing onion, prepping fresh aromatics.
    3. **Flavor Base** (4 min): Sautéing onions in oil over medium heat until translucent and fragrant.
    4. **Liquids & Seasoning** (2 min): Pouring coconut milk and water, dissolving measured salt and black pepper.
    5. **Rice & Beans Incorporation** (2 min): Stirring in beans and rice evenly across the coconut broth.
    6. **Scotch Bonnet Aromatic Infusion** (1 min): Gently placing whole pepper on top without puncturing to impart subtle aroma without extreme heat.
    7. **Covered Low-Heat Simmer** (20 min): Bringing to a boil, then reducing heat to low, covering tight with a lid, and simmering undisturbed for 20 minutes until tender.
    8. **Rest, Fluff & Serve** (3 min): Discarding pepper, resting covered off heat for 3 minutes, then fluffing with a fork and serving hot.
    - **Total Duration**: 5 + 3 + 4 + 2 + 2 + 1 + 20 + 3 = **40 MIN** (matches the 40 MIN display!).
  - Each step displays a dedicated phase duration tag (e.g. `5 min`, `4 min`, `20 min`) so the user can easily see how the steps match the total cooking duration.

---

## 2. Architecture & File Plan

### 1. [`lib/services/IngredientImageService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/IngredientImageService.ts) (New Helper)
- Deterministically maps ingredient names to verified photorealistic ingredient PNG images (`https://www.themealdb.com/images/ingredients/...`).
- Provides clean normalized names (e.g., "Kidney Beans" $\rightarrow$ "Kidney%20Beans.png", "Coconut Milk" $\rightarrow$ "Coconut%20Milk.png", "Scotch Bonnet" $\rightarrow$ "Scotch%20Bonnet.png", "Black Pepper" $\rightarrow$ "Black%20Pepper.png", "Salt" $\rightarrow$ "Salt.png").
- Includes graceful fallback for any rare or local specialty ingredients.

### 2. [`lib/services/recipes/RecipeInstructionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeInstructionNormalizer.ts) (Updated)
- Refine step models to include `duration_minutes` for each step, ensuring $\sum \text{step durations} = \text{total\_time\_minutes}$.
- Ensure the culinary background text is rich, accurate, and reflects the authentic history of the meal.

### 3. [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx) (Updated)
- Lift title to `bottom-16` / `bottom-14` with hero padding adjustments.
- Update history card header to `{t('history_of_the_meal') || 'History of the Meal'}`.
- Update ingredients section to render photorealistic ingredient cards with `+` badges while strictly preserving vertical alignment.
- Render step duration badges on each numbered step.

### 4. [`lib/translations/en.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/en.ts) & [`lib/translations/id.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/translations/id.ts)
- Add translation key `history_of_the_meal: "History of the Meal"`.

---

## 3. Verification & Acceptance Gates
1. [x] Recipe title ("RICE AND BEANS") is 100% visible and unblurred above the white card curve.
2. [x] Section heading reads **"HISTORY OF THE MEAL"** with authentic historical description.
3. [x] Ingredients list preserves vertical alignment, shows item count, and renders photographic food visuals with `+` badge for each ingredient.
4. [x] Sequential steps have specific durations that add up to the total cooking time (40 MIN for Rice and Beans).
5. [x] Halal-only compliance and zero-hallucination of ingredients strictly maintained.
6. [x] TypeScript compiler passes with 0 errors (`npx tsc --noEmit`).
7. [x] Automated test suites pass 100%.
8. [x] Visual verification in live browser via Chrome DevTools MCP.
