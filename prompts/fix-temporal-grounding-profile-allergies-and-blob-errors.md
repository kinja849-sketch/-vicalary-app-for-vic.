# Implementation Prompt: Fix Temporal Grounding, Profile/Allergy Context Retrieval, and Chat Media Blob Errors

## Problem Summary
From user testing and console logs:
1. **Allergies & Profile Knowledge**:
   - When asked *"Can you tell me what my allergies are?"*, the assistant replied *"I can't determine your allergies"*.
   - **Root Cause**: `loadUserProfileContext` in `ContextAssembler.ts` was only querying `user_profiles`, whereas user allergies and restrictions are saved in `onboarding_responses` (`restrictions`, `dietary_lifestyle`, `health_conditions`, `medical_conditions`, `preferences`).
2. **Temporal Grounding & Hallucinated Dates**:
   - When asked *"What is the date in what month"*, the assistant hallucinated *"Today is October 5, 2023"*.
   - **Root Cause**: The system prompt in `ConversationOrchestrator.ts` did not include the current dynamic date, time, year (2026), and timezone.
3. **Chat Media & Avatar Blob Errors**:
   - Stale `blob:` URLs in message history or user profile cache (e.g. `blob:https://vicalarly.netlify.app/...` or expired localhost object URLs) caused browser errors: `Not allowed to load local resource` and `net::ERR_FILE_NOT_FOUND`.
4. **Subscription Flapping & Auto-Location Redundancy**:
   - Console shows `[Chat] V12 Subscribing to: ...` and `[Auth] Auto-configured location: ...` triggering 3 times redundantly on page mount due to un-guarded effect re-runs.

---

## Proposed Changes

### 1. `the-app-belong-to-vic--main/lib/services/ai/ContextAssembler.ts`
- Enhance `loadUserProfileContext` to query `user_profiles` AND `onboarding_responses`.
- Extract `restrictions` (allergies and dietary constraints), `dietary_lifestyle`, `medical_conditions`, `health_conditions`, `liked_foods`, and `preferences`.
- Combine these cleanly into `UserProfileContext.allergies`, `medicalConditions`, `dietaryPreference`, and `preferences`.

### 2. `the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts`
- Pass dynamic current date/time to `buildSystemPrompt`:
  - `Current Date: [Weekday, Month Day, Year]` (e.g. `Wednesday, August 26, 2026`).
  - `Current Time: [Time] ([Timezone])`.
  - Instruction to always use this exact grounded current date when asked about the date, day, month, or year.

### 3. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Add `sanitizeMediaUrl` helper that checks if a `blob:` URL is stale/cross-origin and converts it to `null` so avatar/initials fallback renders cleanly instead of throwing console network errors.
- Ensure message image rendering filters invalid blob sources before assigning to `<img src>`.
- Strengthen subscription ref guards to eliminate multiple redundant `[Chat] V12 Subscribing to:` logs on mount.

### 4. `the-app-belong-to-vic--main/lib/AuthContext.tsx`
- Add a session ref guard `locationConfiguredUserRef` so `handleLocationConfig` only executes once per user session instead of running 3 times on auth state changes.

---

## Verification Plan

### Automated Checks
- Run `npm.cmd run typecheck` to ensure complete type safety across modified files.
- Run `npm.cmd run build` to ensure Next.js production build passes cleanly.

### Localhost Verification Steps
1. Navigate to `http://localhost:3000/chat`.
2. Open the **Health Coach** chat conversation.
3. Ask: *"Can you tell me what my allergies are?"*
   - Verify the coach accurately lists your allergies and dietary restrictions from your onboarding profile.
4. Ask: *"What is today's date and month?"*
   - Verify the coach accurately responds with the real current date in 2026.
5. Inspect Developer Console:
   - Verify zero `net::ERR_FILE_NOT_FOUND` or `Not allowed to load local resource: blob:` errors.
   - Verify subscription logs and auto-location logs run once cleanly on mount.
