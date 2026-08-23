import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { call_id, conversation_id, caller_id, receiver_id, status, type = 'voice', duration = 0 } = body;

        if (!status) {
            return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();
        const updateData: any = { status };
        if (status === 'ended' || status === 'declined' || status === 'missed') {
            updateData.ended_at = new Date().toISOString();
        }

        let updatedCall = null;

        if (call_id) {
            const { data, error } = await supabase
                .from('calls')
                .update(updateData)
                .eq('id', call_id)
                .select()
                .maybeSingle();

            if (!error && data) {
                updatedCall = data;
            }
        } else if (conversation_id) {
            // Find active call for this conversation
            const { data } = await supabase
                .from('calls')
                .update(updateData)
                .eq('conversation_id', conversation_id)
                .in('status', ['ringing', 'connected'])
                .select()
                .maybeSingle();

            updatedCall = data;
        }

        // Auto-log call entry into messages table for chat history display
        const targetConvId = conversation_id || updatedCall?.conversation_id;
        const targetCallerId = caller_id || updatedCall?.caller_id;

        if ((status === 'ended' || status === 'declined' || status === 'missed') && targetConvId && targetCallerId) {
            const callTypeLabel = type === 'video' ? 'Video Call' : 'Voice Call';
            try {
                await supabase.from('messages').insert({
                    conversation_id: targetConvId,
                    sender_id: targetCallerId,
                    content: callTypeLabel,
                    message_type: 'call',
                    metadata: {
                        call_type: type,
                        call_status: status,
                        duration,
                        receiver_id: receiver_id || updatedCall?.receiver_id
                    }
                });
            } catch (err: any) {
                console.warn('[Call Status API] Warning logging call message:', err.message);
            }
        }

        return NextResponse.json({
            success: true,
            call: updatedCall
        });

    } catch (err: any) {
        console.error('[Stream Call Status API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
