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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, peerUserId } = body;

        if (!userId || !peerUserId) {
            return NextResponse.json({ error: 'Missing userId or peerUserId' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();

        // 1. Check if direct conversation already exists between the two users
        const { data: existingRpc, error: rpcErr } = await (supabase as any).rpc('find_conversation_by_participants', {
            p_user1: userId,
            p_user2: peerUserId
        });

        let existingId = existingRpc;
        if (typeof existingRpc === 'object' && existingRpc !== null) {
            existingId = existingRpc.id || existingRpc.conversation_id || existingRpc.r_id;
        }

        if (existingId) {
            return NextResponse.json({ conversationId: String(existingId) });
        }

        // Secondary check via participants join in case RPC missed it
        const { data: manualParts } = await (supabase
            .from('conversation_participants') as any)
            .select('conversation_id, conversations!inner(id, conversation_type)')
            .in('user_id', [userId, peerUserId])
            .eq('conversations.conversation_type', 'direct');

        if (manualParts && manualParts.length >= 2) {
            const counts: Record<string, number> = {};
            for (const p of manualParts) {
                counts[p.conversation_id] = (counts[p.conversation_id] || 0) + 1;
                if (counts[p.conversation_id] >= 2) {
                    return NextResponse.json({ conversationId: String(p.conversation_id) });
                }
            }
        }

        // 2. Create new direct conversation
        const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({
                conversation_type: 'direct',
                is_group: false,
                name: null
            } as any)
            .select('id')
            .single();

        if (createError || !newConv?.id) {
            throw createError || new Error('Failed to create conversation');
        }

        const convId = String(newConv.id);

        // 3. Add participants
        const { error: partError } = await (supabase.from('conversation_participants') as any).insert([
            { conversation_id: convId, user_id: userId },
            { conversation_id: convId, user_id: peerUserId }
        ]);

        if (partError) {
            console.error('[Conversation API] Error adding participants:', partError);
            throw partError;
        }

        return NextResponse.json({ conversationId: convId });
    } catch (err: any) {
        console.error('[Conversation API] POST error:', err);
        return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
    }
}

