import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode = 'cooking_guide',
      language = 'en',
      recipe_context,
      pantry_context,
      extra_context,
    } = body;
    const user_id = authUser.id;

    const dailyApiKey = process.env.DAILY_API_KEY;
    const voiceAgentUrl = process.env.VOICE_AGENT_URL || 'http://127.0.0.1:8080';

    if (!dailyApiKey) {
      return NextResponse.json(
        { error: 'Daily API credentials (DAILY_API_KEY) not configured on server' },
        { status: 500 }
      );
    }

    const callId = `va_${mode}_${user_id}_${Date.now()}`;

    // 1. Fetch live user data and context from Supabase
    let userName = 'there';
    let dynamicContext: Record<string, any> = {};

    try {
      const { supabaseAdmin } = await import('@/lib/supabase-admin');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [profileRes, onboardingRes, nutritionRes] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('full_name, username').eq('id', user_id).maybeSingle(),
        supabaseAdmin.from('onboarding_responses').select('*').eq('user_id', user_id).maybeSingle(),
        supabaseAdmin.from('food_analysis_history')
          .select('calories, protein, carbs, fat, analyzed_at')
          .eq('user_id', user_id)
          .gte('analyzed_at', todayStart.toISOString())
          .limit(20)
      ]);

      const profile = profileRes.data;
      const onboarding = onboardingRes.data || {};
      const todayLogs = nutritionRes.data || [];

      userName = profile?.full_name || profile?.username || 'there';

      const caloriesToday = todayLogs.reduce((sum: number, item: any) => sum + (item.calories || 0), 0);
      const calorieGoal = (onboarding as any).daily_calorie_goal || 2000;
      const caloriesRemaining = Math.max(0, calorieGoal - caloriesToday);

      if (mode === 'health_coach') {
        dynamicContext = {
          goal: (onboarding as any).goal || 'General Health & Vitality',
          daily_calorie_goal: calorieGoal,
          calories_today: caloriesToday,
          calories_remaining: caloriesRemaining,
          dietary_lifestyle: (onboarding as any).dietary_lifestyle?.join(', ') || 'None',
          recent_notes: extra_context || 'Live check-in',
        };
      } else if (mode === 'cooking_guide') {
        dynamicContext = {
          current_meal: recipe_context?.name || recipe_context?.title || extra_context || 'Custom Recipe Session',
          recipe_name: recipe_context?.name || recipe_context?.title,
          dietary_lifestyle: (onboarding as any).dietary_lifestyle?.join(', ') || 'None',
          available_ingredients: pantry_context || recipe_context?.ingredients || 'As requested by user',
          skill_level: recipe_context?.difficulty || 'Home cook',
        };
      }
    } catch (dbErr) {
      console.warn('[Voice Agent API] Failed to fetch dynamic context from DB:', dbErr);
    }

    // 2. Create a Daily.co Room dynamically
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

    // 3. Create a Daily Meeting Token for the bot (owner)
    const botName = mode === 'cooking_guide' ? 'Chef Vee' : 'Vee';
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
          user_name: botName
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

    // 4. Notify Python Voice Agent Service to start & join the session with live dynamic context
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
          user_name: userName,
          dynamic_context: dynamicContext,
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
      userName,
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
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { call_id } = body;

    if (!call_id) {
      return NextResponse.json({ error: 'call_id is required' }, { status: 400 });
    }

    // Verify the call_id contains the authenticated user's ID
    if (!call_id.includes(authUser.id)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to terminate this session' },
        { status: 403 }
      );
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
