// Inbound Chat Notification Sound (WhatsApp / Reference Audio Tone)
// Multi-tier:
// 1. Cached Web Audio API AudioBuffer for instant, zero-latency playback of the exact reference sound.
// 2. HTML5 Audio element (/sounds/inbound.mp3 with /sounds/inbound.wav).
// 3. Synthesizer fallback modeled after the reference whistle/chime.

let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let decodedAudioBuffer: AudioBuffer | null = null;
let lastSoundTime = 0;
const THROTTLE_MS = 600; // Prevent spamming sounds in tight loops

const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!audioCtx) {
        audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
};

const prefetchAndDecodeAudio = async () => {
    if (typeof window === 'undefined' || decodedAudioBuffer) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const res = await fetch('/sounds/inbound.mp3');
        if (!res.ok) return;
        const arrayBuf = await res.arrayBuffer();
        decodedAudioBuffer = await ctx.decodeAudioData(arrayBuf);
    } catch {
        // Fall back to HTML5 Audio element if decoding fails
    }
};

const initAudio = () => {
    if (typeof window === 'undefined') return;
    try {
        if (!audioEl) {
            audioEl = new Audio('/sounds/inbound.mp3');
            audioEl.volume = 1.0;
            audioEl.preload = 'auto';
        }
        getAudioContext();
        prefetchAndDecodeAudio().catch(() => {});
    } catch (e) {
        // Ignore initialization errors
    }
};

// Global unlock on any user interaction
if (typeof window !== 'undefined') {
    const unlock = () => {
        initAudio();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('click', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    // Attempt early prefetch
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initAudio();
    } else {
        window.addEventListener('DOMContentLoaded', initAudio, { once: true });
    }
}

/**
 * Plays the cached decoded AudioBuffer of the user reference sound.
 */
const playBuffer = (): boolean => {
    const ctx = getAudioContext();
    if (!ctx || !decodedAudioBuffer) return false;
    try {
        const source = ctx.createBufferSource();
        source.buffer = decodedAudioBuffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return true;
    } catch {
        return false;
    }
};

/**
 * Whistle/chime synthesizer fallback in case media loading is pending or offline.
 */
const playSynthesizedChime = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const startTime = ctx.currentTime;

        // Tone 1: rising cheerful whistle chirp (1100 Hz -> 1800 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1150, startTime);
        osc1.frequency.exponentialRampToValueAtTime(1820, startTime + 0.12);
        gain1.gain.setValueAtTime(0.001, startTime);
        gain1.gain.linearRampToValueAtTime(0.85, startTime + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + 0.18);

        // Tone 2: descending playful bell chirp (1750 Hz -> 1250 Hz)
        const t2Start = startTime + 0.14;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1750, t2Start);
        osc2.frequency.exponentialRampToValueAtTime(1250, t2Start + 0.18);
        gain2.gain.setValueAtTime(0.001, t2Start);
        gain2.gain.linearRampToValueAtTime(0.9, t2Start + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t2Start + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t2Start);
        osc2.stop(t2Start + 0.38);
    } catch (e) {
        console.warn('[chatSound] Synthesizer failed:', e);
    }
};

/**
 * Plays the inbound message chime at full audible volume using the user's reference sound.
 */
export const playInboundMessageSound = () => {
    const now = Date.now();
    if (now - lastSoundTime < THROTTLE_MS) {
        return; // Throttled to prevent loop stacking
    }
    lastSoundTime = now;

    if (typeof window === 'undefined') return;

    // Priority 1: Play decoded AudioBuffer (exact audio reference, zero latency)
    if (playBuffer()) {
        return;
    }

    // Priority 2: Play HTML5 Audio element
    try {
        if (!audioEl) {
            audioEl = new Audio('/sounds/inbound.mp3');
            audioEl.volume = 1.0;
        }

        audioEl.currentTime = 0;
        const playPromise = audioEl.play();

        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.log('[chatSound] HTML5 Audio autoplay paused, attempting Web Audio fallback:', err);
                playSynthesizedChime();
            });
        }
    } catch {
        playSynthesizedChime();
    }
};
