export type ConversationIntent =
  | 'meal_question'
  | 'product_analysis'
  | 'medicine_inquiry'
  | 'budget_status'
  | 'affiliation_lookup'
  | 'spiritual_guidance'
  | 'location_inquiry'
  | 'general_chat';

export type OutputFormat = 'conversation' | 'structured_json';

export interface IntentClassification {
  intent: ConversationIntent;
  confidence: number;
  requires_user_profile: boolean;
  requires_meal_plan: boolean;
  requires_budget_snapshot: boolean;
  requires_affiliation_lookup: boolean;
  requires_external_search: boolean;
  format: OutputFormat;
  extracted_entity?: string | null;
}

const INTENT_RULES: Array<{
  intent: ConversationIntent;
  patterns: RegExp[];
  flags: Omit<IntentClassification, 'intent' | 'confidence'>;
}> = [
  {
    intent: 'affiliation_lookup',
    patterns: [
      /\b(boycott|israel|ownership|parent company|who owns|affiliated with|subsidiary|brand of|bdsmovement|bds)\b/i,
      /\b(is .* (boycotted|israeli|safe|halal|affiliated))\b/i
    ],
    flags: {
      requires_user_profile: false,
      requires_meal_plan: false,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: true,
      requires_external_search: false,
      format: 'conversation'
    }
  },
  {
    intent: 'budget_status',
    patterns: [
      /\b(budget|spending|spent|bank balance|money|expenses|afford|cost of food|financial)\b/i,
      /\b(how much did i spend|what is my budget|remaining budget)\b/i
    ],
    flags: {
      requires_user_profile: true,
      requires_meal_plan: false,
      requires_budget_snapshot: true,
      requires_affiliation_lookup: false,
      requires_external_search: false,
      format: 'conversation'
    }
  },
  {
    intent: 'medicine_inquiry',
    patterns: [
      /\b(medicine|medication|pill|dose|dosage|drug|prescription|side effect|pharma|supplement)\b/i,
      /\b(can i take .* with|paracetamol|ibuprofen|amoxicillin|metformin|aspirin)\b/i
    ],
    flags: {
      requires_user_profile: true,
      requires_meal_plan: false,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: false,
      requires_external_search: false,
      format: 'conversation'
    }
  },
  {
    intent: 'meal_question',
    patterns: [
      /\b(meal|recipe|cook|dinner|lunch|breakfast|snack|eat|food|calories|macros|protein|diet|nutrition|ingredients|hungry)\b/i,
      /\b(what should i eat|suggest a meal|healthy recipe|macro breakdown)\b/i,
      /\b(allergy|allergies|allergic|intolerance|restriction|restrictions|my goal|my profile|my health)\b/i
    ],
    flags: {
      requires_user_profile: true,
      requires_meal_plan: true,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: false,
      requires_external_search: false,
      format: 'conversation'
    }
  },
  {
    intent: 'product_analysis',
    patterns: [
      /\b(barcode|product|scan|nutrition label|ingredients of|is .* healthy|calories in)\b/i
    ],
    flags: {
      requires_user_profile: true,
      requires_meal_plan: false,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: true,
      requires_external_search: false,
      format: 'conversation'
    }
  },
  {
    intent: 'spiritual_guidance',
    patterns: [
      /\b(prayer|quran|hadith|dua|namaz|salat|islamic|verse|fasting|ramadan|spiritual|dhikr|bismillah|alhamdulillah)\b/i
    ],
    flags: {
      requires_user_profile: true,
      requires_meal_plan: false,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: false,
      requires_external_search: false,
      format: 'conversation'
    }
  },
  {
    intent: 'location_inquiry',
    patterns: [
      /\b(nearest|nearby|supermarket|grocery store|restaurant|where to buy|halal store|market near me)\b/i
    ],
    flags: {
      requires_user_profile: false,
      requires_meal_plan: false,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: false,
      requires_external_search: true,
      format: 'conversation'
    }
  }
];

export function classifyIntentFast(message: string): IntentClassification {
  const text = (message || '').trim();
  if (!text) {
    return {
      intent: 'general_chat',
      confidence: 1.0,
      requires_user_profile: false,
      requires_meal_plan: false,
      requires_budget_snapshot: false,
      requires_affiliation_lookup: false,
      requires_external_search: false,
      format: 'conversation',
      extracted_entity: null
    };
  }

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          intent: rule.intent,
          confidence: 0.95,
          ...rule.flags,
          extracted_entity: extractEntityCandidate(text, rule.intent)
        };
      }
    }
  }

  return {
    intent: 'general_chat',
    confidence: 0.85,
    requires_user_profile: true,
    requires_meal_plan: false,
    requires_budget_snapshot: false,
    requires_affiliation_lookup: false,
    requires_external_search: false,
    format: 'conversation',
    extracted_entity: null
  };
}

function extractEntityCandidate(text: string, intent: ConversationIntent): string | null {
  if (intent === 'affiliation_lookup' || intent === 'product_analysis') {
    const brandMatch = text.match(/(?:who owns|is|boycott|check|about)\s+([A-Za-z0-9\s'-]+?)(?:\s+(?:boycotted|israeli|affiliated|halal|safe|\?|$))/i);
    if (brandMatch && brandMatch[1]) {
      return brandMatch[1].trim();
    }
  }
  return null;
}
