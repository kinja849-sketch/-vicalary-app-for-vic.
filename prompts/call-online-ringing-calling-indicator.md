# Implementation Prompt: Outgoing Call Status Indicator — "Ringing" vs "Calling" based on Peer Presence

## 1. Problem Summary & Objectives
When a user initiates an outgoing voice or video call:
- If the recipient is **online**, the call overlay must indicate **'Ringing'** (instead of 'VicCalary voice call' or 'VicCalary video call').
- If the recipient is **offline**, the call overlay must indicate **'Calling'**.
- The indicator must be accurate in real time based on the recipient's presence on the network.

---

## 2. Source of Truth & Presence Tracking
- **Presence Source**: Supabase Realtime presence channel `online-users` (the application's global presence channel established in [`ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)), where active users track `{ user_id: user.id, online_at: ... }`.
- **Peer Identity**: Derived server-side and persisted in `calls` table: for outgoing calls, the target is `callSession.receiverId`.
- **Presence Resolution in Call Context**:
  - In [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx), maintain a subscription to the `online-users` presence channel.
  - Compute `isPeerOnline = Boolean(targetPeerId && onlineUsers.has(targetPeerId))`.
  - Pass `isPeerOnline` directly to [`components/CallOverlay.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx).

---

## 3. Planned Changes

### A. [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx)
- Subscribe to the `online-users` Supabase presence channel.
- Maintain `onlineUsers: Set<string>` state synchronized via `presence.on('sync')`.
- Derive `isPeerOnline = Boolean(activeCall && activeCall.direction === 'outgoing' && onlineUsers.has(activeCall.receiverId))`.
- Pass `isPeerOnline` as prop to `<CallOverlay />`.

### B. [`components/CallOverlay.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx)
- Add `isPeerOnline?: boolean` to `CallOverlayProps`.
- In the outgoing ringing interface (`status === 'ringing' && direction === 'outgoing'`):
  - Top header indicator: Display **"Ringing"** when `isPeerOnline` is true, or **"Calling"** when `isPeerOnline` is false (replacing "VicCalary voice call" / "VicCalary video call").
  - Center subtitle below the contact name: Display **"Ringing..."** when `isPeerOnline` is true, or **"Calling..."** when `isPeerOnline` is false.
  - Real-time reactivity: When peer joins/comes online during the call placement, the status immediately transitions from "Calling" to "Ringing".

---

## 4. Verification Plan
1. **TypeScript Typecheck**:
   - Run `npm run typecheck` (`tsc --noEmit`) to verify zero errors across all components and contexts.
2. **Localhost Verification**:
   - Test outgoing call on `http://localhost:8080/test-call` with simulated peer online (`true`) -> verify "Ringing" displayed in header and center subtitle.
   - Test outgoing call with simulated peer offline (`false`) -> verify "Calling" displayed in header and center subtitle.
   - Verify transition from Calling to Ringing when peer status changes.
