# Implementation Prompt: AI Architecture & Responsibility Orchestrator

## 1. Problem & Architectural Context
VICALARY needs a robust, modular, and verified AI architecture following the principle:
**Supabase owns data. Edge Functions / services own business logic. The AI only reasons over verified context and generates responses.**

### Core Rules Enforced:
1. **AI never owns state**: Profile, meals, budget snapshots, scans, and messages live in Supabase and are loaded dynamically per request.
2. **One identity, many capabilities**: Single unified Health Coach interface backed by modular intent-based handlers (meal, product, medicine, budget, affiliation, spiritual, general conversation).
3. **Intent -> Retrieve -> Generate -> Validate -> Store -> Display**: No single fragile mega-prompt dumping all data.
4. **Secrets stay on the server**: All model calls, API keys, and bank tokens live in backend Edge Functions / API routes.
5. **No hallucinated facts or entities**: Location, stores, food items, medicine facts, and brand affiliations must be verified against database rows or search APIs, with evidence cited or explicit "unknown" fallback.

---

## 2. Implementation Scope & Phases

### Phase 1: Stabilize Existing Chat & Realtime Architecture
- **Message Send & Synchronous Flow**:
  - Optimistic user message insertion in UI state.
  - Persist user message to Supabase `messages` table.
  - Trigger backend orchestrator (`process-conversation` / API route).
  - Stream / display assistant response and ensure assistant message row insertion is committed to DB.
  - Ensure in-thread updates appear immediately without requiring page refresh or navigation.
- **Realtime Stability**:
  - Channel cleanup and stable subscription hooks keyed strictly by `conversationId`.
  - Eliminate duplicate subscriptions, flapping, and console warnings.
  - Proper memory cleanup for media blobs (`URL.revokeObjectURL`) and resilient fallbacks for expired/broken asset URLs.
- **Honest Loading & Processing States**:
  - Distinct UI lifecycle states: `idle | sending | responding | error`.

### Phase 2: Intent Router, Dynamic Context Assembly & Conversational Formatter
- **Intent Classifier (`classify-intent`)**:
  - Classify user messages into structured intent objects: `meal_question`, `product_analysis`, `medicine_inquiry`, `budget_status`, `affiliation_lookup`, `spiritual_guidance`, `general_chat`.
  - Determine required context flags (`requires_user_profile`, `requires_meal_plan`, `requires_budget_snapshot`, `requires_external_search`).
  - Determine response format (`conversation` vs `structured_json`).
- **Dynamic Context Assembly**:
  - Load only verified data corresponding to the classified intent:
    - User health profile (goals, allergies, dietary constraints) from Supabase.
    - Active weekly meal plan & daily logged meals for meal intents.
    - Precalculated budget numbers (daily target, spending delta) for budget queries.
    - Verified affiliation rows with evidence URLs for brand queries.
    - Recent message history (last 10-20 turns) + summary.
- **Conversation Formatter**:
  - Enforce clean, natural conversational styling for conversational responses (strip artificial markdown headers, bullet lists unless explicitly requested).
  - Return structured JSON for rich UI card displays.

### Phase 3 & Beyond: Voice, Meal Plan Generator, Product/Medicine Pipelines
- Single voice provider session (STT -> `process-conversation` -> TTS) with end-of-session transcript flushing.
- Structured 7-day meal plan generator saving directly to database tables.
- Verification-based product, medicine, and brand affiliation intelligence pipelines.

---

## 3. Detailed File Changes

### 1. `the-app-belong-to-vic--main/app/api/conversation/process/route.ts` & `supabase/functions/process-conversation/index.ts`
- Implement orchestrator handling:
  1. User authentication & authorization.
  2. Intent classification via `classifyIntent`.
  3. Dynamic context loading from Supabase (profile, meal plan, budget, history).
  4. Prompt construction with domain-specific capability instructions & strict safety guards.
  5. LLM generation with OpenAI / Gemini.
  6. Output validation & formatting.
  7. Persist assistant message to `messages` table with appropriate metadata.

### 2. `the-app-belong-to-vic--main/lib/services/ai/IntentRouter.ts`
- Implement lightweight classification rules + structured JSON model schema.
- Map user queries to intent contracts and retrieval requirements.

### 3. `the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts`
- Modular context fetchers:
  - `loadUserProfileContext(userId)`
  - `loadMealPlanContext(userId)`
  - `loadBudgetContext(userId)`
  - `loadAffiliationContext(query)`
  - `loadConversationHistory(conversationId, limit)`

### 4. `the-app-belong-to-vic--main/lib/api/chat.ts` & `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Refactor message dispatch to route AI coach messages cleanly through the orchestrator.
- Streamline Realtime channel subscription lifecycle, eliminating reconnection loops and stale state.
- Ensure assistant responses render immediately in-thread with truthful status indicators.
- Clean up avatar and audio/image blob management.

---

## 4. Verification Plan

### Automated Checks
- `npm run build` / `npx tsc --noEmit` in `the-app-belong-to-vic--main` to ensure complete type safety.
- Lint and schema validation checks.

### Localhost Manual Verification
1. Open Health Coach chat at `http://localhost:3000/chat`.
2. Send a conversational message ("Hi, how are you?"). Verify reply appears in-thread immediately without navigating away.
3. Ask a meal-related question ("What should I eat for dinner based on my goals?"). Verify profile and meal context are loaded and formatted naturally.
4. Ask a brand ownership question. Verify AI only cites verified database/evidence rows and states unknown when data is absent.
5. Check console for zero subscription flap spam and zero broken blob error loops.
