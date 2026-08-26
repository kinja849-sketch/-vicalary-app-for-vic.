"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, ShieldCheck, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/lib/api/translation';
import { supabase } from '@/lib/supabase';
import HealthCoachSphere from '@/components/avatar/HealthCoachSphere';

interface AICoachVoiceModalProps {
  userId: string;
  userName?: string;
  userAvatar?: string | null;
  conversationId: string;
  onClose: () => void;
}

import { normalizeSpokenInput } from '@/lib/services/ai/SpeechNormalizer';

type ConversationState = 'idle' | 'listening' | 'transcribing' | 'processing' | 'speaking' | 'error';

interface TurnMetricsHUD {
  turnId: string | null;
  state: ConversationState;
  heard: string;
  apiStatus: string;
  latencyMs: number | null;
  audioStatus: string;
}

export default function AICoachVoiceModal({
  userId,
  userName = 'Vic',
  conversationId,
  onClose,
}: AICoachVoiceModalProps) {
  const queryClient = useQueryClient();

  const resolvedUserName = (!userName || userName === 'User' || userName === 'there') ? 'Vic' : userName;

  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [state, setState] = useState<ConversationState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  // Default explicitly to 'en-US' (independent of IP geographic location)
  const [voiceLang, setVoiceLang] = useState<'en-US' | 'id-ID' | 'es-ES' | 'ar-SA' | 'fr-FR'>('en-US');
  const [liveInterim, setLiveInterim] = useState<string>('');
  const [showDebugHUD, setShowDebugHUD] = useState(false);
  const [debugHUD, setDebugHUD] = useState<TurnMetricsHUD>({
    turnId: null,
    state: 'idle',
    heard: '',
    apiStatus: 'Ready',
    latencyMs: null,
    audioStatus: 'Ready'
  });

  const voiceStateRef = useRef<ConversationState>('idle');
  const activeTurnIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(false);
  const isAudioMutedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMountedRef = useRef(true);
  const silenceTimerRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`);
  const turnIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTurnsRef = useRef<{ role: 'user' | 'assistant'; content: string; created_at: string }[]>([]);

  // Mobile Web Audio unlocker
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
        console.log('[VOICE] AudioContext unlocked successfully');
      }
    } catch (err) {
      console.warn('[VOICE] AudioContext unlock warning:', err);
    }
  }, []);

  // Synchronized state updater
  const updateVoiceState = useCallback((nextState: ConversationState) => {
    voiceStateRef.current = nextState;
    if (isMountedRef.current) {
      setState(nextState);
      setDebugHUD(prev => ({ ...prev, state: nextState }));
    }
    console.log(`[VOICE TURN ${activeTurnIdRef.current || 'INIT'}] STATE: ${nextState}`);
  }, []);

  // Sync mute state refs
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  // Check initial microphone permission on mount
  useEffect(() => {
    isMountedRef.current = true;

    const checkPermission = async () => {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' as any });
          if (status.state === 'granted') {
            setHasMicPermission(true);
          } else {
            setHasMicPermission(false);
          }
          status.onchange = () => {
            if (isMountedRef.current) {
              setHasMicPermission(status.state === 'granted');
            }
          };
        } catch {
          setHasMicPermission(false);
        }
      } else {
        setHasMicPermission(false);
      }
    };

    checkPermission();

    return () => {
      isMountedRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        } catch (e) {}
      }
    };
  }, []);

  // Instant interruption helper: cuts off AI speech and aborts in-flight turn immediately
  const interruptAgent = useCallback(() => {
    console.log('[VOICE] User interrupt triggered');
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
    activeTurnIdRef.current = null;
    if (isMountedRef.current && !isMutedRef.current) {
      updateVoiceState('listening');
      setTimeout(startListening, 150);
    } else {
      updateVoiceState('idle');
    }
  }, [updateVoiceState]);

  // Direct Fast Audio Playback from Server Payload
  const playDirectAudio = useCallback(async (audioSrc: string, turnId: string) => {
    await unlockAudioContext();
    if (!isMountedRef.current || isAudioMutedRef.current) {
      activeTurnIdRef.current = null;
      if (isMountedRef.current && !isMutedRef.current) {
        updateVoiceState('listening');
        startListening();
      }
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    updateVoiceState('speaking');
    setDebugHUD(prev => ({ ...prev, audioStatus: 'Playing ⚡' }));

    try {
      const audio = new Audio(audioSrc);
      currentAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = (e) => {
          console.warn('[AICoachVoiceModal] Audio error:', e);
          resolve();
        };
        audio.play().catch((playErr) => {
          console.warn('[AICoachVoiceModal] audio.play() prevented by browser:', playErr);
          resolve();
        });
      });
    } catch (err) {
      console.warn('[AICoachVoiceModal] Direct audio playback error:', err);
    } finally {
      currentAudioRef.current = null;

      // Only transition back to listening if this turn is still the active turn
      if (activeTurnIdRef.current === turnId) {
        activeTurnIdRef.current = null;
        setDebugHUD(prev => ({ ...prev, audioStatus: 'Idle' }));
        if (isMountedRef.current && !isMutedRef.current) {
          console.log(`[VOICE TURN ${turnId}] 5. Audio ended -> Returning to LISTENING`);
          updateVoiceState('listening');
          startListening();
        } else if (isMountedRef.current) {
          updateVoiceState('idle');
        }
      }
    }
  }, [updateVoiceState, unlockAudioContext]);

  // Strict OpenAI Fast Neural Voice Playback (Fallback)
  const speakText = useCallback(async (text: string, turnId: string) => {
    await unlockAudioContext();
    if (!isMountedRef.current || isAudioMutedRef.current || !text.trim()) {
      activeTurnIdRef.current = null;
      if (isMountedRef.current && !isMutedRef.current) {
        updateVoiceState('listening');
        startListening();
      }
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'alloy',
          speed: 1.05,
          language: voiceLang.split('-')[0]
        }),
        signal: controller.signal,
      }).catch(() => null);

      if (res && res.ok && isMountedRef.current && activeTurnIdRef.current === turnId) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        updateVoiceState('speaking');
        setDebugHUD(prev => ({ ...prev, audioStatus: 'Playing ⚡' }));

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });

        try { URL.revokeObjectURL(audioUrl); } catch (e) {}
      }
    } catch (err) {
      console.warn('[AICoachVoiceModal] Voice playback error:', err);
    } finally {
      currentAudioRef.current = null;
      abortControllerRef.current = null;

      if (activeTurnIdRef.current === turnId) {
        activeTurnIdRef.current = null;
        setDebugHUD(prev => ({ ...prev, audioStatus: 'Idle' }));
        if (isMountedRef.current && !isMutedRef.current) {
          updateVoiceState('listening');
          startListening();
        } else if (isMountedRef.current) {
          updateVoiceState('idle');
        }
      }
    }
  }, [voiceLang, updateVoiceState, unlockAudioContext]);

  // Process user speech with AI Health Coach (Single-Flight Turn Manager)
  const processUserSpeech = useCallback(async (userText: string) => {
    const cleanedText = userText.trim();
    if (!cleanedText || cleanedText.length < 2 || !isMountedRef.current || activeTurnIdRef.current !== null) {
      return;
    }

    const turnId = crypto.randomUUID ? crypto.randomUUID() : `turn_${Date.now()}`;
    activeTurnIdRef.current = turnId;
    turnIdRef.current += 1;
    const currentTurn = turnIdRef.current;

    await unlockAudioContext();

    // Interrupt any previous controller/audio
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort(); } catch (e) {}
    }
    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    updateVoiceState('processing');
    setLiveInterim('');
    setDebugHUD(prev => ({
      ...prev,
      turnId: turnId.slice(0, 8),
      heard: cleanedText,
      apiStatus: 'Dispatching...',
      latencyMs: null,
      audioStatus: 'Waiting'
    }));

    // Record user turn in-memory
    sessionTurnsRef.current.push({
      role: 'user',
      content: cleanedText,
      created_at: new Date().toISOString(),
    });

    try {
      // 1. Non-blocking user speech persistence
      supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: cleanedText,
        message_type: 'text',
        created_at: new Date().toISOString()
      }).then();

      let userLocation = null;
      try {
        const locCache = localStorage.getItem('vicalary_location_v2');
        if (locCache) userLocation = JSON.parse(locCache).data;
      } catch (e) {}

      // 2. Obtain active Supabase session for authenticated API communication
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      console.log('[VOICE AUTH]', {
        authenticated: Boolean(session?.user),
        hasSession: Boolean(session),
        hasAccessToken: Boolean(session?.access_token),
        userId: session?.user?.id || userId || 'none',
      });

      if (!session?.access_token) {
        throw new Error('User is not authenticated');
      }

      const reqStartTime = performance.now();
      console.log(`[VOICE TURN ${turnId}] 2. Dispatched to /api/conversation/process...`);

      // 3. Call unified conversation orchestrator with live streaming
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
          location_context: userLocation,
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
        throw new Error(`AI Coach process conversation failed with status ${coachRes.status}`);
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
                if (event.type === 'first_audio' && event.audioBase64 && !hasStartedAudio && activeTurnIdRef.current === turnId) {
                  hasStartedAudio = true;
                  const timeToAudio = Math.round(performance.now() - reqStartTime);
                  console.log(`[VOICE TURN ${turnId}] 3. First audio chunk received (${timeToAudio}ms ⚡)`, event.metrics);
                  setDebugHUD(prev => ({
                    ...prev,
                    apiStatus: '200 OK (Stream)',
                    latencyMs: timeToAudio,
                    audioStatus: 'Playing ⚡'
                  }));
                  if (isMountedRef.current && !isAudioMutedRef.current) {
                    playDirectAudio(event.audioBase64, turnId).catch(err => console.error('[AICoachVoiceModal] Audio play error:', err));
                  }
                } else if (event.type === 'done') {
                  replyText = event.fullText;
                  const serverDuration = Math.round(performance.now() - reqStartTime);
                  console.log(`[VOICE TURN ${turnId}] 4. Complete turn finished in ${serverDuration}ms:`, event.metrics);
                }
              } catch (e) {}
            }
          }
        }
      } else {
        // Fallback for standard JSON response
        const data = await coachRes.json();
        const timeToAudio = Math.round(performance.now() - reqStartTime);
        setDebugHUD(prev => ({
          ...prev,
          apiStatus: '200 OK (JSON)',
          latencyMs: timeToAudio
        }));
        replyText = data.content || data.replyText || data.message || `I hear you, ${resolvedUserName}. How can I best guide your health goals today?`;
        if (data.audioBase64 && isMountedRef.current && !isAudioMutedRef.current && activeTurnIdRef.current === turnId) {
          console.log(`[VOICE TURN ${turnId}] 3. Audio payload received (${timeToAudio}ms ⚡)`, data.metrics);
          await playDirectAudio(data.audioBase64, turnId);
          hasStartedAudio = true;
        }
      }

      if (!replyText) {
        replyText = `I hear you, ${resolvedUserName}. How can I best guide your health goals today?`;
      }

      // Clean spoken text: strip asterisks, bullets, markdown headers
      replyText = replyText.replace(/[*#_~`>]/g, '').trim();

      sessionTurnsRef.current.push({
        role: 'assistant',
        content: replyText,
        created_at: new Date().toISOString(),
      });

      if (!hasStartedAudio && activeTurnIdRef.current === turnId) {
        await speakText(replyText, turnId);
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log(`[VOICE] Turn ${turnId} aborted cleanly`);
        return;
      }
      console.error('[AICoachVoiceModal] AI processing error:', err);
      if (activeTurnIdRef.current === turnId) {
        activeTurnIdRef.current = null;
        updateVoiceState('listening');
        if (isMountedRef.current && !isMutedRef.current) {
          startListening();
        }
      }
    }
  }, [conversationId, userId, resolvedUserName, voiceLang, speakText, playDirectAudio, updateVoiceState]);

  // Snappy turn-taking continuous speech recognition
  const startListening = useCallback(() => {
    if (
      voiceStateRef.current === 'processing' ||
      voiceStateRef.current === 'speaking' ||
      activeTurnIdRef.current !== null ||
      isMutedRef.current ||
      !isMountedRef.current
    ) {
      console.log(`[STT] startListening ignored: state=${voiceStateRef.current}, activeTurn=${activeTurnIdRef.current}`);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      updateVoiceState('idle');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      const recognition = new SpeechRecognition();
      // Explicitly configure STT language from user setting (default 'en-US', never derived from IP)
      recognition.lang = voiceLang;
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        if (
          isMountedRef.current &&
          voiceStateRef.current === 'listening' &&
          activeTurnIdRef.current === null
        ) {
          console.log('[STT] Speech recognizer active & listening');
        }
      };

      recognition.onresult = (event: any) => {
        if (voiceStateRef.current === 'processing' || voiceStateRef.current === 'speaking' || activeTurnIdRef.current !== null) {
          return;
        }

        let interimText = '';
        let finalText = '';
        let confidenceScore = 0.95;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const part = res[0]?.transcript || '';
          if (res[0]?.confidence) {
            confidenceScore = res[0].confidence;
          }
          if (res.isFinal) {
            finalText += part;
          } else {
            interimText += part;
          }
        }

        const currentText = (finalText || interimText).trim();
        if (currentText) {
          setLiveInterim(currentText);
          console.log(`[VOICE turn_${turnIdRef.current}] Lang: ${voiceLang} | Live: "${currentText}" (${Math.round(confidenceScore * 100)}%)`);
        }

        if (isMountedRef.current && currentText.length >= 2) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

          // 850ms natural breathing cadence VAD silence detection
          silenceTimerRef.current = setTimeout(() => {
            if (
              voiceStateRef.current === 'listening' &&
              activeTurnIdRef.current === null &&
              isMountedRef.current
            ) {
              try { recognition.abort(); } catch (e) {}
              const normalized = normalizeSpokenInput(currentText);
              console.log(`[VOICE turn_${turnIdRef.current}] Finalized: "${normalized}" (${voiceLang})`);
              processUserSpeech(normalized);
            }
          }, 850);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setHasMicPermission(false);
          toast.error('Microphone permission blocked. Please enable mic access.');
          updateVoiceState('idle');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[AICoachVoiceModal] STT Error:', event.error);
        }
        if (event.error !== 'no-speech' && event.error !== 'aborted' && isMountedRef.current && activeTurnIdRef.current === null) {
          updateVoiceState('idle');
        }
      };

      recognition.onend = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (
          isMountedRef.current &&
          voiceStateRef.current === 'listening' &&
          activeTurnIdRef.current === null &&
          !isMutedRef.current
        ) {
          console.log('[STT] Starting because: IDLE_LISTENING_LOOP');
          setTimeout(startListening, 300);
        } else {
          console.log(`[STT] Not restarting onend (state: ${voiceStateRef.current} | activeTurn: ${activeTurnIdRef.current})`);
        }
      };

      recognitionRef.current = recognition;
      updateVoiceState('listening');
      recognition.start();
    } catch (e) {
      console.error('[AICoachVoiceModal] Start listening error:', e);
      updateVoiceState('idle');
    }
  }, [voiceLang, processUserSpeech, updateVoiceState]);

  // Request Microphone Permission with echo cancellation and noise suppression
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      stream.getTracks().forEach(track => track.stop());
      setHasMicPermission(true);
      setTimeout(() => {
        startListening();
      }, 200);
    } catch (err) {
      console.error('[AICoachVoiceModal] Microphone access denied:', err);
      toast.error('Microphone permission is required to talk with Vee.');
      setHasMicPermission(false);
    }
  };

  // Auto-start listening if permission is already granted on mount
  useEffect(() => {
    if (hasMicPermission === true) {
      startListening();
    }
  }, [hasMicPermission, startListening]);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      isMutedRef.current = false;
      updateVoiceState('listening');
      startListening();
    } else {
      setIsMuted(true);
      isMutedRef.current = true;
      interruptAgent();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      updateVoiceState('idle');
    }
  };

  // Exit voice mode and sync thread
  const handleClose = () => {
    interruptAgent();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    onClose();
  };

  // Compute clean status label
  const getStatusLabel = () => {
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'transcribing':
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'Vee Speaking...';
      case 'idle':
      default:
        return isMuted ? 'Muted' : 'Tap blob to speak';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl flex flex-col justify-between items-center p-6 select-none text-white overflow-hidden font-display"
      >
        {/* Clean Top Header with Language Selector & Live Diagnostic HUD */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-md pt-2 px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-100">Health Coach</h3>
            
            {/* Language Selector Badge */}
            <div className="flex items-center bg-white/10 rounded-full px-2 py-0.5 text-xs font-semibold border border-white/10">
              <select
                value={voiceLang}
                onChange={(e) => {
                  const newLang = e.target.value as any;
                  setVoiceLang(newLang);
                  if (recognitionRef.current) {
                    try { recognitionRef.current.abort(); } catch (err) {}
                  }
                  setTimeout(startListening, 150);
                }}
                className="bg-transparent text-emerald-400 outline-none cursor-pointer py-0.5 pr-1 font-mono text-[11px]"
                title="Select Speech Recognition Language"
              >
                <option value="en-US" className="bg-slate-900 text-white">🇺🇸 English (en-US)</option>
                <option value="id-ID" className="bg-slate-900 text-white">🇮🇩 Indonesian (id-ID)</option>
                <option value="es-ES" className="bg-slate-900 text-white">🇪🇸 Spanish (es-ES)</option>
                <option value="ar-SA" className="bg-slate-900 text-white">🇸🇦 Arabic (ar-SA)</option>
                <option value="fr-FR" className="bg-slate-900 text-white">🇫🇷 French (fr-FR)</option>
              </select>
            </div>

            {/* Diagnostic HUD Toggle */}
            <button
              onClick={() => setShowDebugHUD(!showDebugHUD)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                showDebugHUD ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-white/10 text-slate-300 hover:text-white'
              }`}
              title="Toggle Mobile Voice Diagnostics"
            >
              <Activity size={12} />
              <span>HUD</span>
            </button>
          </div>

          <button
            onClick={handleClose}
            className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-slate-300 hover:text-white transition-all"
            title="Close voice mode"
            aria-label="Close voice mode"
          >
            <X size={20} />
          </button>
        </div>

        {/* Center Main Stage - 3D Organic Morphing Blob */}
        {hasMicPermission === false ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 flex flex-col items-center justify-center gap-6 w-full max-w-sm my-auto text-center px-6 py-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 animate-pulse">
              <Mic size={32} />
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-bold text-slate-100">Enable Microphone</h4>
              <p className="text-sm text-slate-300 leading-relaxed">
                Allow microphone access to talk directly with Vee with instant voice response.
              </p>
            </div>

            <button
              onClick={requestMicPermission}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} />
              <span>Allow Microphone & Start</span>
            </button>
          </motion.div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center gap-4 w-full max-w-md my-auto text-center px-4">
            <div className="relative flex items-center justify-center">
              {/* Ambient Aura Glow */}
              <motion.div
                animate={{
                  scale: state === 'speaking' ? [1, 1.35, 1] : (state === 'processing' || state === 'transcribing') ? [1, 1.25, 1] : [1, 1.1, 1],
                  opacity: state === 'speaking' ? [0.45, 0.75, 0.45] : [0.2, 0.4, 0.2]
                }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className={`absolute inset-0 rounded-full blur-3xl ${
                  (state === 'processing' || state === 'transcribing') ? 'bg-purple-500/40' : 'bg-emerald-500/40'
                }`}
              />

              {/* 3D Morphing Blob */}
              <div onClick={interruptAgent} className="cursor-pointer z-10 active:scale-95 transition-transform" title="Tap to interrupt">
                <HealthCoachSphere
                  state={state === 'processing' || state === 'transcribing' ? 'thinking' : (state === 'error' ? 'idle' : state)}
                  size={240}
                  className="shadow-2xl shadow-emerald-950/80"
                />
              </div>
            </div>

            {/* Minimalist Status Text */}
            <p className="text-xs uppercase tracking-widest font-black text-emerald-400 transition-all">
              {getStatusLabel()}
            </p>

            {/* Live Interim Transcript Feedback */}
            {liveInterim && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xs px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs text-slate-200 shadow-lg text-center"
              >
                <span className="text-slate-400 mr-1.5 font-medium">Heard:</span>
                <span className="italic font-semibold text-white">"{liveInterim}"</span>
              </motion.div>
            )}

            {/* Real-Time Mobile Diagnostic HUD */}
            {showDebugHUD && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="w-full max-w-sm px-3.5 py-2.5 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/15 text-[11px] font-mono text-slate-300 space-y-1.5 shadow-2xl text-left"
              >
                <div className="flex justify-between items-center text-emerald-400 font-bold border-b border-white/10 pb-1">
                  <span className="flex items-center gap-1.5">
                    <Activity size={12} className="text-emerald-400 animate-pulse" />
                    <span>MOBILE DIAGNOSTICS</span>
                  </span>
                  <span className="uppercase text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    {debugHUD.state}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-0.5 text-[10.5px]">
                  <div><span className="text-slate-500">Turn:</span> <span className="text-slate-200 font-bold">{debugHUD.turnId || 'none'}</span></div>
                  <div><span className="text-slate-500">API:</span> <span className="text-emerald-300 font-bold">{debugHUD.apiStatus}</span></div>
                  <div><span className="text-slate-500">TTS:</span> <span className="text-cyan-300 font-bold">{debugHUD.audioStatus}</span></div>
                  <div><span className="text-slate-500">Latency:</span> <span className="text-amber-300 font-bold">{debugHUD.latencyMs ? `${debugHUD.latencyMs}ms` : '--'}</span></div>
                </div>
                {debugHUD.heard && (
                  <div className="truncate text-slate-200 border-t border-white/10 pt-1 text-[10.5px]">
                    <span className="text-slate-500">Last Utterance:</span> <span className="italic">"{debugHUD.heard}"</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* Minimalist Bottom Control Pill */}
        <div className="relative z-10 w-full max-w-xs flex items-center justify-center gap-4 pb-4">
          {hasMicPermission && (
            <div className="flex items-center gap-4 p-2 px-4 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl">
              {/* Mute / Unmute Mic Button */}
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full transition-all duration-200 ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Mute / Unmute Voice Output */}
              <button
                onClick={() => {
                  if (!isAudioMuted) interruptAgent();
                  setIsAudioMuted(!isAudioMuted);
                }}
                className={`p-3 rounded-full transition-all duration-200 ${
                  isAudioMuted
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isAudioMuted ? 'Unmute Voice' : 'Mute Voice'}
              >
                {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
