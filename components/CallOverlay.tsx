"use client"
import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/api/translation';
import { Video, Phone, Minimize2, PhoneOff, MicOff, VideoOff, Volume2 } from 'lucide-react';

interface CallOverlayProps {
    type: 'voice' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    caller: {
        name: string;
        avatar?: string;
    };
    onAccept: () => void;
    onDecline: () => void;
    onEnd: () => void;
    direction: 'incoming' | 'outgoing';
    localStream?: MediaStream;
    remoteStream?: MediaStream;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

export default function CallOverlay({
    type,
    status,
    caller,
    direction,
    onAccept,
    onDecline,
    onEnd,
    localStream,
    remoteStream,
    isMinimized = false,
    onToggleMinimize
}: CallOverlayProps) {
    const { t } = useTranslation();
    const [duration, setDuration] = useState(0);
    const remoteAudioRef = React.useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (remoteStream && remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(e => console.error("CallOverlay: Failed to play remote audio", e));
        }
    }, [remoteStream]);

    useEffect(() => {
        let interval: any;
        if (status === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status]);

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (status === 'ended') {
        return (
            <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
                <div className="text-center">
                    <h2 className="text-2xl font-light mb-2">Call Ended</h2>
                    <p className="text-[#8696A0]">{formatDuration(duration)}</p>
                </div>
            </div>
        );
    }

    if (isMinimized) {
        return (
            <div
                onClick={onToggleMinimize}
                className="fixed bottom-20 right-4 z-[9999] w-20 h-20 rounded-2xl bg-[#00A884] shadow-2xl flex items-center justify-center cursor-pointer hover:scale-105 transition-all overflow-hidden border-2 border-white/20"
            >
                <img
                    src={caller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.name)}&background=00A884&color=fff&size=100`}
                    alt={caller.name}
                    className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    {type === 'video' ? <Video className="text-white animate-pulse" size={22} /> : <Phone className="text-white animate-pulse" size={22} />}
                    <span className="text-[10px] text-white font-bold">{formatDuration(duration)}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-[#0b141a] flex flex-col items-center justify-between p-8 md:p-12 text-white animate-in fade-in zoom-in duration-300">
            {/* Minimize Toggle */}
            <button
                onClick={onToggleMinimize}
                className="absolute top-6 left-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
            >
                <Minimize2 className="text-white" size={20} />
            </button>
            {/* Hidden Audio for Remote Stream */}
            <audio ref={remoteAudioRef} autoPlay />
            <div className="flex flex-col items-center gap-6 mt-12 animate-in slide-in-from-top-10 duration-500">
                <div className="size-32 rounded-full overflow-hidden ring-4 ring-[#00A884]/30">
                    <img
                        src={caller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.name)}&background=00A884&color=fff&size=256`}
                        alt={caller.name}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="text-center">
                    <h2 className="text-3xl font-light mb-2">{caller.name}</h2>
                    <p className="text-[#8696A0] uppercase tracking-[0.2em] text-sm animate-pulse">
                        {status === 'ringing' ? (direction === 'outgoing' ? 'Calling...' : 'Incoming Call...') : formatDuration(duration)}
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-center gap-8 mb-12 w-full max-w-sm">
                {status === 'ringing' ? (
                    <div className="flex items-center justify-around w-full">
                        <button
                            onClick={onDecline}
                            className="size-16 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl active:scale-95 transition-all"
                        >
                            <PhoneOff size={28} />
                        </button>
                        <button
                            onClick={onAccept}
                            className="size-16 rounded-full bg-[#25D366] hover:bg-[#1ebc57] flex items-center justify-center shadow-xl active:scale-95 transition-all animate-bounce"
                        >
                            <Phone size={28} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-8 w-full">
                        <div className="flex items-center justify-around w-full px-4">
                            <button className="size-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                                <MicOff size={22} />
                            </button>
                            <button className="size-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                                <VideoOff size={22} />
                            </button>
                            <button className="size-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                                <Volume2 size={22} />
                            </button>
                        </div>
                        <button
                            onClick={onEnd}
                            className="size-20 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl active:scale-90 transition-all"
                        >
                            <PhoneOff size={36} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
