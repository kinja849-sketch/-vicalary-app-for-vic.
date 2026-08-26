# Fix Voice Modal STT Liveness, Dynamic User Name, and Fast Turn-Taking

## Objective
Fix the AI Health Coach voice modal so that:
1. Speech recognition is fast, responsive, and reliable across browsers (proper BCP-47 locale, continuous streaming, fast 800ms silence finalization).
2. The user's actual name is accurately displayed and spoken instead of generic "User".
3. Dynamic real-time responses from GPT-4o are delivered immediately with fast TTS fallback to eliminate waiting/dead states.
4. Clear visual state indicators (e.g. "Listening to Vic...", "Vic Speaking", "Vee Reasoning...") replace misleading static labels.
