import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { conversation_id, caller_id, receiver_id, type = 'audio' } = body;

        if (!conversation_id || !caller_id) {
            return NextResponse.json({ error: 'conversation_id and caller_id are required' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();

        // 1. Verify caller is part of conversation
        const { data: participation, error: partError } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation_id)
            .eq('user_id', caller_id)
            .maybeSingle();

        if (partError || !participation) {
            return NextResponse.json({ error: 'Caller is not a participant of this conversation' }, { status: 403 });
        }

        // 2. Identify receiver if not passed
        let targetReceiverId = receiver_id;
        if (!targetReceiverId) {
            const { data: otherParticipants } = await supabase
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversation_id)
                .neq('user_id', caller_id);
            
            if (otherParticipants && otherParticipants.length > 0) {
                targetReceiverId = otherParticipants[0].user_id;
            }
        }

        // 3. Create or update call record in Supabase database so Realtime subscribers receive the ringing alert
        const streamCallId = `conv_${conversation_id.replace(/-/g, '_')}`;

        if (targetReceiverId) {
            const { data: callRecord, error: callError } = await supabase
                .from('calls')
                .insert({
                    conversation_id,
                    caller_id,
                    receiver_id: targetReceiverId,
                    room_url: `stream:${streamCallId}`,
                    type: type === 'video' ? 'video' : 'voice',
                    status: 'ringing'
                })
                .select(`
                    *,
                    caller:user_profiles!caller_id(full_name, avatar_url),
                    receiver:user_profiles!receiver_id(full_name, avatar_url)
                `)
                .single();

            if (callError) {
                console.warn('[Stream Call API] Error writing call to Supabase:', callError.message);
            }

            return NextResponse.json({
                success: true,
                callId: streamCallId,
                callType: 'default',
                callRecord
            });
        }

        return NextResponse.json({
            success: true,
            callId: streamCallId,
            callType: 'default'
        });

    } catch (err: any) {
        console.error('[Stream Call API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
