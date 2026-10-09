# Implementation Prompt: Rectify Outgoing Ringing Presence & Match Reference Call Layouts

## 1. Problem Summary & Objectives
From the user's latest screenshots and feedback:
1. **Outgoing Presence Accuracy ("Calling" vs "Ringing")**:
   - In the user's live test with two windows ([`media_1791514807359.png`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/public)), the caller on the right was stuck on **"Calling..."** even though the callee on the left was active and ringing!
   - Root cause: The presence listener in [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) only listened to `presence.on('sync')` and missed `join` and `leave` events. Furthermore, there was no immediate bi-directional ringing acknowledgment broadcast when the callee's device receives the call.
   - Requirement: When caller dials:
     - If the callee is online or their device acknowledges the incoming call, display **"Ringing"** in the status and **"Ringing..."** in the subtitle.
     - If the callee is offline or unreachable, display **"Calling"** in the status and **"Calling..."** in the subtitle.
     - Never display "VicCalary voice call" or "VicCalary video call" on outgoing calls.
2. **Match Visual Layouts to Reference Images**:
   - **Incoming Audio Call** (Reference: [`media_1791504030419.png`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/public)):
     - Remove clutter from top bar (no redundant "VicCalary" text at top left).
     - Clean solid dark background without any doodle/bubble pattern.
     - Large circular avatar, contact name, subtitle "VicCalary voice call".
     - Three bottom controls: Decline (red circle), Swipe up to accept (green circle with drag threshold + tap fallback), Message (outlined circle with quick replies).
   - **Outgoing Call** (Reference: [`media_1791504030419.png`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/public)):
     - Clean solid dark background without pattern.
     - Centered layout: Avatar, Contact Name, and Status Subtitle:
       - **"Ringing"** when recipient is online / ringing.
       - **"Calling"** when recipient is offline.
     - Single centered red circular End Call button with horizontal handset icon.
     - No awkward text in top left corner.
   - **Active Video Call** (Reference: [`media_1791514892123.png`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/public)):
     - Fullscreen remote video surface via `DailyMediaView`.
     - Inset floating PiP local preview card (`rounded-3xl` vertical rectangle at bottom right).
     - Floating buttons on PiP card: Camera Flip button (top) and View Swap button (bottom) in translucent circular badges.
     - Frosted capsule bottom dock (`rounded-[32px] bg-[#505050]/75` or `bg-white/20 backdrop-blur-xl border border-white/10`) containing the 5 uniform circular buttons matching reference image 3:
       1. `...` (Options / minimize)
       2. Video Camera toggle (white circle)
       3. Speaker toggle (white circle)
       4. Microphone toggle (circle)
       5. Red circular End Call button with horizontal handset icon.

---

## 2. Source of Truth & Architecture
- **Presence & Signaling**:
  - Global `online-users` Supabase presence channel listening to `sync`, `join`, and `leave` events.
  - Active call signaling broadcast: Callee emits `call_ringing` broadcast on `call:${callSession.id}` as soon as the `INSERT` event is received, immediately triggering "Ringing" on the caller side.
- **UI & Controls**: [`components/CallOverlay.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx).

---

## 3. Planned Changes

### A. Update [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx)
1. In `online-users` presence listener:
   - Handle `'sync'`, `'join'`, and `'leave'` events so `onlineUsers` set is always up-to-date in real time.
2. In call signaling:
   - When callee receives `INSERT` with `status: 'ringing'`, send an immediate broadcast ack `call_ringing` on `call_signal_${newCall.id}`.
   - When caller starts a call, listen on `call_signal_${callId}` for `call_ringing`.
   - Maintain `isPeerRinging` state (true if peer is in `onlineUsers` OR if `call_ringing` ack received).
   - Pass `isPeerOnline={isPeerOnline || isPeerRinging}` to `CallOverlay`.

### B. Update [`components/CallOverlay.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx)
1. **Outgoing Call Layout**:
   - Clean top header (remove awkward top-left text; keep only clean minimize button if needed).
   - Center area:
     - Avatar
     - Contact Name
     - Subtitle:
       - If `isPeerOnline`: displays **"Ringing"** in bold/prominent text with subtle animation.
       - If not `isPeerOnline`: displays **"Calling"**.
   - Bottom: Centered red circular End Call button with horizontal phone icon.
2. **Active Video Call Layout** (Matching Reference [`media_1791514892123.png`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/public)):
   - PiP card: Vertical rounded rectangle (`w-32 h-48 rounded-3xl`) with two floating circular badges on right edge: Camera Flip (top) and Swap View (bottom).
   - Bottom dock: Frosted glass capsule dock (`rounded-full bg-[#505050]/70 backdrop-blur-xl border border-white/10 px-4 py-3 flex items-center justify-around gap-3`) with the 5 exact controls from reference:
     - `...` (options / minimize)
     - Video (white circle)
     - Speaker (white circle)
     - Mic (circle)
     - Red horizontal handset End Call button.
3. **Incoming Audio Call Layout**:
   - Clean top header (remove "VicCalary" from top left).
   - Pure solid dark background without any doodle pattern.
   - Decline, Swipe up to accept, Message.

---

## 4. Verification Plan
1. **Typecheck**: `npm run typecheck` (`tsc --noEmit`) to verify 0 errors.
2. **Localhost Verification**:
   - Verify Outgoing Call screen matches reference layout with centered avatar, name, and "Ringing" / "Calling".
   - Verify Active Video Call screen matches reference layout (PiP floating badges, frosted dock with 5 buttons).
   - Verify Callee incoming screen matches reference layout (clean top, Decline, Swipe up to accept, Message).
