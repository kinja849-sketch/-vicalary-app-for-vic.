import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversation_id');
    const userId = searchParams.get('user_id');

    if (!conversationId || !userId) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient(); // Bypass RLS

    const { data, error } = await supabase
        .from('conversations')
        .select(`
            *,
            conversation_participants(
                user_id,
                user_profiles(
                    full_name, 
                    username,
                    avatar_url,
                    updated_at
                )
            )
        `)
        .eq('id', conversationId)
        .maybeSingle();

    if (error) {
        console.error('[Conversation API] Error fetching conversation:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

