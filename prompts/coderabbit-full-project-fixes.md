# Implementation Prompt: Full CodeRabbit Audit Resolution

## Overview
Address all 120 line-by-line review findings produced by CodeRabbit across the VICALARY codebase (Pull Request #4).

## 1. Security & Privacy Hardening
- **`.gitignore` & `.env.example`**:
  - Add comprehensive `.env.*` rules to `.gitignore` to prevent any production secrets from ever being tracked.
  - Remove any placeholder patterns in `.env.example` that might encourage client exposure of secret keys.
- **Authentication & Authorization**:
  - Enforce authenticated session checks on all sensitive API routes (`/api/banking/plaid/*`, `/api/banking/brankas/*`, `/api/coach-reply`, `/api/send-otp`, `/api/verify-otp`, `/api/auth/signup`).
  - Ensure user IDs extracted from verified session tokens match request bodies to prevent IDOR vulnerabilities.
- **Service Role & Token Protection**:
  - Remove any raw service-role key usage in client-callable files or scripts.
  - Ensure banking access tokens and refresh tokens are stripped from all API client responses.

## 2. API Routes & Service Robustness
- **`app/api/coach-reply/route.ts` & Supabase functions**:
  - Validate input payload limits, sanitize message history, and enforce timeout fallbacks for OpenAI/Gemini requests.
- **`app/api/cooking-assistant/*` (image, transcribe, tts, chat)**:
  - Add request body validation and mime-type verification.
  - Guard against buffer overflows and memory leaks in voice/audio streams.
- **`lib/services/BudgetEngine.ts` & `lib/api/budget.ts`**:
  - Fix edge-case zero-division and rounding errors in budget calculation percentages.
  - Handle null/undefined transaction amounts safely with fallback zero defaults.
- **`lib/api/auth.ts` & `app/_pages/Auth.tsx`**:
  - Fix routing fallback so transient network sync errors do not mistakenly redirect authenticated users to onboarding.
  - Add `name` and `autoComplete` attributes for accessible form autofill.
  - Ensure all form placeholders use localized translation keys (`t(...)`).

## 3. UI, State & Component Stability
- **`app/_pages/Dashboard.tsx` & `app/_pages/Cookbook.tsx` & `app/_pages/RecipeDetails.tsx`**:
  - Clean up unmounted audio contexts, canvas animation frames, and timer listeners to prevent memory leaks.
  - Ensure safe array indexing when displaying recipe steps, macronutrient charts, and category filters.
- **`store/analysisStore.ts` & `store/coachInjectionStore.ts`**:
  - Add schema guards for stored analysis objects to avoid rendering errors on corrupt local storage data.
- **`app/FoodCarousel.css`**:
  - Clean up vendor prefixes and optimize layout transitions.

## 4. Verification Plan
- Run full TypeScript compilation (`npm run typecheck` / `tsc --noEmit`).
- Run linting and automated sanity tests across API endpoints and translation dictionaries.
- Validate authentication and flow on localhost:3000.

## 5. Deployment Approval
- Review summary of all changes with the user.
- Await explicit user approval before pushing fixes to GitHub.
