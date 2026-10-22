# Implementation Prompt: Real-Time Scanned Budget Deduction Reflection & Cache Busting

## 1. Problem Statement & User Rectification
1. **The Issue**:
   - When a user scans a product and clicks "Budget", the product is deducted and reflects on `/budget`.
   - However, when the user scans subsequent products (Product 2, Product 3, etc.), the deductions and products do NOT reflect on the `/budget` screen or under "Recent Scanned Products".
   - Diagnosis proved that the database (`financial_transactions`) DOES receive and store all scans, but the frontend serves stale cached data due to HTTP GET caching on `/api/budget/daily`, TanStack Query inactive query refetch skipping during redirect from `/scanner`, and Next.js App Router client-side route caching.

2. **Goal**:
   - Every single product scanned and budgeted must **immediately and reliably reflect** on the Budget screen (updating the daily balance and spent totals, and appearing in "Recent Scanned Products" with the correct minus deduction indicator and timestamp).
   - Zero stale reads, zero cache locks on subsequent scans.

---

## 2. Technical Data Flow & Architecture

```
[User scans barcode] ──► [ProductDetails: handleConfirmLog]
                               │
                               ▼
                [saveFoodAnalysis (lib/api/food.ts)]
                               │
                               ▼ POST /api/expenses
                [financial_transactions table inserted]
                               │
                               ▼
                [TanStack Query Cache Reset & Route Cache Purge]
                  - queryClient.invalidateQueries({ queryKey: ['active-budget'], refetchType: 'all' })
                  - queryClient.resetQueries({ queryKey: ['active-budget'] })
                  - router.refresh()
                               │
                               ▼
                [router.push('/budget')]
                               │
                               ▼
                [Budget Screen (app/_pages/Budget.tsx)]
                  - useQuery calls getBudgetStatus with:
                    * cache: 'no-store'
                    * cache-busting param _t=Date.now()
                    * staleTime: 0, gcTime: 0, refetchOnMount: 'always'
                               │
                               ▼
                [app/api/budget/daily/route.ts]
                  - Calculates fresh BudgetEngine status
                  - Returns with headers:
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                    'Pragma': 'no-cache'
                               │
                               ▼
                [Instant UI Reflection]
                  - Updated remaining daily budget
                  - All scanned products visible under Recent Scanned Products
```

---

## 3. Targeted File Changes

### A. [`app/api/budget/daily/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/budget/daily/route.ts)
- Enforce strict anti-caching HTTP headers on the response:
  ```typescript
  return NextResponse.json({ success: true, summary: responseData }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
  ```

### B. [`lib/api/budget.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/budget.ts)
- In `getBudgetStatus`:
  - Append a high-resolution timestamp `&_t=${Date.now()}` to the request URL to guarantee every browser fetch hits the network.
  - Set `cache: 'no-store'`.
  - Pass `'Cache-Control': 'no-cache'` and `'Pragma': 'no-cache'` in request headers.

### C. [`components/ProductDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/ProductDetails.tsx)
- In `handleConfirmLog`:
  - Invalidate with `refetchType: 'all'` so inactive queries (such as the unmounted `active-budget` query on the budget page) are properly marked and forced to refetch upon mounting.
  - Clear the specific query from cache via `queryClient.resetQueries({ queryKey: ['active-budget'] })`.
  - Call `router.refresh()` before `router.push('/budget')` to purge Next.js App Router client cache for the budget route.

### D. [`app/_pages/Budget.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Budget.tsx)
- In `useQuery`:
  - Set `staleTime: 0`.
  - Set `gcTime: 0` (or `cacheTime: 0`) to prevent retaining previous session snapshots.
  - Add `refetchOnMount: 'always'` and `refetchOnWindowFocus: true`.
  - Add an on-mount effect with `router.refresh()` to ensure Next.js App Router payload is freshly synchronized whenever the user lands on the Budget page.

---

## 4. Acceptance Criteria & Verification

1. **Multiple Item Scan & Deduction**:
   - Scan Product 1 -> Tap "Budget" -> Reflected under Recent Scanned Products and subtracted from Daily Budget.
   - Return to Scanner -> Scan Product 2 -> Tap "Budget" -> Product 2 immediately appears under Recent Scanned Products, and the Daily Budget reflects both deductions combined.
   - Scan Product 3 (even identical product or same brand) -> Tap "Budget" -> Appears as 3rd deduction item immediately without requiring page reloads or manual browser refreshes.
2. **Deterministic Persistence**:
   - `financial_transactions` contains all transactions.
   - HTTP response for `/api/budget/daily` contains anti-cache headers.
3. **Zero Regression**:
   - Existing visual design, dark cards, colors, typography, and layout remain 100% untouched.
   - TypeScript compilation and ESLint checks pass with 0 errors.
