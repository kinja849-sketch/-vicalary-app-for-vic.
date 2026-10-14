/**
 * VoiceResponseCache.ts
 *
 * Predefined, context-aware fast-path response library and client-side audio cache
 * for common conversational courtesies, presence checks, and routine acknowledgments.
 *
 * Never intercepts substantive culinary or health queries (nutrition, ingredients,
 * steps, calories, health goals, allergies, medications, etc.).
 */

export interface CachedRoutineReply {
  text: string;
  category: 'greeting' | 'presence_check' | 'courtesy';
}

const CHEF_ROUTINE_RESPONSES: Record<string, string> = {
  greeting: "Hello! I'm Chef Vic. I'm right here with you—what can I help you cook?",
  presence: "Yes, I'm right here listening! How is the cooking going?",
  thanks: "You're very welcome! Let me know if you need anything else for this step.",
  ready: "Great! Whenever you're ready, let me know or take a photo to continue.",
};

const COACH_ROUTINE_RESPONSES: Record<string, string> = {
  greeting: "Hello! Great to connect with you. How are you feeling today?",
  presence: "Yes, I'm here and listening! What's on your mind?",
  thanks: "You're very welcome! I'm always here to support your health journey.",
};

// Patterns that MUST NOT be intercepted because they need dynamic AI domain knowledge
const DOMAIN_SAFETY_GATE = /\b(calorie|calories|macro|macros|protein|carb|carbs|fat|fats|gram|grams|weight|step|next step|ingredient|ingredients|oil|pepper|salt|butter|cook|bake|fry|boil|temperature|substitute|substitution|allergy|allergies|allergic|diet|diabetes|pressure|blood|medicine|medication|pill|dose|photo|verify|timer|how much|how many|what do i do|what should i)\b/i;

const GREETING_PATTERN = /^(hi|hello|hey|good morning|good afternoon|good evening|hey vic|hello chef|hi chef|halo|hola)[\s!.]*$/i;
const PRESENCE_PATTERN = /^(are you there|can you hear me|you there|are you listening|hello are you there|test)[\s!?.]*$/i;
const COURTESY_PATTERN = /^(thank you|thanks|thank you very much|thanks a lot|thanks chef|thank you chef)[\s!.]*$/i;

/**
 * Checks if a user's utterance can be safely handled by the zero-latency routine cache.
 * Returns null if the query requires live agent reasoning.
 */
export function getRoutineVoiceResponse(
  query: string,
  agent: 'chef' | 'coach'
): CachedRoutineReply | null {
  const clean = (query || '').trim().toLowerCase();
  if (!clean || clean.length < 2) return null;

  // Never intercept if the user mentions actual food, ingredients, health metrics or instructions
  if (DOMAIN_SAFETY_GATE.test(clean)) {
    return null;
  }

  const responses = agent === 'chef' ? CHEF_ROUTINE_RESPONSES : COACH_ROUTINE_RESPONSES;

  if (GREETING_PATTERN.test(clean)) {
    return { text: responses.greeting, category: 'greeting' };
  }

  if (PRESENCE_PATTERN.test(clean)) {
    return { text: responses.presence, category: 'presence_check' };
  }

  if (COURTESY_PATTERN.test(clean)) {
    return { text: responses.thanks, category: 'courtesy' };
  }

  return null;
}

/**
 * In-memory client audio blob cache to eliminate TTS latency for repeated routine replies.
 */
const audioBlobCache = new Map<string, string>();

export function getCachedAudioUrl(text: string): string | null {
  return audioBlobCache.get(text.trim()) || null;
}

export function setCachedAudioUrl(text: string, url: string): void {
  if (text && url) {
    audioBlobCache.set(text.trim(), url);
  }
}
