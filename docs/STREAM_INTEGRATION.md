# Stream (GetStream) Integration & Boundary Documentation

## Current Status
- **Phase 1 (Active)**: Stream Agent Skills installed in `.agents/skills/stream/` for live documentation lookup and potential developer tooling.
- **Runtime Application Status**: **0% active runtime integration.** No code in `app/`, `components/`, or `lib/api/chat*` has been modified.
- **Production Chat Architecture**: Supabase Realtime + `conversations` / `messages` / `conversation_participants` tables with Row Level Security (RLS) policies.
- **Production Calling Architecture**: Daily.co integration.

---

## Architectural & Security Boundaries

1. **No Silent Replacements**: Stream Chat and Stream Video must NOT replace Supabase Realtime chat or Daily.co calling without a separate, explicitly user-approved migration plan.
2. **Server-Only Credentials**:
   - `STREAM_API_SECRET` must **NEVER** be placed in client-side code, Next.js public variables (`NEXT_PUBLIC_*`), or exposed in browser bundles.
   - Any token generation for Stream must take place exclusively on the server (e.g. Next.js API route or Supabase Edge Function).
3. **Environment Configuration**:
   - Local development credentials must live in git-ignored `.env` or `.env.local` files.
   - Staging/Production credentials must be set via Netlify environment variables.
   - `.env.example` contains commented placeholder variables only.

---

## Tooling & Agent Skill Invocation

AI Coding Agents (Antigravity, Cursor, Codex, Claude Code) may use the installed Stream Agent Skills for documentation lookup:

- **`/stream`**: Core router skill for Stream tasks.
- **`/stream-docs`**: Query live Stream documentation for accurate, citation-backed API details without hallucinating signatures.
- **`/stream-builder`**: Assistance with constructing Stream components and SDK configurations when experiments are approved.

---

## Future Migration Checklist (If Ever Approved)

If a decision is made in a future task to adopt Stream Chat or Stream Video:

1. **Architecture & Scope Approval**:
   - Obtain user approval for migration scope and database schema strategy.
2. **Server-Side Token Generation API Route**:
   - Build a serverless route (e.g., `/api/stream/token`) that uses `STREAM_API_SECRET` to mint user tokens safely.
3. **Client SDK Integration**:
   - Add Stream React / Video SDK dependencies and components in a modular manner.
4. **Data Sync / Migration Strategy**:
   - Plan data migration from Supabase `messages` / `conversations` to Stream Chat channels if required.
5. **Netlify Deployment Verification**:
   - Configure `STREAM_API_KEY` and `STREAM_API_SECRET` in Netlify environment variable settings.
