import { NextRequest, NextResponse } from 'next/server';
import {
  getBackupApiKey,
  getPrimaryApiKey,
  getModelHealthSnapshot,
  isOpenAIAvailable,
  callChatCompletionWithFallback,
} from '@/lib/ai/ai-fallback';

export const dynamic = 'force-dynamic';

/**
 * AI provider diagnostics. Never returns secrets.
 *   GET /api/ai-health          → configured providers + in-memory circuit state
 *   GET /api/ai-health?probe=1  → also runs one tiny live completion through the fallback chain
 */
export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get('probe') === '1';

  const body: Record<string, any> = {
    primary_openai: {
      configured: Boolean(getPrimaryApiKey()),
      circuit_open: !isOpenAIAvailable(),
    },
    backup_gemini: {
      configured: Boolean(getBackupApiKey()),
      models: getModelHealthSnapshot(),
    },
  };

  if (probe) {
    const started = Date.now();
    try {
      const r = await callChatCompletionWithFallback({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 16,
        attemptTimeoutMs: 8000,
        budgetMs: 20000,
      });
      body.probe = { ok: true, provider: r.providerUsed, model: r.model, latency_ms: Date.now() - started };
    } catch (e: any) {
      body.probe = { ok: false, latency_ms: Date.now() - started, error: String(e?.message || e).slice(0, 200) };
    }
    body.backup_gemini.models = getModelHealthSnapshot();
    body.primary_openai.circuit_open = !isOpenAIAvailable();
  }

  return NextResponse.json(body);
}
