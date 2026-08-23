# Stream Audio + Video Calling & AI Cooking Guide Architecture

## Overview
This document outlines the architecture for Stream-powered audio and video calls inside VICALARY chat conversations and the voice-enabled AI cooking guide experience.

---

## Key Principles & Security Bounds
1. **Server-Side Secret Isolation**:
   - `STREAM_API_SECRET` lives strictly in server environment variables and Next.js API routes (`app/api/stream/*`).
   - `NEXT_PUBLIC_STREAM_API_KEY` is the only Stream credential exposed to browser clients.
2. **Session Verification**:
   - Before issuing a Stream user token or call session credentials, server routes verify the authenticated Supabase user session and check conversation membership via `conversation_participants`.
3. **Preserving Supabase Realtime Messaging**:
   - All existing Supabase chat messaging, media, attachments, contact QR, and message history remain the primary source of truth.
   - Stream Video SDK is utilized strictly for WebRTC audio/video call layers.

---

## Server Routes & Scoping

### 1. Token Endpoint: `POST /api/stream/token`
- **Authentication**: Validates caller's Supabase auth session.
- **Action**: Queries user's `full_name` and `avatar_url` from `user_profiles`, upserts user metadata in Stream, and mints a short-lived Stream user token.
- **Response**: `{ token, apiKey, userId, name, image }`.

### 2. Call Initialization Endpoint: `POST /api/stream/call`
- **Authentication**: Verifies caller is an active participant in `conversation_id`.
- **Action**: Creates or retrieves Stream call instance (`callType: 'default'`, `callId: conv_<conversation_id>`) and creates/updates a record in the Supabase `calls` table with `status: 'ringing'` to emit ringing events to other participants over Supabase Realtime.
- **Response**: `{ success: true, callId, callType }`.

---

## Client Call UX State Machine (`StreamCallOverlay.tsx`)

| State | Description | UI Manifestation |
|---|---|---|
| `loading` | Requesting token & server session | Spinner with "Securing Stream Call Token..." |
| `connecting` | WebRTC signaling & media acquisition | Pulse icon with "Connecting to partner..." |
| `joined` | Active Webrtc stream connected | Partner video/avatar, duration timer, mute toggles |
| `muted` | Local mic or camera toggled off | Red indicator badge & muted icon state |
| `error` | Connection fail or credential error | Retry/dismiss alert banner |
| `ended` | Call ended by either participant | Call duration summary before overlay unmount |

---

## AI Cooking Guide & Chef Avatar Extension Path

### Chef Avatar Component (`ChefAvatar.tsx`)
The Chef Avatar acts as the visual and voice presence during guided recipe sessions.
- **Visual States**: `idle`, `listening`, `speaking`, `thinking`, `connected`.
- **Voice Extension Hook (`useChefVoiceSession`)**:
  - Provides extension methods (`startSession`, `endSession`, `avatarState`) so that future Stream audio rooms / Stream voice agent pipelines can seamlessly pipe real-time speech into and out of the Chef Avatar.

---

## Environmental Setup
Add the following to your `.env.local`:
```env
NEXT_PUBLIC_STREAM_API_KEY=your_stream_api_key
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret  # Server-side only!
```
