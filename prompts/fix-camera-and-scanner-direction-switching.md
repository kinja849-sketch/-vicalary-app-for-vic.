# Implementation Prompt: Fix Camera and Scanner Direction Switching (Front/Back) and UI Responsiveness

## Problem
In `Camera.tsx`, `QRScanner.tsx`, `Dashboard.tsx`, and `CameraCapture.tsx`, clicking the camera direction switch button (front-to-back or back-to-front) fails to switch camera direction or becomes unresponsive.

## Root Causes Identified
1. **Device Array Index Cycling instead of Direction Target**: In `Camera.tsx` and `Dashboard.tsx`, when `videoDevices.length > 1` (common on all smartphones with multiple rear lenses and 1 front lens), the code cycled `(currentIndex + 1) % videoDevices.length`. On phones with 3 rear cameras and 1 front camera, clicking switch cycled between rear lenses instead of switching to the front camera!
2. **`exact: deviceId` crash**: Strict `{ deviceId: { exact: id } }` constraints trigger `OverconstrainedError` on mobile browsers (especially Safari/iOS WebKit and Android Chrome).
3. **`videoConstraints` overriding `facingMode` in `Html5Qrcode`**: As verified in `html5-qrcode` source (`html5-qrcode.ts` lines 415-417), passing `config.videoConstraints` causes `Html5Qrcode` to ignore `cameraIdOrConfig` (`{ facingMode }`). Because `config.videoConstraints` had no `facingMode`, `Html5Qrcode` completely omitted `facingMode` from `getUserMedia`, opening the same default camera every time!
4. **Teardown race condition**: In `QRScanner.tsx`, `toggleCamera` called `scannerRef.current.stop()` and set state immediately, causing `useEffect` cleanup and recreation to clash on the same DOM element.
5. **Missing `.play()` call**: After assigning a new `MediaStream` to `video.srcObject`, mobile browsers require `.play()` to restart playback; otherwise, the preview freezes or turns black.
6. **Hardware release latency**: Hardware cameras need ~80-120ms to release before a new camera sensor can be bound, otherwise throwing `NotReadableError`.
7. **Missing front camera mirroring**: The preview lacked horizontal flip (`-scale-x-100`) when facing the user.

## Planned Solution
1. **`Camera.tsx` (`app/_pages/Camera.tsx`)**:
   - Deterministic target switching: `targetFacing = facingMode === 'environment' ? 'user' : 'environment'`.
   - Keyword device matching for front (`front`, `user`, `selfie`, `face`) vs back (`back`, `rear`, `environment`, `world`, `main`).
   - Use `{ facingMode: { ideal: targetFacing }, deviceId: matchedId ? { ideal: matchedId } : undefined }` (ideal instead of exact so it never errors).
   - Clear `video.srcObject = null`, release previous stream, add 100ms hardware release yield.
   - Attach new stream and call `await video.play()`.
   - Add mirroring (`-scale-x-100`) on front camera.
   - Disable switch button and show spinner while switching.
2. **`QRScanner.tsx` (`components/QRScanner.tsx`)**:
   - Provide `facingMode: facingMode` inside `config.videoConstraints` AND `cameraIdOrConfig` so `Html5Qrcode` cannot discard it.
   - Use `Html5Qrcode.getCameras()` to explicitly locate the front/back camera ID when available.
   - Prevent race conditions during camera stop/start transitions.
   - Mirror front-facing preview in `#reader video`.
3. **`Dashboard.tsx` (`app/_pages/Dashboard.tsx`)**:
   - Apply deterministic front/back switching with ideal constraints and mirroring to the camera modal.
4. **`CameraCapture.tsx` (`components/CameraCapture.tsx`)**:
   - Use `{ ideal: facingMode }`, call `.play()`, and mirror front camera.
