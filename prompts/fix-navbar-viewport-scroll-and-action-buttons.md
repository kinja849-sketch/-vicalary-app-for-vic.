# Implementation Plan: Fix Bottom Navigation Scope, Hero Scroll Clipping, and Action Button Visibility

## Problem Analysis

The user reported three critical visual and structural issues with the perception analysis screens:

1. **Bottom Navigation Overlap**:
   - The bottom navigation bar appears on the main analysis content, covering actions and content.
   - Requirement: The bottom navigation bar must strictly appear **only on the main dashboard** (`/dashboard`) and **nowhere else** (not on `/notifications`, `/chat`, `/settings`, `/camera`, `/scanner`, `/cookbook`, `/budget`, or any modal/analysis screen).
   - In addition, whenever an analysis screen, modal, camera, or scanner is open on the dashboard, the bottom navigation must be suppressed completely.

2. **Content Entering Hero Image on Scroll**:
   - When the user scrolls the analysis screen, the narrative text enters/bleeds into the food photo.
   - Root Cause: In the legacy layout, the hero image was fixed or pinned at `h-52 shrink-0` while `main` had `-mt-8` with a gradient fade, causing text to scroll underneath the image rather than the entire page scrolling naturally.
   - Requirement: The entire document flow must scroll as a unified page. The food photograph must be in normal document flow inside a rounded card, with solid background containers, so text never scrolls into or behind an image.

3. **Log and Ask Health Coach Buttons Blocked / Inaccessible**:
   - The primary actions ("Log to Food Diary" and "Ask Health Coach") are cut off and blocked by the bottom navbar or viewport boundaries.
   - Requirement: The bottom navigation is removed from this screen, and the primary actions are mounted in an elevated, dedicated sticky action dock (`sticky bottom-0 z-20 bg-[#0a0f14]/95 backdrop-blur-xl border-t border-white/10`) ensuring "Log to Food Diary" and "Ask Health Coach" are **always visible, prominently accessible, and never obscured**.

---

## Technical Solution & Implementation Architecture

### 1. Strict Bottom Navigation Boundary
- **`components/BottomNavbar.tsx`**:
  - Restrict `allowedPaths` strictly to `['/dashboard']`.
  - Check `isNavbarHidden` from `useAnalysisStore`. If true, return `null`.
- **`components/GlobalShell.tsx`**:
  - Restrict `allowedPaths` strictly to `['/dashboard']`.
  - Only render `<BottomNavbar />` when `pathname === '/dashboard'` AND `!isNavbarHidden`.
  - Only apply bottom padding `pb-20` when the navbar is actually visible.
- **`store/analysisStore.ts`**:
  - Add `isNavbarHidden: boolean` and `setNavbarHidden(hidden: boolean): void`.
- **`app/_pages/Dashboard.tsx`**:
  - When `showMealAnalysis || showProductDetails || showCameraModal || showScannerModal` is active, suppress the navbar.

### 2. Unified Document Scroll (Hero Image Clipping Elimination)
- **`components/MealAnalysis.tsx`** & **`components/ProductDetails.tsx`**:
  - Root container: `fixed inset-0 z-[9999] bg-[#0a0f14] text-white flex flex-col h-[100dvh] overflow-hidden`.
  - Sticky Top Header (`h-16 shrink-0 z-30 bg-[#0a0f14]/95 backdrop-blur-xl border-b border-white/10 px-5 flex items-center justify-between`): Contains the Back button and verdict badge. Solid background so scrolled content cleanly disappears under the header rather than into the photo.
  - Vertically Scrollable Content (`flex-1 overflow-y-auto px-5 py-6 space-y-6`):
    - Photograph Banner: Placed at the top of the scroll container as a rounded card (`w-full h-64 sm:h-72 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900 shrink-0`).
    - Section 1 (Meal Description / Product Description): Solid card (`bg-white/5 border border-white/10 rounded-[2rem] p-6`).
    - Section 2 (Vitamins & Nutrition): Sensible range, structured macros grid, identified micronutrients, and nutritional narrative.
    - Section 3 (Plan Recommendation): Goal fit evaluation + canonical alternative card if not recommended.
    - All `-mt-8` negative margins and overlapping layers are strictly removed.

### 3. Pinned, Always-Visible Action Dock
- **`components/MealAnalysis.tsx`**:
  - Sticky Bottom Dock (`shrink-0 z-20 bg-[#0a0f14]/95 backdrop-blur-xl border-t border-white/10 px-5 py-4 pb-safe space-y-2.5`):
    - Button 1: **Log to Food Diary** (`w-full py-4 bg-vic-blue text-white rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2`). Strictly saves to diary with **zero** budget deduction.
    - Button 2: **Ask Health Coach About This Meal** (`w-full py-3.5 bg-white/10 text-white rounded-2xl font-bold text-sm border border-white/10 flex items-center justify-center gap-2`). Pre-provisions chat context and navigates to coach.
    - Optional Button 3: **Analyze Another Meal** (`onRetry`).
- **`components/ProductDetails.tsx`**:
  - Apply the exact same sticky bottom dock pattern for **Log Product (Confirm Purchase)** and **Consult Health Coach** (or **Avoid This Product** when Boycott Gate is flagged).

---

## File Change Map

| File Path | Role in Fix |
| :--- | :--- |
| [`components/BottomNavbar.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/BottomNavbar.tsx) | Restrict `allowedPaths` strictly to `['/dashboard']`; check `isNavbarHidden`. |
| [`components/GlobalShell.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/GlobalShell.tsx) | Restrict navbar and padding strictly to `['/dashboard']` when not hidden. |
| [`store/analysisStore.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/store/analysisStore.ts) | Add `isNavbarHidden` state and controller. |
| [`components/MealAnalysis.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/MealAnalysis.tsx) | Fix scroll hierarchy (image in flow, no text bleeds), add sticky bottom action dock. |
| [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx) | Fix scroll hierarchy, add sticky bottom action dock. |
| [`app/_pages/Dashboard.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Dashboard.tsx) | Sync navbar suppression with modal/analysis open states. |

---

## Acceptance Criteria & Verification Plan

1. **Bottom Navigation**:
   - Only appears on `/dashboard`.
   - Never appears on `/notifications`, `/chat`, `/settings`, or any other page.
   - When viewing `MealAnalysis` or `ProductDetails`, the bottom navbar is completely absent.
2. **Scroll Behavior**:
   - Scrolling vertically moves the photo up smoothly; text stays strictly within its own card and never enters or scrolls under the image.
   - Header stays sticky at top with Back button.
3. **Action Button Visibility**:
   - "Log to Food Diary" and "Ask Health Coach" are pinned at the bottom of the screen in a sticky action dock, immediately visible at all times regardless of scroll position.
   - Tapping "Log to Food Diary" saves to diary without touching budget.
   - Tapping "Ask Health Coach" provisions context and opens chat.
4. **Verification via DevTools**:
   - Inspect on Chrome DevTools (`http://localhost:8080/perception-preview` and `http://localhost:8080/dashboard`).
   - Verify layout, snapshot, and console health.
