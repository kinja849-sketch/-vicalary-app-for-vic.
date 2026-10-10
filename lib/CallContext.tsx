"use client"
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import { initiateCallV2, updateCallStatus, sendMessage } from './api/chat';
import { useDailyCall } from '@/hooks/useDailyCall';
import CallOverlay from '@/components/CallOverlay';
import { toast } from 'sonner';

const COACH_ID = '00000000-0000-0000-0000-000000000001';

interface CallSession {
    id?: string;
    conversationId: string;
    roomUrl?: string;
    type: 'voice' | 'video';
    status: 'ringing' | 'connected' | 'ended';
    direction: 'incoming' | 'outgoing';
    partnerName: string;
    partnerAvatar?: string | null;
    callerId: string;
    receiverId: string;
    isMinimized?: boolean;
}

interface CallContextType {
    activeCall: CallSession | null;
    onlineUsers: Set<string>;
    isUserOnline: (userId: string) => boolean;
    startCall: (params: {
        conversationId: string;
        receiverId: string;
        type: 'voice' | 'video';
        partnerName: string;
        partnerAvatar?: string | null;
        isSelf?: boolean;
        isAI?: boolean;
    }) => Promise<void>;
    endCall: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

/**
 * High-fidelity Web Audio API ringtone synthesizer.
 * Operates without external media files, providing instant chime for incoming calls
 * and standard ringback for outgoing calls. Guaranteed stop on any state change.
 */
class RingtonePlayer {
    private ctx: AudioContext | null = null;
    private timer: any = null;
    private isRunning: boolean = false;

    start(type: 'incoming' | 'outgoing') {
        if (this.isRunning) return;
        this.isRunning = true;
        try {
            const AudioCtx = (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) || null;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }

            const playPattern = () => {
                if (!this.ctx || !this.isRunning) return;
                const now = this.ctx.currentTime;

                if (type === 'incoming') {
                    // WhatsApp-like dual musical chime (523Hz + 659Hz)
                    const osc1 = this.ctx.createOscillator();
                    const osc2 = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(523.25, now);
                    osc2.type = 'triangle';
                    osc2.frequency.setValueAtTime(659.25, now);

                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
                    gain.gain.linearRampToValueAtTime(0.08, now + 0.5);
                    gain.gain.linearRampToValueAtTime(0.2, now + 0.65);
                    gain.gain.linearRampToValueAtTime(0, now + 1.2);

                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc1.start(now);
                    osc2.start(now);
                    osc1.stop(now + 1.25);
                    osc2.stop(now + 1.25);
                } else {
                    // Standard ringback tone (440Hz + 480Hz)
                    const osc1 = this.ctx.createOscillator();
                    const osc2 = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(440, now);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(480, now);

                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
                    gain.gain.setValueAtTime(0.12, now + 1.8);
                    gain.gain.linearRampToValueAtTime(0, now + 1.9);

                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc1.start(now);
                    osc2.start(now);
                    osc1.stop(now + 1.95);
                    osc2.stop(now + 1.95);
                }
            };

            playPattern();
            const interval = type === 'incoming' ? 2400 : 4000;
            this.timer = setInterval(playPattern, interval);
        } catch (e) {
            console.warn('[RingtonePlayer] AudioContext error:', e);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.ctx) {
            try { this.ctx.close().catch(() => {}); } catch (_) {}
            this.ctx = null;
        }
    }
}

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [callSession, setCallSession] = useState<CallSession | null>(null);
    // Global Online Users Set & Ringing status
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [isPeerRinging, setIsPeerRinging] = useState(false);
    const ringtoneRef = useRef<RingtonePlayer>(new RingtonePlayer());
    const isAcceptingRef = useRef(false);

    const isUserOnline = useCallback((userId: string) => {
        return onlineUsers.has(userId);
    }, [onlineUsers]);

    // Track global online presence with sync, join, and leave events
    useEffect(() => {
        if (!user?.id) return;

        // Clean up any stale channels before re-creating
        const existingChannels = supabase.getChannels().filter(ch => ch.topic === 'realtime:online-users' || ch.topic === 'online-users');
        for (const ch of existingChannels) {
            try { supabase.removeChannel(ch); } catch (_) {}
        }

        const presenceChannel = supabase.channel('online-users');

        const recomputeOnline = () => {
            const state = presenceChannel.presenceState();
            const online = new Set<string>();
            Object.values(state).forEach((presences: any) => {
                presences.forEach((p: any) => {
                    if (p.user_id) online.add(p.user_id);
                });
            });
            setOnlineUsers(online);
        };

        presenceChannel
            .on('presence', { event: 'sync' }, recomputeOnline)
            .on('presence', { event: 'join' }, recomputeOnline)
            .on('presence', { event: 'leave' }, recomputeOnline)
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        return () => {
            supabase.removeChannel(presenceChannel);
        };
    }, [user?.id]);

    const targetPeerId = callSession?.direction === 'outgoing' ? callSession.receiverId : callSession?.callerId;
    const isPeerOnline = Boolean(isPeerRinging || (targetPeerId && onlineUsers.has(targetPeerId)));

    const {
        joinCall,
        leaveCall,
        toggleAudio,
        toggleVideo,
        flipCamera,
        toggleSpeaker,
        refreshSessionTracks,
        connectionState,
        peerJoined,
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
    } = useDailyCall();

    const handshakeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const connectedAtRef = useRef<number | null>(null);
    const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const triggerTrackSyncHandshake = useCallback(() => {
        if (handshakeIntervalRef.current) {
            clearInterval(handshakeIntervalRef.current);
            handshakeIntervalRef.current = null;
        }
        refreshSessionTracks();
        let ticks = 0;
        handshakeIntervalRef.current = setInterval(() => {
            ticks++;
            refreshSessionTracks();
            if (ticks >= 12) {
                if (handshakeIntervalRef.current) {
                    clearInterval(handshakeIntervalRef.current);
                    handshakeIntervalRef.current = null;
                }
            }
        }, 500);
    }, [refreshSessionTracks]);

    // Track call status transitions: duration, ringing timeout, and cleanup
    useEffect(() => {
        if (!callSession || callSession.status !== 'ringing') {
            setIsPeerRinging(false);
        }
        if (callSession?.status === 'connected') {
            if (!connectedAtRef.current) {
                connectedAtRef.current = Date.now();
            }
            if (ringingTimeoutRef.current) {
                clearTimeout(ringingTimeoutRef.current);
                ringingTimeoutRef.current = null;
            }
        }
        if (!callSession || callSession.status === 'ended') {
            connectedAtRef.current = null;
            if (handshakeIntervalRef.current) {
                clearInterval(handshakeIntervalRef.current);
                handshakeIntervalRef.current = null;
            }
            if (ringingTimeoutRef.current) {
                clearTimeout(ringingTimeoutRef.current);
                ringingTimeoutRef.current = null;
            }
        }
    }, [callSession?.status]);

    // Manage ringtone playback strictly according to ringing status
    useEffect(() => {
        if (callSession?.status === 'ringing') {
            ringtoneRef.current.start(callSession.direction === 'incoming' ? 'incoming' : 'outgoing');
        } else {
            ringtoneRef.current.stop();
        }

        return () => {
            ringtoneRef.current.stop();
        };
    }, [callSession?.status, callSession?.direction]);

    // 1. Realtime Subscriptions for Calls
    useEffect(() => {
        if (!user?.id) return;

        console.log(`[CallContext] Setting up realtime for user: ${user.id}`);

        const channel = supabase.channel(`global_calls_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'calls',
                },
                async (payload) => {
                    console.log('[CallContext] RAW realtime event:', payload.eventType, payload.new, payload.old);
                    const newCall = payload.new as any;
                    const eventType = payload.eventType;

                    if (eventType === 'INSERT' && newCall?.status === 'ringing' && newCall?.receiver_id === user.id) {
                        // Immediately acknowledge ringing to caller
                        try {
                            const ackChannel = supabase.channel(`call_ack_${newCall.id}`);
                            ackChannel.subscribe((subStatus) => {
                                if (subStatus === 'SUBSCRIBED') {
                                    ackChannel.send({
                                        type: 'broadcast',
                                        event: 'ringing',
                                        payload: { callId: newCall.id, receiverId: user.id }
                                    });
                                }
                            });
                        } catch (ackErr) {
                            console.warn('[CallContext] Error sending ringing acknowledgement:', ackErr);
                        }
                        // Fetch caller profile
                        let callerName = 'Vicalary User';
                        let callerAvatar: string | null = null;

                        try {
                            const { data: callerProfile } = await supabase
                                .from('user_profiles')
                                .select('full_name, username, avatar_url')
                                .eq('id', newCall.caller_id)
                                .maybeSingle();

                            if (callerProfile) {
                                callerName = callerProfile.full_name || callerProfile.username || 'Vicalary User';
                                callerAvatar = callerProfile.avatar_url || null;
                            }
                        } catch (e) {
                            console.warn('[CallContext] Error fetching caller profile:', e);
                        }

                        setCallSession({
                            id: newCall.id,
                            conversationId: newCall.conversation_id,
                            roomUrl: newCall.room_url,
                            type: newCall.type === 'video' ? 'video' : 'voice',
                            status: 'ringing',
                            direction: 'incoming',
                            partnerName: callerName,
                            partnerAvatar: callerAvatar,
                            callerId: newCall.caller_id,
                            receiverId: user.id,
                            isMinimized: false
                        });
                    }

                    if (eventType === 'UPDATE' && newCall) {
                        if (newCall.receiver_id === user.id || newCall.caller_id === user.id) {
                            console.log('[CallContext] Realtime UPDATE call status:', newCall.status);
                            const status = newCall.status;

                            if (status === 'connected') {
                                setCallSession(prev => prev ? { ...prev, status: 'connected' } : null);
                                triggerTrackSyncHandshake();
                            } else if (['ended', 'declined', 'missed', 'cancelled'].includes(status)) {
                                if (handshakeIntervalRef.current) {
                                    clearInterval(handshakeIntervalRef.current);
                                    handshakeIntervalRef.current = null;
                                }
                                ringtoneRef.current.stop();
                                await leaveCall();
                                setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
                                setTimeout(() => setCallSession(null), 800);
                            }
                        }
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`[CallContext] Realtime subscription status for global_calls_${user.id}:`, status, err || '');
            });

        return () => {
            console.log(`[CallContext] Cleaning up realtime channel global_calls_${user.id}`);
            supabase.removeChannel(channel);
        };
    }, [user?.id, leaveCall]);

    // 2. Start Call Action (Caller side)
    const startCall = useCallback(async ({
        conversationId,
        receiverId,
        type,
        partnerName,
        partnerAvatar,
        isSelf,
        isAI
    }: {
        conversationId: string;
        receiverId: string;
        type: 'voice' | 'video';
        partnerName: string;
        partnerAvatar?: string | null;
        isSelf?: boolean;
        isAI?: boolean;
    }) => {
        if (!user?.id) {
            toast.error("Session invalid. Please log in again.");
            return;
        }

        if (isSelf || receiverId === user.id) {
            toast.error("Cannot call yourself.");
            return;
        }

        if (isAI || receiverId === COACH_ID) {
            toast.error("Calls are not supported with Health Coach.");
            return;
        }

        // Optimistic UI state
        const initialSession: CallSession = {
            conversationId,
            type,
            status: 'ringing',
            direction: 'outgoing',
            partnerName,
            partnerAvatar,
            callerId: user.id,
            receiverId,
            isMinimized: false
        };

        setCallSession(initialSession);

        // Check initial peer online status
        if (onlineUsers.has(receiverId)) {
            setIsPeerRinging(true);
        } else {
            // Check recent presence
            fetch(`/api/presence/last-seen?user_id=${receiverId}`, { credentials: 'same-origin' })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data?.last_seen) {
                        const diffMs = Date.now() - new Date(data.last_seen).getTime();
                        if (diffMs < 90_000) {
                            setIsPeerRinging(true);
                        }
                    }
                })
                .catch(() => {});
        }

        try {
            const callRecord = await initiateCallV2(conversationId, user.id, receiverId, type);
            console.log('[CallContext] Call initiated on server:', callRecord);

            if (!callRecord || !callRecord.room_url) {
                throw new Error("Unable to create a valid video/audio room. Please check your Daily configuration.");
            }

            setCallSession(prev => prev ? {
                ...prev,
                id: callRecord.id,
                roomUrl: callRecord.room_url
            } : null);

            // Subscribe to peer ringing acknowledgement broadcast
            try {
                const ackChannel = supabase.channel(`call_ack_${callRecord.id}`);
                ackChannel
                    .on('broadcast', { event: 'ringing' }, () => {
                        console.log('[CallContext] Caller received ringing ack for:', callRecord.id);
                        setIsPeerRinging(true);
                    })
                    .subscribe();
            } catch (subErr) {
                console.warn('[CallContext] Error subscribing to call ack channel:', subErr);
            }

            // Auto-timeout unanswered ringing after 45 seconds
            if (ringingTimeoutRef.current) {
                clearTimeout(ringingTimeoutRef.current);
            }
            ringingTimeoutRef.current = setTimeout(() => {
                setCallSession(curr => {
                    if (curr && curr.status === 'ringing') {
                        if (curr.id) {
                            updateCallStatus(curr.id, 'missed', 0).catch(() => {});
                        }
                        leaveCall();
                        return { ...curr, status: 'ended' };
                    }
                    return curr;
                });
                setTimeout(() => setCallSession(null), 800);
            }, 45000);

            // Caller joins Daily room while ringing (microphone on, camera on only if video call)
            await joinCall(callRecord.room_url, type === 'video', user.user_metadata?.full_name || 'Caller');
        } catch (err: any) {
            if (ringingTimeoutRef.current) {
                clearTimeout(ringingTimeoutRef.current);
                ringingTimeoutRef.current = null;
            }
            console.error('[CallContext] Failed to start call:', err);
            toast.error(err.message || "Failed to start call");
            ringtoneRef.current.stop();
            await leaveCall();
            setCallSession(null);
        }
    }, [user, joinCall, leaveCall]);

    // 3. Accept Call Action (Callee side)
    const handleAccept = useCallback(async () => {
        if (!callSession || !callSession.id || !callSession.roomUrl || isAcceptingRef.current) return;
        isAcceptingRef.current = true;
        ringtoneRef.current.stop();

        try {
            await updateCallStatus(callSession.id, 'connected', 0);
            setCallSession(prev => prev ? { ...prev, status: 'connected' } : null);

            // Callee joins Daily room upon accept
            // Note: joinCall will strictly enable camera ONLY if type === 'video'
            await joinCall(callSession.roomUrl, callSession.type === 'video', user?.user_metadata?.full_name || 'Callee');
            triggerTrackSyncHandshake();
        } catch (err) {
            console.error('[CallContext] Failed to accept call:', err);
            toast.error("Failed to connect call");
            ringtoneRef.current.stop();
            await leaveCall();
            setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
            setTimeout(() => setCallSession(null), 800);
        } finally {
            isAcceptingRef.current = false;
        }
    }, [callSession, joinCall, leaveCall, user, triggerTrackSyncHandshake]);

    // 4. Decline Call Action (Callee side)
    const handleDecline = useCallback(async () => {
        if (!callSession) return;
        ringtoneRef.current.stop();

        if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
        }
        connectedAtRef.current = null;

        const targetStatus = callSession.direction === 'incoming' ? 'declined' : 'cancelled';
        if (callSession.id) {
            updateCallStatus(callSession.id, targetStatus, 0).catch(e => console.warn('[CallContext] Decline status error:', e));
        }

        await leaveCall();
        setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCallSession(null), 400);
    }, [callSession, leaveCall]);

    // 5. Message and Decline Action (Incoming call quick reply)
    const handleMessageAndDecline = useCallback(async (messageText: string) => {
        if (!callSession || !user?.id) return;
        ringtoneRef.current.stop();

        if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
        }
        connectedAtRef.current = null;

        const targetCallId = callSession.id;
        const convId = callSession.conversationId;

        // 1. Send the quick message through chat system
        try {
            await sendMessage(user.id, convId, messageText, 'text');
            toast.success("Message sent");
        } catch (msgErr) {
            console.error('[CallContext] Failed to send quick reply message:', msgErr);
        }

        // 2. Decline the call
        if (targetCallId) {
            updateCallStatus(targetCallId, 'declined', 0).catch(e => console.warn('[CallContext] Decline error:', e));
        }

        await leaveCall();
        setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCallSession(null), 400);
    }, [callSession, user, leaveCall]);

    // 6. End Call Action (Either side)
    const endCall = useCallback(async () => {
        if (!callSession) return;
        ringtoneRef.current.stop();

        if (ringingTimeoutRef.current) {
            clearTimeout(ringingTimeoutRef.current);
            ringingTimeoutRef.current = null;
        }

        const duration = connectedAtRef.current ? Math.max(0, Math.round((Date.now() - connectedAtRef.current) / 1000)) : 0;
        connectedAtRef.current = null;

        if (callSession.id) {
            const finalStatus = callSession.status === 'connected' ? 'ended' : (callSession.direction === 'outgoing' ? 'cancelled' : 'declined');
            updateCallStatus(callSession.id, finalStatus, duration).catch(e => console.warn('[CallContext] End call status error:', e));
        }

        await leaveCall();
        setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCallSession(null), 400);
    }, [callSession, leaveCall]);

    // 7. Minimize Toggle
    const handleToggleMinimize = useCallback(() => {
        setCallSession(prev => prev ? { ...prev, isMinimized: !prev.isMinimized } : null);
    }, []);

    return (
        <CallContext.Provider value={{ activeCall: callSession, onlineUsers, isUserOnline, startCall, endCall }}>
            {children}

            {callSession && (
                <CallOverlay
                    type={callSession.type}
                    status={callSession.status}
                    caller={{
                        name: callSession.partnerName,
                        avatar: callSession.partnerAvatar || undefined
                    }}
                    direction={callSession.direction}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onEnd={endCall}
                    onMessageAndDecline={handleMessageAndDecline}
                    isMinimized={callSession.isMinimized}
                    onToggleMinimize={handleToggleMinimize}
                    onToggleMic={toggleAudio}
                    onToggleCamera={toggleVideo}
                    onFlipCamera={flipCamera}
                    hasMultipleCameras={hasMultipleCameras}
                    onToggleSpeaker={toggleSpeaker}
                    isSpeakerSupported={isSpeakerSupported}
                    speakerActive={speakerActive}
                    isLocalAudioMuted={isLocalAudioMuted}
                    isLocalVideoOff={isLocalVideoOff}
                    isRemoteAudioMuted={isRemoteAudioMuted}
                    isRemoteVideoOff={isRemoteVideoOff}
                    peerJoined={peerJoined}
                    isPeerOnline={isPeerOnline}
                    connectionState={connectionState}
                    localUser={{
                        name: user?.user_metadata?.full_name || 'You',
                        avatar: user?.user_metadata?.avatar_url
                    }}
                    localVideoTrack={localVideoTrack}
                    remoteVideoTrack={remoteVideoTrack}
                    remoteAudioTrack={remoteAudioTrack}
                />
            )}
        </CallContext.Provider>
    );
}

export function useCall() {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
}
