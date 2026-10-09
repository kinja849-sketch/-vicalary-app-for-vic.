"use client"
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, VolumeX, AlertCircle } from 'lucide-react';

interface DailyMediaViewProps {
    track: MediaStreamTrack | null;
    isLocal?: boolean;
    mirror?: boolean;
    className?: string;
    objectFit?: 'cover' | 'contain' | 'fill';
    fallback?: React.ReactNode;
    onPlaybackFailed?: () => void;
}

/**
 * Reusable video component that attaches and clears srcObject whenever
 * its video element mounts or its track changes (e.g., ringing-to-connected,
 * camera toggles, minimize/restore, and participant swaps).
 * Keeps local playback strictly muted and inline.
 * Handles remote playback failures with a visible retry button.
 */
export function DailyMediaView({
    track,
    isLocal = false,
    mirror = false,
    className = '',
    objectFit = 'cover',
    fallback,
    onPlaybackFailed,
}: DailyMediaViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackBlocked, setPlaybackBlocked] = useState(false);

    const tryPlay = useCallback(async () => {
        const el = videoRef.current;
        if (!el) return;
        try {
            await el.play();
            setPlaybackBlocked(false);
        } catch (err: any) {
            console.warn('[DailyMediaView] Playback failed/blocked:', err?.message || err);
            setPlaybackBlocked(true);
            if (onPlaybackFailed) onPlaybackFailed();
        }
    }, [onPlaybackFailed]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        if (track && track.readyState !== 'ended') {
            const currentStream = el.srcObject as MediaStream | null;
            const currentTrack = currentStream?.getTracks()[0];

            if (currentTrack !== track) {
                const stream = new MediaStream([track]);
                el.srcObject = stream;
            }
            setPlaybackBlocked(false);

            // Attempt playback
            tryPlay();

            // Track mute / unmute events
            const handleTrackEnded = () => {
                if (el.srcObject) {
                    el.srcObject = null;
                }
            };
            track.addEventListener('ended', handleTrackEnded);

            return () => {
                track.removeEventListener('ended', handleTrackEnded);
            };
        } else {
            el.srcObject = null;
            setPlaybackBlocked(false);
        }
    }, [track, tryPlay]);

    if (!track) {
        return <>{fallback || null}</>;
    }

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                style={{ objectFit }}
                className={`w-full h-full ${mirror ? 'scale-x-[-1]' : ''}`}
            />

            {/* Visible retry button when browser blocks autoplay */}
            {playbackBlocked && !isLocal && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-center">
                    <AlertCircle className="text-amber-400 size-8 mb-2" />
                    <p className="text-white text-xs mb-3 font-medium">Video playback paused by browser</p>
                    <button
                        type="button"
                        onClick={tryPlay}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00A884] hover:bg-[#009473] text-white text-xs font-semibold rounded-full shadow-lg transition-transform active:scale-95"
                    >
                        <Play size={14} className="fill-current" />
                        <span>Resume Video</span>
                    </button>
                </div>
            )}
        </div>
    );
}

interface DailyAudioTrackProps {
    track: MediaStreamTrack | null;
    sinkId?: string;
    onPlaybackFailed?: () => void;
}

/**
 * Reusable audio component that ensures remote audio plays exactly once,
 * attaches/detaches srcObject cleanly, and recovers from autoplay policies.
 */
export function DailyAudioTrack({ track, sinkId, onPlaybackFailed }: DailyAudioTrackProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [audioBlocked, setAudioBlocked] = useState(false);

    const tryPlayAudio = useCallback(async () => {
        const el = audioRef.current;
        if (!el) return;
        try {
            await el.play();
            setAudioBlocked(false);
        } catch (err: any) {
            console.warn('[DailyAudioTrack] Autoplay blocked:', err?.message || err);
            setAudioBlocked(true);
            if (onPlaybackFailed) onPlaybackFailed();
        }
    }, [onPlaybackFailed]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        if (track && track.readyState !== 'ended') {
            const stream = new MediaStream([track]);
            el.srcObject = stream;
            setAudioBlocked(false);
            tryPlayAudio();

            return () => {
                if (el.srcObject === stream) {
                    el.srcObject = null;
                }
            };
        } else {
            el.srcObject = null;
            setAudioBlocked(false);
        }
    }, [track, tryPlayAudio]);

    // Apply custom sinkId if supported
    useEffect(() => {
        const el = audioRef.current;
        if (!el || !sinkId) return;
        if (typeof (el as any).setSinkId === 'function') {
            (el as any).setSinkId(sinkId).catch((err: any) => {
                console.warn('[DailyAudioTrack] setSinkId error:', err);
            });
        }
    }, [sinkId]);

    return (
        <>
            <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
            {audioBlocked && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-black/85 border border-amber-500/30 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
                    <VolumeX size={16} className="text-amber-400" />
                    <span className="text-xs font-medium">Audio is muted by your browser</span>
                    <button
                        type="button"
                        onClick={tryPlayAudio}
                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold transition-all active:scale-95"
                    >
                        Enable Audio
                    </button>
                </div>
            )}
        </>
    );
}

export default DailyMediaView;
