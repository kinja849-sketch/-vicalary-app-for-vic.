# Focused Fix Specification: Nav, Composer, Voice Header, Responsiveness

## 1. Objective
Apply exact, focused fixes for the 5 targeted UX and UI issues across navigation, chat composer, voice modal header, and multi-device responsive layout without changing the core visual design language (colors, typography style, branding).

## 2. Scope & Implementation Details

### Fix 1: Microphone Duplication (Chat Conversation Composer)
- File: app/_pages/ChatConversation.tsx
- Remove duplicate inline dictation microphone (<Mic />) and inline AI sparkles button inside the input container.
- Standardize on a single trailing action control:
  - When message is empty: exactly one microphone icon (<Mic />) that starts voice mode for the Health Coach / records voice note.
  - When message has text: changes cleanly to Send (<Send />).
- Ensure single click handler and no duplicate mic elements in the component tree.

### Fix 2: Bottom Navigation Alignment & Labels
- File: components/BottomNavbar.tsx
- Unify all four tab items (Beranda, Pemberitahuan, Obrolan, Profil) into equal-width flex containers (flex-1 w-full).
- Fix icon wrapper dimensions (w-6 h-6 flex items-center justify-center relative shrink-0) to keep all tab icons on identical vertical centerlines.
- Remove active scale-110 transform from icons to prevent vertical layout shifts.
- Set label text to text-[10px] font-semibold tracking-tight truncate max-w-full text-center whitespace-nowrap leading-none, preventing "PEMBERITAHUAN" from breaking into two lines and breaking the baseline.
- Center bell icon horizontally in its column; position unread badge absolutely (-top-1 -right-1.5) without altering tab item height or baseline.
- Align bottom nav container to the app shell: fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px].

### Fix 3: Health Coach Text Composer (Clean Single-Row Redesign)
- File: app/_pages/ChatConversation.tsx
- Reorganize composer into a clean single row: [+] or [??] [Flexible Textarea] [?? or ?? Send].
- Leading control: Single attachment button opening the attachment drawer (Emoji, Document, Location, Gallery, Audio).
- Textarea: Primary element with flex-1 min-w-0, auto-growing from 1 line (~40px) up to 3-4 lines (max 100px) then scrolling internally; reset on send.
- Ensure typing is completely unobstructed on small screens (320px-430px).

### Fix 4: Voice / Blob Screen Title and Chrome
- File: components/AICoachVoiceModal.tsx
- Header Title: Set strictly to "Health Coach".
- Remove "Voice Mode" subtitle segment completely.
- Remove all language chips (EN / ID / ES / AR) from the header.
- Remove extra "AI" badge/branding treatment from the title string.
- STT/TTS language follows user profile/app locale automatically.
- Keep status text under the blob ("Listening...", "Vee Speaking...", "Thinking...").

### Fix 5: Multi-Device Responsive Layout
- Files: components/GlobalShell.tsx, components/BottomNavbar.tsx, app/_pages/ChatConversation.tsx
- Enforce a centered mobile-first shell on all viewports:
  - Wrapper: min-h-[100dvh] w-full bg-slate-100 dark:bg-slate-950 flex justify-center
  - App Column: w-full max-w-[480px] min-h-[100dvh] bg-white dark:bg-[#0b141a] flex flex-col relative shadow-2xl mx-auto overflow-x-hidden
- Ensure bottom navbar matches the 480px shell width and centers seamlessly on tablet/desktop viewports (390px, 768px, 1024px, 1280px).
- Eliminate horizontal scrollbars, distorted stretched cards, and empty semantic gaps.
