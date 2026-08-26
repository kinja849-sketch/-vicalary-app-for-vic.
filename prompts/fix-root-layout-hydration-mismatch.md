# Implementation Prompt: Fix Root Layout Script Hydration Mismatch

## Problem Summary
During page hydration, React emits a warning:
`Warning: Prop id did not match. Server: "null" Client: "suppress-netlify-banner"`

In Next.js 14 App Router (`app/layout.tsx`), inline `<script>` tags in `<head>` with `id` attributes cause hydration attribute discrepancies when rendered without Next.js `<Script>` or `suppressHydrationWarning`.

## Proposed Changes

### `the-app-belong-to-vic--main/app/layout.tsx`
- Replace raw `<script>` tags with Next.js `next/script` (`<Script strategy="beforeInteractive" ... />`) or add `suppressHydrationWarning` to the inline scripts.
- Use `import Script from "next/script"` for both external scripts (`lordicon.js`) and inline initialization scripts (`suppress-netlify-banner` and `suppress-plaid-warn`).

## Verification Plan
1. **Automated / Build Checks**:
   - Run Next.js TypeScript check (`npx.cmd tsc --noEmit`).
2. **Localhost Verification**:
   - Refresh `http://localhost:3000`.
   - Verify that the console no longer emits `Warning: Prop id did not match. Server: "null" Client: "suppress-netlify-banner"`.
