# Implementation Prompt: Mobile Voice Turn-Lock & State Machine Architecture

## 1. Objective & Requirements
- Eliminate the mobile voice state loop where Android/Mobile Chrome triggers `recognition.onend` during `recognition.abort()`, restarting speech recognition and flipping state back to `LISTENING` while the AI is still processing or speaking.
- Implement an explicit **Turn-Lock (`activeTurnIdRef`)** and synchronized **Voice State Machine (`voiceStateRef`)** that strictly forbids the speech recognizer from restarting while state is `processing` or `speaking`.
- Release the turn-lock **only after the audio playback has completely finished**.
- Add mobile-specific diagnostic telemetry (`[VOICE] STATE: ...`, `[STT] Starting because: ...`).

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- Define `activeTurnIdRef = useRef<string | null>(null)` and `voiceStateRef = useRef<VoiceState>('idle')`.
- Implement `updateVoiceState(nextState)` helper synchronizing React state and ref.
- In `recognition.onend`: strictly check `voiceStateRef.current === 'listening' && activeTurnIdRef.current === null` before scheduling any restart.
- In `recognition.onstart`: do not overwrite `processing` or `speaking` state.
- In `playDirectAudio` and `speakText`: transition to `'speaking'`, hold the turn-lock until audio `.onended`, then release turn-lock and return to `'listening'`.
- Cancel stale in-flight AI requests with `activeRequestAbortControllerRef`.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost / Mobile Verification Steps
1. Open `http://localhost:3000/chat` on mobile or desktop.
2. Click **Talk to Coach**.
3. Say: *"Hi, how are you doing today?"*
   - Verify state transitions: `LISTENING` $\to$ `PROCESSING` (STT stops) $\to$ `SPEAKING` (audio plays completely).
   - Verify state NEVER jumps back to `LISTENING` during processing or speech.
   - Verify that only when Vee finishes speaking does the modal return to `LISTENING` for your next turn.
