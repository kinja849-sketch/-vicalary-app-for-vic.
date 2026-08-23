import { NextRequest, NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      user_id = 'user-guest',
      mode = 'cooking_guide',
      language = 'en',
      call_id: providedCallId,
    } = body;

    const apiKey = process.env.STREAM_API_KEY || process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    const voiceAgentUrl = process.env.VOICE_AGENT_URL || 'http://127.0.0.1:8080';

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Stream credentials not configured on server' },
        { status: 500 }
      );
    }

    const callId = providedCallId || `va_${mode}_${user_id}_${Date.now()}`;

    // 1. Generate user token server-side
    const serverClient = new StreamClient(apiKey, apiSecret);
    await serverClient.upsertUsers([
      {
        id: user_id,
        name: user_id === 'user-guest' ? 'Guest User' : user_id,
      },
    ]);
    const token = serverClient.generateUserToken({ user_id });

    // 2. Notify Python Voice Agent Service to start & join the session
    try {
      const response = await fetch(`${voiceAgentUrl}/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          call_type: 'default',
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
      token,
      apiKey,
      userId: user_id,
      callId,
      callType: 'default',
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
