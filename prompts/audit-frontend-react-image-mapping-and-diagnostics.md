# Implementation Plan: Frontend React Image Mapping Audit, Key Fixes & Diagnostics

## 1. Objectives
Eliminate any remaining React-layer causes of image duplication and provide real-time runtime diagnostics:
1. **Add `validateMealImages` & Console Diagnostics**:
   - Check every recipe received by the frontend for missing or duplicate `image_url` values.
   - Print `console.table(...)` showing `meal name → recipe ID → image URL` on page load.
2. **Fix React Key Misuse**:
   - Replace composite/index keys such as `key={`${meal.id}-${index}`}` with strict canonical `key={meal.id}` across `app/_pages/Cookbook.tsx` and `components/FoodCarousel.tsx`.
3. **Direct Image Binding**:
   - Guarantee `CookbookCard` and `FoodCarousel` cards render directly from `meal.image_url` without array indexing, shared category cache lookups, or random fallbacks.

---

## 2. Proposed Changes

### [MODIFY] `app/_pages/Cookbook.tsx`
- Add `validateMealImages(recipes)` function to detect duplicate URLs in the frontend feed.
- Add `console.table` diagnostic logger inside `useEffect` when `suggestions` or `cookbookData` loads.
- Replace all `key={`${meal.id}-${index}`}` with `key={meal.id}`.
- Ensure `CookbookCard` strictly binds `src={item.image_url || item.image}`.

### [MODIFY] `components/FoodCarousel.tsx`
- Ensure deck cards use `key={meal.id}`.
- Ensure card image strictly uses `src={meal.image_url || meal.image}`.

---

## 3. Verification Plan
1. **Typecheck**: Run `npm.cmd run typecheck` (0 errors).
2. **Localhost Verification**:
   - Open `http://localhost:3000/cookbook` and `http://localhost:3000/dashboard`.
   - Open browser developer tools Console (F12).
   - Inspect the printed `console.table` listing all 12 dishes per category with their UUIDs and distinct image URLs.
   - Confirm zero duplicate images across cards.
