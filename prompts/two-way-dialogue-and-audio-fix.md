# Implementation Prompt: Two-Way Dialogue Chat Flow, Tailored Culinary Intelligence & Unbroken Human Voice

## 1. Problem Statement & User Feedback
The user reported three key problems in the interactive cooking mode:
1. **Wrong Chat Positioning & Lack of Two-Way Dialogue History**:
   - Currently, when the user speaks or sends a greeting like "hello", their message is not appended into a persistent two-way dialogue thread. Instead, Chef Vic's response either overwrites the same single text box or appears in the wrong position.
   - Requirement: It must behave as a genuine two-way conversation (like Health Coach or a modern messaging experience). When the user says "hello", their message appears in a user bubble on the right, and Chef Vic's contextual response appears directly below it on the left.
2. **AI Is Not Speaking / Mid-Speech Breakdown**:
   - When the user asks a question, Chef Vic sometimes doesn't speak at all or stalls on "Thinking...".
   - Root causes identified:
     - `callChatCompletionWithFallback` in [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) experienced 429 quota exhaustion on `gemini-3.5-flash` / `gemini-3.6-flash`.
     - In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), the backup models array lacked high-availability models `gemini-flash-latest` and `gemini-3.7-flash` (which return HTTP 200 immediately).
     - In TTS synthesis, `gemini-3.8-flash-lite-tts` had exhausted its 10 requests/day quota, delaying audio generation. Meanwhile, `gemini-3.1-flash-tts-preview` with female voice `Aoede` returns HTTP 200 immediately with full unbroken audio.
3. **Culinary Intelligence Tailored to the Question (No Hallucination or Static Script Echoes)**:
   - When the user greets or asks specific questions ("hello", "how many spoons of salt?", "what are we cooking?"), Chef Vic must directly answer the question in natural, friendly culinary language without hallucinating or reading irrelevant static scripts.
4. **Preserve Established Design**:
   - Keep the meal photography card at the top.
   - Keep the circular capture button centered at the bottom.
   - Keep "KITCHEN" camera viewpoint.

---

## 2. Technical Architecture & Data Flow

### A. Two-Way Conversational State in [`RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)
- Introduce a structured conversation history:
  ```typescript
  interface CookingChatMessage {
    id: string;
    sender: 'chef' | 'user';
    text: string;
    photo?: string;
    timestamp: number;
  }
  ```
- When cooking starts:
  - Add Chef Vic's initial welcome message to the thread:
    ```typescript
    { id: 'msg-0', sender: 'chef', text: session.overview.text, timestamp: Date.now() }
    ```
- When user speaks / asks a question (e.g. "hello"):
  - Append user's message to the conversation:
    ```typescript
    { id: 'user-' + Date.now(), sender: 'user', text: query, timestamp: Date.now() }
    ```
  - Display "Chef is thinking..." indicator below the user's message.
- When Chef Vic's response arrives:
  - Append Chef Vic's response to the conversation:
    ```typescript
    { id: 'chef-' + Date.now(), sender: 'chef', text: answer, timestamp: Date.now() }
    ```
  - Play the human neural voice audio (`Aoede`) via `/api/text-to-speech`.
  - Type out the text smoothly in sync with the audio.
  - Auto-scroll the chat container smoothly so the latest message is always in view.

### B. Reliable AI Chat Resilience in [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) & [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts)
- Update `fallbackModels` in `callChatCompletionWithFallback` to include `gemini-flash-latest`, `gemini-3.7-flash`, and `gemini-3-flash-preview` to prevent 429 quota failures.
- In `app/api/cooking-assistant/chat/route.ts`, keep response length focused (2-3 concise, natural sentences) so TTS synthesis is lightning fast (<800ms) and never runs into timeouts.

### C. Reliable High-Fidelity Human TTS Synthesis
- In `synthesizeVoiceAudioWithFallback`:
  - Prioritize `gemini-3.1-flash-tts-preview` with `voiceName: 'Aoede'` (verified active with HTTP 200).
  - Include failover to `gemini-3.8-flash-lite-tts` and `gemini-3.8-flash-tts`.
  - Ensure the PCM to WAV conversion delivers clean 24kHz audio headers so HTML5 `<audio>` plays instantly without glitches.

---

## 3. Files to Modify
1. [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts): Add active models `gemini-flash-latest`, `gemini-3.7-flash` to chat fallback list; set `gemini-3.1-flash-tts-preview` as primary neural TTS model.
2. [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts): Enhance prompt to guarantee tailored, context-specific responses and avoid empty answers.
3. [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx): Implement persistent two-way chat message list (`cookingMessages`), render user messages on the right, Chef Vic messages below on the left, smooth auto-scroll, and reliable voice playback.

---

## 4. Verification Plan
1. Send test query to `/api/cooking-assistant/chat` and `/api/text-to-speech` to confirm 200 OK responses with instant turnaround.
2. Verify in Chrome DevTools on `http://localhost:8080/recipe/a494ac53-a691-4568-b0ae-a9f3945e1c4b`:
   - Start cooking mode.
   - Say "hello" or trigger a voice query.
   - Verify user bubble appears on the right ("hello").
   - Verify Chef Vic responds below it on the left with a warm, tailored greeting mentioning the meal.
   - Verify speech synthesis plays clearly without cutting off mid-sentence.
