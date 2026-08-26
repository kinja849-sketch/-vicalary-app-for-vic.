# Implementation Plan: AI-Personalized Meal Suggestion & Recipe Generation

## Objective
Transform the meal suggestion and recipe system into an end-to-end AI-powered culinary engine that generates hyper-personalized meal plans and complete recipes directly from the user's onboarding profile (cuisine preferences, cooking time constraints, dietary goals, restrictions) and IP/geo-location (local market ingredient accessibility), with accurate, mouthwatering food imagery and full step-by-step instructions.

## Root Cause Analysis
1. Currently, `app/api/daily-meal-plan/route.ts` relied on external generic scrapers (Edamam API / TheMealDB) that returned generic Western dishes, lacked regional ingredient availability, ignored the user's onboarding prep-time constraint (e.g. 15-30 min), and often returned recipes without full ingredients or instructions in the local DB.
2. Clicking on a recommended meal often opened a blank/sparse recipe screen ("Follow standard preparation instructions" with "No specific ingredients listed") because the external ID was not populated with full ingredients and instructions in `cached_recipes`.
3. Recipe images were often missing or disconnected from the actual dish name and regional context.

## Proposed Changes

### 1. AI-Powered Daily Meal Plan Generator (`app/api/daily-meal-plan/route.ts`)
- Query user's complete `onboarding_responses` (`meal_prep_time`, `preferred_cuisines`, `dietary_lifestyle`, `restrictions`, `liked_foods`, `goal`, `daily_calorie_goal`, `cooking_skill`) and `user_profiles.location_metadata` / IP location.
- Extract strict time limits (e.g., if user selects `15-30 min`, total cooking time cannot exceed 30 minutes; for `< 15 min`, max 15 minutes).
- Synthesize culturally authentic, locally accessible recipes using OpenAI GPT-4o / Gemini with local ingredients readily purchasable in the user's city/country (e.g., Indonesia/Southeast Asia -> local fresh ingredients, spices, and supermarket staples).
- Provide accurate high-resolution food imagery for each dish matching the exact recipe name.
- Automatically save all generated dishes with their complete ingredients array and step-by-step instructions directly into `cached_recipes` so any clicked dish immediately opens a rich, complete recipe page.

### 2. On-Demand AI Recipe Detail Synthesizer (`app/api/recipe-details/route.ts`)
- If a recipe is queried by ID or name and is not already cached, use AI to generate the complete authentic recipe (ingredients with exact measurements, ordered cooking steps, macros, timing) based on the user's locale and profile, cache it in `cached_recipes`, and return it seamlessly.

### 3. Dedicated Food Image Provider (`lib/services/FoodImageService.ts` / API)
- Ensure every meal has a high-quality, verified photo matching the dish name (utilizing curated high-res Unsplash food photography CDN + AI food visualization fallback) so image headers are never blank or mismatched.

### 4. Client Meal Plan Cache Invalidation (`lib/api/recipes.ts`)
- Support refreshing or regenerating the daily meal plan when onboarding preferences are updated.

## Acceptance Criteria
- [x] All meal suggestions strictly adhere to the user's onboarding preparation time (e.g., <= 30 min if 15-30 min selected).
- [x] Cuisine matches the user's preferred cuisines and local market ingredient accessibility based on their IP/country location.
- [x] Every meal card opens to a complete recipe details page with rich ingredients list, step-by-step instructions, macros, and prep times.
- [x] Every recipe has a valid, accurate, high-resolution food image.
