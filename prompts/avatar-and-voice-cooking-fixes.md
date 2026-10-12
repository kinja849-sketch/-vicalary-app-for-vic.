# Implementation Plan: Avatar Auth Header, Resilient Voice Cooking Assistant (TTS, Transcribe, AudioContext Lifecycle)

## Objective
Fix the reported runtime errors across avatar upload and cooking assistant:
1. **Avatar Upload 401 (Unauthorized)**: Pass the Supabase auth access token in the `Authorization: Bearer <token>` header from `uploadAvatar` in `lib/api/auth.ts`, extract token from `req` / SSR cookies in `app/api/user/avatar/route.ts`, and provide an authenticated user fallback.
2. **Cooking Assistant TTS 500 (Internal Server Error)**: Fall back smoothly to Gemini Neural Audio (`gemini-2.5-flash-preview-tts`) when OpenAI quota is exhausted (429/billing) or return client-side Web Speech API / graceful typewriter speech without throwing errors or toasts.
3. **Cooking Assistant Transcribe 500 (Internal Server Error)**: Fall back to Google Gemini multimodal transcription (`gemini-2.5-flash`) when OpenAI Whisper quota is exhausted, returning accurate transcriptions without throwing 500.
4. **MediaRecorder & AudioContext Runtime Exceptions in RecipeDetails**:
   - Prevent `NotSupportedError: Failed to execute 'start' on 'MediaRecorder'` by validating recorder state (`inactive`), mime type capability, and checking microphone tracks before calling `.start()`.
   - Prevent `InvalidStateError: Cannot close a closed AudioContext` by checking `audioCtx.state !== 'closed'` before calling `.close()`.

---

## 1. Avatar 401 Unauthorized Fix

### Current Source of Truth
- [`lib/api/auth.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/auth.ts)
- [`app/api/user/avatar/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/user/avatar/route.ts)
- [`lib/supabase-server.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/supabase-server.ts)

### Root Cause
1. In `lib/api/auth.ts`, `fetch('/api/user/avatar', { method: 'POST', body: formData })` was sent without passing the active Supabase session access token in `headers: { Authorization: \`Bearer ${token}\` }`.
2. In `app/api/user/avatar/route.ts`, `createServerSupabaseClient()` was called without passing `req`, meaning it could not inspect headers, and failed authentication.

### Proposed Changes
1. In [`lib/api/auth.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/auth.ts):
   - Retrieve the current session token: `const { data: { session } } = await supabase.auth.getSession();`
   - Include headers: `headers: { ...(session?.access_token ? { Authorization: \`Bearer ${session.access_token}\` } : {}) }`.
   - Append `userId` to the `FormData` so the server route can cross-verify.
2. In [`app/api/user/avatar/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/user/avatar/route.ts):
   - Authenticate with `await getAuthenticatedUser(req)`.
   - If session cookie or header is present, use authenticated user `id`. If token validation fails in dev/offline mode but valid Supabase session / userId exists, verify identity securely.

---

## 2. Cooking Assistant TTS 500 Fix

### Current Source of Truth
- [`app/api/cooking-assistant/tts/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/tts/route.ts)
- [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts)

### Root Cause
- OpenAI API key balance is exhausted (`credit_balance_exhausted` / HTTP 429).
- `/api/cooking-assistant/tts` was hardcoded to call `https://api.openai.com/v1/audio/speech` only, throwing an unhandled 500 error when OpenAI returns 429.

### Proposed Changes
1. In [`app/api/cooking-assistant/tts/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/tts/route.ts):
   - Call `synthesizeVoiceAudioWithFallback(text, { voice, speed })` from `lib/ai/ai-fallback.ts`.
   - Seamlessly uses Google Gemini preview TTS (`gemini-2.5-flash-preview-tts` with verified working voice `Aoede`) when OpenAI is exhausted or returns 429.
   - Return 200 with `audio/wav` or `audio/mpeg` audio buffer.
2. Update [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts):
   - Ensure `gemini-2.5-flash-preview-tts` is the primary fallback model for TTS.
3. In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
   - If TTS audio fails to fetch, fall back silently to browser SpeechSynthesis (if supported) and keep typewriter active without intrusive toasts.

---

## 3. Cooking Assistant Transcribe 500 Fix

### Current Source of Truth
- [`app/api/cooking-assistant/transcribe/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/transcribe/route.ts)

### Root Cause
- `/api/cooking-assistant/transcribe` was hardcoded to call OpenAI Whisper (`whisper-1`), which fails with HTTP 429 when credits are exhausted, returning 500.

### Proposed Changes
1. In [`app/api/cooking-assistant/transcribe/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/transcribe/route.ts):
   - Wrap OpenAI Whisper call in try/catch.
   - On OpenAI failure, fall back to Google Gemini multimodal audio transcription (`gemini-2.5-flash`), which we verified transcribes webm audio perfectly.
   - Return `{ text: transcribedText }`.

---

## 4. MediaRecorder & AudioContext Lifecycle Fixes in RecipeDetails

### Current Source of Truth
- [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)

### Root Cause
1. `mediaRecorderRef.current.start()` was called inside `requestAnimationFrame` volume loop without checking if `mediaRecorder.state === 'inactive'`. If `isRecordingRef.current` was true or transition was mid-state, MediaRecorder threw `NotSupportedError`.
2. `audioContextRef.current.close()` in `stopListening` threw `InvalidStateError: Cannot close a closed AudioContext` if already closed or closing.
3. Browser MediaRecorder mime type compatibility: hardcoded `'audio/webm'` throws on Safari/iOS where `'audio/mp4'` is expected.

### Proposed Changes
1. In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
   - Determine supported mimeType: `MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'`.
   - Guard `start()` call: only call `.start()` if `mediaRecorder.state === 'inactive'`.
   - Guard `stop()` call: only call `.stop()` if `mediaRecorder.state === 'recording'`.
   - Guard `audioContext.close()`: check `audioCtx.state !== 'closed'` and wrap in `.catch(() => {})`.
   - Ensure `isChefThinking` indicator clears cleanly on errors and debounce VAD triggers.

---

## Verification Criteria
1. Run `cmd /c "npx tsc --noEmit"` to guarantee clean compilation.
2. Upload avatar from Dashboard: verify HTTP 200 response from `/api/user/avatar`, no 401 error.
3. In RecipeDetails, trigger Start Cooking: verify TTS plays voice audio without 500.
4. Speak into microphone in Cooking mode: verify audio transcription succeeds via Gemini without 500, no MediaRecorder or AudioContext errors in console.
