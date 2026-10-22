# Implementation Plan: Realistic Onboarding-Tailored Halal Meals (TheMealDB), Strict Allergy Gates, Verified Meal Images & Cookbook Search Fix

## 1. Root-Cause Diagnosis (Verified Against Live Database & Localhost)

Inspecting the live database (`onboarding_responses`, `user_daily_meal_plans`, `recipes`, `cached_recipes`) for active user `cb29ca08-585f-403a-8e32-9d8669760931` (`Najib Abdirahman`) and all 23 onboarding records revealed 5 exact root causes:

1. **Missing / Broken Meal Images (HTTP 404s & Missing Fallback Props)**:
   - 5 Unsplash image URLs in [`CuratedRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts) and [`FoodImageService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/FoodImageService.ts), plus 6 URLs in Supabase `recipes` / `cached_recipes`, return `HTTP 404` (including `photo-1596097635121-14b63b7a0c19` served in `snacks`, `photo-1546069901-d66a285109b0`, `photo-1546069901-d68a9668383e`, `photo-1596040033282-5d9c2cb48695`, `photo-1536591375315-1b8368157772`, and `http://test`).
   - In [`app/_pages/Cookbook.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Cookbook.tsx#L266-L270), `CookbookCard` renders `<MealImage src={image} alt={title} />` without a `fallbackSrc` prop, so any failing image URL immediately drops to a blank placeholder icon.

2. **Allergies & Onboarding Responses Not Fully Represented**:
   - **Multi-word & space-separated allergy strings**: Users enter space-separated allergies in onboarding such as `"peanuts seafood cheese egg whites"` (`Najib Abdirahman`) or `"Sea food cheese peanuts"` (`Sultan kin`).
     - In [`ContextAssembler.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts#L119-L130), `"Sea food"` was split by whitespace into `"Sea"` and `"food"`, neither of which matched `seafood` in `ALLERGEN_DICTIONARY`.
     - In [`AllergenDictionary.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/AllergenDictionary.ts), `seafood` was missing `'herring'`, `'herrings'`, `'sledz'`, `'haddock'`, `'pollock'`, `'sea bass'`, `'catfish'`, `'carp'`, `'sardines'`, `'kipper'`, `'whitebait'`, `'basa'`, `'grouper'`, `'flounder'`, `'sole'`, `'plaice'`, `'trout'`, etc.—which allowed `'Sledz w Oleju (Polish Herrings)'` to be served to a user with a `seafood` allergy!
     - Furthermore, `"cheese"` was not a key in `ALLERGEN_DICTIONARY` (only `"dairy"` was), so `"cheese"` did not expand to block `"cream cheese"`, `"sour cream"`, `"paneer"`, `"ricotta"`, `"mozzarella"`, `"parmesan"`, `"cheddar"`, `"feta"`, `"mascarpone"`, `"cottage cheese"`, `"queso"`, or `"rømmegrøt"`.
     - In [`lib/api/recipes.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts#L544-L546), the client-side cache check did `[String(onboarding.allergies)]` without splitting by spaces/commas, so it checked `mealText.includes("peanuts seafood cheese egg whites")` as a single phrase and failed to invalidate violating cached plans.
   - **Category count drop under multiple allergies**: When a user is allergic to `peanuts + seafood + cheese + egg whites` simultaneously, too many curated breakfast and snack items contained eggs, nuts, cheese, or fish, causing `breakfast` to drop to `10` and `snacks` to drop to `9`.
   - **Full Onboarding Context (`dietary_preference`, `dietary_lifestyle`, `cooking_skill`, `meal_prep_time`, `medical_conditions`, multilingual `goal`)**:
     - Onboarding stores `dietary_preference` (`'High-protein'`, `'Low-carb'`, `'Keto'`, `'Vegan'`, `'Vegetarian'`), `dietary_lifestyle` (`['Halal', 'Balanced', 'Vegan', ...]`), `cooking_skill` (`'Beginner'`, `'Intermediate'`, `'Advanced'`), `meal_prep_time` (`'Less than 15 minutes'`, `'15-30 minutes'`, `'30-60 minutes'`), `medical_conditions` (`'Secondary lymphedema'`, `'Lymphedema'`, `'Acid reflux'`, `'Diabetes'`, `'Hypertension'`), and translated goal strings (`'Turunkan Berat'`, `'Pertahankan Berat'`, `'Kuongeza uzito'`).
     - [`GoalOrientedRanker.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/GoalOrientedRanker.ts) and [`app/api/daily-meal-plan/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) did not enforce hard gates for `Vegan`/`Vegetarian` preferences or score/filter for `High-protein`, `Low-carb`, `Keto`, `meal_prep_time`, `cooking_skill`, `Lymphedema` (low-sodium, anti-inflammatory lean protein), or `Acid reflux` (non-spicy, low-acid, low-fat).

3. **Unrealistic "Five-Star Restaurant" / Obscure Meals Instead of Practical Everyday Halal Meals**:
   - Users were being served obscure or gourmet-sounding dishes like `'Rømmegrøt – Norwegian Sour Cream Porridge'`, `'Sledz w Oleju (Polish Herrings)'`, `'Algerian Flafla'`, `'Tahwa Kembang Tahu Sutra Kuah Jahe Gula Aren'`, `'Handesh – Bangladeshi rice flour and date molasses cakes'`, and `'Fruit and Cream Cheese Breakfast Pastries'` (730 kcal for a Weight Loss user).
   - Instead, meal suggestions must be **realistic, everyday, home-cookable Halal meals** (in clear English titles) that directly serve the user's onboarding objective (e.g., *Rolled Oats with Banana & Chia Seeds*, *Grilled Chicken Breast with Brown Rice & Steamed Broccoli*, *Lean Beef & Vegetable Stir-Fry*, *Baked Herb White Fish with Sweet Potato*, *Chickpea & Cucumber Mediterranean Salad*, *Apple Slices with Sunflower Seed Butter*, *Fresh Mango & Spinach Green Smoothie*, *Warm Cinnamon Baked Apple Slices*), combined with practical Halal-verified **TheMealDB** dishes.

4. **Stick to TheMealDB Instead of Spoonacular**:
   - Per explicit user direction, remove `SpoonacularRecipeProvider` from the active recommendation pipeline (`app/api/daily-meal-plan/route.ts` and `RecipeProviderService.ts`) and rely exclusively on **TheMealDB** (`www.themealdb.com`) + our verified everyday Halal recipe catalog and Supabase `recipes`/`cached_recipes`.

5. **Cookbook Search Bar Wording & Search Functionality (`"oats"`)**:
   - In [`app/_pages/Cookbook.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Cookbook.tsx#L88-L94), the search input displays `placeholder={t('search_placeholder')}` (`"Search recipes, ingredients..."`). It must have **no placeholder wording at all** (`placeholder=""`).
   - Searching `"oats"` returned 0 results because [`app/api/search-recipes/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/search-recipes/route.ts#L11-L13) only called `https://www.themealdb.com/api/json/v1/1/search.php?s=oats` (which searches TheMealDB dish titles only and returns `null` for `"oats"`), never searched ingredients (`filter.php?i=oats` / `filter.php?i=rolled_oats`), never searched our Halal curated catalog or Supabase `recipes` ingredients/titles, and did not run `classifyHalal` on search results.

---

## 2. Planned Changes

### A. Switch Pipeline to TheMealDB + Practical Everyday Halal Catalog (Remove Spoonacular from Active Pipeline)
- **Files**:
  - [`lib/services/recipes/TheMealDBRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/TheMealDBRecipeProvider.ts) (new provider implementing `RecipeProvider` for TheMealDB search by name, category, and ingredient with full lookup hydration and `classifyHalal` filtering)
  - [`lib/services/recipes/RecipeProviderService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeProviderService.ts)
  - [`app/api/daily-meal-plan/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts)
- **What changes**:
  - Replace `SpoonacularRecipeProvider` usage in `app/api/daily-meal-plan/route.ts` and `RecipeProviderService.ts` with `TheMealDBRecipeProvider` and `CuratedRecipeProvider`.
  - Filter out obscure/unrealistic dishes (e.g. pickled herrings in oil, sour cream porridge, heavy cream pastries for weight loss) so only practical, everyday Halal meals are recommended.

### B. Overhaul `CuratedRecipeProvider.ts` with Practical, Everyday English Halal Meals & Allergy-Safe Depth (18+ per Category)
- **File**: [`lib/services/recipes/CuratedRecipeProvider.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts)
- **What changes**:
  - Provide clear, realistic, everyday home-cooked English meal titles, accurate calories/macros, $\ge 3\text{--}5$ simple everyday ingredients, and $4$ clear cooking steps across all 6 categories (`breakfast`, `lunch`, `dinner`, `snack`, `drink`, `dessert`).
  - Ensure every category has **at least 14+ recipes that are simultaneously free of eggs, peanuts/tree nuts, seafood/fish, and cheese/dairy** (in addition to high-protein chicken, lean beef, egg, fish, and plant-based options), so even a user allergic to `"peanuts seafood cheese egg whites"` ALWAYS receives a full **12/12** meals in every single category!
  - Replace all broken Unsplash URLs with HTTP-200-verified food photography URLs and TheMealDB meal image URLs.

### C. Fix All Broken Image URLs & Add Image Fallback Resilience
- **Files**:
  - [`lib/services/FoodImageService.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/FoodImageService.ts)
  - [`app/_pages/Cookbook.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Cookbook.tsx)
  - [`app/api/daily-meal-plan/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts)
- **What changes**:
  - Replace every broken 404 URL in `FoodImageService.ts` and `CuratedRecipeProvider.ts` with verified `200 OK` food image URLs.
  - Block known broken DB image URLs in `app/api/daily-meal-plan/route.ts` and replace them via `getFoodImageUrl(...)`.
  - Pass `fallbackSrc={getFoodImageUrl(title, item.cuisine, item.meal_type)}` into `<MealImage />` inside `CookbookCard` in `app/_pages/Cookbook.tsx`.

### D. Comprehensive Onboarding & Allergy Representation
- **Files**:
  - [`lib/services/ai/ContextAssembler.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts)
  - [`lib/services/recipes/AllergenDictionary.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/AllergenDictionary.ts)
  - [`lib/services/recipes/AllergenMatcher.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/AllergenMatcher.ts)
  - [`lib/services/recipes/GoalOrientedRanker.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/GoalOrientedRanker.ts)
  - [`lib/api/recipes.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts)
- **What changes**:
  - Parse multi-word allergies (`"sea food"` -> `"seafood"`, `"egg whites"` -> `"egg"`, `"tree nuts"` -> `"tree_nuts"`, `"peanut butter"` -> `"peanuts"`) in both `ContextAssembler.ts` and `lib/api/recipes.ts`.
  - Add `cheese` and `lactose` keys to `ALLERGEN_DICTIONARY` (covering cheese, cream cheese, sour cream, cottage cheese, ricotta, mozzarella, cheddar, parmesan, feta, paneer, cream, milk, yogurt, butter, whey) and expand `seafood`/`fish` with `herring`, `herrings`, `sledz`, `haddock`, `pollock`, `sea bass`, `catfish`, `carp`, `kipper`, `basa`, `flounder`, `sole`, `plaice`, `grouper`, `whitebait`.
  - Update `GoalOrientedRanker.ts` and `app/api/daily-meal-plan/route.ts` to represent **all** onboarding responses and ensure **every user receives a uniquely tailored meal plan**:
    - **Goal** (including multilingual values: `'Lose Weight'`/`'Turunkan Berat'`/`'Kupunguza uzito'`, `'Gain Weight'`/`'Build Muscle'`/`'Kuongeza uzito'`/`'Naikkan Berat'`, `'Maintain My Weight'`/`'Pertahankan Berat'`/`'Kudumisha uzito'`/`'ကိုယ်အလေးချိန် ထိန်းသိမ်းရန်'`): realistic per-meal calorie caps and macro targets.
    - **Dietary Preference & Lifestyle** (`High-protein`/`Tinggi protein`, `Low-carb`/`Rendah karbohidrat`, `Keto`, `Vegan`, `Vegetarian`, `Balanced`/`Seimbang`): hard filter for `Vegan`/`Vegetarian` when selected; strong macro scoring for `High-protein`, `Low-carb`, and `Keto`.
    - **Meal Prep Time & Cooking Skill** (`Less than 15 minutes`, `15-30 minutes`/`15-30 menit`/`Dakika 15-30`, `30-60 minutes`/`30-60 menit`, `Beginner`/`Pemula`, `Intermediate`/`Menengah`/`Kati`, `Advanced`/`ကျွမ်းကျင်`): prioritize recipes whose total prep+cook time and complexity match the user's stated time budget and skill level.
    - **Medical Conditions** (`Lymphedema` / `Secondary lymphedema`, `Acid reflux`, `Diabetes`, `Hypertension`): hard/soft gates and boosts for anti-inflammatory, low-sodium, non-spicy/low-acid whole foods.
    - **Per-User Differentiated Ranking & Profile Fingerprint**: Incorporate a deterministic per-user profile & date hash (`userId + onboarding fingerprint + date`) within high-scoring objective matches so that two different users never receive an identical static list, and invalidate any stale `user_daily_meal_plans` cache whenever a user's onboarding profile fingerprint changes.
    - **Wait for Auth Hydration on Frontend**: In `Dashboard.tsx` and `Cookbook.tsx`, gate the `['suggestions']` query on `enabled: !authLoading` and resolve the authenticated Supabase session on the server as a fallback so logged-in users never accidentally fetch or cache a generic `'guest'` meal plan.

### E. Cookbook Search Bar Wording Removal & Complete Search Overhaul (`"oats"`, etc.)
- **Files**:
  - [`app/_pages/Cookbook.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Cookbook.tsx)
  - [`app/api/search-recipes/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/search-recipes/route.ts)
  - [`lib/api/recipes.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts)
- **What changes**:
  - Remove the placeholder text from the search `<input>` in `app/_pages/Cookbook.tsx` (`placeholder=""`) and allow search queries of $\ge 2$ characters (`enabled: searchQuery.trim().length >= 2`).
  - Update `app/api/search-recipes/route.ts` to search across:
    1. `CuratedRecipeProvider` (matching title, ingredients, and dietary tags — e.g. `"oats"` matches all rolled oats, oatmeal, overnight oats, oat pancakes, and oat smoothie recipes).
    2. Complete Halal-verified recipes in Supabase `recipes` and `cached_recipes` (matching title, description, or ingredients).
    3. **TheMealDB** by both meal title (`search.php?s=...`, including singular/plural stems like `oats` -> `oat`) AND ingredient (`filter.php?i=...`, e.g. `oats`, `rolled_oats`), hydrating full details and enforcing `classifyHalal` (`HALAL_VERIFIED`) + user allergy checks.

---

## 3. Verification Plan
1. Run `npx.cmd tsc --noEmit` to verify zero TypeScript errors.
2. Verify via diagnostic script and Chrome DevTools MCP on `http://localhost:8080`:
   - User `cb29ca08-585f-403a-8e32-9d8669760931` (`Najib Abdirahman`, `Lose Weight`, `High-protein`, `allergies: "peanuts seafood cheese egg whites"`, `Secondary lymphedema`, `15-30 minutes`) receives **12/12** realistic, everyday Halal meals in all 6 categories (`breakfast`, `lunch`, `dinner`, `snacks`, `drinks`, `desserts`) with **zero** peanuts, seafood/fish (including herring), cheese/dairy, or eggs!
   - All 72 returned meal image URLs return `HTTP 200 OK`.
   - Cookbook search input has no placeholder text (`placeholder=""`), and searching `"oats"` returns multiple Halal-verified oat/oatmeal meals with working images, calories, ingredients, and cooking steps.
