# Implementation Prompt — Permission Manager & 3D Character Avatar for AI Health Coach

## Objective
Fix the camera and microphone permission lifecycle into a single application-level permission manager, persist permission onboarding in Supabase `user_permissions`, replace the Health Coach visual with an interactive 3D Character Avatar (glossy black body, glowing green capsule eyes, translucent green shell, inner energy, and ground shadow), and fix the mobile `Listening -> Thinking -> Listening` voice turn loop defect.

## Implementation Steps
1. Create `public.user_permissions` table in Supabase via PG script `run-sql.js`.
2. Build `lib/services/PermissionManager.ts` to manage application onboarding and browser permission states (`granted`, `prompt`, `denied`, `unavailable`).
3. Refactor `lib/api/permissions.ts`, `CameraCapture.tsx`, `QRScanner.tsx`, and `app/_pages/Camera.tsx` to use `PermissionManager`.
4. Build `components/avatar/HealthCoachAvatar.tsx` as a state-driven 3D Character Avatar component with independent eye blinking/winking geometry, mic-reactive listening, thinking bounce animation, search tool status messages, and audio-reactive speaking pulses.
5. Fix `AICoachVoiceModal.tsx` turn controller with `turnInProgressRef` turn lock, preventing STT restarts during `thinking`/`speaking` states and stopping STT capture during AI audio output.
6. Verify type safety (`npm run typecheck`) and test on localhost.
