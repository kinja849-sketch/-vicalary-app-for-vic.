# Implementation Prompt: Fix AI Coach Voice Synthesis & Premature Reload to Listening

## 1. Problem Statement & Root Cause Analysis

### Observed Bug
When speaking to the AI Health Coach, the voice modal finalizes user speech, starts the turn (`STATE: thinking`), contacts the backend, logs `[VOICE] Synthesizing human neural voice for reply text...`, and then immediately resets back to `STATE: idle (SPEECH_COMPLETED)` and `STATE: listening (AUTO_NEXT_TURN)` without producing any spoken audio.

### Root Cause
1. **Primary Provider (OpenAI)**: OpenAI API returns HTTP 429 (`insufficient_quota / credit_balance_exhausted`), causing the system to correctly trip the circuit breaker and route audio synthesis to the backup provider (Google Gemini).
2. **Backup Provider (Google Gemini TTS Models Exhaustion)**: In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), the backup TTS engine attempted to synthesize speech only via `gemini-3.8-flash-lite-tts` and `gemini-3.8-flash-tts`. Both models were returning HTTP 429 (`You exceeded your current quota`), causing `synthesizeVoiceAudioWithFallback` to fail and return `null`.
3. **HTTP 502 / Empty Audio Cascade**: 
   - Because `synthesizeVoiceAudioWithFallback` returned `null`, both server-side streaming audio (`first_audio` / `done`) and the fallback `/api/text-to-speech` route returned HTTP 502.
4. **Immediate Premature Turn Reset**:
   - In [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx), when `/api/text-to-speech` failed with `!res.ok`, the code immediately called `onTurnSpeechCompleted(turnId)`.
   - `onTurnSpeechCompleted` instantly resets `activeTurnIdRef.current = null`, transitions to `idle (SPEECH_COMPLETED)`, and schedules a transition to `listening (AUTO_NEXT_TURN)` within 80ms.
   - Result: The user heard no voice, and the UI immediately reloaded back to `listening`.

---

## 2. Verified Solution

1. **Activate Working High-Fidelity Neural TTS Model (`gemini-3.1-flash-tts-preview`)**:
   - Live endpoint verification using the active `BACKUP_AI_API_KEY` confirmed that `gemini-3.1-flash-tts-preview` returns **HTTP 200 OK** with 24kHz linear PCM audio using the calm, articulate woman's voice **Aoede** (identical in feel to ChatGPT).
   - In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), place `gemini-3.1-flash-tts-preview` at the top of the TTS model cascade:
     ```typescript
     const ttsModels = [
       'gemini-3.1-flash-tts-preview',
       'gemini-3.8-flash-lite-tts',
       'gemini-3.8-flash-tts',
       'gemini-2.5-flash-preview-tts',
       'gemini-2.5-pro-preview-tts',
     ];
     ```
   - Retain linear-to-WAV conversion (`pcmToWavBuffer`) at 24000 Hz, 1 channel, 16-bit, which produces valid standard WAV audio playable in all browsers.

2. **Harden Voice Modal Hand-Off in [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx)**:
   - Ensure `playDirectAudio` safely manages Object URLs with delayed revoking (preventing audio cancellation mid-playback).
   - Add robust error logging in `speakText` to surface any network or audio payload anomalies instead of silently failing.
   - Guard against audio context suspension when playing direct audio.

3. **Preserve User Voice Directives**:
   - Retain natural ChatGPT-like woman's voice (`Aoede`).
   - Retain 0 robotic speech synthesis (strict ban on mechanical browser Web Speech synthesis).
   - Retain strict conversational focus without wandering into unprompted calorie/budget lectures.

---

## 3. Files to Modify

1. [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts)
   - Add `gemini-3.1-flash-tts-preview` as the primary backup neural TTS model with complete multi-model fallback cascade.
2. [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx)
   - Protect audio URL lifecycle and audio playback completion handling.

---

## 4. Verification Plan

1. Verify TypeScript types: `npx tsc --noEmit` must pass with 0 errors.
2. Verify live TTS route: Call `/api/text-to-speech` with test payload to confirm HTTP 200 OK and valid `audio/wav` response with provider `backup`.
3. Check dev server terminal logs to ensure zero 429/502 errors during speech synthesis.
4. Verify end-to-end voice playback in browser at `http://localhost:8080/chat`.
