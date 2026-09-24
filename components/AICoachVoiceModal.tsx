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
import { DEFAULT_COACH_VOICE } from '@/lib/services/ai/ConversationOrchestrator';

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
  idle: ['listening', 'thinking', 'speaking', 'error'],
  listening: ['thinking', 'speaking', 'idle', 'error'],
  thinking: ['searching', 'preparing', 'speaking', 'idle', 'error'],
  searching: ['preparing', 'speaking', 'idle', 'error'],
  preparing: ['speaking', 'idle', 'error'],
  speaking: ['idle', 'listening', 'error'],
  error: ['idle', 'listening']
};

/**
 * Classifies whether a user query requires web search / live tool lookups (strictly search queries)
 */
function isSearchOrToolQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Explicit keywords that require web search, weather, recipes, prices, location, or live facts
  const searchKeywords = [
    'weather', 'temperature', 'search', 'find', 'calories in', 'nutrition of',
    'how to cook', 'recipe for', 'price of', 'boycott', 'location of', 'current events',
    'indonesia', 'forecast'
  ];

  return searchKeywords.some(kw => lower.includes(kw));
}

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
  const [state, setState] = useState<CoachState>('speaking');
  const [isMuted, setIsMuted] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'en-US' | 'id-ID' | 'es-ES' | 'ar-SA' | 'fr-FR'>('en-US');
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
  const sessionTurnsRef = useRef<{ role: 'user' | 'assistant'; content: string; created_at: string }[]>([]);
  const startListeningRef = useRef<() => void>(() => {});
  const pendingSpokenTextRef = useRef<string>('');

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
      const updateMic = () => {
        if (!isMountedRef.current) return;
        if (voiceStateRef.current === 'listening' && micAnalyserRef.current) {
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(1.0, avg / 128));
        } else {
          setMicLevel(0);
        }
        animFrameRef.current = requestAnimationFrame(updateMic);
      };
      updateMic();
    } catch (err) {
      console.warn('[VOICE] Mic analyzer setup warning:', err);
    }
  }, [unlockAudioContext]);

  // Instant interruption helper
  const interruptAgent = useCallback(() => {
    console.log('[VOICE] User interruption triggered');
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch (e) {}
      abortControllerRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    
    turnInProgressRef.current = false;
    activeTurnIdRef.current = null;

    if (isMountedRef.current && !isMutedRef.current) {
      updateVoiceState('listening', 'INTERRUPT');
      setTimeout(startListening, 80);
    } else {
      updateVoiceState('idle', 'INTERRUPT');
    }
  }, [updateVoiceState]);

  // Direct Audio Playback with Amplitude Reactivity
  const playDirectAudio = useCallback(async (audioSrc: string, turnId: string) => {
    await unlockAudioContext();
    if (!isMountedRef.current || !audioSrc) {
      turnInProgressRef.current = false;
      activeTurnIdRef.current = null;
      if (isMountedRef.current && !isMutedRef.current) {
        updateVoiceState('idle');
      }
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    updateVoiceState('speaking', 'PLAY_AUDIO');
    setDebugHUD(prev => ({ ...prev, audioStatus: 'Playing ⚡' }));

    try {
      const audio = new Audio(audioSrc);
      currentAudioRef.current = audio;

      if (audioContextRef.current) {
        try {
          const source = audioContextRef.current.createMediaElementSource(audio);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyser.connect(audioContextRef.current.destination);
          audioAnalyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevel = () => {
            if (voiceStateRef.current === 'speaking' && audioAnalyserRef.current) {
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
        } catch (e) {}
      }

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch((playErr) => {
          console.warn(`[VOICE TURN ${turnId}] audio.play() warning:`, playErr);
          resolve();
        });
      });
    } catch (err) {
      console.warn('[AICoachVoiceModal] Direct audio playback error:', err);
    } finally {
      currentAudioRef.current = null;
      setAudioLevel(0);

      if (activeTurnIdRef.current === turnId) {
        turnInProgressRef.current = false;
        activeTurnIdRef.current = null;
        setDebugHUD(prev => ({ ...prev, audioStatus: 'Idle' }));

        if (isMountedRef.current && !isMutedRef.current) {
          updateVoiceState('idle', 'AUDIO_ENDED');
          setTimeout(() => {
            if (isMountedRef.current && voiceStateRef.current === 'idle' && !turnInProgressRef.current) {
              updateVoiceState('listening', 'AUTO_NEXT_TURN');
              startListening();
            }
          }, 80);
        } else if (isMountedRef.current) {
          updateVoiceState('idle', 'AUDIO_ENDED_MUTED');
        }
      }
    }
  }, [updateVoiceState, unlockAudioContext]);

  // Fast Spoken TTS Voice Helper
  const speakText = useCallback(async (text: string, turnId: string) => {
    try {
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: DEFAULT_COACH_VOICE,
          speed: 1.1,
          language: voiceLang.split('-')[0]
        }),
      }).catch(() => null);

      if (res && res.ok && isMountedRef.current && activeTurnIdRef.current === turnId) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        await playDirectAudio(audioUrl, turnId);
        try { URL.revokeObjectURL(audioUrl); } catch (e) {}
      } else if (activeTurnIdRef.current === turnId) {
        turnInProgressRef.current = false;
        activeTurnIdRef.current = null;
        if (isMountedRef.current && !isMutedRef.current) {
          updateVoiceState('listening', 'TTS_FALLBACK_FREE');
          startListening();
        }
      }
    } catch (e) {
      console.warn('[VOICE] Fast TTS speech warning:', e);
      if (activeTurnIdRef.current === turnId) {
        turnInProgressRef.current = false;
        activeTurnIdRef.current = null;
        if (isMountedRef.current && !isMutedRef.current) {
          updateVoiceState('listening', 'TTS_ERROR_FREE');
          startListening();
        }
      }
    }
  }, [voiceLang, playDirectAudio, updateVoiceState]);

  // Automatic Voice Greeting Trigger upon Modal Selection (Persisted to conversation thread)
  const triggerAutoGreeting = useCallback(async () => {
    if (hasGreetedRef.current || !isMountedRef.current) return;
    hasGreetedRef.current = true;

    const greetingTurnId = `greet_${Date.now()}`;
    activeTurnIdRef.current = greetingTurnId;
    turnInProgressRef.current = true;

    updateVoiceState('speaking', 'AUTO_GREETING_START');

    const greetingMessage = `Hi ${resolvedUserName}! How can I help you with your health goals today?`;
    console.log('[VOICE] Triggering auto-greeting out loud & persisting to database:', greetingMessage);
    
    // Persist greeting to Supabase messages table for this conversation thread
    if (conversationId && conversationId !== 'ai-coach') {
      supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: COACH_ID,
        content: greetingMessage,
        message_type: 'text',
        created_at: new Date().toISOString()
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      });
    }

    sessionTurnsRef.current.push({
      role: 'assistant',
      content: greetingMessage,
      created_at: new Date().toISOString()
    });

    await speakText(greetingMessage, greetingTurnId);
  }, [resolvedUserName, conversationId, queryClient, speakText, updateVoiceState]);

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

  // Process user speech turn
  const processUserSpeech = useCallback(async (userText: string) => {
    const cleanedText = userText.trim();
    if (!cleanedText || cleanedText.length < 2 || !isMountedRef.current) {
      turnInProgressRef.current = false;
      return;
    }

    const turnId = crypto.randomUUID ? crypto.randomUUID() : `turn_${Date.now()}`;
    turnInProgressRef.current = true;
    activeTurnIdRef.current = turnId;
    turnIdRef.current += 1;
    const currentTurn = turnIdRef.current;

    await unlockAudioContext();

    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch (e) {}
    }
    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

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

    // Spoken Search Fillers strictly for real web search / tool queries
    const isSearchQuery = isSearchOrToolQuery(cleanedText);
    if (isSearchQuery && isMountedRef.current) {
      const snappySearchFillers = [
        "Let me check that for you.",
        "Let me see.",
        "Let me look into that for you."
      ];
      const selectedFiller = snappySearchFillers[Math.floor(Math.random() * snappySearchFillers.length)];
      speakText(selectedFiller, turnId).catch(() => {});
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
        signal: currentController.signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          user_id: session.user.id,
          content: cleanedText,
          locale: voiceLang.split('-')[0],
          voice_mode: true,
          stream: true,
          session_id: sessionIdRef.current,
          turn_id: currentTurn,
          session_turns: sessionTurnsRef.current.slice(-6)
        }),
      });

      if (!coachRes.ok) {
        setDebugHUD(prev => ({ ...prev, apiStatus: `Error ${coachRes.status}` }));
        throw new Error(`AI Coach failed with status ${coachRes.status}`);
      }

      let replyText = '';
      let hasStartedAudio = false;

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
                } else if ((event.type === 'first_audio' || event.type === 'audio') && event.audioBase64 && !hasStartedAudio && activeTurnIdRef.current === turnId) {
                  hasStartedAudio = true;
                  const timeToAudio = Math.round(performance.now() - reqStartTime);
                  setDebugHUD(prev => ({
                    ...prev,
                    apiStatus: '200 OK (Stream)',
                    latencyMs: timeToAudio,
                    audioStatus: 'Playing ⚡'
                  }));
                  if (isMountedRef.current) {
                    await playDirectAudio(event.audioBase64, turnId);
                  }
                } else if (event.type === 'done') {
                  replyText = event.fullText;
                  const serverDuration = Math.round(performance.now() - reqStartTime);
                  if (event.audioBase64 && !hasStartedAudio && activeTurnIdRef.current === turnId) {
                    hasStartedAudio = true;
                    setDebugHUD(prev => ({
                      ...prev,
                      apiStatus: '200 OK (Stream)',
                      latencyMs: serverDuration,
                      audioStatus: 'Playing ⚡'
                    }));
                    if (isMountedRef.current) {
                      await playDirectAudio(event.audioBase64, turnId);
                    }
                  }
                }
              } catch (e) {}
            }
          }
        }
      } else {
        const data = await coachRes.json();
        const timeToAudio = Math.round(performance.now() - reqStartTime);
        setDebugHUD(prev => ({
          ...prev,
          apiStatus: '200 OK (JSON)',
          latencyMs: timeToAudio
        }));
        replyText = data.content || data.replyText || `I hear you, ${resolvedUserName}. How can I best guide your health goals today?`;
        if (data.audioBase64 && isMountedRef.current && activeTurnIdRef.current === turnId) {
          await playDirectAudio(data.audioBase64, turnId);
          hasStartedAudio = true;
        }
      }

      if (!hasStartedAudio && activeTurnIdRef.current === turnId) {
        turnInProgressRef.current = false;
        activeTurnIdRef.current = null;
        updateVoiceState('idle');
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[AICoachVoiceModal] AI processing error:', err);
      if (activeTurnIdRef.current === turnId) {
        turnInProgressRef.current = false;
        activeTurnIdRef.current = null;
        updateVoiceState('idle', 'API_ERROR_RESET');
      }
    }
  }, [conversationId, userId, resolvedUserName, voiceLang, playDirectAudio, speakText, updateVoiceState, unlockAudioContext]);

  // STT speech recognition starter with snappy VAD cadence
  const startListening = useCallback(() => {
    if (
      turnInProgressRef.current ||
      voiceStateRef.current === 'thinking' ||
      voiceStateRef.current === 'searching' ||
      voiceStateRef.current === 'preparing' ||
      voiceStateRef.current === 'speaking' ||
      isMutedRef.current ||
      !isMountedRef.current
    ) {
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser.');
      updateVoiceState('idle');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang;
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {};

      recognition.onresult = (event: any) => {
        if (turnInProgressRef.current || voiceStateRef.current !== 'listening') {
          return;
        }

        let fullTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const part = res[0]?.transcript || '';
          if (res.isFinal) {
            fullTranscript += (fullTranscript ? ' ' : '') + part.trim();
          } else {
            interimTranscript += (interimTranscript ? ' ' : '') + part.trim();
          }
        }

        const currentText = (fullTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
        if (currentText) {
          pendingSpokenTextRef.current = currentText;
          setLiveInterim(currentText);
        }

        if (isMountedRef.current && currentText.length >= 2) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

          silenceTimerRef.current = setTimeout(() => {
            if (
              voiceStateRef.current === 'listening' &&
              !turnInProgressRef.current &&
              isMountedRef.current
            ) {
              turnInProgressRef.current = true;
              try { recognition.abort(); } catch (e) {}
              const toProcess = pendingSpokenTextRef.current || currentText;
              pendingSpokenTextRef.current = '';
              const normalized = normalizeSpokenInput(toProcess);
              processUserSpeech(normalized);
            }
          }, 800);
        }
      };

      recognition.onerror = (event: any) => {
        if (turnInProgressRef.current || voiceStateRef.current !== 'listening') {
          return;
        }

        if (event.error === 'not-allowed') {
          setHasMicPermission(false);
          setPermissionBlocked(true);
          toast.error('Microphone access blocked.');
          updateVoiceState('idle');
        }
      };

      recognition.onend = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (turnInProgressRef.current || voiceStateRef.current !== 'listening') {
          return;
        }

        const pendingText = pendingSpokenTextRef.current.trim();
        if (pendingText.length >= 2 && isMountedRef.current) {
          turnInProgressRef.current = true;
          pendingSpokenTextRef.current = '';
          const normalized = normalizeSpokenInput(pendingText);
          processUserSpeech(normalized);
          return;
        }

        if (isMountedRef.current && !isMutedRef.current && !turnInProgressRef.current) {
          setTimeout(startListening, 80);
        }
      };

      recognitionRef.current = recognition;
      updateVoiceState('listening', 'START_LISTENING');
      recognition.start();
    } catch (e) {
      console.error('[AICoachVoiceModal] Start listening error:', e);
      updateVoiceState('idle');
    }
  }, [voiceLang, processUserSpeech, updateVoiceState]);

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
              onClick={interruptAgent}
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
