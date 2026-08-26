import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    // If no user context (e.g. called by cron), parse body for target_user_id
    let userId = user?.id;
    let targetDate = new Date().toISOString().split('T')[0];

    if (!userId) {
       const body = await req.json().catch(() => ({}));
       if (body.target_user_id) userId = body.target_user_id;
       if (body.target_date) targetDate = body.target_date;
    }

    if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized or missing target_user_id' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    // 1. Fetch meals logged today
    const { data: meals } = await supabaseClient
      .from('daily_meal_served')
      .select('meal_type, food_name, calories, protein, carbs, fat, healthStatus')
      .eq('user_id', userId)
      .gte('shown_date', `${targetDate}T00:00:00.000Z`)
      .lte('shown_date', `${targetDate}T23:59:59.999Z`);

    // 2. Fetch User Profile
    const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('goal, daily_calorie_goal')
        .eq('id', userId)
        .single();

    if (!meals || meals.length === 0) {
        return new Response(JSON.stringify({ message: 'No meals logged today. Skipping summary.' }), { headers: corsHeaders });
    }

    const totalCals = meals.reduce((acc, m) => acc + (m.calories || 0), 0);
    const targetCals = profile?.daily_calorie_goal || 2000;

    // 3. AI Analysis
    const prompt = `You are a clinical AI Health Coach.
User Goal: ${profile?.goal || 'General Health'}
Target Calories: ${targetCals}
Consumed Calories: ${totalCals}

Meals logged today:
${JSON.stringify(meals, null, 2)}

Provide a deeply analytical, 3-paragraph summary of their day. Point out missing macros, praise good choices, and give actionable advice for tomorrow.`;

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAiKey) {
        throw new Error("Missing OpenAI API Key in edge function environment");
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: prompt }]
        })
    });

    const aiData = await aiRes.json();
    const summaryText = aiData.choices?.[0]?.message?.content || "Daily summary generated.";

    // 4. Save to Database
    await supabaseClient.from('coach_messages').insert({
        user_id: userId,
        message: summaryText,
        is_user: false,
        intent: 'daily_summary'
    });

    return new Response(JSON.stringify({ success: true, summary: summaryText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
