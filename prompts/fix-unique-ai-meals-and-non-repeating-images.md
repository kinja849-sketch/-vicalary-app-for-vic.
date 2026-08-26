# Implementation Plan: Unique AI-Generated Personalized Meals & Non-Repeating AI Food Images

## Objective
1. Ensure that each user receives 12 unique meals per category (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts - total 72 dishes) uniquely synthesized by the AI according to their specific onboarding responses, goals, and prep times.
2. Eliminate all image repetition so that **no two dishes share the same photo**. Every meal gets a unique, photorealistic AI-rendered food photograph specifically depicting that exact dish.
3. Ensure no `Food` / recipe object is null or missing in both Dashboard and Cookbook.
4. Ensure clicking any category tab immediately renders all 12 unique dishes.

## Root Cause of Image Repetition & Static Generation
1. `FoodImageService.ts` mapped multiple dish keywords to the same static Unsplash URLs, causing dishes like Capcay, Teriyaki, and Tempe to show identical bowl photos.
2. `daily-meal-plan/route.ts` returned identical static template arrays instead of dynamic, per-user AI-seeded generation.
3. In `Cookbook.tsx`, the "For You" view only rendered a small subset horizontally instead of cleanly displaying the full 12 options for the active category.

## Proposed Changes

### 1. Unique Dynamic AI Food Image Generator (`lib/services/FoodImageService.ts`)
- Replace duplicate static photo mapping with dynamic AI photorealistic image synthesis (Flux / Pollinations with deterministic unique seeds per user, dish name, and category index).
- Generate a unique high-definition food photograph for every single dish title (e.g., exact Nasi Merah Ayam Bakar, exact Soto Ayam, exact Panna Cotta, exact Rujak).
- Guaranteed zero image repetition across all 72 meals.

### 2. Truly Personalized 12-Dish AI Generator (`app/api/daily-meal-plan/route.ts`)
- Utilize OpenAI GPT-4o with user-specific prompts (reading user goals, onboarding responses, calorie targets, prep time limit, liked foods, and restrictions).
- Generate 12 distinct, calculated recipes for each of the 6 categories (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts).
- Ensure all meal records have non-null `title`, `image_url`, `ingredients`, `instructions`, and `nutrition` fields.
- Auto-persist all 72 recipes to `recipes` and `cached_recipes`.

### 3. Full 12-Item Category View in Cookbook (`app/_pages/Cookbook.tsx`)
- Display all 12 meals in a clear grid for any selected category (Breakfast, Lunch, Dinner, Snacks, Drinks, Desserts) as well as the active session in "For You".
- Add a category selector tab that lets users easily switch between all 6 categories and view all 12 items per category.

## Verification Plan
1. Typecheck: `npx tsc --noEmit`.
2. Inspect `http://localhost:3000/cookbook`:
   - Verify every category (Sarapan, Makan Siang, Makan Malam, Camilan, Minuman, Pencuci Mulut) displays 12 distinct dishes.
   - Verify all 12 dishes have distinct, non-repeating photos matching their respective names.
   - Click on dishes and confirm `Food` data is complete with ingredients and steps.
