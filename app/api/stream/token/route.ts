import { NextRequest, NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const authUser = await getAuthenticatedUser(req);
        const user_id = authUser?.id || body.user_id;

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
        }


        const apiKey = process.env.STREAM_API_KEY || process.env.NEXT_PUBLIC_STREAM_API_KEY;
        const apiSecret = process.env.STREAM_API_SECRET;

        if (!apiKey || !apiSecret) {
            console.warn('[Stream Token API] Missing STREAM_API_KEY or STREAM_API_SECRET in env. Returning dev mode session.');
            return NextResponse.json({ 
                isDevMode: true,
                apiKey: apiKey || null,
                token: null,
                userId: user_id
            }, { status: 200 });
        }

        // Fetch user profile info from Supabase to pass display name & avatar to Stream
        const supabase = createAdminSupabaseClient();
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name, username, avatar_url')
            .eq('id', user_id)
            .maybeSingle();

        const name = profile?.full_name || profile?.username || 'Vicalary User';
        const image = profile?.avatar_url || undefined;

        const serverClient = new StreamClient(apiKey, apiSecret);

        // Upsert user in Stream Video directory
        await serverClient.upsertUsers([
            {
                id: user_id,
                name,
                image,
            }
        ]);

        // Generate user token
        const token = serverClient.generateUserToken({ user_id });

        return NextResponse.json({
            token,
            apiKey,
            userId: user_id,
            name,
            image
        });

    } catch (err: any) {
        console.error('[Stream Token API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
