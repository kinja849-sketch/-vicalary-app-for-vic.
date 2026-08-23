---
name: getstream-vision-agents
description: "Build real-time voice, video, and multimodal AI agents using GetStream Vision Agents SDK (vision-agents), getstream.Edge(), WebRTC low-latency transport, and AI model plugins (OpenAI, Gemini, Groq, YOLO, STT/TTS)."
license: MIT
metadata:
  author: GetStream / Community
---

# GetStream Vision Agents SDK Skill

Use this skill when building real-time voice and vision AI agents powered by **GetStream** (`GetStream/Vision-Agents`, `vision-agents` Python package, and `getstream.Edge()`).

---

## 1. Overview & Key Capabilities

GetStream Vision Agents is an open-source Python framework designed for building sub-500ms latency multimodal AI agents that can see, hear, speak, and process live video/audio streams.

- **Transport**: `getstream.Edge()` (Stream's global edge network via WebRTC)
- **Multimodal AI**: Integrates STT (Speech-to-Text), TTS (Text-to-Speech), LLMs (OpenAI, Gemini, Claude, Groq), and Computer Vision models (YOLO, Roboflow, OpenCV)
- **SDK Package**: `vision-agents` (PyPI)
- **Official Docs**: https://visionagents.ai
- **GitHub Repo**: https://github.com/GetStream/Vision-Agents

---

## 2. Project Initialization & Setup

### Using `uv` (Recommended)
```bash
# Initialize a new Vision Agent project
uvx vision-agents init my-vision-agent
cd my-vision-agent

# Install dependencies with GetStream and LLM providers
uv add "vision-agents[getstream,openai,gemini]"
```

### Environment Variables (`.env`)
```env
# GetStream Credentials
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret

# AI Model Provider Keys
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
```

---

## 3. Core Agent Implementation Pattern

### `agent.py`
```python
import os
from vision_agents.core import Agent, User
from vision_agents.plugins import getstream, openai

# 1. Initialize Stream Edge Transport
edge = getstream.Edge(
    api_key=os.getenv("STREAM_API_KEY"),
    api_secret=os.getenv("STREAM_API_SECRET"),
)

# 2. Define the Vision Agent
agent = Agent(
    edge=edge,
    agent_user=User(
        id="ai-fitness-coach",
        name="AI Vision Coach",
        image="https://getstream.io/images/bot.png"
    ),
    instructions="""
    You are an interactive AI vision assistant.
    Observe the user's video feed and audio input.
    Provide concise, real-time feedback on visual movement and voice commands.
    """,
    llm=openai.LLM(model="gpt-4o"),
)

if __name__ == "__main__":
    agent.run()
```

---

## 4. Multimodal & Vision Plugins

### Vision & Object Detection (YOLO / Roboflow)
```python
from vision_agents.plugins import yolo

agent = Agent(
    edge=edge,
    processor=yolo.YOLOv8(model="yolov8n.pt"),
    instructions="Identify objects in the frame and report findings."
)
```

### Custom Event Handlers
```python
@agent.on("track_published")
async def on_track(event):
    print(f"User track published: {event.track.kind}")

@agent.on("user_joined")
async def on_user_joined(user):
    print(f"User {user.id} joined the call")
```

---

## 5. Web Frontend Integration (Next.js / React)

Connect your Next.js frontend to the Vision Agent call room using `@stream-io/video-react-sdk`:

```tsx
import { StreamVideoClient, StreamVideo, StreamCall } from '@stream-io/video-react-sdk';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const user = { id: 'user-123', name: 'User' };
const token = 'SERVER_GENERATED_USER_TOKEN';

const client = new StreamVideoClient({ apiKey, user, token });
const call = client.call('default', 'vision-session-001');
call.join({ create: true });

export default function VisionSession() {
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        {/* Render Video UI & Interact with Vision Agent */}
      </StreamCall>
    </StreamVideo>
  );
}
```

---

## 6. Related Stream Skills in Project

- [`/stream`](file:///.agents/skills/stream/SKILL.md) — Main Stream router & CLI tools
- [`/stream-react`](file:///.agents/skills/stream-react/SKILL.md) — Web React & Next.js Stream Video / Chat SDK integration
- [`/stream-docs`](file:///.agents/skills/stream-docs/SKILL.md) — Live Stream SDK documentation lookups
