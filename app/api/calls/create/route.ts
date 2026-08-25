import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

const COACH_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const authUser = await getAuthenticatedUser(req);
        const caller_id = authUser?.id || body.caller_id;

        if (!caller_id) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required to place calls' }, { status: 401 });
        }

        const { conversation_id, receiver_id, type = 'voice' } = body;


        if (!conversation_id) {
            return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
        }

        const supabase = createAdminSupabaseClient();

        // 1. Identify receiver if not explicitly provided
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

        // 2. Validate participant identities (refuse self-calls or AI coach calls)
        if (!targetReceiverId || targetReceiverId === caller_id) {
            return NextResponse.json({ error: 'Cannot call yourself or invalid call target' }, { status: 400 });
        }

        if (caller_id === COACH_ID || targetReceiverId === COACH_ID) {
            return NextResponse.json({ error: 'Calls are not supported with Health Coach' }, { status: 400 });
        }

        // 3. Obtain Daily Room URL
        let roomUrl = '';

        const dailyApiKey = process.env.DAILY_API_KEY;
        if (!dailyApiKey) {
            return NextResponse.json({ 
                error: 'DAILY_API_KEY is not configured in .env.local. Audio/video calls require a Daily.co API key.' 
            }, { status: 400 });
        }

        try {
            const roomRes = await fetch('https://api.daily.co/v1/rooms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${dailyApiKey}`
                    },
                    body: JSON.stringify({
                        properties: {
                            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
                            eject_at_room_exp: true
                        }
                    })
                });

                if (roomRes.ok) {
                    const roomData = await roomRes.json();
                    roomUrl = roomData.url;
                } else {
                    console.warn('[Calls Create API] Daily REST API returned non-200:', roomRes.status);
                }
            } catch (err) {
                console.warn('[Calls Create API] Daily REST API fetch failed:', err);
            }

        // Attempt B: Supabase RPC fallback if Daily REST API key not present or failed
        if (!roomUrl) {
            try {
                const { data: rpcData, error: rpcError } = await (supabase as any).rpc('create_daily_room_rpc', {
                    conversation_id
                });
                if (!rpcError && rpcData?.room_url) {
                    roomUrl = rpcData.room_url;
                }
            } catch (rpcErr) {
                console.warn('[Calls Create API] RPC create_daily_room_rpc error:', rpcErr);
            }
        }

        // Attempt C: Fallback URL generation if neither API nor RPC produced a room URL
        if (!roomUrl) {
            const sanitizedConvId = conversation_id.replace(/[^a-zA-Z0-9_-]/g, '_');
            const dailyDomain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'vicalary';
            roomUrl = `https://${dailyDomain}.daily.co/vicalary_call_${sanitizedConvId}`;
        }

        // 4. Insert call record into Supabase database
        const callType = type === 'video' ? 'video' : 'voice';
        const { data: callRecord, error: callError } = await supabase
            .from('calls')
            .insert({
                conversation_id,
                caller_id,
                receiver_id: targetReceiverId,
                room_url: roomUrl,
                type: callType,
                status: 'ringing'
            })
            .select(`
                *,
                caller:user_profiles!caller_id(id, full_name, username, avatar_url),
                receiver:user_profiles!receiver_id(id, full_name, username, avatar_url)
            `)
            .single();

        if (callError) {
            console.error('[Calls Create API] Error inserting call into Supabase:', callError);
            return NextResponse.json({ error: callError.message }, { status: 500 });
        }

        console.log('[Calls Create API] Call created successfully:', callRecord.id, 'Room:', roomUrl);

        return NextResponse.json({
            success: true,
            callRecord
        });

    } catch (err: any) {
        console.error('[Calls Create API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
