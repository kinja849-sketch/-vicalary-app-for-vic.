# Implementation Plan: Chat Presence Crash on Navigation & Voice-Call UI Layout

## 1. Problem Statement & Context
1. **Chat Presence Crash on Navigation**:
   - Whenever the user opens the Chat section (after phone verification or via navbar navigation), the app crashes into the ErrorBoundary screen displaying:
     `"Something went wrong / cannot add presence callbacks after joining a channel"` with a `"Reload Application"` green button (as documented in `media_1791606543727.jpg`).
   - **Root Cause**:
     - `CallProvider` in `lib/CallContext.tsx` wraps the application globally inside `GlobalProviders.tsx` and establishes the global presence channel named `online-users`, attaching `.on('presence', ...)` handlers and calling `.subscribe()`.
     - When navigating to Chat, `app/_pages/Chat.tsx` calls `supabase.channel('online-users')` again. Because Supabase Realtime returns the existing live channel instance for the same topic, and that channel has already joined/subscribed, calling `.on('presence', ...)` violates Supabase's strict rule: presence callbacks MUST be added before subscription. Supabase throws a synchronous exception: `"cannot add presence callbacks after joining a channel"`.
     - React's `ErrorBoundary` catches this exception and crashes the entire screen. Furthermore, when `Chat.tsx` unmounts, it calls `supabase.removeChannel(presenceChannel)`, destroying `CallProvider`'s global presence subscription.

2. **Active Voice Call Overlay Layout & Safe-Area Inset Defect**:
   - As shown in `media_1791606543728.jpg`, the active voice-call screen in `components/CallOverlay.tsx` uses a fragile `flex flex-col justify-between items-center p-8` structure with `my-auto` on the center avatar block.
   - On real mobile devices and browsers with dynamic URL bars (such as Chrome on Android / Safari on iOS):
     - The top header and top-right minimize control collide with browser address bars or status bar cutouts due to missing `env(safe-area-inset-top)` handling.
     - The top-right minimize icon (`Minimize2`) displays ambiguous diagonal double arrows that read like share or swap controls rather than an intuitive minimize affordance.
     - The center avatar, name, and timer sit in unstable vertical positions due to flex `my-auto` conflicting with `justify-between`.
     - The bottom control dock lacks safe-area bottom padding (`env(safe-area-inset-bottom)`), colliding with gesture navigation / home indicators.
     - The avatar has an inconsistent greenish ring (`ring-4 ring-[#00A884]/30`) that can interact poorly with image crops.

---

## 2. Scope Boundaries
- **In Scope**:
  - Establish `CallProvider` in `lib/CallContext.tsx` as the single authoritative owner of the global `online-users` presence channel.
  - Expose `onlineUsers: Set<string>` and helper `isUserOnline(userId: string)` from `CallContext`.
  - Remove all duplicate `online-users` channel creation, presence callbacks, tracking, and removal from `app/_pages/Chat.tsx`. Consume `onlineUsers` directly from `useCall()`.
  - In `app/_pages/ChatConversation.tsx`, guard channel initialization so any existing channel with the same topic is cleanly removed before instantiating a new channel, ensuring `.on()` handlers are registered strictly before `.subscribe()`, and wrapping channel initialization safely.
  - In `components/CallOverlay.tsx` (active voice call section): replace the fragile `justify-between` + `my-auto` structure with a stable, rock-solid 3-band layout:
    1. **Top Band**: Dedicated header with `env(safe-area-inset-top)` padding, clean "VicCalary voice call" label, and an unambiguous minimize button with a clear minimize affordance.
    2. **Middle Band**: Perfectly centered avatar (deliberate, clean CSS ring), contact name, and duration timer directly underneath.
    3. **Bottom Band**: Fixed control dock with Speaker, Mic, and End Call buttons, padded with `env(safe-area-inset-bottom)`.
- **Explicitly Out of Scope**:
  - Do NOT touch phone OTP, auth, or contact verification logic.
  - Do NOT alter call signaling, Daily.co integration, audio/video tracks, Web Audio ringtone synthesizer, or call state transitions.
  - Do NOT change database schema, RLS policies, or API routes.
  - Do NOT redesign video call PiP or unrelated screens.

---

## 3. Detailed Implementation Steps

### A. Single Presence Owner in `lib/CallContext.tsx`
1. Update `CallContextType` in `lib/CallContext.tsx` to include:
   ```ts
   onlineUsers: Set<string>;
   isUserOnline: (userId: string) => boolean;
   ```
2. In `CallProvider`:
   - Clean up any pre-existing channel named `online-users` prior to subscribing to ensure idempotency across fast mounts.
   - Register presence handlers (`sync`, `join`, `leave`) before `.subscribe()`.
   - Provide `onlineUsers` and `isUserOnline` through `CallContext.Provider`.

### B. Consumer-Only Usage in `app/_pages/Chat.tsx`
1. Consume `const { onlineUsers } = useCall();` in `Chat.tsx`.
2. Remove local state `const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());`.
3. Remove lines 114–129 (`supabase.channel('online-users')` setup and presence callbacks).
4. Remove line 172 (`supabase.removeChannel(presenceChannel)` on unmount).
5. Retain `listUpdateChannel` (`chat-list-global-manager`) for Postgres message and contact change updates.

### C. Channel Lifecycle Guard in `app/_pages/ChatConversation.tsx`
1. Prior to creating `const channel = supabase.channel(channelName);`:
   - Remove any pre-existing channel instance from `supabase.getChannels()` with the same topic to prevent re-attaching presence handlers to an already-joined channel.
2. Ensure callbacks (`broadcast`, `presence`, `postgres_changes`) are registered strictly before calling `.subscribe()`.
3. Wrap channel setup in a try-catch guard so no network/channel error can bubble up to `ErrorBoundary`.

### D. Stable 3-Band Layout in `components/CallOverlay.tsx` (Active Voice Call)
1. Replace lines 717–792 with a stable 3-band layout:
   - Outer container: `fixed inset-0 z-[100] bg-[#0b141a] text-white flex flex-col justify-between items-center select-none overflow-hidden h-[100dvh]`
   - **Top Band**:
     ```tsx
     <div 
       className="w-full px-6 flex items-center justify-between text-xs text-[#8696a0] shrink-0"
       style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
     >
       <span className="font-medium tracking-wide">VicCalary voice call</span>
       {onToggleMinimize && (
         <button 
           type="button"
           onClick={onToggleMinimize}
           className="size-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all shadow-sm"
           title="Minimize call"
           aria-label="Minimize call"
         >
           <ChevronDown size={20} className="text-white" />
         </button>
       )}
     </div>
     ```
   - **Middle Band**:
     ```tsx
     <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 w-full">
       {/* Deliberate, clean circular avatar with subtle outer ring */}
       <div className="size-36 sm:size-44 rounded-full overflow-hidden bg-[#202c33] ring-4 ring-white/10 shadow-2xl flex items-center justify-center">
         {caller.avatar ? (
           <img src={caller.avatar} alt={caller.name} className="w-full h-full object-cover" />
         ) : (
           <User size={68} className="text-[#8696a0]" />
         )}
       </div>

       {/* Contact Name & Live Status/Timer */}
       <div className="text-center mt-2">
         <h1 className="text-3xl sm:text-4xl font-normal text-white tracking-wide">{caller.name || 'User'}</h1>
         <p className="text-sm font-medium text-[#8696a0] mt-1.5">
           {!peerJoined
             ? 'Connecting...'
             : isRemoteAudioMuted
             ? `${caller.name || 'User'} is muted`
             : formatDuration(duration)}
         </p>
       </div>
     </div>
     ```
   - **Bottom Band**:
     ```tsx
     <div 
       className="w-full max-w-sm px-6 shrink-0 flex flex-col items-center"
       style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
     >
       <div className="bg-[#202c33]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3.5 flex items-center justify-around gap-6 shadow-2xl w-full">
         {/* Speaker Toggle */}
         ...
         {/* Mic Toggle */}
         ...
         {/* End Call */}
         ...
       </div>
     </div>
     ```

---

## 4. Touched Files
- [lib/CallContext.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/CallContext.tsx)
- [app/_pages/Chat.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx)
- [app/_pages/ChatConversation.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
- [components/CallOverlay.tsx](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/components/CallOverlay.tsx)

---

## 5. Verification Plan
1. **Chat Route Navigation Test**:
   - Navigate to `/chat` directly and via bottom navbar repeatedly without reloading the browser.
   - Confirm no `"cannot add presence callbacks after joining a channel"` exception is thrown and `ErrorBoundary` never renders.
   - Verify contact list and conversation list render immediately without full page refresh.
   - Verify green online indicators still function correctly based on context presence.
2. **Conversation Channel Lifecycle Test**:
   - Open a conversation, go back to `/chat`, open another conversation, and return.
   - Verify channel transitions are clean with no unhandled Realtime exceptions.
3. **Voice Call Overlay Layout Test**:
   - Trigger or preview an active voice call in mobile viewport (e.g., 390x844 iPhone / 412x915 Android).
   - Verify:
     - Top bar has safe-area top padding and unambiguous minimize button (`ChevronDown`).
     - Center band places the avatar dead center with the contact name and timer directly below.
     - Bottom band docks speaker, mic, and end-call buttons safely above mobile bottom indicators.
4. **Build & Typecheck**:
   - Run typecheck and ensure no compilation or lint regressions.
