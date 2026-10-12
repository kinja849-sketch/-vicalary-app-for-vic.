# Implementation Plan: Interactive Two-Way AI Chef with Step Visual Authentication & Single Unified Voice

## Objective
Transform the Cooking Assistant ("Start Cooking") into a responsive, real-time two-way dialogue session where:
1. **Single Unified Voice**: Lock the voice strictly to the same human voice used in the Health Coach conversation (`DEFAULT_COACH_VOICE = 'nova'` in OpenAI / `Aoede` in Gemini Neural TTS), eliminating voice selection options and ensuring natural, human sound across every recipe.
2. **True Two-Way Responsive Dialogue**:
   - The Chef talks, listens, and replies directly to user questions (e.g. "Hey wait, can you tell me how many spoons of salt must I put?" -> Chef answers with the exact quantity from the recipe's ingredients and immediate actionable advice without hallucinating or ignoring).
   - In overview mode, the Chef details the ingredients, asks if the user is ready, and prompts: *"Once you have everything gathered, take a photo so I can confirm you're all set!"*
3. **Chef-Controlled Step Progression via Photo Authentication**:
   - Each step features a camera capture / upload trigger ("Show Chef").
   - When the user sends a photo, the Chef inspects it with Vision AI against the current recipe step requirements (e.g., checks if water is boiling, onions are golden brown, all ingredients are laid out, or if salt was missed).
   - If there is an issue (e.g. missing ingredient, undercooked, incorrect stage), the Chef speaks targeted correction advice and keeps the user on that step.
   - Once the photo is authenticated and confirmed, the Chef says: *"Great job! Let's move to the next step,"* and advances the step automatically. The Chef is strictly in control of moving to the next step.

---

## Architecture & Sources of Truth
- [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx): Guided cooking UI state, VAD/mic loop, photo capture input, and conversation timeline.
- [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts): Two-way culinary question answering route enriched with full recipe context (title, all ingredients with amounts, current step, and cooking state).
- [`app/api/cooking-assistant/verify-step/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/verify-step/route.ts): Vision AI step authentication endpoint that verifies cooking progress from images.
- [`app/api/cooking-assistant/tts/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/tts/route.ts): Single unified voice route locked to `DEFAULT_COACH_VOICE`.
- [`app/api/cooking-assistant/orchestrate/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/orchestrate/route.ts): Initial session prompt generator ensuring the Chef invites questions and prompts for visual verification.

---

## Detailed Step-by-Step Implementation

### 1. Lock Single Unified Voice
- In [`app/api/cooking-assistant/tts/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/tts/route.ts):
  - Import `DEFAULT_COACH_VOICE` ('nova') from `@/lib/services/ai/ConversationOrchestrator`.
  - Enforce `voice: DEFAULT_COACH_VOICE` without allowing client overrides to fragment voice identity.
  - Backup provider automatically uses `Aoede` (the natural, articulate woman's neural voice).

### 2. Context-Rich Two-Way Culinary Dialogue Endpoint
- In [`app/api/cooking-assistant/chat/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/chat/route.ts):
  - Pass the entire `recipe.ingredients` list (with exact amounts, units, and item names), full recipe steps, current step number, and current step instruction.
  - System prompt instructions:
    - *"You are Chef Vic, a warm, Michelin-level personal culinary coach standing beside the user in their kitchen."*
    - *"Answer specific ingredient or technique questions accurately using the provided ingredients list. If asked 'how many spoons of salt' or 'how much butter', provide the exact measurement from the recipe."*
    - *"Never hallucinate ingredients not in the recipe. If an ingredient is not in the list, tell the user gently."*
    - *"Always invite them to take the next action: 'Once you've done that, take a quick photo and show me so we can continue!'*
    - Keep answers to 1-3 spoken, clear, conversational sentences.

### 3. Step Photo Authentication Endpoint (`/api/cooking-assistant/verify-step`)
- Create [`app/api/cooking-assistant/verify-step/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/cooking-assistant/verify-step/route.ts):
  - Accepts `imageBase64`, `recipeTitle`, `stepIndex`, `stepInstruction`, `ingredients`, and `language`.
  - Uses multimodal Vision AI (Google Gemini 2.5 Flash / OpenAI Vision) to inspect the cooking image.
  - Evaluates:
    - Did the user complete this step?
    - Are the required ingredients visible or correctly incorporated (e.g. salt added, vegetables chopped, sauce simmering)?
    - Any safety or quality issues (burning, undercooking, missing element)?
  - Returns structured JSON:
    ```json
    {
      "authenticated": true, // or false
      "feedback": "Spoken feedback from Chef (e.g. 'Those onions look perfectly golden brown and tender! Let's move to step 2.')",
      "guidance": "Specific advice if correction needed"
    }
    ```

### 4. Interactive Guided UI & Camera Integration in RecipeDetails
- In [`app/_pages/RecipeDetails.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/RecipeDetails.tsx):
  - Add camera input button (`<input type="file" accept="image/*" capture="environment" />`) with an eye/camera button: **"Show Chef" / "Verify with Photo"**.
  - When the user uploads/captures a photo:
    - Display uploaded preview in the step card.
    - Set Chef status to "Analyzing your cooking...".
    - POST to `/api/cooking-assistant/verify-step`.
    - If `authenticated === true`: Chef speaks the praise via TTS, displays checkmark, and triggers `navigateStep('next')` automatically after the speech concludes!
    - If `authenticated === false`: Chef speaks the constructive feedback (e.g., *"I don't see the salt yet, or it needs another 2 minutes to simmer. Check that, then snap another photo!"*), keeping the user on the step.
  - Chef prompts user on ingredient overview: *"Once you have everything gathered, send me a picture so I can confirm you're all set!"*
  - Ensure continuous two-way microphone conversation loop: after Chef finishes speaking any answer, the mic automatically un-mutes and continues listening for follow-up questions.

---

## Verification Criteria
1. TypeScript clean compile (`npx tsc --noEmit`).
2. Test `/api/cooking-assistant/chat` with specific ingredient measurement queries ("how much salt?") and verify exact recipe match.
3. Test `/api/cooking-assistant/verify-step` with dummy/sample image and verify structured authentication JSON.
4. Test in Chrome DevTools:
   - Voice guidance starts in single unified voice.
   - Ask culinary questions via speech -> Chef answers with exact recipe details.
   - Upload cooking photo -> Chef authenticates and controls transition to the next step.
