# Implementation Prompt: Canonical User Context, Speech Number Normalizer & Strict Realtime Deduplication

## 1. Problem & Root Cause Breakdown
1. **User Identity & Onboarding Missing from AI**:
   - `ConversationOrchestrator.ts` conditionally skipped `loadUserProfileContext` for non-voice or greeting intents.
   - When the user asked "What is my name?", "What are my calories?", or general questions, profile context was `null`.
   - **Fix**: Make `loadUserProfileContext` mandatory for every conversation turn (cached for 60s in-memory for 0ms latency). The AI will ALWAYS know the user's name, onboarding responses, dietary preferences, allergies, calorie targets, and location.
2. **TTS Number & Calorie Pronunciation ("1,912 calories")**:
   - Raw numeric formatting ("1,912") causes TTS engines to stumble or spell out awkward digits.
   - **Fix**: Create `lib/services/ai/SpeechFormatter.ts` to convert numbers, calorie units, weights, and times into natural spoken phrases before audio synthesis, while keeping numeric formats clean for UI text.
3. **Duplicate Channel Subscription Guard**:
   - `ChatConversation.tsx` lacked the `activeSubscriptionIdRef.current === currentSubKey` check before teardown, causing redundant re-subscriptions on mount.
   - **Fix**: Restore strict idempotent channel caching so exactly 1 channel exists per conversation.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/lib/services/ai/SpeechFormatter.ts` (NEW)
- Convert digits & units to natural phonetics for TTS (`1,912` $\to$ `one thousand nine hundred twelve calories`, `25 kg` $\to$ `twenty-five kilograms`).

### 2. `the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts`
- Always load `UserProfileContext` unconditionally on every turn.
- Apply `formatForSpeech` to `audioBase64` TTS synthesis input.
- Ground Vee with structured User Identity, Onboarding Health Profile, Calories, and Verified Location on every request.

### 3. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Ensure strict idempotent subscription lifecycle (`activeSubscriptionIdRef.current === currentSubKey`).

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. In chat or voice mode, ask:
   - *"What is my name and what are my target calories?"* $\to$ Verify Vee states your exact name and daily calorie target (e.g. 1,912 kcal).
   - *"What are my onboarding allergies?"* $\to$ Verify Vee cites Peanuts, Seafood, Cheese, Egg whites.
   - *"What is my current location?"* $\to$ Verify Vee knows your location context (e.g. Indonesia).
3. In Voice Mode, verify Vee speaks "one thousand nine hundred twelve calories" naturally without awkward digit spelling.
4. Check console $\to$ verify exactly **1 subscription** log entry.
