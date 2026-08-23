import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const COACH_ID = '00000000-0000-0000-0000-000000000001'

const countryToLangMap: Record<string, string[]> = {
  'ID': ['id', 'en'], 
  'US': ['en'], 
  'GB': ['en'], 
  'FR': ['fr', 'en'],
  'DE': ['de', 'en'], 
  'ES': ['es', 'en'], 
  'SA': ['ar', 'en'],
  'AE': ['ar', 'en'], 
  'IN': ['hi', 'en'], 
  'BD': ['bn', 'en'],
  'PK': ['ur', 'en'], 
  'CN': ['zh', 'en'], 
  'RU': ['ru', 'en'],
  'BR': ['pt', 'en'], 
  'VN': ['vi', 'en'], 
  'TR': ['tr', 'en'],
  
  // Additional Arabic-speaking countries
  'EG': ['ar', 'en'], 'QA': ['ar', 'en'], 'KW': ['ar', 'en'], 'OM': ['ar', 'en'],
  'BH': ['ar', 'en'], 'JO': ['ar', 'en'], 'LB': ['ar', 'en'], 'YE': ['ar', 'en'],
  'IQ': ['ar', 'en'], 'DZ': ['ar', 'en'], 'MA': ['ar', 'en'], 'TN': ['ar', 'en'],
  'LY': ['ar', 'en'], 'SD': ['ar', 'en'], 'SY': ['ar', 'en'], 'PS': ['ar', 'en'],
  
  // Swahili-speaking countries
  'KE': ['sw', 'en'], 'TZ': ['sw', 'en'], 'UG': ['sw', 'en'], 'RW': ['sw', 'en'], 'BI': ['sw', 'en'],
  
  // Somali-speaking countries
  'SO': ['so', 'en'], 'DJ': ['so', 'en'],
  
  // Burmese-speaking countries
  'MM': ['my', 'en'],
  
  // Korean-speaking countries
  'KR': ['ko', 'en'], 'KP': ['ko', 'en'],
  
  // German-speaking countries
  'AT': ['de', 'en'], 'CH': ['de', 'fr', 'en'], 'LI': ['de', 'en'], 'LU': ['de', 'fr', 'en'],
  
  // French-speaking countries
  'MC': ['fr', 'en'], 'BE': ['fr', 'de', 'en'], 'CA': ['en', 'fr'], 'SN': ['fr', 'en'],
  'CI': ['fr', 'en'], 'CM': ['fr', 'en'], 'CD': ['fr', 'en'], 'CG': ['fr', 'en'],
  'GA': ['fr', 'en'], 'NE': ['fr', 'en'], 'ML': ['fr', 'en'], 'TG': ['fr', 'en'],
  'BJ': ['fr', 'en'], 'CF': ['fr', 'en'],
  
  // Portuguese-speaking countries
  'PT': ['pt', 'en'], 'AO': ['pt', 'en'], 'MZ': ['pt', 'en'], 'CV': ['pt', 'en'],
  'GW': ['pt', 'en'], 'TL': ['pt', 'en'],
  
  // Russian-speaking countries
  'BY': ['ru', 'en'], 'KZ': ['ru', 'en'], 'KG': ['ru', 'en'], 'MD': ['ru', 'en'],
  
  // Spanish-speaking countries
  'MX': ['es', 'en'], 'AR': ['es', 'en'], 'CO': ['es', 'en'], 'PE': ['es', 'en'],
  'VE': ['es', 'en'], 'CL': ['es', 'en'], 'EC': ['es', 'en'], 'GT': ['es', 'en'],
  'CU': ['es', 'en'], 'BO': ['es', 'en'], 'DO': ['es', 'en'], 'HN': ['es', 'en'],
  'PY': ['es', 'en'], 'SV': ['es', 'en'], 'NI': ['es', 'en'], 'CR': ['es', 'en'],
  'UY': ['es', 'en'], 'PA': ['es', 'en'], 'GQ': ['es', 'en']
};

function extractMediaUrl(record: any): string | null {
  const meta = record.metadata
  if (!meta) return null
  if (typeof meta === 'object') return meta.url || meta.publicUrl || null
  if (typeof meta === 'string' && meta.startsWith('http')) return meta
  return null
}

async function getGeoInfo(supabase: any, clientIp: string) {
  const { data: cached } = await supabase
    .from('ip_location_cache')
    .select('*')
    .eq('ip_address', clientIp)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (cached) return cached

  try {
    const geoRes = await fetch(`https://ipapi.co/${clientIp}/json/`)
    if (geoRes.ok) {
      const g = await geoRes.json()
      if (!g.error) {
        const geoInfo = {
          ip_address: clientIp,
          country_code: g.country_code || 'US',
          country_name: g.country_name || 'United States',
          city: g.city || 'Unknown',
          timezone: g.timezone || 'UTC',
          currency_code: g.currency || 'USD',
          currency_symbol: g.currency_symbol || '$',
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }
        supabase.from('ip_location_cache').upsert(geoInfo, { onConflict: 'ip_address' }).then()
        return geoInfo
      }
    }
  } catch (e) {
    console.error('Geo lookup failed:', e)
  }

  return { country_code: 'US', country_name: 'United States', city: 'Unknown', currency_code: 'USD', currency_symbol: '$', timezone: 'UTC' }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { record, type, table, system_context } = payload

    console.log(`[Coach-Reply] Incoming request: ${type} on ${table}. Sender: ${record?.sender_id}`)
    if (type !== 'INSERT' || table !== 'messages' || record?.sender_id === COACH_ID) {
      console.log(`[Coach-Reply] Ignoring message. Type: ${type}, Table: ${table}, Sender: ${record?.sender_id}`)
      return NextResponse.json({ message: 'Ignored' })
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.startsWith('your_') || apiKey.startsWith('sk-your')) {
      console.error('[Coach-Reply] Critical Error: OPENAI_API_KEY is missing or is a placeholder. Check .env.local');
      throw new Error('AI Provider API key not set or is a placeholder')
    }

    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    const supabase = supabaseAdmin
    const conversationId = record.conversation_id

    const loc = system_context?.locationContext;
    let geoInfo: any;
    
    if (loc && (loc.country_code || loc.country)) {
        geoInfo = {
            ip_address: 'frontend-provided',
            country_code: loc.country_code || loc.country || 'US',
            country_name: loc.country_name || loc.country || 'United States',
            city: loc.city || 'Unknown',
            timezone: loc.timezone || 'UTC',
            currency_code: loc.currency || loc.currency_code || 'USD',
            currency_symbol: loc.currency_symbol || '$',
            expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        }
    } else {
        const clientIp =
          req.headers.get('x-real-ip') ||
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('cf-connecting-ip') ||
          '8.8.8.8'
        geoInfo = await getGeoInfo(supabase, clientIp)
    }

    // V17: Use the sender_id from the record directly to avoid race conditions with participant fetching
    const userId = record.sender_id
    console.log(`[Coach-Reply] Using Sender ID from record: ${userId} for Conv: ${conversationId}`)
    
    if (!userId || userId === COACH_ID) {
      console.warn(`[Coach-Reply] Invalid sender for AI reply: ${userId}`)
      return NextResponse.json({ message: 'Invalid sender' })
    }

    const safeFetch = async (promise: PromiseLike<any>, label: string) => {
      try {
        const res = await promise;
        if (res.error) {
          console.warn(`[Coach-Reply] Warning fetching ${label}:`, res.error.message);
          return { data: null };
        }
        return res;
      } catch (e: any) {
        console.error(`[Coach-Reply] Critical error fetching ${label}:`, e.message);
        return { data: null };
      }
    };

    const [onboardingRes, profileRes, nutritionRes, messagesRes, scannedProductsRes, settingsRes] = await Promise.all([
      safeFetch(supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(), 'onboarding'),
      safeFetch(supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(), 'profile'),
      safeFetch(supabase.from('food_analysis_history').select('*').eq('user_id', userId).order('analyzed_at', { ascending: false }).limit(7), 'nutrition'),
      safeFetch(supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(20), 'messages'),
      safeFetch(supabase.from('food_analysis_history').select('food_name, calories, protein, carbs, fat, analyzed_at').eq('user_id', userId).order('analyzed_at', { ascending: false }).limit(3), 'scans'),
      safeFetch(supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(), 'settings')
    ])

    const profile = profileRes.data
    const onboarding = onboardingRes.data || {}
    const recentMessages = ((messagesRes.data || []) as any[]).reverse()
    const recentScans = scannedProductsRes.data || []
    const userSettings = settingsRes.data || {}
    const userLanguage = userSettings.language || (geoInfo.country_code ? countryToLangMap[geoInfo.country_code]?.[0] : null) || 'en'
    const userCurrency = userSettings.currency || geoInfo.currency_code || 'USD'

    const userName = profile?.full_name || 'there'
    const rawTime = system_context?.current_time || new Date().toISOString()
    const currentTime = new Date(rawTime).toLocaleString(system_context?.language || 'en-US', {
      timeZone: system_context?.time_zone || geoInfo.timezone || 'UTC',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const totalCaloriesToday = (recentScans as any[])
      .filter((s: any) => s.analyzed_at && new Date(s.analyzed_at).toDateString() === new Date().toDateString())
      .reduce((sum: number, s: any) => sum + (s.calories || 0), 0)

    const calorieGoal = (onboarding as any).daily_calorie_goal || 2000
    const caloriesRemaining = calorieGoal - totalCaloriesToday

    const systemPrompt = `You are Vicalary Health Intelligence, a sophisticated and empathetic conversational health coach for ${userName}. You are not a chatbot; you are a deeply intelligent advisor capable of complex reasoning, visual analysis, and long-term memory.

CONVERSATIONAL PHILOSOPHY:
1. Speak naturally and intelligently. Avoid robotic patterns, repetitive structures, or generic health advice.
2. Maintain perfect continuity. If the user mentions something earlier in the session, you remember it and factor it into your current reasoning.
3. Be supportive but professional. Your tone should feel like a human expert who truly understands ${userName}'s health journey.

CRITICAL FORMATTING RULES:
1. You MUST write strictly in natural paragraphs. 
2. ABSOLUTELY NO SYMBOLS ALLOWED. Do NOT use asterisks (*), dashes (-), hashtags (#), or bullet points.
3. If you want to list items, write them out in a flowing sentence separated by commas.
4. Your response must look like a text message from a human, not a formatted document.

MULTIMODAL & CONTEXTUAL REASONING:
- If an image is shared, analyze it with clinical precision. Identify the food, estimate portion sizes, and calculate calories relative to the user's daily progress.
- FACTOR IN THE FOLLOWING METRICS:
  - Current Time/Date: ${currentTime}
  - User Location: ${geoInfo.city}, ${geoInfo.country_name}
  - Regional Standards: Use ${['US', 'UK', 'CA', 'AU'].includes(geoInfo.country_name) ? 'Imperial (kcal/oz/lbs)' : 'Metric (kcal/kJ/g/kg)'} units. Factor in local health regulations of ${geoInfo.country_name}.
  - Today's Consumption: ${totalCaloriesToday} kcal
  - Remaining Calories: ${caloriesRemaining} kcal (Goal: ${calorieGoal} kcal)
  - Primary Health Goal: ${(onboarding as any).goal || 'General Wellness'}
  - Restrictions/Conditions: ${((onboarding as any).dietary_lifestyle || []).join(', ') || 'None'} | ${(onboarding as any).medical_conditions || 'None reported'}
- LATEST DEPTH ANALYSIS CONTEXT: ${system_context?.latest_analysis ? JSON.stringify(system_context.latest_analysis) : 'None'}

INTELLIGENCE DIRECTIVES:
- MAPS AND LOCATIONS: If suggesting a physical location, clinic, or restaurant, you MUST emit a special tag in your response formatted exactly like this: [LOCATION: lat,lng,Place Name]. Do not write out coordinates or links, just emit the tag. The system will convert it into an interactive map.
- LANGUAGE: The user's preferred language code is '${userLanguage}' and currency is '${userCurrency}'. You MUST write your entire response fluently in this language ('${userLanguage}') and format prices/monetary units in their currency. Do NOT reply in English unless their language code is 'en'.
- REASONING: Before you reply, internally evaluate the user's intent. Are they asking for motivation, data analysis, or a recommendation? Tailor your depth to their specific need.
- CONSISTENCY: If they ask about a previous meal or scan mentioned in the history, you know exactly what they are referring to.

Respond directly with your conversational reply. Avoid all robotic formatting.`

    const msgType = record.message_type
    // Support image URL from metadata even for text messages (common for context handoff)
    const imageUrl = msgType === 'image' ? extractMediaUrl(record) : (record.metadata?.url || null)
    let transcribedText = ''
    if (msgType === 'voice') {
      const voiceUrl = extractMediaUrl(record)
      console.log(`[Coach-Reply] Processing Voice Message: ${voiceUrl}`)
      if (voiceUrl) {
        try {
          const audioRes = await fetch(voiceUrl)
          if (audioRes.ok) {
            const audioBlob = await audioRes.blob()
            const formData = new FormData()
            // Ensure we use a supported extension for Whisper
            const fileExtension = record.metadata?.mimeType?.split('/')[1] || 'webm'
            formData.append('file', audioBlob, `voice.${fileExtension}`)
            formData.append('model', 'whisper-1')
            
            console.log(`[Coach-Reply] Transcribing with Whisper...`)
            const transRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}` },
              body: formData,
            })
            
            if (transRes.ok) {
              const tData = await transRes.json()
              transcribedText = tData.text || ''
              console.log(`[Coach-Reply] Transcription Success: "${transcribedText}"`)
              
              // V14: PERSIST TRANSCRIPTION to the original message for future context & UI display
              await supabase.from('messages').update({
                metadata: { 
                  ...record.metadata, 
                  transcription: transcribedText,
                  transcription_v: 1 // versioning if we change algorithms
                }
              }).eq('id', record.id);
            } else {
              const errText = await transRes.text()
              console.error(`[Coach-Reply] Whisper Error: ${errText}`)
            }
          }
        } catch (e) { 
          console.error('[Coach-Reply] Voice processing failed:', e)
          transcribedText = '[User sent a voice message that could not be transcribed]'
        }
      }
    }

    const chatContext: any[] = recentMessages.map((m: any) => {
      const isCoach = m.sender_id === COACH_ID;
      let content = m.content || '';
      
      if (!isCoach && m.message_type !== 'text') {
        // V14: Use transcription if available in metadata for non-text messages (voice)
        const transcription = m.metadata?.transcription || m.metadata?.transcribedText;
        if (transcription) {
          content = `[${m.message_type}]: ${transcription}`;
        } else {
          content = `[${m.message_type} message shared]`;
        }
      }

      return {
        role: isCoach ? 'assistant' : 'user',
        content
      };
    }).filter((m: any) => m.content)

    let content = record.content || ''
    const scanCtx = record.metadata?.scannedProductContext
    let ctxSummary = ''

    if (scanCtx) {
      ctxSummary = `[Context: User scanned ${scanCtx.productName || scanCtx.name}. ` +
        `Macros: ${scanCtx.calories}kcal, P:${scanCtx.protein}g, C:${scanCtx.carbs}g, F:${scanCtx.fat}g. ` +
        `Political/Ethical: ${scanCtx.political_warning || 'None'}]`
      content = `${ctxSummary}\n\n${content}`
    }

    const currentUserMsg: any = { role: 'user', content }
    if (imageUrl) {
      currentUserMsg.content = [
        { type: 'text', text: content || 'Please analyze this image.' },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
      ]
    } else if (msgType === 'voice' && transcribedText) {
      currentUserMsg.content = `[Voice message]: ${transcribedText}${ctxSummary ? `\n\n${ctxSummary}` : ''}`
    }

    const chatWithCurrent = chatContext.filter((m: any, i: number) =>
      !(i === chatContext.length - 1 && m.role === 'user' && m.content === record.content)
    )
    chatWithCurrent.push(currentUserMsg)

    // Idempotency check
    const { data: existingReply } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('sender_id', COACH_ID)
      .gt('created_at', record.created_at)
      .limit(1)
      .maybeSingle()

    if (existingReply) {
      return NextResponse.json({ message: 'Already replied', id: existingReply.id })
    }

    // Create placeholder message
    const { data: newMsg, error: insertErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: COACH_ID,
      content: '',
      message_type: 'text',
      is_read: false,
      metadata: { replying_to: record.id },
    }).select().single()

    if (insertErr || !newMsg) throw new Error(`Failed to create message placeholder: ${insertErr?.message}`)

    // AI call with streaming (stream to DB, not to client)
    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.NEXT_PUBLIC_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'system', content: systemPrompt }, ...chatWithCurrent.slice(-20)],
        stream: true,
        temperature: 0.7,
        max_tokens: 1500,
        frequency_penalty: 0.5,
        presence_penalty: 0.5
      }),
    })

    if (!openAiRes.ok) throw new Error(`OpenAI error: ${await openAiRes.text()}`)
    if (!openAiRes.body) throw new Error('No stream body from AI')

    const reader = openAiRes.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullReply = ''
    let lastUpdateTime = Date.now()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            const delta = data.choices[0]?.delta?.content || ''
            if (delta) {
                const cleanedDelta = delta.replace(/[*#]/g, '');
                fullReply += cleanedDelta;
            }
          } catch {}
        }
      }

      if (Date.now() - lastUpdateTime > 500 && fullReply.length > 0) {
        lastUpdateTime = Date.now()
        supabase.from('messages').update({ content: fullReply.trim() }).eq('id', newMsg.id).then()
      }
    }

    if (!fullReply) {
      fullReply = "I apologize, but I encountered a technical glitch while thinking. Could you please try asking that again? I'm ready to help!"
    } else {
      fullReply = fullReply.trim();
    }

    await supabase.from('messages').update({ content: fullReply, delivered_at: new Date().toISOString() }).eq('id', newMsg.id)
    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_content: fullReply.substring(0, 200),
      last_message_type: 'text',
      last_message_sender_id: COACH_ID,
    } as any).eq('id', conversationId)

    return NextResponse.json({ success: true, message_id: newMsg.id })
  } catch (err: any) {
    console.error('Coach Reply Error:', err.message)
    return NextResponse.json({
      error: true,
      message: err.message,
      actionable_feedback: 'The AI Coach is momentarily overwhelmed. Re-sending your message might help.',
    })
  }
}
