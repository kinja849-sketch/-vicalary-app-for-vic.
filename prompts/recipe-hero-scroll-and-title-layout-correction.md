# Implementation Prompt: Recipe Hero Scroll, Icon Removal, Title Repositioning & Authentic Backstory / Origin History

## 1. Problem Statement & User Requirements
1. **Hero Image Stuck on Screen (Unscrollable Viewport)**:
   - In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx), the outer container was styled with `h-screen overflow-hidden`, keeping the hero image container `div.relative.h-92.shrink-0` locked at the top half of the screen while only `<main>` scrolled internally.
   - When users scroll down, the hero image remained glued to the viewport, preventing the user from scrolling past it.
   - **Fix**: Transform the layout into a unified scroll container (`min-h-screen`) where the hero image moves naturally with document scroll, allowing users to scroll past the photograph to view the entire recipe.

2. **Remove Share and Heart Icons**:
   - The user explicitly requested: *"remove the share icon and the heart icon. Maintain the arrow back icon."*
   - In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx#L1164-L1175), remove the `<Share2 />` button and `<FavoriteButton />` from the top header bar.
   - Retain only the left `<button onClick={() => router.back()} ...><ArrowLeft size={20} /></button>` back navigation.

3. **Meal Title Placement (Off the Photograph)**:
   - The user explicitly requested: *"The font naming of the meal seems to be over the image, which shouldn't be the case at all. Make sure this is fixed... The naming shouldn't be on top of the image; it should be well-represented, rather than how it is now."*
   - Currently, `recipe.title` and `dietary_tags` were rendered in `absolute bottom-16 left-6 right-6 z-10` over the meal photograph.
   - **Fix**: Remove the title and dietary tags overlay from inside the hero image container. Place them at the very top of the content dashboard `<main>`, cleanly formatted with dietary pill badges and a bold, readable `h1` heading (`text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight`) directly above the nutritional dashboard.

4. **Authentic Backstory & Origin History for "History of the meal"**:
   - The user clarified: *"when I said history of the meal, it's a small history, like a backstory about this meal, the origin of it, where it came from, and all that. That's what I meant."*
   - The text under "History of the meal" must not merely describe cooking ingredients or clinical justification; it must be a concise, engaging backstory detailing:
     - The geographical and cultural birthplace/origin of the dish.
     - Where it came from historically (e.g. West African traditions carried to the Caribbean; maritime spice trade for Indonesian dishes).
     - Its traditional role (e.g. communal Sunday centerpiece, celebratory dish, humble nourishing staple).
   - For Rice and Beans: Document its West African (Waakye) roots bridging to Jamaica and the Caribbean as a cherished Sunday centerpiece, slow-cooked in coconut milk and scotch bonnet pepper.
   - For other dishes (Soto Ayam, Gado-Gado, Rendang, Shakshuka, etc.): Supply factually grounded, culturally authentic origins and backstories.

5. **Zero-Regression Commitment**:
   - Maintain all other verified functionality:
     - Nutritional dashboard (`Kcal`, `Prot`, `Carb`, `Fat`).
     - Cooking duration (`40 MIN TOTAL`) and servings (`2 PERS`).
     - Section heading: `HISTORY OF THE MEAL` (uppercase without hyphens or underscores).
     - `Let's start cooking` voice assistant launch button and full interactive voice mode.
     - Vertically aligned `INGREDIENTS` with photorealistic ingredient images, soft rounded cards, `+` corner accents, and amount badges.
     - Numbered `STEPS` with phase titles and duration badges totaling 40 minutes.
     - 100% Halal dietary compliance.

---

## 2. Proposed Changes

### File: [`lib/services/recipes/RecipeInstructionNormalizer.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/recipes/RecipeInstructionNormalizer.ts)
- Update `resolveCulinaryBackground()` so that the backstory focuses strictly on the authentic origin, history, where it came from, and cultural significance.
- For Rice and Beans:
  ```text
  Originating centuries ago from the culinary crossroads of West Africa and the Caribbean basin, Rice and Beans (widely celebrated across Jamaica and the islands as 'Rice and Peas' or 'Waakye') was born as a cherished communal Sunday dish. West African culinary pioneers carried the tradition of pairing wholesome legumes with local grains across trade routes, adapting the recipe with rich coconut milk, fresh thyme, and native Scotch bonnet peppers. Over generations, this humble combination evolved into a timeless cultural staple symbolizing endurance, community warmth, and celebratory family nourishment.
  ```
- Ensure rich historical backstories for other cultural staples (Soto Ayam, Gado-Gado, Rendang, Quinoa salads, etc.).

### File: [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)
1. **Container & Natural Page Scroll**:
   - Replace fixed-height viewport wrapper with natural `min-h-screen max-w-2xl mx-auto w-full bg-slate-50 dark:bg-[#0d1418]`.
   - Remove internal `overflow-y-auto` from `<main>` so the entire document scrolls seamlessly past the hero image.
2. **Top Navigation Header**:
   - Keep only the back arrow button in the top-left:
     ```tsx
     <div className="absolute top-6 left-6 z-20">
         <button 
             onClick={() => router.back()} 
             aria-label="Go back"
             className="size-10 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95"
         >
             <ArrowLeft size={20} />
         </button>
     </div>
     ```
   - Delete the `<Share2 />` button and `<FavoriteButton />`.
3. **Hero Image & Title Placement**:
   - Hero container `relative w-full h-72 sm:h-84 bg-slate-900 overflow-hidden` containing only the photo and back button.
   - Title and dietary tags placed at the top of the `<main>` content container directly above the nutritional dashboard:
     ```tsx
     <div className="mb-6">
         {recipe.dietary_tags && recipe.dietary_tags.length > 0 && (
             <div className="flex flex-wrap gap-2 mb-2.5">
                 {recipe.dietary_tags.slice(0, 3).map((tag: string) => (
                     <span key={tag} className="text-[10px] font-black uppercase tracking-wider bg-vic-green/15 text-vic-green border border-vic-green/25 px-2.5 py-1 rounded-full">
                         {tag}
                     </span>
                 ))}
             </div>
         )}
         <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
             {recipe.title}
         </h1>
     </div>
     ```

### Database Persistence Script: [`scripts/repair-incomplete-recipes.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/scripts/repair-incomplete-recipes.ts)
- Re-run script to persist the updated origin backstory for Rice and Beans into Supabase `recipes` table (`description` field) so both cached and fresh queries return the authentic origin text.

---

## 3. Verification Plan
1. **Automated Testing**:
   - Run `cmd /c "npx tsx scripts/verify-recipe-cooking-steps.ts"` (ensure 26/26 tests pass).
   - Run `cmd /c "npx tsx scripts/verify-halal-recommendations.ts"` (ensure 66/66 tests pass).
   - Run `cmd /c "npx tsc --noEmit"` (ensure 0 TypeScript compiler errors).
2. **Visual Verification with Chrome DevTools MCP**:
   - Navigate to `http://localhost:8080/recipe/1b4d057c-c579-48b9-9a4a-f0c1dbec893f`.
   - Verify that the hero image has ONLY the back arrow icon (no share or heart icons).
   - Verify that the meal title and dietary tags are cleanly rendered below the photo at the top of the card dashboard.
   - Verify that the "History of the meal" card presents the authentic origin backstory.
   - Verify that scrolling moves past the hero photo down to nutrition, history, ingredients, and sequential steps without the image staying stuck or glued to the screen.
