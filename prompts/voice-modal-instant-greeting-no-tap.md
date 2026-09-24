# Implementation Prompt — Instant Auto-Greeting Upon Selection (No Tap Required)

## Objective
Ensure the Health Coach Voice Modal starts the out-loud voice greeting immediately upon selection without requiring the user to tap the avatar, and remove the "Tap avatar to speak" message.

## Implementation Steps
1. Update `components/AICoachVoiceModal.tsx`:
   - Synchronously initialize `hasMicPermission` to `true` if local permission cache exists.
   - Set `updateVoiceState('speaking')` immediately in `triggerAutoGreeting()` so state is `'speaking'` from turn start.
   - Remove `"Tap avatar to speak"` from `getStatusLabel()`.
2. Verify type safety (`tsc --noEmit`) and test on localhost.
