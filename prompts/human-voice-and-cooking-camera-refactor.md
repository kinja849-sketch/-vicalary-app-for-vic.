# Implementation Prompt: Authentic Health Coach Voice, Meal Photograph Visual, & Camera Viewpoint Capture Modal

## Objective
Refactor the Cooking Mode experience in [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx) and the AI TTS engine in [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) to strictly satisfy the user's explicit design and voice requirements:

1. **Hyper-Realistic Human Neural Voice (JennyNeural / Nova)**:
   - Integrate `msedge-tts` (Microsoft Neural Voices — e.g., `en-US-JennyNeural`) into [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts). This completely eliminates the Google Translate TTS robotic cadence and browser `SpeechSynthesisUtterance`. It produces warm, fluent, studio-grade human speech.
   - Stop text repetition, skipping, and sentence truncations by properly splitting sentences into complete, natural phrases and playing audio to its natural end.

2. **Meal Image Displayed at the Top (Dish Guide Maintained as Initially)**:
   - The top visual card displays the actual recipe photograph of the meal we are cooking (`recipe.image_url` / canonical recipe photography) with Chef Vic's state. It does NOT force an open camera frame inside the meal card.

3. **Camera Viewpoint Triggered on Demand via Capture Button**:
   - A dedicated Capture Button with a Camera icon (`<Camera size={20} />`) is located below the conversation area.
   - Clicking this capture button opens the full live device camera viewpoint (viewfinder matching [`Camera.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Camera.tsx)) with live `<video>` stream, camera flipping (`switchCamera`), and shutter button.
   - Snapping the photo analyzes it via Vision AI (`/api/cooking-assistant/verify-step`).

4. **Pill-Form Captured Photo in the Conversation Stream**:
   - The captured image is immediately displayed as an inline pill-style preview badge inside the conversation transcript.
   - Chef Vic replies directly to the analyzed photo. If ingredients/techniques are good, Chef praises and advances to the next step. If something is missing (e.g. not enough salt), Chef Vic rectifies and explains clearly what is lacking.

5. **Clean Conversational Interface (No Clutter)**:
   - Remove `"INGREDIENTS & OVERVIEW"` header text.
   - Remove the `"LISTENING..."` pill badge.
   - Keep conversation natural, fluid, and seamless matching the Health Coach experience.

---

## Files to Modify

1. [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts):
   - Replace Google Translate fallback with `MsEdgeTTS` (`en-US-JennyNeural`) in `synthesizeVoiceAudioWithFallback`.
   - Ensure clean MP3 generation with zero robotic artifacts.

2. [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
   - Restore the meal image card at the top displaying the verified recipe dish photography.
   - Remove `"INGREDIENTS & OVERVIEW"` and the green `"LISTENING..."` pill.
   - Implement the camera button below the conversation that opens the native device viewpoint modal/overlay.
   - Render captured photos as pill badges inside the conversation stream.
   - Wire speech recognition and TTS playback to run continuously without stuttering or truncating.

---

## Acceptance Criteria
- Voice sounds 100% human, identical to top-tier neural voices (JennyNeural).
- Sentences finish cleanly without repeating, skipping, or cutting out.
- The dish being cooked is displayed in the top card as originally designed.
- Tapping the capture button opens the device viewpoint, captures live photos, analyzes them, and shows the photo as a pill in the chat with Chef Vic's feedback.
