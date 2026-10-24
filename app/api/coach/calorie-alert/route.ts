import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server';

const COACH_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authUser = await getAuthenticatedUser(req).catch(() => null);
    const userId = body.userId || authUser?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. Resolve date and progress
    const today = body.date || new Date().toISOString().split('T')[0];

    // Fetch user profile for accurate calorie goal if needed
    const [{ data: profile }, { data: progress }] = await Promise.all([
      supabase.from('user_profiles').select('goal_calories, full_name').eq('id', userId).maybeSingle(),
      supabase.from('daily_progress').select('*').eq('user_id', userId).eq('progress_date', today).maybeSingle()
    ]);

    const consumed = Number(body.consumed ?? progress?.calories_consumed ?? 0);
    const goal = Number(body.goal ?? progress?.calories_goal ?? profile?.goal_calories ?? 2000);

    if (consumed <= goal) {
      return NextResponse.json({ success: true, alerted: false, reason: 'Calorie target not exceeded' });
    }

    const excess = consumed - goal;

    // 2. Find user's AI coach conversation
    let coachConvId: string | null = null;
    const { data: convParts } = await (supabase
      .from('conversation_participants') as any)
      .select('conversation_id, conversations!inner(id, conversation_type)')
      .eq('user_id', userId)
      .eq('conversations.conversation_type', 'ai')
      .limit(1);

    if (convParts && convParts.length > 0 && convParts[0]?.conversation_id) {
      coachConvId = String(convParts[0].conversation_id);
    } else {
      // Create AI coach conversation
      const { data: newConv } = await (supabase.from('conversations') as any)
        .insert({ conversation_type: 'ai', name: 'Health Coach' })
        .select('id')
        .single();
      if (newConv?.id) {
        coachConvId = String(newConv.id);
        await (supabase.from('conversation_participants') as any).insert([
          { conversation_id: coachConvId, user_id: userId },
          { conversation_id: coachConvId, user_id: COACH_ID }
        ]);
      }
    }

    if (!coachConvId) {
      return NextResponse.json({ error: 'Could not resolve coach conversation' }, { status: 500 });
    }

    // 3. Idempotency Check: only 1 alert per user per date
    const { data: existingAlert } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', coachConvId)
      .eq('sender_id', COACH_ID)
      .eq('metadata->>type', 'calorie_limit_exceeded')
      .eq('metadata->>date', today)
      .limit(1)
      .maybeSingle();

    if (existingAlert && !body.force) {
      return NextResponse.json({ success: true, alreadyAlerted: true, conversationId: coachConvId });
    }

    // 4. Compose firm, agitated coach alert with ZERO markdown symbols (# or *)
    const mealPart = body.mealName ? `Logging "${body.mealName}" pushed you even deeper into a dangerous surplus.\n\n` : '';
    const alertText = `STOP EATING IMMEDIATELY! This is an urgent health alert.

You have consumed ${consumed} kcal today, blowing past your target goal of ${goal} kcal by an extra +${excess} calories! ${mealPart}Consuming this excess forces your body into aggressive fat storage, causes intense blood sugar and insulin spikes, strains your cardiovascular system, and completely sabotages your hard-earned progress!

You MUST avoid eating another bite for the remainder of this day. Put down any snacks, drink water, step away from food, and let's make sure this NEVER happens again!`.trim();

    // 5. Insert alert message into database
    const { data: insertedMsg, error: insertErr } = await (supabase.from('messages') as any)
      .insert({
        conversation_id: coachConvId,
        sender_id: COACH_ID,
        receiver_id: userId,
        content: alertText,
        message_type: 'text',
        is_delivered: true,
        delivered_at: new Date().toISOString(),
        metadata: {
          type: 'calorie_limit_exceeded',
          date: today,
          consumed,
          goal,
          excess
        }
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[CalorieAlert API] Insert error:', insertErr);
      throw insertErr;
    }

    // 6. Update conversation last message
    await (supabase.from('conversations') as any)
      .update({
        last_message_at: new Date().toISOString(),
        last_message_content: alertText.slice(0, 150),
        last_message_type: 'text',
        last_message_sender_id: COACH_ID
      })
      .eq('id', coachConvId);

    // 7. Insert warning notification
    try {
      await (supabase.from('notifications') as any).insert({
        user_id: userId,
        title: 'CALORIE GOAL EXCEEDED!',
        message: `You blew past your target by +${excess} kcal (${consumed}/${goal} kcal)! Stop eating immediately.`,
        type: 'warning',
        created_at: new Date().toISOString()
      });
    } catch (notifErr) {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      alerted: true,
      messageId: insertedMsg?.id,
      conversationId: coachConvId,
      consumed,
      goal,
      excess
    });
  } catch (error: any) {
    console.error('[CalorieAlert API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
