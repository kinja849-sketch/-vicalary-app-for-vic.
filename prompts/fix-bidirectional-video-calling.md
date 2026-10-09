# Implementation Prompt: Fix Bidirectional Video Calling in VicCalary

## 1. Problem Statement & Root Cause
During 1-to-1 WebRTC video calling with Daily.co:
- When User A calls User B and User B accepts, video rendering is **one-sided**:
  - User B (who joins second) receives User A's stream and sees User A.
  - User A (who joined first and waited in the room while ringing) remains stuck on `"Connecting..."` and `"Waiting for [User B] to join..."` with only User A's local camera preview in the PiP.
  - Neither user is able to see both sides simultaneously.

### Root Cause Analysis:
1. **Asynchronous Listener Attachment Race**:
   In [`hooks/useDailyCall.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/hooks/useDailyCall.ts), `setCallObject(co)` is invoked and `await co.join(...)` executes immediately. The event listeners (`joined-meeting`, `participant-joined`, `track-started`, etc.) were attached inside a React `useEffect`, which only executes on subsequent renders. If WebRTC negotiation or participant events fire during/before this lifecycle cycle, listeners miss initial events.
2. **Missing Explicit Track Subscriptions**:
   Daily Call Object requires `subscribeToTracksAutomatically: true` in `DailyIframe.createCallObject()`. Without this explicit flag and active calls to `updateParticipant(sessionId, { setSubscribedTracks: true })` when participants join, Daily may keep remote tracks in a `'staged'` state, preventing audio/video packet delivery to the waiting caller.
3. **Discarding Event Payloads in `track-started`**:
   `track-started` emits `{ action: 'track-started', participant, track, type }`. Previously, the handler ignored the event payload and simply queried `co.participants()`, which often still has the track in `'loading'` state or without `persistentTrack` populated yet.
4. **Caller Inactivity on Acceptance Signal**:
   When Callee accepts, Supabase pushes `status: 'connected'` via Realtime to Caller. Caller in [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) updated local state but did not prompt Daily to refresh participant tracks, re-assert publishing, or poll for the peer's media stream.
5. **Track Inspection Fallbacks**:
   `refreshTracks` only inspected `trackState.persistentTrack || trackState.track`. In Daily-js, participants also provide `p.videoTrack` and `p.audioTrack` directly.

---

## 2. Proposed Changes & Technical Architecture

### A. [`hooks/useDailyCall.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/hooks/useDailyCall.ts)
1. **Synchronous Listener Registration**:
   - Store the active Daily call instance in both a `useRef<DailyCall | null>` and `useState<DailyCall | null>`.
   - Register all event listeners (`joined-meeting`, `participant-joined`, `participant-updated`, `participant-left`, `track-started`, `track-stopped`, `error`, etc.) **immediately upon calling `DailyIframe.createCallObject(...)`** before calling `co.join()`.
2. **Daily Call Configuration**:
   - Set `subscribeToTracksAutomatically: true` in `DailyIframe.createCallObject()`.
3. **Direct Event Handling for `track-started`**:
   - When `track-started` fires, inspect `ev.participant`, `ev.type`, and `ev.track`.
   - If `!ev.participant?.local`:
     - If `ev.type === 'video'`, set `remoteVideoTrack` directly to `ev.track`, set `peerJoined = true`, `isRemoteVideoOff = false`, and `connectionState = 'connected'`.
     - If `ev.type === 'audio'`, set `remoteAudioTrack` directly to `ev.track`, and `isRemoteAudioMuted = false`.
4. **Explicit Participant Subscriptions on Join/Update**:
   - In `participant-joined` and `participant-updated`, iterate over all remote participants and call `co.updateParticipant(p.session_id, { setSubscribedTracks: { audio: true, video: true } })`.
   - Set `peerJoined = true` immediately whenever any remote participant (`!p.local`) is present in `co.participants()`.
5. **Robust Track Extraction in `refreshTracks`**:
   - Fall back to `remoteP.videoTrack` / `remoteP.audioTrack` if `remoteP.tracks.video.persistentTrack` is not yet populated.
6. **Expose `refreshSessionTracks`**:
   - Export a callable method so [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) can force an immediate participant & track sync when Postgres reports `status === 'connected'`.

### B. [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx)
1. **Active Peer Polling & Track Sync upon Acceptance**:
   - When `eventType === 'UPDATE'` arrives with `status === 'connected'`, trigger `refreshSessionTracks()`.
   - Start a short-lived handshake interval (e.g., 500ms intervals for up to 6 seconds) to ensure that as soon as the callee finishes connecting, both sides immediately capture each other's live video and audio tracks.

### C. [`components/calls/DailyMediaView.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/calls/DailyMediaView.tsx)
1. **Prevent Re-Attaching Stream on Identical Tracks**:
   - Only set `el.srcObject = new MediaStream([track])` if the current `srcObject` does not already contain this track, preventing video playback flickers during React re-renders.

---

## 3. Scope & Non-Goals
- **In Scope**:
  - Bidirectional video & audio initialization between caller and callee.
  - Synchronous listener setup and explicit Daily track subscriptions.
  - Active track sync on call acceptance.
  - Autoplay protection and clean teardown.
- **Out of Scope (Protected Surfaces)**:
  - No changes to UI styling, colors, 5-button dock, PiP layout, or WhatsApp tap-to-switch mechanics.

---

## 4. Verification Plan
1. **TypeScript Typecheck**:
   - Run `npm run typecheck` to ensure zero compilation or lint errors.
2. **Localhost Dual-Client Verification**:
   - Open two browser tabs / incognito windows on `http://localhost:8080`.
   - Start a video call from User A to User B.
   - User B accepts the call.
   - Verify User A's screen immediately transitions from `"Waiting for..."` to rendering User B's live video in the main screen and User A in the PiP.
   - Verify User B's screen renders User A's live video in the main screen and User B in the PiP.
   - Verify tapping the main screen or PiP switches views cleanly on both sides.
   - Verify ending the call from either side terminates the session cleanly on both sides.
