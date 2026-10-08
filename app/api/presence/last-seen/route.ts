import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST: stamp the authenticated user's own last_seen with the server clock.
 * The user id comes from the session only; the body is ignored.
 */
export async function POST(req: NextRequest) {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();
    const { error } = await admin
        .from('user_profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', authUser.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}

/**
 * GET ?user_id=<peer>: return the peer's last_seen, only if the caller shares
 * a conversation with that peer. Returns null when unknown.
 */
export async function GET(req: NextRequest) {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const peerId = new URL(req.url).searchParams.get('user_id');
    if (!peerId || !UUID_RE.test(peerId)) {
        return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    const { data: mine, error: mineErr } = await admin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', authUser.id);
    if (mineErr) {
        return NextResponse.json({ error: mineErr.message }, { status: 500 });
    }
    const convIds = (mine || []).map((r: any) => r.conversation_id);
    if (convIds.length === 0) {
        return NextResponse.json({ last_seen: null });
    }

    const { data: shared, error: sharedErr } = await admin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', peerId)
        .in('conversation_id', convIds)
        .limit(1);
    if (sharedErr) {
        return NextResponse.json({ error: sharedErr.message }, { status: 500 });
    }
    if (!shared || shared.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await admin
        .from('user_profiles')
        .select('last_seen')
        .eq('id', peerId)
        .maybeSingle();
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ last_seen: (data as any)?.last_seen ?? null });
}
