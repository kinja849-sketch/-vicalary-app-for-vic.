# Implementation Prompt: Chat Presence — Typing, Online/Offline, Last Seen

## 1. Verified root causes (from code inspection)
File: `app/_pages/ChatConversation.tsx` (paths relative to nested project root)

| # | Finding | Location |
|---|---------|----------|
| 1 | Peer channel is `private_chat_${[user.id, localActiveId].sort().join('_')}`; `localActiveId` is the conversation UUID, so A and B join different rooms. Typing/online never meet. | ~L1233 |
| 2 | Presence effect deps are `[activeId, user?.id]`; `otherParticipantId` (L524) resolves later and the `sync` closure reads a stale/null `targetId`. | L1242, L1293 |
| 3 | Global `online-users` channel is tracked only while `ChatConversation` is mounted. | L638-662 |
| 4 | `displayStatus` uses `p?.last_seen \|\| p?.updated_at`; `user_profiles` has no `last_seen` column and nothing writes one. | L675 |
| 5 | Header priority is split between `otherUserOnline` (conversation) and `isOnline` (global). | L665-692, L1990-2003 |

`sendTypingIndicator` in `lib/api/chat.ts` (L720) is fine; it only needs the shared channel.

## 2. Source map
| Displayed value | Source |
|---|---|
| typing | Realtime presence payload `typing` of peer in `conversation:<id>` room (ephemeral) |
| online | Peer present in `conversation:<id>` room OR in global `online-users` room |
| last seen | `user_profiles.last_seen` (new, durable, written by authenticated user only) |
| Offline | No presence and no `last_seen` |

## 3. Planned changes
1. **Channel naming** (`ChatConversation.tsx`): peer chats -> `conversation:${localActiveId}`. Keep `chat_room_${id}` for AI and `private_chat_self_${id}` for self. The `postgres_changes` message listener on the same channel is unchanged.
2. **Presence handlers**: on `SUBSCRIBED` track `{ user_id, conversation_id, typing:false, online_at }`. Handle `sync` (plus `join`/`leave` to refresh). Read the target id from a ref (`targetIdRef`) updated whenever `otherParticipantId`/`vTargetId` changes, and re-run the sync computation when it changes, so the target is never stale. For AI/self chats, never set peer typing/online from presence.
3. **Typing**: keep the existing throttled `handleTyping` (~2s throttle, clear after ~3s idle) via `sendTypingIndicator(activeChannelRef.current, ...)`. Also clear typing on send, blur, and unmount.
4. **Global online**: extract the `online-users` tracking into a small shared hook (`hooks/useGlobalPresence.ts` — check for an existing hook first) and use it in both `ChatConversation` and the chat list page, so online is not limited to the open thread.
5. **Last seen persistence**
   - Migration `supabase/migrations/20261008_user_profiles_last_seen.sql`: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;` plus a `SECURITY DEFINER` RPC `touch_last_seen()` that updates only `WHERE user_id = auth.uid()`. No service-role key on the client. (Confirm the profile's key column name against `schema_dump.sql` and the existing RLS before writing.)
   - Client writes (via the RPC, in the shared hook): on a heartbeat (~60s while visible), on `visibilitychange` to hidden, on `pagehide`/`beforeunload`, and on presence leave/unmount. Unload writes use `fetch(..., { keepalive: true })` against a thin `app/api/presence/last-seen` route that derives the user from the session.
   - Update `lib/database.types.ts` with `last_seen`.
   - Subscribe to the existing `profile:${otherParticipantId}` realtime channel (L537) so the header refreshes when the peer's `last_seen` changes.
6. **Header priority** (`displayStatus` and the L1990-2003 render): typing -> online (conversation presence OR global presence) -> `last seen today/yesterday/date` from `last_seen` ONLY (drop the `updated_at` fallback) -> `Offline`. No visual redesign; the same markup and classes.

## 4. Out of scope / must not change
Message send/receive, RLS on `messages`, read receipts, media send, call flows, UI styling, auth, any third-party presence product.

## 5. Failure states
- Realtime not subscribed -> show last seen/Offline, never a guessed Online.
- `last_seen` null -> `Offline` (typed unknown, not `updated_at`).
- RPC failure -> logged, non-blocking, no UI impact.

## 6. Acceptance criteria
1. A and B in the same peer thread: A types -> B sees "typing…" and the typing bubble within ~1s; it clears within ~3s of idle without sending.
2. Both users on a presence-tracking screen (thread or chat list) see each other "Online"; when one closes the tab or goes offline, the other sees last seen/Offline with no reload.
3. After leaving, the peer sees `last seen today/yesterday at HH:MM` or a date, backed by `user_profiles.last_seen`.
4. AI coach and self/notes chats show no false peer typing/online.
5. Messages, read receipts and media are unchanged; no secrets on the client.
6. Channel name is identical for both participants (verified in console logs).

## 7. Verification plan
- `npx tsc --noEmit`, lint, relevant tests (add a unit test for the pure status-formatting function if it is extracted).
- `npm run dev` as a daemon; Chrome DevTools at `http://localhost:3000` with two accounts (two browser profiles/incognito); check console and network (websocket presence frames, the RPC call).
- Check `user_profiles.last_seen` in Supabase after leaving.
- Localhost steps will be provided in the summary. No push until user review and the CodeRabbit cycle.
