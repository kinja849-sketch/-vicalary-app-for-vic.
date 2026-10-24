import { supabase } from '../supabase'
import { logInfo, logError } from './logging'
import { format } from 'date-fns'
// Removed gemini import

// ============================================================================
// PROGRESS MEASUREMENTS
// ============================================================================

export const addMeasurement = async (userId: string, weight: number, height?: number, notes?: string) => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: dataRows, error } = await supabase
        .from('progress_measurements')
        .upsert({
            user_id: userId,
            weight: weight,
            height: height,
            notes,
            measurement_date: today,
        }, {
            onConflict: 'user_id,measurement_date'
        })
        .select()
        .limit(1)

    if (error) throw error
    return dataRows && dataRows.length > 0 ? dataRows[0] : null
}

export const getMeasurements = async (userId: string, limit = 30) => {
    const { data, error } = await supabase
        .from('progress_measurements')
        .select('*')
        .eq('user_id', userId)
        .order('measurement_date', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data
}

// ============================================================================
// DAILY PROGRESS
// ============================================================================

export const getDailyProgress = async (userId: string, date: string) => {
    const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('progress_date', date)
        .limit(1)

    if (error) throw error
    const prog = data && data.length > 0 ? data[0] : null;

    if (prog && typeof window !== 'undefined') {
        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
            const consumed = Number(prog.calories_consumed || 0);
            let goal = Number(prog.calories_goal || 0);
            (async () => {
                try {
                    let effectiveGoal = goal;
                    if (!effectiveGoal && consumed > 0) {
                        const { data: prof } = await supabase.from('user_profiles').select('goal_calories').eq('id', userId).maybeSingle();
                        effectiveGoal = Number(prof?.goal_calories || 2000);
                    }
                    if (effectiveGoal > 0 && consumed > effectiveGoal) {
                        const { sendCoachCalorieExceededAlert } = await import('./coach');
                        await sendCoachCalorieExceededAlert(userId, consumed, effectiveGoal);
                    }
                } catch {
                    // Non-fatal background check
                }
            })();
        }
    }

    return prog;
}


export const getProgressByDateRange = async (userId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .gte('progress_date', startDate)
        .lte('progress_date', endDate)
        .order('progress_date', { ascending: true })

    if (error) throw error
    return data
}

// ============================================================================
// DAILY SUMMARY (AI)
// ============================================================================

export const getDailySummary = async (userId: string) => {
    try {
        const res = await fetch('/api/daily-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        if (!res.ok) throw new Error('daily-summary failed');
        return await res.json();
    } catch (error) {
        console.error("Failed to fetch daily summary:", error);
        return null;
    }
}

// ============================================================================
// MONTHLY ANALYSIS
// ============================================================================

export const getMonthlyAnalysis = async (userId: string, year: number, month: number) => {
    // Fetch measurements for the month without timezone corruption
    const lastDay = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: measurements } = await supabase
        .from('progress_measurements')
        .select('*')
        .eq('user_id', userId)
        .gte('measurement_date', startDate)
        .lte('measurement_date', endDate)
        .order('measurement_date', { ascending: true })

    // Fetch milestones for the month
    const { data: milestones } = await (supabase
        .from('user_milestones' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .gte('milestone_date', startDate)
        .lte('milestone_date', endDate);

    // Call Edge Function for monthly analysis
    try {
        console.log("Fetching monthly analysis from backend...");
        const res = await fetch('/api/monthly-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, year, month })
        })

        if (!res.ok) throw new Error('monthly-analysis failed')
        return await res.json()
    } catch (error) {
        console.error("Monthly analysis failed:", error);
        throw error;
    }
}

// ============================================================================
// CALENDAR HELPERS
// ============================================================================

export const getCalendarData = async (userId: string, year: number, month: number) => {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .gte('progress_date', startDate)
        .lte('progress_date', endDate)

    if (error) throw error
    return data
}

// ============================================================================
// FOOD LOGGING
// ============================================================================

export const logMeal = async (userId: string, mealData: any) => {
    const today = new Date().toISOString().split('T')[0];

    let analysis = null;

    if (!mealData.alreadySaved) {
        // 1. Log to food analysis history
        const { data: analysisRows, error: analysisError } = await supabase
            .from('food_analysis_history')
            .insert({
                user_id: userId,
                image_url: mealData.mealImage,
                calories_consumed: Number(mealData.totalCalories || 0),
                notes: typeof mealData.analysis === 'string' ? mealData.analysis : JSON.stringify(mealData.analysis || mealData)
            })
            .select();

        if (analysisError) {
            logError(userId, 'meal_history_save_failed', { error: analysisError });
            throw analysisError;
        }
        analysis = analysisRows && analysisRows.length > 0 ? analysisRows[0] : null;
    }

    // 2. Add detailed food items (only if not already saved)
    if (!mealData.alreadySaved && mealData.foodItems && mealData.foodItems.length > 0) {
        // ... (rest of the logic remains same)
        const itemsToInsert = mealData.foodItems.map((item: any) => {
            // Map healthStatus string to health_rating number (1-10)
            let healthRating = 5;
            if (item.healthStatus === 'GOOD' || item.verdict === 'GOOD') healthRating = 9;
            if (item.healthStatus === 'POOR' || item.verdict === 'POOR') healthRating = 2;

            return {
                name: item.name,
                calories: Number(item.calories || 0),
                protein: Number(item.protein || 0),
                carbs: Number(item.carbs || 0),
                fat: Number(item.fat || 0),
                fiber: Number(item.fiber || 0),
                sugar: Number(item.sugar || 0),
                health_rating: healthRating,
                description: item.description,
                image_url: item.image || item.image_url || mealData.mealImage,
                barcode: item.barcode || mealData.barcode,
                serving_size: item.serving_size || '1 serving',
                user_id: userId // Added user_id
            };
        });

        const { error: itemsError } = await supabase
            .from('food_items')
            .insert(itemsToInsert);

        if (itemsError) {
            logError(userId, 'food_items_save_failed', { error: itemsError });
            throw itemsError;
        }
    }

    // 3. Update daily progress
    const { data: progressRows } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('progress_date', today)
        .limit(1);

    const currentProgress = progressRows && progressRows.length > 0 ? progressRows[0] : null;

    // Calculate sum of macros from current meal items
    const mealMacros = (mealData.foodItems || []).reduce((acc: any, item: any) => ({
        protein: acc.protein + Number(item.protein || 0),
        carbs: acc.carbs + Number(item.carbs || 0),
        fat: acc.fat + Number(item.fat || 0),
        fiber: acc.fiber + Number(item.fiber || 0),
        sugar: acc.sugar + Number(item.sugar || 0)
    }), { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });

    const totalMealCalories = Number(mealData.totalCalories || 0);

    if (currentProgress) {
        const existingConsumed = Number(currentProgress.calories_consumed || 0);
        let goalCalories = Number(currentProgress.calories_goal || 0);
        if (!goalCalories) {
            const { data: prof } = await supabase.from('user_profiles').select('goal_calories').eq('id', userId).maybeSingle();
            goalCalories = Number(prof?.goal_calories || 2000);
        }

        const newConsumed = existingConsumed + totalMealCalories;
        const justAchieved = goalCalories > 0 && newConsumed >= goalCalories && existingConsumed < goalCalories;
        const exceededGoal = goalCalories > 0 && newConsumed > goalCalories;

        await supabase
            .from('daily_progress')
            .update({
                calories_consumed: newConsumed,
                protein_consumed: Number(currentProgress.protein_consumed || 0) + mealMacros.protein,
                carbs_consumed: Number(currentProgress.carbs_consumed || 0) + mealMacros.carbs,
                fat_consumed: Number(currentProgress.fat_consumed || 0) + mealMacros.fat,
                fiber_consumed: Number(currentProgress.fiber_consumed || 0) + mealMacros.fiber,
                sugar_consumed: Number(currentProgress.sugar_consumed || 0) + mealMacros.sugar,
                meals_logged: (currentProgress.meals_logged || 0) + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentProgress.id);

        logInfo(userId, 'meal_logged', { calories: totalMealCalories, macros: mealMacros, newConsumed, justAchieved, exceededGoal });

        // Trigger Health Coach Alert into chat if target is exceeded
        if (exceededGoal) {
            import('./coach').then(({ sendCoachCalorieExceededAlert }) => {
                sendCoachCalorieExceededAlert(
                    userId,
                    newConsumed,
                    goalCalories,
                    mealData.foodItems?.[0]?.name || mealData.name
                );
            }).catch(err => console.error("[Progress] Failed to dispatch coach alert:", err));
        }

        return {
            analysis,
            capReached: justAchieved || exceededGoal,
            justAchieved,
            exceededGoal,
            caloriesConsumed: newConsumed,
            caloriesGoal: goalCalories,
            message: exceededGoal
                ? `⚠️ Calorie Target Exceeded: You have consumed ${newConsumed} kcal (target: ${goalCalories} kcal). The Health Coach has sent an alert to your chat. Please stop eating for the rest of the day!`
                : justAchieved
                    ? "Congratulations! You've achieved your daily calorie goal today. Be mindful with further intake for the rest of the day."
                    : undefined
        };
    } else {
        // First meal of the day: create progress row
        const { data: onboardingRows } = await supabase
            .from('onboarding_responses')
            .select('*')
            .eq('user_id', userId)
            .limit(1);

        const { data: profileRows } = await supabase
            .from('user_profiles')
            .select('goal_calories')
            .eq('id', userId)
            .limit(1);

        const onboarding = onboardingRows?.[0];
        const profile = profileRows?.[0];
        const goalCalories = Number(onboarding?.daily_calorie_goal || profile?.goal_calories || 2000);
        const justAchieved = goalCalories > 0 && totalMealCalories >= goalCalories;

        await supabase
            .from('daily_progress')
            .insert({
                user_id: userId,
                progress_date: today,
                calories_consumed: totalMealCalories,
                calories_goal: goalCalories,
                protein_consumed: mealMacros.protein,
                protein_goal: onboarding?.protein_goal || 50,
                carbs_consumed: mealMacros.carbs,
                carbs_goal: onboarding?.carbs_goal || 250,
                fat_consumed: mealMacros.fat,
                fat_goal: onboarding?.fat_goal || 70,
                fiber_consumed: mealMacros.fiber,
                fiber_goal: onboarding?.fiber_goal || 30,
                sugar_consumed: mealMacros.sugar,
                sugar_goal: onboarding?.sugar_goal || 50,
                meals_logged: 1
            });

        const exceededGoal = goalCalories > 0 && totalMealCalories > goalCalories;

        logInfo(userId, 'meal_logged', { calories: totalMealCalories, macros: mealMacros, justAchieved, exceededGoal });

        if (exceededGoal) {
            import('./coach').then(({ sendCoachCalorieExceededAlert }) => {
                sendCoachCalorieExceededAlert(
                    userId,
                    totalMealCalories,
                    goalCalories,
                    mealData.foodItems?.[0]?.name || mealData.name
                );
            }).catch(err => console.error("[Progress] Failed to dispatch coach alert:", err));
        }

        return {
            analysis,
            capReached: justAchieved || exceededGoal,
            justAchieved,
            exceededGoal,
            caloriesConsumed: totalMealCalories,
            caloriesGoal: goalCalories,
            message: exceededGoal
                ? `⚠️ Calorie Target Exceeded: You have consumed ${totalMealCalories} kcal (target: ${goalCalories} kcal). The Health Coach has sent an alert to your chat. Please stop eating for the rest of the day!`
                : justAchieved
                    ? "Congratulations! You've achieved your daily calorie goal today. Be mindful with further intake for the rest of the day."
                    : undefined
        };
    }
};

// ============================================================================
// MILESTONES (Calendar)
// ============================================================================

export const upsertMilestone = async (userId: string, date: Date | string, data: any) => {
    const dateString = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');

    const { data: milestoneRows, error } = await (supabase
        .from('user_milestones' as any) as any)
        .upsert({
            user_id: userId,
            milestone_date: dateString,
            ...data,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,milestone_date'
        })
        .select()
        .limit(1);

    if (error) throw error;
    return milestoneRows && milestoneRows.length > 0 ? milestoneRows[0] : null;
};

export const getMilestone = async (userId: string, date: Date | string) => {
    const dateString = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');

    const { data, error } = await (supabase
        .from('user_milestones' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .eq('milestone_date', dateString)
        .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
};
