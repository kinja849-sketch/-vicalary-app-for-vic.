# Implementation Prompt: Move Head Scripts to Client Lifecycle to Eliminate Hydration Mismatch

## Problem Summary
Next.js App Router emits:
`Warning: Prop dangerouslySetInnerHTML did not match. Server: "" Client: "(self.__next_s=self.__next_s||[])..."`

Placing `<Script>` with inline `dangerouslySetInnerHTML` inside `<head>` in `app/layout.tsx` causes Next.js client-side script loader hydration mismatches because `<Script>` is designed to be rendered in `<body>` or handled through React client lifecycles.

## Proposed Changes

### 1. `the-app-belong-to-vic--main/app/layout.tsx`
- Remove inline `<Script>` elements from `<head>`, leaving `<head>` clean.
- Place `<Script src="https://cdn.lordicon.com/lordicon.js" strategy="lazyOnload" />` inside `<body>`.

### 2. `the-app-belong-to-vic--main/components/GlobalProviders.tsx`
- Add a client-side `useEffect` hook to handle:
  1. Netlify drawer and banner element suppression via `MutationObserver`.
  2. Plaid duplicate script warning suppression.
- Because `GlobalProviders` is `"use client"`, running these in `useEffect` executes purely on the client with zero SSR DOM discrepancies or hydration mismatch warnings.

## Verification Plan
1. **Automated / Build Checks**:
   - Run Next.js TypeScript compilation check (`npx.cmd tsc --noEmit`).
2. **Localhost Verification**:
   - Refresh `http://localhost:3000`.
   - Verify that all hydration warnings (`dangerouslySetInnerHTML` mismatch, `id` mismatch) are completely gone.
