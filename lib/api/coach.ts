import { supabase } from '../supabase';
import { getDailyProgress } from './progress';
import { provisionAndSendMessage } from './chat';
import { detectLocation } from './location';

const COACH_ID = '00000000-0000-0000-0000-000000000001';

export async function generateDailySummary(userId: string, targetDate?: string) {
  try {
    // Use user's local date if possible, fallback to UTC
    let date = targetDate;
    if (!date) {
        try {
            const loc = await detectLocation();
            const tz = loc?.timezone || 'UTC';
            date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); // YYYY-MM-DD
        } catch (e) {
            date = new Date().toISOString().split('T')[0];
        }
    }
    
    // 1. Check if summary already sent for this date to avoid spam
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('sender_id', COACH_ID)
      .eq('metadata->>type', 'daily_summary')
      .eq('metadata->>date', date)
      .limit(1);

    if (existing && existing.length > 0) return;

    // 2. Fetch all-round progress
    const [progress, { data: usage }, { data: spiritual }] = await Promise.all([
      getDailyProgress(userId, date),
      (supabase.from('system_logs') as any).select('*').eq('user_id', userId).gte('created_at', date + 'T00:00:00Z').lte('created_at', date + 'T23:59:59Z'),
      (supabase.from('user_spiritual_history') as any).select('*').eq('user_id', userId).gte('viewed_at', date + 'T00:00:00Z').lte('viewed_at', date + 'T23:59:59Z')
    ]);

    if (!progress) return;

    // 3. Detailed Analysis
    const goalsCompleted = [];
    if ((progress.calories_consumed || 0) <= (progress.calories_goal || 2000)) goalsCompleted.push("Calorie Target");
    if ((progress.protein_consumed || 0) >= (progress.protein_goal || 50)) goalsCompleted.push("Protein Intake");
    
    const usageCount = usage?.length || 0;
    const spiritualCount = spiritual?.length || 0;

    const insights = [];
    if (progress.calories_consumed === 0) insights.push("You didn't log any meals today. Consistency is key!");
    if (spiritualCount === 0) insights.push("Take a moment for spiritual reflection tomorrow to balance your wellness journey.");
    if (usageCount > 10) insights.push("You're very active in the app! Great engagement.");

    const summary = `
🌟 *VICALARY Daily Performance Report*
📅 Date: ${date}

*Nutrition Adherence:*
- Calories: ${progress.calories_consumed || 0} / ${progress.calories_goal || 2000} kcal
- Macros: P:${progress.protein_consumed || 0}g, C:${progress.carbs_consumed || 0}g, F:${progress.fat_consumed || 0}g

*Activity & Engagement:*
- App Usage: ${usageCount} interactions
- Goals Met: ${goalsCompleted.length > 0 ? goalsCompleted.join(", ") : "None yet"}
- Spiritual Reminders: ${spiritualCount} engaged

*Coach Insights:*
${insights.length > 0 ? insights.map(i => `• ${i}`).join("\n") : "You're doing great! Keep following your personalized plan."}

*Focus for Tomorrow:*
${progress.calories_consumed > (progress.calories_goal || 2000) ? "• Try to stick closer to your calorie budget." : "• Maintain this great momentum!"}
• pick a new recipe from the Cookbook.

Keep pushing toward your goals! I'm here to support you.
    `.trim();

    // 4. Send message
    await provisionAndSendMessage(COACH_ID, userId, summary, 'text', {
      type: 'daily_summary',
      date: date
    });

    console.log(`[Coach] Detailed daily summary sent for user ${userId} on ${date}`);
  } catch (error) {
    console.error("[Coach] Failed to generate daily summary:", error);
  }
}
