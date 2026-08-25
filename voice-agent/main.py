import asyncio
import logging
import os
from pathlib import Path
from typing import Dict, Optional

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
You are the VICALARY AI Cooking Guide (Master Chef Avatar).
Your goal is to guide the user in real time through voice conversation on what to cook, step-by-step recipe instructions, ingredient substitutions, and culinary advice.
Speak like a friendly, expert human chef standing next to them in the kitchen.
- Use natural human inflections, warm tones, and conversational pacing.
- Listen actively to their exact question: acknowledge what they asked before jumping into answers.
- If they ask for scientific or culinary research, give accurate, smart explanations in simple human terms.
- Keep your responses concise (1-3 natural sentences per turn) so back-and-forth conversation stays smooth.
- Avoid markdown symbols, bullet points, or formal scripted text since your output is spoken directly.
""",
    "health_coach": """
You are the VICALARY AI Health & Wellness Coach.
Your goal is to hold a warm, intelligent, and deeply human voice conversation regarding nutrition, wellness, calorie/macro goals, scientific health research, and lifestyle habits.
- Speak like an empathetic, highly knowledgeable human health advisor—not a robot reading data.
- PRACTICE ACTIVE LISTENING: Dynamically recognize what kind of question the user is asking (e.g. asking for scientific research, asking for meal recommendations, sharing feelings, or seeking motivation). Acknowledge their intent naturally ("I hear you asking about...", "That's a great question about nutrition science...").
- INTELLIGENT REASONING: Explain complex health topics with ChatGPT-level clarity and precision, while keeping the tone warm and approachable.
- Speak in natural, fluid sentences with comfortable human pacing and natural voice inflections.
- Keep spoken replies concise (2-4 sentences max per turn) so the user can easily respond.
- Avoid robotic lists, markdown symbols, or artificial repetition.
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
    user_name: Optional[str] = "User"

class StopSessionRequest(BaseModel):
    call_id: str

def build_instructions(mode: str, language_code: Optional[str]) -> str:
    base_prompt = PERSONA_PROMPTS.get(mode, PERSONA_PROMPTS["cooking_guide"])
    lang_name = LANGUAGE_NAMES.get((language_code or "en").lower(), "English")

    language_instruction = (
        f"\n\nIMPORTANT LANGUAGE REQUIREMENT:\n"
        f"By default, speak and respond in {lang_name} ({language_code or 'en'}). "
        f"If the user speaks a different language, respond fluently in that language. "
        f"If {lang_name} is unavailable or unrecognized, fall back gracefully to English."
    )
    return base_prompt.strip() + language_instruction

async def run_agent_session(room_url: str, token: str, instructions: str, call_id: str):
    try:
        # 1. Define Daily Transport
        transport = DailyTransport(
            room_url=room_url,
            token=token,
            bot_name="Chef Avatar",
            params=DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                camera_out_enabled=False
            )
        )

        # 2. Define OpenAI Realtime LLM Service
        llm = OpenAIRealtimeLLMService(
            api_key=OPENAI_API_KEY,
            settings=OpenAIRealtimeLLMService.Settings(
                system_instruction=instructions
            )
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

        # 5. Define PipelineTask & PipelineRunner
        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
            )
        )

        runner = PipelineRunner()
        
        logger.info(f"Agent joining Daily room {room_url} for call_id: {call_id}")
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
    instructions = build_instructions(mode, req.language)

    # Spawn Pipecat Pipeline runner task in background
    task = asyncio.create_task(run_agent_session(req.room_url, req.token, instructions, req.call_id))
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
