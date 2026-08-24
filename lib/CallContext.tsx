"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import { initiateCallV2, updateCallStatus } from './api/chat';
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

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [callSession, setCallSession] = useState<CallSession | null>(null);
    const { joinCall, leaveCall, toggleAudio, toggleVideo, localVideoTrack, remoteVideoTrack, remoteAudioTrack } = useDailyCall();

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
                        // Fetch caller profile if missing
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
                            } else if (['ended', 'declined', 'missed', 'cancelled'].includes(status)) {
                                leaveCall();
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

        // Optimistic UI state (~300ms response)
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

        try {
            const callRecord = await initiateCallV2(conversationId, user.id, receiverId, type);
            console.log('[CallContext] Call initiated on server:', callRecord);

            if (callRecord && callRecord.room_url) {
                setCallSession(prev => prev ? {
                    ...prev,
                    id: callRecord.id,
                    roomUrl: callRecord.room_url
                } : null);

                // Caller IMMEDIATELY joins Daily room while ringing!
                await joinCall(callRecord.room_url, type === 'video', user.user_metadata?.full_name || 'Caller');
            }
        } catch (err: any) {
            console.error('[CallContext] Failed to start call:', err);
            toast.error(err.message || "Failed to start call");
            setCallSession(null);
        }
    }, [user, joinCall]);

    // 3. Accept Call Action (Callee side)
    const handleAccept = useCallback(async () => {
        if (!callSession || !callSession.id || !callSession.roomUrl) return;

        try {
            await updateCallStatus(callSession.id, 'connected');
            setCallSession(prev => prev ? { ...prev, status: 'connected' } : null);

            // Callee joins Daily room upon accept
            await joinCall(callSession.roomUrl, callSession.type === 'video', user?.user_metadata?.full_name || 'Callee');
        } catch (err) {
            console.error('[CallContext] Failed to accept call:', err);
            toast.error("Failed to connect call");
        }
    }, [callSession, joinCall, user]);

    // 4. Decline Call Action (Callee side)
    const handleDecline = useCallback(async () => {
        if (!callSession) return;

        const targetStatus = callSession.direction === 'incoming' ? 'declined' : 'cancelled';
        if (callSession.id) {
            updateCallStatus(callSession.id, targetStatus).catch(e => console.warn('[CallContext] Decline status error:', e));
        }

        await leaveCall();
        setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCallSession(null), 400);
    }, [callSession, leaveCall]);

    // 5. End Call Action (Either side)
    const endCall = useCallback(async () => {
        if (!callSession) return;

        if (callSession.id) {
            const finalStatus = callSession.status === 'connected' ? 'ended' : (callSession.direction === 'outgoing' ? 'cancelled' : 'declined');
            updateCallStatus(callSession.id, finalStatus).catch(e => console.warn('[CallContext] End call status error:', e));
        }

        await leaveCall();
        setCallSession(prev => prev ? { ...prev, status: 'ended' } : null);
        setTimeout(() => setCallSession(null), 400);
    }, [callSession, leaveCall]);

    // 6. Minimize Toggle
    const handleToggleMinimize = useCallback(() => {
        setCallSession(prev => prev ? { ...prev, isMinimized: !prev.isMinimized } : null);
    }, []);

    return (
        <CallContext.Provider value={{ activeCall: callSession, startCall, endCall }}>
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
                    isMinimized={callSession.isMinimized}
                    onToggleMic={toggleAudio}
                    onToggleCamera={toggleVideo}
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
