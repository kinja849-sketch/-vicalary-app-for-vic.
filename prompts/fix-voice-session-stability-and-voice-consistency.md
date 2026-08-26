# Fix Voice Session Stability, Channel Flapping, Mic Onboarding, and Voice Quality

## Objective
Address the multi-layer degradation affecting the AI Health Coach voice and chat sessions:
1. **Stabilize Chat Realtime:** Eliminate channel subscribe/unsubscribe flapping in `ChatConversation.tsx` by isolating effect dependencies and preventing read/focus updates from resetting channels.
2. **Explicit Up-front Mic Permission:** Prompt user with an explicit "Enable Microphone" gesture screen before marking the session as live.
3. **Strict Neural Voice Path (Zero Robotic Fallback):** Use OpenAI HD Neural voice exclusively. Ban browser `speechSynthesis` fallback to prevent voice quality from degrading into a robotic voice.
4. **Clean Call UI (No Live Subtitles):** Remove live captioning strips during the active call.
5. **Session-End Transcript Persistence:** On call termination only, append the complete recorded conversation (user + coach turns in order) to the chat thread.
6. **WebGL Resilience & Blob URL Hygiene:** Add WebGL context loss listeners and graceful 2D canvas fallback without resetting the voice engine. Sanitize dead blob URLs.
