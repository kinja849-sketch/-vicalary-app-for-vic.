# Implementation Prompt: Halal-Only, Onboarding-Personalized, Goal-Oriented Meal Suggestions

## 1. Executive Summary
This document specifies the exact implementation plan for auditing, correcting, and enhancing the meal suggestion system in VicCalary. This is a targeted correction to data selection, eligibility filtering, personalization, nutritional validation, and ranking behavior. The existing UI, carousel animations, card designs, database schemas, and surrounding features remain 100% intact.

---

## 2. Source of Truth & Architecture Alignment
Following the [AGENTS.md](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/AGENTS.md) operating contract:
- **Authority Order**:
  `Authenticated User -> Onboarding/Profile -> Authoritative Providers & Curated Halal Catalog -> Deterministic Validation/Calculation (Halal + Allergy + Category) -> Supabase Canonical Persistence -> Goal-Oriented Nutritional Ranking -> Frontend Faithful Rendering`
- **Zero-Hallucination Policy**:
  - No fabricated nutrition values (eliminating any `numId % 60` or arbitrary 350 kcal / 20g protein defaults).
  - No synthetic fallback meals bypassing the validation gate.
  - Barcode & product identity rules apply equally to recipe ingredients.
- **UI Surface Protection**:
  [components/FoodCarousel.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/FoodCarousel.tsx) visual structure, card dimensions, deck transforms, navigation buttons, and CSS are completely preserved.

---

## 3. Root Cause Analysis of Current Deficiencies
1. **Missing Deterministic Halal Gate**:
   [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) previously called [lib/services/RecipeProviderService.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/RecipeProviderService.ts) which fetched external recipes from TheMealDB and TheCocktailDB (including ordinary drinks with alcohol and meat recipes with unverified slaughter) without halal classification.
2. **Fabricated Nutritional Data**:
   TheMealDB provider in [RecipeProviderService.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/RecipeProviderService.ts) fabricated calories using `(numId % 60) - 30` and pseudo-random macros.
3. **Ignored Onboarding Profile Fields**:
   [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) only read `allergies` and `dietary_preference`. It completely ignored `goal` (Lose Weight, Gain Muscle, Maintain Weight), `target`, `daily_calorie_goal`, `restrictions`, `liked_foods`, `preferred_cuisines`, and health conditions.
4. **Hardcoded AI Prompt Constraints**:
   A static prompt hardcoded `breakfast: 400 cal`, `lunch: Chicken 600 cal`, `dinner: Seafood 500 cal` rather than tailoring to the user's actual TDEE / goal calorie target.
5. **Cache Staleness & Failure to Revalidate**:
   [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts) returned cached `user_daily_meal_plans` records without revalidating against updated onboarding constraints.
6. **Hardcoded Unverified Fallback Carousel Cards**:
   [components/FoodCarousel.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/FoodCarousel.tsx) had a `DEFAULT_MEALS` array that bypassed validation and defaulted calories to `350`.

---

## 4. Proposed Technical Solution & Pipeline Sequence

The recommendation pipeline will enforce the strict sequence required by Section 3 of the directive:

```
1. Authenticated User Profile Retrieval
   └── Fetch user_profiles & onboarding_responses via loadUserProfileContext()
       (Extract goal, daily_calorie_goal, allergies, dislikes, restrictions, cuisines, health conditions)

2. Candidate Recipe Retrieval
   └── Pull candidates from CuratedRecipeProvider (enriched 100% Halal catalog) & Supabase recipes table

3. Deterministic Halal Eligibility Gate (HalalClassifier)
   ├── Inspect recipe title, ingredients, notes, and sourcing
   ├── Classify: HALAL_VERIFIED | HARAM_DETECTED | HALAL_UNVERIFIED
   └── Exclude all HARAM_DETECTED and HALAL_UNVERIFIED candidates

4. Clinical Safety & Onboarding Restriction Gate (RecipeValidationGate & AllergenMatcher)
   ├── Strict exclusion of declared allergies & intolerances (English + Indonesian synonyms)
   ├── Strict exclusion of user-disliked ingredients
   ├── Strict health condition checks (diabetic low-sugar, hypertension low-sodium)
   └── Strict Meal Category Validation (MealCategoryValidator: prevent desserts/drinks in main meals)

5. Nutrition Validation
   └── Verify calories, protein, carbs, fat from authoritative recipe data. Exclude recipes missing nutrition.

6. Goal-Oriented Nutritional Ranking (GoalOrientedRanker)
   ├── Weight Reduction: Score higher for calorie deficit fit, protein/fiber density, lower caloric density
   ├── Muscle Gain: Score higher for high protein content (>= 30g) and caloric sufficiency
   ├── Weight Maintenance: Score higher for balanced macronutrient split and calorie goal match
   ├── General Health: Score higher for whole foods, micronutrient variety, and dietary fiber
   └── Preference & Favorite Boost: Apply affinity boost for user preferred cuisines and favorited meals

7. Deduplication & Interaction Memory
   └── Enforce 7-day rotation (daily_meal_served) and semantic signature deduplication

8. Persistence & Faithful Rendering
   ├── Cache in user_daily_meal_plans with user constraint signature
   └── Supply faithful data to unchanged FoodCarousel
```

---

## 5. Detailed Component Specifications

### 5.1 New Service: Halal Classifier
**File**: [lib/services/recipes/HalalClassifier.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/HalalClassifier.ts)
- **Classifications**:
  - `HARAM_DETECTED`:
    - Swine / pork: pork, bacon, ham, lard, pork belly, pork chop, pork ribs, pork sausage, prosciutto, pancetta, guanciale, chorizo, pepperoni, speck, chicharron, babi, daging babi, minyak babi, porcine.
    - Alcohol / cooking alcohol: wine, red wine, white wine, champagne, sherry, marsala, vermouth, beer, ale, cider, stout, liquor, spirits, rum, brandy, cognac, vodka, gin, whiskey, bourbon, liqueur, cooking wine, shaoxing wine, mirin (with alcohol), sake, alcoholic marinades. (Enforcing: cooking heat evaporating alcohol is non-halal).
    - Blood: blood, blood sausage, black pudding, morcilla, blood pudding, blood tofu.
    - Haram additives: cochineal / carmine / E120.
  - `HALAL_UNVERIFIED`:
    - Meat (chicken, beef, lamb, mutton, goat, turkey, duck) from unverified external catalogs without certified halal slaughter/sourcing.
    - Ambiguous animal additives: unspecified gelatin, animal rennet, animal tallow, meat stock / bone broth of unverified slaughter, animal-derived emulsifiers.
  - `HALAL_VERIFIED`:
    - Pure plant-based / vegan / vegetarian / egg / dairy (free of non-halal animal rennet) / fish & seafood dishes with zero alcohol and zero haram additives.
    - Curated Halal collection dishes where meat sourcing is verified halal (Indonesian, Middle Eastern, halal-certified poultry/beef).
- **Rule**: Only `HALAL_VERIFIED` candidates are admitted into the recommendation pool.

### 5.2 Enriched Curated Halal Catalog
**File**: [lib/services/recipes/CuratedRecipeProvider.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts)
- Expand curated catalog to contain a rich, diverse collection of authentic, verified Halal recipes across all 6 categories:
  - `breakfast`: Savory turmeric chicken oatmeal, spinach & tofu omelette, brown rice with eggs & lalapan, whole grain avocado toast, banana chia smoothie bowl, mushroom scrambles, etc.
  - `lunch`: Grilled turmeric chicken with brown rice, beef & broccoli in garlic sauce, clear chicken soto broth, pepes ikan nila, gado-gado siram, capcay seafood & tofu, sate ayam panggang, etc.
  - `dinner`: Clear snapper fish soup, rosemary lemon chicken breast, steamed tempeh steak in black pepper sauce, grilled honey spicy tilapia, vegetable chicken soup, etc.
  - `snack`: Steamed edamame, baked cinnamon honey banana, grilled spiced tempeh bites, fruit & seed bowl.
  - `drink`: Hot ginger lemon honey (wedang jahe), antioxidant ceremonial matcha, fresh mint lime cooler.
  - `dessert`: Mango chia pudding, dragonfruit chia parfait, baked cinnamon spiced apple.
- Each recipe contains full authentic ingredients (with amounts and units), clear cooking instructions, accurate non-fabricated nutrition (`calories`, `protein_g`, `carbs_g`, `fat_g`), and verified halal classification.

### 5.3 Goal-Oriented Nutritional Ranking Engine
**File**: [lib/services/recipes/GoalOrientedRanker.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/GoalOrientedRanker.ts)
- Accepts candidate `AuthoritativeRecipe[]` and user `UserProfileContext`.
- Calculates category meal calorie budgets:
  - Breakfast: 25% of `dailyCalorieGoal`
  - Lunch: 35% of `dailyCalorieGoal`
  - Dinner: 30% of `dailyCalorieGoal`
  - Snack / Drink / Dessert: 10% of `dailyCalorieGoal`
- Scoring dimensions:
  - **Goal Alignment**:
    - Weight Loss: penalizes meals exceeding the category budget, rewards protein density and fiber.
    - Muscle Gain: rewards protein >= 30g and sufficient caloric energy.
    - Weight Maintenance: rewards adherence to category calorie target and balanced macronutrient distribution.
    - General Health: rewards whole-food ingredients, high fiber, balanced profile.
  - **Allergy & Dislike Safety**: Strict filter eliminates any violation before ranking.
  - **Preference & Affinity**:
    - Boost for matches with `preferredCuisines`.
    - Boost for matches with `likedFoods`.
    - Boost (+15) for favorited recipes that pass all halal and safety gates.
  - **Category Appropriateness**: Validated via [MealCategoryValidator.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/MealCategoryValidator.ts).

### 5.4 Unified Daily Meal Plan Route
**File**: [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts)
- Connects `loadUserProfileContext(supabase, userId)`.
- Gathers candidate recipes from `CuratedRecipeProvider` and Supabase `recipes` table.
- Executes:
  1. `HalalClassifier.classifyHalal()` -> Keep only `HALAL_VERIFIED`.
  2. `checkAllergensAndDislikes()` -> Hard exclusions for allergies & dislikes.
  3. `MealCategoryValidator` -> Ensure category integrity.
  4. `RecipeDeduplicator` + `daily_meal_served` interaction check -> Prevent repetition.
  5. `GoalOrientedRanker.rankRecipes()` -> Personalized ranking per goal.
- Saves the resulting plan to `user_daily_meal_plans` with a `constraint_hash` (derived from allergies, goal, calorie target).
- Upserts recipes into canonical `recipes` table to ensure recipe detail screens match the carousel card perfectly.

### 5.5 Cache Revalidation in Recipes Client
**File**: [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts)
- In `getDailyMealSuggestions`:
  - When loading cached plan from `user_daily_meal_plans`, load user's active constraints or pass them to revalidate.
  - If any cached meal contains an allergen or violates updated user goal/lifestyle, the cached plan is invalidated and regenerated fresh.
  - If forceRefresh is requested, bypass cache.

### 5.6 Food Carousel Cleanup
**File**: [components/FoodCarousel.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/FoodCarousel.tsx)
- Preserve all layouts, animations, CSS, card positioning, dots, next/prev handlers.
- Remove hardcoded unvalidated `DEFAULT_MEALS` from bypassing the recommendation pipeline.
- If meals are empty, render the existing kitchen/clock loading empty state with localized messaging.
- Ensure `calories` reflects the real recipe calories rather than defaulting to `350`.

---

## 6. Verification & Test Plan (Section 13 Compliance)

| Test ID | Test Scope | Verification Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **Test A** | Halal Compliance | Pass candidates containing bacon, pork gelatin, red wine, mirin, beer batter, unverified beef/chicken | All rejected with `HARAM_DETECTED` or `HALAL_UNVERIFIED`. Zero non-halal meals reach carousel. |
| **Test B** | Weight Reduction | Onboarding profile with `Lose Weight` and `1600 kcal` target | Recommendations fit category deficit targets (e.g. Lunch ~500 kcal), high protein and fiber. |
| **Test C** | Muscle Gain | Onboarding profile with `Gain Muscle` and `2800 kcal` target | Recommendations prioritize protein (>= 30g) and calorie-dense balanced meals. |
| **Test D** | Allergies | Onboarding profile with declared `peanut` or `seafood` allergy | Any dish with peanuts, peanut sauce, shrimp paste (terasi), fish sauce, or seafood is excluded. |
| **Test E** | Disliked Foods | Onboarding profile with disliked foods (e.g. `mushroom`) | Meals containing mushrooms are excluded from recommendation pool. |
| **Test F** | User Differentiation | Compare recommendation results for User A (Weight Loss, Vegan) vs User B (Muscle Gain, Halal) | Returned meal sets are distinct, customized to respective goals and diets. |
| **Test G** | Nutrition Integrity | Compare carousel card calories & macros with recipe details and database row | Exact match, zero fabricated numbers, zero modulo 60 offsets. |
| **Test H** | Existing UI Preservation | Inspect FoodCarousel on mobile, tablet, and desktop viewports via Chrome DevTools | Visual deck, cards, swipe, icons, text styling completely unchanged. |
| **Test I** | Cache Invalidation | User updates allergy or goal in profile, reload dashboard | Cached plan is revalidated; newly prohibited meals are dropped and fresh plan generated. |
| **Test J** | Empty Candidate Pool | Mock scenario where zero halal recipes match impossible filter | System displays graceful empty kitchen state without injecting fake/prohibited dishes. |

---

## 7. Approval Gate
This prompt outlines the exact files to create and edit:
- Touch: [lib/services/recipes/HalalClassifier.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/HalalClassifier.ts) (New)
- Touch: [lib/services/recipes/GoalOrientedRanker.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/GoalOrientedRanker.ts) (New)
- Touch: [lib/services/recipes/CuratedRecipeProvider.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/CuratedRecipeProvider.ts) (Expand catalog with verified Halal recipes)
- Touch: [lib/services/RecipeValidationGate.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/RecipeValidationGate.ts) (Integrate HalalClassifier)
- Touch: [app/api/daily-meal-plan/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) (Wire full onboarding context, Halal gate, and goal ranker)
- Touch: [lib/api/recipes.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/recipes.ts) (Add cache constraint revalidation)
- Touch: [components/FoodCarousel.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/FoodCarousel.tsx) (Remove unverified fallback bypass, preserve 100% of UI)
