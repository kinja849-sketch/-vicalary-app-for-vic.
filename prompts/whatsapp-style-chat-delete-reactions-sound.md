# Implementation Prompt: WhatsApp-Style Chat Actions — Message Delete (For Me / For Everyone), Conversation Delete, Emoji Reactions, and Inbound Message Sound

## 1. Problem Isolation & Requirements Analysis

### A. Conversation Soft-Delete Argument Order Defect
- **Problem**: In [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx), line 176:
  ```ts
  const deleteConversationMutation = useMutation({
    mutationFn: (convId: string) => softDeleteConversation(convId, user!.id),
  ...
  ```
  And in [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx), line 2440:
  ```ts
  await softDeleteConversation(activeId!, user!.id);
  ```
  However, in [`lib/api/chat.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts), `softDeleteConversation` / `deleteConversation` is defined as:
  ```ts
  export const deleteConversation = async (userId: string, conversationId: string) => {
    const { error } = await (supabase as any).rpc('delete_conversation', {
      p_user_id: userId,
      p_conversation_id: conversationId
    });
  ...
  ```
  The arguments are inverted (`convId` passed as `userId`, and `userId` passed as `convId`). The RPC fails or matches zero records.
- **Solution**:
  1. Fix the call order in both [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx) and [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx) to `softDeleteConversation(user.id, convId)`.
  2. Also enhance `softDeleteConversation` in [`lib/api/chat.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts) with direct fallback update on `conversation_participants` (`deleted_at = now()`) in case the RPC is unavailable.
  3. Optimistically remove the deleted conversation from TanStack Query cache `['conversations', user.id]` in `onMutate` / `onSuccess` so it vanishes instantly without jitter.
  4. In `sendMessage` in [`lib/api/chat.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts), un-delete participants (`UPDATE conversation_participants SET deleted_at = NULL WHERE conversation_id = ...`) so a new message revives the thread in the inbox, exactly matching WhatsApp.

### B. Message Delete: "Delete for me" vs "Delete for everyone"
- **Problem**: Currently there is no message-level delete flow. Messages stay permanently in the thread.
- **WhatsApp Specification**:
  - Long press / context action on a message triggers a modal/sheet with deletion choices:
    - If current user is sender: options are **"Delete for everyone"** and **"Delete for me"** (plus Cancel).
    - If current user is recipient: option is **"Delete for me"** (plus Cancel).
  - **"Delete for me"**:
    - Per-user hide: Updates the message record by adding the current user's ID to `metadata.deleted_for_users` (array of user IDs).
    - Client rendering: If `msg.metadata?.deleted_for_users?.includes(currentUserId)`, filter out this message row completely.
    - Optimistic update: Removes the message from the active `['messages', convId]` TanStack Query cache immediately.
  - **"Delete for everyone"**:
    - Allowed for the sender.
    - Persists revoke: Updates `messages` setting `metadata.is_deleted_for_everyone = true`, `metadata.deleted_at = now()`, and clears/revokes `content`.
    - If this was the last message of the conversation, update `conversations.last_message_content` to `🚫 This message was deleted`.
    - Client rendering: Instead of showing old message content, render the authentic WhatsApp placeholder:
      - Subtle italicized text: *"🚫 This message was deleted"* (or *"🚫 You deleted this message"* for sender) with muted color and clock/status cleared.
    - Realtime: The Supabase Realtime channel already listens for `UPDATE` on `messages` table. When an update arrives with `metadata.is_deleted_for_everyone`, both sender and receiver client caches update smoothly in real time.

### C. Message Emoji Reactions
- **Problem**: Reactions are missing. Users cannot react to messages.
- **WhatsApp Specification**:
  - On long-press or bubble action, a quick reaction bar floats above/below the message bubble containing common WhatsApp emojis:
    `👍`, `❤️`, `😂`, `😮`, `😢`, `🙏`, plus a `+` to pick any emoji.
  - Tapping an emoji toggles the reaction:
    - If the user already reacted with that emoji, remove it.
    - If the user had a different reaction, replace it with the selected emoji.
  - Stored inside `messages.metadata.reactions` as an array of `{ user_id: string, emoji: string }` (or map of `{ [emoji]: string[] }`).
  - Rendered as a docked pill below the message bubble showing unique emojis and counts (e.g. `❤️ 1`, `👍 2`).
  - Realtime: Stored in `messages.metadata`, so any reaction toggle triggers the existing `messages` `UPDATE` realtime subscription, updating both participants' screens instantly.

### D. Conversation List Preview Consistency
- **Problem**: When a message is revoked or deleted, the conversation list preview in [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx) must not continue showing deleted message text.
- **Solution**:
  - When `deleteMessageForEveryone` runs, it updates `conversations.last_message_content` if the revoked message was the latest message.
  - Realtime updates on `messages` in [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx) invalidate `['conversations', user.id]` so previews refresh automatically.

### E. Inbound Message Sound (WhatsApp-Style)
- **Problem**: No sound plays when new messages arrive.
- **WhatsApp Specification**:
  - When an inbound message is inserted (`messages` table `INSERT` event in realtime):
    - Condition: `sender_id !== currentUserId`.
    - Condition: Conversation is not muted (`!is_muted`).
    - Condition: User is on the chat list (`/chat`) or in a different conversation than the incoming message, OR the app window/tab is in the background.
    - If user is actively inside the open thread and foregrounded, suppress the chime (or play a subtle click) so it doesn't interrupt or echo.
  - Implement a Web Audio API chime synthesizer for 100% reliable zero-latency playback without broken asset 404s, accompanied by a sound helper utility [`lib/utils/chatSound.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/utils/chatSound.ts).

---

## 2. Architecture & File Plan

### 1. [`lib/api/chat.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/api/chat.ts)
- Add `deleteMessageForMe(userId: string, messageId: string)`:
  - Fetches existing message metadata.
  - Appends `userId` to `metadata.deleted_for_users`.
  - Updates `messages` row.
- Add `deleteMessageForEveryone(userId: string, messageId: string, conversationId: string)`:
  - Verifies user is sender.
  - Sets `metadata.is_deleted_for_everyone = true` and `content = null`.
  - Updates `messages` row.
  - If latest message in conversation, updates `conversations.last_message_content = '🚫 This message was deleted'`.
- Add `toggleMessageReaction(userId: string, messageId: string, emoji: string)`:
  - Loads current reactions from message `metadata.reactions`.
  - Toggles or swaps reaction for `userId`.
  - Updates `messages` row.
- In `sendMessage`:
  - Reset `deleted_at: null` on `conversation_participants` for all conversation members so new messages revive threads.
- Fix/fortify `softDeleteConversation(userId: string, conversationId: string)`:
  - Ensures robust RPC call + direct fallback update if RPC is missing.

### 2. [`lib/utils/chatSound.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/utils/chatSound.ts) (New Utility)
- Implements `playInboundMessageSound()`:
  - Generates the signature crisp, warm double-tone chime (WhatsApp-like marimba/bell: ~800Hz & ~1200Hz with exponential decay).
  - Throttled/debounced (no sound stacking for bulk sync).
  - Safe for browser autoplay policies (unlocked on first user interaction).

### 3. [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx)
- Fix `deleteConversationMutation`:
  - Correct argument order: `softDeleteConversation(user!.id, convId)`.
  - Optimistic query cache update: remove `convId` from cached list immediately.
- In the global `messages` realtime listener:
  - Check if incoming message is inbound (`sender_id !== user.id`).
  - If user is on the chat list, play `playInboundMessageSound()`.

### 4. [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
- Fix conversation delete menu call: `softDeleteConversation(user!.id, activeId!)`.
- Filter out messages where `m.metadata?.deleted_for_users?.includes(user.id)`.
- Render deleted message placeholder for `m.metadata?.is_deleted_for_everyone`:
  - Display *"🚫 This message was deleted"* (or *"🚫 You deleted this message"* for sender) in italicized muted text.
- Add long-press / right-click menu or hover actions on message bubbles:
  - Quick Emoji Reaction Bar (`👍`, `❤️`, `😂`, `😮`, `😢`, `🙏`).
  - Delete action button triggering confirmation dialog:
    - If sender: "Delete for me" vs "Delete for everyone" vs "Cancel".
    - If recipient: "Delete for me" vs "Cancel".
- Render emoji reaction badge pill docked at the bottom of the message bubble.
- In message realtime handler:
  - If incoming message is for a different conversation, trigger `playInboundMessageSound()`.
  - When `UPDATE` event arrives, sync reactions, revoke state, and per-user hide.

---

## 3. Verification & Acceptance Gates
1. [x] Inverted argument order bug in `softDeleteConversation` is fixed in both `Chat.tsx` and `ChatConversation.tsx`.
2. [x] Deleting a conversation removes it immediately from the list; on reload it does not reappear until a new message arrives.
3. [x] Delete for me removes the message bubble only for the current user; the peer's view remains intact.
4. [x] Delete for everyone revokes the message for both participants, showing *"This message was deleted"*, and clears the original content.
5. [x] Conversation list last-message preview updates to reflect deleted state.
6. [x] Emoji reactions can be added, changed, and removed with count pill rendered below the bubble, and propagate via realtime.
7. [x] Inbound message sound plays when messages arrive while on the list or in another chat.
8. [x] `npm run build` / TypeScript typecheck passes with 0 errors.
