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

    const refreshTracks = useCallback((co: DailyCall) => {
        const parts = co.participants();
        const localP = parts.local;
        const remoteP = Object.values(parts).find((p: any) => !p.local) as any;

        const getTrack = (trackState: any) => {
            if (!trackState || trackState.state === 'off' || trackState.state === 'blocked') return null;
            return trackState.persistentTrack || trackState.track || null;
        };

        const lvt = getTrack(localP?.tracks?.video);
        const rvt = getTrack(remoteP?.tracks?.video);
        const rat = getTrack(remoteP?.tracks?.audio);

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
            const remoteMicState = remoteP?.tracks?.audio?.state;
            setIsRemoteAudioMuted(remoteMicState === 'off' || remoteMicState === 'blocked');

            const remoteCamState = remoteP?.tracks?.video?.state;
            setIsRemoteVideoOff(!rvt || remoteCamState === 'off' || remoteCamState === 'blocked');

            setConnectionState('connected');
        } else {
            setPeerJoined(false);
            setIsRemoteAudioMuted(false);
            setIsRemoteVideoOff(true);
            if (co.meetingState() === 'joined-meeting') {
                setConnectionState('waiting_peer');
            }
        }
    }, []);

    useEffect(() => {
        if (!callObject) return;

        const handleJoined = () => {
            console.log('[Daily] Joined room successfully');
            setStatus('joined');
            const parts = callObject.participants();
            const hasPeer = Object.values(parts).some((p: any) => !p.local);
            setConnectionState(hasPeer ? 'connected' : 'waiting_peer');
            refreshTracks(callObject);
            checkDevices(callObject);
        };

        const handleParticipant = () => {
            refreshTracks(callObject);
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
            checkDevices(callObject);
        };

        callObject.on('joined-meeting', handleJoined);
        callObject.on('participant-joined', handleParticipant);
        callObject.on('participant-updated', handleParticipant);
        callObject.on('participant-left', handleParticipant);
        callObject.on('left-meeting', handleLeft);
        callObject.on('error', handleError);
        callObject.on('camera-error', handleError);
        callObject.on('track-started', handleParticipant);
        callObject.on('track-stopped', handleParticipant);
        callObject.on('available-devices-updated', handleDeviceChange);
        callObject.on('selected-devices-updated', handleDeviceChange);

        if (callObject.meetingState() === 'joined-meeting') {
            handleJoined();
        }

        return () => {
            try {
                callObject.off('joined-meeting', handleJoined);
                callObject.off('participant-joined', handleParticipant);
                callObject.off('participant-updated', handleParticipant);
                callObject.off('participant-left', handleParticipant);
                callObject.off('left-meeting', handleLeft);
                callObject.off('error', handleError);
                callObject.off('camera-error', handleError);
                callObject.off('track-started', handleParticipant);
                callObject.off('track-stopped', handleParticipant);
                callObject.off('available-devices-updated', handleDeviceChange);
                callObject.off('selected-devices-updated', handleDeviceChange);
            } catch (err) {
                console.warn('[Daily] Listener cleanup warning:', err);
            }
        };
    }, [callObject, refreshTracks, checkDevices]);

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
            co = DailyIframe.createCallObject({
                audioSource: true,
                videoSource: isVideo ? true : false,
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

        setCallObject(co);
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
        } catch (err) {
            console.error('[Daily] Failed to join call room:', err);
            setStatus('error');
            setConnectionState('error');
            try { await co.destroy(); } catch (_) {}
            setCallObject(null);
        }
    }, [checkDevices]);

    const leaveCall = useCallback(async () => {
        if (!callObject) {
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
            await callObject.leave();
            await callObject.destroy();
        } catch (err) {
            console.warn('[Daily] Destroy warning:', err);
        } finally {
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

    return {
        joinCall,
        leaveCall,
        toggleAudio,
        toggleVideo,
        flipCamera,
        toggleSpeaker,
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
