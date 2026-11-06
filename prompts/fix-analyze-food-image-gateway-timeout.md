# Implementation Prompt: Fix Analyze Food Image 504 Gateway Timeout & HTML JSON Parse Error

## Executive Summary & Root Cause Analysis

### User Problem
When scanning or uploading a meal image in production at `https://vicalarly.netlify.app`, the application fails with:
1. `POST https://vicalarly.netlify.app/api/analyze-food-image 504 (Gateway Timeout)`
2. `AI analysis failed: SyntaxError: Unexpected token '<', "<HTML><HE"... is not valid JSON`
3. `Gallery analysis failed: SyntaxError: Unexpected token '<', "<HTML><HE"... is not valid JSON`

### Historical Git Repository Inspection
Tracing recent commits (`git log`):
- Working baseline (`c765ffb`):
  - Vision model: `gpt-4o` with `max_tokens: 280`, `detail: 'auto'`. Completed in ~1.5 - 2.5s.
  - Nutrition normalization: resolved entirely in-memory using `COMMON_FOOD_NUTRITION` and `TKPIDatasetService` (~0.005s).
  - Synthesis model: `gpt-4o-mini` with `max_tokens: 520`. Completed in ~1.5s.
  - Total latency: ~4 - 5s, safely under Netlify's default 10s gateway timeout.
- What broke it in `835dbd9` & `f3f5945`:
  1. **Token bloat**: Vision `max_tokens` was inflated from `280` to `2500`! Synthesis `max_tokens` was inflated from `520` to `2500`! In LLM generation, generating 2500 tokens takes 15-25 seconds!
  2. **High-detail image tiling**: Vision image parameter was set to `detail: 'high'`, which forces OpenAI to split high-resolution camera photos into 8–16 512x512 tiles, drastically ballooning visual processing latency by 6–10s.
  3. **Unbounded retry loops**: If vision food parsing was empty, a second vision LLM was called with another `2500` max tokens.
  4. **External government API latency**: `FoodAnalysisOrchestrator.executeFoodItemsWorkflow` invoked `USDAFoodDataService.lookupFreshFood()`, which makes sequential external HTTP `fetch` requests to `https://api.nal.usda.gov/fdc/v1/foods/search` with 3.5s timeouts per food item. For meals with multiple ingredients, this added 7–14 seconds of external HTTP blocking.
  5. **Double normalization**: In cooked meal mode, `calculateMealNutrition` was invoked twice sequentially.
  6. **Netlify Gateway Timeout**: Netlify default serverless function timeout is 10s (max 26s). Because the route took 30–45s, Netlify forcibly aborted the Lambda and returned a 504 Gateway Timeout HTML page (`<HTML><HEAD><TITLE>504 Gateway Timeout</TITLE></HEAD>...`).
  7. **Unsafe response parsing**: `lib/api/food.ts` ran `await res.json()` directly before checking `if (!res.ok)`, causing the raw `<HTML>` string to throw `SyntaxError: Unexpected token '<'` instead of handling HTTP errors gracefully.

---

## Architectural Blueprint & Solution

### 1. Optimize `app/api/analyze-food-image/route.ts` Latency
- Set vision LLM to `detail: 'auto'` and `max_tokens: 450` (ample space for 8–12 structured items, returning in ~1.5–2s).
- Set synthesis LLM to `max_tokens: 650` (ample space for 3 substantive clinical paragraphs, returning in ~1.5–2s).
- Remove redundant 2500-token retry loops; if primary vision returns empty items, gracefully fallback to plate dish name without triggering an additional 10s LLM roundtrip.
- Ensure all nutritional calculations prioritize instant in-memory catalogs (`VERIFIED_USDA_REFERENCE_CATALOG`, `TKPIDatasetService`, and `COMMON_FOOD_NUTRITION`) by passing `skipNetwork: true` to USDA during synchronous image analysis, guaranteeing sub-millisecond nutritional lookups without blocking on `api.nal.usda.gov`.
- Total route execution time will drop from **35–45s** down to **3–5s**, well within any serverless timeout.

### 2. Configure Netlify Function Timeout in `netlify.toml`
- Add explicit function timeout configuration:
  ```toml
  [functions]
    node_bundler = "esbuild"
    timeout = 26
  ```
- This extends Netlify's execution ceiling to the maximum allowable 26 seconds on standard Netlify plans, providing full headroom.

### 3. Fortify Client-Side Error Handling in `lib/api/food.ts`
- Check `if (!res.ok)` BEFORE attempting `res.json()`.
- If Netlify or the network ever returns an HTML error status (504, 502, 500), read `res.text()`, safely parse if JSON, or return a human-friendly timeout message rather than crashing with `SyntaxError: Unexpected token '<'`.

---

## Files to Modify
1. [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/app/api/analyze-food-image/route.ts):
   - Fast token budgets (`max_tokens: 450` for vision, `max_tokens: 650` for synthesis).
   - Fast visual detail (`detail: 'auto'`).
   - Pass `{ skipNetwork: true }` to avoid blocking on external USDA network timeouts.
2. [`netlify.toml`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/netlify.toml):
   - Configure `[functions]` with `timeout = 26`.
3. [`lib/api/food.ts`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/api/food.ts):
   - Safe HTTP error interception before JSON parsing.

---

## Acceptance Criteria
- [ ] `/api/analyze-food-image` completes end-to-end in < 6 seconds.
- [ ] No 504 Gateway Timeout on Netlify.
- [ ] No `SyntaxError: Unexpected token '<'` JSON parse crash.
- [ ] Preserves all decomposed plate items, authentic calorie calculation, and rich clinical paragraphs.
- [ ] Typecheck passes cleanly with zero errors.
