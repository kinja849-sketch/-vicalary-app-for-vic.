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
    const payload = await req.json()
    const { conversation_id, user_id, message, content, location_context } = payload
    const userText = content || message || ''
    const convId = conversation_id
    const uid = user_id

    if (!convId || !userText) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

    // 1. Fetch relevant user profile & conversation history
    const [profileRes, messagesRes] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*').eq('id', uid).maybeSingle(),
      supabaseAdmin.from('messages').select('sender_id, content').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(8)
    ])

    const profile = profileRes.data || {}
    const history = (messagesRes.data || []).reverse()

    // 2. Build system instructions
    const systemPrompt = `You are VICALARY Health Coach — an empathetic, knowledgeable AI nutrition and wellness companion.
User Name: ${profile.full_name || 'User'}
Goal: ${profile.primary_goal || 'Healthy Living'}
Dietary Preference: ${profile.dietary_preference || 'Standard'}

CONVERSATION RULES:
1. Always reply conversationally and naturally.
2. Never output artificial markdown headings (# or ##) or robotic templates unless asked for a list.
3. Ground all facts in verified nutrition knowledge; never diagnose or prescribe.
4. If asked about brands or locations without data, answer honestly that verification is unavailable.
`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: any) => ({
        role: m.sender_id === COACH_ID ? 'assistant' : 'user',
        content: m.content
      }))
    ]

    if (history.length === 0 || history[history.length - 1].content !== userText) {
      messages.push({ role: 'user', content: userText })
    }

    // 3. Generate completion
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 600
      })
    })

    if (!aiRes.ok) {
      throw new Error(`OpenAI error: ${await aiRes.text()}`)
    }

    const aiData = await aiRes.json()
    let replyText = aiData.choices?.[0]?.message?.content || "I'm listening. How can I help you today?"

    // Strip markdown headings for pure conversational flow
    replyText = replyText.replace(/^#{1,6}\s+(.*)$/gm, '$1').trim()

    // 4. Save to messages table
    const { data: insertedMsg, error: insertErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: COACH_ID,
        receiver_id: uid,
        content: replyText,
        message_type: 'text',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (insertErr) console.error('Error saving assistant message:', insertErr)

    // Update conversation record
    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_content: replyText,
        last_message_type: 'text',
        last_message_sender_id: COACH_ID
      })
      .eq('id', convId)

    return new Response(
      JSON.stringify({
        success: true,
        message_id: insertedMsg?.id,
        content: replyText
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error('Process conversation error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
