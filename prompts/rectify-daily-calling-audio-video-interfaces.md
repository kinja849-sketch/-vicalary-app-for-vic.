# Implementation Prompt: Rectify Daily.co Calling Audio & Video Interfaces

## 1. Problem Summary & Objectives
The Daily.co calling implementation requires rectification across [hooks/useDailyCall.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/hooks/useDailyCall.ts), [lib/CallContext.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx), and [components/CallOverlay.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx).

Specific defects & requirements to rectify:
1. **Audio vs. Video Call Separation**:
   - Audio calls currently create Daily call objects with `videoSource: true`, which triggers camera permission requests and publishes video even when a user initiated/accepted an audio-only call. Audio calls must only request mic permission (`videoSource: false`) and never publish video.
   - Separate distinct screens and layouts for incoming audio, active audio, incoming video, and active video matching user references.
2. **Visual Matching to Reference Screenshots**:
   - **Incoming Audio Call** (Reference: `media_1791504030419.png`): Dark doodle background, caller avatar, "Incoming call" / "VicCalary voice call", caller name, and 3 distinct bottom controls:
     - **Decline**: Red circular button rejecting call, stopping ringing on both devices, releasing resources.
     - **Swipe up to accept**: Green circular button supporting pointer/touch drag upward with a deliberate acceptance threshold (> 60px), returning smoothly to initial position if released incomplete, with an accessible tap or keyboard alternative.
     - **Message**: Outlined button opening quick replies or custom text. When sent, sends the message through the chat system and cleanly declines the call.
   - **Active Video Call** (Reference: `media_1791504017249.png`):
     - Remote participant live video in main frame.
     - Smaller mirrored local preview PiP card positioned at bottom right above dock.
     - Floating camera flip button on PiP (switching front/back cameras via Daily `cycleCamera` without disconnecting or audio disruption, enabled only when > 1 camera exists).
     - Translucent floating bottom dock with: More options (`...`), Video on/off, Speaker toggle, Mic mute, and Red horizontal-handset end-call button.
3. **Reusable Media Component (`DailyMediaView`)**:
   - Create a reusable media component that attaches and clears `srcObject` whenever its element mounts or track changes (during ringing-to-connected transitions, camera toggles, minimize/restore, and participant changes).
   - Local playback strictly muted and inline.
   - Remote playback failures handled with a visible retry action (autoplay policy recovery).
   - Remote audio plays **exactly once** through a single dedicated audio element without duplication or echo.
4. **Reliable Signaling, Room Creation & State Machine**:
   - Room creation in [app/api/calls/create/route.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/calls/create/route.ts) and [lib/api/chat.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts) must never fabricate fake Daily room URLs if room creation fails. Failures must return explicit errors.
   - Accurate connection state derivation: `connecting`, `waiting_peer`, `loading_video`, `camera_off`, `connected`, `interrupted`. Display "Connected" and increment call timer ONLY after confirmed peer presence.
   - Guard against duplicate acceptance and match all signaling updates to active call ID.
   - Ringing tone synthesis via Web Audio API, cleanly stopped upon accept, decline, end, or unmount.

---

## 2. Source of Truth & Architecture
- **Call Session State**: [lib/CallContext.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) via Supabase Realtime `calls` table.
- **WebRTC Engine**: Daily.co JS SDK (`@daily-co/daily-js`) wrapped in [hooks/useDailyCall.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/hooks/useDailyCall.ts).
- **Video & Audio Rendering**: Reusable component `components/calls/DailyMediaView.tsx`.
- **UI Surface**: [components/CallOverlay.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx).

---

## 3. Detailed File Changes

### A. Create `components/calls/DailyMediaView.tsx`
- Encapsulates `<video>` or `<audio>` attachment to `MediaStreamTrack`.
- Attaches `srcObject = new MediaStream([track])` on mount or when `track` changes.
- Automatically clears `srcObject = null` on unmount or when `track` is null.
- Catches play promises; on autoplay rejection, renders a graceful "Tap to play video" overlay.
- Ensures `muted={isLocal}` and `playsInline={true}`.
- Supports `mirror={true}` via CSS `scale-x-[-1]`.

### B. Update `hooks/useDailyCall.ts`
- **Call Object Creation**:
  - Accept `isVideo: boolean` on `joinCall`.
  - Pass `videoSource: isVideo` and `audioSource: true` to `DailyIframe.createCallObject`. When `isVideo === false`, browser will NEVER request camera permissions.
- **Track & Media State Management**:
  - Track `isLocalAudioMuted`, `isLocalVideoOff`, `isRemoteAudioMuted`, `isRemoteVideoOff`.
  - Derive states directly from Daily's confirmed participant track objects (`tracks.audio.state`, `tracks.video.state`).
  - Track `peerJoined` (true when remote participant is present in `callObject.participants()`).
- **Camera Flip (`cycleCamera`)**:
  - Enumerate devices to check `hasMultipleCameras` (filter `videoinput`).
  - Provide `flipCamera()` method that invokes `callObject.cycleCamera()` or selects next video device without tearing down call or interrupting audio.
- **Audio Output Selection (`setSpeaker`)**:
  - Check browser support (`HTMLMediaElement.prototype.setSinkId` or `callObject.setOutputDeviceAsync`).
  - Provide `toggleSpeaker()` and `isSpeakerSupported` boolean. If unsupported, clearly indicate limitation.
- **Robust Teardown**:
  - Cleanly destroys Daily instance on leave or unmount.

### C. Update `lib/CallContext.tsx`
- **Ringing Tone Generator**:
  - Web Audio API synthesizer for incoming ringing chime and outgoing ringback tone.
  - Automatically started when call is `ringing`, and guaranteed stopped on accept, decline, end, or unmount.
- **Duplicate Acceptance Guard**:
  - Ref-based guard `isAcceptingRef` preventing duplicate clicks or race conditions on `handleAccept`.
- **Message & Decline Action**:
  - `handleMessageAndDecline(text: string)`: sends message through `sendMessage(user.id, callSession.conversationId, text)` and updates call status to `declined`, then tears down Daily.
- **Strict Room Validation**:
  - No fabricated URLs. If `initiateCallV2` returns no valid `room_url`, display error toast and cleanly reset call session.

### D. Update `components/CallOverlay.tsx`
- **Incoming Audio Call** (Reference: `media_1791504030419.png`):
  - WhatsApp dark pattern background (`#0b141a`).
  - Circular avatar + caller name + "VicCalary voice call".
  - **Decline Button**: Red circular button, horizontal handset, label "Decline".
  - **Swipe Up to Accept**: Green circular button, vertical drag gesture tracking (`pointerdown`, `pointermove`, `pointerup`). Upward threshold of 60px. Smooth return spring on incomplete release. Accessible click/tap and keyboard support.
  - **Message Button**: Opens Quick Reply sheet ("Can't talk right now. What's up?", "I'll call you right back", "I'm on my way", custom input). Triggers `handleMessageAndDecline`.
- **Incoming Video Call**:
  - Video call equivalent of incoming screen, with Decline, Swipe up to accept (with camera enabled), and Message controls.
- **Active Audio Call**:
  - Large avatar, connection status ("Connecting...", "Waiting for participant...", "Connected"), confirmed timer (only ticks when connected).
  - Controls: Speaker toggle (with support check / toast), Microphone mute, Red horizontal-handset End Call.
- **Active Video Call** (Reference: `media_1791504017249.png`):
  - Remote video full screen via `DailyMediaView`.
  - PiP local video preview card bottom-right above dock with smooth draggable positioning and tap-to-swap.
  - Floating camera flip button on PiP card (switching front/rear cameras).
  - Floating bottom dock matching reference: `...` options, video camera on/off, speaker toggle, mic mute, red horizontal-handset end call.
  - Duration badge top-center.
  - Minimize and restore fully wired.

### E. Update `app/api/calls/create/route.ts` & `lib/api/chat.ts`
- Remove fallback generation of non-existent Daily URLs (`https://${dailyDomain}.daily.co/vicalary_call_${sanitizedConvId}`).
- When Daily API / Supabase RPC fails, return clear error response instead of phantom room.

---

## 4. Verification Plan
1. **Typecheck & Linter**:
   - Run `npm run typecheck` (`tsc --noEmit`) to verify zero TypeScript errors.
2. **Localhost Functional Testing** (via `http://localhost:8080`):
   - **Incoming Audio Call**: Verify layout matches screenshot, swipe up accepts, decline cancels ringing on both ends, message sends quick reply and declines.
   - **Camera Permission Safety**: Verify audio call never prompts for camera permission.
   - **Active Audio Call**: Verify mute, speaker (or browser notice), duration timer, end call.
   - **Incoming & Active Video Call**: Verify layout matches screenshot, remote video fullscreen, PiP local preview, camera flip, video mute, audio mute, and end call.
   - **teardown**: Verify clean resource cleanup, no duplicate Daily instances, no orphaned audio.
