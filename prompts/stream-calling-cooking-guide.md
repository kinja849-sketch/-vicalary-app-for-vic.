# Feature Implementation: Stream Audio + Video Calling in Chat & Chef Avatar Foundation for AI Cooking Guide

## Goal
Integrate Stream Video & Audio call capability into existing user-to-user chat conversations in VICALARY, while keeping all existing Supabase chat UI and data intact. Also lay the foundation for an AI cooking guide experience featuring a visual Chef Avatar with Stream voice session extensibility.

---

## Technical Specifications & Architecture

### 1. Security & Authentication
- **Secrets Isolation**: `STREAM_API_SECRET` and `STREAM_API_KEY` live exclusively on the server. Only `NEXT_PUBLIC_STREAM_API_KEY` is available to the client.
- **Server Routes**:
  - `POST /api/stream/token`: Authenticates the caller using Supabase Auth (verifying bearer token / session cookie), upserts the user's display name and avatar into Stream, and returns a short-lived Stream user token.
  - `POST /api/stream/call`: Verifies the Supabase user is a valid participant of the specified `conversation_id`, initializes/fetches a Stream call session (`default` call type, `callId: conversation_id`), and updates/creates the `calls` table entry in Supabase to trigger ringing notifications via Supabase Realtime.

### 2. Dependencies
- Install `@stream-io/video-react-sdk` (client-side React SDK for audio/video calls)
- Install `@stream-io/node-sdk` (server-side Node SDK for token generation and call management)

### 3. Client-side Calling in Chat (`app/_pages/ChatConversation.tsx` & `components/calls/`)
- Preserve existing Supabase chat conversation screen UI (messages, attachments, voice messages, typing indicators, media, header layout).
- Enhance header phone / video icons to trigger Stream call creation via `/api/stream/call` and client initialization.
- Provide a clean, robust `StreamCallOverlay` component handling call states:
  - `loading`: Requesting Stream token & creating call session.
  - `connecting`: WebRTC signaling & media device initialization.
  - `joined`: Live audio/video connection with partner participant(s), showing partner name, avatar, video feed (when video enabled), audio volume indicator, and duration.
  - `muted`: Audio or camera muted toggle states with clear UI status.
  - `error`: Clean error alert banner with retry or dismiss.
  - `ended`: Call termination view with summary duration.
- Call controls: Mute/Unmute Mic, Mute/Unmute Camera, Switch Camera / Audio Output, End Call.
- Real-time ringing banner/modal for incoming calls listened via Supabase Realtime `calls` table subscription.

### 4. AI Cooking Guide + Chef Avatar (`components/guide/ChefAvatar.tsx` & `app/_pages/RecipeDetails.tsx`)
- `ChefAvatar.tsx`: Visual component featuring an animated/interactive Chef character avatar with states:
  - `idle`: Ready for user guidance.
  - `listening`: VAD/Voice detection active.
  - `speaking`: Chef voice response playing or AI stream active.
  - `connected`: Stream audio session connected.
- Integrate `ChefAvatar` into `RecipeDetails.tsx` (the Guided Cooking experience) with clear extension hooks (`useChefVoiceSession`) so that future Stream audio/voice agents can connect directly into the Chef Avatar.

### 5. Documentation
- Create `docs/stream-calling-architecture.md` detailing the Stream integration architecture, token flow, call state machine, security scoping, and cooking guide voice extension path.

---

## Verification Plan
1. **Typecheck**: Run `npm run typecheck` (`tsc --noEmit`) to verify no TypeScript compilation errors exist.
2. **Localhost Manual Verification**:
   - Open 1:1 chat conversation between 2 users on `localhost:3000`.
   - Test Audio Call -> connecting -> joined -> mute/unmute -> end call.
   - Test Video Call -> connecting -> joined -> camera toggle -> end call.
   - Verify Supabase chat messages continue to send and receive during/after calls.
   - Verify network tab: confirm `STREAM_API_SECRET` is never exposed.
   - Open Cooking Guide / Recipe Details: confirm Chef Avatar renders and displays interactive states.
