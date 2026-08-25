# Implementation Prompt: AI Voice Agent Service (Cooking Guide & Health Coach)

## Goal
Create a Python voice-agent service at `voice-agent/` using GetStream Vision Agents SDK (`vision-agents`), Stream Edge transport (`getstream.Edge`), and OpenAI Realtime (`openai.Realtime`). Integrate with VICALARY Next.js application for server-side token generation and real-time voice interaction for two personas:
1. **Cooking Guide (Chef Avatar)** — Interactive voice guidance on recipes, cooking steps, and culinary tips.
2. **Health Coach** — Voice conversation on nutrition, daily progress, macros, and wellness goals.

## Core Requirements & Architecture
1. **Service Location**: `voice-agent/` Python service.
2. **SDK & Dependencies**:
   - `vision-agents[getstream,openai]`
   - `fastapi` & `uvicorn`
   - `python-dotenv`, `pydantic`
3. **Transport & AI Model**:
   - `getstream.Edge` transport reusing `STREAM_API_KEY` and `STREAM_API_SECRET` from parent `.env`.
   - `openai.Realtime` model (`gpt-4o-realtime-preview` / `gpt-realtime-2`) using `OPENAI_API_KEY`.
4. **Persona Modes**:
   - Mode `cooking_guide`: Expert Chef persona for step-by-step cooking instructions, ingredient substitutions, and culinary advice.
   - Mode `health_coach`: Friendly Nutrition & Health Coach for reviewing calories, macros, weight progress, and wellness goals.
5. **Language Preference**:
   - Accepts preferred language from user settings / i18n (e.g. English, Indonesian, Arabic, French, Spanish, etc.).
   - Instructs the AI agent to converse in the preferred language with English as fallback.
6. **Server-Side Token Route**:
   - `app/api/voice-agent/session/route.ts`: Secure server-side route issuing Stream call tokens for frontend participants.
   - Secrets (`STREAM_API_SECRET`, `OPENAI_API_KEY`) remain strictly on server side.
7. **Verification & Clean Startup**:
   - Verified against `vision-agents` 0.6.9 SDK shapes (`Agent`, `User`, `getstream.Edge`, `openai.Realtime`).
   - Service starts and initializes cleanly.

## Target File Structure
- `voice-agent/requirements.txt`
- `voice-agent/main.py`
- `voice-agent/.env.example`
- `app/api/voice-agent/session/route.ts`
- `components/VoiceAgentCall.tsx`
