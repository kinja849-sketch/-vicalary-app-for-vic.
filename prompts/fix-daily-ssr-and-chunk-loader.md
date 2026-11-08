# Implementation Blueprint: Fix Daily.co SSR Vendor-Chunk and Client Preloading

## 1. Problem Summary & Root Cause Analysis

### Observed Server Error
```
Error: Cannot find module './vendor-chunks/@daily-co.js'
Require stack:
- C:\Users\acer\Desktop\-vicalary-app-for-vic.-main\.next\server\webpack-runtime.js
- C:\Users\acer\Desktop\-vicalary-app-for-vic.-main\.next\server\app\chat\[id]\page.js
```

### Technical Root Cause
- When `DailyIframe` was imported via a static top-level `import DailyIframe from '@daily-co/daily-js'` in `hooks/useDailyCall.ts`, Next.js App Router attempted to evaluate the module during server-side pre-rendering (SSR) of `app/chat/[id]/page.js`.
- `@daily-co/daily-js` contains client-only WebRTC implementations and is not packaged as a Node server vendor chunk. The server runtime fails when requiring `./vendor-chunks/@daily-co.js`.
- Conversely, relying on lazy `await import('@daily-co/daily-js')` only at the exact moment a call starts can fail with `Loading chunk ... failed` if the dev server recompiles or if network timing stalls during button press.

---

## 2. Technical Solution

### 1. Safe Client-Only Cached Loader in [`hooks/useDailyCall.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useDailyCall.ts)
- Guard module import so it **never executes during SSR**:
  ```ts
  import type { DailyCall } from '@daily-co/daily-js';

  let DailyIframeInstance: any = null;

  async function loadDaily() {
      if (typeof window === 'undefined') return null;
      if (DailyIframeInstance) return DailyIframeInstance;
      try {
          const mod = await import('@daily-co/daily-js');
          DailyIframeInstance = mod.default || mod;
          return DailyIframeInstance;
      } catch (err) {
          console.error('[useDailyCall] Error loading daily-js:', err);
          return null;
      }
  }
  ```
- **Proactive Client Preloading on Mount**:
  In a `useEffect` inside `useDailyCall()`, call `loadDaily()` immediately upon client mount. By the time the user makes or receives a call, the library is already compiled and cached in memory.
- In `joinCall` and `leaveCall`, call `const DailyIframe = await loadDaily()` with fallback and null-guards.

### 2. Next.js Config External Guard
In [`next.config.mjs`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/next.config.mjs), add `@daily-co/daily-js` to `serverComponentsExternalPackages` or webpack externals to ensure the server compiler never attempts to bundle it for server SSR.

---

## 3. Verification Plan
1. **Typecheck**: `npm run typecheck` — 0 errors.
2. **SSR Page Load**: Request `http://localhost:8080/chat/e1c185c8-f6a4-4752-bdcd-99adc31890de` (or any chat page) — verify HTTP 200 without SSR 500.
3. **Call Verification**: Test audio and video call initiation — verify no chunk loading errors and audible two-way sound.
