# Master Implementation Prompt: Install and Integrate Stream Skills

## Goal
Install Stream Agent Skills into the VICALARY project and prepare a controlled, secure integration path so the AI agent can use live Stream documentation and tooling, while protecting the existing Supabase Realtime chat and Daily.co calling architecture until an explicit migration decision is made.

## What it read
- Vibe Engineering Guide (full)
- Existing VICALARY `AGENTS.md` rules (architecture, security, out-of-scope)
- Current chat stack: Supabase Realtime + `conversations` / `messages` / `conversation_participants` + RLS
- Current calling stack: Daily.co
- Deploy target: Netlify (`netlify.toml` + `@netlify/plugin-nextjs`)
- Official Stream Agent Skills Quickstart (`getstream` CLI, `/stream`, `/stream-docs`, `/stream-builder`, on-demand packs)
- Existing `.env.example` and secret-handling rules

## Assumptions
1. “Integrate” means:
   - **Phase 1 (this task):** Install Stream CLI + core Agent Skills + secure credential placeholders.
   - **Phase 2 (future, separate approved task):** Any actual replacement or parallel use of Stream Chat / Stream Video.
2. Existing Supabase chat and Daily.co calling must remain the production path. No silent rewrite.
3. Stream API keys and secrets follow the same server-only rules as OpenAI, Plaid, Brankas, and Supabase service-role keys.
4. Skills are installed in the universal location that Cursor / Codex / Claude Code / Antigravity can read (`.agents/skills/`).
5. No application feature code (UI, API routes, database) is changed in this task beyond credential placeholders and documentation.
6. Netlify environment variables will later hold Stream keys; nothing is committed.

## Files that will change / be created
### Create
- `.agents/skills/` (or confirm existing) and link Stream skills
- `prompts/install-and-integrate-stream-skills.md` (this file)
- `docs/STREAM_INTEGRATION.md` — short internal note explaining current status, boundaries, and future migration checklist

### Modify
- `.env.example` — add clearly commented Stream placeholder variables (no real secrets)
- `.gitignore` — ensure any Stream local credential files are ignored
- `AGENTS.md` — add the short “Stream / GetStream skills” section previously recommended

### Do NOT modify in this task
- Any file under `app/`, `components/`, `lib/api/chat*`, Daily.co hooks, Supabase chat tables, or existing API routes
- Production chat or calling behaviour

## Implementation Requirements

### 1. CLI & Skills installation
- Install `getstream` CLI / skills into `.agents/skills/`.
- Ensure the following core Stream skills become available:
  - `/stream`
  - `/stream-docs`
  - `/stream-builder`

### 2. Credential handling (security)
Add to `.env.example` only:
```env
# Stream (GetStream) – optional / future use
# STREAM_API_KEY=your_stream_api_key
# STREAM_API_SECRET=your_stream_api_secret   # SERVER ONLY – never expose to browser
# NEXT_PUBLIC_STREAM_API_KEY=your_stream_api_key   # only if client SDK is later approved
```
- Real values go into local `.env` (git-ignored) and later into Netlify environment variables.
- Never commit real Stream secrets.
- Never place `STREAM_API_SECRET` in any client-side code or `NEXT_PUBLIC_` variable.

### 3. Project rules update
Add this exact section to `AGENTS.md`:
```markdown
## Stream / GetStream skills
Stream Agent Skills may be used for live documentation lookup and for explicitly approved experiments only.
Do not replace Supabase Realtime chat or Daily.co calling with Stream Chat or Stream Video unless the user has approved a full migration plan in a separate task.
Any Stream credentials are secrets and follow the same server-only rules as other API keys.
Token generation for Stream (if ever used) must happen on the server.
```

### 4. Internal documentation
Create `docs/STREAM_INTEGRATION.md` containing:
- Current status: Skills installed, no runtime integration yet
- Existing architecture reminder (Supabase chat + Daily.co)
- How to invoke `/stream-docs` and `/stream` safely
- Future migration checklist (what would need to change, security requirements, Netlify considerations)
- Explicit statement that production chat/calling remains unchanged

### 5. Verification commands the agent must run / report
- `getstream --version` (or CLI check)
- Confirm skills directory exists and contains Stream-related markdown definitions
- Test non-destructive `/stream-docs` style lookup

## Security Requirements
- `STREAM_API_SECRET` never reaches the browser or any client bundle.
- No new API routes that expose Stream secrets.
- No changes to existing auth or RLS policies.
- All Stream-related files that contain credentials are git-ignored.

## Acceptance Criteria
- `getstream` CLI / tool is accessible and reports version / availability
- Core Stream skills are present in `.agents/skills/`
- `/stream-docs` capability is established
- `.env.example` contains only placeholder Stream variables with clear SERVER-ONLY warnings
- `AGENTS.md` contains the Stream boundary section
- `docs/STREAM_INTEGRATION.md` exists and correctly states that production chat/calling is untouched
- No application source code under `app/`, `components/`, or chat-related `lib/` has been modified
- No real secrets are committed
- User can run the app on localhost exactly as before
