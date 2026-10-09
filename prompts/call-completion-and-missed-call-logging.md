# Implementation Prompt: Call Completion and Missed Call Logging in Conversations

## 1. Problem Statement & Root Cause
Whenever a voice or video call takes place in VicCalary:
- When a call ends after an active session, or when a call is missed / declined / cancelled, it is **not reflected in the conversation section**.
- The conversation history does not show a call card (e.g. *"Voice Call, 2m 15s"* or *"Missed Voice Call"*), and the conversation sidebar list preview does not display the call status.

### Root Cause Analysis:
1. **Missing Message Logging in Call Status API**:
   [`app/api/calls/status/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/calls/status/route.ts) updates the `calls` table (`status` and `ended_at`), but **never creates an entry in the `messages` table** and **never updates the `conversations` table's `last_message_*` fields**.
2. **Missing Duration Tracking in Calling Pipeline**:
   [`lib/api/chat.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts) and [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) do not track the connected duration timestamp or send `duration` to the `/api/calls/status` route.
3. **Conversation List Preview Handling**:
   [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx) does not include a specific renderer case for `conv.last_message.message_type === 'call'`, so call icons and statuses are not displayed in the conversation list previews.
4. **Cancelled vs Missed Distinctions**:
   In [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx), `case 'call':` is already implemented, but only checks `call_status === 'missed' || call_status === 'declined'`, ignoring `'cancelled'` (which occurs when the caller hangs up before the receiver answers).

---

## 2. Proposed Changes & Technical Architecture

### A. [`app/api/calls/status/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/calls/status/route.ts)
1. Accept `duration?: number` in the request body.
2. When `status` is one of `['ended', 'declined', 'missed', 'cancelled']`:
   - Retrieve the call record (`conversation_id`, `caller_id`, `receiver_id`, `type`).
   - Format a human-readable content string:
     - Ended: e.g. `Voice call (2m 15s)` or `Video call (45s)`
     - Missed / Declined / Cancelled: `Missed voice call` or `Missed video call`
   - Idempotently insert a message into `messages`:
     - `conversation_id`: `call.conversation_id`
     - `sender_id`: `call.caller_id`
     - `message_type`: `'call'`
     - `content`: formatted label
     - `metadata`: `{ call_id: call.id, call_type: call.type, call_status: status, duration, receiver_id: call.receiver_id }`
   - Update `conversations`:
     - `last_message_at`: now
     - `last_message_content`: formatted label
     - `last_message_type`: `'call'`
     - `last_message_sender_id`: `call.caller_id`
   - Broadcast `new_message` on `supabase.channel("conversation:" + conversation_id)` so any active chat window reflects the call card immediately.

### B. [`lib/api/chat.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts)
1. Update `updateCallStatus(callId, status, duration = 0)` to pass `duration` in the JSON request payload.
2. In the Supabase client fallback path, also perform the idempotent `messages` insert and `conversations` update if the API route is unavailable.

### C. [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx)
1. Add `connectedAtRef = useRef<number | null>(null)`:
   - When call transitions to `status: 'connected'`, record `connectedAtRef.current = Date.now()`.
2. In `endCall`:
   - Calculate elapsed duration in seconds: `duration = connectedAtRef.current ? Math.round((Date.now() - connectedAtRef.current) / 1000) : 0`.
   - Pass `duration` to `updateCallStatus(callSession.id, finalStatus, duration)`.
3. In `handleDecline` and `handleMessageAndDecline`:
   - Pass `duration: 0` to `updateCallStatus(callSession.id, 'declined', 0)`.
4. Auto-timeout unanswered ringing after 45 seconds:
   - If ringing is unaccepted after 45s, update status to `'missed'` and cleanly end call.

### D. [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
1. Update `case 'call':`:
   - Treat `status === 'cancelled'` as missed for recipient and cancelled for caller.
   - For caller: `"Cancelled Voice Call / No answer"`.
   - For recipient: `"Missed Voice Call / Missed call"`.
   - For connected call: `"Voice Call" / duration` or `"Video Call" / duration`.

### E. [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx)
1. In conversation list preview, add explicit handling for `conv.last_message.message_type === 'call'`:
   - Display video or phone icon with green (completed) or red (missed/declined/cancelled) styling.
   - Render the formatted call label with duration or missed note.

---

## 3. Scope & Protected Surfaces
- Strictly adds call history logging and display.
- Preserves all Daily.co calling logic, layouts, WhatsApp tap-to-switch, 5-button dock, and ringing flows without distortion.

---

## 4. Verification Plan
1. **Typecheck**: Run `npm run typecheck` to ensure zero compilation errors.
2. **Localhost Verification**:
   - Start voice call and hang up before answer -> check conversation shows "Cancelled Voice Call" on caller side and "Missed Voice Call" on recipient side.
   - Start video call, answer, talk for 5 seconds, hang up -> check conversation shows "Video Call (5s)" on both sides.
   - Check sidebar chat list shows the call with icon and timestamp.
