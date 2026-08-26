# Fix Health Coach Conversational Partner & Unified Generative Pipeline

## Objective
Make the Health Coach behave like a live, intelligent conversational partner (ChatGPT-style supportive health coach) across text and voice. Eliminate hardcoded greetings, remove client canned strings, implement idempotent single-welcome generation for empty threads, ensure full conversation history context, and unify voice and text into the exact same generative pipeline.

## Key Changes
1. **Unified Server Generative Brain (`app/api/coach-reply/route.ts`):**
   - Natural conversational coach persona (Vee): warm, supportive, human, non-clinical.
   - Handles multi-turn memory with full conversation history.
   - Synthesizes live web evidence naturally without raw dumps.
   - Provides an idempotent welcome generator (`action: 'welcome'`) for empty threads that runs at most once.
2. **Client Chat & Dispatch Alignment (`app/_pages/ChatConversation.tsx` & `lib/api/chat.ts`):**
   - Direct all coach message generation to `/api/coach-reply`.
   - Never inject hardcoded greetings or starters into the UI.
   - When user starts typing in an empty thread, skip any welcome and answer user's first message directly.
3. **Voice Modal Alignment (`components/AICoachVoiceModal.tsx`):**
   - Remove hardcoded mount speech (`initialGreeting` string).
   - Use the same transcript -> `/api/coach-reply` -> spoken output pipeline.
   - Strict listen -> understand -> reply loop with no interruptions.
