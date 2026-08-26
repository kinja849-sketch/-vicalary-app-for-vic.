# Implementation Prompt: Fix Mobile Voice Permission Flicker, Audio Focus & State Machine Lifecycle

## 1. Root Cause Analysis
On Mobile Chrome & Android WebViews:
1. When user speech finishes and STT is stopped or TTS playback starts, the Android OS reclaims/switches audio focus.
2. This emits a transient `onerror: not-allowed` or triggers `navigator.permissions.query.onchange`.
3. The previous React code reacted by setting `hasMicPermission(false)`, which displayed the "Enable Microphone" permission UI and then immediately flipped back to `hasMicPermission(true)`.
4. The `useEffect([hasMicPermission])` hook fired on the state change and invoked `startListening()`, which abruptly interrupted `THINKING`, aborted the in-flight AI response, and forced the UI back to `LISTENING`.

## 2. Technical Solution
1. **Isolate Permission Check to Initialization Only**:
   - Perform permission query only once when the modal is opened.
   - Do NOT listen to `status.onchange` during active conversation turns.
   - Do NOT flip `hasMicPermission` to `false` on transient mobile STT errors.
2. **Ignore STT Errors during Processing & Speaking**:
   - In `recognition.onerror`, if `voiceState !== 'listening'` or `activeTurnId !== null`, completely ignore the error (it is a standard mobile audio focus release).
3. **Remove Reactive `useEffect([hasMicPermission])` Restart Hook**:
   - Start listening explicitly on user entry or direct user action, never through a reactive dependency hook that fires on permission state changes.
4. **Permanent Single-Flight Turn Protection**:
   - Guard every callback so that only `TTS.onended` can transition `SPEAKING -> LISTENING`.

## 3. Verification Plan
- Typecheck: `npm.cmd run typecheck` (0 errors).
- Test on Mobile:
  - Speak a question.
  - Verify NO permission flicker / "Enable Microphone" flash.
  - Verify state goes `LISTENING` -> `THINKING` -> `VEE SPEAKING` -> `LISTENING`.
