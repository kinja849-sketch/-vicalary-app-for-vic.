"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/lib/api/translation';
import { Video, Phone, Minimize2, PhoneOff, Mic, MicOff, VideoOff, Volume2, ArrowLeftRight, User } from 'lucide-react';

interface CallOverlayProps {
    type: 'voice' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    caller: { name: string; avatar?: string; };
    localUser?: { name?: string; avatar?: string; };
    onAccept: () => void;
    onDecline: () => void;
    onEnd: () => void;
    direction: 'incoming' | 'outgoing';
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
    onToggleMic?: (enabled: boolean) => void;
    onToggleCamera?: (enabled: boolean) => void;
    localVideoTrack?: MediaStreamTrack | null;
    remoteVideoTrack?: MediaStreamTrack | null;
    remoteAudioTrack?: MediaStreamTrack | null;
}

export default function CallOverlay({
    type, status, caller, localUser, direction,
    onAccept, onDecline, onEnd,
    isMinimized = false, onToggleMinimize,
    onToggleMic, onToggleCamera,
    localVideoTrack, remoteVideoTrack, remoteAudioTrack,
}: CallOverlayProps) {

    const { t } = useTranslation();
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isSwapped, setIsSwapped] = useState(false);
    const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const mainVideoRef = useRef<HTMLVideoElement>(null);
    const pipVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const pipTileRef = useRef<HTMLDivElement>(null);

    const dragStartRef = useRef<{
        startX: number;
        startY: number;
        initialPipX: number;
        initialPipY: number;
        hasMoved: boolean;
    } | null>(null);

    // Determine tracks based on swap state
    // Default (!isSwapped): remote is main, local is PiP
    // Swapped (isSwapped): local is main, remote is PiP
    const mainVideoTrack = isSwapped ? localVideoTrack : remoteVideoTrack;
    const pipVideoTrack = isSwapped ? remoteVideoTrack : localVideoTrack;
    const isMainLocal = isSwapped;
    const isPipLocal = !isSwapped;

    // Attach main video track
    useEffect(() => {
        if (mainVideoRef.current) {
            if (mainVideoTrack) {
                mainVideoRef.current.srcObject = new MediaStream([mainVideoTrack]);
            } else {
                mainVideoRef.current.srcObject = null;
            }
        }
    }, [mainVideoTrack]);

    // Attach PiP video track
    useEffect(() => {
        if (pipVideoRef.current) {
            if (pipVideoTrack) {
                pipVideoRef.current.srcObject = new MediaStream([pipVideoTrack]);
            } else {
                pipVideoRef.current.srcObject = null;
            }
        }
    }, [pipVideoTrack]);

    // Attach remote audio track — auto-plays regardless of swap state
    useEffect(() => {
        if (remoteAudioRef.current && remoteAudioTrack) {
            remoteAudioRef.current.srcObject = new MediaStream([remoteAudioTrack]);
            remoteAudioRef.current.play().catch(e => console.warn('[CallOverlay] Audio play failed:', e));
        }
    }, [remoteAudioTrack]);

    // Call duration timer
    useEffect(() => {
        let interval: any;
        if (status === 'connected') interval = setInterval(() => setDuration(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);

    // Ensure PiP position stays within bounds on window resize
    const clampPosition = useCallback((x: number, y: number) => {
        if (typeof window === 'undefined') return { x, y };
        const pipWidth = 112;
        const pipHeight = 168;
        const minX = 12;
        const maxX = Math.max(minX, window.innerWidth - pipWidth - 12);
        const minY = 64;
        const maxY = Math.max(minY, window.innerHeight - pipHeight - 110);
        return {
            x: Math.min(Math.max(x, minX), maxX),
            y: Math.min(Math.max(y, minY), maxY),
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setPipPos(prev => prev ? clampPosition(prev.x, prev.y) : null);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampPosition]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const pipWidth = 112;
        const pipHeight = 168;
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
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;

        if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 5) {
            dragStartRef.current.hasMoved = true;
            setIsDragging(true);
        }

        if (dragStartRef.current.hasMoved) {
            const next = clampPosition(
                dragStartRef.current.initialPipX + dx,
                dragStartRef.current.initialPipY + dy
            );
            setPipPos(next);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current) return;
        const { hasMoved } = dragStartRef.current;
        dragStartRef.current = null;
        setIsDragging(false);

        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (!hasMoved) {
            // Tap / Click detected without dragging -> Swap views
            setIsSwapped(prev => !prev);
        }
    };

    const handlePointerCancel = () => {
        dragStartRef.current = null;
        setIsDragging(false);
    };

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleMicToggle = () => {
        const next = !isMuted;
        setIsMuted(next);
        if (onToggleMic) onToggleMic(!next);
    };

    const handleCameraToggle = () => {
        const next = !isVideoOff;
        setIsVideoOff(next);
        if (onToggleCamera) onToggleCamera(!next);
    };

    // Hidden audio element — always rendered so remote audio plays automatically on connect
    const AudioEl = <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />;

    if (status === 'ended') {
        return (
            <div className="fixed inset-0 z-[100] bg-[#0b141a]/95 flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
                {AudioEl}
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
                {AudioEl}
                {type === 'video' && remoteVideoTrack
                    ? <video ref={mainVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    : <img
                        src={caller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.name || 'User')}&background=00A884&color=fff&size=100`}
                        alt={caller.name || 'Call'}
                        className="w-full h-full object-cover opacity-80"
                      />
                }
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    {type === 'video' ? <Video className="text-white animate-pulse" size={22} /> : <Phone className="text-white animate-pulse" size={22} />}
                    <span className="text-[10px] text-white font-bold">{formatDuration(duration)}</span>
                </div>
            </div>
        );
    }

    const isVideoConnected = type === 'video' && status === 'connected';

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col text-white animate-in fade-in zoom-in duration-300 ${isVideoConnected ? 'bg-black' : 'bg-[#0b141a]'}`}>
            {AudioEl}

            {/* Minimize button */}
            <button
                onClick={onToggleMinimize}
                className="absolute top-6 left-6 p-2.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-20"
                title="Minimize Call"
            >
                <Minimize2 className="text-white" size={20} />
            </button>

            {isVideoConnected ? (
                /* ===== VIDEO CALL — CONNECTED: WhatsApp/Telegram-style layout ===== */
                <div className="relative w-full h-full overflow-hidden select-none touch-none">
                    {/* Main Full-Screen Video Surface */}
                    <div className="absolute inset-0 w-full h-full bg-[#111b21] flex items-center justify-center">
                        {mainVideoTrack && !(isMainLocal && isVideoOff) ? (
                            <video
                                ref={mainVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${isMainLocal ? 'scale-x-[-1]' : ''}`}
                            />
                        ) : (
                            /* Fallback avatar if camera is off or track loading */
                            <div className="flex flex-col items-center gap-4">
                                <div className="size-28 rounded-full overflow-hidden ring-4 ring-white/10 bg-slate-800 flex items-center justify-center">
                                    <img
                                        src={
                                            (isMainLocal ? localUser?.avatar : caller.avatar) ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent((isMainLocal ? localUser?.name : caller.name) || 'User')}&background=00A884&color=fff&size=200`
                                        }
                                        alt={isMainLocal ? 'You' : (caller.name || 'User')}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="text-sm text-white/70">
                                    {isMainLocal ? 'Your camera is off' : `${caller.name || 'User'} (Camera off)`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Floating Draggable & Tappable PiP Tile */}
                    <div
                        ref={pipTileRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        style={{
                            position: 'absolute',
                            left: pipPos ? `${pipPos.x}px` : 'auto',
                            top: pipPos ? `${pipPos.y}px` : 'auto',
                            right: pipPos ? 'auto' : '16px',
                            bottom: pipPos ? 'auto' : '116px',
                            touchAction: 'none',
                        }}
                        className={`w-28 h-42 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-[#1f2c34] z-30 cursor-grab active:cursor-grabbing transition-transform ${
                            isDragging ? 'scale-105 shadow-3xl ring-2 ring-[#00A884]' : 'hover:scale-[1.02]'
                        }`}
                        title="Drag to move, tap to swap"
                    >
                        {pipVideoTrack && !(isPipLocal && isVideoOff) ? (
                            <video
                                ref={pipVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover pointer-events-none ${isPipLocal ? 'scale-x-[-1]' : ''}`}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 bg-[#1f2c34] pointer-events-none">
                                <div className="size-12 rounded-full overflow-hidden ring-2 ring-white/10">
                                    <img
                                        src={
                                            (isPipLocal ? localUser?.avatar : caller.avatar) ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent((isPipLocal ? localUser?.name : caller.name) || 'User')}&background=00A884&color=fff&size=100`
                                        }
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="text-[10px] text-white/60 font-medium text-center truncate w-full">
                                    {isPipLocal ? 'Camera off' : (caller.name || 'No video')}
                                </span>
                            </div>
                        )}


                        {/* Swap indicator badge */}
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/10 pointer-events-none">
                            <ArrowLeftRight size={11} className="text-white/90" />
                        </div>
                    </div>

                    {/* Duration top center */}
                    <div className="absolute top-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
                        <span className="bg-black/40 px-4 py-1 rounded-full text-sm text-white/90 backdrop-blur-sm">
                            {formatDuration(duration)}
                        </span>
                    </div>

                    {/* Controls bottom bar */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 pt-6 px-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-around">
                        <button
                            onClick={handleMicToggle}
                            className={`size-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                isMuted ? 'bg-red-500/80 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                            }`}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                        </button>
                        <button
                            onClick={onEnd}
                            className="size-20 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl active:scale-90 transition-all"
                            title="End Call"
                        >
                            <PhoneOff size={36} />
                        </button>
                        <button
                            onClick={handleCameraToggle}
                            className={`size-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                isVideoOff ? 'bg-red-500/80 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                            }`}
                            title={isVideoOff ? 'Camera On' : 'Camera Off'}
                        >
                            <VideoOff size={22} />
                        </button>
                    </div>
                </div>
            ) : (
                /* ===== VOICE CALL / RINGING LAYOUT ===== */
                <div className="flex flex-col items-center justify-between p-8 md:p-12 h-full">
                    {/* Avatar & name */}
                    <div className="flex flex-col items-center gap-6 mt-20 animate-in slide-in-from-top-10 duration-500">
                        <div className="size-32 rounded-full overflow-hidden ring-4 ring-[#00A884]/30 shadow-2xl bg-slate-900">
                            <img
                                src={caller.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.name || 'User')}&background=00A884&color=fff&size=256`}
                                alt={caller.name || 'User'}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-center">
                            <h2 className="text-3xl font-light mb-2">{caller.name || 'Vicalary User'}</h2>
                            <p className="text-[#8696A0] uppercase tracking-[0.2em] text-sm animate-pulse">
                                {status === 'ringing'
                                    ? (direction === 'outgoing' ? 'Calling...' : 'Incoming Call...')
                                    : formatDuration(duration)}
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-center gap-8 mb-12 w-full max-w-sm">
                        {status === 'ringing' ? (
                            direction === 'outgoing' ? (
                                <div className="flex items-center justify-center w-full">
                                    <button onClick={onEnd} className="size-20 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl active:scale-95 transition-all" title="Cancel Call">
                                        <PhoneOff size={32} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-around w-full">
                                    <button onClick={onDecline} className="size-16 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl active:scale-95 transition-all" title="Decline">
                                        <PhoneOff size={28} />
                                    </button>
                                    <button onClick={onAccept} className="size-16 rounded-full bg-[#25D366] hover:bg-[#1ebc57] flex items-center justify-center shadow-xl active:scale-95 transition-all animate-bounce" title="Accept">
                                        {type === 'video' ? <Video size={28} /> : <Phone size={28} />}
                                    </button>
                                </div>
                            )
                        ) : (
                            /* Connected voice call controls */
                            <div className="flex flex-col items-center gap-8 w-full">
                                <div className="flex items-center justify-around w-full px-4">
                                    <button
                                        onClick={handleMicToggle}
                                        className={`size-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'}`}
                                        title={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                                    </button>
                                    <button className="size-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="Speaker">
                                        <Volume2 size={22} />
                                    </button>
                                </div>
                                <button onClick={onEnd} className="size-20 rounded-full bg-[#EA0038] hover:bg-[#d00032] flex items-center justify-center shadow-xl active:scale-90 transition-all" title="End Call">
                                    <PhoneOff size={36} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
