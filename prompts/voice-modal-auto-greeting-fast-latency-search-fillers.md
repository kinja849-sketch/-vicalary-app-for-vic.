# Implementation Prompt — Automatic Voice Greeting, Fast Latency & Instant Search Fillers

## Objective
Implement auto-greeting upon modal selection, optimize turn latency (800ms snappy VAD silence cadence), and add instant spoken search fillers ("Let me check that for you", "Let me see") for search/tool queries.

## Implementation Steps
1. Update `components/AICoachVoiceModal.tsx`:
   - Auto-greeting: Play fast voice greeting out loud when modal opens and mic permission is granted.
   - VAD Snappy Cadence: Tune silence timer from `1400ms` -> `800ms`.
   - Instant Search Fillers: Play fast spoken filler phrases (*"Let me check that for you"*, *"Let me see"*) for deep context/search queries.
2. Verify type safety (`tsc --noEmit`) and test on localhost.
