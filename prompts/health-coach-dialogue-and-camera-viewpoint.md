# Implementation Prompt: Health Coach Dual Dialogue, Human Neural Voice, & Native Camera Viewpoint

## Objective
Fix the Cooking Mode experience in [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx) to strictly meet the user's requirements:
1. **Remove Unacceptable Design**: Completely remove the card widget containing `"CAPTURE GATHERED INGREDIENTS"` and `"SHOW CHEF"`.
2. **Native Camera Viewpoint (Exact Camera.tsx Behavior)**: The preview and capture must use the live device camera viewpoint directly in the visual preview area, with front/rear camera toggle and the circular shutter button matching [`app/_pages/Camera.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Camera.tsx). Captured images freeze in the preview while Chef Vic analyzes and authenticates them.
3. **Eliminate Robotic Voice & Enforce Human Neural TTS**: Fix [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) and [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx) to always use human voice via `/api/text-to-speech`. Completely strip robotic `SpeechSynthesisUtterance` fallback.
4. **Health Coach Dialogue Engine**: Wire the exact dialogue flow used in [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx): continuous streaming voice recognition, barge-in speech interruption, tailored responses to queries (e.g., salt amounts or ingredients), and seamless turn hand-offs back to listening.

---

## Detailed Changes

### 1. Completely Remove the "Show Chef" Widget Card
- **File**: [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)
- Delete the entire bottom card widget (`CAPTURE GATHERED INGREDIENTS` / `SHOW CHEF`).
- Keep the bottom controls clean: Previous, Play/Pause, Next.

### 2. Native Camera Viewpoint & Capture (Like `Camera.tsx`)
- **File**: [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)
- The visual layer in cooking mode integrates the live device camera viewpoint (`<video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />`).
- Controls overlaid on the camera viewpoint:
  - Top-right: Switch Camera (`facingMode` environment / user toggle) matching [`Camera.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Camera.tsx).
  - Top-left: View toggle pill ("Live Camera" vs "Recipe Visual") so users can reference the plated dish guide or see their pan.
  - Bottom: The circular shutter button matching [`Camera.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Camera.tsx) (`w-16 h-16 bg-vic-green rounded-full flex items-center justify-center border-4 border-white/30 shadow-lg active:scale-95`).
- When captured: The snapshot freezes into `capturedImage` preview with a subtle analyzing spinner, sends to Vision AI via `/api/cooking-assistant/verify-step`, Chef Vic approves and speaks feedback, and advances the step.

### 3. Human Neural Voice Architecture (No Robotic Fallback)
- **Files**:
  - [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts):
    - Added resilient neural audio fallback returning real human MP3 audio (status 200) even when OpenAI / Gemini preview quotas are exhausted.
  - [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
    - Switch `playTTS` to call `/api/text-to-speech` with `DEFAULT_COACH_VOICE` (`nova`).
    - Remove all `window.speechSynthesis.speak(utterance)` calls. Robotic browser voices will never be invoked.

### 4. Health Coach Dialogue Engine
- **File**: [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)
- Port the continuous turn engine from [`components/AICoachVoiceModal.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/AICoachVoiceModal.tsx):
  - Uses `SpeechRecognition` / `webkitSpeechRecognition` for live, real-time speech transcription without chunk latency.
  - When user speaks:
    - If Chef is speaking: instant barge-in interrupt pauses audio and halts typewriter.
    - Live spoken text appears instantly in the "You" transcription bubble.
    - On silence completion: dispatches query to `/api/cooking-assistant/chat`.
  - When Chef replies:
    - Text typed and spoken via human neural voice.
    - Tailored strictly to the user query and recipe facts (no hallucination).
    - When audio ends: immediately opens microphone back to `listening` state for fluid dual dialogue.

---

## Acceptance Criteria
1. The widget card with "CAPTURE GATHERED INGREDIENTS" and "SHOW CHEF" is completely gone.
2. The visual layer uses the device camera viewpoint directly (live `<video>` preview, switch camera, and circular shutter button exactly like the Camera feature).
3. TTS uses real human neural voice with zero robotic browser audio.
4. Two-way dialogue works like the Health Coach: live speech recognition, instant interruption, and tailored chef replies.
