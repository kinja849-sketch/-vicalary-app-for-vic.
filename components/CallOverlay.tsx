"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/lib/api/translation';
import {
    Phone,
    PhoneOff,
    Video,
    VideoOff,
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Minimize2,
    Maximize2,
    MoreHorizontal,
    MessageSquare,
    ChevronUp,
    ChevronDown,
    SwitchCamera,
    Bluetooth,
    User,
    X,
    Send
} from 'lucide-react';
import { DailyMediaView, DailyAudioTrack } from './calls/DailyMediaView';
import { toast } from 'sonner';

interface CallOverlayProps {
    type: 'voice' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    caller: { name: string; avatar?: string; };
    localUser?: { name?: string; avatar?: string; };
    direction: 'incoming' | 'outgoing';
    onAccept: () => void;
    onDecline: () => void;
    onEnd: () => void;
    onMessageAndDecline?: (message: string) => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
    onToggleMic?: (enabled: boolean) => void;
    onToggleCamera?: (enabled: boolean) => void;
    onFlipCamera?: () => Promise<boolean>;
    hasMultipleCameras?: boolean;
    onToggleSpeaker?: () => Promise<boolean>;
    isSpeakerSupported?: boolean;
    speakerActive?: boolean;
    isLocalAudioMuted?: boolean;
    isLocalVideoOff?: boolean;
    isRemoteAudioMuted?: boolean;
    isRemoteVideoOff?: boolean;
    peerJoined?: boolean;
    isPeerOnline?: boolean;
    connectionState?: string;
    localVideoTrack?: MediaStreamTrack | null;
    remoteVideoTrack?: MediaStreamTrack | null;
    remoteAudioTrack?: MediaStreamTrack | null;
}

const QUICK_REPLIES = [
    "Can't talk right now. What's up?",
    "I'll call you right back.",
    "I'm on my way.",
    "In a meeting, will text you later."
];

export default function CallOverlay({
    type,
    status,
    caller,
    localUser,
    direction,
    onAccept,
    onDecline,
    onEnd,
    onMessageAndDecline,
    isMinimized = false,
    onToggleMinimize,
    onToggleMic,
    onToggleCamera,
    onFlipCamera,
    hasMultipleCameras = false,
    onToggleSpeaker,
    isSpeakerSupported = false,
    speakerActive = false,
    isLocalAudioMuted = false,
    isLocalVideoOff = true,
    isRemoteAudioMuted = false,
    isRemoteVideoOff = true,
    peerJoined = false,
    isPeerOnline = false,
    connectionState = 'idle',
    localVideoTrack,
    remoteVideoTrack,
    remoteAudioTrack,
}: CallOverlayProps) {
    const { t } = useTranslation();
    const [duration, setDuration] = useState(0);
    const [isSwapped, setIsSwapped] = useState(false);
    const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [customMessage, setCustomMessage] = useState('');

    // Swipe up to accept gesture state
    const [swipeOffsetY, setSwipeOffsetY] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const swipeStartRef = useRef<{ startY: number } | null>(null);

    const pipTileRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{
        startX: number;
        startY: number;
        initialPipX: number;
        initialPipY: number;
        hasMoved: boolean;
    } | null>(null);

    // Call duration timer — ticks ONLY when peer presence is confirmed (connected)
    useEffect(() => {
        let interval: any;
        if (status === 'connected' && peerJoined) {
            interval = setInterval(() => setDuration(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [status, peerJoined]);

    // Format MM:SS duration
    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Determine video tracks based on swap state
    const mainVideoTrack = isSwapped ? localVideoTrack : remoteVideoTrack;
    const pipVideoTrack = isSwapped ? remoteVideoTrack : localVideoTrack;
    const isMainLocal = isSwapped;
    const isPipLocal = !isSwapped;

    // Mic & Camera toggle handlers
    const handleMicToggle = () => {
        if (onToggleMic) {
            onToggleMic(isLocalAudioMuted); // If currently muted, unmute (pass true)
        }
    };

    const handleCameraToggle = () => {
        if (onToggleCamera) {
            onToggleCamera(isLocalVideoOff); // If currently off, turn on (pass true)
        }
    };

    const handleSpeakerToggle = async () => {
        if (!isSpeakerSupported) {
            toast.info("Speaker output switching is not supported by your browser");
            return;
        }
        if (onToggleSpeaker) {
            await onToggleSpeaker();
        }
    };

    const handleCameraFlip = async () => {
        if (!hasMultipleCameras) {
            toast.info("Only one camera detected on this device");
            return;
        }
        if (onFlipCamera) {
            const success = await onFlipCamera();
            if (success) {
                toast.success("Camera switched");
            }
        }
    };

    // Swipe up to accept gesture logic
    const handleSwipePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        swipeStartRef.current = { startY: e.clientY };
        setIsSwiping(true);
        try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch (_) {}
    };

    const handleSwipePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!swipeStartRef.current) return;
        const diffY = e.clientY - swipeStartRef.current.startY;
        // Only allow upward drag (negative values)
        if (diffY < 0) {
            const clamped = Math.max(diffY, -100);
            setSwipeOffsetY(clamped);

            // If dragged past threshold of 70px, accept immediately
            if (clamped <= -70) {
                swipeStartRef.current = null;
                setIsSwiping(false);
                setSwipeOffsetY(0);
                try {
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch (_) {}
                onAccept();
            }
        } else {
            setSwipeOffsetY(0);
        }
    };

    const handleSwipePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!swipeStartRef.current) return;
        const diffY = e.clientY - swipeStartRef.current.startY;
        swipeStartRef.current = null;
        setIsSwiping(false);

        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (diffY <= -60) {
            // Reached acceptance threshold
            setSwipeOffsetY(0);
            onAccept();
        } else if (Math.abs(diffY) < 5) {
            // Accessible tap/click alternative
            setSwipeOffsetY(0);
            onAccept();
        } else {
            // Return to starting position
            setSwipeOffsetY(0);
        }
    };

    const handleSwipePointerCancel = () => {
        swipeStartRef.current = null;
        setIsSwiping(false);
        setSwipeOffsetY(0);
    };

    // Quick replies send & decline handler
    const handleSendQuickReply = (text: string) => {
        if (!text.trim()) return;
        if (onMessageAndDecline) {
            onMessageAndDecline(text.trim());
        } else {
            onDecline();
        }
        setShowQuickReplies(false);
    };

    // PiP draggable positioning logic
    const clampPipPosition = useCallback((x: number, y: number) => {
        if (typeof window === 'undefined') return { x, y };
        const pipWidth = 116;
        const pipHeight = 176;
        const minX = 12;
        const maxX = Math.max(minX, window.innerWidth - pipWidth - 12);
        const minY = 64;
        const maxY = Math.max(minY, window.innerHeight - pipHeight - 110);
        return {
            x: Math.min(Math.max(x, minX), maxX),
            y: Math.min(Math.max(y, minY), maxY),
        };
    }, []);

    const handlePipPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const pipWidth = 116;
        const pipHeight = 176;
        const defaultX = window.innerWidth - pipWidth - 16;
        const defaultY = window.innerHeight - pipHeight - 116;

        const currentX = pipPos ? pipPos.x : defaultX;
        const currentY = pipPos ? pipPos.y : defaultY;

        dragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialPipX: currentX,
            initialPipY: currentY,
            hasMoved: false,
        };
        try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch (_) {}
    };

    const handlePipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;

        if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 5) {
            dragStartRef.current.hasMoved = true;
            setIsDragging(true);
        }

        if (dragStartRef.current.hasMoved) {
            const next = clampPipPosition(
                dragStartRef.current.initialPipX + dx,
                dragStartRef.current.initialPipY + dy
            );
            setPipPos(next);
        }
    };

    const handlePipPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        const { hasMoved } = dragStartRef.current;
        dragStartRef.current = null;
        setIsDragging(false);

        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (!hasMoved) {
            // Tap without dragging -> Swap views
            setIsSwapped(prev => !prev);
        }
    };

    const handlePipPointerCancel = () => {
        dragStartRef.current = null;
        setIsDragging(false);
    };

    // Dedicated single-instance audio playback element for remote audio
    const AudioElement = <DailyAudioTrack track={remoteAudioTrack} />;

    // ===== 1. CALL ENDED STATE =====
    if (status === 'ended') {
        return (
            <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
                {AudioElement}
                <div className="text-center">
                    <h2 className="text-2xl font-light mb-2">Call Ended</h2>
                    <p className="text-[#8696A0]">{formatDuration(duration)}</p>
                </div>
            </div>
        );
    }

    // ===== 2. MINIMIZED FLOATING STATE =====
    if (isMinimized) {
        return (
            <div
                onClick={onToggleMinimize}
                className="fixed bottom-20 right-4 z-[9999] w-20 h-20 rounded-2xl bg-[#00A884] shadow-2xl flex items-center justify-center cursor-pointer hover:scale-105 transition-all overflow-hidden border-2 border-white/20 select-none"
                title="Tap to restore call"
            >
                {AudioElement}
                {type === 'video' && remoteVideoTrack ? (
                    <DailyMediaView track={remoteVideoTrack} className="w-full h-full" />
                ) : (
                    <img
                        src={caller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.name || 'User')}&background=00A884&color=fff&size=100`}
                        alt={caller.name || 'Call'}
                        className="w-full h-full object-cover opacity-80"
                    />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px]">
                    {type === 'video' ? <Video className="text-white animate-pulse" size={20} /> : <Phone className="text-white animate-pulse" size={20} />}
                    <span className="text-[10px] text-white font-bold mt-1">{formatDuration(duration)}</span>
                </div>
            </div>
        );
    }

    // ===== 3. UNIFIED CALLING & RINGING SCREEN (Exact reference: media_1791516132449.png) =====
    if (status === 'ringing') {
        const isOnline = direction === 'incoming' ? true : isPeerOnline;
        const statusLabel = isOnline ? 'Ringing' : 'Calling';

        return (
            <div className="fixed inset-0 z-[100] bg-[#0b141a] text-white flex flex-col justify-between items-center p-6 md:p-10 select-none overflow-hidden animate-in fade-in duration-300">
                {AudioElement}

                {/* Top status bar spacer (clean header matching reference) */}
                <div className="relative z-10 w-full pt-8 flex items-center justify-end text-xs text-[#8696a0]">
                    {onToggleMinimize && (
                        <button onClick={onToggleMinimize} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Minimize">
                            <Minimize2 size={18} />
                        </button>
                    )}
                </div>

                {/* Center: Caller / Peer Avatar, Name, Status (Ringing / Calling) */}
                <div className="relative z-10 flex flex-col items-center gap-4 my-auto">
                    {/* Large circular avatar */}
                    <div className="size-36 md:size-40 rounded-full overflow-hidden bg-[#202c33] ring-4 ring-white/10 shadow-2xl flex items-center justify-center">
                        {caller.avatar ? (
                            <img src={caller.avatar} alt={caller.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-[#374248] flex items-center justify-center">
                                <User size={72} className="text-[#8696a0]" />
                            </div>
                        )}
                    </div>

                    {/* Peer Name */}
                    <h1 className="text-3xl md:text-4xl font-normal text-white tracking-wide text-center mt-2">
                        {caller.name || 'Caller'}
                    </h1>

                    {/* Subtitle: Ringing when online, Calling when offline */}
                    <p className="text-sm text-[#8696a0] font-light animate-pulse">
                        {statusLabel}
                    </p>
                </div>

                {/* Bottom Controls: Decline (Left), Swipe up to accept (Center), Message (Right) */}
                <div className="relative z-10 w-full max-w-md pb-6 md:pb-10">
                    <div className="flex items-end justify-around w-full">
                        {/* 1. DECLINE / CANCEL BUTTON (Left) - Clean phone with NO straw/slash */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                type="button"
                                onClick={direction === 'incoming' ? onDecline : onEnd}
                                className="size-16 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl transition-transform active:scale-90"
                                title={direction === 'incoming' ? "Decline call" : "Cancel call"}
                            >
                                <Phone size={28} className="text-white rotate-[135deg] fill-current" />
                            </button>
                            <span className="text-xs text-white/80 font-medium">Decline</span>
                        </div>

                        {/* 2. SWIPE UP TO ACCEPT (Center) */}
                        <div className="flex flex-col items-center gap-2 relative">
                            {/* Animated upward guidance chevrons */}
                            <div className="flex flex-col items-center -space-y-1 mb-1 pointer-events-none opacity-80 animate-pulse">
                                <ChevronUp size={16} className="text-emerald-400" />
                                <ChevronUp size={16} className="text-emerald-400/60" />
                            </div>

                            {/* Draggable & Tappable Accept Button */}
                            <button
                                type="button"
                                onClick={direction === 'incoming' ? onAccept : undefined}
                                onPointerDown={handleSwipePointerDown}
                                onPointerMove={handleSwipePointerMove}
                                onPointerUp={handleSwipePointerUp}
                                onPointerCancel={handleSwipePointerCancel}
                                style={{
                                    transform: `translateY(${swipeOffsetY}px)`,
                                    transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)',
                                    touchAction: 'none'
                                }}
                                className="size-20 rounded-full bg-[#25D366] hover:bg-[#1ebc57] flex items-center justify-center shadow-2xl shadow-emerald-500/30 cursor-grab active:cursor-grabbing transition-shadow active:scale-95"
                                title="Swipe up or tap to accept"
                                aria-label="Accept call"
                            >
                                {type === 'video' ? <Video size={32} className="text-white fill-current" /> : <Phone size={32} className="text-white fill-current" />}
                            </button>
                            <span className="text-xs text-white/90 font-medium">Swipe up to accept</span>
                        </div>

                        {/* 3. MESSAGE BUTTON (Right) */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowQuickReplies(true)}
                                className="size-16 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-white/10 flex items-center justify-center shadow-xl transition-transform active:scale-90 text-white"
                                title="Reply with message"
                            >
                                <MessageSquare size={24} />
                            </button>
                            <span className="text-xs text-white/80 font-medium">Message</span>
                        </div>
                    </div>
                </div>

                {/* Quick Replies Modal */}
                {showQuickReplies && (
                    <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-sm bg-[#1f2c34] rounded-2xl border border-white/10 p-5 shadow-2xl animate-in slide-in-from-bottom-10 duration-200">
                            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                                <h3 className="text-sm font-semibold text-white">Reply with message</h3>
                                <button
                                    onClick={() => setShowQuickReplies(false)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={18} className="text-[#8696a0]" />
                                </button>
                            </div>

                            <p className="text-xs text-[#8696a0] mb-3">
                                Replying will send this message to {caller.name} and {direction === 'incoming' ? 'decline' : 'cancel'} the call.
                            </p>

                            <div className="flex flex-col gap-2 mb-4">
                                {QUICK_REPLIES.map((reply, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSendQuickReply(reply)}
                                        className="w-full text-left p-3 rounded-xl bg-[#2a3942] hover:bg-[#32444f] text-sm text-white/90 transition-colors"
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="Write custom message..."
                                    className="flex-1 bg-[#111b21] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00A884]"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSendQuickReply(customMessage);
                                    }}
                                />
                                <button
                                    disabled={!customMessage.trim()}
                                    onClick={() => handleSendQuickReply(customMessage)}
                                    className="p-2.5 rounded-xl bg-[#00A884] hover:bg-[#009473] disabled:opacity-40 text-white transition-all"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ===== 5. ACTIVE VIDEO CALL (Reference: media_1791504017249.png) =====
    if (type === 'video' && status === 'connected') {
        return (
            <div className="fixed inset-0 z-[100] bg-black text-white select-none touch-none overflow-hidden animate-in fade-in duration-300">
                {AudioElement}

                {/* Full-Screen Main Video Surface (Tap to switch participant view) */}
                <div
                    onClick={() => setIsSwapped(prev => !prev)}
                    className="absolute inset-0 w-full h-full bg-[#111b21] flex items-center justify-center cursor-pointer"
                    title="Tap to switch view"
                >
                    {mainVideoTrack && !(isMainLocal && isLocalVideoOff) ? (
                        <DailyMediaView
                            track={mainVideoTrack}
                            isLocal={isMainLocal}
                            mirror={isMainLocal}
                            objectFit="cover"
                            className="w-full h-full"
                        />
                    ) : (
                        /* Informative fallback state */
                        <div className="flex flex-col items-center gap-4 p-6 text-center">
                            <div className="size-28 rounded-full overflow-hidden ring-4 ring-white/10 bg-[#202c33] flex items-center justify-center">
                                <img
                                    src={(isMainLocal ? localUser?.avatar : caller.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent((isMainLocal ? localUser?.name : caller.name) || 'User')}&background=00A884&color=fff&size=200`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className="text-sm text-white/70 font-medium">
                                {isMainLocal
                                    ? 'Your camera is off'
                                    : !peerJoined
                                    ? `Waiting for ${caller.name || 'participant'} to join...`
                                    : isRemoteVideoOff
                                    ? `${caller.name || 'Participant'} turned camera off`
                                    : 'Connecting video stream...'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Floating Local PiP Video Card (Bottom Right, above dock) */}
                <div
                    ref={pipTileRef}
                    onPointerDown={handlePipPointerDown}
                    onPointerMove={handlePipPointerMove}
                    onPointerUp={handlePipPointerUp}
                    onPointerCancel={handlePipPointerCancel}
                    style={{
                        position: 'absolute',
                        left: pipPos ? `${pipPos.x}px` : 'auto',
                        top: pipPos ? `${pipPos.y}px` : 'auto',
                        right: pipPos ? 'auto' : '16px',
                        bottom: pipPos ? 'auto' : '116px',
                        touchAction: 'none',
                    }}
                    className={`w-32 h-48 sm:w-36 sm:h-52 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-[#1f2c34] z-30 cursor-grab active:cursor-grabbing transition-transform ${
                        isDragging ? 'scale-105 shadow-3xl ring-2 ring-[#00A884]' : 'hover:scale-[1.02]'
                    }`}
                    title="Tap to switch, drag to reposition"
                >
                    {pipVideoTrack && !(isPipLocal && isLocalVideoOff) ? (
                        <DailyMediaView
                            track={pipVideoTrack}
                            isLocal={isPipLocal}
                            mirror={isPipLocal}
                            objectFit="cover"
                            className="w-full h-full pointer-events-none"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2 bg-[#1f2c34] pointer-events-none">
                            <div className="size-12 rounded-full overflow-hidden ring-2 ring-white/10">
                                <img
                                    src={(isPipLocal ? localUser?.avatar : caller.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent((isPipLocal ? localUser?.name : caller.name) || 'User')}&background=00A884&color=fff&size=100`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className="text-[10px] text-white/70 text-center truncate w-full">
                                {isPipLocal ? 'Camera off' : 'No video'}
                            </span>
                        </div>
                    )}

                    {/* Floating PiP Camera Flip button strictly for camera direction */}
                    <div className="absolute top-3 right-3 z-40 pointer-events-auto">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (hasMultipleCameras) {
                                    handleCameraFlip();
                                } else {
                                    toast.info("No secondary camera detected");
                                }
                            }}
                            className="size-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-lg transition-transform active:scale-95"
                            title={hasMultipleCameras ? "Flip camera viewpoint" : "Only 1 camera detected"}
                        >
                            <SwitchCamera size={16} />
                        </button>
                    </div>
                </div>

                {/* Duration Badge Top Center */}
                <div className="absolute top-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
                    <span className="bg-black/50 backdrop-blur-md px-4 py-1 rounded-full text-xs font-semibold text-white/90 border border-white/10 shadow-lg">
                        {peerJoined ? formatDuration(duration) : 'Connecting...'}
                    </span>
                </div>

                {/* Floating Frosted Capsule Bottom Dock (matching reference: ... | video | speaker/bluetooth | mic | end) */}
                <div className="absolute bottom-6 left-4 right-4 z-30 flex justify-center pointer-events-auto">
                    <div className="bg-[#48484a]/80 backdrop-blur-xl border border-white/10 rounded-full px-5 py-3 shadow-2xl flex items-center justify-between gap-3 max-w-sm w-full mx-auto">
                        {/* 1. More Options / Minimize */}
                        <button
                            type="button"
                            onClick={onToggleMinimize}
                            className="size-11 sm:size-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all active:scale-95"
                            title="More options / Minimize"
                        >
                            <MoreHorizontal size={22} />
                        </button>

                        {/* 2. Video Camera on/off */}
                        <button
                            type="button"
                            onClick={handleCameraToggle}
                            className={`size-11 sm:size-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                isLocalVideoOff
                                    ? 'bg-white/20 hover:bg-white/30 text-white'
                                    : 'bg-white hover:bg-white/90 text-black shadow-md'
                            }`}
                            title={isLocalVideoOff ? 'Turn camera on' : 'Turn camera off'}
                        >
                            {isLocalVideoOff ? <VideoOff size={20} className="text-red-400" /> : <Video size={20} className="text-black" />}
                        </button>

                        {/* 3. Speaker / Bluetooth toggle */}
                        <button
                            type="button"
                            onClick={handleSpeakerToggle}
                            className={`size-11 sm:size-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                speakerActive
                                    ? 'bg-white hover:bg-white/90 text-black shadow-md'
                                    : 'bg-white/20 hover:bg-white/30 text-white'
                            }`}
                            title={isSpeakerSupported ? (speakerActive ? 'Speaker/Bluetooth on' : 'Speaker/Bluetooth off') : 'Audio output switching not supported'}
                        >
                            {speakerActive ? (
                                <div className="flex items-center justify-center -space-x-0.5">
                                    <Volume2 size={18} className="text-black" />
                                    <Bluetooth size={14} className="text-black stroke-[2.5]" />
                                </div>
                            ) : (
                                <VolumeX size={20} className="text-white" />
                            )}
                        </button>

                        {/* 4. Microphone Mute */}
                        <button
                            type="button"
                            onClick={handleMicToggle}
                            className={`size-11 sm:size-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                isLocalAudioMuted
                                    ? 'bg-white/20 hover:bg-white/30 text-white'
                                    : 'bg-white/20 hover:bg-white/30 text-white'
                            }`}
                            title={isLocalAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                        >
                            {isLocalAudioMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
                        </button>

                        {/* 5. End Call Button (Horizontal red handset) */}
                        <button
                            type="button"
                            onClick={onEnd}
                            className="size-11 sm:size-12 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
                            title="End Call"
                        >
                            <Phone size={20} className="rotate-[135deg] text-white fill-current" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ===== 6. ACTIVE VOICE CALL =====
    return (
        <div className="fixed inset-0 z-[100] bg-[#0b141a] text-white flex flex-col justify-between items-center select-none overflow-hidden h-[100dvh] animate-in fade-in duration-300">
            {AudioElement}

            {/* Top Band: Safe-area top padding, title, and clear minimize affordance */}
            <div
                className="w-full px-6 flex items-center justify-between text-xs text-[#8696a0] shrink-0"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
                <span className="font-medium tracking-wide">VicCalary voice call</span>
                {onToggleMinimize && (
                    <button
                        type="button"
                        onClick={onToggleMinimize}
                        className="size-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all shadow-sm"
                        title="Minimize call"
                        aria-label="Minimize call"
                    >
                        <ChevronDown size={20} className="text-white" />
                    </button>
                )}
            </div>

            {/* Middle Band: Flex-centered Avatar, Caller Name, and Timer */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 w-full my-0">
                {/* Deliberate, clean circular avatar with subtle outer ring */}
                <div className="size-36 sm:size-44 rounded-full overflow-hidden bg-[#202c33] ring-4 ring-white/10 shadow-2xl flex items-center justify-center">
                    {caller.avatar ? (
                        <img src={caller.avatar} alt={caller.name} className="w-full h-full object-cover" />
                    ) : (
                        <User size={68} className="text-[#8696a0]" />
                    )}
                </div>

                <div className="text-center mt-2">
                    <h1 className="text-3xl sm:text-4xl font-normal text-white tracking-wide">{caller.name || 'User'}</h1>
                    <p className="text-sm font-medium text-[#8696a0] mt-1.5">
                        {!peerJoined
                            ? 'Connecting...'
                            : isRemoteAudioMuted
                            ? `${caller.name || 'User'} is muted`
                            : formatDuration(duration)}
                    </p>
                </div>
            </div>

            {/* Bottom Band: Fixed control dock with safe-area bottom padding */}
            <div
                className="w-full max-w-sm px-6 shrink-0 flex flex-col items-center"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
            >
                <div className="bg-[#202c33]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3.5 flex items-center justify-around gap-6 shadow-2xl w-full">
                    {/* Speaker */}
                    <button
                        type="button"
                        onClick={handleSpeakerToggle}
                        className={`size-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                            speakerActive ? 'bg-white text-black shadow-md' : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                        title={isSpeakerSupported ? (speakerActive ? 'Speaker on' : 'Speaker off') : 'Speaker switching not supported'}
                    >
                        {speakerActive ? <Volume2 size={22} className="text-black" /> : <VolumeX size={22} className="text-white" />}
                    </button>

                    {/* Microphone */}
                    <button
                        type="button"
                        onClick={handleMicToggle}
                        className={`size-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                            isLocalAudioMuted ? 'bg-red-600 text-white shadow-md' : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                        title={isLocalAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                        {isLocalAudioMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
                    </button>

                    {/* End Call */}
                    <button
                        type="button"
                        onClick={onEnd}
                        className="size-12 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
                        title="End Call"
                    >
                        <Phone size={22} className="rotate-[135deg] text-white fill-current" />
                    </button>
                </div>
            </div>
        </div>
    );
}
