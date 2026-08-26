import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { processConversation } from '@/lib/services/ai/ConversationOrchestrator';

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
    const client = createServerSupabaseClient(req);
    const { data: { user } } = await client.auth.getUser();

    const targetUserId = user?.id || user_id;
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: No active user session or user_id provided' },
        { status: 401 }
      );
    }

    // Use admin client if service role key is present for writing messages reliably,
    // otherwise fallback to authenticated client
    const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminSupabaseClient()
      : client;

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
