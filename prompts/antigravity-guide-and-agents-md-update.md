# Implementation Blueprint: Comprehensive Antigravity Practical Guide & Strategic `AGENTS.md` Integration

## 1. Objective & Scope
The user provided a 53-page **Claude Code Practical Guide** PDF covering CLI/session workflows, slash commands, context management (`/clear`, `/compact`, `/branch`, `/fork`), persistent instructions (`CLAUDE.md` vs Skills vs Hooks vs Permissions vs MCP vs Subagents), permission modes, Plan Mode, Models & Effort, Custom Skills, Subagents, Background Tasks, Git Worktrees, Batch orchestration, Lifecycle Hooks, Keyboard Shortcuts, `@` mentions, Everyday Workflows, and the Quick Decision Mental Model.

The goal is twofold:
1. **Replace the Claude Code Guide with an equivalent Antigravity Practical Guide** (`docs/ANTIGRAVITY_PRACTICAL_GUIDE.md` or inline reference) that translates every single section (01 through 38 + Mental Model + Agentic Engineering) from Claude Code into **Google Antigravity (`agy` CLI, Antigravity IDE, and Antigravity 2.0)** with 1:1 structural fidelity.
2. **Comprehensively and Strategically Update [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md)**: Integrate all the operational rules, customization boundaries, permission controls, context management disciplines, subagent/workspace isolation rules, hook lifecycles, model/effort selection criteria, and decision matrices from the guide directly into [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) **without distorting, deleting, weakening, or breaking the existing 37 sections, logic, or architecture**.

---

## 2. Source of Truth & Architectural Preservation
- **Existing [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) (Sections 1–37)**: Remains 100% intact. Every existing handwritten rule, prompt block, canonical table reference, provider map, verification matrix, and mandatory gate (Prompt Approval Gate, Dev Server Daemon, Chrome DevTools verification, CodeRabbit review, Clickable `file:///` links) is preserved word-for-word in its logical flow.
- **Antigravity Documentation Source of Truth**: Derived from the official built-in [`antigravity-guide`](file:///C:/Users/acer/.gemini/antigravity/builtin/skills/antigravity_guide/SKILL.md) and [`agy-customizations`](file:///C:/Users/acer/.gemini/antigravity/builtin/skills/agy-customizations/SKILL.md) skills:
  - `CLAUDE.md` $\rightarrow$ [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) / `GEMINI.md` / `.agents/rules/*.md`
  - `.claude/skills/<name>/SKILL.md` $\rightarrow$ `.agents/skills/<name>/SKILL.md` (and `~/.gemini/config/skills/`)
  - `.claude/agents/<name>.md` $\rightarrow$ `define_subagent` / `invoke_subagent` (`self`, `research`, `image-generator`, custom subagents) + `manage_subagents`
  - `.claude/worktrees/` (`isolation: worktree`) $\rightarrow$ `invoke_subagent` with `Workspace: "branch"` or `Workspace: "share"`
  - `settings.json` hooks $\rightarrow$ `.agents/hooks.json` (`SessionStart`, `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`)
  - `claude mcp` $\rightarrow$ `mcp_config.json` (`~/.gemini/config/mcp_config.json` or `plugins/<name>/mcp_config.json`), `call_mcp_tool`, and Agent Marketplace
  - `/tasks` & `/background` $\rightarrow$ `run_command` (`WaitMsBeforeAsync`, `IsDaemon: true`) + `manage_task` (`list`, `status`, `send_input`, `kill`) + Scheduled Tasks (`/schedule`)
  - `/batch` & Agent Teams $\rightarrow$ `/teamwork` slash command + parallel `invoke_subagent` calls with `Workspace: "branch"` / `"share"`
  - `/plan`, `/compact`, `/learn`, `/grill-me`, `/boost`, `/goal` $\rightarrow$ Antigravity native slash commands & Planning Mode
  - Permissions (`allow`, `ask`, `deny`) $\rightarrow$ Antigravity Sandbox (`BypassSandbox: false` vs `true`), Tool Execution Policy (`proceed-in-sandbox`, `request-review`, `strict`, `always-proceed`), Permission Grants, and `.env` protection.

---

## 3. Planned Strategic Additions to [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md)

To ensure zero disruption to the existing 37 sections while seamlessly weaving the guide's rules into the operating manual, we will:
1. **Fix any stale workspace path links** in [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) (e.g., updating line 401's `prisma/schema.prisma` link to point to `file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/prisma/schema.prisma`) while keeping all 37 existing sections untouched in meaning and flow.
2. **Append Section 38 through Section 47** directly after Section 37 in [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md), codifying the complete Antigravity Engineering Controls & Practical Guide rules:
   - **Section 38: Antigravity Sessions, CLI (`agy`), and Slash Commands Reference**
     - Interactive vs single-task CLI sessions (`agy`, `agy -p`), resuming sessions, and the core Antigravity slash commands (`/plan`, `/compact`, `/goal`, `/grill-me`, `/teamwork`, `/boost`, `/learn`, `/schedule`, `/browser`, `/help`).
   - **Section 39: Context Hygiene — New Conversation (`/clear`) vs `/compact` vs Branched Subagents (`/branch` & `/fork`)**
     - Strict rules for when to start fresh (unrelated task), when to `/compact` (same problem + large context, preserving schema/migration/architecture state), when to branch/isolate (experimenting safely), and when to fork (`invoke_subagent` with `TypeName: "self"` vs `TypeName: "research"`).
   - **Section 40: Where Instructions & Customizations Must Live (Architecture of Control)**
     - The authoritative mapping table:
       - Always-on project truth $\rightarrow$ [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) / `GEMINI.md`
       - Repeatable multi-step workflow $\rightarrow$ `.agents/skills/<name>/SKILL.md`
       - Deterministic lifecycle enforcement $\rightarrow$ `.agents/hooks.json`
       - Hard access & command boundaries $\rightarrow$ Permissions & Terminal Sandbox
       - One-time request $\rightarrow$ User Prompt & `prompts/<feature-name>.md`
       - External system/service $\rightarrow$ MCP (`mcp_config.json`)
       - Focused context-isolated investigation $\rightarrow$ Subagent (`invoke_subagent`)
       - Filesystem-isolated parallel work $\rightarrow$ Subagent Workspace (`Workspace: "branch"` / `"share"`)
   - **Section 41: Permissions, Terminal Sandbox, and Secret Denylists**
     - Rules governing `allow`, `ask`, and `deny` policies in Antigravity.
     - Safe auto-run commands in Standard Sandbox (`BypassSandbox: false`: `npm test`, `npm run lint`, `npx tsc --noEmit`, `git status`, `git diff`).
     - Explicit `ask` gates (`git push`, `BypassSandbox: true`, destructive SQL/migrations).
     - Strict `deny` rules (never expose or overwrite `.env` / `.env.*` secrets or service-role keys).
     - Permission & Execution Modes: Manual/Strict, Accept Edits, Planning Mode (`/plan`), and Sandbox Auto-Execution.
   - **Section 42: Plan Mode Discipline & High-Leverage Challenge Questions**
     - When Plan Mode (`/plan` + Section 3.2 Prompt Gate) is mandatory (database changes, auth, permissions, architecture, migrations, multi-system features, expensive-to-reverse decisions) and how to challenge plans before writing a single line of code.
   - **Section 43: Model Selection & Reasoning Effort Calibration**
     - Separating **Model** ("which brain you're using": Flash/Lite vs Pro/Argon) from **Effort** ("how hard to think").
     - Matching faster models/lower effort to routine formatting or basic checks, and stronger reasoning models/high effort to architecture, subtle concurrency/state-machine debugging (e.g., `VoiceSessionController`), RLS security reviews, and complex refactors.
   - **Section 44: Custom Skills (`.agents/skills/`), Subagents, Workspace Isolation (`branch`/`share`), and Parallel Batch Work (`/teamwork`)**
     - How to structure reusable project skills in `.agents/skills/<skill-name>/SKILL.md` (Before Implementing, During Implementation, Before Finishing).
     - Context Isolation (Subagents) vs Filesystem Isolation (`Workspace: "branch"` or `"share"`).
     - Rules for `/teamwork` / Batch execution: only split work when units are genuinely separable; never batch tightly coupled architectural features.
     - Background task management (`WaitMsBeforeAsync`, `IsDaemon: true`, `manage_task`, `manage_subagents`).
   - **Section 45: Lifecycle Hooks (`.agents/hooks.json`) & MCP Integrations (`mcp_config.json`)**
     - Deterministic automation via `.agents/hooks.json` (`SessionStart`, `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`) — e.g., auto-formatting on `PostToolUse` and blocking dangerous commands (`rm -rf /`, `DROP DATABASE`, `git push --force`) on `PreToolUse`.
     - MCP server governance (`StitchMCP`, `chrome-devtools-mcp`, `netlify`, etc.) and `@` mention precision (`@file`, `@folder`, `@rule`, `@mcp`).
   - **Section 46: The 15-Step Practical Everyday Antigravity Workflow**
     - End-to-end daily operational checklist harmonizing the guide's 15 steps with VicCalary's Section 3 workflow (`ANALYZE → PLAN → MODIFY → VERIFY → SUMMARIZE`).
   - **Section 47: Quick Decision Matrix & Core Mental Model**
     - The complete "Problem $\rightarrow$ Antigravity Control" lookup table so every agent and developer immediately selects the right mechanism for the job.
3. **Create Standalone Companion Reference [`docs/ANTIGRAVITY_PRACTICAL_GUIDE.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/docs/ANTIGRAVITY_PRACTICAL_GUIDE.md)**:
   - A clean, standalone, page-by-page Antigravity replacement of the 53-page Claude Code Practical Guide for quick human reading, linked directly from [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md).

---

## 4. Verification & Acceptance Criteria
- Verify that Sections 1–37 of [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) retain 100% of their original rules, prompts, architecture constraints, and guardrails without distortion.
- Verify that every single concept from the 53-page guide is accurately translated to Antigravity's real architecture and integrated into Sections 38–47 of [`AGENTS.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/AGENTS.md) and [`docs/ANTIGRAVITY_PRACTICAL_GUIDE.md`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/docs/ANTIGRAVITY_PRACTICAL_GUIDE.md).
- Verify all file references use clickable `file:///` Markdown links.

