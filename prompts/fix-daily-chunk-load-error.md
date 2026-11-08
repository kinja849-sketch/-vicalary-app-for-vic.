# Implementation Blueprint: Fix Daily.co Dynamic Chunk Loading Failure (`Loading chunk ... daily-esm_js failed`)

## 1. Problem Summary & Root Cause Analysis

### Observed Error
The user's browser displays:
```
Loading chunk _app-pages-browser_node_modules_daily-co_daily-js_dist_daily-esm_js failed.
(error: http://localhost:8080/_next/static/chunks/_app-pages-browser_node_modules_daily-co_daily-js_dist_daily-esm_js.js)
```

### Technical Root Cause
In [`hooks/useDailyCall.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useDailyCall.ts):
- Line 271 and line 334 perform dynamic inline imports:
  ```ts
  const DailyModule = await import('@daily-co/daily-js');
  const DailyIframe = DailyModule.default || (DailyModule as any);
  ```
- In Next.js App Router, dynamic `import('@daily-co/daily-js')` inside an event callback instructs Webpack to split `@daily-co/daily-js` into an isolated, lazy-loaded on-demand chunk (`_app-pages-browser_node_modules_daily-co_daily-js_dist_daily-esm_js.js`).
- When source files are updated during development (or when Fast Refresh / HMR recompiles modules), the server generates new chunk hashes. If the user's active browser session calls `joinCall` or `leaveCall`, the browser attempts to fetch the old chunk URL, resulting in an HTTP 404 and unhandled script load error.
- Furthermore, if network latency or caching issues occur, lazy-loading the critical call engine at the moment of call connection introduces unnecessary latency and failure risk.

---

## 2. Proposed Solution

### 1. Static Top-Level Import in [`hooks/useDailyCall.ts`](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useDailyCall.ts)
`@daily-co/daily-js` has full universal/SSR safety (verified via Node runtime execution). We will:
- Replace dynamic runtime `await import('@daily-co/daily-js')` with direct top-level import:
  ```ts
  import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
  ```
- Use `DailyIframe` directly in `joinCall` and `leaveCall` guarded by `typeof window !== 'undefined'`.
- This eliminates the split dynamic chunk entirely, embedding the call controller reliably into the client bundle and completely preventing chunk 404 / load failure errors.

### 2. Graceful Error Boundary in `joinCall`
- If any iframe creation or initialization error occurs, catch it and provide clear recovery instead of crashing with a raw chunk error.

---

## 3. Verification Plan
1. **Typecheck**: Run `npm run typecheck` to confirm zero TypeScript compilation errors.
2. **Dev Server Verification**: Verify that Next.js compiles `hooks/useDailyCall.ts` without chunk 404s.
3. **Browser Test**: Verify in browser that clicking call connects directly without any chunk loading toast or console error.
