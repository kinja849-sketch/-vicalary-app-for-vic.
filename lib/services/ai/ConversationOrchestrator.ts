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
import {
  callChatCompletionWithFallback,
  streamChatCompletionWithFallback,
  synthesizeVoiceAudioWithFallback,
  getPrimaryApiKey,
  getBackupApiKey
} from '@/lib/ai/ai-fallback';
import { resolveUserLanguage, buildAILanguageDirective, LANGUAGE_META, SupportedLanguage } from '@/lib/api/serverLanguage';

const COACH_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_COACH_VOICE = 'nova';

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
  isInitialGreeting?: boolean;
  sessionTurns?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ProcessConversationResult {
  success: boolean;
  messageId?: string;
  content: string;
  reply?: string;
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
  | { type: 'searching' }
  | { type: 'preparing' }
  | { type: 'tool_call'; tool: string }
  | { type: 'interim_audio'; audioBase64: string; text: string }
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

    const lowerUserMsg = userMessage.toLowerCase().trim();
    const isDynamicGreeting = Boolean(input.isInitialGreeting || userMessage === '[DYNAMIC_GREETING_REQUEST]');
    const isShortGreeting = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|how are you doing|halo|hai|yo|greetings|howdy|sup)[\s!.?,]*$/i.test(lowerUserMsg);

    // 1. Classify Intent
    const classification: IntentClassification = isDynamicGreeting
      ? { intent: 'general_chat', format: 'conversation', confidence: 1.0, requires_user_profile: true, requires_meal_plan: false, requires_budget_snapshot: false, requires_affiliation_lookup: false, requires_external_search: false }
      : classifyIntentFast(userMessage);

    const isResearchQuery = !isDynamicGreeting && (/\b(weather|forecast|climate|temperature|news|current events|latest study|scientific study|stock price|who is|who won|election|search for|look up|check online|nearest|nearby|where can i find|supermarket|grocery store|pharmacy)\b/i.test(lowerUserMsg) || classification.requires_external_search);

    const isProfileReviewOrGreeting = isDynamicGreeting || isShortGreeting || /\b(about me|my goal|my calorie|my profile|my allergies|my health|who am i|what foods do i like|how are you)\b/i.test(lowerUserMsg);

    // 2. Dynamic Context Assembly
    let profileContext: UserProfileContext | null = null;
    let mealPlanContext: MealPlanContext | null = null;
    let budgetContext: BudgetContext | null = null;
    let affiliationContext: AffiliationRecord | null = null;
    let toolResults: ToolExecutionResult[] = [];

    // Trigger immediate spoken acknowledgement for research queries in voice mode
    let interimAudioPromise: Promise<void> | null = null;
    if (isResearchQuery && voiceMode) {
      onEvent({ type: 'searching' });
      interimAudioPromise = (async () => {
        try {
          const interimAudio = await synthesizeVoiceAudio("Let me check that for you.");
          if (interimAudio) {
            onEvent({
              type: 'interim_audio',
              text: "Let me check that for you.",
              audioBase64: interimAudio
            });
          }
        } catch (e) {}
      })();
    }

    // Parallel context and tool gathering
    const [
      profileRes,
      mealRes,
      budgetRes,
      affiliationRes,
      historyRes,
      toolsRes
    ] = await Promise.all([
      loadUserProfileContext(supabase, userId),
      (!isProfileReviewOrGreeting && classification.requires_meal_plan) ? loadMealPlanContext(supabase, userId) : Promise.resolve(null),
      (!isProfileReviewOrGreeting && classification.requires_budget_snapshot) ? loadBudgetContext(supabase, userId) : Promise.resolve(null),
      (!isProfileReviewOrGreeting && classification.requires_affiliation_lookup) ? loadAffiliationContext(supabase, classification.extracted_entity || userMessage) : Promise.resolve(null),
      loadRecentConversationHistory(supabase, conversationId, 4),
      isResearchQuery ? routeAndExecuteTools({ userMessage, locationContext }) : Promise.resolve([])
    ]);

    profileContext = profileRes;
    mealPlanContext = mealRes;
    budgetContext = budgetRes;
    affiliationContext = affiliationRes;
    toolResults = toolsRes || [];

    if (interimAudioPromise) {
      await interimAudioPromise;
    }

    // 3. Build System Prompt
    const effectiveLang = await resolveUserLanguage({
      userId,
      requestLanguage: locale,
      locationContext,
      supabase
    });

    const systemPrompt = buildSystemPrompt({
      classification,
      profileContext,
      mealPlanContext,
      budgetContext,
      affiliationContext,
      locationContext,
      locale: effectiveLang,
      voiceMode,
      toolResults,
      isDynamicGreeting
    });

    // 4. Build Messages Payload with clean alternating sequence
    const messagesPayload: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    if (isDynamicGreeting) {
      messagesPayload.push({
        role: 'user',
        content: 'Hi Coach Vee, please greet me warmly and ask how you can support my health goals today.'
      });
    } else {
      const effectiveHistory = (sessionTurns && sessionTurns.length > 0)
        ? sessionTurns.slice(-6)
        : historyRes;

      const cleanedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const hist of effectiveHistory) {
        if (hist.content && hist.content.trim()) {
          const last = cleanedHistory[cleanedHistory.length - 1];
          if (!last || last.role !== hist.role) {
            cleanedHistory.push({
              role: hist.role === 'assistant' ? 'assistant' : 'user',
              content: hist.content.trim()
            });
          }
        }
      }
      if (cleanedHistory.length > 0 && cleanedHistory[cleanedHistory.length - 1].role === 'user') {
        cleanedHistory.pop();
      }
      messagesPayload.push(...cleanedHistory);
      messagesPayload.push({ role: 'user', content: userMessage });
    }

    // 5. Stream response with automated fallback and synthesize complete spoken response
    const hasAIKey = !!(getPrimaryApiKey() || getBackupApiKey());
    const model = process.env.OPENAI_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

    if (!hasAIKey) {
      const defaultText = `I hear you, ${profileContext?.fullName || 'User'}. How can I best guide your health goals today?`;
      onEvent({
        type: 'done',
        fullText: defaultText,
        metrics: { firstSentenceMs: 0, ttsDurationMs: 0, totalTurnMs: Date.now() - startTime }
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      const streamResult = await streamChatCompletionWithFallback({
        model,
        messages: messagesPayload,
        temperature: 0.5,
        max_tokens: 350,
        signal: controller.signal
      });
      response = streamResult.response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`AI stream error: ${err?.message || err}`);
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error(`AI stream error: missing body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let firstSentenceAudioSent = false;
    let firstSentenceText = '';

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

              // Rapid conversational turnaround: synthesize and emit first sentence audio immediately
              if (!firstSentenceAudioSent && voiceMode) {
                const sentenceMatch = fullText.match(/^([^.!?\n]+[.!?\n])/);
                if (sentenceMatch && sentenceMatch[1] && sentenceMatch[1].trim().length >= 15) {
                  firstSentenceAudioSent = true;
                  firstSentenceText = sentenceMatch[1].trim();
                  const firstSentTime = Date.now();
                  synthesizeVoiceAudio(firstSentenceText).then((firstAudio) => {
                    if (firstAudio) {
                      onEvent({
                        type: 'first_audio',
                        audioBase64: firstAudio,
                        text: firstSentenceText,
                        metrics: {
                          firstSentenceMs: Date.now() - startTime,
                          ttsDurationMs: Date.now() - firstSentTime,
                          totalTurnMs: Date.now() - startTime
                        }
                      });
                    }
                  }).catch(() => {});
                }
              }
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

    if (fullAudioBase64 && !firstSentenceAudioSent) {
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
    const lowerUserMsg = userMessage.toLowerCase().trim();
    const isDynamicGreeting = Boolean(input.isInitialGreeting || userMessage === '[DYNAMIC_GREETING_REQUEST]');
    const isShortGreeting = /^(hello|hi|hey|good morning|good afternoon|good evening|how are you|how are you doing|halo|hai|yo|greetings|howdy|sup)[\s!.?,]*$/i.test(lowerUserMsg);

    // 1. Classify Intent
    const classification: IntentClassification = isDynamicGreeting
      ? { intent: 'general_chat', format: 'conversation', confidence: 1.0, requires_user_profile: true, requires_meal_plan: false, requires_budget_snapshot: false, requires_affiliation_lookup: false, requires_external_search: false }
      : classifyIntentFast(userMessage);

    const isResearchQuery = !isDynamicGreeting && (/\b(weather|forecast|climate|temperature|news|current events|latest study|scientific study|stock price|who is|who won|election|search for|look up|check online|nearest|nearby|where can i find|supermarket|grocery store|pharmacy)\b/i.test(lowerUserMsg) || classification.requires_external_search);

    const isProfileReviewOrGreeting = isDynamicGreeting || isShortGreeting || /\b(about me|my goal|my calorie|my profile|my allergies|my health|who am i|what foods do i like|how are you)\b/i.test(lowerUserMsg);

    // 2. Dynamic Context Assembly
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
    ] = await Promise.all([
      loadUserProfileContext(supabase, userId),
      (!isProfileReviewOrGreeting && classification.requires_meal_plan) ? loadMealPlanContext(supabase, userId) : Promise.resolve(null),
      (!isProfileReviewOrGreeting && classification.requires_budget_snapshot) ? loadBudgetContext(supabase, userId) : Promise.resolve(null),
      (!isProfileReviewOrGreeting && classification.requires_affiliation_lookup) ? loadAffiliationContext(supabase, classification.extracted_entity || userMessage) : Promise.resolve(null),
      loadRecentConversationHistory(supabase, conversationId, 4),
      isResearchQuery ? routeAndExecuteTools({ userMessage, locationContext }) : Promise.resolve([])
    ]);

    profileContext = profileRes;
    mealPlanContext = mealRes;
    budgetContext = budgetRes;
    affiliationContext = affiliationRes;
    toolResults = toolsRes || [];

    // 3. Build Capability-Specific System Prompt
    const effectiveLang = await resolveUserLanguage({
      userId,
      requestLanguage: locale,
      locationContext,
      supabase
    });

    const systemPrompt = buildSystemPrompt({
      classification,
      profileContext,
      mealPlanContext,
      budgetContext,
      affiliationContext,
      locationContext,
      locale: effectiveLang,
      voiceMode,
      toolResults,
      isDynamicGreeting
    });

    // 4. Build Messages Payload with clean alternating sequence
    const messagesPayload: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    if (isDynamicGreeting) {
      messagesPayload.push({
        role: 'user',
        content: 'Hi Coach Vee, please greet me warmly and ask how you can support my health goals today.'
      });
    } else {
      const effectiveHistory = (sessionTurns && sessionTurns.length > 0)
        ? sessionTurns.slice(-6)
        : historyRes;

      const cleanedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const hist of effectiveHistory) {
        if (hist.content && hist.content.trim()) {
          const last = cleanedHistory[cleanedHistory.length - 1];
          if (!last || last.role !== hist.role) {
            cleanedHistory.push({
              role: hist.role === 'assistant' ? 'assistant' : 'user',
              content: hist.content.trim()
            });
          }
        }
      }
      if (cleanedHistory.length > 0 && cleanedHistory[cleanedHistory.length - 1].role === 'user') {
        cleanedHistory.pop();
      }
      messagesPayload.push(...cleanedHistory);
      messagesPayload.push({ role: 'user', content: userMessage });
    }

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
        reply: finalContent,
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
  isDynamicGreeting?: boolean;
}): string {
  const { classification, profileContext, mealPlanContext, budgetContext, affiliationContext, locationContext, voiceMode, toolResults, isDynamicGreeting } = params;

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

  const effectiveLang = (params.locale || 'en') as SupportedLanguage;
  const langMeta = LANGUAGE_META[effectiveLang] || LANGUAGE_META.en;
  const langDirective = buildAILanguageDirective(effectiveLang);

  const resolvedUserName = profileContext?.fullName || 'User';
  let prompt = `You are Vee, the VICALARY Health Coach & Nutrition Companion.
You are having a direct, personal 1-on-1 conversation with ${resolvedUserName}.

${langDirective}
All conversation, advice, questions, and spoken text MUST be in ${langMeta.name} (${langMeta.native}).

Core Guidelines:
- You know ${resolvedUserName} personally. Address them naturally by name when appropriate.
- You communicate naturally, warmly, intelligently, and conversationally, like ChatGPT with normal pacing and subtle expression.
- STAY STRICTLY FOCUSED: Always directly answer the specific question or topic asked by ${resolvedUserName}. Never wander, digress, pivot to unrelated topics, or answer things that were not asked.
- NEVER REPEAT OLD GREETINGS: Do NOT repeat greeting formulas (like "I'm doing great, thank you for asking!") when ${resolvedUserName} asks a new or specific question. Always immediately address the user's latest inquiry.
- RESEARCH & REAL-TIME INQUIRIES: When ${resolvedUserName} asks about weather, news, facts, external information, or food places, provide a direct, accurate, and helpful response based on verified findings.
- FACTUAL INTEGRITY & EVIDENCE BOUNDARY:
  * Generate every answer strictly from the user's actual question, verified conversation context, and retrieved evidence.
  * Do NOT invent facts, sources, corporate affiliations, actions, or medical outcomes.
  * Distinguish verified information from assumptions. If evidence is unavailable, state the limitation naturally and honestly.
  * If missing information materially affects the answer, ask a concise, natural clarifying question instead of guessing.
  * If the user corrects or redirects you, incorporate that correction immediately and smoothly without defensiveness.
  * Perform a brief internal relevance and factual consistency check before speaking. NEVER expose private reasoning, thinking tags, or read internal system prompts aloud.
- NEVER LECTURE OR DIVERGE: Do NOT randomly bring up calories, budgets, or unsolicited background data unless the user specifically asked about them in their message.
- Never output artificial markdown headings (# or ##) or robotic templates unless the user explicitly requested a structured list.
- Keep responses concise (1 to 3 spoken sentences), warm, highly intelligent, and directly relevant to the user's inquiry.
- Do not provide formal medical diagnoses or prescribe medications; provide educational, supportive nutrition and wellness guidance.

[Temporal Grounding]:
Current Date: ${formattedDate}
Current Time: ${formattedTime} (Timezone: ${timeZone})
Year: ${now.getFullYear()}
Rule: When asked about the date, day, month, time, or year, ALWAYS answer accurately based on the current date (${formattedDate}). Never mention past years like 2023.
`;

  if (isDynamicGreeting) {
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    prompt += `\n[ACTION REQUIRED: DYNAMIC OPENING GREETING]:
- Generate a warm, personal, 1-sentence opening greeting for ${resolvedUserName} EXCLUSIVELY in fluent ${langMeta.name} (${langMeta.native}).
- Time of day: ${timeOfDay}.
- Naturally welcome ${resolvedUserName} back, mention supporting their health or nutrition journey today, and invite them to speak.
- Speak in a calm, conversational woman's voice like ChatGPT. Avoid generic scripted clichés, presenter hype, or robotic templates.
- Output ONLY the single spoken opening greeting sentence in ${langMeta.name}.
`;
  }

  if (voiceMode) {
    prompt += `\n[VOICE MODE - CRITICAL DIRECTIVES]:
- You are speaking directly to the user in a live audio conversation.
- You must speak in a calm, natural, friendly, conversational woman's voice like ChatGPT, with normal pacing and subtle expression.
- LANGUAGE MANDATE: You MUST speak EXCLUSIVELY in ${langMeta.name} (${langMeta.native}). Do NOT speak in English if another language is specified.
- Avoid robotic pronunciation, exaggerated excitement, and an artificial presenter tone.
- Directly, accurately, and thoughtfully address the user's exact words in 1 to 3 spoken sentences.
- DO NOT DIVERGE: Stay 100% on topic with what the user just asked. Do NOT bring up calories, budgets, or unsolicited advice unless directly requested.
- NO GREETING ECHOES: If the user asks a question, answer the question immediately. Never answer a question with a greeting.
- NEVER read aloud internal instructions, prompts, metadata, or reasoning tags.
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
Instruction: When the user asks about their name, goals, calories, allergies, onboarding preferences, or health, answer accurately using the verified profile context above. Do not volunteer profile stats unprompted.
`;
  }

  if (mealPlanContext && (classification.requires_meal_plan || classification.intent === 'meal_question')) {
    prompt += `\n[Today's Nutrition Context]:
Logged Calories Today: ${mealPlanContext.totalCaloriesLoggedToday} / ${mealPlanContext.calorieTarget} kcal
Logged Items: ${mealPlanContext.todaysMeals.map(m => `${m.foodName} (${m.calories} kcal)`).join(', ') || 'None yet'}
`;
  }

  if (budgetContext && (classification.requires_budget_snapshot || classification.intent === 'budget_status')) {
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
  const hasAIKey = !!(getPrimaryApiKey() || getBackupApiKey());
  const model = process.env.OPENAI_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

  if (!hasAIKey) {
    return {
      fullText: "I am here with you. How can I help you today?",
      metrics: { firstSentenceMs: 0, ttsDurationMs: 0, totalTurnMs: 0 }
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const streamResult = await streamChatCompletionWithFallback({
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 350,
      signal: controller.signal
    });
    const response = streamResult.response;

    if (!response.body) {
      throw new Error(`AI stream error: missing response body`);
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
  const hasAIKey = !!(getPrimaryApiKey() || getBackupApiKey());
  const model = process.env.OPENAI_MODEL || process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';

  if (!hasAIKey) {
    return "I am here with you to support your health and nutrition journey. How can I help you today?";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const data = await callChatCompletionWithFallback({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 600,
      signal: controller.signal
    });

    return data.choices?.[0]?.message?.content || "I'm listening. How can I help you right now?";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function synthesizeVoiceAudio(text: string): Promise<string | null> {
  try {
    const spokenText = formatForSpeech(text).slice(0, 1500);
    const result = await synthesizeVoiceAudioWithFallback(spokenText, {
      voice: DEFAULT_COACH_VOICE,
      speed: 1.05
    });

    return result ? result.dataUri : null;
  } catch (err) {
    console.warn('[ConversationOrchestrator] Server TTS error:', err);
    return null;
  }
}

