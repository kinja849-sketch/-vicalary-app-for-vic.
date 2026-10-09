# Implementation Prompt: Fast 1-on-1 Dialogue, Low-Latency Turns, and Research Verification Flow

## 1. Problem Statement & Root Cause

### Observed Issues
1. **High Latency & Delays**: Turns were taking up to 18 seconds (`POST /api/conversation/process 200 in 18537ms`) because every request was executing multiple serial/blocking Supabase queries and unneeded tool checks before contacting the LLM.
2. **Repetitive/Divergent Responses**: In [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx), `sessionTurnsRef.current` only accumulated `user` entries and never saved `assistant` replies. When subsequent turns were sent, the LLM received corrupted history and defaulted back to greeting responses ("I'm doing great today, Najib, thank you for asking!") instead of answering questions like "what's the weather like in Indonesia".
3. **Missing Research Feedback Flow**: The user specifically requested that when a question requires research, the coach should immediately say *"Let me check that for you"*, execute the verification, and then get back with the verified answer, with zero hanging or abandonment.

---

## 2. Technical Architecture & Changes

### A. Low Latency Fast Path ([`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts))
1. **Instant Routing**:
   - For greetings, wellness check-ins, or questions regarding user profile/health stats already stored in the backend:
     - Bypass heavy meal plan / budget / external tool fetching.
     - Stream LLM completions immediately, reducing turn latency to under 1 second.
2. **Strict Topic Relevance & AI Independence**:
   - Refine system instructions: The AI must strictly formulate its replies to the *exact question asked*.
   - Never repeat old greeting templates when a new question (e.g. weather, food, guidance) is asked.
   - Temperature tuned to 0.6 for natural, intelligent, unscripted responses.

### B. Immediate Research Flow ("Let me check that for you")
1. **Detection**:
   - When a query requires external search or verification (weather, news, external facts, live place lookups):
   - In streaming mode, immediately emit a first audio/text packet:
     - Spoken text: `"Let me check that for you."`
     - The frontend modal receives and speaks this immediately (~500ms latency), providing instant human feedback.
2. **Parallel Research & Follow-Up**:
   - While the user listens to *"Let me check that for you"*, execute the research tool (`routeAndExecuteTools` / Tavily).
   - Feed the research findings into the LLM to formulate the verified answer.
   - Stream the verified answer as the second part of the turn, ensuring the coach *always* gets back to the user with the verified facts.

### C. Multi-Turn Session Memory Fix ([`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx))
1. **Append Assistant Turns**:
   - Upon completion of every turn (`done` or `replyText`), append `{ role: 'assistant', content: replyText }` to `sessionTurnsRef.current`.
   - Prevent desynchronization between user queries and assistant answers so the LLM always has clean multi-turn dialogue context.

---

## 3. Files to Modify
1. [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts): Fast path routing, research verification flow with interim spoken acknowledgement, strict prompt focus.
2. [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx): Store assistant responses in `sessionTurnsRef` to preserve clean dialogue history.

---

## 4. Verification Plan
1. Type check: `node ./node_modules/typescript/bin/tsc --noEmit` must pass with 0 errors.
2. Test routine query ("how are you doing") on local dev server: Latency must be < 2s.
3. Test research query ("what is the weather like in Indonesia"):
   - Must emit/speak *"Let me check that for you."*
   - Must execute research and return the verified Indonesian weather answer without repeating the greeting.
