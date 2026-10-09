# Feature Implementation Plan: Backup AI Provider & Resilience Engine

## Objective
Implement a high-resilience AI backup system using the provided Google Gemini Authentication Key (`<REDACTED_GEMINI_KEY>`) as an automatic, seamless failover for all OpenAI capabilities across the VicCalary project.

When OpenAI encounters any downtime, rate limits (HTTP 429), quota exhaustion, service disruptions (HTTP 5xx), network timeouts, or missing/invalid primary credentials, the application will seamlessly and transparently execute all AI roles (meal vision analysis, medication analysis, coach replies, streaming conversations, cooking assistance, and meal plan recommendations) through the backup provider without breaking the user experience or UI.

---

## 1. Context & Key Discovery
- **Backup Key Format**: The provided key begins with `AQ.`, representing Google's new Gemini Authentication Key format.
- **Provider Capability**: Google Gemini exposes an OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` accepting `Authorization: Bearer <KEY>`.
- **Verified Operations**:
  - Chat completions (`gemini-2.5-flash`, `gemini-3.8-flash`, `gemini-flash-latest`)
  - Server-Sent Events (SSE) streaming (`stream: true`)
  - Structured JSON outputs (`response_format: { type: "json_object" }`)
  - Multimodal Vision analysis (`image_url` data URIs)
- **Zero-Hallucination & Safety Compliance**: All deterministic validation, allergy gates, user context retrieval, and Supabase canonical persistence remain authoritative and untouched. The AI acts strictly as an interpretation and synthesis layer as mandated by [`AGENTS.md`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/AGENTS.md).

---

## 2. Source of Truth & Architecture
- **Environment Variables**:
  - `OPENAI_API_KEY`: Primary AI provider key.
  - `BACKUP_AI_API_KEY` / `GEMINI_API_KEY`: Backup AI provider key (`<REDACTED_GEMINI_KEY>`).
  - `BACKUP_AI_MODEL`: Default fallback model (e.g. `gemini-2.5-flash`).
- **Resilience Engine Module**: [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts)
  - `callChatCompletionWithFallback`: Executes chat completion with primary OpenAI, falling back to backup Gemini upon failure or missing primary key.
  - `streamChatCompletionWithFallback`: Handles streaming completions with automatic failover before streaming.
  - `callVisionWithFallback`: Multimodal image inspection with automatic failover.
  - Model mapping: Gracefully translates OpenAI models (`gpt-4o`, `gpt-4o-mini`) to Gemini equivalents (`gemini-2.5-flash`, `gemini-2.5-pro`) on backup calls.

---

## 3. Touched Files & Scope
1. **Environment Config**:
   - [`.env.local`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/.env.local) — Add `BACKUP_AI_API_KEY` and `GEMINI_API_KEY`.
   - [`.env.example`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/.env.example) — Document `BACKUP_AI_API_KEY` and `GEMINI_API_KEY`.
2. **Central AI Engine**:
   - [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) — Create unified, resilient AI request handler with retry/failover logic.
3. **Core API Routes & Services Integration**:
   - [`app/api/analyze-food-image/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-food-image/route.ts) — Vision meal analysis and synthesis fallback.
   - [`app/api/analyze-medication/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/analyze-medication/route.ts) — Medication vision and synthesis fallback.
   - [`app/api/coach-reply/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/coach-reply/route.ts) — Coach welcome message and streaming chat fallback.
   - [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts) — Live voice and chat conversation turn fallback.
   - [`app/api/daily-meal-plan/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-meal-plan/route.ts) — Daily meal planning fallback.
   - [`app/api/daily-summary/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/daily-summary/route.ts) — Daily summary fallback.
   - [`app/api/monthly-analysis/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/monthly-analysis/route.ts) — Monthly health progress fallback.
   - [`app/api/personalized-recommendations/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/personalized-recommendations/route.ts) — Personalized recipe recommendations fallback.
   - [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts) & [`orchestrate/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/orchestrate/route.ts) — Cooking guidance fallback.
   - [`app/api/banking/ai-budget/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/banking/ai-budget/route.ts) — AI budget recommendations fallback.

---

## 4. Verification & Testing Strategy
1. **Unit / Integration Smoke Tests**:
   - Directly invoke fallback engine with simulated primary failure (e.g., bad OpenAI key) to verify seamless switch to backup Gemini key.
   - Verify standard response parsing, JSON mode parsing, and SSE streaming decode.
   - Verify vision image parsing with sample image data URI.
2. **Localhost End-to-End Verification**:
   - Test AI Coach reply via dev server.
   - Test Food Image Analysis via dev server.
   - Check server logs to ensure correct provider telemetry (`[AI Engine] Provider: primary (OpenAI)` or `[AI Fallback] Switched to backup (Gemini)`).
3. **Typecheck & Linter**:
   - Run `npm run typecheck` to confirm zero TypeScript compilation errors.
