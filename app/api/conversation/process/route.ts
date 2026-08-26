import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { processConversation, processConversationStream } from '@/lib/services/ai/ConversationOrchestrator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      conversation_id,
      user_id,
      content,
      media_url,
      location_context,
      locale = 'en'
    } = body;

    if (!conversation_id || !content) {
      return NextResponse.json(
        { error: 'Missing required parameters: conversation_id and content are required' },
        { status: 400 }
      );
    }

    // Determine authenticated user
    const authHeader = req.headers.get('authorization');
    const hasAuthHeader = Boolean(authHeader);
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined;

    console.log('[VOICE API] Request received');
    console.log(`[VOICE API] Authorization header present: ${hasAuthHeader}`);

    const client = createServerSupabaseClient(req);
    const { data: { user }, error: authError } = token
      ? await client.auth.getUser(token)
      : await client.auth.getUser();

    if (authError || !user) {
      console.warn('[VOICE API] Token validation: failure -', authError?.message || 'No user found');
      return NextResponse.json(
        { error: 'Unauthorized: Active user session or valid Bearer token required' },
        { status: 401 }
      );
    }

    console.log('[VOICE API] Token validation: success');
    console.log(`[VOICE API] Authenticated user: ${user.id}`);
    console.log('[VOICE API] Processing turn...');

    const targetUserId = user.id;

    // Use admin client if service role key is present for writing messages reliably,
    // otherwise fallback to authenticated client
    const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminSupabaseClient()
      : client;

    // Verify user owns / participates in the conversation
    const { data: participant, error: partError } = await dbClient
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (partError || !participant) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this conversation' },
        { status: 403 }
      );
    }

    if (body.stream) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();

      // Process in background and write SSE lines
      (async () => {
        try {
          await processConversationStream(dbClient, {
            userId: targetUserId,
            conversationId: conversation_id,
            userMessage: content,
            mediaUrl: media_url,
            locationContext: location_context,
            locale,
            voiceMode: Boolean(body.voice_mode || body.voiceMode),
            sessionTurns: Array.isArray(body.session_turns || body.sessionTurns) ? (body.session_turns || body.sessionTurns) : undefined
          }, (event) => {
            const dataStr = `data: ${JSON.stringify(event)}\n\n`;
            writer.write(encoder.encode(dataStr)).catch(() => {});
          });
        } catch (err: any) {
          const errStr = `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`;
          writer.write(encoder.encode(errStr)).catch(() => {});
        } finally {
          writer.close().catch(() => {});
        }
      })();

      return new Response(responseStream.readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    }

    const result = await processConversation(dbClient, {
      userId: targetUserId,
      conversationId: conversation_id,
      userMessage: content,
      mediaUrl: media_url,
      locationContext: location_context,
      locale,
      voiceMode: Boolean(body.voice_mode || body.voiceMode),
      sessionTurns: Array.isArray(body.session_turns || body.sessionTurns) ? (body.session_turns || body.sessionTurns) : undefined
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/conversation/process] Handler error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error processing conversation'
      },
      { status: 500 }
    );
  }
}
