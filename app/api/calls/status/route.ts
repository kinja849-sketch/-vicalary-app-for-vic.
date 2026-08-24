import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { call_id, conversation_id, status } = body;

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

        return NextResponse.json({
            success: true,
            data
        });

    } catch (err: any) {
        console.error('[Calls Status API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
