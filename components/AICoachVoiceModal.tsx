"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, X, Activity, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import HealthCoachAvatar, { CoachState } from '@/components/avatar/HealthCoachAvatar';
import { permissionManager } from '@/lib/services/PermissionManager';
import { normalizeSpokenInput } from '@/lib/services/ai/SpeechNormalizer';
import { useTranslation } from '@/lib/api/translation';
import { LANGUAGE_META } from '@/lib/api/serverLanguage';
import {
  SequentialSpeechPlayer,
  SpeechListener,
  TurnSession,
  getSpeechRecognitionCtor,
  splitIntoSpeechChunks,
  type SpeechEndResult,
} from '@/lib/voice/VoiceTurnController';
import {
  getRoutineVoiceResponse,
  getCachedAudioUrl,
  setCachedAudioUrl,
} from '@/lib/voice/VoiceResponseCache';
const DEFAULT_COACH_VOICE = 'nova';

interface AICoachVoiceModalProps {
  userId: string;
  userName?: string;
  userAvatar?: string | null;
  conversationId: string;
  onClose: () => void;
}

interface TurnMetricsHUD {
  turnId: string | null;
  state: CoachState;
  heard: string;
  apiStatus: string;
  latencyMs: number | null;
  audioStatus: string;
}

const COACH_ID = '00000000-0000-0000-0000-000000000001';

const ALLOWED_TRANSITIONS: Record<CoachState, CoachState[]> = {
  idle: ['listening', 'thinking', 'speaking', 'searching', 'error'],
  listening: ['thinking', 'speaking', 'searching', 'idle', 'error'],
  thinking: ['searching', 'preparing', 'speaking', 'idle', 'error'],
  searching: ['preparing', 'speaking', 'idle', 'error'],
  preparing: ['speaking', 'idle', 'error'],
  speaking: ['idle', 'listening', 'searching', 'error'],
  error: ['idle', 'listening']
};

export default function AICoachVoiceModal({
  userId,
  userName = 'Vic',
  conversationId,
  onClose,
}: AICoachVoiceModalProps) {
  const queryClient = useQueryClient();
  const resolvedUserName = (!userName || userName === 'User' || userName === 'there') ? 'Vic' : userName;

  // Permission state (Synchronously defaults to true if local permission cache exists)
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      const isGranted = localStorage.getItem('vic_permission_microphone_onboarded') === 'true' ||
        localStorage.getItem('has_granted_mic') === 'true' ||
        localStorage.getItem('permission_microphone') === 'granted';
      if (isGranted) return true;
    }
    return true; // Default to true so modal opens & greets immediately
  });
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  // Authoritative State Machine & Turn Lock
  const { lang: appLang } = useTranslation();
  const [state, setState] = useState<CoachState>('speaking');
  const [isMuted, setIsMuted] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>(() => {
    return (LANGUAGE_META[appLang as any]?.speechCode || 'en-US');
  });

  useEffect(() => {
    const code = LANGUAGE_META[appLang as any]?.speechCode || 'en-US';
    setVoiceLang(code);
  }, [appLang]);

  const [liveInterim, setLiveInterim] = useState<string>('');
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  
  // Audio amplitude levels for avatar reactivity
  const [micLevel, setMicLevel] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const [debugHUD, setDebugHUD] = useState<TurnMetricsHUD>({
    turnId: null,
    state: 'speaking',
    heard: '',
    apiStatus: 'Ready',
    latencyMs: null,
    audioStatus: 'Ready'
  });

  // State refs for async callbacks & auto-greeting
  const voiceStateRef = useRef<CoachState>('speaking');
  const turnInProgressRef = useRef<boolean>(true);
  const activeTurnIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(false);
  const hasGreetedRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const isMountedRef = useRef(true);
  const silenceTimerRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`);
  const turnIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnSessionRef = useRef(new TurnSession());
  const playerRef = useRef<SequentialSpeechPlayer | null>(null);
  const listenerRef = useRef<SpeechListener | null>(null);
  const spokenTextRef = useRef<string>('');
  const chunkPlayingRef = useRef<boolean>(false);
  const sessionTurnsRef = useRef<{ role: 'user' | 'assistant'; content: string; created_at: string }[]>([]);
  const startListeningRef = useRef<(opts?: { barge?: boolean }) => void>(() => {});
  const pendingSpokenTextRef = useRef<string>('');
  const ttsCooldownUntilRef = useRef<number>(0);

  // Unlock AudioContext for Mobile Browsers
  const unlockAudioContext = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (err) {
      console.warn('[VOICE] AudioContext unlock warning:', err);
    }
  }, []);

  // State machine updater
  const updateVoiceState = useCallback((nextState: CoachState, reason = 'standard') => {
    const currentState = voiceStateRef.current;
    if (currentState !== nextState) {
      const allowed = ALLOWED_TRANSITIONS[currentState] || [];
      if (!allowed.includes(nextState)) {
        console.warn(`[VOICE BLOCKED] Transition from ${currentState} -> ${nextState} blocked (${reason})`);
        return;
      }
    }

    voiceStateRef.current = nextState;
    if (isMountedRef.current) {
      setState(nextState);
      setDebugHUD(prev => ({ ...prev, state: nextState }));
    }
    console.log(`[VOICE TURN ${activeTurnIdRef.current || 'INIT'}] STATE: ${nextState} (${reason})`);
  }, []);

  // Mic audio amplitude analyzer loop
  const setupMicAnalyser = useCallback(async (stream: MediaStream) => {
    try {
      await unlockAudioContext();
      if (!audioContextRef.current) return;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let bargeInSpeechFrames = 0;

      const updateMic = () => {
        if (!isMountedRef.current) return;
        if (micAnalyserRef.current) {
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const currentLevel = Math.min(1.0, avg / 128);

          if (voiceStateRef.current === 'listening') {
            setMicLevel(currentLevel);
            bargeInSpeechFrames = 0;
          } else if (voiceStateRef.current === 'speaking') {
            setMicLevel(0);
            // Natural voice barge-in during speech playback:
            // Prevent assistant's own audio from triggering self-interruption:
            const isSelfAudio = audioLevel > 0.05 && currentLevel < (audioLevel * 1.35 + 0.12);
            if (!isSelfAudio && currentLevel > 0.28) {
              bargeInSpeechFrames++;
              if (bargeInSpeechFrames >= 3) {
                console.log('[VOICE] User spoke over the Coach! Triggering instant playback interruption.');
                bargeInSpeechFrames = 0;
                interruptAgent();
              }
            } else {
              bargeInSpeechFrames = Math.max(0, bargeInSpeechFrames - 1);
            }
          } else if (
            voiceStateRef.current === 'thinking' ||
            voiceStateRef.current === 'searching' ||
            voiceStateRef.current === 'preparing'
          ) {
            setMicLevel(0);
            // Genuine loud user interruption during answer generation (requires sustained loud speech, not ambient noise)
            if (currentLevel > 0.45) {
              bargeInSpeechFrames++;
              if (bargeInSpeechFrames >= 12) {
                console.log('[VOICE] User spoke loudly during thinking/searching! Cancelling in-flight generation.');
                bargeInSpeechFrames = 0;
                interruptAgent();
              }
            } else {
              bargeInSpeechFrames = Math.max(0, bargeInSpeechFrames - 1);
            }
          } else {
            setMicLevel(0);
            bargeInSpeechFrames = 0;
          }
        }
        animFrameRef.current = requestAnimationFrame(updateMic);
      };
      updateMic();
    } catch (err) {
      console.warn('[VOICE] Mic analyzer setup warning:', err);
    }
  }, [unlockAudioContext]);

  // Instant interruption helper
  const interruptAgent = useCallback((opts?: { restart?: boolean }) => {
    console.log('[VOICE] User interruption triggered');
    turnSessionRef.current.cancel();
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch (e) {}
      abortControllerRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    chunkPlayingRef.current = false;
    spokenTextRef.current = '';
    setAudioLevel(0);
    turnInProgressRef.current = false;
    activeTurnIdRef.current = null;
    pendingSpokenTextRef.current = '';
    setLiveInterim('');

    const shouldRestart = opts?.restart !== false;
    if (isMountedRef.current && !isMutedRef.current && shouldRestart) {
      updateVoiceState('listening', 'INTERRUPT');
      setTimeout(() => {
        if (typeof startListeningRef.current === 'function') {
          startListeningRef.current();
        }
      }, 60);
    } else if (isMountedRef.current && !shouldRestart) {
      // Barge-in active: keep speech recognition running in listening/barge mode
    } else {
      updateVoiceState('idle', 'INTERRUPT');
    }
  }, [updateVoiceState]);

  // Hand-off turn lifecycle after speech ends (opens microphone for continuous 1-on-1 dialog)
  const onTurnSpeechCompleted = useCallback((turnId: string) => {
    if (activeTurnIdRef.current === turnId) {
      turnInProgressRef.current = false;
      activeTurnIdRef.current = null;
      setDebugHUD(prev => ({ ...prev, audioStatus: 'Idle' }));

      if (isMountedRef.current && !isMutedRef.current) {
        updateVoiceState('idle', 'SPEECH_COMPLETED');
        setTimeout(() => {
          if (isMountedRef.current && voiceStateRef.current === 'idle' && !turnInProgressRef.current) {
            updateVoiceState('listening', 'AUTO_NEXT_TURN');
            if (typeof startListeningRef.current === 'function') {
              startListeningRef.current();
            }
          }
        }, 80);
      } else if (isMountedRef.current) {
        updateVoiceState('idle', 'SPEECH_COMPLETED_MUTED');
      }
    }
  }, [updateVoiceState]);

  // Helper to connect an HTMLAudioElement to the audioContext analyser for avatar amplitude reactivity
  const attachAudioAnalyser = useCallback((audio: HTMLAudioElement) => {
    if (!audioContextRef.current) return;
    try {
      const source = audioContextRef.current.createMediaElementSource(audio);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
      audioAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        if ((voiceStateRef.current === 'speaking' || voiceStateRef.current === 'searching') && audioAnalyserRef.current) {
          audioAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(1.0, avg / 128));
          requestAnimationFrame(updateAudioLevel);
        } else {
          setAudioLevel(0);
        }
      };
      updateAudioLevel();
    } catch (e) {
      // Audio element may already be connected or suspended
    }
  }, []);

  // Fetch TTS audio blob as URL (using locked voice engine with Nova -> Aoede failover)
  const fetchTtsAudioUrl = useCallback(async (text: string, signal?: AbortSignal): Promise<string | null> => {
    const cached = getCachedAudioUrl(text);
    if (cached) return cached;
    if (Date.now() < ttsCooldownUntilRef.current) return null;
    try {
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: DEFAULT_COACH_VOICE,
          speed: 1.05,
          language: voiceLang.split('-')[0]
        }),
        signal
      });
      if (!res.ok) {
        ttsCooldownUntilRef.current = Date.now() + 60000;
        return null;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setCachedAudioUrl(text, url);
      return url;
    } catch (e: any) {
      if (e?.name === 'AbortError') return null;
      ttsCooldownUntilRef.current = Date.now() + 30000;
      console.warn('[VOICE] TTS fetch error:', e);
      return null;
    }
  }, [voiceLang]);

  // Dynamically Generated Context-Aware Voice Greeting using Unified Speech Engine
  const triggerAutoGreeting = useCallback(async () => {
    if (hasGreetedRef.current || !isMountedRef.current) return;
    hasGreetedRef.current = true;

    const turnHandle = turnSessionRef.current.begin();
    const greetingTurnId = `greet_${turnHandle.id}`;
    activeTurnIdRef.current = greetingTurnId;
    turnInProgressRef.current = true;

    updateVoiceState('thinking', 'AUTO_GREETING_START');
    await unlockAudioContext();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      const res = await fetch('/api/conversation/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          user_id: userId,
          content: '[DYNAMIC_GREETING_REQUEST]',
          is_initial_greeting: true,
          voice_mode: true,
          locale: voiceLang.split('-')[0]
        }),
        signal: turnHandle.signal
      });

      if (!res.ok) {
        throw new Error(`Greeting fetch error: HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!isMountedRef.current || !turnHandle.isCurrent()) return;

      const dynamicGreeting = data.content || data.reply || `Good day, ${resolvedUserName}! How can I support your health goals today?`;
      spokenTextRef.current = dynamicGreeting;

      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }

      const player = new SequentialSpeechPlayer({
        onFirstChunk: (info) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          updateVoiceState('speaking', 'GREETING_SPEECH_FIRST');
          setDebugHUD(prev => ({ ...prev, audioStatus: info.textOnly ? 'Text Only' : 'Playing ⚡' }));
          chunkPlayingRef.current = !info.textOnly;
          if (info.textOnly) {
            toast.message('Voice unavailable - displaying greeting as text.');
          }
        },
        onProgress: (revealed) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          spokenTextRef.current = revealed;
        },
        onAudioElement: (audio) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          currentAudioRef.current = audio;
          attachAudioAnalyser(audio);
        },
        onEnd: (result) => {
          if (!turnHandle.isCurrent()) return;
          playerRef.current = null;
          currentAudioRef.current = null;
          chunkPlayingRef.current = false;
          spokenTextRef.current = '';
          setAudioLevel(0);
          if (result.deliveredText) {
            sessionTurnsRef.current.push({
              role: 'assistant',
              content: result.deliveredText,
              created_at: new Date().toISOString()
            });
          }
          if (result.reason !== 'interrupted') {
            onTurnSpeechCompleted(greetingTurnId);
          }
        }
      });
      playerRef.current = player;

      if (data.audioBase64) {
        player.enqueue({ text: dynamicGreeting, src: data.audioBase64 });
      } else {
        const chunks = splitIntoSpeechChunks(dynamicGreeting);
        chunks.forEach(chunk => {
          player.enqueue({
            text: chunk,
            fetchSrc: (sig) => fetchTtsAudioUrl(chunk, sig)
          });
        });
      }
      player.end();

      // Open listener in barge mode so user can interrupt the greeting
      if (isMountedRef.current && !isMutedRef.current) {
        startListeningRef.current({ barge: true });
      }

    } catch (err: any) {
      if (err?.name === 'AbortError' || turnHandle.signal.aborted) return;
      console.warn('[VOICE] Dynamic greeting error:', err);
      if (isMountedRef.current && turnHandle.isCurrent()) {
        onTurnSpeechCompleted(greetingTurnId);
      }
    }
  }, [conversationId, userId, voiceLang, resolvedUserName, onTurnSpeechCompleted, updateVoiceState, unlockAudioContext, attachAudioAnalyser, fetchTtsAudioUrl]);

  // Handle avatar face selection (Click/Tap)
  const handleAvatarClick = useCallback(() => {
    // If agent is currently speaking, thinking, searching, or preparing: instant user interruption
    if (
      voiceStateRef.current === 'speaking' ||
      voiceStateRef.current === 'thinking' ||
      voiceStateRef.current === 'searching' ||
      voiceStateRef.current === 'preparing'
    ) {
      console.log('[VOICE] Avatar face clicked during active turn -> Instant interruption');
      interruptAgent();
    } else if (voiceStateRef.current === 'idle') {
      console.log('[VOICE] Avatar face clicked while idle -> Activating voice turn');
      if (!hasGreetedRef.current) {
        triggerAutoGreeting();
      } else if (typeof startListeningRef.current === 'function') {
        startListeningRef.current();
      }
    }
  }, [interruptAgent, triggerAutoGreeting]);

  // Check initial microphone permission & trigger auto-greeting immediately on mount
  useEffect(() => {
    isMountedRef.current = true;

    const checkPermissionOnMount = async () => {
      if (!hasGreetedRef.current) {
        triggerAutoGreeting();
      }

      const status = await permissionManager.checkPermission('microphone', userId);
      
      if (status.browserState === 'denied') {
        setHasMicPermission(false);
        setPermissionBlocked(true);
        turnInProgressRef.current = false;
        activeTurnIdRef.current = null;
        updateVoiceState('idle', 'MIC_DENIED');
        return;
      }

      if (status.browserState === 'granted' || status.appOnboarded) {
        setHasMicPermission(true);
        setPermissionBlocked(false);
        await unlockAudioContext();
      }
    };

    checkPermissionOnMount();

    return () => {
      isMountedRef.current = false;
      turnSessionRef.current.cancel();
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }
      if (listenerRef.current) {
        try { listenerRef.current.stop(); } catch (e) {}
        listenerRef.current = null;
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        } catch (e) {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [userId, unlockAudioContext, triggerAutoGreeting, updateVoiceState]);

  // Process user speech turn with single-flight locking and SequentialSpeechPlayer
  const processUserSpeech = useCallback(async (userText: string) => {
    const cleanedText = userText.trim();
    if (!cleanedText || cleanedText.length < 2 || !isMountedRef.current) {
      turnInProgressRef.current = false;
      return;
    }

    // Begin new turn session - immediately aborts any in-flight LLM/TTS request
    const turnHandle = turnSessionRef.current.begin();
    const turnId = `turn_${turnHandle.id}`;
    turnInProgressRef.current = true;
    activeTurnIdRef.current = turnId;
    turnIdRef.current = turnHandle.id;

    await unlockAudioContext();

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    pendingSpokenTextRef.current = '';
    updateVoiceState('thinking', 'SPEECH_FINALIZED');
    setLiveInterim('');

    setDebugHUD(prev => ({
      ...prev,
      turnId: turnId.slice(0, 8),
      heard: cleanedText,
      apiStatus: 'Dispatching...',
      latencyMs: null,
      audioStatus: 'Waiting'
    }));

    sessionTurnsRef.current.push({
      role: 'user',
      content: cleanedText,
      created_at: new Date().toISOString(),
    });

    // Fast-path routine response check (greetings, presence checks, thanks)
    const routineFastReply = getRoutineVoiceResponse(cleanedText, 'coach');
    if (routineFastReply) {
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }

      const reqStartTime = performance.now();
      const player = new SequentialSpeechPlayer({
        onFirstChunk: (info) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          const timeToFirstAudio = Math.round(performance.now() - reqStartTime);
          updateVoiceState('speaking', 'SPEECH_CHUNK_FIRST');
          setDebugHUD(prev => ({
            ...prev,
            apiStatus: '200 OK (FastPath)',
            latencyMs: timeToFirstAudio,
            audioStatus: info.textOnly ? 'Text Only' : 'Playing ⚡'
          }));
          chunkPlayingRef.current = !info.textOnly;
          if (info.textOnly) {
            toast.message('Voice unavailable - showing reply as text.');
          }
          if (isMountedRef.current && !isMutedRef.current) {
            startListeningRef.current({ barge: true });
          }
        },
        onProgress: (revealed) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          spokenTextRef.current = revealed;
        },
        onAudioElement: (audio) => {
          currentAudioRef.current = audio;
          attachAudioAnalyser(audio);
        },
        onEnd: (result) => {
          if (!turnHandle.isCurrent()) return;
          playerRef.current = null;
          currentAudioRef.current = null;
          chunkPlayingRef.current = false;
          turnInProgressRef.current = false;
          activeTurnIdRef.current = null;
          sessionTurnsRef.current.push({
            role: 'assistant',
            content: result.deliveredText || routineFastReply.text,
            created_at: new Date().toISOString(),
          });
          onTurnSpeechCompleted(turnId);
        }
      });

      playerRef.current = player;
      const chunks = splitIntoSpeechChunks(routineFastReply.text);
      chunks.forEach(chunk => {
        player.enqueue({
          text: chunk,
          fetchSrc: (sig) => fetchTtsAudioUrl(chunk, sig)
        });
      });
      player.end();
      return;
    }

    try {
      supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: cleanedText,
        message_type: 'text',
        created_at: new Date().toISOString()
      }).then();

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session?.access_token) {
        throw new Error('User is not authenticated');
      }

      const reqStartTime = performance.now();

      const coachRes = await fetch('/api/conversation/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${session.access_token}`
        },
        signal: turnHandle.signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          user_id: session.user.id,
          content: cleanedText,
          locale: voiceLang.split('-')[0],
          voice_mode: true,
          stream: true,
          session_id: sessionIdRef.current,
          turn_id: turnHandle.id,
          session_turns: sessionTurnsRef.current.slice(-10)
        }),
      });

      if (!coachRes.ok) {
        setDebugHUD(prev => ({ ...prev, apiStatus: `Error ${coachRes.status}` }));
        throw new Error(`AI Coach failed with status ${coachRes.status}`);
      }

      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current = null;
      }

      const player = new SequentialSpeechPlayer({
        onFirstChunk: (info) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          const timeToFirstAudio = Math.round(performance.now() - reqStartTime);
          updateVoiceState('speaking', 'SPEECH_CHUNK_FIRST');
          setDebugHUD(prev => ({
            ...prev,
            apiStatus: '200 OK (Stream)',
            latencyMs: timeToFirstAudio,
            audioStatus: info.textOnly ? 'Text Only' : 'Playing ⚡'
          }));
          chunkPlayingRef.current = !info.textOnly;
          if (info.textOnly) {
            toast.message('Voice unavailable - showing reply as text.');
          }
          // Enable mic in barge mode so user can interrupt whenever assistant speaks
          if (isMountedRef.current && !isMutedRef.current) {
            startListeningRef.current({ barge: true });
          }
        },
        onProgress: (revealed) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          spokenTextRef.current = revealed;
        },
        onAudioElement: (audio) => {
          if (!turnHandle.isCurrent() || !isMountedRef.current) return;
          currentAudioRef.current = audio;
          attachAudioAnalyser(audio);
        },
        onEnd: (result) => {
          if (!turnHandle.isCurrent()) return;
          playerRef.current = null;
          currentAudioRef.current = null;
          chunkPlayingRef.current = false;
          spokenTextRef.current = '';
          setAudioLevel(0);
          if (result.deliveredText) {
            sessionTurnsRef.current.push({
              role: 'assistant',
              content: result.deliveredText,
              created_at: new Date().toISOString()
            });
          }
          if (result.reason !== 'interrupted') {
            onTurnSpeechCompleted(turnId);
          }
        }
      });
      playerRef.current = player;

      let replyText = '';
      let receivedAnyAudioChunk = false;

      if (coachRes.body && coachRes.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = coachRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const event = JSON.parse(trimmed.slice(6));
                
                if (event.type === 'tool_call' || event.type === 'searching') {
                  updateVoiceState('searching', 'TOOL_SEARCH');
                } else if (event.type === 'preparing') {
                  updateVoiceState('preparing', 'PREPARING');
                } else if ((event.type === 'first_audio' || event.type === 'audio') && event.audioBase64 && turnHandle.isCurrent()) {
                  receivedAnyAudioChunk = true;
                  player.enqueue({
                    text: event.text || '',
                    src: event.audioBase64
                  });
                } else if (event.type === 'done') {
                  replyText = event.fullText;
                  if (event.audioBase64 && !receivedAnyAudioChunk && turnHandle.isCurrent()) {
                    receivedAnyAudioChunk = true;
                    player.enqueue({
                      text: event.fullText,
                      src: event.audioBase64
                    });
                  }
                }
              } catch (e) {}
            }
          }
        }
      } else {
        const data = await coachRes.json();
        const timeToData = Math.round(performance.now() - reqStartTime);
        setDebugHUD(prev => ({
          ...prev,
          apiStatus: '200 OK (JSON)',
          latencyMs: timeToData
        }));
        replyText = data.content || data.replyText || `I hear you, ${resolvedUserName}. How can I best guide your health goals today?`;
        spokenTextRef.current = replyText;
        if (data.audioBase64 && turnHandle.isCurrent()) {
          receivedAnyAudioChunk = true;
          player.enqueue({ text: replyText, src: data.audioBase64 });
        }
      }

      // If server did not yield direct audio chunks, synthesize through SequentialSpeechPlayer with fetchSrc
      if (!receivedAnyAudioChunk && turnHandle.isCurrent()) {
        const fallback = replyText || "I'm here with you. What would you like to explore next?";
        spokenTextRef.current = fallback;
        const chunks = splitIntoSpeechChunks(fallback);
        chunks.forEach(chunk => {
          player.enqueue({
            text: chunk,
            fetchSrc: (sig) => fetchTtsAudioUrl(chunk, sig)
          });
        });
      }

      // Signal player that all chunks for this turn have arrived
      player.end();

    } catch (err: any) {
      if (err?.name === 'AbortError' || turnHandle.signal.aborted) return;
      console.error('[AICoachVoiceModal] AI processing error:', err);
      if (turnHandle.isCurrent()) {
        onTurnSpeechCompleted(turnId);
      }
    }
  }, [conversationId, userId, resolvedUserName, voiceLang, onTurnSpeechCompleted, updateVoiceState, unlockAudioContext, attachAudioAnalyser, fetchTtsAudioUrl]);

  // STT speech recognition starter with snappy VAD cadence
  // STT via the shared SpeechListener: tight 500ms commit, echo-safe barge-in, generation-guarded handlers,
  // bounded restarts with backoff (no restart loops). `barge` mode keeps the mic open while the coach speaks.
  const startListening = useCallback((opts?: { barge?: boolean }) => {
    const barge = !!opts?.barge;
    if (isMutedRef.current || !isMountedRef.current) return;

    if (barge) {
      if (voiceStateRef.current !== 'speaking') return;
      if (listenerRef.current?.isRunning) return;
    } else if (
      turnInProgressRef.current ||
      voiceStateRef.current === 'thinking' ||
      voiceStateRef.current === 'searching' ||
      voiceStateRef.current === 'preparing' ||
      voiceStateRef.current === 'speaking'
    ) {
      return;
    }

    if (!getSpeechRecognitionCtor()) {
      toast.error('Speech recognition not supported in this browser.');
      updateVoiceState('idle');
      return;
    }

    try {
      if (listenerRef.current) {
        try { listenerRef.current.stop(); } catch (e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      const listener = new SpeechListener({
        lang: voiceLang,
        onInterim: (text) => {
          pendingSpokenTextRef.current = text;
          setLiveInterim(text);
        },
        isAssistantSpeaking: () => voiceStateRef.current === 'speaking' && chunkPlayingRef.current,
        getSpokenText: () => spokenTextRef.current || playerRef.current?.queuedText || '',
        // Hard barge-in: stop audio + in-flight chat/TTS now; the same recognition session then commits the new words.
        onBarge: () => {
          console.log('[VOICE] Spoken barge-in detected -> hard interrupt');
          interruptAgent({ restart: false });
        },
        onCommit: (text) => {
          if (!isMountedRef.current) return;
          turnInProgressRef.current = true;
          pendingSpokenTextRef.current = '';
          processUserSpeech(normalizeSpokenInput(text));
        },
        onFatal: (code) => {
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            setHasMicPermission(false);
            setPermissionBlocked(true);
            toast.error('Microphone access blocked.');
          } else {
            toast.error('Voice listening stopped. Tap the avatar to talk again.');
          }
          if (voiceStateRef.current !== 'speaking') updateVoiceState('idle', 'LISTENER_FATAL');
        }
      });

      listenerRef.current = listener;
      if (!barge) updateVoiceState('listening', 'START_LISTENING');
      if (!listener.start()) {
        listenerRef.current = null;
        if (!barge) updateVoiceState('idle');
      }
    } catch (e) {
      console.error('[AICoachVoiceModal] Start listening error:', e);
      updateVoiceState('idle');
    }
  }, [voiceLang, processUserSpeech, updateVoiceState, interruptAgent]);

  startListeningRef.current = startListening;

  const requestMicPermission = async () => {
    await unlockAudioContext();
    try {
      const stream = await permissionManager.requestPermission('microphone', undefined, userId);
      micStreamRef.current = stream;
      setupMicAnalyser(stream);
      setHasMicPermission(true);
      setPermissionBlocked(false);

      if (!hasGreetedRef.current) {
        triggerAutoGreeting();
      } else {
        setTimeout(() => {
          if (isMountedRef.current && voiceStateRef.current === 'idle' && !turnInProgressRef.current) {
            startListening();
          }
        }, 80);
      }
    } catch (err: any) {
      console.error('[AICoachVoiceModal] Microphone access denied:', err);
      setHasMicPermission(false);
      if (err.code === 'PERMISSION_DENIED_BROWSER') {
        setPermissionBlocked(true);
      }
      toast.error('Microphone permission is required to talk with Vee.');
    }
  };

  const handleClose = () => {
    interruptAgent();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    onClose();
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Thinking...';
      case 'searching':
        return 'Searching...';
      case 'preparing':
        return 'Preparing...';
      case 'speaking':
        return 'Speaking...';
      case 'idle':
      default:
        return isMuted ? 'Muted' : 'Listening...';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-white flex flex-col justify-between items-center p-6 select-none text-slate-900 overflow-hidden font-display"
      >
        {/* Clean Center Stage: Minimalist Primary Green Avatar with Unpredictable Eye Movement */}
        {hasMicPermission === false ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 flex flex-col items-center justify-center gap-6 w-full max-w-sm my-auto text-center px-6 py-8 rounded-3xl bg-slate-50 border border-slate-200 shadow-xl"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 shadow-md animate-pulse">
              {permissionBlocked ? <AlertCircle size={32} className="text-amber-500" /> : <Mic size={32} />}
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-bold text-slate-900">
                {permissionBlocked ? 'Microphone Blocked' : 'Enable Microphone'}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {permissionBlocked
                  ? 'Microphone permission has been blocked. Please click the lock/settings icon in your browser address bar to enable access.'
                  : 'Allow microphone access to talk directly with Vee.'
                }
              </p>
            </div>

            {!permissionBlocked && (
              <button
                onClick={requestMicPermission}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>Allow Microphone & Start</span>
              </button>
            )}
          </motion.div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center gap-4 w-full max-w-md my-auto text-center px-4">
            
            {/* Minimalist Primary Green Avatar with Unpredictable 360° Eye Gaze */}
            <HealthCoachAvatar
              state={state}
              micLevel={micLevel}
              audioLevel={audioLevel}
              size={220}
              onClick={handleAvatarClick}
            />

            {/* Status Label (Never displays 'Tap avatar to speak') */}
            <p className="text-xs uppercase tracking-widest font-black text-emerald-600 transition-all mt-3">
              {getStatusLabel()}
            </p>

            {/* Live Interim Transcript */}
            {liveInterim && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xs px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 shadow-sm text-center"
              >
                <span className="text-slate-500 mr-1.5 font-medium">Heard:</span>
                <span className="italic font-semibold text-slate-900">"{liveInterim}"</span>
              </motion.div>
            )}

            {/* Diagnostic HUD */}
            {showDebugHUD && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm px-3.5 py-2.5 rounded-2xl bg-slate-900 text-white border border-slate-700 text-[11px] font-mono space-y-1.5 shadow-2xl text-left"
              >
                <div className="flex justify-between items-center text-emerald-400 font-bold border-b border-slate-700 pb-1">
                  <span className="flex items-center gap-1.5">
                    <Activity size={12} className="text-emerald-400 animate-pulse" />
                    <span>DIAGNOSTICS</span>
                  </span>
                  <span className="uppercase text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    {debugHUD.state}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-0.5 text-[10.5px]">
                  <div><span className="text-slate-400">Turn:</span> <span className="text-slate-200 font-bold">{debugHUD.turnId || 'none'}</span></div>
                  <div><span className="text-slate-400">API:</span> <span className="text-emerald-300 font-bold">{debugHUD.apiStatus}</span></div>
                  <div><span className="text-slate-400">TTS:</span> <span className="text-cyan-300 font-bold">{debugHUD.audioStatus}</span></div>
                  <div><span className="text-slate-400">Latency:</span> <span className="text-amber-300 font-bold">{debugHUD.latencyMs ? `${debugHUD.latencyMs}ms` : '--'}</span></div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Minimalist Bottom Close Button */}
        <div className="relative z-10 w-full max-w-xs flex items-center justify-center pb-4">
          <button
            onClick={handleClose}
            className="p-4 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full text-slate-700 transition-all shadow-md border border-slate-200"
            title="Close voice mode"
            aria-label="Close voice mode"
          >
            <X size={24} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
