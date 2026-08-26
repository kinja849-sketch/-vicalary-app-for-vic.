import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import Pipecat components with version compatibility
try:
    from pipecat.transports.services.daily import DailyTransport, DailyParams
except ImportError:
    from pipecat.transports.daily.transport import DailyTransport, DailyParams

try:
    from pipecat.services.openai_realtime_beta import OpenAIRealtimeBetaLLMService as OpenAIRealtimeLLMService
except ImportError:
    try:
        from pipecat.services.openai.realtime.llm import OpenAIRealtimeLLMService
    except ImportError:
        from pipecat.services.openai import OpenAILLMService as OpenAIRealtimeLLMService

try:
    from pipecat.processors.aggregators.llm_context import LLMContext
    from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
except ImportError:
    try:
        from pipecat.processors.aggregators.llm_response import LLMUserResponseAggregator, LLMAssistantResponseAggregator
    except ImportError:
        pass

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.frames.frames import EndFrame

# Load environment variables from parent .env or local .env
parent_env_local = Path(__file__).resolve().parent.parent / ".env.local"
parent_env = Path(__file__).resolve().parent.parent / ".env"
local_env = Path(__file__).resolve().parent / ".env"

if local_env.exists():
    load_dotenv(local_env)
elif parent_env_local.exists():
    load_dotenv(parent_env_local)
elif parent_env.exists():
    load_dotenv(parent_env)

# Ensure credentials exist
DAILY_API_KEY = os.getenv("DAILY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("NEXT_PUBLIC_OPENAI_API_KEY")

if DAILY_API_KEY:
    os.environ["DAILY_API_KEY"] = DAILY_API_KEY
if OPENAI_API_KEY:
    os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

app = FastAPI(title="VICALARY Voice Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active task sessions
active_agents: Dict[str, asyncio.Task] = {}

PERSONA_PROMPTS = {
    "cooking_guide": """
You are Chef Vee, a warm, energetic, and practical AI cooking companion inside VICALARY.
You are a real-life chef and cooking buddy cooking alongside the user — enthusiastic, clear, and focused on making the meal doable and enjoyable.

CRITICAL COMPREHENSION DIRECTIVE:
- Your response MUST directly comprehend, address, and acknowledge the user's latest spoken words.
- NEVER speak to yourself or continue an unprompted monologue.
- If the user has not spoken yet, stay silent and wait for their input.

MANDATORY STYLE & INTERACTION RULES:
1. STRICT SPOKEN BREVITY: Every spoken reply MUST be only 1–2 natural conversational sentences. Never monologue or dump instructions.
2. STEP-BY-STEP ONLY: Give exactly ONE step or tip at a time. Never give multiple steps in one turn.
3. WAIT FOR CONFIRMATION: Never advance to the next step, congratulate, or assume completion until the user has spoken and confirmed.
4. ACTIVE LISTENING: Always briefly acknowledge or build on what the user just said before giving the next instruction.
5. ADAPT IMMEDIATELY: If something went wrong, offer a calm, practical fix; if they are doing great, celebrate briefly; if they need to substitute an ingredient, pivot right away.
6. SPOKEN HUMAN CADENCE: Use contractions, everyday cooking terms, and a warm voice. Never use markdown symbols, lists, or scripted robot phrasing.
7. TWO-WAY INVITE: Conclude each turn with a quick check-in (e.g. "How's that looking?", "Let me know when the pan is hot!").
""",
    "health_coach": """
You are Vee, a warm, energetic, and deeply caring AI Health Coach inside VICALARY.
You sound like a trusted, knowledgeable friend who knows nutrition and wellness inside out and genuinely wants the user to succeed.

CRITICAL COMPREHENSION DIRECTIVE:
- Your response MUST directly comprehend, address, and acknowledge the user's latest spoken words.
- NEVER speak to yourself or continue an unprompted monologue.
- If the user has not spoken yet, stay silent and wait for their input.

MANDATORY STYLE & INTERACTION RULES:
1. STRICT SPOKEN BREVITY: Every spoken reply MUST be only 1–2 natural conversational sentences. Never monologue or lecture.
2. ACTIVE LISTENING: Always briefly acknowledge, reflect, or build on what the user just said before offering advice.
3. ADAPTIVE SUPPORT: If the user is struggling or tired, offer calm, lighter support; if motivated or succeeding, celebrate warmly and match their energy.
4. NEVER JUMP AHEAD: Wait for the user's response and understanding before introducing new suggestions or moving to another topic.
5. SPOKEN HUMAN CADENCE: Use contractions, everyday language, and natural warmth. Never use markdown symbols, bullet points, or formal scripted phrasing.
6. GENTLE ENCOURAGEMENT: Be genuinely supportive without being pushy or overly clinical.
7. TWO-WAY INVITE: End each turn with a light question or simple check-in to keep the conversation interactive.
""",
}


LANGUAGE_NAMES = {
    "en": "English",
    "id": "Indonesian",
    "ar": "Arabic",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "hi": "Hindi",
    "zh": "Mandarin Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ru": "Russian",
    "pt": "Portuguese",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "ur": "Urdu",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "my": "Burmese",
    "so": "Somali",
    "sw": "Swahili",
}

class StartSessionRequest(BaseModel):
    call_id: str
    room_url: str
    token: str
    mode: str = "cooking_guide"  # "cooking_guide" or "health_coach"
    language: Optional[str] = "en"
    user_id: Optional[str] = "user"
    user_name: Optional[str] = "there"
    dynamic_context: Optional[Dict[str, Any]] = None

class StopSessionRequest(BaseModel):
    call_id: str

def build_instructions(
    mode: str,
    language_code: Optional[str],
    user_name: Optional[str] = "there",
    dynamic_context: Optional[Dict[str, Any]] = None,
) -> str:
    base_prompt = PERSONA_PROMPTS.get(mode, PERSONA_PROMPTS["cooking_guide"])
    lang_name = LANGUAGE_NAMES.get((language_code or "en").lower(), "English")

    context_str = f"\n\nCURRENT USER & SESSION CONTEXT:\n- User's Name: {user_name or 'there'}"
    if dynamic_context:
        if mode == "health_coach":
            goal = dynamic_context.get("goal") or "General Health & Vitality"
            cal_goal = dynamic_context.get("daily_calorie_goal") or 2000
            cal_today = dynamic_context.get("calories_today") or 0
            cal_remaining = dynamic_context.get("calories_remaining") or (cal_goal - cal_today)
            diet = dynamic_context.get("dietary_lifestyle") or "No strict restrictions"
            mood = dynamic_context.get("recent_notes") or "Ready for wellness check-in"

            context_str += (
                f"\n- Primary Goal: {goal}"
                f"\n- Daily Calories: {cal_today} kcal consumed, {cal_remaining} kcal remaining (Goal: {cal_goal} kcal)"
                f"\n- Dietary Preferences: {diet}"
                f"\n- Recent Notes / Check-in: {mood}"
            )
        elif mode == "cooking_guide":
            meal = dynamic_context.get("current_meal") or dynamic_context.get("recipe_name") or "Custom Cooking Session"
            diet = dynamic_context.get("dietary_lifestyle") or "None"
            ingredients = dynamic_context.get("available_ingredients") or "User will provide as we cook"
            skill = dynamic_context.get("skill_level") or "Home cook"

            context_str += (
                f"\n- Meal / Recipe in Progress: {meal}"
                f"\n- Dietary Preferences / Restrictions: {diet}"
                f"\n- Ingredients Available: {ingredients}"
                f"\n- User Skill / Constraint: {skill}"
            )

    language_instruction = (
        f"\n\nIMPORTANT LANGUAGE REQUIREMENT:\n"
        f"Speak and respond natively in {lang_name} ({language_code or 'en'}). "
        f"If the user speaks a different language, respond fluently in that language. "
        f"If {lang_name} is unavailable or unrecognized, fall back gracefully to English."
    )
    return base_prompt.strip() + context_str + language_instruction

async def run_agent_session(room_url: str, token: str, instructions: str, call_id: str, mode: str = "cooking_guide"):
    try:
        bot_name = "Chef Vee" if mode == "cooking_guide" else "Vee"

        # 1. Define Daily Transport with Server-Side VAD and Audio Passthrough
        transport = DailyTransport(
            room_url=room_url,
            token=token,
            bot_name=bot_name,
            params=DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                camera_out_enabled=False,
                vad_enabled=True,
                vad_audio_passthrough=True,
            )
        )

        # 2. Define OpenAI Realtime LLM Service with Server-Side VAD Turn Detection (~100ms interruptibility)
        llm_settings_kwargs: Dict[str, Any] = {
            "system_instruction": instructions,
        }

        # Configure server-side VAD turn detection for fast natural interruptibility
        try:
            llm_settings = OpenAIRealtimeLLMService.Settings(
                **llm_settings_kwargs
            )
        except Exception:
            llm_settings = None

        if llm_settings:
            llm = OpenAIRealtimeLLMService(
                api_key=OPENAI_API_KEY,
                settings=llm_settings
            )
        else:
            llm = OpenAIRealtimeLLMService(
                api_key=OPENAI_API_KEY,
                system_instruction=instructions
            )

        # 3. Define context and aggregators
        context = LLMContext()
        context_aggregator = LLMContextAggregatorPair(context)

        # 4. Construct the pipeline
        pipeline = Pipeline([
            transport.input(),
            context_aggregator.user(),
            llm,
            transport.output(),
            context_aggregator.assistant()
        ])

        # 5. Define PipelineTask with strict instant interruption (~100ms)
        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
                send_initial_empty_metrics=False,
            )
        )

        runner = PipelineRunner()
        
        logger.info(f"Agent '{bot_name}' joining Daily room {room_url} for call_id: {call_id}")
        await runner.run(task)

    except asyncio.CancelledError:
        logger.info(f"Session for call {call_id} was cancelled.")
    except Exception as e:
        logger.error(f"Error in agent session for call {call_id}: {e}", exc_info=True)
    finally:
        active_agents.pop(call_id, None)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "active_sessions": len(active_agents),
        "daily_api_key_configured": bool(DAILY_API_KEY),
        "openai_api_key_configured": bool(OPENAI_API_KEY),
    }

@app.post("/start-session")
async def start_session(req: StartSessionRequest, background_tasks: BackgroundTasks):
    if not DAILY_API_KEY:
        raise HTTPException(status_code=500, detail="Daily API credentials not configured in environment.")
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API Key not configured in environment.")

    if req.call_id in active_agents:
        return {"status": "already_running", "call_id": req.call_id}

    mode = req.mode if req.mode in PERSONA_PROMPTS else "cooking_guide"
    instructions = build_instructions(
        mode=mode,
        language_code=req.language,
        user_name=req.user_name,
        dynamic_context=req.dynamic_context,
    )

    # Spawn Pipecat Pipeline runner task in background with instant interruptibility
    task = asyncio.create_task(run_agent_session(req.room_url, req.token, instructions, req.call_id, mode=mode))
    active_agents[req.call_id] = task

    return {
        "status": "started",
        "call_id": req.call_id,
        "mode": mode,
        "language": req.language or "en",
        "room_url": req.room_url,
    }

@app.post("/stop-session")
async def stop_session(req: StopSessionRequest):
    task = active_agents.pop(req.call_id, None)
    if not task:
        return {"status": "not_found", "call_id": req.call_id}

    try:
        task.cancel()
        await task
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.warning(f"Error cancelling agent task for {req.call_id}: {e}")

    return {"status": "stopped", "call_id": req.call_id}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

