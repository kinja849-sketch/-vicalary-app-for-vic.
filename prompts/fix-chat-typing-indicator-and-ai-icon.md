# Implementation Prompt: User-to-User Typing Indicator & AI Icon Separation

## 1. Issue Analysis & Root Causes

### Issue A: Typing indicator does not clear when stopping typing or upon receiving/sending a message
1. **Sender side (`handleTyping` & `handleSend` in `app/_pages/ChatConversation.tsx`)**:
   - `handleTyping` sets a local timeout of 3000ms (`typingTimeoutRef`) to emit `sendTypingIndicator(..., false)`. However:
     - When `handleSend` is executed, or when the user deletes their input (empty textarea), `typingTimeoutRef` is **not cleared**, and no explicit `sendTypingIndicator(..., false)` is dispatched immediately to notify the peer that typing stopped.
     - On textarea change, if `e.target.value.trim() === ''` (user deleted text or cleared it), `handleTyping` is still invoked or leaves the previous typing active until timeout.
   - **Sender clearing on message submission (`sendMutation.onMutate`)**:
     - When a user sends a message, their typing status in the Supabase channel should be immediately set to `false`. Currently, only the local UI state `setOtherUserTyping(false)` is touched, which is for incoming indicators, not outgoing presence!
2. **Receiver side (`onMessageEventRef` in `app/_pages/ChatConversation.tsx`)**:
   - When an incoming message (`INSERT`) arrives in user-to-user conversation, `newMessage.sender_id === COACH_ID` sets `setOtherUserTyping(false)`. But for peer-to-peer messages (`newMessage.sender_id !== COACH_ID`), `setOtherUserTyping(false)` is **never invoked**!
   - Consequently, when user B receives user A's message, user B continues to see "typing..." and the typing bubble until an uncoordinated presence event arrives.
3. **Presence timeout guard on receiver**:
   - If user A network drops or closes the tab while typing, or if Supabase presence `sync` doesn't immediately fire `typing: false`, the receiver can get stuck showing `otherUserTyping: true`. A receiver-side auto-clear timeout (e.g. 4 seconds) guarantees that the typing indicator automatically ends if no refresh is received.

### Issue B: AI Icon (`<Brain />`) appearing on user-to-user conversation
In `app/_pages/ChatConversation.tsx`:
```tsx
{/* Typing Indicator Overlay (Outside the date groups but inside main) */}
{ (otherUserTyping || isProcessingVoice) && (
    <div className="flex w-full justify-start mt-1 px-3 py-1">
        <div className="bg-white dark:bg-[#202c33] p-2 rounded-xl shadow-sm flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-vic-green">
                {isProcessingVoice ? <Brain className="w-4 h-4 animate-pulse" /> : <Brain className="w-4 h-4 animate-pulse" />}
            </div>
            <div className="flex gap-1">
                <div className="size-1 bg-vic-green rounded-full animate-bounce"></div>
                <div className="size-1 bg-vic-green rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="size-1 bg-vic-green rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
        </div>
    </div>
)}
```
- Line 2212 unconditionally displays `<Brain className="w-4 h-4 animate-pulse" />` regardless of whether `isAI` is true or false!
- For user-to-user chat, there should NOT be a `Brain` (AI) icon. For user-to-user conversations, standard typing dots (or the peer's avatar / clean dots without an AI badge) should appear, and `<Brain />` or Sparkles should ONLY render when `isAI` is true or `isProcessingVoice` is active.

---

## 2. Planned Changes

### 1. Separate AI Icon vs User-to-User Typing UI
- In `ChatConversation.tsx`:
  - When rendering the typing indicator overlay in the chat message list:
    - If `isAI || isProcessingVoice`: show the AI icon (`Brain` or `Sparkles` as configured for AI coach).
    - If user-to-user chat (`!isAI && !isProcessingVoice`): do NOT render `<Brain />`. Display the clean animated typing dots bubble (matching standard WhatsApp/iMessage UX, consistent with the app's design system).

### 2. Immediate End to Outgoing Typing Indicator
- In `handleTyping`:
  - If input is empty (`!text.trim()`), immediately send `sendTypingIndicator(..., false)` and clear `typingTimeoutRef`.
  - Throttle active typing broadcasts to 1.5s - 2s, but set a 3s inactivity timeout to automatically emit `sendTypingIndicator(..., false)`.
- In `handleSend`:
  - Immediately clear `typingTimeoutRef`.
  - In `onMutate` or `handleSend`, immediately dispatch `sendTypingIndicator(activeChannelRef.current, user.id, activeId, false)`.
- On textarea `onBlur`:
  - When user leaves the input field, also emit `sendTypingIndicator(..., false)`.

### 3. Immediate End to Incoming Typing Indicator on Message Arrival
- In `onMessageEventRef` (`INSERT` event):
  - When a new message is received from the peer (`newMessage.sender_id === targetId` or any incoming message in this conversation), immediately set `setOtherUserTyping(false)` and clear any receiver-side typing timeout.
- In `recomputePresence`:
  - When `isTyping` becomes `true`, set a safety auto-clear timeout (3.5s) on the receiver so that even if the network stutters or the sender's false packet is delayed, `otherUserTyping` deterministically turns off.

---

## 3. Acceptance Criteria
1. **User-to-User Chat Typing Icon**:
   - When User A is typing in a peer-to-peer chat, User B sees the typing indicator bubble **without** the Brain/AI icon.
   - When chatting with the AI Coach, the AI indicator retains its AI identity (`Brain` icon / `Transcribing...`).
2. **Typing Ends Immediately on Inactivity**:
   - When the user stops typing for 3 seconds, the indicator clears automatically on both sides without waiting for a message to be sent.
   - If the user deletes what they typed, the indicator clears immediately.
3. **Typing Ends Immediately on Message Sent/Received**:
   - As soon as the sender presses send, their typing state transitions to `false`.
   - As soon as the receiver receives the message, the typing indicator disappears immediately.
4. **Safety & Zero Regressions**:
   - No disruption to Supabase Realtime messaging, encryption notices, voice messages, or calling.
   - Typecheck (`tsc --noEmit`) passes cleanly with 0 errors.
