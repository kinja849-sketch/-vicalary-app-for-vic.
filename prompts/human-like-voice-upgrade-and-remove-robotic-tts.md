# Feature Implementation Plan: Studio Human-Like Voice Engine & Complete Elimination of Robotic Synthesis

## 1. Problem Diagnosis & Root Cause
1. **Robotic Voice Root Cause**:
   - The user noticed: *"the voice is robotic. Make sure this is never implemented again, and the voice that is used is a human-like voice rather than the robotic voice. Avoid it at all costs for this project."*
   - There were two sources producing robotic speech:
     1. **`gemini-2.5-flash-preview-tts` Free Tier Limit**: The preview model has an ultra-low free tier quota (10 requests/day). Once exhausted, it returned HTTP 429 `RESOURCE_EXHAUSTED`.
     2. **Fallback to Browser Speech Synthesis (`window.speechSynthesis`)**: When server TTS hit the limit, [`AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx) fell back to `speakViaBrowserSpeech` using the local OS speech synthesizer (e.g., Microsoft David Desktop on Windows), which sounds mechanical, metallic, and robotic.
2. **Availability of High-Fidelity Human AI Voices**:
   - Our live model probes verified that Google Gemini's flagship TTS models:
     - `gemini-3.8-flash-tts`
     - `gemini-3.8-flash-lite-tts`
     are **active and healthy with full quota** on the user's backup key (`BACKUP_AI_API_KEY`).
   - They support natural human neural voice synthesis with prebuilt lifelike voices such as `Kore` (natural, empathetic, warm female health coach) and `Puck` (warm, natural, friendly male voice), returning direct studio-quality `audio/wav`.

---

## 2. Solution Architecture

### 1. Upgrade Fallback TTS Engine to `gemini-3.8-flash-tts` with Human Voice (`Kore`)
- In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts):
  - Upgrade TTS endpoint to use `models/gemini-3.8-flash-tts:generateContent` (with seamless failover to `models/gemini-3.8-flash-lite-tts:generateContent`).
  - Configure `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName = 'Kore'`, ensuring an ultra-realistic, warm, human health coach voice.
  - Automatically wrap PCM buffers or pass through WAV payloads so standard HTML5 `<audio>` plays lifelike human speech.

### 2. Completely Eliminate Robotic Browser Speech Synthesis (`window.speechSynthesis`)
- In [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx):
  - Completely **remove** `speakViaBrowserSpeech` and all `window.speechSynthesis` calls.
  - No robotic OS synthesizers will ever be invoked.
  - Ensure all voice playback strictly utilizes the studio-grade neural AI voice streams.

---

## 3. Touched Files
- [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) — Upgrade TTS model to `gemini-3.8-flash-tts` with human voice `Kore` and `gemini-3.8-flash-lite-tts` failover.
- [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx) — Completely eliminate robotic `window.speechSynthesis` and enforce neural AI voice playback.

---

## 4. Verification Plan
1. **Live Gemini 3.8 Flash TTS Probe**: Verify `/api/text-to-speech` outputs studio-quality `audio/wav` using the human `Kore` voice.
2. **Localhost Voice Check**:
   - Open Health Coach voice modal on `http://localhost:8080/chat`.
   - Listen to the coach greeting and answers out loud; verify warm, natural, human speech cadence with zero robotic artifacting.
3. **TypeScript Typecheck**: Run `tsc --noEmit` to confirm 0 compilation errors.
