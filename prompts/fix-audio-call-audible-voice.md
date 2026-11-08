# Implementation Blueprint: Fix Audio Call Audible Voice Transmission & Playback

## 1. Executive Summary & Objective
In VicCalary's WebRTC calling system powered by Daily.co (`@daily-co/daily-js`), video calls function properly with bidirectional video and audio, but voice/audio-only calls have no audible sound whatsoever—neither party can hear the other speaking.

This blueprint identifies the deep technical root causes across Daily call object initialization, audio element DOM lifecycle, browser autoplay policies, track synchronization race conditions, and provides a surgical, zero-regression resolution that restores crystal-clear, instantaneous two-way voice audio in all audio calls while strictly preserving existing video call features, WhatsApp-style ringing experience, and UI surfaces.

---

## 2. Deep Root-Cause Analysis

### Root Cause 1: Audio Element Unmounting on Call State Transition
In `components/CallOverlay.tsx`, `DailyAudioTrack` is rendered inside conditional branches:
```tsx
const AudioElement = <DailyAudioTrack track={remoteAudioTrack} />;
if (status === 'ringing') return (<div>{AudioElement}...</div>);
if (type === 'video' && status === 'connected') return (<div>{AudioElement}...</div>);
return (<div>{AudioElement}...</div>); // Voice call connected
```
Because each branch returns a distinct JSX tree with different wrapping tags and attributes, React **unmounts** the `<DailyAudioTrack>` instance from the `ringing` state and **mounts a brand-new instance** upon transitioning to `connected`.
When this new `<audio>` element mounts:
- The user had clicked "Accept" (or "Call") several seconds earlier on the previous screen.
- Calling `.play()` on a newly mounted audio element without an immediate preceding user gesture triggers browser Autoplay Policy blocks (`NotAllowedError`).
- In Video Call, the remote `<video>` element in `DailyMediaView` renders with `muted={false}` and user interactions on the video surface (tap-to-swap, pip controls) grant audio media pipeline permission. In Voice Call, there is no video element, leaving the audio blocked.

### Root Cause 2: `display: 'none'` Silencing / Deprioritization
In `components/calls/DailyMediaView.tsx` line 176:
```tsx
<audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
```
Modern Chromium (and WebKit) browsers optimize layout resources by completely removing elements with `display: none` from the render tree. This causes browsers to deprioritize, delay, or refuse media pipeline allocation for hidden elements, leading to zero audible sound.
The correct industry-standard implementation is an off-screen, non-display-none element:
`className="fixed -left-[9999px] -top-[9999px] w-1 h-1 opacity-0 pointer-events-none"`

### Root Cause 3: Track Race Condition Overwriting Live Audio Tracks with `null`
In `hooks/useDailyCall.ts`, inside `setupCallListeners`:
```ts
const handleTrackStarted = (ev?: any) => {
    if (ev.type === 'audio' && ev.track) {
        setRemoteAudioTrack(ev.track);
    }
    refreshTracks(co); // <--- RACE CONDITION!
};
```
When `track-started` fires, `ev.track` is a valid, live `MediaStreamTrack`. But `refreshTracks(co)` runs synchronously in the same tick. Inside `refreshTracks`:
```ts
const rat = getTrack(remoteP?.tracks?.audio, remoteP?.audioTrack);
setRemoteAudioTrack(rat);
```
At the exact microsecond `track-started` fires, Daily's internal `co.participants()` dictionary may still have `tracks.audio.state === 'loading'` or unpopulated `persistentTrack`. Thus, `rat` evaluates to `null`.
`setRemoteAudioTrack(null)` immediately overwrites the live `ev.track`!
Furthermore, `triggerTrackSyncHandshake` in `lib/CallContext.tsx` repeatedly calls `refreshSessionTracks()` every 500ms for 6 seconds, repeatedly clobbering the live track with `null` if the state was in transition.

### Root Cause 4: Missing Explicit Microphone Unmute on Audio-Only Join
When initializing in audio-only mode (`videoSource: false`), Daily.co defaults or device configurations may leave local microphone capture dormant unless explicitly kicked into active transmission with `callObject.setLocalAudio(true)`. In Video calls, `setLocalVideo` and camera capture automatically awaken the media pipeline; in Audio calls, without `co.setLocalAudio(true)`, the local client transmits silent or empty packets.

### Root Cause 5: Invalid `setSubscribedTracks` in Automatic Subscription Mode
In `useDailyCall.ts`:
```ts
co = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true, ... });
// Later in refreshTracks:
co.updateParticipant(remoteP.session_id, {
    setSubscribedTracks: { audio: true, video: true }
});
```
Daily.co's specification mandates: *If `subscribeToTracksAutomatically` is `true`, calling `setSubscribedTracks` throws an error.* In an audio call with `videoSource: false`, requesting `video: true` on subscriptions creates internal Daily track state errors.

---

## 3. Targeted Technical Solutions

### Solution 1: Persistent Audio Pipeline in `CallOverlay.tsx`
- Render `<DailyAudioTrack>` in a top-level, persistent, unconditionally mounted wrapper that never unmounts across `ringing`, `connected`, `minimized`, `voice`, or `video` states.
- Bind global gesture listeners (`pointerdown`, `click`, `touchstart`) on the overlay container to immediately call `.play()` on any blocked audio element, guaranteeing instant unlock if the browser pauses playback.

### Solution 2: Fix Audio Element Layout in `components/calls/DailyMediaView.tsx`
- Replace `style={{ display: 'none' }}` with:
  ```tsx
  className="fixed -left-[9999px] -top-[9999px] w-1 h-1 opacity-0 pointer-events-none"
  ```
- Ensure `audio.volume = 1.0` and `audio.muted = false`.
- Attach automatic window-level interaction unlockers (`pointerdown`, `click`) when `audioBlocked` is detected, so any touch on the phone screen resumes playback seamlessly without needing manual user intervention on a banner.

### Solution 3: Robust Track Preservation in `hooks/useDailyCall.ts`
- In `handleTrackStarted`:
  - When `ev.track` arrives (for `kind === 'audio'` or `type === 'audio'`), store it in `setRemoteAudioTrack(ev.track)`.
  - In `refreshTracks`, **never overwrite** an existing valid `remoteAudioTrack` with `null` unless the remote participant has actually left or their audio state is explicitly `'off'`.
- Fallback Direct Audio Element: Following Daily.co's official call-object pattern, maintain a direct, headless DOM `<audio>` element pool attached to `window` for remote audio tracks as an indestructible fail-safe, ensuring zero dropped audio even during rapid React re-renders.

### Solution 4: Microphone Transmission Guarantee
- Right after `await co.join(...)` in `useDailyCall.ts`, explicitly invoke:
  ```ts
  try {
      co.setLocalAudio(true);
      setIsLocalAudioMuted(false);
  } catch (e) {
      console.warn('[Daily] Explicit setLocalAudio error:', e);
  }
  ```
- In `triggerTrackSyncHandshake` / `refreshSessionTracks`, do not call `setSubscribedTracks` when `subscribeToTracksAutomatically` is active.

---

## 4. Modified Files & Clickable Links

- [hooks/useDailyCall.ts](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/hooks/useDailyCall.ts)
  * Implement fail-safe track preservation in `handleTrackStarted` & `refreshTracks`.
  * Add explicit `setLocalAudio(true)` on join.
  * Clean up invalid `setSubscribedTracks` calls.
  * Direct audio stream fallback listener.

- [components/calls/DailyMediaView.tsx](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/calls/DailyMediaView.tsx)
  * Change `<audio>` rendering from `display: 'none'` to off-screen layout.
  * Add automatic global touch/click gesture listeners to unblock browser audio autoplay.
  * Ensure volume and unmute integrity.

- [components/CallOverlay.tsx](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/components/CallOverlay.tsx)
  * Keep `<DailyAudioTrack>` permanently mounted outside conditional state branches to prevent teardown on ringing-to-connected transition.
  * Add touch-unlock handler on the main overlay.

- [lib/CallContext.tsx](file:///C:/Users/acer/Desktop/-vicalary-app-for-vic.-main/lib/CallContext.tsx)
  * Refine `triggerTrackSyncHandshake` to preserve active tracks.

---

## 5. Verification Plan
1. **Typecheck Verification**: Run `npm run typecheck` to ensure 0 TypeScript errors.
2. **Dev Server Verification**: Start Next.js dev server on port 8080 and monitor real-time logs.
3. **Audio Call Testing**:
   - Initiate voice call between two browser sessions / test accounts.
   - Verify caller joins room, callee accepts call.
   - Verify `AudioElement` remains mounted throughout the ringing-to-connected transition.
   - Verify audio tracks attach cleanly, microphone capture is active (`isLocalAudioMuted === false`), and speech audio is clearly audible in both directions.
4. **Video Call Testing**:
   - Initiate video call.
   - Verify bidirectional video and audio continue to function flawlessly without any regression.
   - Test camera toggle, mic mute, speaker toggle, minimize/restore, and end call.
5. **No Regressions**:
   - Verify chat messaging, voice notes, Health Coach, and home page progress remain intact.
