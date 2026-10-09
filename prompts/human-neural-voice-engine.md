# Human Neural Voice Upgrade & Complete Removal of Robotic Speech

## Context & Root Cause Analysis
During live audio verification, the AI voice sounded metallic, synthetic, and unmistakably artificial.

### Why This Happened:
1. **Cloud TTS Quota Exhaustion**: Both the configured `OPENAI_API_KEY` (0 credits remaining, HTTP 429) and the Gemini Preview TTS models (daily free-tier limit of 20 requests reached, HTTP 429) hit quota cutoffs.
2. **Robotic Fallback Triggered**: When both primary and backup cloud TTS failed, [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) fell back to `synthesizeGoogleNaturalSpeech`, which requested audio from `https://translate.google.com/translate_tts?client=tw-ob`. This is Google Translate's legacy 2010 text-to-speech engine—a monotone, metallic synthesizer.
3. **Browser Fallback Limitation**: On Windows, the browser's local speech synthesis voices are limited to legacy Windows Desktop SAPI 5 synthesizers (`Microsoft Zira` / `Microsoft David`), which also sound robotic.

---

## Proposed Changes & Architecture

### 1. Completely Purge Legacy Robotic Synthesizers
- Remove all calls to `https://translate.google.com/translate_tts`.
- Never fall back to monotone legacy Web Speech SAPI voices (`Microsoft Zira` / `Microsoft David`).
- Ensure no robotic voice path can ever execute in this project.

### 2. Implement Kokoro-82M Studio-Grade Human Neural Voice Engine
- Install and integrate `kokoro-js`, an open-weight 82M parameter neural voice model (Apache 2.0).
- Voice Identity: **`af_bella`** / **`af_sarah`** (American Female, natural conversational, warm, calm, studio-quality, identical in feel and pacing to ChatGPT's voice).
- Runs directly via ONNX / WebAssembly on the backend server with:
  - **Zero quota limits** (runs 100% locally on your machine).
  - **Zero external service dependencies or subscription costs**.
  - **Zero robotic artifacting**: produces authentic 24kHz human speech with natural prosody, breathing, and pitch dynamics.

### 3. Unified Voice Pipeline & Audio Streaming
- Maintain the exact same female voice identity across:
  - Dynamic initial greeting
  - Avatar face tap greeting
  - Subsequent conversational and research answers
- Cache generated neural audio chunks in memory to deliver near-instantaneous (< 500ms) voice turns.
- Keep the existing UI, animations, 360° avatar gaze, and messaging untouched.

---

## Files to Modify
1. [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts):
   - Replace `synthesizeGoogleNaturalSpeech` with Kokoro-82M neural synthesizer.
   - Purge `translate.google.com` URL references completely.
2. [`app/api/text-to-speech/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/text-to-speech/route.ts):
   - Ensure TTS route serves pristine 24kHz neural audio with voice caching.
3. [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx):
   - Verify audio playback pipeline routes exclusively through the neural audio stream.

---

## Acceptance Criteria
- [ ] Voice sounds completely human, warm, conversational, and natural like ChatGPT.
- [ ] No robotic, metallic, or synthesized monotone audio is ever produced.
- [ ] Audio functions indefinitely without hitting 429 quota exhaustion.
- [ ] Initial greeting and normal turn responses share identical voice identity and audio quality.
- [ ] All UI layout, avatar designs, database persistence, and chat functionality remain untouched.
