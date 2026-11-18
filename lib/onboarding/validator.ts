/**
 * Onboarding Completeness & Vague-Answer Validator
 *
 * Deterministically checks each onboarding question to identify skipped,
 * missing, or vague responses, and resolves the exact question step that
 * needs user attention.
 */

export const ONBOARDING_QUESTION_KEYS = [
  'full_name',          // 0: text
  'age',                // 1: age selector
  'gender',             // 2: radio
  'height_cm',          // 3: slider
  'weight_kg',          // 4: slider
  'goal',               // 5: radio
  'activity_level',     // 6: radio
  'sleep_duration',     // 7: slider
  'sleep_quality',      // 8: radio
  'stress_level',       // 9: radio
  'dietary_preference', // 10: radio
  'dietary_lifestyle',  // 11: checkbox
  'medical_conditions', // 12: text
  'allergies',          // 13: text
  'meal_prep_time',     // 14: radio
  'cooking_skill',      // 15: radio
  'weekly_budget',      // 16: slider
  'daily_reminders',    // 17: radio
] as const;

export type OnboardingQuestionKey = typeof ONBOARDING_QUESTION_KEYS[number];

const VAGUE_TEXT_PLACEHOLDERS = new Set([
  '',
  '-',
  '--',
  '?',
  '???',
  'n/a',
  'na',
  'none',
  'no',
  'nil',
  'null',
  'undefined',
  'skip',
  'skipped',
  'test',
  'testing',
  'asdf',
  'xyz',
  'abc',
  'idk',
  'dont know',
  "don't know",
]);

/**
 * Checks whether a single onboarding answer is missing, skipped, or too vague.
 */
export function isQuestionIncompleteOrVague(key: string, value: any): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  switch (key) {
    case 'full_name': {
      if (typeof value !== 'string') return true;
      const trimmed = value.trim();
      if (trimmed.length < 2) return true;
      if (VAGUE_TEXT_PLACEHOLDERS.has(trimmed.toLowerCase())) return true;
      return false;
    }

    case 'age': {
      const num = Number(value);
      if (isNaN(num) || num <= 0) return true;
      // Realistic human bounds
      if (num < 13 || num > 110) return true;
      return false;
    }

    case 'gender': {
      if (typeof value !== 'string') return true;
      return value.trim().length === 0;
    }

    case 'height_cm': {
      const num = Number(value);
      if (isNaN(num) || num <= 0) return true;
      if (num < 50 || num > 250) return true;
      return false;
    }

    case 'weight_kg': {
      const num = Number(value);
      if (isNaN(num) || num <= 0) return true;
      if (num < 20 || num > 300) return true;
      return false;
    }

    case 'goal':
    case 'activity_level':
    case 'sleep_quality':
    case 'stress_level':
    case 'dietary_preference':
    case 'meal_prep_time':
    case 'cooking_skill':
    case 'daily_reminders': {
      if (typeof value !== 'string') return true;
      return value.trim().length === 0;
    }

    case 'sleep_duration': {
      const num = Number(value);
      if (isNaN(num) || num <= 0) return true;
      if (num < 2 || num > 18) return true;
      return false;
    }

    case 'dietary_lifestyle': {
      if (!Array.isArray(value)) {
        if (typeof value === 'string' && value.trim().length > 0) return false;
        return true;
      }
      return value.length === 0;
    }

    case 'medical_conditions':
    case 'allergies': {
      // For medical conditions and allergies, explicit "none", "no allergies", "healthy" is a valid answer.
      // But if empty, null, or undefined, it's considered uncompleted/skipped.
      if (typeof value !== 'string') return true;
      const trimmed = value.trim();
      return trimmed.length === 0;
    }

    case 'weekly_budget':
    case 'budget': {
      const num = Number(value);
      if (isNaN(num) || num <= 0) return true;
      return false;
    }

    default:
      return value === '' || value === undefined || value === null;
  }
}

/**
 * Returns an array of question keys that are missing or vague, in onboarding order.
 */
export function getMissingOrVagueQuestions(responses: Record<string, any> = {}): OnboardingQuestionKey[] {
  const missing: OnboardingQuestionKey[] = [];
  for (const key of ONBOARDING_QUESTION_KEYS) {
    // If weekly_budget is checked, also accept `budget` (monthly) if > 0
    if (key === 'weekly_budget') {
      const hasWeekly = !isQuestionIncompleteOrVague('weekly_budget', responses.weekly_budget);
      const hasMonthly = !isQuestionIncompleteOrVague('budget', responses.budget);
      if (!hasWeekly && !hasMonthly) {
        missing.push(key);
      }
      continue;
    }

    if (isQuestionIncompleteOrVague(key, responses[key])) {
      missing.push(key);
    }
  }
  return missing;
}

/**
 * Returns the key of the first missing or vague onboarding question, or null if all are complete.
 */
export function getFirstIncompleteQuestion(responses: Record<string, any> = {}): OnboardingQuestionKey | null {
  const missing = getMissingOrVagueQuestions(responses);
  return missing.length > 0 ? missing[0] : null;
}

/**
 * Resolves the 0-indexed step number for a given question key.
 * Returns -1 if the key is unknown.
 */
export function getQuestionIndexByKey(key: string): number {
  return ONBOARDING_QUESTION_KEYS.indexOf(key as OnboardingQuestionKey);
}
