# Implementation Blueprint: Fix Camera "Device in use" & Meal Analysis Timeout

## 1. Problem Statement & Root Cause Dissection

### A. Camera "Device in use" Error (`Camera.tsx:297`)
- **Error**: `Camera access failed in Camera.tsx: PermissionError: Failed to acquire camera stream: Device in use`
- **Root Cause**:
  1. **Concurrent `getUserMedia` Race Conditions**: In `Camera.tsx`, both the mount effect (line 207) and the watchdog effect (line 219) call `startCamera` concurrently upon mount. Without an acquisition lock (`isAcquiringRef`), both trigger `navigator.mediaDevices.getUserMedia` at the exact same instant.
  2. **Unreleased Hardware Tracks**: `startCamera` called `requestCameraAccess` *before* stopping `oldStream` tracks. Because the previous MediaStream tracks still held the physical camera device lock, the operating system / webcam driver rejected the new stream acquisition with `NotReadableError: Device in use`.
  3. **Camera Kept Active During Gallery Upload**: When the user opens their file picker/gallery, the live camera feed was not suspended, causing background watchdog effects to re-invoke `startCamera` while the file was being analyzed.

### B. "Meal analysis timed out. Please try again with a clear photo." (`food.ts:185`)
- **Error**: `AI analysis failed: Error: Meal analysis timed out. Please try again with a clear photo.`
- **Root Cause**:
  1. In `lib/api/food.ts`, `postOnce` used a strict 45-second `AbortController` timeout.
  2. In Next.js dev mode (`next dev`), on-demand compilation of the route took **12.8 seconds**.
  3. The backend performed two sequential multi-second LLM calls (Vision ~8-12s + Synthesis ~8-12s) plus an initial 12s attempt on Gemini 2.5 Flash before failing over to Gemini 3.1 Flash Lite.
  4. Total elapsed server time reached **44.933 seconds**. When adding browser HTTP overhead, the client's 45s `AbortController` fired right as the server was returning, throwing the timeout error.

---

## 2. Proposed Changes

### A. Camera Hardware Lock & Acquisition Mutex
- **File**: `app/_pages/Camera.tsx`
- **Changes**:
  1. **Acquisition Mutex**: Add `isStartingCameraRef = useRef(false)` to ensure only one camera start request can ever execute at a time. If another call is in flight, subsequent calls bail out or queue cleanly.
  2. **Release Before Acquire**: Before calling `requestCameraAccess`, immediately stop and detach all existing tracks from `streamRef.current` and `videoRef.current.srcObject` so the physical hardware device lock is completely released.
  3. **Deduplicate Mount Effects**: Consolidate the mount `startCamera` call and watchdog effect so they do not race each other on component mount or React StrictMode.
  4. **Suspend Camera During Gallery Upload**: When the user picks a file from gallery, cleanly pause/stop camera tracks so the camera is not fighting for system resources or firing watchdog re-starts during photo analysis.

### B. Eliminate Two-Pass AI Latency in `analyze-food-image`
- **File**: `app/api/analyze-food-image/route.ts`
- **Changes**:
  1. Instruct the multimodal vision model to return both the identified meal structure AND the clinical narratives (`meal_description`, `vitamins_and_nutrition`, `recommendation`) in a **single pass**.
  2. Compute deterministic nutrition totals from USDA/TKPI and the Safety Engine, and inject the authenticated numbers into the narrative response.
  3. Keep the secondary synthesis pass strictly as an optional fast fallback only if the vision model omitted the narratives. This cuts AI processing time in half (from ~20s down to ~6-8s).
  4. Reduce the per-attempt timeout to 10s and request budget to 25s so the entire serverless route finishes well within 15-20 seconds.

### C. Client Timeout Adjustment
- **File**: `lib/api/food.ts`
- **Changes**:
  1. Increase client-side abort timer from 45s to 75s to ensure cold-start dev server compilation overhead never causes premature client-side aborts.

---

## 3. Verification Plan
1. **TypeScript Validation**: Run `npm run typecheck` (`tsc --noEmit`) to verify 0 errors.
2. **Camera Stream Acquisition**: Navigate to `http://localhost:8080/camera` in Chrome DevTools MCP. Verify camera initializes with 0 "Device in use" errors and 0 console warnings.
3. **Gallery Upload & Analysis**: Upload `public/grilled-chicken.jpg` via the camera page gallery upload. Confirm single-pass execution finishes in < 10 seconds and displays the nutrition results card without timing out.
