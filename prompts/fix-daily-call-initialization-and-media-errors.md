# Implementation Prompt: Fix Daily.co Call Initialization & Chat Media Blob Errors

## Problem Summary
From the console logs:
1. **Daily Call Creation Error**: `useDailyCall.ts:62 audioSource must be a MediaStreamTrack, boolean, or a string` -> `Error: property 'audioSource': undefined`.
   - In `hooks/useDailyCall.ts`, `DailyIframe.createCallObject` is being called with `audioSource` set to an object containing constraints (`{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }`). The Daily.co JS SDK requires `audioSource` to be a `boolean`, `MediaStreamTrack`, or `string` (device ID), which causes call initialization to throw.
2. **Duplicate DailyIframe Instance Error**: `CallContext.tsx:207 Failed to accept call: Error: Duplicate DailyIframe instances are not allowed`.
   - When call creation fails or when previous instances are not cleaned up sequentially, attempting to instantiate a new `DailyCall` throws a duplicate instance error.
3. **Chat Media Blob & Image Fallback**: `blob:... net::ERR_FILE_NOT_FOUND` / `Not allowed to load local resource: blob:...`.
   - Expired or cross-origin `blob:` URLs in message history fail to resolve. Image & audio components need resilient fallback handling and clean state guards.

## Proposed Changes

### 1. `the-app-belong-to-vic--main/hooks/useDailyCall.ts`
- Fix `createCallObject` parameters: Set `audioSource: true` (or boolean) and pass audio processing settings via standard Daily call configuration if supported.
- Add robust singleton lifecycle management: Ensure any existing Daily call instance is completely destroyed (`await existing.destroy()`) before instantiating a new one.
- Add an instance creation mutex / lock to prevent concurrent `createCallObject` race conditions.
- Add comprehensive unmount / cleanup in `useEffect` so active call instances are cleanly destroyed on unmount.

### 2. `the-app-belong-to-vic--main/lib/CallContext.tsx`
- Ensure `handleAccept` and `startCall` handle Daily join/leave exceptions gracefully without leaving orphaned state.
- Ensure `leaveCall` is invoked whenever calls transition to `ended`, `declined`, `missed`, or `cancelled`.

### 3. `the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx`
- Add resilient image error fallback (`onError`) to `renderMessageContent` for image messages so that broken/expired `blob:` URLs or missing assets display a clean placeholder instead of broken UI / continuous retries.
- Ensure voice note recording cleanup properly releases media streams and object URLs.

## Verification Plan
1. **Automated / Build Checks**:
   - Run Next.js typecheck / lint (`npm run build` or `npx tsc --noEmit`).
2. **Localhost Verification Steps**:
   - Open two browser tabs / sessions on localhost:3000.
   - Start a voice/video call from one user to another.
   - Verify that the caller successfully joins the Daily room without `audioSource` or `Duplicate DailyIframe instances` errors.
   - Accept the call on the receiver side and verify connected status and audio/video tracks.
   - End the call and verify clean teardown.
   - Send and receive chat messages, photos, and voice notes; verify that images and voice notes render cleanly without blob errors.
