# Antigravity Practical Guide
**A practical field guide to the Google Antigravity (`agy` CLI, Antigravity IDE, and Antigravity 2.0) commands, shortcuts, files, workflows, and advanced agent features you'll actually use while building real software.**

> [!NOTE]
> **VERSION-DEPENDENT**
> Antigravity evolves rapidly across **Antigravity 2.0**, **Antigravity IDE**, and the **Antigravity CLI (`agy`)**. Type `/` inside your chat session or run `agy --help` in your terminal to see every command available in your active environment.

---

## 01. Starting Antigravity

### Start a normal interactive session
```bash
agy
```
Or open **Antigravity 2.0** / **Antigravity IDE** and start a conversation in the Chat Canvas. Then ask it to do anything:
> $\rightarrow$ Explore this project and explain how food analysis data currently flows from the API route to Supabase and the progress dashboard.

### Start Antigravity CLI with the first task already provided
```bash
agy "your task"
```
Example:
```bash
agy "find out why the barcode scanner allergy gate tests are failing"
```
Useful when you already know exactly what you want Antigravity to start with.

### Run one task and exit (Non-Interactive Mode)
```bash
agy -p "your task"
```
Example:
```bash
agy -p "review the current git diff for obvious regressions"
```
Antigravity performs the task, outputs the result, and exits.

**Use it when you want Antigravity inside:**
- Shell scripts
- CI pipelines
- Automated checks
- Cron jobs
- Command pipelines
- Other developer tools

You can pipe information into it too:
```bash
Get-Content -Tail 300 app.log | agy -p "find the likely cause of these errors"
```

### Continue your latest session or resume an older session
In **Antigravity 2.0 / IDE**, select any previous conversation from the **Left-hand Sidebar** or reference it with `@conversation` to continue right where you left off.
In **`agy` CLI**, use `agy -c` (continue latest) or `agy -r` / `/resume` to return to a specific piece of work instead of starting fresh.

---

## 02. The Commands & Controls You'll Use Constantly

| Command / Control | What It Does | Use It When |
| :--- | :--- | :--- |
| `/help` | Shows slash commands and skills available to you | You forget a command |
| **New Conversation** (`/clear`) | Starts a clean conversation context | Moving to unrelated work |
| `/compact` | Compresses and summarizes the current conversation | Same task, context getting large |
| `/plan` | Enters Planning Mode for step-by-step architectural design | Approach needs review first |
| `/grill-me` | Interactive design interview to resolve ambiguities | Aligning on a complex plan before coding |
| `/goal` | Runs a thorough, long-running autonomous execution loop | You want the agent not to stop until the goal is achieved |
| `/teamwork` | Coordinates a team of autonomous subagents in parallel | Large project or separable multi-unit migration |
| `/boost` | Deep thinking, strategic planning, multiple perspectives, rigorous verification | Complex coding, architecture, or subtle bugs |
| `/learn` | Persists a correction or complex setup into reusable rules/skills | You corrected the agent and want it remembered permanently |
| `/schedule` | Runs an instruction on a recurring cron or one-time timer | Periodic checks, monitoring, or scheduled tasks |
| `/browser` | Launches browser automation and inspection workflows | Web testing, localhost UI verification, or DOM checks |
| **Model Selector** (`/model`) | Switches the active Gemini model (e.g., Flash, Pro, Argon) | Task needs a different capability level |
| **Permissions / Sandbox** | Manages command allowlists, file access, and sandbox policies | Controlling access, secrets, and auto-approval |
| **Visual Diff / `git diff`** | Reviews exact line-by-line changes before accepting or shipping | Before accepting edits or pushing |
| **Subagent & Task Manager** | Inspects active subagents (`manage_subagents`) and background tasks (`manage_task`) | Subagents or background daemon commands are running |
| **MCP Servers** | Manages Model Context Protocol integrations (`mcp_config.json`) | Connecting external tools, databases, or DevTools |
| **Hooks** (`.agents/hooks.json`) | Configures deterministic lifecycle hooks | Automatic workflow enforcement (`PreToolUse`, `PostToolUse`) |

---

## 03. New Session (`/clear`) vs `/compact` vs Branched Subagent (`/branch`)

These solve three different problems:

| Control | Problem Solved |
| :--- | :--- |
| **New Session** (`/clear`) | Different, unrelated problem |
| `/compact` | Same problem + too much accumulated context |
| **Branched Subagent** (`Workspace: "branch"`) | Try another approach safely without derailing the main session |

### 1. New Conversation (`/clear`)
- **Use it when**: You're moving from one unrelated task to another.
- **Example**: You just spent 40 minutes debugging Supabase Phone OTP authentication. Now you want to refine the Cookbook recipe card layout. Start a **New Conversation** because all that authentication context isn't useful anymore.

### 2. `/compact`
- **Use it when**: You're still working on the same problem, but the session has become large.
- **Tell Antigravity what matters**:
  ```text
  /compact preserve all Prisma schema decisions, Supabase RLS policies, and unresolved scanner expenditure issues
  ```
- **Rule of thumb**:
  - Same problem + too much context = `/compact`
  - Different problem = **New Conversation** (`/clear`)

### 3. Branching & Experimenting Safely (`Workspace: "branch"` / `"share"`)
- **Use it when**: You want to experiment with another architectural direction without destroying the path or checkout you're already on.
- **How it works in Antigravity**: Launch a subagent (`invoke_subagent`) with `Workspace: "branch"` (or `"share"`), which creates an isolated workspace branched from your current state while leaving your primary workspace intact.

---

## 04. Forked Subagent (`TypeName: "self"`) vs Specialized Subagent (`TypeName: "research"`)

Antigravity supports both focused subagents and full-capability self-subagents via `invoke_subagent`:

| Normal / Research Subagent (`research`) | Self Subagent (`self`) |
| :--- | :--- |
| Starts with a clean, read-only context focused strictly on the prompt supplied by the parent | Inherits the parent agent's full configuration, tools, system prompt, and rules to execute a parallel side task |

**Use a delegated subagent when:**
- The side task (such as drafting unit tests for parser changes or auditing edge cases across 20 files) can run asynchronously in the background while you keep working in the main conversation.

---

## 05. Context Management

Antigravity doesn't only carry your chat messages. The context window contains:
- Conversation history & tool results
- Files read via `read_file`
- [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) / `GEMINI.md` / `.agents/rules/*.md`
- Terminal output & background task logs
- Active Skills & MCP tool schemas
- Messages returned from subagents

**That means context quality matters.**
- Rules are capped at **24 KB per file** and share a **20,000-token rules budget**.
- Skills use **progressive disclosure**: only their `name` and `description` are loaded initially; the full `SKILL.md` is read only when activated.
- When the agent starts repeating itself, referencing stale decisions, or carrying too much irrelevant file output, run `/compact` or delegate deep file-reading sweeps to the `research` subagent.

---

## 06. `AGENTS.md` (and `GEMINI.md`)

[`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) is the persistent project operating manual that Antigravity automatically loads when working in your repository.

A project-level [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) defines:
- **Commands**: `npm run dev` (daemon), `npm test`, `npm run lint`, `npx tsc --noEmit`
- **Database & Authority**: Supabase Auth (`user.id`), RLS enforcement, [`prisma/schema.prisma`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/prisma/schema.prisma), never manually corrupting migrations
- **Frontend & UI Surface Protection**: Reuse existing Radix/shadcn primitives, preserve established layout, typography, and spacing tokens
- **Mandatory Gates**: `ANALYZE → PLAN → MODIFY → VERIFY → SUMMARIZE`, `prompts/<feature-name>.md` approval gate, Chrome DevTools verification, and CodeRabbit pre-push review

When initializing or auditing a repo, never blindly overwrite handwritten rules in [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) — review and reconcile carefully.

---

## 07. Where Instructions Should Live

A simple architectural rule for keeping your Antigravity setup clean as the project grows:

| What You Need | Where It Lives in Antigravity |
| :--- | :--- |
| Something Antigravity should **always know** | $\rightarrow$ [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) / `GEMINI.md` / `.agents/rules/*.md` |
| A **repeatable way of doing work** | $\rightarrow$ **Skill** (`.agents/skills/<name>/SKILL.md`) |
| Something that **MUST happen automatically** | $\rightarrow$ **Hook** (`.agents/hooks.json`) |
| Something Antigravity **must not be allowed to do** | $\rightarrow$ **Permissions & Sandbox** (Settings / `PreToolUse` deny) |
| A **one-time feature or bug request** | $\rightarrow$ **Prompt** & `prompts/<feature-name>.md` |
| Connection to an **external service or tool** | $\rightarrow$ **MCP Server** (`mcp_config.json`) |
| **Separate focused investigation** | $\rightarrow$ **Subagent** (`invoke_subagent`) |
| **Isolated files for parallel edits** | $\rightarrow$ **Branched Workspace** (`Workspace: "branch"` / `"share"`) |

---

## 08. Permissions & Terminal Sandbox

Antigravity isn't just producing text. It can:
- Read, Write, and Edit files
- Run PowerShell/Bash commands (`run_command`)
- Use Git
- Call MCP tools (`call_mcp_tool`)
- Access external services & browsers

Permissions and the **Terminal Sandbox** control which actions are allowed (`allow`, `ask`, `deny`):

```json
{
  "permissions": {
    "allow": [
      "command(npx tsc --noEmit)",
      "command(npm run lint)",
      "command(npm test *)",
      "command(git status)",
      "command(git diff *)"
    ],
    "ask": [
      "command(git push *)"
    ],
    "deny": [
      "read(.env)",
      "read(.env.*)",
      "edit(.env)",
      "edit(.env.*)"
    ]
  }
}
```

### Good Permission Hygiene
- **Let Antigravity freely run in the sandbox (`BypassSandbox: false`)**: typechecks, lint, unit tests, `git status`, `git diff`.
- **Always ask before**: `git push`, `BypassSandbox: true` (network/unsandboxed execution), or destructive database operations.
- **Prevent direct exposure/modification of**: `.env` and `.env.*` secret files.

---

## 09. Permission & Execution Modes

In Antigravity Settings (Global or Project-Level), you control how autonomous the agent is:

| Mode / Policy | Behavior |
| :--- | :--- |
| **Strict / Manual** (`strict`) | Antigravity asks before running commands or sensitive actions. Great while working in sensitive areas. |
| **Request Review** (`request-review`) | Prompts for review on artifacts and non-whitelisted actions. |
| **Proceed in Sandbox** (`proceed-in-sandbox`) | Safe workspace commands run automatically inside the isolated sandbox (`BypassSandbox: false`); unsandboxed actions require approval. |
| **Planning Mode** (`/plan`) | Antigravity investigates the codebase and proposes an implementation plan (`prompts/<feature-name>.md`) before making source edits. |
| **Always Proceed** (`always-proceed`) | Maximum autonomy within configured allow/deny boundaries. |

---

## 10. Plan Mode (`/plan`)

Enter it with `/plan` (and enforce it via the Section 3.2 Prompt Gate in [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md#L95-L102)).

**Plan Mode is for:**
1. **Think first.**
2. **Inspect first.**
3. **Don't jump straight into implementation.**

### Good tasks for Plan Mode
- Database & Prisma schema changes
- Supabase authentication & RLS policies
- Permissions & security boundaries
- Architecture & provider integrations
- Migration work & large refactors
- Unfamiliar code or features spanning several systems
- Decisions that are expensive to reverse

### Challenge the plan before approving
Instead of a vague prompt like *"Build product variants"*, use:
```text
/plan Study the current scanner and budget implementation and propose how multi-pack barcode pricing should be introduced without breaking existing scanner expenditures. Include schema changes, migration path, API impact, and UI verification. Don't implement yet.
```
Then challenge the plan:
- $\rightarrow$ *Why do we need a new table instead of extending the existing model?*
- $\rightarrow$ *What existing code or API contract will break if we do it this way?*
That conversation saves you from reviewing a broken 2,000-line diff later.

---

## 11 & 12. Models & Reasoning Effort

Think about **Model** and **Effort** separately:
- **Model**: Which brain you're using (e.g., **Flash / Flash Lite** vs **Pro / Gemini Argon**).
- **Effort**: How hard you want it to think on this specific task.

| Faster Model / Lower Effort | Stronger Reasoning Model / High Effort (`/boost`) |
| :--- | :--- |
| Simple edits & renaming | Architecture & database design |
| Formatting & routine CRUD | Subtle debugging (e.g., `VoiceSessionController` race conditions) |
| Basic unit tests | Security & RLS review |
| Straightforward UI components | Large refactors & unfamiliar legacy code |

---

## 13, 14 & 15. Skills (`.agents/skills/`)

A **Skill** is a reusable process Antigravity can follow on demand. Project skills live inside:
```text
.agents/
  skills/
    build-ui/
      SKILL.md
      scripts/
      references/
```

### Example `.agents/skills/build-ui/SKILL.md`
```markdown
---
name: build-ui
description: Build or significantly update customer-facing UI using the existing project's components, design system, and responsive patterns.
---

# Build UI Workflow

## Before Implementing
1. Inspect the existing page and component hierarchy.
2. Search for reusable Radix/shadcn primitives.
3. Inspect the established Tailwind tokens.
4. Check how similar pages are structured.

## During Implementation
1. Reuse existing primitives.
2. Keep the change focused and preserve UI surface rules.
3. Follow established typography and spacing.
4. Make it responsive.

## Before Finishing
1. Ensure `npm run dev` daemon is running.
2. Inspect the live page with `chrome-devtools-mcp`.
3. Run typecheck and lint.
4. Report what changed with clickable `file:///` links.
```

### When to Create a Skill
If you catch yourself repeatedly typing:
1. *First inspect this...*
2. *Then check that...*
3. *Then follow these conventions...*
4. *Then test these things...*
5. *Then report using this structure...*
— **that belongs in a Skill** (e.g., `build-ui`, `verify-feature`, `review-changes`, `debug-voice`, `audit-rls`).

---

## 16, 17, 18 & 19. Subagents, Background Tasks, and Agent View

### Subagents (`define_subagent`, `invoke_subagent`, `manage_subagents`)
A subagent is another Antigravity worker with its own isolated context window:
1. **Separate context**: Can read dozens of files without cluttering your main chat.
2. **Focused task**: Investigates a specific subsystem (e.g., database schema, API routes, test coverage).
3. **Useful result returned**: Sends a concise findings report back to the main agent.

You can define custom reusable subagents in a session with `define_subagent` (controlling `SystemPrompt`, `EnableWriteTools`, `EnableMCPTools`, `EnableSubagentTools`) and invoke them with `invoke_subagent`.

### Background Tasks (`run_command` + `manage_task`) & Scheduled Tasks (`/schedule`)
- Long-running processes (such as `npm run dev`) run in the background with `IsDaemon: true`.
- Commands that take longer than `WaitMsBeforeAsync` automatically background and notify the agent upon completion.
- Use `manage_task` (`list`, `status`, `send_input`, `kill`) or the **Auxiliary Pane > Background Tasks / Subagents** view in Antigravity 2.0 to monitor all active work across your workspace.

---

## 20, 21 & 22. Workspace Isolation (`branch` / `share`) & Parallel Batch Work (`/teamwork`)

### Subagent vs Workspace Isolation
If two agents edit the same filesystem checkout simultaneously, conflicts happen fast.
- **Subagent** $\rightarrow$ **Context isolation** (separate token window).
- **Workspace (`Workspace: "branch"` or `"share"`)** $\rightarrow$ **Filesystem isolation** (isolated branch/worktree checkout).

When invoking a subagent that writes code (`invoke_subagent`), pass `Workspace: "branch"` or `Workspace: "share"` so the subagent modifies its own isolated checkout.

### Parallel Batch Work (`/teamwork`)
Use `/teamwork` or parallel isolated subagents for large, genuinely separable changes:
- **Good batch tasks**:
  - Migrating test files from one runner to another across independent modules
  - Replacing deprecated utility calls across decoupled packages
  - Auditing RLS or TypeScript strictness across independent route groups
- **Bad batch tasks**:
  - Building a tightly coupled core feature from scratch where every file depends on shared, evolving schema decisions.
- **Rule**: Only parallelize across isolated workspaces when the units of work are genuinely separable.

---

## 23. MCP (Model Context Protocol)

MCP connects Antigravity to tools and systems outside the local codebase:
- **Chrome DevTools (`chrome-devtools-mcp`)** for live localhost browser verification
- **StitchMCP** for design system and screen workflows
- **Netlify (`netlify`)** for deployment & project inspection
- **Data Agent Kit / Notebooks** for data pipelines

Configure MCP servers in `~/.gemini/config/mcp_config.json` or plugin `mcp_config.json` files (supporting local `command`/`args` Stdio or remote Streamable HTTP `url`). Inspect active servers in **Additional Options (...) > MCP Servers** or search for new integrations with `search_marketplace`.

---

## 24–32. Lifecycle Hooks (`.agents/hooks.json`)

| A Skill Says | A Hook Says |
| :--- | :--- |
| *"Antigravity should follow this workflow when relevant."* | *"This script runs **automatically and deterministically** every time this lifecycle event fires."* |

Hooks are configured in `.agents/hooks.json` and support six lifecycle events:
- `SessionStart`: Inject startup context or environment checks when a conversation begins.
- `PreInvocation`: Gate prompts or inject ephemeral reminders before the model is called.
- `PreToolUse`: Inspect tool calls before execution (`allow`, `deny`, `ask`, `force_ask`, or `overwrite` arguments).
- `PostToolUse`: Run deterministic actions after a tool finishes (e.g., auto-running Prettier or linting after `edit_file` / `write_file`).
- `PostInvocation`: Inspect outputs after tool calls finish.
- `Stop`: Prevent the agent from stopping early if verification gates or background tests are incomplete (`"decision": "continue"`).

### Example `.agents/hooks.json`
```json
{
  "auto-format": {
    "PostToolUse": [
      {
        "matcher": "edit_file|write_file",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write ."
          }
        ]
      }
    ]
  },
  "block-dangerous-commands": {
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "node ./scripts/check-safe-command.js"
          }
        ]
      }
    ]
  }
}
```
Blocking `rm -rf /`, `DROP DATABASE`, or `git push --force` in a `PreToolUse` hook is deterministic and far stronger than merely writing *"don't run dangerous commands"* in a prompt.

---

## 33, 34, 35 & 36. Shortcuts, `@` Mentions, Inline Commands, and Diagnostics

### Useful Controls & Shortcuts
| Shortcut / Prefix | Action |
| :--- | :--- |
| `@` | Mention files (`@app/page.tsx`), folders, rules, previous conversations, or MCP tools directly |
| `/` | Browse and invoke slash commands and workflows (`/plan`, `/compact`, `/boost`, `/teamwork`, etc.) |
| `Ctrl+I` / `Cmd+I` | Inline Command in Antigravity IDE for targeted in-place code edits or docstrings |
| `Tab` | Accept Antigravity Tab autocomplete / supercomplete / jump predictions |
| `Esc` | Cancel current generation or dismiss suggestion |
| `Ctrl+D Ctrl+D` | Exit `agy` CLI session |

### Mention Files Directly with `@`
Instead of saying *"Look somewhere in the authentication code"*, say:
> Review `@app/api/verify-otp/route.ts` and compare it with `@prisma/schema.prisma`

---

## 37. A Practical Everyday Workflow in Antigravity

For every normal feature or bugfix on VicCalary:
1. **Start Antigravity** with [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) active.
2. **Verify Context**: Ensure only relevant files and rules are in context.
3. **One Focused Scope**: Give Antigravity one well-defined feature or bug at a time.
4. **Plan First (`/plan` + Prompt Gate)**: Inspect the codebase and write the detailed blueprint in `prompts/<feature-name>.md`.
5. **Review & Challenge the Plan**: Confirm data sources, schema impact, and edge cases; explicitly approve before coding.
6. **Implement Minimally**: Reuse existing services, components, and tables.
7. **Monitor Live Execution**: Watch touched files and keep `npm run dev` running as a background daemon (`IsDaemon: true`).
8. **Verify on Localhost**: Inspect `http://localhost:3000` visually and check console/network logs via `chrome-devtools-mcp`.
9. **Inspect Diff**: Review all changes via visual diff / `git diff`.
10. **Run Checks**: Execute typecheck (`npx tsc --noEmit`), linter, and relevant tests.
11. **Independent Review**: Run a fresh review subagent and the mandatory **CodeRabbit review cycle** (Section 34 of [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md#L606-L630)).
12. **Security Review**: Verify Supabase Auth session resolution, RLS ownership, and zero secret leakage.
13. **Sync Documentation**: Update [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) if a permanent project rule or architectural contract changed.
14. **Compact Context (`/compact`)**: If continuing on the same feature when the session grows large.
15. **Start Fresh (New Conversation)**: Before switching to an unrelated task.

---

## 38. Quick Decision Guide & Mental Model

> **ONE MENTAL MODEL TO REMEMBER**
> You don't get better results from Antigravity by memorizing more commands. You get better results by knowing **which problem you're trying to solve**.

| Problem You're Solving | Antigravity Engineering Control |
| :--- | :--- |
| Antigravity needs permanent project context & rules | [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) / `GEMINI.md` / `.agents/rules/*.md` |
| Antigravity needs to remember a new lesson from this session | `/learn` |
| Same task, but conversation context is getting too large | `/compact` |
| Moving to a completely different task | **New Conversation** (`/clear`) |
| Need to think, inspect, and align before coding | `/plan` + `/grill-me` + `prompts/<feature-name>.md` |
| Want to try another approach without touching the main checkout | `invoke_subagent` with `Workspace: "branch"` (or `"share"`) |
| Side task needs full agent capabilities in the background | `invoke_subagent` with `TypeName: "self"` |
| Focused codebase investigation with isolated read-only context | `invoke_subagent` with `TypeName: "research"` |
| Repeatable multi-step engineering workflow | **Skill** (`.agents/skills/<name>/SKILL.md`) |
| Something must happen automatically & deterministically | **Hook** (`.agents/hooks.json`) |
| Hard boundary on what commands/files are allowed or blocked | **Permissions & Terminal Sandbox** (`allow` / `ask` / `deny`) |
| Need external tools (Chrome DevTools, Stitch, Netlify, DBs) | **MCP** (`mcp_config.json` / `call_mcp_tool`) |
| Large migration or multi-unit parallel work | `/teamwork` + isolated subagent workspaces |
| Complex problem needing deep reasoning & verification | `/boost` / High Effort + Pro/Argon model |
| Long-running task that must not stop until complete | `/goal` |
| Keep dev server or long command running in background | `run_command` (`IsDaemon: true`) + `manage_task` |
| Run a recurring check or timer | `/schedule` (`schedule` tool) |
| Ready to ship | Visual Diff $\rightarrow$ Localhost Chrome DevTools $\rightarrow$ CodeRabbit Review $\rightarrow$ User Push Approval |

