# Enhanced Engineering Specification: High-Priority Red Caution Alert, Punctuation/Em-Dash Stroke Elimination, and Chat Unread-State Synchronization

## 1. Executive Summary & Objective Synthesis
This specification establishes a robust solution for three distinct defects in the Health Coach and Chat interaction systems:
1. **Unread Badge & Re-trigger Defect on Navigation**:
   - When a user reads a coach message inside `/chat/[id]` and navigates back to `/chat` (contact list), the conversation still displayed a green unread badge (count: 1) and chimed with the inbound audio alert as if the message had been resent or remained unread.
   - Root Cause: `markConversationAsReadLocal` was invoked strictly on initial component mount or window focus. When an inbound message arrived via Realtime while the chat conversation view was actively open, `markMessageDelivered` was dispatched, but `markConversationAsRead` was never executed. Consequently, `is_read` remained `false` in Postgres, so the parent contact list retrieved an unread count of 1.
2. **Generic Message Appearance for Calorie Exceeded Alert**:
   - The urgent calorie exceeded message ("STOP EATING IMMEDIATELY! This is an urgent health alert...") was styled in the identical generic white/slate bubble used for ordinary conversation, stripping away the urgency, significance, and gravity of a dangerous caloric surplus.
   - Objective: Upgrade this specific message into a high-visibility, red-highlighted caution card with a distinct red caution border, warning badge header with pulse animation, and high-contrast typography in both light and dark themes.
3. **Punctuation Stroke / Em-Dash (`—`) Artifacts in AI Replies**:
   - Language models consistently emit typographic em-dashes (`—` / `\u2014`) or en-dashes (`–` / `\u2013`) between clauses (e.g., *"to support you—whether you want to"*). The user identified these as disruptive "strokes / ticks" that degrade the reading experience.
   - Objective: Eradicate em-dashes, en-dashes, and double hyphens across the entire pipeline: AI prompt instructions, response formatting utilities, streaming chunk processors, and client-side message renderers (ensuring historical database records are retroactively sanitized upon display).

---

## 2. Technical Architecture & Component Design

### Feature A: Active-Screen Real-Time Read State Synchronization
- **File**: [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
- **Mechanics**:
  1. In `onMessageEventRef` (when Realtime receives `eventType === 'INSERT'`):
     - If the conversation is currently mounted, active, and visible (`document.visibilityState === 'visible'`), immediately execute `markConversationAsReadLocal(convId, true)`.
     - Dispatch `markAsRead(user.id, convId)` to the database to ensure all messages from the peer/coach are updated to `is_read = true` and `read_at = now()`.
  2. In the component cleanup (unmount) and on the back-navigation action handlers (back arrow button and route push to `/chat`):
     - Force an immediate optimistic update in `queryClient.setQueryData(['conversations', user.id])` setting `unread_count: 0` for the current conversation.
     - Call `markConversationAsReadLocal(convId, true)` synchronously before transition.
  3. In [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx):
     - Ensure the `chat-list-global-manager` Realtime channel suppresses the inbound message chime if the incoming message belongs to a conversation that was already marked as read or is currently the active route.

### Feature B: High-Priority Red Caution Alert UI
- **File**: [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
- **Detection Criteria**:
  ```ts
  const isCalorieAlert = msg.metadata?.type === 'calorie_limit_exceeded' || 
                         (msg.sender_id === COACH_ID && (
                           msg.content?.includes('STOP EATING IMMEDIATELY') || 
                           msg.content?.includes('urgent health alert')
                         ));
  ```
- **Visual Specifications**:
  - **Bubble Container**:
    - Light Mode: `bg-rose-50 border-2 border-red-500/80 text-rose-950 shadow-md shadow-red-500/10 rounded-2xl rounded-tl-none`
    - Dark Mode: `dark:bg-rose-950/40 dark:border-red-500/80 dark:text-rose-100 shadow-md shadow-red-500/20 rounded-2xl rounded-tl-none`
  - **Caution Header Banner**:
    - Displayed at the very top of the bubble.
    - Icon: `AlertTriangle` in bold red with `animate-pulse`.
    - Label: `"URGENT HEALTH CAUTION"` in `font-black text-xs uppercase tracking-widest text-red-600 dark:text-red-400`.
    - Separator: Clean red-tinted hairline divider (`border-b border-red-200 dark:border-red-900/60 pb-2 mb-2`).
  - **Body Typography**:
    - Lead line ("STOP EATING IMMEDIATELY! This is an urgent health alert.") in bold, high-contrast red font.
    - Body text formatted with generous line-height (`leading-relaxed font-medium`).
  - **Timestamp Indicator**:
    - Styled with subtle red tone (`text-red-400/80 dark:text-red-300/60 text-[10px]`) aligning cleanly with the caution theme.

### Feature C: Global Punctuation & Stroke (Em-Dash) Elimination
- **Scope**:
  1. **Conversational Formatter**: [`lib/services/ai/ConversationFormatter.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationFormatter.ts)
     - Normalize all variations of typographic strokes:
       `text = text.replace(/\s*[—–]\s*|\s*--\s*/g, ', ').replace(/,\s*,/g, ', ');`
     - Strip all `#` and `*` symbols.
     - Ensure sentence flow remains natural, grammatically sound, and devoid of abrupt dashes or big stroke ticks.
  2. **Streaming AI Route**: [`app/api/coach-reply/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/coach-reply/route.ts)
     - Strip `—` and `–` from incoming token chunks and final aggregated response before DB persistence.
  3. **Conversation Orchestrator**: [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts)
     - Add explicit system directive: *"Never use em-dashes (—), en-dashes (–), or double hyphens (--) between phrases. Separate conversational clauses with natural punctuation such as commas or standard periods."*
  4. **Chat Message Renderer (Retroactive Fix)**: [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
     - In `renderMessageContent`, sanitize all messages from `COACH_ID`:
       ```ts
       const cleanContent = (isAI || msg.sender_id === COACH_ID)
         ? (msg.content || '')
             .replace(/[*#]/g, '')
             .replace(/\s*[—–]\s*|\s*--\s*/g, ', ')
             .replace(/,\s*,/g, ', ')
             .trim()
         : msg.content;
       ```
     - Guarantees that the exact message shown in the user's screenshot (*"Whenever you're ready, Kinja, I'm here to support you—whether..."*) immediately displays cleanly as *"Whenever you're ready, Kinja, I'm here to support you, whether..."* without requiring a database wipe.

---

## 3. Files Impacted
- [`app/_pages/ChatConversation.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/ChatConversation.tsx)
- [`lib/services/ai/ConversationFormatter.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationFormatter.ts)
- [`app/api/coach-reply/route.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/api/coach-reply/route.ts)
- [`lib/services/ai/ConversationOrchestrator.ts`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/services/ai/ConversationOrchestrator.ts)
- [`app/_pages/Chat.tsx`](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/app/_pages/Chat.tsx)

---

## 4. Rigorous Acceptance & Verification Criteria
1. **Visual Caution Highlighting**:
   - The calorie exceeded alert in the chat appears as a distinctive, styled red caution box with `border-2 border-red-500`, red background tint, and an `URGENT HEALTH CAUTION` banner.
   - Standard peer and AI messages retain their regular clean styling without distortion.
2. **No Em-Dash / Stroke Artifacts**:
   - The phrase *"support you—whether"* renders without the dash stroke.
   - Any future AI message replaces em-dashes and en-dashes with clean commas.
3. **Read State Reliability**:
   - Reading a coach message in the conversation and tapping the back button to the contact list leaves the conversation marked as read (zero unread badge count, no chime replay).
4. **Zero Regressions**:
   - Full TypeScript build check (`cmd.exe /c npx tsc --noEmit`) passes with 0 errors.
