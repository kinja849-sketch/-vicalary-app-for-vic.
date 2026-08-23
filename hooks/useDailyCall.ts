"use client"
import { useState, useCallback, useRef, useEffect } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

export function useDailyCall() {
    const [callFrame, setCallFrame] = useState<DailyCall | null>(null);
    const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'leaving' | 'error'>('idle');
    const [participants, setParticipants] = useState<any[]>([]);

    // Manage event listeners with useEffect
    useEffect(() => {
        if (!callFrame) return;

        const handleJoined = () => {
            console.log('[Daily] Joined meeting');
            setStatus('joined');
            setParticipants(Object.values(callFrame.participants()));
        };

        const handleParticipantAllocated = () => {
            setParticipants(Object.values(callFrame.participants()));
        };

        const handleError = (event: any) => {
            console.error('[Daily] Call error:', event);
            setStatus('error');
        };

        // Attach listeners
        callFrame.on('joined-meeting', handleJoined);
        callFrame.on('participant-joined', handleParticipantAllocated);
        callFrame.on('participant-updated', handleParticipantAllocated);
        callFrame.on('participant-left', handleParticipantAllocated);
        callFrame.on('error', handleError);

        // Check initial state in case we missed event
        if (callFrame.meetingState() === 'joined-meeting') {
            handleJoined();
        }

        return () => {
            // Cleanup listeners safely
            try {
                callFrame.off('joined-meeting', handleJoined);
                callFrame.off('participant-joined', handleParticipantAllocated);
                callFrame.off('participant-updated', handleParticipantAllocated);
                callFrame.off('participant-left', handleParticipantAllocated);
                callFrame.off('error', handleError);
            } catch (err) {
                console.warn('[Daily] Failed to remove listeners (frame likely destroyed):', err);
            }
        };
    }, [callFrame]);

    const joinCall = useCallback(async (url: string, isVideo: boolean = false) => {
        if (typeof window === 'undefined') return;
        // Use existing instance if available, otherwise create one
        let frame = DailyIframe.getCallInstance();
        if (!frame) {
            frame = DailyIframe.createFrame({
                showLeaveButton: true,
                iframeStyle: {
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    border: '0',
                    zIndex: '9999'
                }
            });
        }

        setCallFrame(frame);
        setStatus('joining');

        try {
            await frame.join({ url });
        } catch (err) {
            console.error('[Daily] Failed to join call:', err);
            setStatus('error');
        }
    }, []);

    const leaveCall = useCallback(async () => {
        const frame = callFrame || DailyIframe.getCallInstance();
        if (!frame) return;

        setStatus('leaving');
        try {
            await frame.leave();
            await frame.destroy();
            setCallFrame(null);
            setStatus('idle');
            setParticipants([]);
        } catch (err) {
            console.error('[Daily] Failed to leave/destroy call:', err);
            setCallFrame(null);
            setStatus('idle');
        }
    }, [callFrame]);

    const toggleAudio = useCallback((enabled: boolean) => {
        callFrame?.setLocalAudio(enabled);
    }, [callFrame]);

    const toggleVideo = useCallback((enabled: boolean) => {
        callFrame?.setLocalVideo(enabled);
    }, [callFrame]);

    const updateIframeStyle = useCallback((style: any) => {
        (callFrame as any)?.updateIframeStyles(style);
    }, [callFrame]);

    return {
        joinCall,
        leaveCall,
        toggleAudio,
        toggleVideo,
        updateIframeStyle,
        status,
        participants,
        callFrame,
    };
}
