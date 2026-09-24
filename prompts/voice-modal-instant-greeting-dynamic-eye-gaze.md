# Implementation Prompt — Dynamic 360° Eye Gaze & Instant Auto-Greeting (Zero Tap)

## Objective
Add dynamic eye gaze movement (looking left, right, up, down, center, and diagonal) to `HealthCoachAvatar.tsx` alongside natural blinking, ensure immediate auto-greeting upon modal selection without requiring user tap, and remove "Tap avatar to speak".

## Implementation Steps
1. Update `components/avatar/HealthCoachAvatar.tsx`:
   - Implement `eyeGaze` state controller `({ x, y })` for directional gaze shifts (left, right, up, down, center, diagonal).
   - In `idle`, schedule natural random gaze shifts every 2.5s–5s. In `thinking`/`searching`, glance up/diagonally. In `listening`/`speaking`, center-focused attentive gaze.
   - Animate eye position `(x, y)` smoothly with Framer Motion alongside eye blinking `scaleY`.
2. Update `components/AICoachVoiceModal.tsx`:
   - Synchronously initialize `hasMicPermission` from local storage cache.
   - Trigger out-loud greeting immediately on mount (`updateVoiceState('speaking')`).
   - Remove `"Tap avatar to speak"` from `getStatusLabel()`.
3. Verify type safety (`tsc --noEmit`) and test on localhost.
