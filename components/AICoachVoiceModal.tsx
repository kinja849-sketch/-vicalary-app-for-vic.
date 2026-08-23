"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Sparkles, Volume2, VolumeX, Loader2, Brain, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import HealthCoachSphere, { AvatarState } from '@/components/avatar/HealthCoachSphere';

interface AICoachVoiceModalProps {
  userId: string;
  userName?: string;
  userAvatar?: string | null;
  conversationId: string;
  onClose: () => void;
}

type ConversationState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'researching' | 'speaking';

export default function AICoachVoiceModal({
  userId,
  userName = 'User',
  userAvatar,
  conversationId,
  onClose,
}: AICoachVoiceModalProps) {
  const [state, setState] = useState<ConversationState>('idle');
  const [intent, setIntent] = useState<string>('casual_chat');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const lastRecognizedTextRef = useRef<string>('');
  const hasProcessedSpeechRef = useRef<boolean>(false);
  const audioUrlsRef = useRef<string[]>([]);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      audioUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
      audioUrlsRef.current = [];
    };
  }, []);

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => setSessionDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Play AI voice via /api/cooking-assistant/tts (OpenAI HD Voice: nova) or SpeechSynthesis fallback
  const speakText = useCallback(async (text: string) => {
    if (!isMountedRef.current || isAudioMuted) return;

    isSpeakingRef.current = true;
    setState('speaking');

    try {
      // 1. Try OpenAI HD TTS API with 'nova' natural human voice
      const res = await fetch('/api/cooking-assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova', speed: 1.0 }),
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlsRef.current.push(audioUrl);
        
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      } else {
        // Fallback to browser SpeechSynthesis
        await new Promise<void>((resolve) => {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          } else {
            resolve();
          }
        });
      }
    } catch (err) {
      console.warn('[AICoachVoiceModal] TTS Playback error, using fallback:', err);
    } finally {
      isSpeakingRef.current = false;
      if (isMountedRef.current && !isMuted) {
        // Automatically start listening again for continuous back-and-forth conversation!
        setTimeout(() => {
          if (isMountedRef.current && !isMuted) {
            startListening();
          }
        }, 400);
      } else if (isMountedRef.current) {
        setState('idle');
      }
    }
  }, [isAudioMuted, isMuted]);

  // Process user message with AI Health Coach
  const processUserSpeech = useCallback(async (userText: string) => {
    if (!userText.trim() || !isMountedRef.current) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    // Check if question asks for scientific/web research
    const isResearch = /research|study|science|scientific|evidence|proven|why|how does|benefit|side effect|ingredients|calorie|protein|macro|micro|vitamin|longevity|intermittent fasting|supplement|ketogenic|keto|creatine|recommend|best|what is/i.test(userText);
    
    if (isResearch) {
      setState('researching');
      setIntent('factual_research');
      setAiResponse('Searching internet & scientific database...');
    } else {
      setState('thinking');
      setAiResponse('Reasoning...');
    }

    try {
      // Send directly to coach-reply with voice_mode: true and user_name
      const coachRes = await fetch('/api/coach-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'INSERT',
          table: 'messages',
          voice_mode: true,
          user_name: userName,
          record: {
            id: `voice_${Date.now()}`,
            conversation_id: conversationId,
            sender_id: userId,
            content: userText,
            message_type: 'text',
            created_at: new Date().toISOString(),
          },
        }),
      });

      if (!coachRes.ok) throw new Error('AI Coach reply request failed');

      const data = await coachRes.json();
      
      // Extract direct reply text generated by LLM
      let replyText = data.replyText;
      if (!replyText || replyText === 'Already replied') {
        replyText = data.message && data.message !== 'Already replied' 
          ? data.message 
          : `I heard your question clearly ${userName}! How else can I guide your health and nutrition today?`;
      }

      const detectedIntent = data.intent || (isResearch ? 'factual_research' : 'casual_chat');

      setIntent(detectedIntent);
      setAiResponse(replyText);
      await speakText(replyText);

    } catch (err: any) {
      console.error('[AICoachVoiceModal] AI processing error:', err);
      const fallbackReply = `I heard your question ${userName}! Let's work together on your health goals. What would you like to explore next?`;
      setAiResponse(fallbackReply);
      await speakText(fallbackReply);
    }
  }, [conversationId, userId, userName, speakText]);

  // Start continuous Web Speech recognition with active silence detection
  const startListening = useCallback(() => {
    if (isSpeakingRef.current || isMuted || !isMountedRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      setState('idle');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      hasProcessedSpeechRef.current = false;
      lastRecognizedTextRef.current = '';

      const recognition = new SpeechRecognition();
      recognition.lang = document.documentElement.lang || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        if (isMountedRef.current) {
          setState('listening');
          setTranscript('Listening...');
        }
      };

      recognition.onresult = (event: any) => {
        let text = '';
        let hasFinalChunk = false;

        for (let i = 0; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            hasFinalChunk = true;
          }
        }

        const trimmedText = text.trim();

        if (isMountedRef.current && trimmedText) {
          lastRecognizedTextRef.current = trimmedText;
          setTranscript(trimmedText);

          // Reset silence timer on every new spoken chunk
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

          if (hasFinalChunk) {
            if (!hasProcessedSpeechRef.current) {
              hasProcessedSpeechRef.current = true;
              try { recognition.stop(); } catch(e) {}
              processUserSpeech(trimmedText);
            }
          } else {
            // Set 1.2s silence timer after speech pauses to auto-finalize
            silenceTimerRef.current = setTimeout(() => {
              if (!hasProcessedSpeechRef.current && lastRecognizedTextRef.current.trim()) {
                hasProcessedSpeechRef.current = true;
                try { recognition.stop(); } catch(e) {}
                processUserSpeech(lastRecognizedTextRef.current.trim());
              }
            }, 1200);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[AICoachVoiceModal] STT Error:', event.error);
        if (event.error !== 'no-speech' && isMountedRef.current) {
          setState('idle');
        }
      };

      recognition.onend = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (isMountedRef.current) {
          // If accumulated text hasn't been sent yet, process it now!
          if (!hasProcessedSpeechRef.current && lastRecognizedTextRef.current.trim()) {
            hasProcessedSpeechRef.current = true;
            processUserSpeech(lastRecognizedTextRef.current.trim());
          } else if (!isSpeakingRef.current && !isMuted) {
            setTimeout(startListening, 300);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('[AICoachVoiceModal] Start listening error:', e);
      setState('idle');
    }
  }, [isMuted, processUserSpeech]);

  // Start voice mode on mount
  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      // Speak initial greeting
      const initialGreeting = `Hello ${userName}! I am your AI Health Coach. I am listening, what would you like to discuss today?`;
      setAiResponse(initialGreeting);
      speakText(initialGreeting);
    }, 500);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [userName, speakText]);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      setState('idle');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-3xl flex flex-col justify-between items-center p-8 select-none text-white overflow-hidden font-display"
      >
        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between w-full max-w-md pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">AI Health Coach</h3>
              <p className="text-xs text-emerald-400 font-medium">Live Voice Mode ({formatDuration(sessionDuration)})</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Center 3D Health Coach Sphere Avatar */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-6 w-full max-w-md my-auto text-center px-4">
          <div className="relative flex items-center justify-center">
            {/* Ambient Background Aura */}
            <motion.div
              animate={{
                scale: state === 'speaking' ? [1, 1.3, 1] : state === 'researching' ? [1, 1.4, 1] : [1, 1.1, 1],
                opacity: state === 'speaking' ? [0.4, 0.7, 0.4] : [0.2, 0.5, 0.2]
              }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className={`absolute inset-0 rounded-full blur-3xl ${
                intent === 'factual_research' || state === 'researching'
                  ? 'bg-cyan-500/35'
                  : state === 'thinking'
                  ? 'bg-purple-500/35'
                  : 'bg-emerald-500/35'
              }`}
            />

            {/* 3D Sphere Avatar */}
            <HealthCoachSphere
              state={state}
              intent={intent}
              size={240}
              className="z-10 shadow-2xl shadow-emerald-950/80"
            />
          </div>

          {/* Active Intent / Research Indicator Badge */}
          {intent === 'factual_research' || state === 'researching' ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold backdrop-blur-md shadow-lg"
            >
              <Search size={14} className="animate-spin text-cyan-400" />
              <span>ChatGPT Web Research Active</span>
            </motion.div>
          ) : intent === 'nutrition_analysis' ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
              <Sparkles size={13} />
              <span>Nutritional Analysis</span>
            </div>
          ) : intent === 'motivation' ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium">
              <Sparkles size={13} />
              <span>Mindset & Support</span>
            </div>
          ) : null}

          {/* Transcript / AI Status Speech Bubble */}
          <div className="space-y-2 max-w-sm">
            <p className="text-xs uppercase tracking-widest font-black text-emerald-400/90">
              {state === 'listening' ? 'User Speaking' : state === 'researching' ? 'Searching Scientific Research...' : state === 'thinking' ? 'AI Coach Reasoning...' : state === 'speaking' ? 'AI Coach Speaking' : 'Tap Mic to Speak'}
            </p>
            <p className="text-sm font-medium text-slate-200 min-h-[52px] px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-inner leading-relaxed">
              {state === 'listening' ? (transcript || 'Listening to your voice...') : (aiResponse || 'Ready to chat back and forth!')}
            </p>
          </div>
        </div>

        {/* Bottom Control Dock */}
        <div className="relative z-10 w-full max-w-sm flex items-center justify-center gap-6 pb-6">
          {/* Mute Mic Button */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all duration-300 shadow-xl ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Mute Audio Output */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`p-4 rounded-full transition-all duration-300 shadow-xl ${
              isAudioMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
            title={isAudioMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
          >
            {isAudioMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={onClose}
            className="w-16 h-16 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-600/40 scale-105 active:scale-95 transition-all duration-200"
            title="End Voice Conversation"
          >
            <PhoneOff size={28} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
