# Implementation Blueprint: AI Provider Resilience (permanent fix for "AI vision service is temporarily unavailable")

## 1. Diagnosis (verified live on 2026-11-19)
| Provider | Result |
|---|---|
| OpenAI (`gpt-4o`, `gpt-4o-mini`) | HTTP 429 `credit_balance_exhausted` — no credits. Dead until billing is added. |
| Gemini `gemini-3-flash-preview` | Works (vision OK) but slow (~6s idle) and frequently HTTP 503 "high demand" (preview model). |
| Gemini `gemini-2.5-flash` | Works now (~2s). Free tier = 20 requests/day/model; it was exhausted yesterday (429), reset since. |
| Gemini `gemini-flash-latest` | Slow/hangs; 503 under load. |
| `gemini-2.5-flash-lite`, `gemini-2.0-*`, `gemini-1.5-*`, `gemini-2.5-pro` | 404 — removed for this key. |

Server logs show the actual failure chain:
1. OpenAI circuit open (no credits) → all traffic goes to Gemini.
2. `analyze-food-image` creates ONE `AbortController` with a 15s deadline for the *whole* fallback loop in `lib/ai/ai-fallback.ts`.
3. First model (`gemini-3-flash-preview`, preview, slow/503) consumes the budget → the signal aborts → every remaining model is skipped ("Request aborted by caller") → route returns 503 `ai_unavailable`.
4. A blank/ambiguous image additionally triggers a second vision retry, then synthesis → worst case exceeds budgets.

Root causes: (a) no paid/healthy primary, (b) single shared deadline across sequential fallbacks (the fallbacks never get a chance), (c) preview model ordered first, (d) free-tier daily quota with no awareness, (e) per-model failures not remembered, so every request re-pays the failures, (f) no health visibility.

## 2. Design (no UI change; server only)
### A. Per-attempt deadlines, overall budget
In `lib/ai/ai-fallback.ts`:
- Each model attempt gets its own timeout (`attemptTimeoutMs`, default 12s vision / 8s text) combined with the caller signal; an attempt timeout moves on to the next model instead of ending the call.
- Add `overallBudgetMs` (route passes ~35s); loop stops only when budget is spent or caller signal aborts.
- Route stops using a short global abort for vision; uses the budget instead.

### B. Per-model circuit breaker with cool-down
- In-memory map `modelHealth[model] = { openUntil, reason }`.
- 429 quota → open for 30 min (or parse `retryDelay` when ≤ 1h; for daily quota keep open until next hour check); 404 → open 24h; 503/timeout → open 60s; success resets.
- Skip open models up front so later requests don't re-pay failures. If *all* are open, try the least-recently-failed one anyway (half-open).

### C. Model order by measured reliability
- Order: `BACKUP_AI_MODEL` (if set) → `gemini-2.5-flash` (stable, ~2s) → `gemini-3.1-flash-lite` (~1.8s, verified vision OK) → `gemini-3-flash-preview` (slow/503-prone) → `gemini-flash-latest` (hung >40s in test; last resort). `gemini-3.5-flash` also hung >40s → excluded.
- Remove dead models; model list configurable via `AI_FALLBACK_MODELS` env (comma-separated) so removals never require a code change.
- Retry transient 503 once with short backoff (500ms) before moving on.

### D. Second provider independence
- Support an optional second Gemini key (`GEMINI_API_KEY_2`) and keep OpenAI as primary when funded. Quota is per project/key, so this doubles headroom. (User action required: add billing/credits — see §5.)

### E. Route-level hardening (`analyze-food-image`)
- Skip the retry vision call when the first response parsed but returned zero foods due to "no food" (avoid doubling latency); retry only on parse failure.
- Synthesis stays best-effort with deterministic fallback narratives (nutrition numbers remain deterministic).
- Vision failure remains a typed `503 ai_unavailable` (never fabricated food data) but now carries `retry_after_seconds`.
- Client (`lib/api/food.ts`) shows the clear message and auto-retries once after 3s on `ai_unavailable`.

### F. Health diagnostics
- New `GET /api/ai-health` (auth-free, no secrets): returns per-provider/model state from the circuit map plus an optional `?probe=1` live 1-token test. Used for verification and future debugging.
- Structured log line per request: model used, attempts, latency.

## 3. Acceptance criteria
1. With OpenAI exhausted and `gemini-3-flash-preview` returning 503/slow, a food photo still completes on `gemini-2.5-flash` within ~10s.
2. With `gemini-2.5-flash` quota-exhausted, request succeeds on next model; subsequent requests skip the exhausted model immediately (verified in logs).
3. When all providers are down: typed 503 `ai_unavailable`, no crash, UI toast message.
4. `/api/ai-health?probe=1` shows live status for all models.
5. `npm run typecheck` clean; Chrome DevTools: camera analysis end-to-end on localhost with zero console errors.

## 4. Files
`lib/ai/ai-fallback.ts`, `app/api/analyze-food-image/route.ts`, `lib/api/food.ts`, new `app/api/ai-health/route.ts`, `.env.example` (new vars documented). No UI/layout changes.

## 5. What code cannot fix (needs user action)
- OpenAI has **zero credits** → add billing at platform.openai.com, or leave it off.
- Gemini **free tier** (20 req/day/model) will be exhausted again by normal usage → enable billing on the Google AI Studio project for production-grade reliability. Without this, "never again" cannot be guaranteed by software alone.
