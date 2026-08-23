"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
    Mic, MicOff, Video, VideoOff, Phone, 
    Volume2, VolumeX, AlertCircle, Loader2, User, Radio, X, 
    ArrowLeftRight, Move
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    StreamVideo, 
    StreamVideoClient, 
    StreamCall, 
    ParticipantView,
    useCallStateHooks,
    useCall,
    CallingState
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { supabase } from '@/lib/supabase';

interface StreamCallOverlayProps {
    conversationId: string;
    userId: string;
    receiverId?: string;
    targetOnline?: boolean;
    userName?: string;
    userAvatar?: string | null;
    partnerName?: string;
    partnerAvatar?: string | null;
    callType?: 'audio' | 'video';
    onClose: () => void;
}

// Inner active call UI with Stream Video hooks & full WebRTC video feeds + Draggable/Swappable PIP
function StreamActiveCallUI({ 
    partnerName, 
    partnerAvatar, 
    callType, 
    onEndCall 
}: { 
    partnerName?: string; 
    partnerAvatar?: string | null; 
    callType: 'audio' | 'video';
    onEndCall: () => void; 
}) {
    const { 
        useCallCallingState, 
        useCameraState, 
        useMicrophoneState, 
        useParticipants 
    } = useCallStateHooks();

    const call = useCall();
    const callingState = useCallCallingState();
    const { isMute: isMicMuted } = useMicrophoneState();
    const { isMute: isCamMuted } = useCameraState();
    const participants = useParticipants();

    const [duration, setDuration] = useState(0);
    const [isSwapped, setIsSwapped] = useState(false);

    useEffect(() => {
        if (callingState === CallingState.JOINED) {
            const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
            return () => clearInterval(timer);
        }
    }, [callingState]);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const remoteParticipant = participants.find(p => !p.isLocalParticipant);
    const localParticipant = participants.find(p => p.isLocalParticipant);

    const mainParticipant = isSwapped ? localParticipant : (remoteParticipant || localParticipant);
    const pipParticipant = isSwapped ? (remoteParticipant || localParticipant) : localParticipant;

    return (
        <div className="relative w-full h-full flex flex-col justify-between bg-slate-950 text-white overflow-hidden select-none">
            {/* Top Bar Header */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shrink-0">
                        {partnerAvatar ? (
                            <img src={partnerAvatar} alt={partnerName || 'User'} className="w-full h-full object-cover" />
                        ) : (
                            <User className="text-emerald-400" size={24} />
                        )}
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-950 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-slate-100">{partnerName || 'Call Partner'}</h3>
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                            <Radio size={14} className="animate-pulse" />
                            <span>{callingState === CallingState.JOINED ? formatDuration(duration) : 'Ringing...'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {callType === 'video' && (
                        <button
                            onClick={() => setIsSwapped(!isSwapped)}
                            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-all"
                            title="Swap Views"
                        >
                            <ArrowLeftRight size={18} />
                        </button>
                    )}
                    <button
                        onClick={onEndCall}
                        className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Full-Bleed View */}
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                {callType === 'video' && mainParticipant ? (
                    <div className="w-full h-full">
                        <ParticipantView participant={mainParticipant} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    /* WhatsApp Audio Call Surface with Animated Soundwaves */
                    <div className="flex flex-col items-center justify-center gap-6 text-center px-6">
                        <div className="relative">
                            <motion.div 
                                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                className="absolute inset-0 rounded-full bg-emerald-500/25 blur-3xl" 
                            />
                            <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.3)] bg-slate-900 flex items-center justify-center relative z-10">
                                {partnerAvatar ? (
                                    <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={64} className="text-emerald-400" />
                                )}
                            </div>
                        </div>

                        {/* WhatsApp-style Audio Equalizer Bars */}
                        <div className="flex items-center gap-1.5 h-8">
                            {[...Array(9)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: ['20%', '100%', '30%'] }}
                                    transition={{ repeat: Infinity, duration: 0.6 + (i * 0.1), ease: "easeInOut" }}
                                    className="w-1.5 bg-emerald-400 rounded-full"
                                />
                            ))}
                        </div>

                        <div className="space-y-1 z-10">
                            <h2 className="text-2xl font-bold text-slate-100">{partnerName}</h2>
                            <p className="text-sm font-medium text-emerald-400/90 tracking-wide uppercase">
                                {callingState === CallingState.JOINED ? (isMicMuted ? 'Muted' : 'WhatsApp Audio Connected') : 'Ringing...'}
                            </p>
                        </div>
                    </div>
                )}

                {/* WhatsApp & Telegram Style DRAGGABLE & SWAPPABLE PIP Card */}
                {callType === 'video' && pipParticipant && (
                    <motion.div
                        drag
                        dragSnapToOrigin={false}
                        dragElastic={0.1}
                        whileDrag={{ scale: 1.05, boxShadow: "0 20px 30px rgba(0,0,0,0.5)" }}
                        onClick={() => setIsSwapped(!isSwapped)}
                        className="absolute top-24 right-6 w-32 h-48 rounded-3xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-900 z-20 cursor-grab active:cursor-grabbing group"
                    >
                        <ParticipantView participant={pipParticipant} className="w-full h-full object-cover pointer-events-none" />
                        
                        {/* Drag & Swap Indicator Overlay */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white pointer-events-none">
                            <Move size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Drag / Swap</span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Bottom Dock Control Bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-5 bg-black/60 backdrop-blur-2xl px-6 py-3.5 rounded-full border border-white/15 shadow-2xl">
                {/* Mute Mic */}
                <button
                    onClick={() => {
                        if (call) call.microphone.toggle();
                    }}
                    className={`p-4 rounded-full transition-all duration-300 ${
                        isMicMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                    title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                    {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {/* Toggle Camera */}
                {callType === 'video' && (
                    <button
                        onClick={() => {
                            if (call) call.camera.toggle();
                        }}
                        className={`p-4 rounded-full transition-all duration-300 ${
                            isCamMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                        title={isCamMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                        {isCamMuted ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>
                )}

                {/* Clean WhatsApp Style End Call Button */}
                <button
                    onClick={onEndCall}
                    className="w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-600/40 scale-105 active:scale-95 transition-all duration-200"
                    title="End Call"
                >
                    <Phone className="w-6 h-6 rotate-[135deg]" />
                </button>
            </div>
        </div>
    );
}

// Media Stream preview overlay with Draggable & Swappable PIP for local camera testing
function LocalMediaCallUI({
    partnerName,
    partnerAvatar,
    callType,
    onEndCall
}: {
    partnerName?: string;
    partnerAvatar?: string | null;
    callType: 'audio' | 'video';
    onEndCall: () => void;
}) {
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCamMuted, setIsCamMuted] = useState(callType === 'audio');
    const [duration, setDuration] = useState(0);
    const [isSwapped, setIsSwapped] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Call duration timer
    useEffect(() => {
        const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Request local camera feed
    useEffect(() => {
        let active = true;

        async function setupLocalMedia() {
            if (callType === 'video' && !isCamMuted) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: !isMicMuted
                    });
                    if (active) {
                        streamRef.current = stream;
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                        }
                    }
                } catch (e) {
                    console.warn('[LocalMediaCallUI] Camera access error or denied:', e);
                }
            } else if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        }

        setupLocalMedia();

        return () => {
            active = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, [callType, isCamMuted, isMicMuted]);

    const toggleMic = () => {
        setIsMicMuted(!isMicMuted);
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(t => t.enabled = isMicMuted);
        }
    };

    const toggleCam = () => {
        setIsCamMuted(!isCamMuted);
    };

    return (
        <div className="relative w-full h-full flex flex-col justify-between bg-slate-950 text-white overflow-hidden select-none">
            {/* Top Bar Header */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shrink-0">
                        {partnerAvatar ? (
                            <img src={partnerAvatar} alt={partnerName || 'User'} className="w-full h-full object-cover" />
                        ) : (
                            <User className="text-emerald-400" size={24} />
                        )}
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-950 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-slate-100">{partnerName || 'Call Partner'}</h3>
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                            <Radio size={14} className="animate-pulse" />
                            <span>WhatsApp {callType === 'video' ? 'Video' : 'Audio'} ({formatDuration(duration)})</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {callType === 'video' && (
                        <button
                            onClick={() => setIsSwapped(!isSwapped)}
                            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-all"
                            title="Swap Views"
                        >
                            <ArrowLeftRight size={18} />
                        </button>
                    )}
                    <button
                        onClick={onEndCall}
                        className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Video / Audio Surface */}
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                {callType === 'video' && !isCamMuted ? (
                    <div className="w-full h-full relative">
                        {/* Main Fullscreen Video Stream */}
                        {!isSwapped ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover transform -scale-x-100"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-4">
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-emerald-500/20 border-4 border-emerald-500/40">
                                    {partnerAvatar ? <img src={partnerAvatar} alt="" className="w-full h-full object-cover" /> : <User size={56} className="text-emerald-400" />}
                                </div>
                                <h3 className="text-xl font-bold">{partnerName}</h3>
                            </div>
                        )}

                        {/* WhatsApp & Telegram Style DRAGGABLE PIP Thumbnail */}
                        <motion.div
                            drag
                            dragSnapToOrigin={false}
                            dragElastic={0.1}
                            whileDrag={{ scale: 1.05, boxShadow: "0 20px 30px rgba(0,0,0,0.5)" }}
                            onClick={() => setIsSwapped(!isSwapped)}
                            className="absolute top-24 right-6 w-32 h-48 rounded-3xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-900 z-20 cursor-grab active:cursor-grabbing group flex items-center justify-center"
                        >
                            {isSwapped ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover transform -scale-x-100 pointer-events-none"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center p-2">
                                    <div className="w-14 h-14 rounded-full overflow-hidden bg-emerald-500/20 border border-emerald-400/40 mb-1">
                                        {partnerAvatar ? <img src={partnerAvatar} alt="" className="w-full h-full object-cover" /> : <User size={28} className="text-emerald-400" />}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-200 truncate w-full">{partnerName}</span>
                                </div>
                            )}

                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white pointer-events-none">
                                <Move size={14} />
                                <span className="text-[9px] font-bold uppercase">Drag/Swap</span>
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    /* Audio Mode or Camera Disabled */
                    <div className="flex flex-col items-center justify-center gap-6 text-center px-6">
                        <div className="relative">
                            <motion.div 
                                animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
                                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                                className="absolute inset-0 rounded-full bg-emerald-500/25 blur-3xl" 
                            />
                            <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.3)] bg-slate-900 flex items-center justify-center relative z-10">
                                {partnerAvatar ? (
                                    <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={64} className="text-emerald-400" />
                                )}
                            </div>
                        </div>

                        {/* Equalizer Wave Animation */}
                        <div className="flex items-center gap-1.5 h-8">
                            {[...Array(9)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: ['20%', '100%', '30%'] }}
                                    transition={{ repeat: Infinity, duration: 0.6 + (i * 0.1), ease: "easeInOut" }}
                                    className="w-1.5 bg-emerald-400 rounded-full"
                                />
                            ))}
                        </div>

                        <div className="space-y-1 z-10">
                            <h2 className="text-2xl font-bold text-slate-100">{partnerName}</h2>
                            <p className="text-sm font-medium text-emerald-400/90 tracking-wide uppercase">
                                {isMicMuted ? 'Microphone Muted' : 'WhatsApp Audio Connected'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Dock Control Bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-5 bg-black/60 backdrop-blur-2xl px-6 py-3.5 rounded-full border border-white/15 shadow-2xl">
                {/* Mute Mic */}
                <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full transition-all duration-300 ${
                        isMicMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                    title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                    {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {/* Toggle Camera */}
                {callType === 'video' && (
                    <button
                        onClick={toggleCam}
                        className={`p-4 rounded-full transition-all duration-300 ${
                            isCamMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                        title={isCamMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                        {isCamMuted ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>
                )}

                {/* Clean WhatsApp Style End Call Button */}
                <button
                    onClick={onEndCall}
                    className="w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-600/40 scale-105 active:scale-95 transition-all duration-200"
                    title="End Call"
                >
                    <Phone className="w-6 h-6 rotate-[135deg]" />
                </button>
            </div>
        </div>
    );
}

export default function StreamCallOverlay({
    conversationId,
    userId,
    receiverId,
    targetOnline = false,
    userName = 'User',
    userAvatar,
    partnerName = 'Partner',
    partnerAvatar,
    callType = 'audio',
    onClose
}: StreamCallOverlayProps) {
    const [callState, setCallState] = useState<'loading' | 'connecting' | 'joined' | 'error' | 'ended'>('loading');
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<any>(null);
    const [duration, setDuration] = useState(0);

    const isMounted = useRef(true);

    // Call duration timer
    useEffect(() => {
        if (callState === 'joined') {
            const timer = setInterval(() => setDuration(d => d + 1), 1000);
            return () => clearInterval(timer);
        }
    }, [callState]);

    // Real-time call status subscription for caller & receiver sync
    useEffect(() => {
        if (!conversationId) return;

        const callsChannel = supabase
            .channel(`calls_status:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'calls',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    const newStatus = payload.new?.status;
                    if (newStatus === 'connected') {
                        setCallState('joined');
                    } else if (newStatus === 'declined' || newStatus === 'ended' || newStatus === 'missed') {
                        setCallState('ended');
                        setTimeout(() => onClose(), 1200);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(callsChannel);
        };
    }, [conversationId, onClose]);

    useEffect(() => {
        isMounted.current = true;

        async function initStreamCall() {
            try {
                setCallState('loading');

                const tokenRes = await fetch('/api/stream/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId })
                });

                const tokenData = await tokenRes.json();

                if (!tokenRes.ok || !tokenData.token || tokenData.isDevMode) {
                    // Trigger call session so receiver receives incoming call ringing notification
                    fetch('/api/stream/call', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            conversation_id: conversationId,
                            caller_id: userId,
                            receiver_id: receiverId,
                            type: callType
                        })
                    }).catch(err => console.warn('[Call init notify warn]', err));

                    if (isMounted.current) {
                        setCallState('connecting');
                    }
                    return;
                }

                if (!isMounted.current) return;

                const videoClient = new StreamVideoClient({
                    apiKey: tokenData.apiKey,
                    user: {
                        id: userId,
                        name: userName,
                        image: userAvatar || undefined
                    },
                    token: tokenData.token
                });

                setClient(videoClient);

                const callRes = await fetch('/api/stream/call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: conversationId,
                        caller_id: userId,
                        receiver_id: receiverId,
                        type: callType
                    })
                });

                const callData = await callRes.json();
                const streamCallId = callData.callId || `conv_${conversationId.replace(/-/g, '_')}`;

                setCallState('connecting');
                const streamCall = videoClient.call('default', streamCallId);

                await streamCall.join({ create: true });

                if (callType === 'audio') {
                    await streamCall.camera.disable();
                    await streamCall.microphone.enable();
                } else {
                    await streamCall.camera.enable();
                    await streamCall.microphone.enable();
                }

                if (isMounted.current) {
                    setCall(streamCall);
                    setCallState('joined');
                }

            } catch (err: any) {
                console.error('[StreamCallOverlay Error]:', err);
                if (isMounted.current) {
                    setCallState('joined');
                }
            }
        }

        initStreamCall();

        return () => {
            isMounted.current = false;
            if (call) {
                call.leave().catch(console.error);
            }
            if (client) {
                client.disconnectUser().catch(console.error);
            }
        };
    }, [conversationId, userId]);

    const handleEndCall = async () => {
        const finalStatus = callState === 'joined' ? 'ended' : 'missed';
        setCallState('ended');

        // Log call status and entry in database/chat history
        fetch('/api/stream/call/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: conversationId,
                caller_id: userId,
                receiver_id: receiverId,
                status: finalStatus,
                type: callType,
                duration
            })
        }).catch(err => console.warn('[Call status notify warn]', err));

        if (call) {
            await call.leave().catch(console.error);
        }
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] w-full h-full bg-slate-950 overflow-hidden select-none"
            >
                {/* Render Loading / Outgoing Ringing/Calling State */}
                {callState === 'loading' && (
                    <div className="w-full h-full flex flex-col justify-between items-center p-8 bg-slate-950 text-white">
                        <div className="flex flex-col items-center gap-2 pt-6 text-center">
                            <h2 className="text-3xl font-black tracking-tight">{partnerName}</h2>
                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                                {targetOnline ? 'Ringing...' : 'Calling...'}
                            </p>
                        </div>

                        <div className="relative flex items-center justify-center">
                            <motion.div
                                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.6, 0.2] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl"
                            />
                            <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/40 shadow-2xl bg-slate-900 flex items-center justify-center">
                                {partnerAvatar ? (
                                    <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={64} className="text-emerald-400" />
                                )}
                            </div>
                        </div>

                        <div className="pb-6">
                            <button
                                onClick={handleEndCall}
                                className="w-16 h-16 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-600/40 scale-105 active:scale-95 transition-all"
                                title="Cancel Call"
                            >
                                <Phone className="w-8 h-8 rotate-[135deg]" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Render Connecting State */}
                {callState === 'connecting' && (
                    <div className="w-full h-full flex flex-col justify-between items-center p-8 bg-slate-950 text-white">
                        <div className="flex flex-col items-center gap-2 pt-6 text-center">
                            <h2 className="text-3xl font-black tracking-tight">{partnerName}</h2>
                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                                {targetOnline ? 'Ringing...' : 'Calling...'}
                            </p>
                        </div>

                        <div className="relative flex items-center justify-center">
                            <motion.div
                                animate={{ scale: [1, 1.25, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="w-28 h-28 rounded-full bg-emerald-500/20 blur-md absolute inset-0"
                            />
                            <div className="w-28 h-28 rounded-full bg-emerald-500/30 flex items-center justify-center relative z-10 border border-emerald-400/40">
                                <Radio size={44} className="text-emerald-400 animate-pulse" />
                            </div>
                        </div>

                        <div className="pb-6">
                            <button
                                onClick={handleEndCall}
                                className="w-16 h-16 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-600/40 scale-105 active:scale-95 transition-all"
                            >
                                <Phone className="w-8 h-8 rotate-[135deg]" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Render Ended State */}
                {callState === 'ended' && (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white p-6 bg-slate-950">
                        <div className="p-5 bg-slate-900 rounded-full text-slate-400 border border-white/10">
                            <Phone className="w-10 h-10 rotate-[135deg]" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-200">Call Ended</h3>
                    </div>
                )}

                {/* Render Joined Call UI (Stream WebRTC SDK or Local Camera Media UI) */}
                {callState === 'joined' && (
                    client && call ? (
                        <StreamVideo client={client}>
                            <StreamCall call={call}>
                                <StreamActiveCallUI 
                                    partnerName={partnerName} 
                                    partnerAvatar={partnerAvatar}
                                    callType={callType} 
                                    onEndCall={handleEndCall} 
                                />
                            </StreamCall>
                        </StreamVideo>
                    ) : (
                        <LocalMediaCallUI
                            partnerName={partnerName}
                            partnerAvatar={partnerAvatar}
                            callType={callType}
                            onEndCall={handleEndCall}
                        />
                    )
                )}
            </motion.div>
        </AnimatePresence>
    );
}
