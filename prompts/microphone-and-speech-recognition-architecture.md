# Implementation Prompt: Microphone & Speech Recognition Architecture

## 1. Objective & Requirements
- Decouple **physical location**, **app UI language**, **speech-to-text (STT) input language**, and **text-to-speech (TTS) output language** so location detection (e.g. Indonesia) NEVER forces Indonesian STT on an English speaker.
- Default STT speech input language to `en-US` with explicit UI language selector in the Voice Modal.
- Implement robust audio preprocessing constraints (`echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`).
- Separate **Interim Transcript** (live visual preview) from **Final Transcript** (AI trigger).
- Implement natural breathing VAD silence tolerance (850ms) to prevent cutting user off during natural conversational pauses.
- Implement transcript validation (confidence & minimum length check).
- Implement numerical speech normalizer (`SpeechNormalizer.ts`) for accurate calorie and quantity recognition.
- Add turn-based telemetry: `[VOICE turn_XXX] STT Lang: en-US | Interim: "..." | Final: "..." | Confidence: 95%`.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/lib/AuthContext.tsx`
- Ensure `handleLocationConfig` updates `country_code`, `timezone`, and `currency` without automatically overwriting user's `language` setting to `id`.

### 2. `the-app-belong-to-vic--main/lib/services/ai/SpeechNormalizer.ts` (NEW)
- Deterministic normalizer for spoken numbers to digits (*"one thousand nine hundred twelve"* $\to$ `1912`, *"twenty five kilograms"* $\to$ `25 kg`) and vice versa.

### 3. `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- Speech input language decoupled from IP location, defaulting to `en-US` with direct selector badge.
- Audio stream initialization with `echoCancellation`, `noiseSuppression`, and `autoGainControl`.
- Live visual **Interim Transcript** display while speaking.
- VAD silence timer tuned to 850ms for natural conversational cadence.
- Turn-based diagnostic logging (`[VOICE turn_XXX]`).

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Open `http://localhost:3000/chat`.
2. Click **Talk to Coach**.
3. Verify the speech input badge displays **English (en-US)**.
4. Speak in English: *"What are my target calories and what are my allergies?"*
   - Verify the live transcript preview displays the exact English words as you speak.
   - Verify the AI receives the exact English sentence (not Indonesian phonetics).
   - Verify Vee answers accurately with your name, 1,912 calories, and allergies.
