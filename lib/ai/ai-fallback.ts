/**
 * VicCalary High-Resilience AI Engine & Failover Handler
 * 
 * Provides automated, zero-downtime failover between primary AI (OpenAI)
 * and the backup AI provider (Google Gemini via OpenAI-compatible endpoints).
 * 
 * Fallbacks trigger automatically on:
 * - Missing or placeholder primary key
 * - HTTP 429 (Rate Limits / Insufficient Quota)
 * - HTTP 5xx (Upstream service outages)
 * - Network timeouts or connection resets
 */

export interface AIMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIMessageContentPart[];
}

export interface AIChatRequest {
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' | 'text' };
  frequency_penalty?: number;
  presence_penalty?: number;
  signal?: AbortSignal;
}

export interface AIChatChoice {
  index?: number;
  message: {
    role: string;
    content: string | null;
  };
  finish_reason?: string;
}

export interface AIChatResponse {
  id?: string;
  choices: AIChatChoice[];
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  providerUsed: 'primary' | 'backup';
}

const PRIMARY_OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const BACKUP_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// In-memory circuit breaker: If OpenAI hits rate-limit/quota exhaustion (429),
// bypass OpenAI immediately for 10 minutes to deliver sub-second response times.
let openAICircuitOpenUntil = 0;

export function isOpenAIAvailable(): boolean {
  return Date.now() >= openAICircuitOpenUntil;
}

export function tripOpenAICircuit(durationMs = 10 * 60 * 1000): void {
  openAICircuitOpenUntil = Date.now() + durationMs;
  console.warn(`[AI Engine Circuit Breaker] Tripped until ${new Date(openAICircuitOpenUntil).toLocaleTimeString()}. Directly routing all subsequent calls to backup provider.`);
}

export function resetOpenAICircuit(): void {
  openAICircuitOpenUntil = 0;
}

// In-memory circuit breaker for Gemini Preview TTS:
// If preview TTS models hit quota exhaustion (limit 10/day on free tier),
// bypass dead models immediately for 60 minutes to eliminate 15-second latency overhead.
let geminiTtsCircuitOpenUntil = 0;

export function isGeminiTtsAvailable(): boolean {
  return Date.now() >= geminiTtsCircuitOpenUntil;
}

export function tripGeminiTtsCircuit(durationMs = 60 * 60 * 1000): void {
  geminiTtsCircuitOpenUntil = Date.now() + durationMs;
  console.warn(`[AI Engine TTS Circuit Breaker] Tripped until ${new Date(geminiTtsCircuitOpenUntil).toLocaleTimeString()}. Directly routing voice synthesis to resilient natural speech engine.`);
}

/**
 * Returns primary OpenAI API key
 */
export function getPrimaryApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!key || key.startsWith('your-') || key.startsWith('sk-your') || key.includes('placeholder')) {
    return null;
  }
  return key.trim();
}

/**
 * Returns backup AI API key (Gemini / Backup key)
 */
export function getBackupApiKey(): string | null {
  const key =
    process.env.BACKUP_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.BACKUP_OPENAI_API_KEY;
  if (!key || key.startsWith('your-') || key.includes('placeholder')) {
    return null;
  }
  return key.trim();
}

/**
 * Maps model name to backup-compatible model
 */
export function mapModelForBackup(model?: string): string {
  const configuredBackup = process.env.BACKUP_AI_MODEL;
  if (configuredBackup && configuredBackup !== 'gemini-2.5-flash' && configuredBackup !== 'gemini-3.8-flash') return configuredBackup;

  if (model && model.startsWith('gemini-') && model !== 'gemini-2.5-flash' && model !== 'gemini-3.8-flash') return model;

  // Prioritize high-performance, responsive Gemini 3.1 Flash Lite
  return 'gemini-3.1-flash-lite';
}

/**
 * Sanitizes request payload for backup provider
 */
function preparePayload(request: AIChatRequest, isBackup: boolean) {
  const payload: any = {
    messages: request.messages,
    stream: request.stream ?? false,
  };

  if (isBackup) {
    payload.model = mapModelForBackup(request.model);
  } else {
    payload.model = request.model || process.env.OPENAI_MODEL || 'gpt-4o';
  }

  if (request.temperature !== undefined) payload.temperature = request.temperature;
  if (request.max_tokens !== undefined) payload.max_tokens = request.max_tokens;
  if (request.response_format) payload.response_format = request.response_format;
  if (!isBackup) {
    if (request.frequency_penalty !== undefined) payload.frequency_penalty = request.frequency_penalty;
    if (request.presence_penalty !== undefined) payload.presence_penalty = request.presence_penalty;
  }

  return payload;
}

/**
 * Executes a Chat Completion with transparent automated fallback
 */
export async function callChatCompletionWithFallback(
  request: AIChatRequest
): Promise<AIChatResponse> {
  const primaryKey = getPrimaryApiKey();
  const backupKey = getBackupApiKey();

  if (!primaryKey && !backupKey) {
    throw new Error('[AI Engine] No valid AI API key found (neither OPENAI_API_KEY nor BACKUP_AI_API_KEY is configured).');
  }

  // 1. Try Primary Provider (OpenAI) if key is present and circuit is closed
  if (primaryKey && isOpenAIAvailable()) {
    try {
      const primaryPayload = preparePayload(request, false);
      const res = await fetch(PRIMARY_OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${primaryKey}`,
        },
        body: JSON.stringify(primaryPayload),
        signal: request.signal,
      });

      if (res.ok) {
        const data = await res.json();
        return {
          ...data,
          providerUsed: 'primary',
        };
      }

      // If primary returned an error, capture details for fallback
      const errorText = await res.text();
      console.warn(`[AI Engine] Primary OpenAI failed (HTTP ${res.status}): ${errorText.substring(0, 300)}. Triggering failover to backup provider...`);
      if (res.status === 429 || res.status === 402 || errorText.includes('insufficient_quota') || errorText.includes('billing')) {
        tripOpenAICircuit();
      }
    } catch (err: any) {
      console.warn(`[AI Engine] Primary OpenAI exception: ${err?.message || err}. Triggering failover to backup provider...`);
    }
  } else if (!isOpenAIAvailable()) {
    console.info('[AI Engine] Primary OpenAI circuit open (bypassing dead round-trip). Directing straight to backup provider.');
  } else {
    console.info('[AI Engine] Primary OPENAI_API_KEY not configured or placeholder. Directing straight to backup provider.');
  }

  // 2. Try Backup Provider (Gemini OpenAI-compatible endpoint)
  if (!backupKey) {
    throw new Error('[AI Engine] Primary AI call failed and no BACKUP_AI_API_KEY is configured.');
  }

  const fallbackModels = Array.from(new Set([
    mapModelForBackup(request.model),
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.7-flash',
  ]));

  let lastBackupErr = '';

  for (const m of fallbackModels) {
    try {
      const backupPayload = {
        ...preparePayload(request, true),
        model: m,
      };
      console.info(`[AI Fallback] Executing request on backup provider with model: ${m}`);

      const backupRes = await fetch(BACKUP_GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backupKey}`,
        },
        body: JSON.stringify(backupPayload),
        signal: request.signal,
      });

      if (backupRes.ok) {
        const backupData = await backupRes.json();
        return {
          ...backupData,
          providerUsed: 'backup',
        };
      }

      lastBackupErr = await backupRes.text();
      console.warn(`[AI Fallback] Backup model ${m} returned HTTP ${backupRes.status}: ${lastBackupErr.substring(0, 150)}`);
    } catch (e: any) {
      lastBackupErr = e?.message || String(e);
      console.warn(`[AI Fallback] Backup model ${m} exception:`, lastBackupErr);
    }
  }

  console.error(`[AI Fallback] All backup models failed: ${lastBackupErr}`);
  throw new Error(`AI Request failed on both primary and backup providers. Backup error: ${lastBackupErr}`);
}

/**
 * Streams a Chat Completion with automated pre-flight failover
 */
export async function streamChatCompletionWithFallback(
  request: AIChatRequest
): Promise<{ response: Response; providerUsed: 'primary' | 'backup' }> {
  const primaryKey = getPrimaryApiKey();
  const backupKey = getBackupApiKey();

  if (!primaryKey && !backupKey) {
    throw new Error('[AI Engine] No valid AI API key found for streaming (neither OPENAI_API_KEY nor BACKUP_AI_API_KEY is configured).');
  }

  const streamingRequest: AIChatRequest = {
    ...request,
    stream: true,
  };

  // 1. Try Primary Provider (OpenAI) if key is present and circuit is closed
  if (primaryKey && isOpenAIAvailable()) {
    try {
      const primaryPayload = preparePayload(streamingRequest, false);
      const res = await fetch(PRIMARY_OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${primaryKey}`,
        },
        body: JSON.stringify(primaryPayload),
        signal: request.signal,
      });

      if (res.ok && res.body) {
        return { response: res, providerUsed: 'primary' };
      }

      const errText = await res.text();
      console.warn(`[AI Engine] Primary OpenAI stream failed (HTTP ${res.status}): ${errText.substring(0, 300)}. Triggering stream failover to backup provider...`);
      if (res.status === 429 || res.status === 402 || errText.includes('insufficient_quota') || errText.includes('billing')) {
        tripOpenAICircuit();
      }
    } catch (err: any) {
      console.warn(`[AI Engine] Primary OpenAI stream exception: ${err?.message || err}. Triggering stream failover to backup provider...`);
    }
  } else if (!isOpenAIAvailable()) {
    console.info('[AI Engine] Primary OpenAI stream circuit open (bypassing dead round-trip). Directing stream directly to backup provider.');
  }

  // 2. Try Backup Provider (Gemini)
  if (!backupKey) {
    throw new Error('[AI Engine] Primary stream failed and no BACKUP_AI_API_KEY is configured.');
  }

  const fallbackModels = Array.from(new Set([
    mapModelForBackup(request.model),
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ]));

  let lastBackupErr = '';

  for (const m of fallbackModels) {
    try {
      const backupPayload = {
        ...preparePayload(streamingRequest, true),
        model: m,
      };
      console.info(`[AI Fallback] Executing stream on backup provider with model: ${m}`);

      const backupRes = await fetch(BACKUP_GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${backupKey}`,
        },
        body: JSON.stringify(backupPayload),
        signal: request.signal,
      });

      if (backupRes.ok && backupRes.body) {
        return { response: backupRes, providerUsed: 'backup' };
      }

      lastBackupErr = await backupRes.text();
      console.warn(`[AI Fallback] Backup stream model ${m} returned HTTP ${backupRes.status}: ${lastBackupErr.substring(0, 150)}`);
    } catch (e: any) {
      lastBackupErr = e?.message || String(e);
      console.warn(`[AI Fallback] Backup stream model ${m} exception:`, lastBackupErr);
    }
  }

  console.warn(`[AI Fallback] Direct streaming failed (${lastBackupErr.substring(0, 100)}). Falling back to robust synchronous chat completion...`);
  try {
    const nonStreamResult = await callChatCompletionWithFallback({
      ...request,
      stream: false,
    });
    const content = nonStreamResult.choices?.[0]?.message?.content || '';
    if (content) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const chunk = {
            choices: [{ delta: { content } }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
      return {
        response: new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }),
        providerUsed: 'backup',
      };
    }
  } catch (syncErr: any) {
    console.error('[AI Fallback] Synchronous fallback also failed:', syncErr?.message || syncErr);
  }

  console.error(`[AI Fallback] All backup stream models failed: ${lastBackupErr}`);
  throw new Error(`AI Streaming failed on both primary and backup providers. Backup error: ${lastBackupErr}`);
}

/**
 * Helper to get clean text from a chat completion with fallback
 */
export async function getAICompletionText(request: AIChatRequest): Promise<string> {
  const result = await callChatCompletionWithFallback(request);
  const text = result.choices?.[0]?.message?.content || '';
  return text.trim();
}

/**
 * Helper to get parsed JSON from a chat completion with fallback
 */
export async function getAICompletionJson<T = any>(request: AIChatRequest): Promise<T> {
  const result = await callChatCompletionWithFallback({
    ...request,
    response_format: { type: 'json_object' },
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('[AI Engine] Received empty response content from AI provider.');
  }

  try {
    return JSON.parse(content) as T;
  } catch (err) {
    // If wrapped in markdown code blocks like ```json ... ```, strip and reparse
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as T;
  }
}

/**
 * Builds a standard 44-byte RIFF/WAVE header around raw PCM audio samples
 */
export function pcmToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const subChunk2Size = pcmBuffer.length;
  const chunkSize = 36 + subChunk2Size;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(subChunk2Size, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export interface VoiceAudioResult {
  buffer: Buffer;
  audioBase64: string;
  dataUri: string;
  mimeType: string;
  provider: 'primary' | 'backup';
}

/**
 * Synthesizes speech with automated fallback to Google Gemini TTS (backup AI key)
 * when OpenAI quota is exhausted (429) or unavailable.
 */
export async function synthesizeVoiceAudioWithFallback(
  text: string,
  options?: { voice?: string; speed?: number }
): Promise<VoiceAudioResult | null> {
  const cleanText = text
    .replace(/[*_#`~]/g, '') // strip markdown
    .trim()
    .slice(0, 1500);

  if (!cleanText) return null;

  const primaryKey = getPrimaryApiKey();
  const backupKey = getBackupApiKey();

  // 1. Try Primary Provider (OpenAI TTS) if key is present and circuit is closed
  if (primaryKey && isOpenAIAvailable()) {
    try {
      const selectedVoice = options?.voice || 'nova';
      const speed = Math.max(0.5, Math.min(options?.speed || 1.05, 2.0));

      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${primaryKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: selectedVoice,
          input: cleanText,
          speed,
        }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const base64 = buffer.toString('base64');
        return {
          buffer,
          audioBase64: base64,
          dataUri: `data:audio/mp3;base64,${base64}`,
          mimeType: 'audio/mpeg',
          provider: 'primary',
        };
      }

      const errText = await res.text();
      console.warn(`[AI Engine] Primary OpenAI TTS failed (HTTP ${res.status}): ${errText.substring(0, 200)}. Failing over to backup TTS...`);
      if (res.status === 429 || res.status === 402 || errText.includes('insufficient_quota') || errText.includes('billing')) {
        tripOpenAICircuit();
      }
    } catch (e: any) {
      console.warn(`[AI Engine] Primary OpenAI TTS exception: ${e?.message || e}. Failing over to backup TTS...`);
    }
  } else if (!isOpenAIAvailable()) {
    console.info('[AI Engine] Primary OpenAI TTS circuit open (bypassing dead round-trip). Directing TTS straight to backup provider.');
  }

  // 2. Try Backup Provider (Gemini 3.8 Flash Human Neural TTS)
  if (!backupKey) {
    console.error('[AI Engine] Backup TTS failed: No BACKUP_AI_API_KEY configured.');
    return null;
  }

  if (!isGeminiTtsAvailable()) {
    console.info('[AI Engine] Gemini TTS circuit open (quota exhausted). Directing voice straight to resilient natural speech engine.');
  } else {
    const ttsModels = [
      'gemini-3.1-flash-tts-preview',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
      'gemini-2.5-flash-preview-tts',
      'gemini-2.5-pro-preview-tts',
    ];

    for (const ttsModel of ttsModels) {
      try {
        console.info(`[AI Fallback] Synthesizing natural human voice via ${ttsModel} (voice: Aoede)...`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${backupKey}`;

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: cleanText }], // Pass clean text directly without any "Read aloud" prefix
              },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede', // Natural, calm, articulate, conversational woman's voice like ChatGPT
                  },
                },
              },
            },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[AI Fallback] ${ttsModel} returned HTTP ${res.status}: ${errText.substring(0, 150)}`);
          if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('quota')) {
            tripGeminiTtsCircuit();
            break; // Stop immediately since all Gemini TTS preview models share the same daily quota
          }
          continue;
        }

      const json = await res.json();
      const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const rawAudioBase64 = inlineData?.data;
      if (!rawAudioBase64) {
        console.warn(`[AI Fallback] ${ttsModel} returned empty inlineData.`);
        continue;
      }

      const inlineMime = (inlineData?.mimeType || 'audio/wav').toLowerCase();
      const rawBuffer = Buffer.from(rawAudioBase64, 'base64');
      let wavBuffer: Buffer;
      let wavBase64: string;

      if (inlineMime.includes('wav')) {
        wavBuffer = rawBuffer;
        wavBase64 = rawAudioBase64;
      } else {
        wavBuffer = pcmToWavBuffer(rawBuffer, 24000, 1, 16);
        wavBase64 = wavBuffer.toString('base64');
      }

      return {
        buffer: wavBuffer,
        audioBase64: wavBase64,
        dataUri: `data:audio/wav;base64,${wavBase64}`,
        mimeType: 'audio/wav',
        provider: 'backup',
      };
    } catch (err: any) {
      console.warn(`[AI Fallback] ${ttsModel} exception:`, err?.message || err);
    }
  }
}

  console.error('[AI Fallback] All neural TTS models failed.');
  return null;
}


