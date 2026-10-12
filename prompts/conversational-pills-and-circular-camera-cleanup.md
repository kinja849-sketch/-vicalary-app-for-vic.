# Implementation Prompt: Conversational Pills, Chef-Guided Flow, Centered Circular Shutter, Continuous Human Speech & Kitchen Camera Cleanup

## 1. Problem Statement & User Feedback
The user highlighted key functional and design issues in the interactive cooking mode:
1. **Remove Ugly Transcripts & Replace with Conversational Pills**: Instead of displaying raw giant text transcripts that wrap awkwardly, format the conversation cleanly using refined conversational speech pills (like the user chat pill and photo badge).
2. **Remove Manual Navigation Arrows (Chef in Control)**: Step navigation is entirely guided by Chef Vic (advancing automatically when steps/photos are authenticated). The manual `<ChevronLeft />` and `<ChevronRight />` arrows clutter the screen and must be removed.
3. **Centered Circular Capture Button**: The current pill-shaped capture button must be replaced by a perfectly centered, circular button with the camera icon centered inside it.
4. **Fix Mid-Speech Break / Abrupt Audio Cutoff**: The AI's voice was cutting out mid-response while the transcript kept writing itself. The root causes:
   - Voice Recognition barge-in was too aggressive, triggering on room audio/device echo from Chef Vic's own voice and calling `audioRef.current.pause()`.
   - `gemini-3.8-flash-tts` encountered free-tier quota limits (HTTP 429) on longer prompts, triggering slow failovers.
   - The typewriter speed was running independently on a fixed 35ms timer rather than matching actual audio playback duration.
5. **Kitchen Camera Modal Header & Overlay Cleanup**:
   - Change the header text from `"KITCHEN CAMERA"` to `"KITCHEN"`.
   - Center the camera viewport clearly and remove intrusive corner offsets as marked by user.
   - Make the frame and shutter crisp, clean, and intuitive.

---

## 2. Source of Truth & Architecture Baseline
- **Protected Surface Rules ([`AGENTS.md`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/AGENTS.md))**: Preserve established colors, typography, meal dish photography card, and zero-hallucination policy.
- **Voice Engine**: [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) with `gemini-3.8-flash-lite-tts` / `gemini-3.8-flash-tts` using female studio voice `Aoede` (and `MsEdgeTTS` - `en-US-JennyNeural`).
- **Interactive Cooking Page**: [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx).

---

## 3. Detailed Scope of Changes

### A. Fix Audio Mid-Sentence Break & Synchronize Typewriter
- **Echo & False Barge-in Guard**: In `recognition.onresult`, ignore interim transcript updates while `isSpeakingRef.current` is true unless the recognized words differ from what Chef Vic is currently saying and have strong confidence.
- **Typewriter Synchronization**: Synchronize the typewriter interval with the actual duration of the generated audio blob (`audio.duration`) so the text reveals smoothly alongside the spoken words without racing ahead or cutting off.
- **Reliable Neural Voice**: Prioritize `gemini-3.8-flash-lite-tts` (which tested 100% successful with HTTP 200 on long prompts) alongside `gemini-3.8-flash-tts` and instant neural fallback `MsEdgeTTS`, eliminating 429 delays and failed audio streams.

### B. Replace Transcripts with Conversational Pills
- Replace the raw multi-line header text with elegant conversational pills:
  - **Chef Vic Speech Pill**: A clean, rounded glassmorphism bubble containing Chef Vic's speech with typewriter effect, animated pulse indicator, and speaker icon.
  - **User Speech Pill**: Align user speech cleanly as a matching response pill.
  - **Captured Photo Pill**: Maintain the inline pill badge with photo thumbnail and authentication status badge.

### C. Centered Circular Capture Button & Chef-Guided Navigation
- Remove the manual `<ChevronLeft />` and `<ChevronRight />` navigation buttons.
- Center the capture button in the bottom controls bar.
- Style the capture button as a sleek circular button with the `<Camera size={24} />` icon centered inside it, surrounded by an active glow.
- Retain the Play/Pause button alongside or seamlessly integrated for voice playback control.

### D. Kitchen Camera Viewpoint Modal Polish
- Update modal header text from `"KITCHEN CAMERA"` to `"KITCHEN"`.
- Ensure the viewfinder frame is cleanly centered with responsive aspect ratio.

---

## 4. Verification Plan
1. Test audio playback on full introductory script: ensure complete, unbroken audio playback without mid-sentence pauses.
2. Verify conversational pills layout in Chrome DevTools mobile viewport (390x844).
3. Verify that the manual navigation arrows are gone and the capture button is centered and circular.
4. Verify the camera modal displays "KITCHEN" and captures photos cleanly into chat pills.
