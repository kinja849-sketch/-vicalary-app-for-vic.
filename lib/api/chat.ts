import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const COACH_ID = '00000000-0000-0000-0000-000000000001';

export const getOrCreateCoachConversation = async (userId: string): Promise<string> => {
    try {
        const { data: rpcData, error } = await (supabase as any).rpc('provision_user_system_chats', { p_user_id: userId });
        if (!error && rpcData) {
            const convId = (rpcData as any)?.coach_conversation_id || (rpcData as any)?.coach_id;
            if (convId) return String(convId);
        }
    } catch (e) {
        console.warn('[getOrCreateCoachConversation] RPC call failed, trying fallback:', e);
    }

    try {
        const { data: parts, error: queryErr } = await (supabase
            .from('conversation_participants') as any)
            .select('conversation_id, conversations!inner(id, conversation_type)')
            .eq('user_id', userId)
            .eq('conversations.conversation_type', 'ai')
            .limit(1);

        if (!queryErr && parts && parts.length > 0 && parts[0].conversation_id) {
            return String(parts[0].conversation_id);
        }
    } catch (e) {
        console.warn('[getOrCreateCoachConversation] Participant query failed:', e);
    }

    try {
        const { data: newConv, error: createErr } = await (supabase
            .from('conversations') as any)
            .insert({ conversation_type: 'ai', name: 'Health Coach' })
            .select('id')
            .single();

        if (createErr || !newConv?.id) {
            throw new Error(createErr?.message || 'Failed to create Health Coach conversation');
        }

        await (supabase.from('conversation_participants') as any).insert([
            { conversation_id: newConv.id, user_id: userId },
            { conversation_id: newConv.id, user_id: COACH_ID }
        ]);

        return String(newConv.id);
    } catch (err: any) {
        console.error('[getOrCreateCoachConversation] Final fallback failed:', err);
        throw err;
    }
};

export const getConversationsV2 = async (userId: string) => {
    console.log(`[API] getConversationsV2 for user: ${userId}`);
    try {
        await (supabase as any).rpc('provision_user_system_chats', { p_user_id: userId });
    } catch (err) {
        console.warn('[API] provision_user_system_chats failed (non-fatal):', err);
    }

    let rawConvs: any[] = [];
    try {
        const { data, error } = await (supabase as any).rpc('get_user_conversations', { 
            p_user_id: userId 
        });
        if (!error && Array.isArray(data)) {
            rawConvs = data;
        }
    } catch (err) {
        console.warn('[API] get_user_conversations RPC failed, using fallback query:', err);
    }

    // Fallback query if RPC returned empty or failed
    if (!rawConvs || rawConvs.length === 0) {
        const { data: userParts, error: partErr } = await (supabase
            .from('conversation_participants') as any)
            .select(`
                conversation_id,
                is_archived,
                is_muted,
                conversations!inner(*)
            `)
            .eq('user_id', userId)
            .is('deleted_at', null);

        if (!partErr && userParts) {
            rawConvs = userParts.map((p: any) => ({
                ...p.conversations,
                is_archived: p.is_archived,
                is_muted: p.is_muted
            }));
        }
    }

    // Collect peer conversation IDs needing participant profiles
    const peerConvIds = (rawConvs || [])
        .filter((c: any) => c.conversation_type !== 'self' && c.conversation_type !== 'ai')
        .map((c: any) => c.id);

    let participantProfilesMap: Record<string, any> = {};

    if (peerConvIds.length > 0) {
        try {
            const { data: pData } = await (supabase
                .from('conversation_participants') as any)
                .select(`
                    conversation_id,
                    user_id,
                    user_profiles:user_id(
                        id,
                        full_name,
                        username,
                        avatar_url,
                        chat_users!chat_users_user_id_fkey(phone_number)
                    )
                `)
                .in('conversation_id', peerConvIds)
                .neq('user_id', userId)
                .neq('user_id', COACH_ID);

            if (pData) {
                pData.forEach((row: any) => {
                    const rawProfile = row.user_profiles;
                    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
                    if (profile) {
                        const chatUser = Array.isArray(profile.chat_users) ? profile.chat_users[0] : profile.chat_users;
                        participantProfilesMap[row.conversation_id] = {
                            id: profile.id,
                            full_name: profile.full_name,
                            username: profile.username,
                            avatar_url: profile.avatar_url,
                            phone_number: chatUser?.phone_number
                        };
                    }
                });
            }
        } catch (e) {
            console.warn('[API] Failed to batch fetch participant profiles:', e);
        }
    }

    const processed = (rawConvs || []).map((conv: any) => {
        let display_name = 'Unknown';
        let display_avatar: string | null = null;
        let display_phone: string | null = null;

        if (conv.conversation_type === 'self') {
            display_name = 'Personal Notes (Me)';
        } else if (conv.conversation_type === 'ai') {
            display_name = 'Health Coach';
            display_avatar = '/app logo.png';
        } else {
            const rpcProfile = conv.other_participant_info || {};
            const fetchedProfile = participantProfilesMap[conv.id] || {};

            display_name = fetchedProfile.full_name || fetchedProfile.username || rpcProfile.full_name || rpcProfile.username || (conv.name && conv.name !== 'Direct Chat' ? conv.name : null) || fetchedProfile.phone_number || rpcProfile.phone_number || 'User';
            display_avatar = fetchedProfile.avatar_url || rpcProfile.avatar_url || null;
            display_phone = fetchedProfile.phone_number || rpcProfile.phone_number || null;
        }

        const lastMsg = conv.last_message_content ? {
            content: conv.last_message_content,
            message_type: conv.last_message_type || 'text',
            sender_id: conv.last_message_sender_id,
            created_at: conv.last_message_at
        } : null;

        return {
            ...conv,
            display_name,
            display_avatar,
            display_phone,
            last_message: lastMsg,
            unread_count: parseInt(conv.unread_count || '0')
        };
    });

    return processed;
}

// WhatsApp-like Conversation Management
export const archiveConversation = async (userId: string, conversationId: string, isArchived: boolean = true) => {
    const { error } = await (supabase as any).rpc('archive_conversation', {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_is_archived: isArchived
    });
    if (error) throw error;
    return true;
};

export const muteConversation = async (userId: string, conversationId: string, isMuted: boolean = true) => {
    const { error } = await (supabase as any).rpc('mute_conversation', {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_is_muted: isMuted
    });
    if (error) throw error;
    return true;
};

export const clearChatHistory = async (userId: string, conversationId: string) => {
    const { error } = await (supabase as any).rpc('clear_chat_history', {
        p_user_id: userId,
        p_conversation_id: conversationId
    });
    if (error) throw error;
    return true;
};

export const deleteConversation = async (userId: string, conversationId: string) => {
    const { error } = await (supabase as any).rpc('delete_conversation', {
        p_user_id: userId,
        p_conversation_id: conversationId
    });
    if (error) throw error;
    return true;
};

// Alias for compatibility with UI
export const softDeleteConversation = deleteConversation;

export const getConversationById = async (conversationId: string, userId: string) => {
    const res = await fetch(`/api/chat/conversation?conversation_id=${conversationId}&user_id=${userId}`);
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to fetch conversation');
    
    const data = result.data;
    if (!data) return null;

    if (data.conversation_type === 'self') {
        const participant = data.conversation_participants.find((p: any) => p.user_id === userId);
        const rawProfile = participant?.user_profiles;
        const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;

        data.display_name = profile?.full_name ? `${profile.full_name} (Me)` : 'Personal Notes';
        data.display_avatar = profile?.avatar_url;
        data.display_phone = (Array.isArray(profile?.chat_users) ? profile.chat_users[0]?.phone_number : profile?.chat_users?.phone_number) || null;
    } else if (data.conversation_type === 'ai') {
        data.display_name = 'Health Coach';
        data.display_avatar = '/app logo.png';
        data.display_phone = null;
    } else {
        const otherParticipant = data.conversation_participants.find((p: any) => p.user_id !== userId && p.user_id !== COACH_ID);
        if (otherParticipant) {
            const rawProfile = otherParticipant.user_profiles;
            const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
            const chatUser = Array.isArray(profile?.chat_users) ? profile.chat_users[0] : profile?.chat_users;

            data.display_name = profile?.full_name || profile?.username || data.name || chatUser?.phone_number || 'User';
            data.display_avatar = profile?.avatar_url;
            data.display_phone = chatUser?.phone_number;
        } else {
            data.display_name = data.name || 'User';
            data.display_avatar = null;
        }
    }

    return data;
}

export const addContactPure = async (userId: string, contactUserId: string) => {
    const { error } = await (supabase as any).rpc('add_contact_pure', {
        p_user_id: userId,
        p_contact_id: contactUserId
    });
    if (error) throw error;
}

export const provisionAndSendMessage = async (
    senderId: string,
    receiverId: string,
    content: string,
    messageType: string = 'text',
    metadata: any = {}
) => {
    console.log(`[API] provisionAndSendMessage: ${senderId} -> ${receiverId}`);
    const { data: convId, error } = await (supabase as any).rpc('provision_and_send_message', {
        p_sender_id: senderId,
        p_receiver_id: receiverId,
        p_content: content,
        p_message_type: messageType,
        p_metadata: metadata
    });

    if (error) {
        console.error('[API] provision_and_send_message RPC error:', error);
        throw error;
    }
    
    let finalId = convId;
    if (typeof convId === 'object' && convId !== null) {
        finalId = convId.id || convId.conversation_id || convId.r_id || (Array.isArray(convId) ? convId[0]?.id : null) || convId;
    }
    
    console.log(`[API] provisionAndSendMessage Success. Raw:`, convId, `Final ID: ${finalId}`);
    
    if (receiverId === COACH_ID) {
        const { getUserLocation } = await import('./location');
        const loc = await getUserLocation();

        const orchestratorPayload = {
            conversation_id: String(finalId),
            user_id: senderId,
            content: content,
            media_url: metadata?.url || null,
            location_context: loc,
            locale: typeof navigator !== 'undefined' ? navigator.language : 'en'
        };

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/conversation/process', {
                method: 'POST',
                headers,
                body: JSON.stringify(orchestratorPayload)
            });
            if (!res.ok) {
                throw new Error(`Conversation orchestrator failed with status ${res.status}`);
            }
            const assistantReply = await res.json();
            return {
                id: String(finalId),
                realId: String(finalId),
                assistantReply
            } as any;
        } catch (e) {
            console.warn("[API] Conversation orchestrator fallback to coach-reply:", e);
            const triggerPayload = {
                type: 'INSERT',
                table: 'messages',
                record: {
                    conversation_id: finalId,
                    sender_id: senderId,
                    content: content,
                    message_type: messageType,
                    created_at: new Date().toISOString()
                },
                system_context: {
                    current_time: new Date().toISOString(),
                    time_zone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
                    language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
                    locationContext: loc
                }
            };
            fetch('/api/coach-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(triggerPayload)
            }).catch(err => console.error("[API] Coach trigger fallback failed:", err));
        }
    }

    return String(finalId);
}

export const findConversationByParticipants = async (user1: string, user2: string) => {
    const { data, error } = await (supabase as any).rpc('find_conversation_by_participants', {
        p_user1: user1,
        p_user2: user2
    });
    if (error) {
        console.warn('[API] find_conversation_by_participants RPC failed, using manual query:', error);
        const { data: manualData } = await (supabase
            .from('conversation_participants')
            .select('conversation_id')
            .in('user_id', [user1, user2]) as any);
        
        if (manualData && manualData.length >= 2) {
            return manualData[0].conversation_id;
        }
        return null;
    }
    return data;
}

export const getOrCreateDirectConversation = async (userId: string, peerUserId: string): Promise<string> => {
    try {
        const existing = await findConversationByParticipants(userId, peerUserId);
        if (existing) {
            const rawId = typeof existing === 'object' ? (existing.id || existing.conversation_id || existing.r_id) : existing;
            if (rawId) return String(rawId);
        }
    } catch (e) {
        console.warn('[getOrCreateDirectConversation] Lookup failed, will try create/resolve endpoint:', e);
    }

    try {
        const res = await fetch('/api/chat/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, peerUserId })
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Failed to create/resolve direct conversation (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!data?.conversationId) {
            throw new Error('No conversationId returned from server');
        }
        return String(data.conversationId);
    } catch (err: any) {
        console.error('[getOrCreateDirectConversation] Failed:', err);
        throw err;
    }
};

export function findUserByPhone(phoneNumber: string) {
    return findUserByIdentifier(phoneNumber);
}

export function findUserByUsername(username: string) {
    return findUserByIdentifier(username);
}

export const findUserByIdSecure = async (id: string | null) => {
    if (!id) return null;
    const { data, error } = await supabase.rpc('find_user_by_identifier', {
        p_identifier: id
    });

    if (error) {
        console.error('findUserByIdSecure RPC error:', error);
        return null;
    }

    return (data && data.length > 0) ? data[0] : null;
}

/**
 * Unsubscribe from a realtime message channel
 */
export function unsubscribeFromMessages(channel: RealtimeChannel) {
    if (channel) supabase.removeChannel(channel)
}

export const getContacts = async (userId: string) => {
    const { data, error } = await supabase
        .from('contacts')
        .select(`
            contact_user_id,
            user_profiles:contact_user_id(
                full_name,
                username,
                avatar_url,
                chat_users!chat_users_user_id_fkey(phone_number, is_verified)
            )
        `)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching contacts:', error);
        return [];
    }

    return data
        .filter((c: any) => {
            const rawProfile = c.user_profiles;
            const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
            const chatUser = Array.isArray(profile?.chat_users) ? profile.chat_users[0] : profile?.chat_users;
            return !!chatUser?.is_verified;
        })
        .map((c: any) => {
            const rawProfile = c.user_profiles;
            const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
            const chatUser = Array.isArray(profile?.chat_users) ? profile.chat_users[0] : profile?.chat_users;

            return {
                id: String(c.contact_user_id),
                full_name: profile?.full_name || profile?.username || chatUser?.phone_number || 'Unknown',
                avatar_url: profile?.avatar_url,
                phone_number: chatUser?.phone_number,
                is_verified: !!chatUser?.is_verified
            };
        });
}

export const getMyQRCodeData = async (userId: string) => {
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

    const { data: chatUser } = await supabase
        .from('chat_users')
        .select('phone_number')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    return JSON.stringify({
        userId,
        username: (profile as any)?.username,
        phone: chatUser?.phone_number
    });
}

export const createGroupConversation = async (userId: string, name: string, participantIds: string[]) => {
    const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
            is_group: true,
            name,
            conversation_type: 'group'
        } as any)
        .select()
        .single()

    if (convError) throw convError

    const participants = [userId, ...participantIds].map(id => ({
        conversation_id: conv.id,
        user_id: id
    }))

    const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants)

    if (partError) throw partError

    return conv
}

export const getMessages = async (conversationId: string, userId?: string, limit = 50) => {
    let query = (supabase.from('messages') as any)
        .select('*')
        .eq('conversation_id', conversationId);

    if (userId) {
        const { data: participation } = await (supabase
            .from('conversation_participants')
            .select('cleared_at')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .maybeSingle() as any);
        
        if (participation?.cleared_at) {
            query = query.gt('created_at', participation.cleared_at);
        }
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error
    return (data || []).reverse()
}

export const markMessageDelivered = async (messageId: string, conversationId?: string) => {
    const now = new Date().toISOString();
    try {
        let query = (supabase.from('messages') as any)
            .update({ is_delivered: true, delivered_at: now })
            .eq('id', messageId)
            .eq('is_delivered', false);
        
        if (conversationId) {
            query = query.eq('conversation_id', conversationId);
        }

        const { error } = await query;
        if (error) {
            console.warn('[Chat] Failed to mark message delivered in DB:', error);
        }
    } catch (e) {
        console.warn('[Chat] Exception marking message delivered:', e);
    }
    return now;
};

export const sendMessage = async (
    userId: string,
    conversationId: string,
    content: string,
    messageType: 'text' | 'voice' | 'video' | 'image' | 'file' | 'link' = 'text',
    metadata?: any,
    isAI?: boolean,
    isSelf?: boolean,
    clientMessageId?: string
) => {
    const now = new Date().toISOString();
    const messageId = clientMessageId || crypto.randomUUID();
    const isPeer = !isAI && !isSelf;

    const payload: any = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: userId,
        message_type: messageType,
        content,
        metadata: {
            ...metadata,
            timestamp: now
        },
        is_delivered: !isPeer,
        delivered_at: isPeer ? null : now,
        read_at: (isAI || isSelf) ? now : null,
        is_read: (isAI || isSelf)
    };

    let data: any = null;
    const { data: inserted, error } = await supabase
        .from('messages')
        .insert(payload)
        .select()
        .single();

    if (error) {
        // Idempotent retry: If duplicate key violation on primary key 'id' (PostgreSQL code 23505), fetch existing row
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('uniqueness')) {
            console.log(`[sendMessage] Message ${messageId} already exists, fetching existing record (idempotent retry)`);
            const { data: existing, error: fetchErr } = await supabase
                .from('messages')
                .select('*')
                .eq('id', messageId)
                .single();
            if (!fetchErr && existing) {
                data = existing;
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    } else {
        data = inserted;
    }

    if (!data) throw new Error('Message could not be saved');

    supabase.from('conversations')
        .update({ 
            last_message_at: now,
            last_message_content: messageType === 'text' ? content : (messageType === 'image' ? '📷 Image' : (messageType === 'voice' ? '🎤 Voice' : (messageType === 'video' ? '📹 Video' : '📄 File'))),
            last_message_type: messageType,
            last_message_sender_id: userId
        } as any)
        .eq('id', conversationId)
        .then();

    if (isAI) {
        const { getUserLocation } = await import('./location');
        const loc = await getUserLocation();

        const currentAppLang = (typeof window !== 'undefined' ? localStorage.getItem('app_lang') : null) || 'en';

        const orchestratorPayload = {
            conversation_id: conversationId,
            user_id: userId,
            content: content,
            media_url: metadata?.url || null,
            location_context: loc,
            locale: currentAppLang
        };

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/conversation/process', {
                method: 'POST',
                headers,
                body: JSON.stringify(orchestratorPayload)
            });
            if (!res.ok) {
                throw new Error(`Conversation orchestrator failed with status ${res.status}`);
            }
            const orchestratorResult = await res.json();
            return {
                ...data,
                assistantReply: orchestratorResult
            };
        } catch (e) {
            console.warn("[API] Conversation orchestrator fallback to coach-reply:", e);
            const triggerPayload = {
                type: 'INSERT',
                table: 'messages',
                record: data,
                system_context: {
                    current_time: now,
                    time_zone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
                    language: currentAppLang,
                    locationContext: loc
                }
            };
            fetch('/api/coach-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(triggerPayload)
            }).catch(err => console.error("[API] Coach sendMessage trigger failed:", err));
        }
    }

    return data
}

export const uploadChatMedia = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `chat/${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath)

    return publicUrl
}

export const markAsRead = async (userId: string, conversationId: string) => {
    const { error } = await (supabase as any).rpc('mark_conversation_as_read', {
        p_user_id: userId,
        p_conversation_id: conversationId
    });

    if (error) {
        console.error('[API] Error marking as read:', error);
        return false;
    }

    const now = new Date().toISOString();
    await supabase
        .from('messages')
        .update({ is_read: true, read_at: now } as any)
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .is('read_at', null);

    return true;
};

export const markAllMessagesRead = async (userId: string) => {
    try {
        const { error: rpcError } = await (supabase as any).rpc('mark_all_messages_read', {
            p_user_id: userId
        });
        if (rpcError) throw rpcError;
        return true;
    } catch (err) {
        const { error: updateError } = await (supabase.from('messages') as any)
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('receiver_id', userId)
            .eq('is_read', false);     
        return !updateError;
    }
};

export const subscribeToMessages = (conversationId: string, callback: (payload: any) => void): RealtimeChannel => {
    return supabase
        .channel(`messages:${conversationId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => callback(payload))
        .subscribe()
}

export const subscribeToUserConversations = (userId: string, callback: (payload: any) => void): RealtimeChannel => {
    return supabase
        .channel(`user-convos:${userId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'conversation_participants',
            filter: `user_id=eq.${userId}`,
        }, (payload) => callback(payload))
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
        }, (payload: any) => callback(payload))
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'calls',
            filter: `receiver_id=eq.${userId}`,
        }, (payload) => callback({ ...payload, table: 'calls' }))
        .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[Realtime] User conversations subscription ${status}:`, err || 'Host unreachable');
            }
        })
}

export const sendTypingIndicator = async (
    channel: RealtimeChannel,
    userId: string,
    conversationId: string,
    isTyping: boolean,
    action: 'start' | 'heartbeat' | 'stop' = isTyping ? 'start' : 'stop',
    sessionId?: number
) => {
    if (!channel) return;
    const now = Date.now();
    try {
        await channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
                user_id: userId,
                conversation_id: conversationId,
                typing: isTyping,
                action,
                session_id: sessionId || now,
                timestamp: now
            }
        });
    } catch (e) {
        console.warn('[Realtime] Typing broadcast failed:', e);
    }
}

export const initiateCallV2 = async (conversationId: string, callerId: string, receiverId: string, type: 'voice' | 'video') => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch('/api/calls/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                caller_id: callerId,
                receiver_id: receiverId,
                type: type
            })
        });

        const data = await res.json();
        if (res.ok && data.callRecord) {
            return data.callRecord;
        }
        if (data.error) {
            throw new Error(data.error);
        }
    } catch (apiErr) {
        console.warn('[initiateCallV2] API route failed, using Supabase fallback:', apiErr);
    }

    // Direct Supabase Fallback
    const { data: roomData, error: roomError } = await (supabase as any).rpc('create_daily_room_rpc', {
        conversation_id: conversationId
    });

    let roomUrl = (roomData as any)?.room_url;
    if (!roomUrl) {
        throw new Error('Unable to create a valid video/audio call room. Please verify network or Daily configuration.');
    }

    const { data, error } = await (supabase as any)
        .from('calls')
        .insert({
            conversation_id: conversationId,
            caller_id: callerId,
            receiver_id: receiverId,
            room_url: roomUrl,
            type: type,
            status: 'ringing'
        })
        .select(`
            *,
            caller:user_profiles!caller_id(id, full_name, username, avatar_url),
            receiver:user_profiles!receiver_id(id, full_name, username, avatar_url)
        `)
        .single();

    if (error) throw error;
    return data;
}

export const updateCallStatus = async (
    callId: string, 
    status: 'connected' | 'ended' | 'missed' | 'declined' | 'cancelled',
    duration: number = 0
) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch('/api/calls/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ call_id: callId, status, duration })
        });
        const data = await res.json();
        if (res.ok && data.data) {
            return Array.isArray(data.data) ? data.data[0] : data.data;
        }
    } catch (e) {
        console.warn('[updateCallStatus] API route failed, using Supabase fallback:', e);
    }

    const update: any = { status };
    if (status === 'ended' || status === 'declined' || status === 'missed' || status === 'cancelled') update.ended_at = new Date().toISOString();

    const { data, error } = await (supabase as any)
        .from('calls')
        .update(update)
        .eq('id', callId)
        .select()
        .single();

    if (error) throw error;

    // Fallback message & conversation update if API route failed
    if (data && ['ended', 'declined', 'missed', 'cancelled'].includes(status) && data.conversation_id && data.caller_id) {
        try {
            const isMissed = ['declined', 'missed', 'cancelled'].includes(status);
            const m = Math.floor(duration / 60);
            const s = duration % 60;
            const durStr = duration > 0 ? (m > 0 ? `${m}m ${s}s` : `${s}s`) : '';
            const label = data.type === 'video' ? 'Video call' : 'Voice call';
            const content = isMissed 
                ? (data.type === 'video' ? 'Missed video call' : 'Missed voice call')
                : (durStr ? `${label} (${durStr})` : label);

            const now = new Date().toISOString();
            await supabase.from('messages').insert({
                conversation_id: data.conversation_id,
                sender_id: data.caller_id,
                content,
                message_type: 'call',
                metadata: {
                    call_id: data.id,
                    call_type: data.type,
                    call_status: status,
                    duration,
                    receiver_id: data.receiver_id
                }
            });

            await supabase.from('conversations').update({
                last_message_at: now,
                last_message_content: content,
                last_message_type: 'call',
                last_message_sender_id: data.caller_id
            }).eq('id', data.conversation_id);
        } catch (_) {}
    }

    return data;
}


export const isChatVerified = async (userId: string) => {
    const { data, error } = await supabase
        .from('chat_users')
        .select('is_verified')
        .eq('user_id', userId)

    if (error || !data) return false;
    return data.some((row: any) => row.is_verified)
}

export const findUserByIdentifier = async (identifier: string) => {
    if (!identifier) return null;
    const { data, error } = await supabase.rpc('find_user_by_identifier', {
        p_identifier: identifier.trim()
    });
    return (data && data.length > 0) ? data[0] : null;
}

export const getChatParticipants = async (conversationId: string) => {
    try {
        const res = await fetch(`/api/chat/participants?conversation_id=${conversationId}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to fetch participants');
        return result.data;
    } catch (e) {
        console.error('Error fetching chat participants:', e);
        return [];
    }
};
