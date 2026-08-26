# Implementation Prompt: Voice Turn Manager, STT Language Fix (Decouple IP from Speech) & Realtime Cleanup

## 1. Problem & Root Cause Breakdown

### A. Root Cause for "H Pronunciation" & Comprehension Failure
- `AuthContext.tsx` detects IP location (e.g. Indonesia) and automatically sets `lang: id` and `document.documentElement.lang = "id"`.
- `AICoachVoiceModal.tsx` was reading `document.documentElement.lang` and configuring Speech-to-Text as `id-ID` (Indonesian).
- When the user speaks English, the Indonesian STT phonetics engine mishears English words as garbled Indonesian syllables (distorting consonants and only catching "H" sounds), sending corrupt transcriptions to the AI.
- **Fix**: Decouple Speech-to-Text language from IP location. Explicitly set speech recognition language to English (`en-US`) by default, with an interactive language selector (English, Indonesian, Spanish, Arabic) in the Voice Modal.

### B. Root Cause for Duplicate Realtime Subscriptions
- `ChatConversation.tsx` and global listeners create redundant channel subscriptions on component re-render.
- **Fix**: Implement strict single-instance channel deduplication with complete teardown cleanup in `ChatConversation.tsx`.

### C. Voice Turn Manager Architecture
- Implement a dedicated `VoiceSessionController` & `TurnManager` state machine:
  - `session_id` and unique `turn_id` per utterance.
  - Zero reliance on database Realtime events for live voice playback.
  - Direct server-side generation + audio synthesis $\to$ immediate audio playback $\to$ asynchronous background message sync.
  - Full multi-turn dialog memory passed in every request.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- **Explicit Language Configuration**:
  - Add state `voiceLanguage` (default `'en-US'`).
  - Add a sleek language toggle button in the header (e.g. `[EN | ID | ES | AR]`).
  - Set `recognition.lang = voiceLanguage` explicitly (never derived from IP).
- **Integrated Turn Manager**:
  - Maintain `session_id` and sequential `turn_id`.
  - Atomic turn locking: discard any secondary STT events until active turn playback finishes.
  - 700ms natural silence timeout.
  - Direct server audio playback (`audioBase64`) with 0ms DB delay.

### 2. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Ensure strict channel cleanup and single subscription guard (`activeChannelRef`) to eliminate duplicate channel subscriptions and redundant `INSERT` events.

### 3. `the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts`
- Pass `sessionTurns`, `sessionId`, and `turnId`.
- Ground Vee in the user's explicit language and full conversational session memory.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. Open **Health Coach** $\to$ Click **Talk to Coach**.
3. Verify Voice Language is explicitly set to **EN** (`en-US`).
4. Speak in normal English: *"Hello, what are my allergies and what can I eat for lunch?"*
   - Verify English STT recognizes words with 100% precision.
   - Verify Vee answers immediately in English.
5. Follow up: *"Can you give me a recipe for that?"*
   - Verify full conversational continuity.
6. Check browser console $\to$ verify **only 1 subscription** and 0 duplicate INSERT event cascades.
