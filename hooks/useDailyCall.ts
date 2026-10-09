"use client"
import { useState, useCallback, useEffect, useRef } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

export type DailyConnectionState = 'idle' | 'joining' | 'waiting_peer' | 'connected' | 'leaving' | 'error';

export function useDailyCall() {
    const [callObject, setCallObject] = useState<DailyCall | null>(null);
    const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'leaving' | 'error'>('idle');
    const [connectionState, setConnectionState] = useState<DailyConnectionState>('idle');
    const [participants, setParticipants] = useState<any[]>([]);
    const [peerJoined, setPeerJoined] = useState(false);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);

    // Confirmed media states derived from Daily
    const [isLocalAudioMuted, setIsLocalAudioMuted] = useState(false);
    const [isLocalVideoOff, setIsLocalVideoOff] = useState(true);
    const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
    const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(true);

    // Device management
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [isSpeakerSupported, setIsSpeakerSupported] = useState(false);
    const [speakerActive, setSpeakerActive] = useState(false);
    const [activeVideoDeviceId, setActiveVideoDeviceId] = useState<string | null>(null);

    const callTypeRef = useRef<'voice' | 'video'>('voice');
    const callObjectRef = useRef<DailyCall | null>(null);

    // Check device capabilities
    const checkDevices = useCallback(async (co?: DailyCall) => {
        try {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            setHasMultipleCameras(videoInputs.length > 1);

            // Check speaker / audio output support
            const hasSinkId = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
            const hasDailyOutput = typeof (co as any)?.setOutputDeviceAsync === 'function';
            setIsSpeakerSupported(Boolean(hasSinkId || hasDailyOutput));
        } catch (err) {
            console.warn('[useDailyCall] Device enumeration error:', err);
        }
    }, []);

    const refreshTracks = useCallback((co: DailyCall | null) => {
        if (!co) return;
        let parts: Record<string, any> = {};
        try {
            parts = co.participants();
        } catch (_) {
            return;
        }

        const localP = parts.local;
        const remoteParticipants = Object.values(parts).filter((p: any) => !p.local) as any[];
        const remoteP = remoteParticipants[0];

        const getTrack = (trackState: any, directTrack?: any) => {
            if (trackState && (trackState.state === 'off' || trackState.state === 'blocked')) return null;
            const t = trackState?.persistentTrack || trackState?.track || (directTrack instanceof MediaStreamTrack ? directTrack : null);
            return (t && t instanceof MediaStreamTrack && t.readyState !== 'ended') ? t : null;
        };

        const lvt = getTrack(localP?.tracks?.video, localP?.videoTrack);
        const rvt = getTrack(remoteP?.tracks?.video, remoteP?.videoTrack);
        const rat = getTrack(remoteP?.tracks?.audio, remoteP?.audioTrack);

        setLocalVideoTrack(lvt);
        setRemoteVideoTrack(rvt);
        setRemoteAudioTrack(rat);
        setParticipants(Object.values(parts));

        // Derive confirmed media states directly from Daily's reported participant tracks
        const localMicState = localP?.tracks?.audio?.state;
        setIsLocalAudioMuted(localMicState === 'off' || localMicState === 'blocked');

        const localCamState = localP?.tracks?.video?.state;
        setIsLocalVideoOff(!lvt || localCamState === 'off' || localCamState === 'blocked');

        if (remoteP) {
            setPeerJoined(true);
            setConnectionState('connected');

            // Explicitly ensure remote tracks are actively subscribed
            try {
                co.updateParticipant(remoteP.session_id, {
                    setSubscribedTracks: { audio: true, video: true } as any
                });
            } catch (_) {}

            const remoteMicState = remoteP?.tracks?.audio?.state;
            setIsRemoteAudioMuted(remoteMicState === 'off' || remoteMicState === 'blocked');

            const remoteCamState = remoteP?.tracks?.video?.state;
            setIsRemoteVideoOff(!rvt || remoteCamState === 'off' || remoteCamState === 'blocked');
        } else {
            setPeerJoined(false);
            setIsRemoteAudioMuted(false);
            setIsRemoteVideoOff(true);
            if (co.meetingState() === 'joined-meeting') {
                setConnectionState('waiting_peer');
            }
        }
    }, []);

    // Set up all Daily event listeners synchronously upon creation to never miss events
    const setupCallListeners = useCallback((co: DailyCall) => {
        const handleJoined = () => {
            console.log('[Daily] Joined room successfully');
            setStatus('joined');
            const parts = co.participants();
            const hasPeer = Object.values(parts).some((p: any) => !p.local);
            setConnectionState(hasPeer ? 'connected' : 'waiting_peer');
            refreshTracks(co);
            checkDevices(co);
        };

        const handleParticipantJoined = (ev?: any) => {
            console.log('[Daily] participant-joined event:', ev?.participant?.session_id);
            if (ev?.participant && !ev.participant.local) {
                setPeerJoined(true);
                setConnectionState('connected');
                try {
                    co.updateParticipant(ev.participant.session_id, {
                        setSubscribedTracks: { audio: true, video: true } as any
                    });
                } catch (subErr) {
                    console.warn('[Daily] Failed to setSubscribedTracks on participant-joined:', subErr);
                }
            }
            refreshTracks(co);
        };

        const handleParticipantUpdated = (ev?: any) => {
            if (ev?.participant && !ev.participant.local) {
                setPeerJoined(true);
            }
            refreshTracks(co);
        };

        const handleTrackStarted = (ev?: any) => {
            console.log('[Daily] track-started event:', ev?.type, ev?.participant?.session_id);
            if (ev?.participant && !ev.participant.local) {
                setPeerJoined(true);
                setConnectionState('connected');
                if (ev.type === 'video' && ev.track) {
                    setRemoteVideoTrack(ev.track);
                    setIsRemoteVideoOff(false);
                } else if (ev.type === 'audio' && ev.track) {
                    setRemoteAudioTrack(ev.track);
                    setIsRemoteAudioMuted(false);
                }
            } else if (ev?.participant?.local && ev.type === 'video' && ev.track) {
                setLocalVideoTrack(ev.track);
                setIsLocalVideoOff(false);
            }
            refreshTracks(co);
        };

        const handleTrackStopped = (_ev?: any) => {
            refreshTracks(co);
        };

        const handleParticipantLeft = (ev?: any) => {
            console.log('[Daily] participant-left event:', ev?.participant?.session_id);
            refreshTracks(co);
        };

        const handleError = (event: any) => {
            console.error('[Daily] Call error:', event);
            setStatus('error');
            setConnectionState('error');
        };

        const handleLeft = () => {
            console.log('[Daily] Left meeting');
            setStatus('idle');
            setConnectionState('idle');
            setParticipants([]);
            setPeerJoined(false);
            setLocalVideoTrack(null);
            setRemoteVideoTrack(null);
            setRemoteAudioTrack(null);
        };

        const handleDeviceChange = () => {
            checkDevices(co);
        };

        co.on('joined-meeting', handleJoined);
        co.on('participant-joined', handleParticipantJoined);
        co.on('participant-updated', handleParticipantUpdated);
        co.on('participant-left', handleParticipantLeft);
        co.on('left-meeting', handleLeft);
        co.on('error', handleError);
        co.on('camera-error', handleError);
        co.on('track-started', handleTrackStarted);
        co.on('track-stopped', handleTrackStopped);
        co.on('available-devices-updated', handleDeviceChange);
        co.on('selected-devices-updated', handleDeviceChange);
    }, [refreshTracks, checkDevices]);

    // Unmount cleanup to prevent leaking Daily call instances across page transitions
    useEffect(() => {
        return () => {
            try {
                const instance = DailyIframe.getCallInstance();
                if (instance) {
                    instance.destroy().catch(() => {});
                }
            } catch (_) {}
        };
    }, []);

    const joinCall = useCallback(async (url: string, isVideo: boolean = false, userName?: string) => {
        if (typeof window === 'undefined') return;
        callTypeRef.current = isVideo ? 'video' : 'voice';

        try {
            const existing = DailyIframe.getCallInstance();
            if (existing) {
                try { await existing.leave(); } catch (_) {}
                try { await existing.destroy(); } catch (_) {}
            }
        } catch (_) {}

        let co: DailyCall | null = null;
        try {
            // Strictly enforce: audio calls MUST NEVER request camera permission or create video source!
            // Explicitly enable subscribeToTracksAutomatically: true to prevent staging tracks
            co = DailyIframe.createCallObject({
                audioSource: true,
                videoSource: isVideo ? true : false,
                subscribeToTracksAutomatically: true,
                dailyConfig: {
                    experimentalChromeVideoMuteLightOff: true,
                    useDevicePreference: true,
                } as any
            });
        } catch (createErr) {
            console.error('[Daily] Failed to create call object:', createErr);
            setStatus('error');
            setConnectionState('error');
            return;
        }

        callObjectRef.current = co;
        setCallObject(co);
        // Synchronously bind listeners BEFORE joining room
        setupCallListeners(co);
        setStatus('joining');
        setConnectionState('joining');

        try {
            await co.join({
                url,
                startAudioOff: false,
                startVideoOff: !isVideo,
                userName: userName || 'Vicalary User'
            });
            await checkDevices(co);
            refreshTracks(co);
        } catch (err) {
            console.error('[Daily] Failed to join call room:', err);
            setStatus('error');
            setConnectionState('error');
            try { await co.destroy(); } catch (_) {}
            callObjectRef.current = null;
            setCallObject(null);
        }
    }, [setupCallListeners, checkDevices, refreshTracks]);

    const leaveCall = useCallback(async () => {
        const co = callObjectRef.current || callObject;
        if (!co) {
            try {
                const ex = DailyIframe.getCallInstance();
                if (ex) {
                    try { await ex.leave(); } catch (_) {}
                    try { await ex.destroy(); } catch (_) {}
                }
            } catch (_) {}
            setStatus('idle');
            setConnectionState('idle');
            setParticipants([]);
            setPeerJoined(false);
            return;
        }
        setStatus('leaving');
        setConnectionState('leaving');
        try {
            await co.leave();
            await co.destroy();
        } catch (err) {
            console.warn('[Daily] Destroy warning:', err);
        } finally {
            callObjectRef.current = null;
            setCallObject(null);
            setStatus('idle');
            setConnectionState('idle');
            setParticipants([]);
            setPeerJoined(false);
            setLocalVideoTrack(null);
            setRemoteVideoTrack(null);
            setRemoteAudioTrack(null);
            setIsLocalAudioMuted(false);
            setIsLocalVideoOff(true);
            setIsRemoteAudioMuted(false);
            setIsRemoteVideoOff(true);
        }
    }, [callObject]);

    const toggleAudio = useCallback((enabled: boolean) => {
        if (callObject) {
            callObject.setLocalAudio(enabled);
            setIsLocalAudioMuted(!enabled);
        }
    }, [callObject]);

    const toggleVideo = useCallback((enabled: boolean) => {
        if (callObject) {
            callObject.setLocalVideo(enabled);
            setIsLocalVideoOff(!enabled);
        }
    }, [callObject]);

    /**
     * Camera flip: cycles between front and rear cameras where available
     * without disconnecting call or interrupting audio.
     */
    const flipCamera = useCallback(async (): Promise<boolean> => {
        if (!callObject || !hasMultipleCameras) return false;
        try {
            // Daily provides cycleCamera() specifically for mobile front/back camera toggling
            if (typeof (callObject as any).cycleCamera === 'function') {
                await (callObject as any).cycleCamera();
                return true;
            }

            // Fallback: enumerate videoinput devices and select the alternate device
            if (navigator?.mediaDevices?.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                if (videoDevices.length > 1) {
                    const currentIndex = videoDevices.findIndex(d => d.deviceId === activeVideoDeviceId);
                    const nextIndex = (currentIndex + 1) % videoDevices.length;
                    const nextDeviceId = videoDevices[nextIndex].deviceId;
                    await callObject.setInputDevicesAsync({ videoDeviceId: nextDeviceId });
                    setActiveVideoDeviceId(nextDeviceId);
                    return true;
                }
            }
            return false;
        } catch (err) {
            console.error('[useDailyCall] Failed to flip camera:', err);
            return false;
        }
    }, [callObject, hasMultipleCameras, activeVideoDeviceId]);

    /**
     * Speaker toggle: routes audio to speakerphone or default output where supported
     */
    const toggleSpeaker = useCallback(async (): Promise<boolean> => {
        if (!isSpeakerSupported) return false;
        try {
            const nextActive = !speakerActive;
            setSpeakerActive(nextActive);

            if (callObject && typeof (callObject as any).setOutputDeviceAsync === 'function') {
                // If Daily supports setOutputDeviceAsync, enumerate outputs
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                if (audioOutputs.length > 1) {
                    const targetDevice = nextActive ? (audioOutputs[1]?.deviceId || audioOutputs[0]?.deviceId) : audioOutputs[0]?.deviceId;
                    await (callObject as any).setOutputDeviceAsync({ outputDeviceId: targetDevice });
                }
            }
            return true;
        } catch (err) {
            console.warn('[useDailyCall] toggleSpeaker error:', err);
            return false;
        }
    }, [callObject, isSpeakerSupported, speakerActive]);

    /**
     * Force refresh of session tracks and enforce active subscriptions.
     * Called when Supabase reports peer connection or on handshake polling.
     */
    const refreshSessionTracks = useCallback(() => {
        const co = callObjectRef.current || callObject;
        if (co) {
            try {
                co.setSubscribeToTracksAutomatically(true);
            } catch (_) {}
            refreshTracks(co);
        }
    }, [callObject, refreshTracks]);

    return {
        joinCall,
        leaveCall,
        toggleAudio,
        toggleVideo,
        flipCamera,
        toggleSpeaker,
        refreshSessionTracks,
        status,
        connectionState,
        peerJoined,
        participants,
        localVideoTrack,
        remoteVideoTrack,
        remoteAudioTrack,
        isLocalAudioMuted,
        isLocalVideoOff,
        isRemoteAudioMuted,
        isRemoteVideoOff,
        hasMultipleCameras,
        isSpeakerSupported,
        speakerActive
    };
}

