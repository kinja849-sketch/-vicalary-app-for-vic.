# Implementation Prompt: Gemini Human Female Voice, Instant Latency, Conversational Interruption, & Native Camera Modal

## Objective
Refactor the Voice engine and the Cooking Assistant experience in [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts), and [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx) to strictly meet the user's requirements:

1. **Official Gemini Natural Female Human Voice (Aoede / Nova as in Made by Google 2024 Showcase)**:
   - The user shared the Made by Google 2024 Gemini Live voices demonstration (`https://youtube.com/shorts/Y-xIZ_d29-Y`).
   - In [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts), prioritize **`gemini-3.8-flash-tts`** with the prebuilt female voice **`Aoede`** (which verified in live test with status 200 generating human speech WAV/MP3 audio).
   - Use `gemini-3.8-flash-tts` first in the TTS order so it is used throughout the application without fallback to robotic translation audio or browser `SpeechSynthesisUtterance`.

2. **Ultra-Fast Response Latency (<500ms Cadence)**:
   - In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx), reduce the silence detection timeout from 900ms down to **400ms**. As soon as the user finishes their sentence, the query is dispatched immediately.
   - In [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts), stream or return concise, direct 1–2 sentence conversational answers tailored strictly to what the user asked (e.g. "Add one level teaspoon of salt.") so processing is instantaneous.

3. **Instant Speech Interruption & Handling (Barge-In)**:
   - If the user starts speaking while Chef Vic is talking, the system:
     1. Instantly halts `audioRef.current.pause()` and cancels typewriter animation on the very first recognized syllable.
     2. Immediately clears old responses and sets the new user transcript into context.
     3. Submits the correction query to Chef Vic so Chef Vic immediately addresses the misunderstanding.

4. **Meal Image Displayed at the Top (Dish Guide Maintained as Initially)**:
   - The top visual section shows the dish photograph of the meal being cooked ([`recipe.image_url`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx)) as originally designed. It does NOT force an open camera frame inside the meal card.

5. **Capture Button & Full Viewpoint Modal**:
   - A dedicated Capture Button with `<Camera size={20} />` sits below the conversation area.
   - Clicking it navigates to the live device camera viewpoint (viewfinder matching [`Camera.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Camera.tsx)) with live `<video>` preview, front/rear camera switch, and circular shutter button.
   - When snapped, the photo is captured, displayed as an inline **pill-form badge** in the conversation stream, and verified with Vision AI (`/api/cooking-assistant/verify-step`).
   - If the photo is verified, Chef Vic advances to the next step; if something is lacking or problematic, Chef Vic rectifies and explains clearly what is missing before moving on.

6. **Clean, Clutter-Free Interface**:
   - Completely remove `"INGREDIENTS & OVERVIEW"` text.
   - Completely remove the green `"LISTENING..."` indicator pill.
   - Sentences complete naturally to the end without repeating, skipping, or cutting out.

---

## Files to Modify
1. [`lib/ai/ai-fallback.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts):
   - Set `gemini-3.8-flash-tts` with voice `Aoede` (prebuilt Gemini human female voice) as the primary engine for `synthesizeVoiceAudioWithFallback`.
2. [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
   - Restore top meal dish photography card.
   - Implement bottom Capture button with camera icon opening the device viewpoint viewfinder.
   - Display captured photo in the conversation as a pill-style thumbnail.
   - Implement snappy 400ms silence detection and instant speech barge-in interruption.
   - Remove `"INGREDIENTS & OVERVIEW"` and the green `"LISTENING..."` badge.

---

## Acceptance Criteria
- Voice is the official Gemini female human voice (`Aoede`), exactly matching the Google Gemini Live demonstration.
- Response latency is immediate upon finishing speech.
- Interruption works instantly when speaking over the AI.
- Meal photo is displayed in the top card as originally designed.
- Tapping capture opens the device camera viewpoint, captures the picture, shows it as a pill in chat, and receives Chef Vic's guidance.
