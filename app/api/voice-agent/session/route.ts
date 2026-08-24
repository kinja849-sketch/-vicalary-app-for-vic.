import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authUser = await getAuthenticatedUser(req);
    const {
      mode = 'cooking_guide',
      language = 'en',
      call_id: providedCallId,
    } = body;
    const user_id = authUser?.id || body.user_id || 'user-guest';

    const dailyApiKey = process.env.DAILY_API_KEY;
    const voiceAgentUrl = process.env.VOICE_AGENT_URL || 'http://127.0.0.1:8080';

    if (!dailyApiKey) {
      return NextResponse.json(
        { error: 'Daily API credentials (DAILY_API_KEY) not configured on server' },
        { status: 500 }
      );
    }

    const callId = providedCallId || `va_${mode}_${user_id}_${Date.now()}`;

    // 1. Create a Daily.co Room dynamically
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

    if (!roomRes.ok) {
      const errText = await roomRes.text();
      console.error('[Voice Agent API] Failed to create Daily room:', errText);
      return NextResponse.json(
        { error: `Failed to create Daily room: ${errText}` },
        { status: 500 }
      );
    }

    const roomData = await roomRes.json();
    const roomUrl = roomData.url;
    const roomName = roomData.name;

    // 2. Create a Daily Meeting Token for the bot (owner)
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dailyApiKey}`
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: true,
          user_name: mode === 'cooking_guide' ? 'Chef Avatar' : 'Health Coach'
        }
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Voice Agent API] Failed to create bot token:', errText);
      return NextResponse.json(
        { error: `Failed to create bot token: ${errText}` },
        { status: 500 }
      );
    }

    const tokenData = await tokenRes.json();
    const botToken = tokenData.token;

    // 3. Notify Python Voice Agent Service to start & join the session
    try {
      const response = await fetch(`${voiceAgentUrl}/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          room_url: roomUrl,
          token: botToken,
          mode,
          language,
          user_id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[Voice Agent API] Service error:', errorText);
      }
    } catch (agentErr: any) {
      console.warn('[Voice Agent API] Could not reach voice agent service:', agentErr.message);
    }

    return NextResponse.json({
      success: true,
      roomUrl,
      callId,
      mode,
      language,
    });
  } catch (err: any) {
    console.error('[Voice Agent API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { call_id } = body;

    if (!call_id) {
      return NextResponse.json({ error: 'call_id is required' }, { status: 400 });
    }

    const voiceAgentUrl = process.env.VOICE_AGENT_URL || 'http://127.0.0.1:8080';
    
    console.log('[Voice Agent API] Stopping session for call_id:', call_id);
    const response = await fetch(`${voiceAgentUrl}/stop-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Voice Agent API DELETE Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
