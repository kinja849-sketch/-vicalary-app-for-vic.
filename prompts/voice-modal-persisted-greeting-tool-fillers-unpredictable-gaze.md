# Implementation Prompt — Persisted Greetings, Search-Only Fillers & Unpredictable Gaze

## Objective
Persist auto-greetings to Supabase conversation message history, restrict spoken fillers strictly to web search/tool queries, and enable highly noticeable, unpredictable 360° eye gaze movement across all states (including while speaking).

## Implementation Steps
1. Update `components/AICoachVoiceModal.tsx`:
   - Persist initial out-loud greeting to Supabase `messages` table for `conversationId`.
   - Refine `isDeepContextQuery(text)` to trigger spoken search fillers ONLY for explicit web search, weather, recipe, or tool lookups.
2. Update `components/avatar/HealthCoachAvatar.tsx`:
   - Allow dynamic eye gaze shifts during ALL states (including `speaking` and `listening`).
   - Define 9 wide directional gaze offsets (`farLeft`, `farRight`, `lookUp`, `lookDown`, `upLeft`, `upRight`, `downLeft`, `downRight`, `center`).
   - Run unpredictable random selection timer (1.2s to 3.5s interval).
3. Verify type safety (`tsc --noEmit`) and test on localhost.
