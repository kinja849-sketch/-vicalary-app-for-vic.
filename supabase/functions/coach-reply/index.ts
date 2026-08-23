import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const COACH_ID = '00000000-0000-0000-0000-000000000001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const payload = await req.json();
    const { record, type, table, system_context } = payload;

    if (type !== 'INSERT' || table !== 'messages' || record?.sender_id === COACH_ID) {
      return new Response(JSON.stringify({ message: 'Ignored' }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

    const conversationId = record.conversation_id;
    const userId = record.sender_id;

    // 1. Fetch user data
    const [onboardingRes, profileRes, messagesRes, settingsRes] = await Promise.all([
      supabaseAdmin.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
    ]);

    const profile = profileRes.data;
    const onboarding = onboardingRes.data || {};
    const settings = settingsRes.data || {};
    const recentMessages = (messagesRes.data || []).reverse();
    const userName = profile?.full_name || 'there';
    
    const loc = record.metadata?.user_location;
    const locationString = loc ? `Current Location: ${loc.city}, ${loc.country_name} (Timezone: ${settings.timezone || loc.timezone})` : 'Location unknown';

    const systemPrompt = `You are Vicalary Health Intelligence, an elite health coach and concierge for ${userName}.
You MUST provide highly detailed, comprehensive information. DO NOT paraphrase. Give actionable, specific places, recipes, or advice.
If the user asks where to buy something or asks for places, USE their exact location to give real-world recommendations.
User Goal: ${onboarding.goal || 'General Wellness'}.
Dietary: ${(onboarding.dietary_lifestyle || []).join(', ') || 'None'}.
${locationString}.
CRITICAL LANGUAGE REQUIREMENT: The user's preferred language code is '${settings.language || 'en'}' and their local currency is ${settings.currency || 'USD'}. ALL of your responses MUST be natively spoken in this language ('${settings.language || 'en'}') and you must format prices in their local currency. Do NOT reply in English unless their language code is 'en'.`;

    const chatContext = recentMessages.map((m: any) => {
      const role = m.sender_id === COACH_ID ? 'assistant' : 'user';
      let content: any = m.content || '';

      // Multimodal Vision Support for images
      if (m.message_type === 'image' && m.metadata?.url) {
        content = [
          { type: 'text', text: m.content || 'Please analyze this image.' },
          { type: 'image_url', image_url: { url: m.metadata.url } }
        ];
      }

      return { role, content };
    }).filter(m => m.content);

    // 2. Create placeholder
    const { data: newMsg, error: insertErr } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      sender_id: COACH_ID,
      content: 'Thinking...',
      message_type: 'text',
      is_read: false,
      metadata: { replying_to: record.id },
    }).select().single();

    if (insertErr || !newMsg) throw new Error(`Placeholder failed: ${insertErr?.message}`);

    // 3. Call OpenAI
    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...chatContext],
        stream: false // Non-streaming for simplicity in Edge Function
      }),
    });

    if (!openAiRes.ok) throw new Error(`OpenAI error: ${await openAiRes.text()}`);
    const aiData = await openAiRes.json();
    const reply = aiData.choices[0].message.content.trim();

    // 4. Update message
    await supabaseAdmin.from('messages').update({ 
      content: reply, 
      delivered_at: new Date().toISOString() 
    }).eq('id', newMsg.id);

    // 5. Update conversation
    await supabaseAdmin.from('conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_content: reply.substring(0, 200),
      last_message_type: 'text',
      last_message_sender_id: COACH_ID,
    } as any).eq('id', conversationId);

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error('Coach Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
