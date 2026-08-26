# Implementation Prompt: Fix Onboarding Allergies Retrieval, Instant Response Delivery, and Stuck Typing Indicator

## 1. Problem Summary & Root Causes
1. **Allergies & Profile Knowledge**:
   - In the database, the user''s allergies were stored in `onboarding_responses.allergies` (`"peanuts seafood cheese egg whites egg whites"`) and `onboarding_responses.dietary_preference` (`"High-protein"`).
   - In `ContextAssembler.ts`, `loadUserProfileContext` queried `restrictions` but omitted `allergies`, `dietary_preference`, `stress_level`, and `weekly_budget` from the `onboarding_responses` select query. As a result, `allergies` remained empty in the assembled context.
2. **Slow Response & Stuck Typing Indicator (`🧠 ...`)**:
   - When a message is sent to the AI Coach, `handleSend` set `otherUserTyping = true`.
   - `sendMessage` dispatched `/api/conversation/process` as a fire-and-forget background fetch without returning the assistant reply payload directly to the UI.
   - The UI relied solely on Supabase Realtime WebSocket events to clear `otherUserTyping` and insert the message. If Realtime was delayed by concurrent query invalidations in `GlobalShell.tsx`, the typing bubble stayed stuck.
3. **Global Chat Invalidation Churn**:
   - `GlobalShell.tsx` was invalidating `['conversations', user.id]` on every message table event, triggering up to 80 renders in `ChatConversation`.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts`
- Update `loadUserProfileContext` to query all relevant profile & health columns from `onboarding_responses`:
  `full_name, age, gender, height_cm, weight_kg, goal, dietary_lifestyle, dietary_preference, restrictions, allergies, liked_foods, preferences, medical_conditions, health_conditions, daily_calorie_goal, weekly_budget`.
- Cleanly parse string allergies (e.g. split space-separated or comma-separated allergy entries, deduplicate like `"peanuts", "seafood", "cheese", "egg whites"`).
- Populate `UserProfileContext.allergies` with the complete list.

### 2. `the-app-belong-to-vic--main/lib/api/chat.ts`
- In `sendMessage` and `provisionAndSendMessage`, await the `/api/conversation/process` call when `isAI` is true and attach `assistantReply` (`{ content, messageId, intent, format }`) to the returned payload.

### 3. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- In `sendMutation.onSuccess`:
  - When `data?.assistantReply` is returned, immediately add the assistant message to the React Query `['messages', conversationId]` cache with deduplication.
  - Reset `setOtherUserTyping(false)` immediately.
- In `sendMutation.onSettled` and `sendMutation.onError`:
  - Always reset `setOtherUserTyping(false)` so the typing indicator never stays stuck.

### 4. `the-app-belong-to-vic--main/components/GlobalShell.tsx`
- Add a debounce/skip guard so `GlobalShell` does not trigger redundant global query invalidation loops while the user is actively engaged on `/chat/[id]`.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.
- `npm.cmd run build` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. Open the **Health Coach** chat conversation.
3. Ask: *"What are my allergies?"*
   - Verify the assistant immediately and accurately lists: Peanuts, Seafood, Cheese, Egg whites.
4. Send a short followup: *"huh"* or *"tell me more"*.
   - Verify the typing indicator clears as soon as the response arrives (~1-2 seconds) without sticking.
5. Check Developer Console for clean logs and zero render loops.
