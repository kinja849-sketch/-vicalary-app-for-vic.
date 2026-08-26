# Implementation Prompt: Phase 2 — Tavily AI Web Search Integration & Agent Tool Calling

## 1. Objective & Requirements
- Integrate **Tavily AI Search API** into `lib/services/ai/ToolRouter.ts` for fast, accurate web and news searches (<400ms).
- Add `TAVILY_API_KEY` configuration support with automatic fallback to DuckDuckGo/general knowledge when the key is not set.
- Enhance tool routing to automatically trigger live web lookups whenever user queries require current world events, news, nutritional research, or live facts.
- Expose search findings to `ConversationOrchestrator.ts` so the AI assistant (both in text chat and voice mode) synthesizes factual contemporary answers.

---

## 2. Proposed Changes

### 1. `the-app-belong-to-vic--main/lib/services/ai/ToolRouter.ts`
- Implement `executeTavilySearch(query: string, apiKey: string)`:
  - Calls `POST https://api.tavily.com/search` with `search_depth: "basic"`, `include_answer: true`, `max_results: 3`.
  - Parses synthesized answer and top search results.
- Update `executeWebSearch(query: string)`:
  - Checks for `process.env.TAVILY_API_KEY`.
  - Executes Tavily search when key is available; falls back to DuckDuckGo if missing or on error.

### 2. `the-app-belong-to-vic--main/.env.example`
- Add `TAVILY_API_KEY=your-tavily-api-key` documentation.

---

## 3. Verification Plan

### Automated Checks
- `npm.cmd run typecheck` $\to$ must pass with 0 errors.

### Localhost Verification Steps
1. In text or voice chat, ask:
   - *"What is the latest world news today?"*
   - *"What is the latest research on high-protein diets and longevity?"*
2. Verify in terminal logs that `[ToolRouter]` executes Tavily search (or fallback) without errors.
3. Verify that Vee provides an accurate, informative answer citing contemporary facts.
