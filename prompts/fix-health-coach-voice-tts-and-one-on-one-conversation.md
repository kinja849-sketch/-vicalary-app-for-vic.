# Feature Implementation Plan: Fix Health Coach Voice Speech (TTS) & One-on-One Conversation

## 1. Problem Diagnosis & Root Cause
1. **Root Cause of Silent Health Coach**:
   - The user reported: *"The health coach does not respond at all when I speak to it."*
   - In [`ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts) line 219 and [`app/api/text-to-speech/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/text-to-speech/route.ts), spoken audio generation was exclusively hardcoded to OpenAI's Text-to-Speech API (`https://api.openai.com/v1/audio/speech`).
   - Because the primary OpenAI API key has an exhausted credit quota (HTTP 429), all TTS calls failed and returned `null`.
   - In [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx), when `event.audioBase64` is missing/null, the modal silently reverted to `idle` without playing any audio or completing the speech lifecycle. Consequently, the avatar never spoke, and the microphone never re-opened for the next turn.
2. **One-on-One Conversation Flow Requirement**:
   - The conversation must be an active, continuous, one-on-one back-and-forth dialogue: the user speaks, the coach replies out loud, and when the coach finishes speaking, the microphone automatically opens for the user's next turn.
   - The conversation must cleanly bind to the user's authentic 1-on-1 Health Coach conversation thread in Supabase (with `COACH_ID` = `00000000-0000-0000-0000-000000000001` and `conversation_type = 'ai'`), with automatic conversation creation fallback via `getOrCreateCoachConversation`.

---

## 2. Solution Architecture
1. **Dual-Layer Voice TTS Resilience Engine**:
   - In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), implement `synthesizeVoiceAudioWithFallback(text: string, voice?: string)`:
     - **Primary**: Tries OpenAI TTS (`https://api.openai.com/v1/audio/speech`).
     - **Backup Provider (Gemini TTS)**: If OpenAI returns 429, 5xx, or is unconfigured, calls `models/gemini-2.5-flash-preview-tts:generateContent` using the backup key (`BACKUP_AI_API_KEY`), formats with prompt `Read aloud: <text>`, and converts the 24kHz PCM buffer to a valid WAV data URI (`data:audio/wav;base64,...`) via a lightweight WAV header generator.
2. **Update Server Endpoints**:
   - [`app/api/text-to-speech/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/text-to-speech/route.ts): Use `synthesizeVoiceAudioWithFallback`, returning `audio/wav` or `audio/mpeg` seamlessly.
   - [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts): Update `synthesizeVoiceAudio` to use `synthesizeVoiceAudioWithFallback`, guaranteeing `event.audioBase64` is always present in stream events.
3. **Frontend Speech Safety Net & Continuous Turn Loop**:
   - In [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx):
     - When `event.audioBase64` is received, play via `playDirectAudio`.
     - If audio playback ever fails or server audio is absent, automatically fallback to browser native `window.speechSynthesis` (`SpeechSynthesisUtterance`) to ensure the coach ALWAYS speaks out loud and animates the avatar.
     - When speech finishes (either audio element `onended` or utterance `onend`), trigger the next turn transition to `listening` and call `startListening()`, maintaining a responsive, natural one-on-one conversation.
4. **Guaranteed 1-on-1 Conversation Persistence**:
   - In [`app/api/conversation/process/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/conversation/process/route.ts) and [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx):
     - When starting a voice session, ensure `conversationId` resolves to a valid UUID row between `userId` and `COACH_ID` via `getOrCreateCoachConversation`.
     - Ensure messages and conversation updates record strictly in the user's private coach conversation.

---

## 3. Touched Files
- [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) — Add Gemini TTS failover and PCM-to-WAV header generator.
- [`app/api/text-to-speech/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/text-to-speech/route.ts) — Integrate fallback voice synthesis.
- [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts) — Route `synthesizeVoiceAudio` through fallback engine.
- [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx) — Add Web Speech API fallback, avatar lip sync reactivity, and continuous one-on-one conversational turn loop.
- [`app/api/conversation/process/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/conversation/process/route.ts) — Ensure UUID resolution for 1-on-1 AI Coach conversation threads.

---

## 4. Verification Plan
1. **Live Gemini TTS API Probe**: Verify `synthesizeVoiceAudioWithFallback` produces playable WAV audio.
2. **Localhost Server Turn Test**: Call `/api/conversation/process` in voice mode to confirm audio generation and text generation succeed simultaneously.
3. **End-to-End One-on-One Voice Verification**:
   - Open Health Coach voice modal on `http://localhost:8080`.
   - Verify coach speaks the welcome greeting out loud.
   - Speak to the coach; verify coach replies out loud and avatar reacts with speech levels.
   - Verify speech end automatically transitions back to listening for the next turn.
4. **Typecheck & Linter**: Run `npm.cmd run typecheck` to confirm 0 compilation errors.
