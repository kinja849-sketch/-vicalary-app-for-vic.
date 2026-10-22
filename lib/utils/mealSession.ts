/**
 * Meal Session Utility
 * Provides canonical, timezone-aware calculation for meal sessions:
 * - Breakfast: 04:00 - 10:59 (4 AM - 10:59 AM)
 * - Lunch:     11:00 - 15:59 (11 AM - 3:59 PM)
 * - Dinner:    16:00 - 03:59 (4 PM - 3:59 AM)
 */

export type MealSession = 'breakfast' | 'lunch' | 'dinner';

/**
 * Determines the authoritative meal session from an integer hour (0-23).
 */
export function getMealSessionFromHour(hour: number): MealSession {
  const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalizedHour >= 4 && normalizedHour < 11) {
    return 'breakfast';
  }
  if (normalizedHour >= 11 && normalizedHour < 16) {
    return 'lunch';
  }
  return 'dinner';
}

/**
 * Robustly extracts the current hour (0-23) in a specific timezone using
 * Intl.DateTimeFormat formatToParts, avoiding any locale-dependent string parsing bugs.
 */
export function getUserLocalHour(timeZone?: string): number {
  try {
    const tz = timeZone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined);
    if (!tz) return new Date().getHours();

    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: tz
    }).formatToParts(new Date());

    const hourPart = parts.find(p => p.type === 'hour')?.value;
    if (hourPart !== undefined) {
      const parsed = parseInt(hourPart, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
        return parsed;
      }
    }
    return new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

/**
 * Returns whether a given meal category is the currently active main meal session.
 * Non-main categories ('snacks', 'drinks', 'desserts') are always considered accessible.
 */
export function isMealCategoryActive(category: string, currentSession: MealSession): boolean {
  const lower = category.toLowerCase().trim();
  if (lower === 'breakfast' || lower === 'lunch' || lower === 'dinner') {
    return lower === currentSession;
  }
  return true;
}
