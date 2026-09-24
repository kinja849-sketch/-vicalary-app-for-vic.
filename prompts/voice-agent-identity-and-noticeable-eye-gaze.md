# Implementation Prompt — Unified Voice Agent Identity & Noticeable Eye Gaze Movement

## Objective
Standardize a single authoritative voice persona (`'nova'`) across all TTS & conversation endpoints so greetings, fillers, and main replies use the exact same voice agent, and expand `HealthCoachAvatar` gaze displacement offsets for clearly noticeable 360° eye movement.

## Implementation Steps
1. Update `lib/services/ai/ConversationOrchestrator.ts`:
   - Export `DEFAULT_COACH_VOICE = 'nova'`.
2. Update `app/api/text-to-speech/route.ts`:
   - Set default voice to `'nova'`.
3. Update `components/AICoachVoiceModal.tsx`:
   - Pass `voice: 'nova'` in `speakText` calls.
4. Update `components/avatar/HealthCoachAvatar.tsx`:
   - Expand `GAZE_OFFSETS` displacement ranges for left, right, up, down, and diagonal glances to make gaze movement clearly noticeable.
5. Verify type safety (`tsc --noEmit`) and test on localhost.
