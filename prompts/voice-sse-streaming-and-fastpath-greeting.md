# Implementation Prompt: Voice Streaming (SSE) & Fast-Path Greeting Turnaround

## 1. Objective & Requirements
- Transform `/api/conversation/process` and `AICoachVoiceModal.tsx` into a **streaming audio/events pipeline** so the browser starts playing the first audio sentence in **< 1.0s**, before the full text response finishes generating.
- Implement an **intent-based fast path** for greetings and casual conversation (*"Hi"*, *"How are you?"*, *"Good morning"*), bypassing unnecessary tool executions and database lookups.
- Keep database persistence 100% asynchronous without blocking the audio stream.
- Preserve 100% of user profile context (name, onboarding, allergies, calories), tool capabilities (Tavily search), and JWT authentication.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/app/api/conversation/process/route.ts`
- Support Server-Sent Events (`text/event-stream`) for voice mode:
  - `event: first_audio` $\to$ Dispatches base64 audio of the first sentence immediately (~400-800ms).
  - `event: text_chunk` $\to$ Streams additional text tokens.
  - `event: done` $\to$ Final completion metadata & metrics.
- Keep fallback JSON response for standard non-streaming callers.

### 2. `the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx`
- Read the streaming response chunks via `ReadableStream` / EventStream parser.
- The instant `first_audio` event arrives, **immediately play audio and transition Blob to SPEAKING**.
- Safe performance instrumentation:
  - `[VOICE] Speech ended`
  - `[AI] First sentence audio received: XXXms`
  - `[VOICE] Time-to-first-audio: XXXms ⚡`

### 3. `the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts`
- Fast-path for greetings: skips external tool queries and dynamic database checks while retaining cached user profile context (Name, Goal, Calories).

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. Open **Health Coach** $\to$ Click **Talk to Coach**.
3. Say: *"Hi, how are you doing?"*
   - Verify time-to-first-audio drops to **~0.8–1.2 seconds**.
   - Verify Vee greets you warmly and naturally without artificial delays.
4. Say: *"What are my target calories and allergies?"*
   - Verify immediate audio stream citing *Peanuts, Seafood, Cheese, Egg whites* and 1,912 kcal.
