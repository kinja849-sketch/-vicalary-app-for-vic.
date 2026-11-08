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
    let prog = data && data.length > 0 ? data[0] : null;

    // Self-healing check: reconcile with authoritative meal ledger in food_analysis_history
    try {
        const { data: meals } = await (supabase as any)
            .from('food_analysis_history')
            .select('calories, calories_consumed, protein, carbs, fat, local_date, created_at, analysis_type, analysis_data')
            .eq('user_id', userId)
            .or(`local_date.eq.${date},and(created_at.gte.${date}T00:00:00.000Z,created_at.lte.${date}T23:59:59.999Z)`);

        if (meals && meals.length > 0) {
            // Filter strictly for valid logged meals (exclude scanner/budgeted products)
            const validMeals = (meals as any[]).filter(m => 
                m.analysis_type !== 'scanner_product' && 
                !m.analysis_data?.is_scanner_product && 
                (m.calories_consumed === undefined || m.calories_consumed === null || Number(m.calories_consumed) > 0)
            );

            let totalCal = 0;
            let totalProtein = 0;
            let totalCarbs = 0;
            let totalFat = 0;

            for (const m of validMeals) {
                totalCal += Number(m.calories ?? m.calories_consumed ?? 0);
                totalProtein += Number(m.protein || 0);
                totalCarbs += Number(m.carbs || 0);
                totalFat += Number(m.fat || 0);
            }

            const currentCal = Number(prog?.calories_consumed || 0);
            const currentMeals = Number(prog?.meals_logged || 0);

            // If daily_progress is missing or has less calories/meals than the authoritative meal ledger, heal it immediately
            if (!prog || currentCal < totalCal || currentMeals < validMeals.length) {
                let effectiveGoal = Number(prog?.calories_goal || 0);
                if (!effectiveGoal) {
                    const { data: prof } = await supabase.from('user_profiles').select('goal_calories').eq('id', userId).maybeSingle();
                    effectiveGoal = Number(prof?.goal_calories || 2000);
                }

                const healedCal = Math.max(currentCal, totalCal);
                const healedMeals = Math.max(currentMeals, validMeals.length);
                const healedProtein = Math.max(Number(prog?.protein_consumed || 0), totalProtein);
                const healedCarbs = Math.max(Number(prog?.carbs_consumed || 0), totalCarbs);
                const healedFat = Math.max(Number(prog?.fat_consumed || 0), totalFat);

                if (prog) {
                    await supabase
                        .from('daily_progress')
                        .update({
                            calories_consumed: healedCal,
                            calories_goal: effectiveGoal,
                            meals_logged: healedMeals,
                            protein_consumed: healedProtein,
                            carbs_consumed: healedCarbs,
                            fat_consumed: healedFat,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', prog.id);

                    prog = {
                        ...prog,
                        calories_consumed: healedCal,
                        calories_goal: effectiveGoal,
                        meals_logged: healedMeals,
                        protein_consumed: healedProtein,
                        carbs_consumed: healedCarbs,
                        fat_consumed: healedFat
                    };
                } else {
                    const { data: newRow } = await supabase
                        .from('daily_progress')
                        .insert({
                            user_id: userId,
                            progress_date: date,
                            calories_goal: effectiveGoal,
                            calories_consumed: healedCal,
                            meals_logged: healedMeals,
                            protein_consumed: healedProtein,
                            carbs_consumed: healedCarbs,
                            fat_consumed: healedFat
                        })
                        .select()
                        .single();

                    if (newRow) prog = newRow;
                }
            }
        }
    } catch (healErr) {
        console.warn("[Progress] Reconciliation check non-fatal error:", healErr);
    }

    if (prog && typeof window !== 'undefined') {
        const today = format(new Date(), 'yyyy-MM-dd');
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
    const today = format(new Date(), 'yyyy-MM-dd');

    let analysis = null;

    if (!mealData.alreadySaved) {
        // 1. Log to food analysis history
        const { data: analysisRows, error: analysisError } = await supabase
            .from('food_analysis_history')
            .insert({
                user_id: userId,
                image_url: mealData.mealImage,
                calories_consumed: Number(mealData.totalCalories || 0),
                calories: Number(mealData.totalCalories || 0),
                local_date: today,
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

    // Query authoritative meals ledger for today to guarantee accurate accumulation
    let historyCal = 0;
    let historyProtein = 0;
    let historyCarbs = 0;
    let historyFat = 0;
    let historyMealsCount = 0;
    try {
        const { data: todayMeals } = await (supabase as any)
            .from('food_analysis_history')
            .select('calories, calories_consumed, protein, carbs, fat, local_date, created_at, analysis_type, analysis_data')
            .eq('user_id', userId)
            .or(`local_date.eq.${today},and(created_at.gte.${today}T00:00:00.000Z,created_at.lte.${today}T23:59:59.999Z)`);

        if (todayMeals && todayMeals.length > 0) {
            const validMeals = (todayMeals as any[]).filter(m => 
                m.analysis_type !== 'scanner_product' && 
                !m.analysis_data?.is_scanner_product && 
                (m.calories_consumed === undefined || m.calories_consumed === null || Number(m.calories_consumed) > 0)
            );
            historyMealsCount = validMeals.length;
            for (const m of validMeals) {
                historyCal += Number(m.calories ?? m.calories_consumed ?? 0);
                historyProtein += Number(m.protein || 0);
                historyCarbs += Number(m.carbs || 0);
                historyFat += Number(m.fat || 0);
            }
        }
    } catch (e) {
        console.warn("[Progress] Non-fatal meal history check error:", e);
    }

    if (currentProgress) {
        const existingConsumed = Number(currentProgress.calories_consumed || 0);
        let goalCalories = Number(currentProgress.calories_goal || 0);
        if (!goalCalories) {
            const { data: prof } = await supabase.from('user_profiles').select('goal_calories').eq('id', userId).maybeSingle();
            goalCalories = Number(prof?.goal_calories || 2000);
        }

        // Cumulative floor protection: never allow calories to depreciate or be less than history
        const newConsumed = Math.max(existingConsumed + totalMealCalories, historyCal, totalMealCalories);
        const newMealsLogged = Math.max((currentProgress.meals_logged || 0) + 1, historyMealsCount);
        const newProtein = Math.max(Number(currentProgress.protein_consumed || 0) + mealMacros.protein, historyProtein);
        const newCarbs = Math.max(Number(currentProgress.carbs_consumed || 0) + mealMacros.carbs, historyCarbs);
        const newFat = Math.max(Number(currentProgress.fat_consumed || 0) + mealMacros.fat, historyFat);

        const justAchieved = goalCalories > 0 && newConsumed >= goalCalories && existingConsumed < goalCalories;
        const exceededGoal = goalCalories > 0 && newConsumed > goalCalories;

        await supabase
            .from('daily_progress')
            .update({
                calories_consumed: newConsumed,
                calories_goal: goalCalories,
                protein_consumed: newProtein,
                carbs_consumed: newCarbs,
                fat_consumed: newFat,
                fiber_consumed: Number(currentProgress.fiber_consumed || 0) + mealMacros.fiber,
                sugar_consumed: Number(currentProgress.sugar_consumed || 0) + mealMacros.sugar,
                meals_logged: newMealsLogged,
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
        
        const effectiveCalories = Math.max(totalMealCalories, historyCal);
        const effectiveMeals = Math.max(1, historyMealsCount);
        const effectiveProtein = Math.max(mealMacros.protein, historyProtein);
        const effectiveCarbs = Math.max(mealMacros.carbs, historyCarbs);
        const effectiveFat = Math.max(mealMacros.fat, historyFat);

        const justAchieved = goalCalories > 0 && effectiveCalories >= goalCalories;

        await supabase
            .from('daily_progress')
            .insert({
                user_id: userId,
                progress_date: today,
                calories_consumed: effectiveCalories,
                calories_goal: goalCalories,
                protein_consumed: effectiveProtein,
                protein_goal: onboarding?.protein_goal || 50,
                carbs_consumed: effectiveCarbs,
                carbs_goal: onboarding?.carbs_goal || 250,
                fat_consumed: effectiveFat,
                fat_goal: onboarding?.fat_goal || 70,
                fiber_consumed: mealMacros.fiber,
                sugar_consumed: mealMacros.sugar,
                meals_logged: effectiveMeals
            });

        const exceededGoal = goalCalories > 0 && effectiveCalories > goalCalories;

        logInfo(userId, 'meal_logged', { calories: totalMealCalories, macros: mealMacros, newConsumed: effectiveCalories, justAchieved, exceededGoal });

        if (exceededGoal) {
            import('./coach').then(({ sendCoachCalorieExceededAlert }) => {
                sendCoachCalorieExceededAlert(
                    userId,
                    effectiveCalories,
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
            caloriesConsumed: effectiveCalories,
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
