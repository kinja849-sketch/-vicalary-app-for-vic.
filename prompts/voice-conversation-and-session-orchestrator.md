# Implementation Prompt: Phase 3 — Voice Conversation on Unified Orchestrator & Session Persistence

## 1. Problem & Architectural Context
In Phase 3 of the AI Architecture specification, Coach Voice is a conversational session (STT -> `process-conversation` -> TTS -> session transcript) rather than a peer call on the Daily `calls` table.

### Rules Enforced:
1. **Unified Brain**: Voice queries must route through the same `/api/conversation/process` orchestrator with all dynamic context (profile, allergies, goals, temporal grounding) rather than disparate legacy endpoints.
2. **Stable Session Identity & Voice**: Fixed voice ID per session (`nova` high-definition natural voice) without robotic speech degradation.
3. **Session Transcript Persistence**: User and assistant spoken turns are saved in Supabase `messages` so that upon ending the voice session, the full transcript history seamlessly displays in the chat thread.
4. **Honest, Visible States**: Explicit lifecycle states (`idle | listening | transcribing | thinking | speaking`) without hidden chain-of-thought.
5. **Clean Separation from Friend Calls**: Coach voice is entirely self-contained within `AICoachVoiceModal` and does not instantiate Daily rooms or touch `calls`.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- **Route to Unified Orchestrator**: Update `processUserSpeech` to dispatch to `/api/conversation/process`.
- **User Turn Persistence**: Persist the user''s spoken text into the Supabase `messages` table upon transcription.
- **Session End Transcript Sync**:
  - In `handleEndCall`, ensure all transcript turns are persisted.
  - Invalidate `['messages', conversationId]` and `['conversations', userId]` so the chat view instantly reflects all spoken turns.
- **Audio Lifecycle & Cleanup**:
  - Proper audio URL revocation on modal teardown.
  - Smooth interruption handling: if user begins speaking while coach is speaking, immediately abort audio playback and transition to `listening`.

### 2. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Ensure the Voice Call trigger button seamlessly mounts `AICoachVoiceModal` with the resolved `conversationId` and user context.
- Refresh messages list upon modal close.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.
- `npm.cmd run build` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. Open the **Health Coach** chat conversation.
3. Click the **Call/Mic icon** in the chat header to launch the Voice Session.
4. Allow microphone access when prompted.
5. Speak: *"What are my allergies?"*
   - Verify the state transitions: `LISTENING` $\to$ `VEE REASONING...` $\to$ `VEE SPEAKING`.
   - Verify Vee speaks in a natural human voice (`nova`) accurately listing Peanuts, Seafood, Cheese, Egg whites.
6. Speak: *"What should I have for breakfast?"*
   - Verify Vee reasons over your goals and allergies and speaks a personalized suggestion.
7. Click **End Call** (red phone button).
   - Verify the modal closes cleanly and the entire spoken transcript (user speech + Vee replies) appears in the chat thread.
