"use client"
import { useState, useCallback, useEffect } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

export function useDailyCall() {
    const [callObject, setCallObject] = useState<DailyCall | null>(null);
    const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'leaving' | 'error'>('idle');
    const [participants, setParticipants] = useState<any[]>([]);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);

    const refreshTracks = useCallback((co: DailyCall) => {
        const parts = co.participants();
        const localP = parts.local;
        const remoteP = Object.values(parts).find((p: any) => !p.local) as any;
        setLocalVideoTrack(localP?.tracks?.video?.persistentTrack ?? null);
        setRemoteVideoTrack(remoteP?.tracks?.video?.persistentTrack ?? null);
        setRemoteAudioTrack(remoteP?.tracks?.audio?.persistentTrack ?? null);
        setParticipants(Object.values(parts));
    }, []);

    useEffect(() => {
        if (!callObject) return;
        const handleJoined = () => { console.log('[Daily] Joined room successfully'); setStatus('joined'); refreshTracks(callObject); };
        const handleParticipant = () => refreshTracks(callObject);
        const handleError = (event: any) => { console.error('[Daily] Call error:', event); setStatus('error'); };
        const handleLeft = () => { console.log('[Daily] Left meeting'); setStatus('idle'); setParticipants([]); setLocalVideoTrack(null); setRemoteVideoTrack(null); setRemoteAudioTrack(null); };
        callObject.on('joined-meeting', handleJoined);
        callObject.on('participant-joined', handleParticipant);
        callObject.on('participant-updated', handleParticipant);
        callObject.on('participant-left', handleParticipant);
        callObject.on('left-meeting', handleLeft);
        callObject.on('error', handleError);
        callObject.on('track-started', handleParticipant);
        callObject.on('track-stopped', handleParticipant);
        if (callObject.meetingState() === 'joined-meeting') handleJoined();
        return () => {
            try {
                callObject.off('joined-meeting', handleJoined);
                callObject.off('participant-joined', handleParticipant);
                callObject.off('participant-updated', handleParticipant);
                callObject.off('participant-left', handleParticipant);
                callObject.off('left-meeting', handleLeft);
                callObject.off('error', handleError);
                callObject.off('track-started', handleParticipant);
                callObject.off('track-stopped', handleParticipant);
            } catch (err) { console.warn('[Daily] Listener cleanup warning:', err); }
        };
    }, [callObject, refreshTracks]);

    const joinCall = useCallback(async (url: string, isVideo: boolean = false, userName?: string) => {
        if (typeof window === 'undefined') return;
        try { const existing = DailyIframe.getCallInstance(); if (existing) await existing.destroy(); } catch (_) {}
        const co = DailyIframe.createCallObject({ audioSource: true, videoSource: isVideo });
        setCallObject(co);
        setStatus('joining');
        try {
            await co.join({ url, startAudioOff: false, startVideoOff: !isVideo, userName: userName || 'Vicalary User' });
        } catch (err) { console.error('[Daily] Failed to join call room:', err); setStatus('error'); }
    }, []);

    const leaveCall = useCallback(async () => {
        if (!callObject) {
            try { const ex = DailyIframe.getCallInstance(); if (ex) await ex.destroy(); } catch (_) {}
            setStatus('idle'); setParticipants([]); return;
        }
        setStatus('leaving');
        try { await callObject.leave(); await callObject.destroy(); } catch (err) { console.warn('[Daily] Destroy warning:', err); }
        finally { setCallObject(null); setStatus('idle'); setParticipants([]); setLocalVideoTrack(null); setRemoteVideoTrack(null); setRemoteAudioTrack(null); }
    }, [callObject]);

    const toggleAudio = useCallback((enabled: boolean) => { if (callObject) callObject.setLocalAudio(enabled); }, [callObject]);
    const toggleVideo = useCallback((enabled: boolean) => { if (callObject) callObject.setLocalVideo(enabled); }, [callObject]);

    return { joinCall, leaveCall, toggleAudio, toggleVideo, status, participants, localVideoTrack, remoteVideoTrack, remoteAudioTrack };
}
