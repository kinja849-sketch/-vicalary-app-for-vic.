# Daily.co WebRTC Calling & Voice Agent Skill

## Configuration
*   **Environment Variables**: Calling requires `DAILY_API_KEY` and `NEXT_PUBLIC_DAILY_DOMAIN` to be configured in `.env.local`.
*   **Daily API**: Dynamic rooms must be created via Daily's REST API (`https://api.daily.co/v1/rooms`). Static or mock generated URLs will fail with WebRTC 404 errors.

## 1:1 Calling Architecture
*   **Initiation**:
    *   Tapping call initiates `/api/calls/create` POST request to provision a Daily.co room and insert a record into the `calls` table with state `ringing`.
    *   Caller immediately joins the room using the `useDailyCall` hook.
*   **Alerts & Realtime Sync**:
    *   The callee listens to Supabase Realtime `INSERT` events on the `calls` table (where `receiver_id` matches user ID) to show the incoming ringing overlay.
    *   The `calls` table enforces Row Level Security (RLS). SELECT, INSERT, and UPDATE policies must allow call participants (`auth.uid() = caller_id OR auth.uid() = receiver_id`) to view and modify the call records to ensure Realtime event delivery.
*   **Lifecycle**:
    *   **Accept**: Callee updates status to `connected` via `/api/calls/status` and joins the Daily room.
    *   **Decline / End / Cancel**: Status is updated to `declined`, `ended`, or `cancelled` which triggers both clients to leave the room.

## AI Voice Agent calling (Pipecat)
*   **Initiation**:
    *   Client POSTs to `/api/voice-agent/session` which creates a Daily room and generates a bot owner token.
    *   It forwards the room and token to the Python Pipecat backend (`/start-session`) and returns the room URL to the client.
    *   The client joins the room using `useDailyCall` to start the low-latency speech-to-speech session.
*   **Termination**:
    *   Hanging up triggers a `DELETE` request to `/api/voice-agent/session` which calls `/stop-session` on the Python service to cancel the active Pipecat pipeline task.
