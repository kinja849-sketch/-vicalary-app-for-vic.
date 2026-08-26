# Implementation Prompt: Fix Mid-Sentence Cutoffs, Full Session Context Memory & Intelligent Back-and-Forth Dialogue

## 1. Problem & Root Cause Breakdown
1. **Premature STT Cutoffs ("Can you")**:
   - The 200ms pause timer was too aggressive, triggering mid-sentence during normal speaking pauses (e.g. after "Can you...").
   - This sent fragmented, incomplete sentences to the AI, which made the AI seem unaware and unable to comprehend the user.
   - Solution: Set a balanced 700ms pause detector and only finalize on genuine sentence completion or explicit `isFinal` events.
2. **Loss of Dialogue Context (Back-and-Forth Not Respected)**:
   - Voice turns were relying solely on asynchronous database history queries that could miss the immediate preceding spoken turn.
   - Solution: `AICoachVoiceModal` will pass the full in-memory `session_turns` directly in the `/api/conversation/process` request payload.
3. **Comprehensive AI Grounding & Prompting**:
   - Ground the model with full conversation thread memory, profile allergies, and dietary targets.
   - Generate intelligent, natural, conversational spoken replies (1–2 concise sentences) with sub-second turnaround.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- Set silence detection threshold to 700ms to allow natural breathing and prevent premature sentence fragmentation.
- Pass `session_turns` (full live voice dialogue history) in the request body to `/api/conversation/process`.

### 2. `the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts` & `app/api/conversation/process/route.ts`
- Support `sessionTurns` in `ProcessConversationInput`.
- Merge `sessionTurns` into `messagesPayload` so the AI has 100% immediate awareness of what was said in the last turn.
- System prompt refinement for intelligent, self-aware conversational dialogue that directly answers the user''s questions while respecting context.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Open **Health Coach** $\to$ Click **Talk to Coach**.
2. Speak a full, natural sentence: *"Can you suggest a breakfast for me that avoids my allergies?"*
   - Verify it does NOT cut off after "Can you".
   - Verify Vee acknowledges your allergies (no peanuts, seafood, cheese, eggs) and suggests high-protein breakfast.
3. Say: *"Why did you recommend that?"*
   - Verify Vee references the previous recommendation seamlessly with full back-and-forth comprehension.
