# Implementation Prompt: Mobile VoiceTurnController, Audio Unlock & Live Diagnostic HUD

## 1. Objective & Requirements
- Implement a dedicated **`VoiceTurnController`** class / singleton pattern within `AICoachVoiceModal.tsx` that guarantees:
  1. Only the controller can transition voice state (`idle` -> `listening` -> `finalizing` -> `processing` -> `speaking` -> `listening`).
  2. `SpeechRecognition.onend`, `onstart`, or React rerenders can **never** restart the microphone while state is `processing` or `speaking`.
  3. Every turn receives a cryptographically unique `turnId`. All asynchronous network responses, SSE chunks, and TTS playback checks enforce `if (event.turnId !== this.activeTurnId) return;`.
- **Mobile Audio Unlocking**:
  - Initialize and resume the Web Audio `AudioContext` on the user's initial button click ("Talk to Coach" / "Start") to prevent mobile browser autoplay policies from blocking AI speech.
- **Mobile Live Diagnostic HUD**:
  - Add a toggleable or compact semi-transparent diagnostic strip in the voice modal displaying live:
    - `State`: (e.g. `PROCESSING`, `SPEAKING`, `LISTENING`)
    - `Turn ID`: (e.g. `turn_8a2f`)
    - `Heard`: (Final transcript text)
    - `API`: (e.g. `200 OK (380ms)`)
    - `Audio`: (e.g. `Playing` / `Unlocked`)
- **End-to-End Structured Telemetry**:
  - Structured console logging tagged with `[VOICE TURN <id>]` across every phase (STT finalized -> Request sent -> First chunk -> TTS play -> Complete).

---

## 2. Proposed Changes

### `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- Implement `VoiceTurnController` encapsulating state, active turn ID, recognition reference, audio context unlock, and abort controller.
- Add Web Audio unlock helper on user entry.
- Add live Diagnostic HUD panel under the 3D Sphere for real-time mobile debugging.
- Hook into SSE streaming and TTS with turn validation.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` -> must compile with 0 errors.

### Localhost & Mobile Production Verification
1. Open `http://localhost:3000/chat` and `https://vicalary.com/chat`.
2. Tap **Talk to Coach**.
3. Speak: *"What are my target calories and allergies?"*
4. Confirm:
   - Live HUD shows: `State: PROCESSING -> SPEAKING -> LISTENING`.
   - Audio begins playing smoothly on mobile.
   - Microphone stays disabled during speech and only restarts after audio finishes.
