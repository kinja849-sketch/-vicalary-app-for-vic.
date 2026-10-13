/**
 * Shared voice-dialogue engine for Chef (RecipeDetails) and Health Coach (AICoachVoiceModal).
 *
 * Logic only - no JSX, no styling. Both surfaces use the same:
 *  - TurnSession          : one active turn, one AbortController, single-flight
 *  - SequentialSpeechPlayer: ordered chunk playback, prefetch, retry-once, text-only on failure,
 *                           playback-synced progressive text, hard stop (barge-in)
 *  - SpeechListener       : Web Speech wrapper with tight commit window, echo-safe barge-in,
 *                           generation guard (no stale handlers), restart backoff (no loops)
 *  - helpers              : sentence chunking (never truncates), stub filter, echo guard
 *
 * Voice identity is NOT chosen here: audio always comes from the server TTS routes, which lock
 * OpenAI `nova` -> Gemini `Aoede` (DEFAULT_COACH_VOICE).
 */

export type VoiceTurnState = 'idle' | 'listening' | 'processing' | 'speaking';

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const SENTENCE_RE = /[^.!?\u2026\u3002\uFF01\uFF1F\n]+(?:[.!?\u2026\u3002\uFF01\uFF1F]+["')\]]*|\n+|$)/g;

/**
 * Splits a reply into speakable chunks. NEVER drops or truncates text:
 * `chunks.join(' ')` always contains every word of the input.
 * The first chunk is kept short so audio can start early; later chunks are merged to reduce TTS calls.
 */
export function splitIntoSpeechChunks(
  text: string,
  opts: { firstMin?: number; laterMin?: number; max?: number } = {}
): string[] {
  const firstMin = opts.firstMin ?? 24;
  const laterMin = opts.laterMin ?? 70;
  const max = opts.max ?? 320;

  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = (clean.match(SENTENCE_RE) || [clean]).map(s => s.trim()).filter(Boolean);

  // Break any overlong sentence on spaces (no truncation).
  const pieces: string[] = [];
  for (const s of sentences) {
    if (s.length <= max) {
      pieces.push(s);
      continue;
    }
    let rest = s;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(', ', max);
      if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
      if (cut <= 0) cut = max;
      pieces.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) pieces.push(rest);
  }

  const chunks: string[] = [];
  let buf = '';
  for (const p of pieces) {
    buf = buf ? `${buf} ${p}` : p;
    const min = chunks.length === 0 ? firstMin : laterMin;
    if (buf.length >= min) {
      chunks.push(buf);
      buf = '';
    }
  }
  if (buf) {
    if (chunks.length > 0 && buf.length < 20 && chunks[chunks.length - 1].length + buf.length + 1 <= max) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${buf}`;
    } else {
      chunks.push(buf);
    }
  }
  return chunks;
}

/** Whisper/STT silence hallucinations and non-speech stubs. A real short answer like "ok" is kept. */
export function isLikelyTranscriptStub(raw: string | null | undefined): boolean {
  const t = (raw || '').trim();
  if (!t) return true;
  const letters = t.replace(/[^\p{L}\p{N}]/gu, '');
  if (letters.length < 2) return true;
  if (/^[\[(].*[\])]$/.test(t)) return true; // [music], (silence)
  const lower = t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const stubs = new Set([
    'thank you', 'thanks', 'thank you for watching', 'thanks for watching', 'you', 'bye', 'bye bye',
    'subtitles by the amaraorg community', 'please subscribe', 'like and subscribe',
  ]);
  return stubs.has(lower);
}

export function normalizeWords(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Words the user said that are NOT part of what the assistant is currently speaking (speaker echo guard). */
export function nonEchoWords(heard: string, spoken: string): string[] {
  const spokenSet = new Set(normalizeWords(spoken));
  return normalizeWords(heard).filter(w => !spokenSet.has(w));
}

/**
 * Detects whether heard speech is speaker echo from the assistant or a genuine user barge-in.
 * Speaker echo typically has high token overlap (>= 55%) with what the assistant is speaking,
 * even with slight acoustic variations (digits, homophones, punctuation, split words).
 * Genuine barge-in introduces distinct user intent ("wait", "stop", "next", "how much", etc.).
 */
export function isEchoOfAssistant(heard: string, spoken: string): boolean {
  const heardWords = normalizeWords(heard);
  if (heardWords.length === 0) return true; // silence / empty is treated as echo
  const spokenWords = normalizeWords(spoken);
  if (spokenWords.length === 0) return false;

  const spokenSet = new Set(spokenWords);
  const matchingWords = heardWords.filter(w => spokenSet.has(w));
  const matchRatio = matchingWords.length / heardWords.length;

  // 1. If more than half (>= 55%) of the heard words are in the assistant's sentence, it is an echo
  if (matchRatio >= 0.55) {
    return true;
  }

  // 2. Common command barge-ins (e.g. 'next', 'next step', 'stop', 'wait', 'repeat')
  const firstWord = heardWords[0];
  const commandWords = new Set(['stop', 'pause', 'wait', 'next', 'repeat', 'back', 'cancel', 'no', 'yes']);
  if (commandWords.has(firstWord) && !spokenSet.has(firstWord)) {
    return false;
  }

  // 3. Any utterance with 3 or more real words not in the assistant's sentence is a genuine user question/statement
  const nonEcho = heardWords.filter(w => !spokenSet.has(w));
  if (nonEcho.length >= 3) {
    return false;
  }

  // 4. Need at least 2 distinct non-echo words to be considered user speech (filters out 1-word audio glitches)
  return nonEcho.length < 2;
}

export function backoffMs(failures: number, base = 400, cap = 5000): number {
  return Math.min(cap, base * Math.pow(2, Math.max(0, failures - 1)));
}

/* ------------------------------------------------------------------ */
/* TurnSession: one active turn, one AbortController                   */
/* ------------------------------------------------------------------ */

export interface TurnHandle {
  id: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
}

export class TurnSession {
  private ctl: AbortController | null = null;
  private seq = 0;

  /** Starts a new turn and aborts every in-flight request of the previous one. */
  begin(): TurnHandle {
    if (this.ctl) {
      try { this.ctl.abort(); } catch {}
    }
    const ctl = new AbortController();
    this.ctl = ctl;
    const id = ++this.seq;
    return { id, signal: ctl.signal, isCurrent: () => this.seq === id && !ctl.signal.aborted };
  }

  cancel(): void {
    if (this.ctl) {
      try { this.ctl.abort(); } catch {}
      this.ctl = null;
    }
    this.seq++;
  }

  get activeId(): number {
    return this.seq;
  }
}

/* ------------------------------------------------------------------ */
/* SequentialSpeechPlayer                                              */
/* ------------------------------------------------------------------ */

export interface SpeechItem {
  text: string;
  /** Ready audio source (data URI / blob URL). */
  src?: string;
  /** Lazily fetched audio source; started immediately on enqueue so the next chunk prefetches while the current plays. */
  fetchSrc?: (signal: AbortSignal) => Promise<string | null>;
}

export type SpeechEndReason = 'completed' | 'interrupted' | 'text_only';

export interface SpeechEndResult {
  reason: SpeechEndReason;
  /** Text of chunks that were fully spoken or revealed. Interrupted chunk is only included up to what was revealed. */
  deliveredText: string;
  /** Subset of deliveredText that had no audio (TTS failed after retry). */
  textOnlyText: string;
  /** True when at least one chunk was heard. */
  anyAudio: boolean;
}

export interface SpeechPlayerCallbacks {
  /** First time anything for this reply becomes visible/audible. textOnly=true when TTS failed for that chunk. */
  onFirstChunk?: (info: { textOnly: boolean }) => void;
  /** Progressive text, monotonic within a reply, aligned to playback position. */
  onProgress?: (revealed: string) => void;
  onChunkTextOnly?: (item: SpeechItem, index: number) => void;
  onAudioElement?: (audio: HTMLAudioElement) => void;
  onEnd?: (result: SpeechEndResult) => void;
}

interface Entry {
  item: SpeechItem;
  srcPromise: Promise<string | null>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

export class SequentialSpeechPlayer {
  private queue: Entry[] = [];
  private audio: HTMLAudioElement | null = null;
  private running = false;
  private noMoreItems = false;
  private stopped = false;
  private finished = false;
  private wake: (() => void) | null = null;
  private cancelCurrent: (() => void) | null = null;
  private controller = new AbortController();
  private delivered: string[] = [];
  private textOnly: string[] = [];
  private anyAudio = false;
  private firstFired = false;
  private index = 0;
  private revealedPrefix = '';
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private currentChunkText = '';
  private currentChunkRevealed = '';

  constructor(private cb: SpeechPlayerCallbacks = {}) {}

  get isActive(): boolean {
    return !this.finished && !this.stopped;
  }

  get currentAudio(): HTMLAudioElement | null {
    return this.audio;
  }

  /** Everything queued so far (used by the echo guard to know what the assistant is saying). */
  get queuedText(): string {
    return this.allTexts.join(' ');
  }
  private allTexts: string[] = [];

  enqueue(item: SpeechItem): void {
    if (this.stopped || this.finished || this.noMoreItems) return;
    if (!item.text || !item.text.trim()) return;
    this.allTexts.push(item.text);
    const srcPromise = this.resolveSrc(item);
    this.queue.push({ item, srcPromise });
    this.poke();
    void this.pump();
  }

  /** Signals that no more chunks will be enqueued. */
  end(): void {
    this.noMoreItems = true;
    this.poke();
    void this.pump();
  }

  /** Hard stop (barge-in / cleanup): aborts in-flight fetches, stops audio now, finishes as 'interrupted'. */
  stop(): void {
    if (this.stopped || this.finished) return;
    this.stopped = true;
    try { this.controller.abort(); } catch {}
    this.clearProgress();
    if (this.audio) {
      try { this.audio.pause(); } catch {}
    }
    if (this.cancelCurrent) this.cancelCurrent();
    // Partial reveal of the interrupted chunk counts as delivered text only up to what was shown.
    if (this.currentChunkRevealed) {
      this.delivered.push(this.currentChunkRevealed);
      this.currentChunkRevealed = '';
    }
    this.poke();
    this.finish('interrupted');
  }

  private poke() {
    if (this.wake) {
      const w = this.wake;
      this.wake = null;
      w();
    }
  }

  private async resolveSrc(item: SpeechItem): Promise<string | null> {
    if (item.src) return item.src;
    if (!item.fetchSrc) return null;
    const signal = this.controller.signal;
    // One attempt + exactly one retry (explicit failure handling, never a loop).
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) return null;
      try {
        const src = await item.fetchSrc(signal);
        if (src) return src;
      } catch (e: any) {
        if (e?.name === 'AbortError' || signal.aborted) return null;
      }
      if (attempt === 0) await sleep(150);
    }
    return null;
  }

  private async pump(): Promise<void> {
    if (this.running || this.finished) return;
    this.running = true;
    try {
      while (!this.stopped) {
        const entry = this.queue.shift();
        if (!entry) {
          if (this.noMoreItems) break;
          await new Promise<void>(res => { this.wake = res; });
          continue;
        }
        await this.playEntry(entry);
      }
    } finally {
      this.running = false;
    }
    if (!this.stopped && !this.finished) {
      const reason: SpeechEndReason = this.anyAudio ? 'completed' : 'text_only';
      this.finish(this.textOnly.length > 0 && !this.anyAudio ? 'text_only' : reason);
    }
  }

  private fireFirst(textOnly: boolean) {
    if (this.firstFired) return;
    this.firstFired = true;
    this.cb.onFirstChunk?.({ textOnly });
  }

  private emitProgress(chunkPart: string) {
    this.currentChunkRevealed = chunkPart;
    const joined = this.revealedPrefix ? `${this.revealedPrefix} ${chunkPart}`.trim() : chunkPart;
    this.cb.onProgress?.(joined);
  }

  private clearProgress() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private async playEntry(entry: Entry): Promise<void> {
    const idx = this.index++;
    const text = entry.item.text.trim();
    const src = await entry.srcPromise;
    if (this.stopped) return;

    if (!src) {
      // TTS failed after retry: explicit text-only (never presented as spoken).
      this.fireFirst(true);
      this.textOnly.push(text);
      this.delivered.push(text);
      this.revealedPrefix = this.revealedPrefix ? `${this.revealedPrefix} ${text}` : text;
      this.cb.onChunkTextOnly?.(entry.item, idx);
      this.cb.onProgress?.(this.revealedPrefix);
      return;
    }

    const audio = new Audio(src);
    audio.preload = 'auto';
    this.audio = audio;
    this.cb.onAudioElement?.(audio);
    this.currentChunkText = text;

    const outcome = await new Promise<'ended' | 'error' | 'blocked' | 'stopped'>(resolve => {
      let settled = false;
      const done = (v: 'ended' | 'error' | 'blocked' | 'stopped') => {
        if (settled) return;
        settled = true;
        this.cancelCurrent = null;
        resolve(v);
      };
      this.cancelCurrent = () => done('stopped');
      audio.onended = () => done('ended');
      audio.onerror = () => done('error');
      audio.play().then(() => {
        if (settled || this.stopped) return;
        this.anyAudio = true;
        this.fireFirst(false);
        this.clearProgress();
        const words = text.split(' ');
        this.progressTimer = setInterval(() => {
          const dur = audio.duration;
          if (!dur || !isFinite(dur) || dur <= 0) return;
          const ratio = Math.min(1, audio.currentTime / dur);
          const n = Math.max(1, Math.ceil(words.length * ratio));
          this.emitProgress(words.slice(0, n).join(' '));
        }, 60);
      }).catch(() => done('blocked'));
    });

    this.clearProgress();
    if (src.startsWith('blob:')) {
      try { URL.revokeObjectURL(src); } catch {}
    }
    this.audio = null;
    this.currentChunkText = '';

    if (outcome === 'stopped' || this.stopped) return;

    // Whole chunk is delivered (spoken, or text-only when audio could not play).
    this.currentChunkRevealed = '';
    this.delivered.push(text);
    this.revealedPrefix = this.revealedPrefix ? `${this.revealedPrefix} ${text}` : text;
    if (outcome !== 'ended') {
      this.fireFirst(true);
      this.textOnly.push(text);
      this.cb.onChunkTextOnly?.(entry.item, idx);
    }
    this.cb.onProgress?.(this.revealedPrefix);
  }

  private finish(reason: SpeechEndReason) {
    if (this.finished) return;
    this.finished = true;
    this.clearProgress();
    // Drop any queued blob URLs that never played.
    for (const e of this.queue) {
      e.srcPromise.then(s => { if (s && s.startsWith('blob:')) { try { URL.revokeObjectURL(s); } catch {} } }).catch(() => {});
    }
    this.queue = [];
    this.cb.onEnd?.({
      reason,
      deliveredText: this.delivered.join(' ').trim(),
      textOnlyText: this.textOnly.join(' ').trim(),
      anyAudio: this.anyAudio,
    });
  }
}

/* ------------------------------------------------------------------ */
/* SpeechListener (Web Speech API)                                     */
/* ------------------------------------------------------------------ */

export interface SpeechListenerOptions {
  lang: string;
  /** Silence after the last recognized speech before the utterance is committed (spec: ~300-500ms). */
  commitMs?: number;
  onInterim?: (text: string) => void;
  /** Exactly one commit per `start()`. */
  onCommit: (text: string) => void;
  /** Called once when real user speech is detected while the assistant is speaking. */
  onBarge?: (heardText: string) => void;
  /** True while the assistant is audibly speaking (enables barge mode). */
  isAssistantSpeaking?: () => boolean;
  /** Text currently being spoken - used so speaker echo never counts as barge-in. */
  getSpokenText?: () => string;
  onFatal?: (code: string) => void;
  onActive?: (active: boolean) => void;
}

export function computeSpeechCommitDelay(text: string, isFinal: boolean, baseCommitMs?: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 1000;

  // Words that indicate the speaker is in the middle of a clause or thought:
  const trailingIncomplete = /\b(and|or|but|so|because|to|for|with|about|in|on|at|of|can i|should i|could i|what if|what about|how do i|if|when|that|which|is|are|was|were|a|an|the)$/i;
  if (trailingIncomplete.test(trimmed)) {
    return 1800; // Generous 1.8s pause window so user can finish their clause without being cut off
  }

  if (!isFinal) {
    // User is actively streaming interim words; allow comfortable pause (1.3s) for breathing/thinking
    return Math.max(baseCommitMs ?? 1300, 1300);
  }

  // Browser speech recognition finalized the utterance; snappy transition (750ms)
  return baseCommitMs ? Math.min(baseCommitMs, 850) : 750;
}

export function getSpeechRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export class SpeechListener {
  private rec: any = null;
  private gen = 0;
  private committed = false;
  private stopped = true;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private ignoreBefore = 0;
  private bargeDone = false;
  private pendingText = '';
  private restartFailures = 0;
  private restartWindowStart = 0;
  private lastCommit = { text: '', at: 0 };

  constructor(private o: SpeechListenerOptions) {}

  get isRunning(): boolean {
    return !this.stopped && !this.committed;
  }

  start(): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;
    this.teardownRecognition();
    this.stopped = false;
    this.committed = false;
    this.bargeDone = false;
    this.ignoreBefore = 0;
    this.pendingText = '';
    return this.spawn(Ctor);
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.teardownRecognition();
    this.o.onActive?.(false);
  }

  private clearTimers() {
    if (this.commitTimer) { clearTimeout(this.commitTimer); this.commitTimer = null; }
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
  }

  private teardownRecognition() {
    this.gen++; // stale handlers of the previous recognition become no-ops
    const r = this.rec;
    this.rec = null;
    if (r) {
      r.onresult = null; r.onend = null; r.onerror = null; r.onstart = null;
      try { r.abort(); } catch {}
    }
  }

  private collect(event: any): { text: string; firstIdx: number } {
    let text = '';
    for (let i = Math.max(this.ignoreBefore, 0); i < event.results.length; i++) {
      const part = (event.results[i]?.[0]?.transcript || '').trim();
      if (part) text += (text ? ' ' : '') + part;
    }
    return { text: text.trim(), firstIdx: this.ignoreBefore };
  }

  private spawn(Ctor: any): boolean {
    const myGen = this.gen;
    let rec: any;
    try {
      rec = new Ctor();
    } catch {
      return false;
    }
    this.rec = rec;
    rec.lang = this.o.lang;
    rec.interimResults = true;
    rec.continuous = true;

    rec.onstart = () => {
      if (myGen !== this.gen) return;
      this.o.onActive?.(true);
    };

    rec.onresult = (event: any) => {
      if (myGen !== this.gen || this.stopped || this.committed) return;

      // ---- Assistant is speaking: barge-in or echo rejection ----
      if (this.o.isAssistantSpeaking?.()) {
        if (!this.bargeDone) {
          const spoken = this.o.getSpokenText?.() || '';
          let firstIdx = -1;
          for (let i = this.ignoreBefore; i < event.results.length; i++) {
            const part = (event.results[i]?.[0]?.transcript || '').trim();
            if (!part) continue;
            if (!isEchoOfAssistant(part, spoken)) {
              firstIdx = i;
              break;
            }
          }

          if (firstIdx < 0) {
            // Pure echo of the assistant itself: advance ignoreBefore so this echo is NEVER committed later
            this.ignoreBefore = event.results.length;
            this.pendingText = '';
            if (this.commitTimer) {
              clearTimeout(this.commitTimer);
              this.commitTimer = null;
            }
            return;
          }

          let userPart = '';
          for (let i = firstIdx; i < event.results.length; i++) {
            userPart += (userPart ? ' ' : '') + (event.results[i]?.[0]?.transcript || '').trim();
          }

          if (isEchoOfAssistant(userPart, spoken)) {
            this.ignoreBefore = event.results.length;
            this.pendingText = '';
            if (this.commitTimer) {
              clearTimeout(this.commitTimer);
              this.commitTimer = null;
            }
            return;
          }

          // Valid user barge-in detected!
          this.bargeDone = true;
          this.ignoreBefore = firstIdx;
          this.o.onBarge?.(userPart.trim());
          // fall through into normal commit path with the continuous session
        }
      }

      const { text } = this.collect(event);
      if (!text) return;
      this.restartFailures = 0;
      this.pendingText = text;
      this.o.onInterim?.(text);

      const lastResult = event.results?.[event.results.length - 1];
      const isFinal = Boolean(lastResult?.isFinal);
      const delay = computeSpeechCommitDelay(text, isFinal, this.o.commitMs);

      if (text.length >= 2) {
        if (this.commitTimer) clearTimeout(this.commitTimer);
        this.commitTimer = setTimeout(() => this.commit(), delay);
      }
    };

    rec.onerror = (e: any) => {
      if (myGen !== this.gen || this.stopped) return;
      const code = e?.error || 'unknown';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.stop();
        this.o.onFatal?.(code);
        return;
      }
      this.restartFailures++;
    };

    rec.onend = () => {
      if (myGen !== this.gen || this.stopped || this.committed) return;
      this.o.onActive?.(false);
      // If assistant is currently speaking and user has not barged in, never commit assistant's echo!
      if (this.o.isAssistantSpeaking?.() && !this.bargeDone) {
        this.pendingText = '';
        return;
      }
      // Utterance captured but not yet committed -> commit now instead of restarting.
      if (this.pendingText.trim().length >= 2) {
        this.commit();
        return;
      }
      // Anti-loop: bounded restarts with exponential backoff.
      const now = Date.now();
      if (now - this.restartWindowStart > 15000) {
        this.restartWindowStart = now;
        this.restartFailures = Math.min(this.restartFailures, 1);
      }
      if (this.restartFailures >= 6) {
        this.stop();
        this.o.onFatal?.('restart_storm');
        return;
      }
      const delay = this.restartFailures > 0 ? backoffMs(this.restartFailures) : 120;
      const Ctor2 = getSpeechRecognitionCtor();
      this.restartTimer = setTimeout(() => {
        if (myGen !== this.gen || this.stopped || this.committed) return;
        if (!this.spawn(Ctor2)) this.restartFailures++;
      }, delay);
    };

    try {
      rec.start();
    } catch {
      return false;
    }
    return true;
  }

  private commit() {
    if (this.committed || this.stopped) return;
    const text = this.pendingText.trim();
    if (text.length < 2) return;
    // Anti-repeat: identical utterance within 2.5s is ignored.
    const now = Date.now();
    if (text.toLowerCase() === this.lastCommit.text && now - this.lastCommit.at < 2500) {
      this.pendingText = '';
      return;
    }
    this.committed = true;
    this.lastCommit = { text: text.toLowerCase(), at: now };
    this.clearTimers();
    this.teardownRecognition();
    this.o.onActive?.(false);
    this.pendingText = '';
    this.o.onCommit(text);
  }
}
