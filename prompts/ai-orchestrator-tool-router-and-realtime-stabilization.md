# Implementation Prompt: Full AI Orchestration Architecture, Tool Router, Web Search & Realtime Ping-Pong Elimination

## 1. Architectural Problems & Root Causes
1. **Realtime Ping-Pong Loop & Render Thrashing**:
   - `onMessageEvent` was calling `markConversationAsReadLocal(localActiveId, true)` (Force: true) on every `INSERT` event.
   - This updated `messages.is_read` in Supabase $\to$ fired Realtime `UPDATE` event $\to$ re-rendered `ChatConversation` (Render #20, #40, #60).
   - Solution: Remove forced `markAsRead` calls from realtime message listeners. Only mark read on initial mount and active window focus.
2. **Duplicate Channel Subscriptions**:
   - React StrictMode and unmemoized subscription effects were calling `channel.subscribe()` multiple times.
   - Solution: Implement a strict channel registry guard ensuring exactly one channel per room.
3. **Tool Router & Live Web/World Events Search**:
   - AI currently lacks live internet grounding for current world events (e.g. "What happened today in Gaza?").
   - Solution: Create `lib/services/ai/ToolRouter.ts` with a `WebSearchTool` (live web/news search) and `LocationService` (places & regional context).
4. **Dedicated TurnManager**:
   - Create `TurnManager.ts` to manage turn lifecycles (`IDLE`, `LISTENING`, `USER_SPEAKING`, `TRANSCRIBING`, `PROCESSING`, `AI_SPEAKING`) and track performance latency markers.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Remove forced `markConversationAsReadLocal` from `onMessageEvent`.
- Implement strict single-flight subscription guard for Realtime channel.

### 2. `the-app-belong-to-vic--main/lib/services/ai/ToolRouter.ts` (NEW)
- Implement `ToolRouter` with:
  - `WebSearchTool`: Fetches live search results for current events / news / factual lookups.
  - `LocationContextTool`: Resolves precise location & nearby places context.
  - `NutritionLookupTool`: Retrieves verified macro & micro nutrient facts.

### 3. `the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts`
- Integrate `ToolRouter` into `processConversation`.
- Detect when a query needs external / current-event / location information and run tools in parallel with zero sequential blocking.
- Ground Vee in live tool results with full multi-turn memory.

### 4. `the-app-belong-to-vic--main/lib/services/ai/TurnManager.ts` (NEW)
- Centralized turn coordinator and latency logger (`VOICE_START`, `STT_COMPLETE`, `TOOL_COMPLETE`, `AI_FIRST_TOKEN`, `TTS_START`).

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. In **Health Coach** chat, ask a current event / live question: *"What is the latest major news today?"*
   - Verify `WebSearchTool` runs and Vee answers accurately with current information.
3. In voice mode, ask: *"Can you suggest a breakfast for me without peanuts or eggs?"*
   - Verify immediate spoken answer in English without render loops.
4. Follow up: *"Why did you recommend that?"*
   - Verify full conversational continuity.
5. Check console $\to$ verify Render counts remain stable (no Render #40, #60 cascades) and Realtime subscriptions remain strictly at 1.
