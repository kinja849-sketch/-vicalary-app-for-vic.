import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const authUser = await getAuthenticatedUser(req);
        const { call_id, conversation_id, status, duration = 0 } = body;

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        const validStatuses = ['connected', 'ended', 'declined', 'missed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();
        const updateData: any = { status };

        if (status === 'ended' || status === 'declined' || status === 'missed' || status === 'cancelled') {
            updateData.ended_at = new Date().toISOString();
        }

        let query = supabase.from('calls').update(updateData);

        if (call_id) {
            query = query.eq('id', call_id);
        } else if (conversation_id) {
            query = query.eq('conversation_id', conversation_id).eq('status', 'ringing');
        } else {
            return NextResponse.json({ error: 'Either call_id or conversation_id is required' }, { status: 400 });
        }

        if (authUser) {
            // Scope query to calls where the authenticated user is either the caller or receiver
            query = query.or(`caller_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`);
        }

        const { data, error } = await query
            .select(`
                *,
                caller:user_profiles!caller_id(id, full_name, username, avatar_url),
                receiver:user_profiles!receiver_id(id, full_name, username, avatar_url)
            `);

        if (error) {
            console.error('[Calls Status API] Error updating call status:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Auto-log call event into messages and conversations table on termination
        if (data && ['ended', 'declined', 'missed', 'cancelled'].includes(status)) {
            const callsList = Array.isArray(data) ? data : [data];
            for (const call of callsList) {
                if (call.conversation_id && call.caller_id) {
                    try {
                        // Build formatted content label
                        let content = '';
                        const isMissed = ['declined', 'missed', 'cancelled'].includes(status);
                        if (isMissed) {
                            content = call.type === 'video' ? 'Missed video call' : 'Missed voice call';
                        } else {
                            const dur = Number(duration) || 0;
                            const m = Math.floor(dur / 60);
                            const s = dur % 60;
                            const durStr = dur > 0 ? (m > 0 ? `${m}m ${s}s` : `${s}s`) : '';
                            const label = call.type === 'video' ? 'Video call' : 'Voice call';
                            content = durStr ? `${label} (${durStr})` : label;
                        }

                        // Idempotency: verify this call has not already been logged
                        const { data: existingMsgs } = await supabase
                            .from('messages')
                            .select('id')
                            .eq('conversation_id', call.conversation_id)
                            .eq('message_type', 'call')
                            .contains('metadata', { call_id: call.id });

                        if (!existingMsgs || existingMsgs.length === 0) {
                            const now = new Date().toISOString();
                            const { data: insertedMsg, error: insertError } = await supabase
                                .from('messages')
                                .insert({
                                    conversation_id: call.conversation_id,
                                    sender_id: call.caller_id,
                                    content,
                                    message_type: 'call',
                                    metadata: {
                                        call_id: call.id,
                                        call_type: call.type,
                                        call_status: status,
                                        duration: Number(duration) || 0,
                                        receiver_id: call.receiver_id
                                    }
                                })
                                .select()
                                .maybeSingle();

                            if (!insertError && insertedMsg) {
                                // Update conversation last_message preview
                                await supabase
                                    .from('conversations')
                                    .update({
                                        last_message_at: now,
                                        last_message_content: content,
                                        last_message_type: 'call',
                                        last_message_sender_id: call.caller_id
                                    })
                                    .eq('id', call.conversation_id);

                                // Broadcast to active conversation channel for real-time update
                                try {
                                    const convChannel = supabase.channel(`conversation:${call.conversation_id}`);
                                    convChannel.subscribe((subStatus) => {
                                        if (subStatus === 'SUBSCRIBED') {
                                            convChannel.send({
                                                type: 'broadcast',
                                                event: 'new_message',
                                                payload: insertedMsg
                                            }).catch(() => {});
                                        }
                                    });
                                } catch (_) {}
                            }
                        }
                    } catch (logErr: any) {
                        console.warn('[Calls Status API] Warning logging call to messages:', logErr?.message || logErr);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            data
        });

    } catch (err: any) {
        console.error('[Calls Status API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
