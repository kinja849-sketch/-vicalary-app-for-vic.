# Real-time Chat & Calling Skill

## Features
- **WhatsApp-style Messaging**: Supabase Realtime pub/sub channels (`conversations`, `messages`, `chat_users`).
- **AI Coach Interactions**: `/api/coach-reply` for streaming conversational responses with nutrition context.
- **Media & Voice/Video Calling**: Audio and video call rooms integrated via Daily.co (`@daily-co/daily-js`).

## Rules
- Manage active Supabase Realtime channel subscriptions inside custom hooks with proper cleanup on unmount.
- Handle voice/video call session tokens securely through server API routes.
- Ensure audio, video, and image attachments in chat are uploaded to Supabase Storage with correct user access controls.
