'use client';

import React, { useEffect, useState } from 'react';
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  SpeakerLayout,
  CallControls,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { Mic, MicOff, PhoneOff, ChefHat, HeartPulse, Loader2 } from 'lucide-react';
import '@stream-io/video-react-sdk/dist/css/styles.css';

interface VoiceAgentCallProps {
  mode: 'cooking_guide' | 'health_coach';
  language?: string;
  userId?: string;
  onClose: () => void;
}

function InnerAgentCallUI({
  mode,
  onClose,
}: {
  mode: 'cooking_guide' | 'health_coach';
  onClose: () => void;
}) {
  const { useCallCallingState, useMicrophoneState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { isMute, microphone } = useMicrophoneState();

  const toggleMic = async () => {
    if (microphone) {
      await microphone.toggle();
    }
  };

  const isChef = mode === 'cooking_guide';
  const title = isChef ? 'AI Cooking Guide' : 'Health & Wellness Coach';
  const avatarUrl = isChef
    ? 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-between p-8 text-white animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mt-8">
        <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {isChef ? <ChefHat size={36} /> : <HeartPulse size={36} />}
        </div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-emerald-400 font-medium capitalize animate-pulse">
          {callingState === 'joined' ? 'Connected • Listening' : 'Connecting session...'}
        </p>
      </div>

      {/* Avatar Display */}
      <div className="relative my-8 flex items-center justify-center">
        <div className="size-44 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-2xl shadow-emerald-950/50">
          <img src={avatarUrl} alt={title} className="w-full h-full object-cover" />
        </div>
        {callingState !== 'joined' && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="animate-spin text-emerald-400" size={40} />
          </div>
        )}
      </div>

      {/* Stream Video audio tracks container */}
      <div className="hidden">
        <SpeakerLayout />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={toggleMic}
          className={`size-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isMute
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
          }`}
          title={isMute ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMute ? <MicOff size={28} /> : <Mic size={28} />}
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
  onClose,
}: VoiceAgentCallProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let createdCall: any = null;
    let videoClient: StreamVideoClient | null = null;

    async function initCall() {
      try {
        const res = await fetch('/api/voice-agent/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            mode,
            language,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to create voice agent session');
        }

        const data = await res.json();
        if (!data.apiKey || !data.token || !data.callId) {
          throw new Error(data.error || 'Invalid session response from server');
        }

        if (!isMounted) return;

        videoClient = new StreamVideoClient({
          apiKey: data.apiKey,
          user: { id: data.userId, name: 'User' },
          token: data.token,
        });

        createdCall = videoClient.call(data.callType || 'default', data.callId);
        await createdCall.join({ create: true });

        if (isMounted) {
          setClient(videoClient);
          setCall(createdCall);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Call initialization failed');
        }
      }
    }

    initCall();

    return () => {
      isMounted = false;
      if (createdCall) {
        createdCall.leave().catch(() => {});
      }
      if (videoClient) {
        videoClient.disconnectUser().catch(() => {});
      }
    };
  }, [mode, language, userId]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-center p-6 text-white text-center">
        <h3 className="text-xl font-semibold mb-2 text-red-400">Connection Error</h3>
        <p className="text-sm text-gray-300 mb-6">{error}</p>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="animate-spin text-emerald-400 mb-4" size={44} />
        <p className="text-sm text-gray-300 font-medium">Starting voice session...</p>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <InnerAgentCallUI mode={mode} onClose={onClose} />
      </StreamCall>
    </StreamVideo>
  );
}
