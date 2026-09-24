# Implementation Prompt — Minimalist Primary Green Avatar & Spoken Fillers

## Objective
Refine the AI Health Coach Voice Modal based on user feedback:
1. Change background to white (`bg-white`) and remove top header ("Health Coach", "US English"), language selector, and box frames.
2. Re-style `HealthCoachAvatar` to match the exact minimalist style of the user reference image (`media_1790283657561.png`), rendered in application primary green (`#10b981` / `#059669`) with white capsule eyes.
3. Replace on-screen text status with natural spoken voice fillers for deep context queries (e.g. "How is the weather in Indonesia?" -> speaks "Give me a second, let me check..."), while simple greetings respond directly without filler speech.

## Implementation Steps
1. Update `components/avatar/HealthCoachAvatar.tsx` to render clean primary green sphere with white capsule eyes and independent blinking.
2. Update `components/AICoachVoiceModal.tsx`:
   - Set background to `bg-white`.
   - Remove top header and dropdown.
   - Restyle controls and status indicator for white background.
   - Implement spoken voice filler audio logic for deep context/search queries.
3. Verify type safety (`tsc --noEmit`) and test on localhost.
