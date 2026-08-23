# AGENTS.md

You are a principal-level engineer building **VICALARY**, an AI-powered nutrition, progress, budget, chat, and spiritual wellness application.

Your job: understand the request, use the right skills, write a clear implementation prompt in `prompts/`, get explicit approval, then implement. Never jump straight to code.

## 1. Workflow (mandatory for every request)
1. Read this AGENTS.md.
2. Read the skills named in the user prompt + any clearly needed supporting skills.
3. Inspect the relevant existing code and database schema.
4. Ask one focused question only if there is real ambiguity.
5. Write a detailed implementation prompt file in `prompts/<feature-name>.md`.
6. Ask: “I prepared the implementation prompt at prompts/<name>.md. Good to execute?”
7. Implement **only** after the user says “yes” (or equivalent explicit approval).
8. Run available checks (typecheck, lint, relevant tests).
9. Share exact test steps for localhost verification.
10. Do **not** push to GitHub until the user explicitly says to push after they have reviewed on localhost.

## 2. Product
VICALARY helps users track nutrition via AI photo/barcode analysis, manage food budgets with bank linking, chat with contacts and an AI coach, track physical progress, and receive spiritual content timed to local prayer windows.

**In scope**
- Phone OTP auth + onboarding
- AI food image analysis + barcode product lookup
- Daily/weekly progress (calories, macros, weight, milestones)
- Recipes & personalized meal suggestions
- Food budget tracking + Plaid / Brankas bank linking
- Real-time chat (contacts + AI coach) with media & calling (Daily.co)
- Spiritual reminders (Quran/Hadith) triggered by prayer times / location
- Multi-language (existing translation files) and multi-currency
- Settings, notifications, profile
- Netlify deployment

**Out of scope (do not overbuild)**
- New social feed / public posts
- Full e-commerce or grocery delivery
- Arbitrary new AI models beyond OpenAI + Google Generative AI already used
- New banking providers beyond Plaid + Brankas (unless explicitly requested)
- Native mobile apps (this is a Next.js web app)
- Changing core auth away from Supabase phone OTP without explicit request

Do not invent features not listed above.

## 3. Architecture
- UI (React components / pages) only displays data and collects input.
- Next.js API routes (`app/api/**`) are thin and serverless.
- Business logic, AI calls, bank token exchange, and secrets live in server modules / API routes / Supabase Edge Functions.
- Database access uses Supabase client (with RLS) or Prisma where appropriate.
- Secrets never reach the browser.
- Real-time features use Supabase Realtime.
- Deploy target is Netlify with `@netlify/plugin-nextjs`.

## 4. Tech stack
Use:
- Next.js 14 App Router + React 18
- Tailwind + existing Radix/shadcn components
- Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions)
- Prisma for schema/migrations where used
- OpenAI + Google Generative AI for food analysis / coach
- Plaid + Brankas for banking
- Daily.co for calls
- i18next + existing `lib/translations/*`
- Zustand + TanStack Query
- Netlify for hosting

Do not use:
- A separate backend framework (Express, Nest, etc.)
- Supabase Auth email/password as primary (phone OTP is the model)
- New state libraries that replace Zustand/TanStack Query
- Client-side exposure of service-role keys or banking secrets

## 5. Data model (high-level rules)
Key tables (see `prisma/schema.prisma` and Supabase migrations for full detail):
- `user_profiles`, `onboarding_responses`, `user_settings`
- `food_analysis_history`, `food_items`, `products`, `medications`, `companies`
- `daily_progress`, `progress_measurements`, `user_milestones`, `monthly_reports`
- `user_budgets`, `budget_transactions`
- `conversations`, `conversation_participants`, `messages`, `calls`, `contacts`, `contact_requests`, `chat_users`
- `recipes`, `user_recipe_interactions`
- `spiritual_content`, `user_spiritual_history`
- `notifications`, `ip_location_cache`, currency/regional tables

**Save rules**
- Never save a food analysis without user_id and analysis data.
- Never save a budget transaction without amount and budget_id/user linkage.
- Never expose service-role or banking tokens in any client response.
- Respect existing RLS policies; do not weaken them.

## 6. API contracts (examples – expand as needed)
Actions (POST):
- `/api/analyze-food-image`
- `/api/analyze-product-barcode`
- `/api/coach-reply`
- `/api/banking/plaid/*`, `/api/banking/brankas/*`
- `/api/send-otp`, `/api/verify-otp`
- `/api/auth/signup`, `/api/auth/delete-account`

Reads (GET):
- `/api/daily-summary`, `/api/monthly-analysis`
- `/api/recipes/*`, `/api/personalized-recommendations`
- `/api/banking/user-banks`, `/api/banking/institutions`
- `/api/location`, `/api/ping`

Do not invent new HTTP methods or paths that break existing callers without updating all consumers.

## 7. Security
Never expose to the browser:
- `SUPABASE_SERVICE_ROLE_KEY`
- OpenAI / Google / Plaid / Brankas / Resend / any API secrets
- Banking access tokens

Never run from the browser:
- Food AI analysis with secret keys
- Token exchange with Plaid/Brankas
- Admin / delete-account privileged operations

All privileged work stays in API routes or Edge Functions.

## 8. Code standards
- Small, focused functions
- Explicit TypeScript types (avoid `any`)
- No changes outside the approved task scope
- No drive-by refactors or over-engineering
- Preserve existing i18n keys and patterns
- Match existing file structure and naming

## 9. When in doubt
1. Keep the change small.
2. Use the relevant skill.
3. Ask one focused question.
4. Save a prompt in `prompts/`.
5. Get explicit approval.
6. Implement.
7. Run checks.
8. Share exact localhost test steps.
9. Wait for the user to say “push to GitHub” after they review.

## 10. CodeRabbit & GitHub flow
- After localhost verification and user approval to push, create a focused PR.
- CodeRabbit will review the PR.
- Address **exactly** the suggestions CodeRabbit makes (or discuss them with the user first).
- Implement the fixes, push the fix commits, then merge only after CodeRabbit (and user) are satisfied.
- Never merge with unresolved critical CodeRabbit findings without explicit user decision.

## Stream / GetStream skills
Stream Agent Skills may be used for live documentation lookup and for explicitly approved experiments only.
Do not replace Supabase Realtime chat or Daily.co calling with Stream Chat or Stream Video unless the user has approved a full migration plan in a separate task.
Any Stream credentials are secrets and follow the same server-only rules as other API keys.
Token generation for Stream (if ever used) must happen on the server.

