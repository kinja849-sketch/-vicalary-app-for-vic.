# Feature Implementation Plan: ChatGPT-Style Natural Female Voice, Elimination of "Read Aloud", & High-Intelligence Conversational Focus

## 1. Problem Diagnosis & Root Causes

### Issue 1: Model Literally Speaks "Read Aloud"
- **Cause**: In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), line 490 formatted the text payload as `parts: [{ text: "Read aloud: ${cleanText}" }]`.
- Dedicated neural TTS models (`gemini-3.8-flash-tts` / `gemini-3.8-flash-lite-tts`) vocalize every word in the payload verbatim. Consequently, the voice spoke the literal prefix *"Read aloud:"* before every response.
- **Solution**: Pass `cleanText` directly without any prefix.

### Issue 2: Voice Sounds Excited Rather than Natural & Conversational Like ChatGPT
- **Cause**: The prebuilt voice configured was `Kore`. In Google's voice design, `Kore` has an upbeat, excited, high-pitch delivery.
- **Solution**: Switch voice to **`Aoede`** (with `Leda` as fallback). `Aoede` is a calm, warm, articulate, conversational woman's voice designed to match the natural cadence of modern conversational assistants (like ChatGPT's Sky/Nova).

### Issue 3: Long Thinking Time, Diverging from Question, & Poor Conversational Intelligence
- **Cause**: In [`ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts), `buildSystemPrompt` indiscriminately injected massive unprompted context blocks (food budget tracking IDR balance, today's 0-calorie log counters, meal prep skill ratings, geographic coordinates) into the prompt on every turn.
- Without strict focus directives, the model attempted to address these background variables and diverged into lectures about calories and budgets instead of answering what the user actually asked.
- **Solution**:
  1. Add strict **Conversational Intelligence Directives** instructing the model to answer the exact question asked directly, succinctly, and intelligently without diverging or introducing unprompted topics.
  2. Guard context injection so that budget and meal logging snapshots are only provided when the user's inquiry actually concerns nutrition/meals or budgets.

---

## 2. Solution Architecture

### 1. Update Neural Speech Engine ([`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts))
- Change `voiceName` from `'Kore'` to **`'Aoede'`** (ChatGPT-style natural, warm woman's voice).
- Use `gemini-3.8-flash-lite-tts` as primary and `gemini-3.8-flash-tts` as secondary to ensure instantaneous response times and full active quota.
- Pass `cleanText` directly to the TTS model without the `"Read aloud:"` prefix.

### 2. Sharpen Conversational Intelligence & Eliminate Divergence ([`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts))
- Update `buildSystemPrompt` with strict focus rules:
  ```text
  [CRITICAL CONVERSATIONAL INTELLIGENCE]:
  1. FOCUS ON THE EXACT QUESTION: Answer the user's specific question or topic directly and thoughtfully.
  2. DO NOT DIVERGE: Never bring up unprompted topics, such as the user's budget, calorie counter, or background data, unless explicitly asked.
  3. SOUND NATURAL LIKE CHATGPT: Speak like a real, intelligent, articulate human coach. Keep spoken answers to 2-3 focused, natural sentences.
  ```
- Conditionally omit budget and meal logs from the prompt when the inquiry is general conversation or unrelated.

---

## 3. Touched Files
- [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) — Remove "Read aloud:" prefix, switch voice to `Aoede`, and prioritize low-latency neural TTS model.
- [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts) — Enforce question-focused intelligence rules and eliminate conversational divergence.

---

## 4. Verification Plan
1. **TTS Output Verification**: Test `/api/text-to-speech` with sample text and verify the generated audio contains the calm `Aoede` voice without any "Read aloud" prefix.
2. **Conversation Focus & Intelligence Test**: Test sample queries on `http://localhost:8080/chat` to verify the Coach answers the exact question asked without wandering into budget or calorie tangents.
3. **TypeScript Typecheck**: Run `tsc --noEmit` to confirm 0 compilation errors.
