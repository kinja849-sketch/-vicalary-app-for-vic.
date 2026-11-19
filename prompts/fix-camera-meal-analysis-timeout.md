# Engineering Blueprint: Fix Camera Meal Analysis Timeout & Execution Failure

## 1. Problem Statement & Symptoms
When capturing a meal image via the Camera feature (`/camera` or `app/_pages/Camera.tsx`), the analysis times out and the meal analysis is not completed at all, displaying an error toast:
> *"Meal analysis timed out. Please try again with a clear photo."* (or HTTP 504 Gateway Timeout).

Even when the image is fully visible, well-lit, and readable, the analysis fails to return nutrition information.

---

## 2. Root Cause Investigation & Evidence

### Root Cause 1: Primary OpenAI API Key Quota Exhaustion (HTTP 429)
- **Investigation**: Inspected `.env.local` and tested `OPENAI_API_KEY` directly against `https://api.openai.com/v1/chat/completions`.
- **Finding**: OpenAI API returns HTTP 429:
  ```json
  {
    "error": {
      "message": "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
      "type": "insufficient_quota",
      "code": "credit_balance_exhausted"
    }
  }
  ```
  Every request to OpenAI fails immediately with `credit_balance_exhausted`.

### Root Cause 2: TLS / Certificate Trust Failure in Node.js / Axios (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`)
- **Investigation**: In `lib/ai/ai-fallback.ts`, `resilientPostJson` attempts `fetch(url)`. When `fetch` in Node encounters local Windows certificate store interception, it throws `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- **Finding**: `resilientPostJson` catches this error and falls back to `axios.post(url, payload, { headers, timeout: 35000, validateStatus: () => true })`.
  However, `axios.post` was not provided an `httpsAgent` configured with system/default CA certificates. Therefore, `axios.post` also failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or hung until its 35-second timeout expired.
- **Proof of Fix**: Tested `axios` with an `https.Agent` configured with `tls.getCACertificates('system')` and `tls.getCACertificates('default')`; calls to Gemini OpenAI-compatible endpoint completed successfully in **1,009 ms**.

### Root Cause 3: Non-Existent Gemini Fallback Models & Long Sequential Fallback Loops
- **Investigation**: In `lib/ai/ai-fallback.ts` lines 278-284:
  ```typescript
  const fallbackModels = Array.from(new Set([
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-pro-preview',
    mapModelForBackup(request.model),
  ]));
  ```
- **Finding**: Models like `gemini-3-flash-preview` and `gemini-3.1-flash-lite-preview` do not exist in the Gemini API and return HTTP 404. Furthermore, each failure in the loop called `resilientPostJson` with a 35-second timeout. Trying 4-5 models sequentially easily exceeded the 10-26 second Netlify / Vercel gateway timeout, triggering an HTTP 504 Gateway Timeout.
- In contrast, testing verified that `gemini-2.5-flash` is active, multimodal-capable, and returns structured meal analysis in ~2.3 - 5.1 seconds.

### Root Cause 4: Multi-Megabyte Uncompressed Canvas Capture & Blocking Storage Upload
- **Investigation**: In `app/_pages/Camera.tsx`:
  `takePhoto()` takes the full video dimensions (e.g. 1920x1080) at 0.9 JPEG quality with no dimension constraints, producing a 2.5MB - 5MB Blob and base64 string.
- In `lib/api/food.ts`:
  `analyzeFoodImage()` executed:
  ```typescript
  const [publicUrl, base64Data, loc] = await Promise.all([
    uploadPromise, // Uploading 4MB to Supabase Storage
    base64Promise,
    locationPromise
  ]);
  ```
  On typical mobile or home internet connections, uploading a 4MB image to Supabase Storage takes 4 to 10 seconds **before** `/api/analyze-food-image` is even called.
  Furthermore, transmitting a 4MB JSON payload across HTTP to a serverless function adds significant upload latency and risks hitting serverless payload size limits (4.5MB).

### Root Cause 5: Multiple Sequential LLM Invocations in Route Handler
- **Investigation**: In `app/api/analyze-food-image/route.ts`:
  1. Calls Vision LLM (`gpt-4o` -> fails 429 -> fails over to Gemini).
  2. If parsing is empty, calls Vision LLM retry (`gpt-4o-mini` -> fails 429 -> fails over).
  3. Calls `FoodAnalysisOrchestrator.executeFoodItemsWorkflow()` (which can trigger secondary verification).
  4. Calls `callChatCompletionWithFallback` for Synthesis (`gpt-4o-mini` -> fails 429 -> fails over).
  Executing 2 to 3 sequential LLM round-trips where each one waits for OpenAI to fail with 429 before invoking Gemini accumulates 15 - 25+ seconds, guaranteed to trigger HTTP 504 on Netlify.

---

## 3. Surgical Implementation Blueprint

### Scope of Changes (Strictly Isolated to Camera Meal Analysis)
We will modify only the files directly responsible for camera image capture, AI routing, and the meal analysis route:
1. `lib/ai/ai-fallback.ts` — Resilient TLS agent, direct circuit-breaker routing, valid Gemini models, and appropriate timeout budgets.
2. `app/_pages/Camera.tsx` — Client-side camera frame downscaling (max 1024px, 0.82 quality) to reduce payload size by 95% without loss of vision recognition accuracy.
3. `lib/api/food.ts` — Non-blocking storage upload and resilient client-side timeout handling.
4. `app/api/analyze-food-image/route.ts` — Single-pass or streamlined vision-to-synthesis pipeline with strict per-phase timeout budgets.

**No other platform features, UI surfaces, databases, or routes will be touched.**

---

### Step-by-Step Technical Plan

#### Step 1: Fix TLS, Model Routing & Circuit Breaker in `lib/ai/ai-fallback.ts`
1. **Configure System CA `https.Agent`**:
   - Create a shared `https.Agent` configured with both Node default CAs and Windows system CAs (`tls.getCACertificates('system')`).
   - Pass this `httpsAgent` into `axios` calls within `resilientPostJson`.
2. **Tighten Timeouts & Signal Handling**:
   - In `resilientPostJson`, add an internal timeout (e.g., 10,000ms for primary, 12,000ms for backup) using `AbortSignal.timeout()` or `axios` timeout so no single HTTP call hangs for 35 seconds.
3. **Correct Active Gemini Fallback Models**:
   - Replace fake model names with confirmed active models:
     `['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']`.
   - Remove 404-inducing models (`gemini-3-flash-preview`, etc.).
4. **Instant Circuit Breaker on Quota Exhaustion**:
   - When OpenAI returns `credit_balance_exhausted` or `insufficient_quota`, trip the circuit immediately for 1 hour so subsequent calls in the same request or session route directly to Gemini in ~1-2s instead of repeatedly waiting for OpenAI to return 429.

#### Step 2: Client Canvas Optimization in `app/_pages/Camera.tsx`
1. **Downscale Canvas to Optimal Vision Geometry**:
   - In `takePhoto()`, constrain dimensions to a max width/height of 1024px (standard for GPT-4o and Gemini Vision).
   - Use JPEG quality `0.82`.
   - This reduces file size from ~3.5MB to ~150KB.
   - 150KB uploads in ~50ms instead of ~4,000ms.

#### Step 3: Non-Blocking Storage Upload in `lib/api/food.ts`
1. **Parallelize Analysis and Storage**:
   - Do not wait for `uploadPromise` before dispatching `fetch('/api/analyze-food-image')`.
   - Pass `imageBase64` directly to the API route.
   - Let `uploadPromise` run in parallel. If `publicUrl` resolves before completion, attach it; otherwise, the analysis finishes in 2-3 seconds without waiting for storage.
2. **Add 20-Second Fetch Abort Controller**:
   - Give user clear progress or graceful recovery if network drops.

#### Step 4: Streamline Route Handler in `app/api/analyze-food-image/route.ts`
1. **Eliminate Redundant LLM Round-Trips**:
   - Update the vision prompt to return both food items AND clinical observation details in one pass.
   - For synthesis (meal description & recommendations), use the deterministic nutrition totals calculated by `FoodAnalysisOrchestrator` / `NutritionNormalizer`.
   - If synthesis call is needed, run it with `gemini-2.5-flash` with a 5-second timeout, falling back instantly to deterministic clinical paragraphs if it exceeds the window.
2. **Guarantee Total Serverless Execution Time < 8 Seconds**:
   - Vision pass: ~2-3 seconds.
   - Deterministic nutrition normalization: ~0.1 seconds.
   - Clinical synthesis / safety gate: ~1-2 seconds.
   - Total route execution: **~4-5 seconds**, well beneath any serverless timeout.

---

## 4. Verification Plan

1. **Unit & API Testing**:
   - Run verification script to test `callChatCompletionWithFallback` with a real image payload using Gemini 2.5 Flash.
   - Verify response time is < 5 seconds and returns valid JSON matching `app/api/analyze-food-image` schema.
2. **Localhost E2E Testing**:
   - Start dev server (`npm run dev`).
   - Open `http://localhost:8080/camera` via Chrome DevTools (`chrome-devtools-mcp`).
   - Trigger camera photo capture of a visible meal.
   - Verify that:
     1. Analysis spinner starts.
     2. No 504 or timeout error occurs.
     3. Analysis successfully completes in < 6 seconds.
     4. Correct meal title, decomposed food items, calories, macros, and clinical paragraphs are rendered in `MealAnalysis` modal.
     5. Console logs show clean fallback to `gemini-2.5-flash` with 200 OK.
