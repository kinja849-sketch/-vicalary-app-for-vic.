# Implementation Plan: Fix Chat Conversation Presence Crash

## 1. Problem Statement
Whenever the user attempts to open any conversation in the Chat section, the application immediately crashes into the React ErrorBoundary with the error:
`"Something went wrong / cannot add presence callbacks after joining a channel"`.

## 2. Root Cause Analysis
- `CallProvider` in [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) wraps the application globally in `GlobalProviders.tsx` and establishes the global presence channel named `'online-users'`, registering presence handlers and subscribing to track online users across the entire app. It exposes `onlineUsers: Set<string>` via `useCall()`.
- In [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx) (lines 691–716), a duplicate `useEffect` attempts to re-create `supabase.channel('online-users')` and attach `.on('presence', ...)` handlers.
- In Supabase Realtime (`@supabase/realtime-js`), requesting an existing channel topic returns the existing channel instance. Because that channel has already joined/subscribed in `CallProvider`, attaching `.on('presence', ...)` violates Supabase's strict rule: presence listeners cannot be attached after joining a channel.
- Supabase throws a synchronous error: `"cannot add presence callbacks after joining a channel"`, crashing the conversation view into the React `ErrorBoundary`.

## 3. Scope Boundaries
- **In Scope**:
  - Make [`lib/CallContext.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx) the sole owner of the `'online-users'` channel (already active).
  - In [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx):
    - Consume `onlineUsers` directly from `useCall()` (`const { startCall, onlineUsers } = useCall();`).
    - Remove the local state `onlineUsers` / `setOnlineUsers`.
    - Completely remove the duplicate `'online-users'` presence subscription `useEffect` (lines 691–716).
    - Wrap conversation-specific channel initialization in try-catch to ensure robustness.
- **Explicitly Out of Scope**:
  - Do not modify chat UI, layout, styling, or messages list.
  - Do not modify messaging delivery, voice/video calling, or database schema.
  - Don't touch any unrelated components.

## 4. Implementation Steps
1. In [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx):
   - Line 372: Remove `const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());`.
   - Line 375: Update `const { startCall } = useCall();` to `const { startCall, onlineUsers } = useCall();`.
   - Lines 691–716: Remove the redundant `useEffect` managing `supabase.channel('online-users')`.
   - Lines 1422–1430: Wrap channel teardown and setup inside try-catch to prevent uncaught channel exceptions.

## 5. Verification Plan
- Run typecheck (`npm run typecheck` or `npx tsc --noEmit`).
- Start dev server daemon (`npm run dev`) at `http://localhost:3000`.
- Verify conversation opens smoothly without the ErrorBoundary crash.
- Verify online status indicator displays properly from context.
