'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, ChefHat, HeartPulse, Loader2 } from 'lucide-react';
import HealthCoachSphere from '@/components/avatar/HealthCoachSphere';
import { useDailyCall } from '@/hooks/useDailyCall';

interface VoiceAgentCallProps {
  mode: 'cooking_guide' | 'health_coach';
  language?: string;
  userId?: string;
  recipeContext?: any;
  extraContext?: string;
  onClose: () => void;
}

function InnerAgentCallUI({
  mode,
  status,
  isMuted,
  onToggleMic,
  onClose,
}: {
  mode: 'cooking_guide' | 'health_coach';
  status: 'idle' | 'joining' | 'joined' | 'leaving' | 'error';
  isMuted: boolean;
  onToggleMic: () => void;
  onClose: () => void;
}) {
  const isChef = mode === 'cooking_guide';
  const title = isChef ? 'AI Cooking Guide' : 'Health & Wellness Coach';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-between p-8 text-white animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mt-8">
        <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {isChef ? <ChefHat size={36} /> : <HeartPulse size={36} />}
        </div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-emerald-400 font-medium capitalize animate-pulse">
          {status === 'joined' ? 'Connected • Listening' : 'Connecting session...'}
        </p>
      </div>

      {/* 3D Sphere Avatar Display */}
      <div className="relative my-8 flex items-center justify-center">
        <HealthCoachSphere
          state={status === 'joined' ? 'listening' : 'thinking'}
          intent={isChef ? 'meal_planning' : 'factual_research'}
          size={220}
          className="shadow-2xl shadow-emerald-950/80"
        />
        {status !== 'joined' && (
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center z-20">
            <Loader2 className="animate-spin text-emerald-400" size={44} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={onToggleMic}
          className={`size-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isMuted
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
        </button>

        <button
          onClick={onClose}
          className="size-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all"
          title="End Voice Call"
        >
          <PhoneOff size={28} />
        </button>
      </div>
    </div>
  );
}

export default function VoiceAgentCall({
  mode,
  language = 'en',
  userId = 'user-guest',
  recipeContext,
  extraContext,
  onClose,
}: VoiceAgentCallProps) {
  const { joinCall, leaveCall, toggleAudio, status } = useDailyCall();
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  const handleToggleMic = useCallback(() => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    toggleAudio(!nextState);
  }, [isMuted, toggleAudio]);

  const handleEndCall = useCallback(async () => {
    // 1. Leave Daily Room
    await leaveCall();

    // 2. Notify Python backend to stop session
    if (activeCallId) {
      try {
        await fetch('/api/voice-agent/session', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: activeCallId }),
        }).catch((e) => console.warn('[VoiceAgentCall] Stop backend warning:', e));
      } catch (e) {
        console.warn(e);
      }
    }

    onClose();
  }, [leaveCall, activeCallId, onClose]);

  useEffect(() => {
    let isMounted = true;

    async function initCall() {
      try {
        const res = await fetch('/api/voice-agent/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            mode,
            language,
            recipe_context: recipeContext,
            extra_context: extraContext,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create voice agent session');
        }

        const data = await res.json();
        if (!data.roomUrl || !data.callId) {
          throw new Error(data.error || 'Invalid session response from server');
        }

        if (!isMounted) return;

        setActiveCallId(data.callId);

        // Client joins Daily room as dynamic voice participant
        await joinCall(data.roomUrl, false, 'User');

      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Call initialization failed');
        }
      }
    }

    initCall();

    return () => {
      isMounted = false;
    };
  }, [mode, language, userId, recipeContext, extraContext, joinCall]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-center p-6 text-white text-center">
        <h3 className="text-xl font-semibold mb-2 text-red-400">Connection Error</h3>
        <p className="text-sm text-gray-300 mb-6">{error}</p>
        <button
          onClick={handleEndCall}
          className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <InnerAgentCallUI
      mode={mode}
      status={status}
      isMuted={isMuted}
      onToggleMic={handleToggleMic}
      onClose={handleEndCall}
    />
  );
}
