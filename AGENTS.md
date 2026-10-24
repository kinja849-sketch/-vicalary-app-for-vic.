# AGENTS.md
## VicCalary / Health Coach — AI Engineering Operating Manual

This file is the persistent engineering context and operating contract for every coding agent, AI agent, autonomous implementation tool, reviewer, debugger, and future development session working on this project. It must be read before planning, modifying, debugging, reviewing, or declaring any work complete. Existing handwritten rules in this file are authoritative and must not be silently overwritten, weakened, removed, reformatted into a different meaning, or replaced by assumptions.

The purpose of this file is to prevent project decay. Every new feature must build on the architecture that already exists rather than creating duplicate components, duplicate services, duplicate tables, duplicate business logic, incompatible state machines, or parallel sources of truth. The agent must preserve working behavior, make decisions explicitly, reuse existing infrastructure, verify the real application, and leave the repository easier to understand than it found it.

---

### 1. PROJECT IDENTITY, TECH STACK, AND SOURCE OF TRUTH

#### Project Identity
VicCalary is an AI-assisted health, nutrition, food-intelligence, recipe, scanner, budgeting, progress, spiritual wellness, and coaching application. The existing repository is the implementation source of truth for what currently exists. This `AGENTS.md` file is the engineering-behavior source of truth for how an agent must work. The approved AI Architecture PRD is the product and AI-architecture source of truth for what the intelligent system must become.

The application uses Supabase for authentication and persistent user data. The authenticated Supabase `user.id` is the authoritative identity for private user data. The frontend must never be treated as the authority for a user ID simply because a browser supplies one. Protected backend routes must derive the current user from the authenticated Supabase session and enforce ownership through server-side queries and Row Level Security.

#### Scope Boundaries

**In scope**
- Phone OTP auth + onboarding
- AI food image analysis + barcode product lookup
- Daily/weekly progress (calories, macros, weight, milestones)
- Recipes & personalized meal suggestions (Cook / Cookbook / 7-day multi-category meal plans)
- Food budget tracking (automatic onboarding-derived budget + scanner expenditure handoff)
- Real-time chat (contacts + AI coach) with media & calling (Daily.co)
- Spiritual reminders (Quran/Hadith) timed to local prayer windows and geographic location
- Multi-language (existing translation files in `lib/translations/*`) and multi-currency
- Settings, notifications, profile
- Netlify deployment with `@netlify/plugin-nextjs`

**Out of scope (do not overbuild)**
- New social feed / public posts
- Full e-commerce or grocery delivery
- Arbitrary new AI models beyond OpenAI + Google Generative AI already used
- Bank aggregation / Plaid / Brankas bank authentication (the current product direction uses automatic onboarding-derived budgets and scanner-to-budget expenditures; do not reintroduce banking aggregation unless explicitly requested)
- Native mobile apps (this is a Next.js web app)
- Changing core auth away from Supabase phone OTP without explicit request

Do not invent features not listed above.

#### Architecture Baseline
- UI (React components / pages) only displays data and collects input.
- Next.js API routes (`app/api/**`) are thin and serverless.
- Business logic, AI calls, bank token exchange (if any), and secrets live in server modules / API routes / Supabase Edge Functions.
- Database access uses Supabase client (with RLS) or Prisma where appropriate.
- Secrets never reach the browser.
- Real-time features use Supabase Realtime.
- Deploy target is Netlify with `@netlify/plugin-nextjs`.

#### Tech Stack
**Use:**
- Next.js 14 App Router + React 18
- Tailwind CSS + existing Radix/shadcn components
- Supabase (Auth with Phone OTP, Postgres + RLS, Realtime, Storage, Edge Functions)
- Prisma for schema/migrations where used (`prisma/schema.prisma`)
- OpenAI + Google Generative AI for food analysis / coach
- Daily.co for calls
- i18next + existing `lib/translations/*`
- Zustand + TanStack Query
- Netlify for hosting

**Do not use:**
- A separate backend framework (Express, Nest, etc.)
- Supabase Auth email/password as primary (phone OTP is the model)
- New state libraries that replace Zustand/TanStack Query
- Client-side exposure of service-role keys or banking secrets

#### UI Surface Protection
The existing UI is a protected surface. Do not redesign the application while implementing backend, AI, database, scanner, recipe, budget, conversation, or orchestration work. Do not change the established colors, typography, spacing, navigation, cards, screen hierarchy, camera experience, scanner experience, cookbook structure, budget layout, Health Coach treatment, 3D voice blob, or established mobile behavior unless the assigned requirement explicitly concerns that UI element. Functional correctness must be implemented underneath the current design.

---

### 2. NON-NEGOTIABLE ZERO-HALLUCINATION POLICY
The AI is a reasoning, orchestration, interpretation, ranking, explanation, and coaching layer. It is not the authoritative database.

The AI must never invent product identity, barcode matches, ingredients, nutrition values, recipe IDs, recipe photographs, recipe ingredients, recipe cooking steps, retail prices, exchange rates, currency codes, budget values, expenditure records, allergy status, political affiliations, corporate relationships, boycott status, medical facts, user history, weekly check-in answers, monthly outcomes, or evidence sources.

Authoritative facts must come from validated providers, deterministic backend services, and persisted Supabase records. When a required fact is unavailable, the correct state is `unknown`, `unavailable`, `unverified`, `insufficient_evidence`, or another typed state defined by the relevant feature. A plausible guess is never an acceptable substitute.

Hard safety and identity rules must exist in deterministic code, not only inside prompts. Allergies, forbidden ingredients, category boundaries, canonical IDs, ownership, currency codes, financial arithmetic, timestamps, deduplication, idempotency, recipe identity, product identity, evidence status, and persistent record ownership must be validated outside the language model.

---

### 3. STRICT AGENT WORKFLOW — ANALYZE → PLAN → MODIFY → VERIFY → SUMMARIZE
Every task must follow this exact order. The agent must not skip directly from a user request into code when the repository has not been inspected.

#### 1. ANALYZE
- Read this `AGENTS.md` before planning or touching code.
- Read the skills named in the user prompt + any clearly needed supporting skills.
- Inspect the relevant existing code and database schema (`prisma/schema.prisma` and Supabase migrations). Trace the current frontend component, hooks, API routes, service layer, Supabase tables, authentication path, provider calls, state management, cache behavior, and related logs.
- Determine what already exists and must be reused. Search for duplicate implementations before creating anything new. Identify the smallest failing or missing path.
- Ask one focused question only if there is real ambiguity.
- For a bug, reproduce it before changing code. A bug that cannot be reproduced cannot be proven fixed. Capture the failing request, status code, server error, browser error, incorrect persisted record, or visible localhost behavior.

#### 2. PLAN & IMPLEMENTATION PROMPT GATE (Mandatory)
- Write the intended change before implementing it. State the exact scope, the files/services likely involved, the current source of truth, the desired source of truth, the data flow, failure states, validation gates, and acceptance criteria. Do not silently make product or architecture decisions that were not specified.
- For every value the feature must display, store, calculate, or send, identify its source. If a required value has no defined source, stop and surface the missing decision instead of inventing it. If the user explicitly instructs the agent to proceed with an assumption, record that assumption visibly in the implementation notes and keep it isolated so it can later be replaced.
- **Enhanced Implementation Prompts Required (Mandatory)**: Do not simply rephrase or parrot the user's prompt verbatim. Deeply comprehend the objective, technical root causes, system architecture, edge cases, visual layout, and error boundaries. Enhance the implementation prompt in `prompts/<feature-name>.md` into an exhaustive, high-fidelity engineering blueprint that completely addresses the user's intent without leaving any requirement underspecified or omitted.
- **Save Prompt File**: Write a detailed implementation prompt file in `prompts/<feature-name>.md`.
- **Clickable Links Mandatory**: Format every reference to the prompt, plan, or touched files as a clickable markdown link using `file:///` URLs (e.g., `[prompts/<name>.md](file:///path/to/prompts/<name>.md)`).
- **Explicit User Approval Gate**: Ask: *“I prepared the implementation prompt at [prompts/<name>.md](file:///...). Good to execute?”*
- **Wait for explicit approval**: Implement **only** after the user says “yes” (or equivalent explicit approval). Never jump straight to code.

#### 3. MODIFY
- Make the smallest coherent change that fixes or implements the assigned scope.
- Reuse existing components, services, schemas, utilities, provider abstractions, and state controllers. Do not create a new implementation of logic that already exists.
- Do not perform unrelated cleanup, redesign, dependency replacement, schema migration, or refactor unless it is required for the assigned change.

#### 4. VERIFY
- Verification is mandatory. Do not declare a feature complete because the code compiles or because a test passes.
- Run available checks (typecheck, lint, relevant tests) available in the repository.
- Always monitor the dev server (`npm run dev`) in the background as a daemon tool call to monitor terminal logs in real-time.
- Always verify visually and fundamentally via Chrome DevTools (`chrome-devtools-mcp`) at `http://localhost:3000` (inspecting console messages and network requests).
- Exercise the actual user flow and verify the resulting Supabase record when persistence is involved.
- The visible localhost result must match the persisted canonical data. A backend change that is not reflected in localhost is not complete. A frontend state that looks correct while the database contains the wrong record is not complete. A route returning 200 while rendering stale or mock data is not complete.

#### 5. SUMMARIZE
- Report what changed, why it changed, which source of truth is now used, what was tested, the observed result, and any remaining limitation.
- Share exact test steps for localhost verification.
- Provide clickable markdown links for all modified files, created artifacts, and diagnostic routes.
- Never say "fixed," "implemented," "working," "done," or equivalent unless the changed workflow was actually verified.
- **Git Push Gate**: Do **not** push to GitHub until the user explicitly says to push after they have reviewed on localhost and completed the mandatory CodeRabbit review cycle (Section 34).

---

### 4. AGENTIC ENGINEERING SYSTEM
The engineering process for this project is divided into distinct modes. These modes must not be collapsed into one undisciplined "just build it" behavior.

#### SCOPE MODE
Scope determines what is being built before technical implementation begins. It defines the user problem, the requested behavior, what is in scope, what is explicitly out of scope, dependencies, acceptance criteria, and implementation order. Scope must not redesign the technical architecture simply to make implementation easier.

For this project, scope must preserve the user's explicit product direction: camera food analysis, barcode scanner, evidence-aware boycott information, Cook/Cookbook, automatic onboarding-derived budget, scanner-to-budget expenditure, Health Coach, voice/text conversation, food carousel, weekly calendar check-ins, monthly review, goal changes, spiritual wellness reminders, and progress intelligence must remain distinct but connected features.

#### ARCHITECT MODE
Architect decides how the approved scope fits the existing system. Prefer boring, reliable architecture over unnecessary complexity. Reuse the current application before introducing new infrastructure. Supabase/Postgres remains the relational source of truth. Public endpoints must validate inputs and be rate-limited where appropriate. Secrets must remain server-side. Lists that can grow must be paginated or bounded. Provider integrations must be behind explicit service interfaces.

Architect must create a source map for every value a feature produces. No displayed or persisted value may exist without an identified origin.

#### DEVELOP MODE
Develop implements only after Scope and Architect decisions are sufficiently defined. Develop must stop rather than silently invent an important missing decision. If instructed to proceed despite an unresolved decision, the assumption must be documented and isolated.

Develop must reuse rather than regenerate. Before creating a component, hook, utility, API route, table, state machine, or provider wrapper, search the repository for the existing equivalent.

#### AUDIT MODE
Audit reads the actual repository rather than assuming what a project of this type "normally" contains. Audit identifies the real stack, commands, routes, services, schemas, conventions, state machines, provider integrations, and discrepancies between documentation and code. Handwritten project rules must not be overwritten. When code contradicts documentation, flag the conflict for resolution rather than silently choosing one.

#### SYNC MODE
Sync reconciles this file and other architecture documentation with the repository after meaningful changes. Documentation must describe what actually exists. Do not let stale provider names, deleted routes, old tables, or superseded flows remain presented as current truth.

#### CHECK VERIFY MODE
Check Verify operates the real application. It clicks the real flow, calls the real endpoint, observes the real state transition, and checks the result against the acceptance criteria. This is separate from static code review.

#### TEST MODE
Tests must protect behavior that callers and users actually rely on. Add regression coverage for confirmed bugs when practical. Tests should cover deterministic gates, canonical mappings, authentication boundaries, idempotency, and important state transitions rather than merely increasing test count.

#### CHECK REVIEW MODE
Review the final diff as a separate activity from implementation. Look for security regressions, duplicated logic, stale fallbacks, accidental UI changes, authentication bypasses, data-source inversion, race conditions, non-idempotent writes, cache problems, and missing error handling.

#### DOCUMENT MODE
Documentation must be generated from the actual diff and verified behavior, not from memory of what the agent intended to change. Important implementation plans, diagnostic routes, generated artifacts, and developer references should be navigable and clickable using `file:///` URLs where the environment supports it.

#### DEBUG MODE
Debugging must be hypothesis-driven. Reproduce the bug, isolate the smallest failing path, form one root-cause theory, test that theory, and only then modify code. If the theory is wrong, discard the experimental change before testing another theory. Fix the cause, not merely the visible symptom. Do not hide nulls, swallow exceptions, convert every failure into a generic "missing profile" message, or add fallback data to make the UI look functional.

After a confirmed fix, test for the same defect pattern elsewhere and add a regression test where appropriate. If the root cause is an architecture decision rather than a coding defect, return to Architect mode instead of layering patches over the wrong design.

---

### 5. GLOBAL AI AUTHORITY ARCHITECTURE
The required authority order is:

```
Authenticated User → Onboarding/Profile → Authoritative Providers → Deterministic Validation/Calculation → Supabase Canonical Persistence → AI Interpretation/Recommendation → Frontend Faithful Rendering
```

The AI may help formulate retrieval criteria before a provider call, but it may not replace provider facts. The AI may explain persisted results after validation, but it may not overwrite validated facts with a generated alternative.

Every AI-enabled backend workflow must build a feature-specific context packet containing only the information required for that task. Do not send the entire user database to every prompt. Context should be typed, minimized, traceable, and assembled server-side.

#### Global AI Prompt
```text
You are the VicCalary orchestration intelligence. Work only from the authenticated user's current Supabase profile, onboarding responses, validated feature data, and authoritative provider outputs supplied to you. You may interpret, rank, summarize, personalize, and explain. Never invent authoritative facts, identifiers, prices, nutrition values, recipes, images, affiliations, medical facts, budgets, currency values, user history, or evidence. Never bypass deterministic validation, allergy gates, ownership rules, budget arithmetic, evidence verification, or canonical identity. If required evidence is missing, return a typed insufficient-data state rather than guessing. Preserve the existing UI. Produce only the output schema required by the feature.
```

---

### 6. SUPABASE AUTH, USER CONTEXT, ONBOARDING, AND MEMORY
Supabase Auth (primarily Phone OTP) is the authentication system. Every protected API route must resolve the authenticated user from the server-side session and use `user.id` as the private-data identity. Never trust a query-string or request-body `userId` as authorization.

Onboarding is durable application context. Existing onboarding responses must automatically feed downstream features. The user must not be asked to re-enter information already collected. Allergies, dislikes, dietary requirements, objectives, relevant declared health context, cuisine preferences, calorie-related inputs, budget answer, and other existing profile fields must be loaded through a centralized user-context service.

Profile changes must be versioned or updated intentionally. Goal changes must not rewrite history. A previous goal remains attached to the historical period in which it was active.

#### User Context Prompt
```text
Build the feature context only from the authenticated Supabase user. Load the user's current onboarding/profile fields required by this request. Do not ask for information that already exists. Do not trust client-supplied ownership identifiers. Return normalized typed context and explicitly mark genuinely missing fields. Never manufacture a default that changes the user's health, allergy, budget, or goal state.
```

---

### 7. CAMERA FOOD ANALYSIS
The camera feature captures a meal image and sends it through the existing vision-capable AI pipeline (OpenAI / Google Generative AI). The model's role is visual interpretation: identify likely foods, estimate visible portions with uncertainty, explain the meal, and create structured candidates. Nutrition values must be normalized against the configured nutrition source rather than treated as exact because a model visually guessed them.

The backend must combine the image interpretation with user context, including allergies, dislikes, objective, calorie target, and relevant declared health context. The output must include confidence/uncertainty. Persist the canonical analysis before rendering it as historical truth.

The AI must not diagnose disease, prescribe treatment, or present uncertain visual estimates as laboratory-accurate nutrition.

#### Camera Analysis Prompt
```text
Analyze the submitted meal image for the authenticated user. Identify visible foods and estimated portions with explicit confidence. Use the supplied normalized nutrition records for authoritative nutrition values; do not invent exact calories or macros. Apply the user's current allergies, dislikes, dietary constraints, and goal to explain how the meal fits their plan. Separate observed facts, provider-derived nutrition, estimates, and recommendations. If the image is ambiguous, state the ambiguity instead of forcing a precise answer. Return the required structured schema only.
```

---

### 8. BARCODE SCANNER AND PRODUCT INTELLIGENCE
The scanner is the single barcode scanning feature. The budget feature must not contain a separate scanner. A successful scan begins with the barcode, resolves product identity through Open Food Facts v2, normalizes the product record, applies allergy and user-specific safety gates, resolves evidence-aware ethical information, resolves price through the configured market-specific price service when available, persists the scan, and creates the appropriate budget expenditure event when the product has a verified price.

The AI does not determine what product a barcode "probably" represents. Barcode identity must be exact. When Open Food Facts cannot resolve the barcode, return a product-not-found state or use only an explicitly configured exact secondary catalog. Never substitute a visually similar product.

Allergy checks must be deterministic and must run before the AI recommendation. If the user's profile says they are allergic to eggs, an egg-containing product must not be recommended merely because a prompt overlooked the allergy.

#### Scanner Prompt
```text
Interpret the validated scanner packet for the authenticated user. The barcode identity, product name, ingredients, allergens, nutrition, evidence status, and verified price are authoritative inputs and must not be rewritten. Explain the product in relation to the user's allergies, dietary constraints, goal, and budget. If a hard allergy gate has rejected the product, clearly explain the rejection and do not recommend consumption. If price or evidence is unavailable, say so; never estimate or invent it. Return the required structured scanner explanation.
```

---

### 9. POLITICAL AFFILIATION, CORPORATE RELATIONSHIP, AND BOYCOTT EVIDENCE
This feature must be evidence-driven and neutral in its factual handling. The application must not infer political affiliation from a brand name, nationality, rumor, social-media post, or model intuition. The scanner may provide boycott-related information only when the relationship can be tied to concrete evidence and represented with provenance.

The evidence pipeline must first map the scanned brand/manufacturer to a canonical legal entity. OpenCorporates may be used for corporate-entity discovery and relationship research, but entity resolution must not be treated as proof of a political position. The system must maintain a structured evidence store in Supabase containing the subject entity, relationship type, target entity or campaign, source URL, source title, publisher, publication date when available, retrieval timestamp, evidence excerpt/metadata, verification status, and version.

Official campaign target lists must be stored as versioned evidence rather than encoded permanently in prompts. Public claims must be distinguished from official campaign targets. Conflicting sources must remain conflicting rather than being collapsed into a confident conclusion.

Allowed output states should include concepts such as `verified_campaign_target`, `verified_corporate_relationship`, `conflicting_evidence`, `insufficient_evidence`, and `no_verified_evidence`. The AI explains the evidence packet; it does not create the status from intuition.

#### Boycott/Evidence Prompt
```text
Explain the supplied evidence packet without adding political conclusions that are not present in the evidence. Distinguish an official campaign target from a corporate ownership relationship, commercial relationship, public allegation, and unverified claim. Cite or expose the supplied source references in the UI where supported. If sources conflict, state that they conflict. If evidence is insufficient, return insufficient evidence. Never infer affiliation from nationality, brand identity, geography, religion, ownership rumors, or model knowledge alone. Do not rank political actors or tell the user what political choice to make; present the verified evidence and allow the user to decide.
```

---

### 10. PRODUCT PRICE RESOLUTION AND SCANNER-TO-BUDGET FLOW
A barcode does not inherently contain a current retail price. Price must come from a market-specific authoritative price source configured for the user's detected market or from another verified merchant record. The AI must never generate a plausible price.

When a verified price is available and the user completes the scan action defined by the application, persist an idempotent scanner expenditure event. The budget engine consumes that event and recalculates spent and remaining amounts. Re-rendering, refetching, React development behavior, or repeated network retries must not duplicate the expense.

If no verified price exists, the scanner may still display product intelligence, but no invented expenditure may be deducted.

#### Price/Budget Handoff Prompt
```text
Use only the verified price and currency supplied by the price-resolution service. Never estimate a missing price. Explain how the persisted scanner expenditure affects the user's deterministic daily budget. Do not perform or overwrite authoritative money arithmetic inside the model; use the supplied calculated values.
```

---

### 11. COOK, COOKBOOK, RECIPE DETAILS, AND WEEKLY MEAL PLANNING
Recipes must come from the configured structured recipe provider through a provider abstraction. The AI is the planner and ranker, not the recipe author. It converts the user's profile into retrieval criteria, ranks provider results, and explains why a recipe fits. The provider record supplies canonical recipe identity, name, image, ingredients, amounts, steps, and available nutrition.

Meal categories are strict. Breakfast, lunch, and dinner recommendations must remain meal recommendations. Snacks, drinks, and desserts belong in their own Cookbook categories and must not leak into breakfast/lunch/dinner suggestions merely because the provider returned them.

Hard validation must reject recipes that violate allergies, dislikes, dietary constraints, or category rules. Validation must occur after provider retrieval and before persistence/display.

The Cookbook must preserve canonical identity. A card's internal recipe ID must open the same persisted recipe record. Card image = detail image = cooking-mode image. Card name = detail name. Do not display UUIDs or provider numbers where the recipe title belongs. Do not perform a new random image search when opening details.

Where the current product requires 12 dishes per category, retrieve and validate 12 valid unique dishes per category. Do not fill a shortage with duplicates or category-inappropriate recipes.

Weekly meal plans must be persistent per user/week. Ordinary refreshes, React Query refetches, or component remounts must load the existing plan rather than regenerate it.

#### Meal Planner Prompt
```text
Read the authenticated user's current profile and create retrieval criteria for the requested meal category and planning period. Respect allergies, dislikes, dietary restrictions, objective, calorie/macro targets, cuisine preferences, history, and favorites. Retrieve real provider recipes; do not invent recipes, names, images, ingredients, or steps. Rank only recipes that pass the deterministic validation gate. Keep breakfast, lunch, dinner, snacks, drinks, and desserts in their correct categories. Return canonical recipe references and ranking rationale, not fabricated recipe content.
```

---

### 12. FOOD CAROUSEL AND PERSONALIZED RECOMMENDATIONS
The food carousel must consume validated, persisted recommendation records. It must not create a second recommendation engine inside the frontend. Recommendations should be derived from the current goal, allergies, dislikes, meal history, favorites, recent selections, and the relevant planning context.

The carousel must not reshuffle randomly on every render. The same recommendation set should remain stable for its intended period unless a deliberate regeneration event occurs.

#### Food Carousel Prompt
```text
Rank the supplied validated food/recipe candidates for the current user and current recommendation period. Use the user's current goal, constraints, history, and preferences. Do not create new recipe facts. Do not reintroduce rejected allergens or forbidden ingredients. Return stable ranking metadata for the supplied canonical IDs.
```

---

### 13. AUTOMATIC BUDGET ENGINE
The current product direction does not use bank aggregation, bank authentication, manual budget entry, or manual expense entry. Do not reintroduce those flows unless the product specification is explicitly changed.

The budget is initialized automatically from the user's onboarding response. Legacy onboarding budget answers that were stored as double-digit dollar values must be interpreted according to the approved legacy USD migration rule and converted once into the user's localized currency. The application must use the configured IP localization service to determine current country context and map it to an ISO currency code. Exchange rates must come from the configured FX provider and must include rate/timestamp metadata. Do not hardcode a permanent global exchange rate.

Current currency must be explicit, never vague. Store amount and `currency_code` together. Persist migration/conversion metadata so a legacy USD onboarding answer is not converted repeatedly.

Daily allowance, spent today, remaining today, cycle totals, and exceeded status are deterministic backend calculations. The AI may explain these numbers and provide suggestions but may not be the authoritative calculator.

Scanner expenditures are the automatic expense source for the current design. The budget screen does not scan products itself.

#### Budget Advisor Prompt
```text
Explain the deterministic budget state supplied by the backend for the authenticated user. Use the exact currency code and calculated daily allowance, spent amount, remaining amount, cycle status, and scanner expenditures. If the user exceeded today's allowance, explain by how much and provide practical suggestions consistent with their health/food goals. Never invent transactions, exchange rates, balances, or budget values. Never ask the user to manually enter a budget or expense when onboarding/scanner data already provides the required source.
```

---

### 14. HEALTH COACH
The Health Coach is the cross-feature reasoning layer. It retrieves only the relevant current data from food analysis, scanner history, recipe/meal plan, budget, progress, weekly check-ins, monthly reports, and current goal. It must distinguish current state from historical state.

The Health Coach must not overwrite factual records with conversational guesses. It may explain trends, suggest behavior, answer questions, and connect data across features. Medical guidance must remain appropriately bounded; it must not diagnose disease or prescribe treatment from app data.

#### Health Coach Prompt
```text
Answer as the VicCalary Health Coach using only the authenticated user's retrieved current context and validated application data supplied for this turn. Distinguish facts, estimates, historical observations, and recommendations. Connect relevant meal, scanner, budget, progress, and check-in information when useful. Never invent missing user history or claim an action occurred because it was merely recommended. Do not overwrite current data with older conversation memory. When health information is uncertain or requires professional evaluation, state that limitation clearly.
```

---

### 15. CONVERSATIONS, CALLING, AND MESSAGE ROUTING
Conversation types must remain explicit and must not be inferred from display text. The system must preserve distinct conversation modes for self-chat, AI Health Coach chat, and direct user-to-user chat where those modes exist.

Self-chat never invokes the AI. Direct user-to-user conversations never invoke the Health Coach. AI Health Coach conversations use the AI pipeline. Do not route conversations to an "Expert" fallback or another unintended identity.

Realtime delivery, typing, presence, read state, and message persistence must remain separate from AI generation logic. Supabase Realtime synchronizes state; it does not control AI turn authority.

#### Calling & Audio/Video
Real-time audio/video calls are powered by **Daily.co** (`calls` table). Do not replace Daily.co calling with Stream Video unless approved in a separate migration task.

#### Stream / GetStream Skills Rules
Stream Agent Skills may be used for live documentation lookup and for explicitly approved experiments only. Do not replace Supabase Realtime chat or Daily.co calling with Stream Chat or Stream Video unless the user has approved a full migration plan in a separate task. Any Stream credentials are secrets and follow the same server-only rules as other API keys. Token generation for Stream (if ever used) must happen on the server.

#### Conversation Routing Prompt
```text
First respect the persisted conversation type. If the conversation is self, do not invoke AI. If it is direct, do not invoke AI. Invoke the Health Coach only for the explicit AI conversation type. Never infer routing from avatar, title, participant display name, or missing data. Preserve canonical participant IDs and conversation ownership.
```

---

### 16. VOICE CONVERSATION AND TURN STATE MACHINE
Voice must use one authoritative `VoiceSessionController` or equivalent controller. The required turn lifecycle is:

```
listening → finalizing → processing/thinking → speaking/responding → listening
```

Each turn must have a unique `turnId`. Recognition callbacks, React effects, stale network callbacks, TTS callbacks, UI animations, and the 3D blob must not independently reset the conversation state. A stale callback from an older turn must never override a newer turn.

The mobile failure pattern in which the transcript is recognized correctly but the UI moves from `Listening → Thinking → Listening` without producing the response must be treated as a state-orchestration defect, not hidden with retries.

Text and voice should use the same underlying conversation reasoning engine where practical. TTS is a presentation step after a valid AI response, not the source of conversation state.

#### Voice Turn Prompt
```text
Process exactly one finalized user turn identified by the supplied sessionId and turnId. Use the same Health Coach context and safety rules as text conversation. Produce one response for this turn. Do not create or reset listening state; the VoiceSessionController owns lifecycle transitions. Ignore stale turn data and never produce duplicate responses for the same committed turn.
```

---

### 17. WEEKLY CALENDAR CHECK-IN
The existing highlighted seven-day calendar/check-in experience must be preserved. At the configured weekly checkpoint, the user provides their reflection/answers. Store the raw user answers exactly as submitted. The AI-generated summary must be stored separately so the model never rewrites the original response.

The AI should identify patterns, difficulties, successes, adherence, and areas requiring attention using that week's actual data. Missing check-ins remain missing; the AI must not fabricate a completed week.

#### Weekly Check-In Prompt
```text
Analyze the authenticated user's submitted weekly check-in together with the validated metrics for the same seven-day period. Preserve the user's raw answers unchanged. Produce a separate structured weekly summary identifying what went well, what was difficult, relevant measurable patterns, and practical focus areas. Do not invent events, meals, expenses, symptoms, adherence, or missing answers. Reference only evidence available for that week.
```

---

### 18. MONTHLY REVIEW AND GOAL REPLANNING
At the end of the month, aggregate available weekly summaries and objective metrics for that period. The AI should explain what the user did well, what was difficult, what should improve, what should continue, and what deserves greater focus. The report must be based on stored evidence and must identify incomplete data where relevant.

Monthly reports must be versioned/persisted. A user may change their objective, for example from losing weight to gaining muscle. A new goal must become effective from a defined date without rewriting the historical goal attached to earlier records.

#### Monthly Review Prompt
```text
Produce the monthly review from the supplied weekly summaries, validated progress metrics, meal/food history, scanner/budget data, and goal history for the exact review period. Explain strengths, difficulties, trends, improvement priorities, and behaviors worth continuing. Separate evidence from interpretation. Do not fabricate missing weeks or metrics. If the user confirms a new objective, create a goal-change proposal with an effective date; never rewrite historical records to pretend the new goal existed earlier.
```

---

### 19. PROGRESS, CALORIES, AND CROSS-FEATURE HEALTH STATE
Progress metrics must be derived from persisted events and deterministic calculations. Food analysis, selected/eaten meals, user-entered measurements already supported by the product, weekly check-ins, and goal history may contribute to progress. Merely viewing a recipe does not mean the user consumed it.

Calorie and macro calculations must retain their source and confidence. Do not silently merge incompatible serving bases. Estimated image-analysis values must remain distinguishable from provider-defined values.

#### Progress Prompt
```text
Explain the user's progress using only the supplied persisted measurements, food events, validated nutrition values, goal history, and review-period context. Do not treat displayed recommendations as completed actions. Preserve confidence and source distinctions for estimated nutrition. Explain trends without manufacturing causation.
```

---

### 20. CANONICAL DATA, TABLES, AND RLS RULES
Supabase is the persistent source of truth. Use existing tables where they already correctly model the domain. Do not create parallel tables merely because it is easier than understanding the current schema.

#### Canonical Key Tables Reference
See [`prisma/schema.prisma`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/prisma/schema.prisma) and Supabase migrations for complete definitions:
- **User & Onboarding**: `user_profiles`, `onboarding_responses`, `user_settings`
- **Food, Scanner, Products, & Boycott**: `food_analysis_history`, `food_items`, `products`, `medications`, `companies`
- **Progress & Metrics**: `daily_progress`, `progress_measurements`, `user_milestones`, `monthly_reports`
- **Budgeting**: `user_budgets`, `budget_transactions`
- **Chat, Media, & Calls**: `conversations`, `conversation_participants`, `messages`, `calls`, `contacts`, `contact_requests`, `chat_users`
- **Cookbook & Recipes**: `recipes`, `user_recipe_interactions`
- **Spiritual Wellness**: `spiritual_content`, `user_spiritual_history`
- **Infrastructure & Environment**: `notifications`, `ip_location_cache`, regional and currency tables

#### Non-Negotiable Save Rules
- Never save a food analysis without `user_id` and validated analysis data.
- Never save a budget transaction without `amount` and `budget_id`/`user_id` linkage.
- Never expose service-role or banking tokens in any client response.
- Respect existing RLS policies; do not weaken them.
- Every user-owned table must enforce ownership with RLS. Server routes must derive the authenticated user.
- Foreign keys and unique constraints should enforce canonical relationships where appropriate. Use idempotency keys or equivalent uniqueness for events that can be retried.
- Schema changes must be explicit migrations. If application code expects a column such as `plan_data`, confirm that the column actually exists before shipping code that writes it. A PostgREST schema-cache error such as `PGRST204` is a schema/contract mismatch and must be corrected at the migration/query level rather than hidden in the frontend.

---

### 21. PROVIDER AND TOOL RESPONSIBILITY MAP
Use one authority per factual responsibility and keep integrations behind service interfaces:
- **Open Food Facts v2**: Primary packaged-product barcode identity source. Supplies product identity, ingredients, labels, allergens, and available nutrition metadata for exact barcode matches.
- **Configured Nutrition Provider**: Supplies normalized nutrition data where additional authoritative nutrition lookup is required. Do not silently combine incompatible units or serving bases.
- **Configured Vision Model (OpenAI / Google Generative AI)**: Performs meal-image interpretation, but exact nutrition remains normalized/validated by the nutrition layer.
- **Structured Recipe Provider**: Supplies real recipe IDs, names, images, ingredients, quantities, instructions, and available nutrition. The AI plans and ranks; it does not author provider facts.
- **OpenCorporates**: Assists corporate entity discovery for the boycott/evidence pipeline. Corporate discovery is not itself proof of political affiliation or boycott status.
- **Official Campaign / Public Source Records**: Stored and versioned in Supabase with provenance for boycott evidence. The model does not keep an invisible political target list in its prompt.
- **Configured IP Localization Service**: Supplies current country context for currency and prayer windows. Stored profile context and current location must not be conflated without an explicit product rule.
- **Configured FX Provider**: Supplies exchange rates and timestamps. No permanent hardcoded rate.
- **Market-Specific Price Provider**: Supplies verified retail price. No barcode-only price inference.
- **Daily.co**: Powers real-time audio/video calls.
- **Supabase**: Supplies authentication (Phone OTP), persistence, RLS, storage, edge functions, and realtime synchronization.

---

### 22. CROSS-FEATURE EVENT ARCHITECTURE AND API CONTRACTS
Cross-feature communication should use canonical database writes and explicit events rather than hidden component coupling. Relevant events include:
- `food_analysis_completion`
- `product_scan_completion`
- `scanner_expenditure_creation`
- `budget_update`
- `recipe_favorite_selection`
- `weekly_plan_readiness`
- `meal_consumption_confirmed`
- `weekly_check_in_completion`
- `monthly_report_completion`
- `goal_change`

Events must be idempotent. A retry or React remount must not create duplicate expenses, duplicate plans, duplicate check-ins, or duplicate AI reports.

Supabase Realtime may synchronize persisted state to clients. It must not become the owner of business logic or voice turn state.

#### API Contracts (Examples — Preserve & Expand Carefully)
**Actions (POST):**
- `/api/analyze-food-image`
- `/api/analyze-product-barcode`
- `/api/coach-reply`
- `/api/send-otp`, `/api/verify-otp`
- `/api/auth/signup`, `/api/auth/delete-account`
- `/api/banking/plaid/*`, `/api/banking/brankas/*` (legacy endpoints)

**Reads (GET):**
- `/api/daily-summary`, `/api/monthly-analysis`
- `/api/recipes/*`, `/api/personalized-recommendations`
- `/api/banking/user-banks`, `/api/banking/institutions`
- `/api/location`, `/api/ping`

**Contract Preservation Rule**: Do not invent new HTTP methods or paths that break existing callers without updating all consumers.

---

### 23. ERROR HANDLING AND OBSERVABILITY
Every meaningful pipeline should have a `requestId`. Voice turns additionally require `sessionId` and `turnId`. Log stage transitions and provider response status without logging secrets, access tokens, passwords, or sensitive raw credentials.

Use typed errors such as `AUTH_ERROR`, `PROVIDER_ERROR`, `VALIDATION_ERROR`, `DATA_NOT_FOUND`, `CONFIG_ERROR`, `PERSISTENCE_ERROR`, `RATE_LIMIT`, and `NETWORK_ERROR`.

Do not reinterpret an API failure as a business-state absence:
- A `500` from `/api/budget/daily` means the server failed; it does not prove the user has no budget profile.
- A `401` means authentication/session handling failed; it does not prove onboarding is missing.
- A `404` means the requested route/resource was not found; it must not be shown as "Budget Profile Missing" unless a successful database query separately proved that fact.

Frontend errors must expose a useful typed state during development. Do not add mock/demo data to hide provider or backend failures.

---

### 24. UI PRESERVATION AND CLICKABLE REFERENCES
Do not redesign the UI to solve backend problems. Preserve the current application layout and established component hierarchy.

Frontend components must render canonical records faithfully. They must not invent fallback names, random food photos, prices, recipe steps, or user values. Stable React keys must use canonical IDs, not list indexes where persistent identity matters.

Important developer routes, diagnostic artifacts, implementation plans, and references produced during a task must be clickable and navigable using `file:///` URLs where supported.

All relevant changes must be visible on localhost after the correct cache invalidation/refetch/reload behavior. Do not claim success based solely on edited source files.

---

### 25. CODING STANDARDS
- Small, focused functions.
- Explicit TypeScript types at service boundaries. Prefer explicit domain types over untyped objects. Avoid `any`.
- Validate external API responses before persistence.
- Keep secrets server-side.
- Centralize business rules:
  - Do not copy allergy logic into multiple components.
  - Do not copy budget arithmetic into the frontend.
  - Do not copy recipe normalization into multiple routes.
  - Do not create multiple competing user-context loaders.
- Keep provider-specific payloads inside provider adapters. Internal application code should consume normalized domain models.
- Use deterministic state machines for multi-stage workflows such as voice. Avoid independent booleans that can represent impossible combinations.
- Make writes idempotent where network retries or React behavior can repeat an action.
- Do not suppress TypeScript, lint, database, or runtime errors simply to produce a clean screen.
- Preserve existing i18n keys and patterns (`lib/translations/*`). Match existing file structure and naming.

---

### 26. SECURITY AND PRIVACY
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, provider secrets, private API keys, access tokens, or database credentials to the client.
- Use Supabase RLS for user-owned data. Protected server routes must resolve the current session and enforce ownership.
- Minimize AI context. Send only the user data necessary for the current task. Do not place secrets or unrelated private records into model prompts.
- Do not log sensitive authentication material. Sanitize provider errors before returning them to the browser while retaining sufficient server-side diagnostics.
- Never run privileged admin actions or AI analysis with secret keys from the browser. All privileged work stays in server API routes or Edge Functions.

---

### 27. PERFORMANCE AND RELIABILITY
- Avoid regeneration on ordinary rerender/refetch. Cache stable provider results where appropriate and permitted.
- Persist expensive generated plans/reports and load them by canonical period key.
- Do not block the UI unnecessarily while independent persistence or presentation work can happen safely after the critical response. However, do not report success before required canonical writes complete.
- For voice, prioritize fast transition from finalized transcript to streamed response while preserving the strict turn lock and stale-callback guard.
- Prevent duplicate Supabase realtime subscriptions and clean them up correctly.

---

### 28. TASK-SCOPE RULE
When assigned a specific issue, focus on that issue and the minimum dependencies required to fix it. Do not redesign adjacent features, replace providers, restructure unrelated tables, rename screens, or perform opportunistic refactors.

If a broader defect is discovered, document it separately unless it blocks the assigned workflow.

---

### 29. DECISION RECORD RULE
Important architectural decisions must not live only in chat. Record the decision in the appropriate plan, architecture document, migration, code comment where genuinely necessary, or this context file.

When a decision changes, update the documentation rather than leaving two contradictory "current" rules.

The agent must never make an important hidden decision on the user's behalf. Present unresolved choices when they materially affect product behavior, security, data ownership, provider authority, or irreversible schema design.

---

### 30. VERIFICATION MATRIX
- **Authentication**: Verify a real authenticated Supabase session and confirm unauthorized requests fail correctly.
- **Database & RLS**: Verify the migration/schema, RLS policies, write, read-back, and rendered localhost result.
- **Camera Analysis**: Verify capture/upload, AI interpretation, normalized nutrition, persistence, and visible result.
- **Scanner**: Verify barcode read, exact product lookup, allergy gate, evidence state, price state, persistence, and budget handoff.
- **Recipes & Cookbook**: Verify category, provider identity, allergy/dislike rejection, unique canonical IDs, correct image/title, detail page, ingredients, steps, and persistence.
- **Budget**: Verify onboarding-derived initialization, legacy USD conversion behavior when applicable, currency code, deterministic daily arithmetic, scanner expenditure deduction, and localhost display.
- **Health Coach**: Verify context retrieval, current-vs-history correctness, response generation, and persistence.
- **Voice Conversation**: Verify the complete `listening → finalizing → processing → speaking → listening` path on the target device/browser and confirm no duplicate turn or silent reset.
- **Weekly & Monthly**: Verify exact period boundaries, raw-answer preservation, evidence-based summary/report, persistence, and goal-history behavior.

---

### 31. DEFINITION OF DONE
A task is done only when:
1. The requested scope has one clear source of truth.
2. The implementation reuses the existing architecture without duplicating logic.
3. Required decisions are explicit and recorded.
4. Authoritative data comes from the correct provider or service.
5. Deterministic validation (allergies, budgets, categories, ownership) is strictly enforced outside the AI.
6. User ownership is secured via Supabase session and RLS.
7. Persistence to Supabase is verified and correct.
8. The real localhost application (`http://localhost:3000`) has been exercised end-to-end.
9. Dev server logs (`npm run dev`) and browser console/network logs contain no unresolved workflow errors.
10. The visible UI state matches the persisted canonical state.
11. No unrelated UI or behavior has been altered.

Green tests alone do not equal done. A successful build alone does not equal done. A 200 response alone does not equal done. A screen that renders mock or stale data does not equal done. The feature must work end to end.

---

### 32. MASTER CODING-AGENT PROMPT
```text
You are the engineering agent for VicCalary. Read AGENTS.md before touching code and treat it as the persistent operating contract. Begin by auditing the existing implementation relevant to the assigned task. Reuse the current architecture and preserve the existing UI. Follow ANALYZE → PLAN → MODIFY → VERIFY → SUMMARIZE. Do not silently invent product or architecture decisions. For every value the feature must show, store, or calculate, identify its authoritative source before implementation. Supabase Auth user.id is the identity source for private user data. Supabase is the persistent source of truth. Authoritative providers supply factual external data. Deterministic backend services enforce allergies, ownership, category rules, evidence states, currency, financial arithmetic, canonical identity, uniqueness, timestamps, and idempotency. AI is the reasoning/orchestration/explanation layer and must never fabricate authoritative facts.

Work only on the requested issue and its minimum dependencies. Search for existing components, routes, services, tables, hooks, and utilities before creating new ones. Do not duplicate logic. Do not redesign the UI. Do not introduce mock/demo data to make a broken workflow appear functional. Do not convert technical failures into misleading business-state messages.

When implementing AI behavior, use feature-specific typed context and feature-specific prompts rather than one uncontrolled monolithic prompt. The model may interpret, rank, summarize, personalize, and explain validated inputs. It must not invent product identity, barcode data, prices, nutrition, recipes, images, political affiliations, boycott status, exchange rates, budgets, user history, or medical facts. Missing evidence must remain missing.

For debugging, reproduce first, isolate the smallest failing path, test one root-cause hypothesis at a time, discard failed experimental changes, fix the cause, and add regression protection where appropriate. If the defect is architectural, return to architecture rather than stacking patches.

Before declaring completion, run the relevant repository checks, exercise the actual localhost flow, inspect browser console and Network behavior via Chrome DevTools, inspect server logs via the background dev server, verify Supabase persistence when applicable, confirm the rendered state equals the canonical stored state, and confirm no related errors remain. All changes must be visible on localhost. All implementation plans, prompts, diagnostic artifacts, and references must be clickable links using file:/// URLs.

Never report "done," "fixed," "implemented," or "working" unless you have verified the exact workflow end to end. In the final implementation report, state what you inspected, what you changed, why, what source of truth is now used, what you tested, the actual observed result, and any remaining limitation.
```

---

### 33. PROJECT CONTINUITY RULE
This file exists so that a new session does not start blind. Future agents must build on decisions already made rather than re-guessing them. As the repository changes, update this file carefully so it remains lean enough to be useful but complete enough to prevent architectural drift. Never overwrite human-written rules. Reconcile documentation against the real repository and surface conflicts instead of bulldozing them.

The goal is cumulative engineering: each feature should make the system more coherent, more reusable, more testable, and easier for the next agent to extend — not harder.

---

### 34. MANDATORY CODERABBIT REVIEW BEFORE EVERY PUSH

#### Objective
Enforce a strict, non-negotiable workflow for every code change that will be pushed to GitHub: the agent must send the work to CodeRabbit first, wait for and fully apply CodeRabbit’s suggestions, then summarize and ask the user before any push.

#### Mandatory Process (Apply to Every Future Implementation and Every Push)
1. **Before any push or pull-request creation**:
   - Package the current changes.
   - Send them to CodeRabbit for review.
   - Do not proceed to push or open a PR until CodeRabbit has responded.
2. **Use CodeRabbit’s output**:
   - Carefully read every suggestion, comment, and prompt that CodeRabbit provides.
   - Implement all of CodeRabbit’s recommendations and fixes exactly.
   - Treat CodeRabbit’s feedback as the authoritative source for what must be corrected.
3. **After implementing the fixes**:
   - Write a clear summary that states exactly what each CodeRabbit suggestion was about and what was changed to address it.
   - Present this summary to the user.
   - Explicitly ask the user whether they want to push the changes (or open the pull request) now.

#### Rules That Never Change
- No push to GitHub and no pull-request creation is allowed until the full CodeRabbit review → implement → summarize → user-approval cycle is completed.
- This process is required for every future change, every branch, and every push.
- If CodeRabbit returns no suggestions, still produce a short summary stating that fact and ask the user for push approval.

Follow this sequence exactly and exclusively whenever code is ready to be pushed. No exceptions.

---

### 35. ALWAYS MONITOR DEV SERVER
Whenever developing, building, or troubleshooting the Next.js app, always ensure that you run `npm run dev` in the background as a daemon tool call so you can monitor the actual terminal logs in real-time. Do not wait for the user to report 500s or 404s. Check the terminal task logs directly for compilation errors and runtime exceptions.

---

### 36. ALWAYS VERIFY WITH CHROME DEVTOOLS
Whenever you implement a fix for the frontend or APIs, do not just assume it works because it compiled. You MUST launch the Next.js dev server, use the `chrome-devtools-mcp` tools to load the page (`http://localhost:3000`), and check the actual console logs and network requests. Do not declare a task 'done' unless you have verified it visually and fundamentally through Chrome DevTools.

---

### 37. MANDATORY CLICKABLE LINKS FOR ALL PLANS, PROMPTS, ARTIFACTS, AND CODE
In every user communication, prompt preparation, walkthrough, and document generated by the agent:
- **Every implementation plan, prompt file, code artifact, diagnostic route, or touched file MUST be formatted as a clickable Markdown link using standard `file:///` URLs** (e.g. `[prompts/example.md](file:///c:/Users/acer/.../prompts/example.md)` or `[app/page.tsx](file:///c:/Users/acer/.../app/page.tsx)`).
- Never output bare text or unlinked code-block paths when referring to prompts, plans, or files.
- This rule applies permanently and continuously to all current and future development sessions on this project.
