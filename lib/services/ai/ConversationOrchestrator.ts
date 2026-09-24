import { SupabaseClient } from '@supabase/supabase-js';
import { classifyIntentFast, IntentClassification } from './IntentRouter';
import {
  loadUserProfileContext,
  loadMealPlanContext,
  loadBudgetContext,
  loadAffiliationContext,
  loadRecentConversationHistory,
  UserProfileContext,
  MealPlanContext,
  BudgetContext,
  AffiliationRecord
} from './ContextAssembler';
import { formatConversationalOutput } from './ConversationFormatter';
import { routeAndExecuteTools, ToolExecutionResult } from './ToolRouter';
import { formatForSpeech } from './SpeechFormatter';

const COACH_ID = '00000000-0000-0000-0000-000000000001';

export interface ProcessConversationInput {
  userId: string;
  conversationId: string;
  userMessage: string;
  mediaUrl?: string | null;
  locationContext?: {
    city?: string;
    country?: string;
    timezone?: string;
    lat?: number;
    lng?: number;
  } | null;
  locale?: string;
  voiceMode?: boolean;
  sessionTurns?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ProcessConversationResult {
  success: boolean;
  messageId?: string;
  content: string;
  intent: string;
  format: string;
  audioBase64?: string;
  metrics?: {
    firstSentenceMs: number;
    ttsDurationMs: number;
    totalTurnMs: number;
  };
  error?: string;
}

export type VoiceStreamEvent =
  | { type: 'thinking' }
  | { type: 'first_audio'; audioBase64: string; text: string; metrics: { firstSentenceMs: number; ttsDurationMs: number; totalTurnMs: number } }
  | { type: 'audio'; audioBase64: string; text: string; metrics: { firstSentenceMs: number; ttsDurationMs: number; totalTurnMs: number } }
  | { type: 'text_chunk'; text: string }
  | { type: 'done'; fullText: string; audioBase64?: string; metrics: { firstSentenceMs: number; ttsDurationMs: number; totalTurnMs: number } }
  | { type: 'error'; error: string };

export async function processConversationStream(
  supabase: SupabaseClient,
  input: ProcessConversationInput,
  onEvent: (event: VoiceStreamEvent) => void
): Promise<void> {
  const startTime = Date.now();
  const { userId, conversationId, userMessage, locationContext, locale = 'en', voiceMode = true, sessionTurns } = input;

  try {
    onEvent({ type: 'thinking' });

    const isShortGreeting = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|how are you doing|halo|hai|yo|greetings|howdy|sup)[\s!.?,]*$/i.test(userMessage.trim());

    // 1. Classify Intent
    const classification: IntentClassification = classifyIntentFast(userMessage);

    // 2. Dynamic Context Assembly (skip slow external tools in voiceMode unless specifically required)
    let profileContext: UserProfileContext | null = null;
    let mealPlanContext: MealPlanContext | null = null;
    let budgetContext: BudgetContext | null = null;
    let affiliationContext: AffiliationRecord | null = null;
    let toolResults: ToolExecutionResult[] = [];

    const shouldRunExternalTools = !voiceMode || classification.requires_external_search;

    const [
      profileRes,
      mealRes,
      budgetRes,
      affiliationRes,
      historyRes,
      toolsRes
    ] = isShortGreeting
      ? await Promise.all([
          loadUserProfileContext(supabase, userId),
          Promise.resolve(null),
          Promise.resolve(null),
          Promise.resolve(null),
          Promise.resolve([]),
          Promise.resolve([])
        ])
      : await Promise.all([
          loadUserProfileContext(supabase, userId),
          classification.requires_meal_plan ? loadMealPlanContext(supabase, userId) : Promise.resolve(null),
          classification.requires_budget_snapshot ? loadBudgetContext(supabase, userId) : Promise.resolve(null),
          classification.requires_affiliation_lookup ? loadAffiliationContext(supabase, classification.extracted_entity || userMessage) : Promise.resolve(null),
          loadRecentConversationHistory(supabase, conversationId, 4),
          shouldRunExternalTools ? routeAndExecuteTools({ userMessage, locationContext }) : Promise.resolve([])
        ]);

    profileContext = profileRes;
    mealPlanContext = mealRes;
    budgetContext = budgetRes;
    affiliationContext = affiliationRes;
    toolResults = toolsRes || [];

    // 3. Build System Prompt
    const systemPrompt = buildSystemPrompt({
      classification,
      profileContext,
      mealPlanContext,
      budgetContext,
      affiliationContext,
      locationContext,
      locale,
      voiceMode,
      toolResults
    });

    // 4. Build Messages Payload
    const messagesPayload: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    const effectiveHistory = (sessionTurns && sessionTurns.length > 0)
      ? sessionTurns.slice(-6)
      : historyRes;

    for (const hist of effectiveHistory) {
      if (hist.content && hist.content.trim() && hist.content !== userMessage) {
        messagesPayload.push({
          role: hist.role === 'assistant' ? 'assistant' : 'user',
          content: hist.content
        });
      }
    }
    messagesPayload.push({ role: 'user', content: userMessage });

    // 5. Stream response from OpenAI and synthesize complete spoken response
    const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey || apiKey.includes('placeholder')) {
      const defaultText = `I hear you, ${profileContext?.fullName || 'User'}. How can I best guide your health goals today?`;
      onEvent({
        type: 'done',
        fullText: defaultText,
        metrics: { firstSentenceMs: 0, ttsDurationMs: 0, totalTurnMs: Date.now() - startTime }
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: messagesPayload,
        temperature: 0.3,
        max_tokens: 350,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      clearTimeout(timeoutId);
      throw new Error(`OpenAI stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onEvent({ type: 'text_chunk', text: delta });
            }
          } catch (e) {}
        }
      }
    }
    clearTimeout(timeoutId);

    const finalFullText = formatConversationalOutput(fullText.trim());
    const ttsStartMs = Date.now();
    const fullAudioBase64 = await synthesizeVoiceAudio(finalFullText);
    const ttsDurationMs = Date.now() - ttsStartMs;
    const totalTurnMs = Date.now() - startTime;

    if (fullAudioBase64) {
      onEvent({
        type: 'audio',
        audioBase64: fullAudioBase64,
        text: finalFullText,
        metrics: { firstSentenceMs: 0, ttsDurationMs, totalTurnMs }
      });
    }

    onEvent({
      type: 'done',
      fullText: finalFullText,
      audioBase64: fullAudioBase64 || undefined,
      metrics: {
        firstSentenceMs: 0,
        ttsDurationMs,
        totalTurnMs
      }
    });

    // 6. Asynchronous non-blocking Supabase persistence
    supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: COACH_ID,
        receiver_id: userId,
        content: finalFullText,
        message_type: 'text',
        metadata: {
          intent: classification.intent,
          format: classification.format,
          confidence: classification.confidence
        },
        created_at: new Date().toISOString()
      })
      .then();

    supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_content: finalFullText,
        last_message_type: 'text',
        last_message_sender_id: COACH_ID
      })
      .eq('id', conversationId)
      .then();

  } catch (err: any) {
    console.error('[ConversationOrchestrator] Stream error:', err);
    onEvent({
      type: 'error',
      error: err.message || 'Stream processing failed'
    });
  }
}

export async function processConversation(
  supabase: SupabaseClient,
  input: ProcessConversationInput
): Promise<ProcessConversationResult> {
  const { userId, conversationId, userMessage, locationContext, locale = 'en', voiceMode = false, sessionTurns } = input;

  try {
    const isShortGreeting = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|how are you doing|halo|hai|yo|greetings|howdy|sup)[\s!.?,]*$/i.test(userMessage.trim());

    // 1. Classify Intent
    const classification: IntentClassification = classifyIntentFast(userMessage);

    // 2. Dynamic Context Assembly based on flags (in voiceMode with non-greeting, include profile)
    let profileContext: UserProfileContext | null = null;
    let mealPlanContext: MealPlanContext | null = null;
    let budgetContext: BudgetContext | null = null;
    let affiliationContext: AffiliationRecord | null = null;
    let toolResults: ToolExecutionResult[] = [];

    const [
      profileRes,
      mealRes,
      budgetRes,
      affiliationRes,
      historyRes,
      toolsRes
    ] = isShortGreeting
      ? await Promise.all([
          loadUserProfileContext(supabase, userId),
          Promise.resolve(null),
          Promise.resolve(null),
          Promise.resolve(null),
          Promise.resolve([]),
          Promise.resolve([])
        ])
      : await Promise.all([
          loadUserProfileContext(supabase, userId),
          classification.requires_meal_plan ? loadMealPlanContext(supabase, userId) : Promise.resolve(null),
          classification.requires_budget_snapshot ? loadBudgetContext(supabase, userId) : Promise.resolve(null),
          classification.requires_affiliation_lookup ? loadAffiliationContext(supabase, classification.extracted_entity || userMessage) : Promise.resolve(null),
          loadRecentConversationHistory(supabase, conversationId, 4),
          (voiceMode && !classification.requires_external_search) ? Promise.resolve([]) : routeAndExecuteTools({ userMessage, locationContext })
        ]);

    profileContext = profileRes;
    mealPlanContext = mealRes;
    budgetContext = budgetRes;
    affiliationContext = affiliationRes;
    toolResults = toolsRes || [];

    // 3. Build Capability-Specific System Prompt
    const systemPrompt = buildSystemPrompt({
      classification,
      profileContext,
      mealPlanContext,
      budgetContext,
      affiliationContext,
      locationContext,
      locale,
      voiceMode,
      toolResults
    });

    // 4. Build Messages Payload with immediate multi-turn context
    const messagesPayload: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    const effectiveHistory = (sessionTurns && sessionTurns.length > 0)
      ? sessionTurns.slice(-6)
      : historyRes;

    for (const hist of effectiveHistory) {
      if (hist.content && hist.content.trim() && hist.content !== userMessage) {
        messagesPayload.push({
          role: hist.role === 'assistant' ? 'assistant' : 'user',
          content: hist.content
        });
      }
    }

    // Ensure the current user message is appended
    messagesPayload.push({ role: 'user', content: userMessage });

    // 5. Generate Model Response (Streaming First Sentence in Voice Mode)
    if (voiceMode) {
      const voiceResult = await generateStreamingVoiceTurn(messagesPayload, {
        maxTokens: 350,
        temperature: 0.3
      });

      const finalContent = formatConversationalOutput(voiceResult.fullText);

      // Fire-and-forget DB updates in background so voice response has 0ms DB latency
      supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: COACH_ID,
          receiver_id: userId,
          content: finalContent,
          message_type: 'text',
          metadata: {
            intent: classification.intent,
            format: classification.format,
            confidence: classification.confidence,
            latency: voiceResult.metrics
          },
          created_at: new Date().toISOString()
        })
        .then();

      supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_content: finalContent,
          last_message_type: 'text',
          last_message_sender_id: COACH_ID
        })
        .eq('id', conversationId)
        .then();

      return {
        success: true,
        content: finalContent,
        intent: classification.intent,
        format: classification.format,
        audioBase64: voiceResult.firstSentenceAudioBase64,
        metrics: voiceResult.metrics
      };
    }

    const rawAiReply = await generateModelReply(messagesPayload, {
      maxTokens: 600,
      temperature: 0.7
    });

    const finalContent = classification.format === 'conversation'
      ? formatConversationalOutput(rawAiReply)
      : rawAiReply;

    const [{ data: insertedMsg }] = await Promise.all([
      supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: COACH_ID,
          receiver_id: userId,
          content: finalContent,
          message_type: 'text',
          metadata: {
            intent: classification.intent,
            format: classification.format,
            confidence: classification.confidence
          },
          created_at: new Date().toISOString()
        })
        .select('id')
        .single(),
      supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_content: finalContent,
          last_message_type: 'text',
          last_message_sender_id: COACH_ID
        })
        .eq('id', conversationId)
    ]);

    return {
      success: true,
      messageId: insertedMsg?.id,
      content: finalContent,
      intent: classification.intent,
      format: classification.format
    };
  } catch (err: any) {
    console.error('[ConversationOrchestrator] Fatal error:', err);
    return {
      success: false,
      content: "I'm here with you. How can I help you right now?",
      intent: 'general_chat',
      format: 'conversation',
      error: err.message
    };
  }
}

function buildSystemPrompt(params: {
  classification: IntentClassification;
  profileContext: UserProfileContext | null;
  mealPlanContext: MealPlanContext | null;
  budgetContext: BudgetContext | null;
  affiliationContext: AffiliationRecord | null;
  locationContext: any;
  locale: string;
  voiceMode?: boolean;
  toolResults?: ToolExecutionResult[];
}): string {
  const { classification, profileContext, mealPlanContext, budgetContext, affiliationContext, locationContext, voiceMode, toolResults } = params;

  const now = new Date();
  const timeZone = locationContext?.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
  
  let formattedDate = now.toDateString();
  let formattedTime = now.toLocaleTimeString();
  try {
    formattedDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone
    }).format(now);
    formattedTime = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZone
    }).format(now);
  } catch (e) {
    // fallback
  }

  const resolvedUserName = profileContext?.fullName || 'User';
  let prompt = `You are Vee, the VICALARY Health Coach & Nutrition Companion.
You are having a direct, personal 1-on-1 conversation with ${resolvedUserName}.

Core Guidelines:
- You know ${resolvedUserName} personally. Address them naturally by name when appropriate.
- You communicate naturally, warmly, and conversationally.
- Never output artificial markdown headings (# or ##) or robotic templates unless the user explicitly requested a structured list.
- Keep responses concise, warm, and directly relevant.
- Do not provide formal medical diagnoses or prescribe medications; provide educational, supportive nutrition and wellness guidance.
- AI NEVER hallucinates facts: If asked about locations or company affiliations without verified data, state clearly what is known or unknown.

[Temporal Grounding]:
Current Date: ${formattedDate}
Current Time: ${formattedTime} (Timezone: ${timeZone})
Year: ${now.getFullYear()}
Rule: When asked about the date, day, month, time, or year, ALWAYS answer accurately based on the current date (${formattedDate}). Never mention past years like 2023.
`;

  if (voiceMode) {
    prompt += `\n[VOICE MODE - CRITICAL DIRECTIVES]:
- You are speaking directly to the user in a live audio conversation.
- Comprehensively answer all questions asked by the user in a cohesive, natural spoken manner. Do not drop, omit, or ignore parts of multi-part questions.
- Keep answers natural, warm, and conversational (typically 2 to 4 spoken sentences). Avoid robotic brevity or excessive length.
- NEVER use markdown, bullet points, asterisks, numbered lists, emoji headers, or code blocks.
- Speak naturally and confidently.
- If asked about allergies or dietary restrictions, state them directly from the profile immediately.
`;
  }

  if (profileContext) {
    prompt += `\n[User Profile & Onboarding Health Context]:
Name: ${profileContext.fullName || 'User'}
Primary Health Goal: ${profileContext.goal || 'General Health'}
Activity Level: ${profileContext.activityLevel || 'Moderate'}
Dietary Lifestyle & Preferences: ${profileContext.dietaryPreference || 'Standard'}
Allergies & Dietary Restrictions: ${profileContext.allergies && profileContext.allergies.length > 0 ? profileContext.allergies.join(', ') : 'None reported in profile'}
Medical & Health Conditions: ${profileContext.medicalConditions && profileContext.medicalConditions.length > 0 ? profileContext.medicalConditions.join(', ') : 'None reported'}
Daily Calorie Goal: ${profileContext.dailyCalorieGoal} kcal
Macro Target Breakdown: ${profileContext.macroGoals?.protein ? `Protein: ${profileContext.macroGoals.protein}g, Carbs: ${profileContext.macroGoals.carbs}g, Fat: ${profileContext.macroGoals.fat}g, Fiber: ${profileContext.macroGoals.fiber}g` : 'Standard balanced split'}
Liked Foods: ${profileContext.likedFoods && profileContext.likedFoods.length > 0 ? profileContext.likedFoods.join(', ') : 'All balanced whole foods'}
Preferred Cuisines: ${profileContext.preferredCuisines && profileContext.preferredCuisines.length > 0 ? profileContext.preferredCuisines.join(', ') : 'Varied / International'}
Cooking Skill: ${profileContext.cookingSkill || 'Intermediate'} | Meal Prep Time: ${profileContext.mealPrepTime || '30 mins'}
Instruction: When the user asks about their name, goals, calories, allergies, onboarding preferences, or health, ALWAYS answer accurately using the verified profile context above.
`;
  }

  if (mealPlanContext) {
    prompt += `\n[Today's Nutrition Context]:
Logged Calories Today: ${mealPlanContext.totalCaloriesLoggedToday} / ${mealPlanContext.calorieTarget} kcal
Logged Items: ${mealPlanContext.todaysMeals.map(m => `${m.foodName} (${m.calories} kcal)`).join(', ') || 'None yet'}
`;
  }

  if (budgetContext) {
    prompt += `\n[Food Budget Context]:
Daily Target: ${budgetContext.currency} ${budgetContext.dailyTarget}
Spent So Far: ${budgetContext.currency} ${budgetContext.spentSoFar}
Remaining: ${budgetContext.currency} ${budgetContext.remainingBudget}
Status: ${budgetContext.status}
`;
  }

  if (affiliationContext) {
    prompt += `\n[Verified Affiliation Data]:
Company: ${affiliationContext.companyName}
Parent Company: ${affiliationContext.parentCompany || 'None recorded'}
Affiliation Type: ${affiliationContext.affiliationType || 'Standard'}
US Affiliated: ${affiliationContext.usAffiliated}
Israel Affiliated: ${affiliationContext.israelAffiliated}
UAE Affiliated: ${affiliationContext.uaeAffiliated}
Notes/Evidence: ${affiliationContext.notes || 'None'}
Verification: ${affiliationContext.verificationStatus || 'Verified'}
Instruction: CITE ONLY the facts above. Do NOT invent parent companies or boycott affiliations.
`;
  } else if (classification.intent === 'affiliation_lookup') {
    prompt += `\n[Verified Affiliation Data]: No verified ownership record found in database for this query.
Instruction: State honestly that we do not have verified brand ownership or boycott data in our verified database. Do not guess.
`;
  }

  const resolvedCountry = locationContext?.country || 'Indonesia';
  const resolvedCity = locationContext?.city || '';
  const resolvedLocName = resolvedCity ? `${resolvedCity}, ${resolvedCountry}` : resolvedCountry;

  prompt += `\n[User Verified Location Context]:
Location: ${resolvedLocName} (Timezone: ${timeZone})
Instruction: When the user asks "what is my location" or "where am I located", ALWAYS answer directly that their verified location is ${resolvedLocName}. NEVER say you cannot access location data.\n`;

  const validTools = (toolResults || []).filter(t => t.success && t.data);
  if (validTools.length > 0) {
    prompt += `\n[Live External Knowledge & Tools Results]:\n`;
    for (const tool of validTools) {
      prompt += `- [${tool.toolName}]: ${tool.data}\n`;
    }
    prompt += `Instruction: Ground your reply in the verified live tool facts above. You HAVE active internet search tools; NEVER say you are cut off in 2023 or cannot search current events. Answer the user's question directly with these current facts.\n`;
  }

  return prompt;
}

interface VoiceTurnResult {
  fullText: string;
  firstSentenceAudioBase64?: string;
  metrics: {
    firstSentenceMs: number;
    ttsDurationMs: number;
    totalTurnMs: number;
  };
}

async function generateStreamingVoiceTurn(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { maxTokens?: number; temperature?: number }
): Promise<VoiceTurnResult> {
  const startTime = Date.now();
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey.includes('placeholder')) {
    return {
      fullText: "I am here with you. How can I help you today?",
      metrics: { firstSentenceMs: 0, ttsDurationMs: 0, totalTurnMs: 0 }
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 350,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI stream error: ${response.status} ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) fullText += delta;
          } catch (e) {}
        }
      }
    }

    const finalFullText = formatConversationalOutput(fullText.trim());
    const ttsStartMs = Date.now();
    const ttsAudio = await synthesizeVoiceAudio(finalFullText);
    const ttsDurationMs = Date.now() - ttsStartMs;
    const totalTurnMs = Date.now() - startTime;

    console.log(`[TTS] Audio synthesized in ${ttsDurationMs}ms (Total turn latency: ${totalTurnMs}ms)`);

    return {
      fullText: finalFullText || "I'm listening. How can I help you today?",
      firstSentenceAudioBase64: ttsAudio || undefined,
      metrics: {
        firstSentenceMs: 0,
        ttsDurationMs,
        totalTurnMs
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateModelReply(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey.includes('placeholder')) {
    return "I am here with you to support your health and nutrition journey. How can I help you today?";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 600
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm listening. How can I help you right now?";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function synthesizeVoiceAudio(text: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) return null;

  try {
    const spokenText = formatForSpeech(text).slice(0, 1500);
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'nova',
        input: spokenText,
        speed: 1.05,
      }),
    });

    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:audio/mp3;base64,${base64}`;
  } catch (err) {
    console.warn('[ConversationOrchestrator] Server TTS error:', err);
    return null;
  }
}
