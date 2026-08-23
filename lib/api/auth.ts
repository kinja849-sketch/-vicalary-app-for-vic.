import { supabase } from '../supabase'
import { detectLocation, getPrimaryLanguage } from './location'

// ============================================================================
// AUTHENTICATION & SYNC
// ============================================================================

export const syncUserWithSupabase = async (supabaseUser: any) => {
    if (!supabaseUser) return null;

    console.log("[Auth API] Starting secure synchronization for:", supabaseUser.id);

    try {
        // 1. Attempt secure server-side synchronization via API
        // This bypasses RLS and handles the UUID type mismatch gracefully
        const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: supabaseUser.id,
                email: supabaseUser.email,
                full_name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.first_name || '',
                avatar_url: supabaseUser.user_metadata?.avatar_url || ''
            }),
        });

        if (response.ok) {
            const { profile } = await response.json();
            console.log("[Auth API] Secure sync successful");
            return profile;
        } else {
            const errorData = await response.json();
            console.warn("[Auth API] Secure sync failed, falling back to client-side:", errorData.error);
        }
    } catch (err) {
        console.warn("[Auth API] Secure sync request failed:", err);
    }

    // 2. FALLBACK: Client-side sync (Original logic, preserved for robustness)
    // Note: This may fail with 42883 if the DB schema hasn't been migrated to UUID yet
    const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

    const extractNameFromEmail = (email: string) => {
        if (!email) return 'User';
        const namePart = email.split('@')[0];
        return namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._-]/g, ' ');
    };

    const metadataName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.first_name;
    const finalName = metadataName || (existingProfile?.full_name && existingProfile.full_name !== '-' ? existingProfile.full_name : extractNameFromEmail(supabaseUser.email));

    const profilePayload: any = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        full_name: finalName,
        updated_at: new Date().toISOString()
    };

    if (supabaseUser.user_metadata?.avatar_url && (!existingProfile || !existingProfile.avatar_url)) {
        profilePayload.avatar_url = supabaseUser.user_metadata.avatar_url;
    }

    const { data: profileRows, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'id' })
        .select()
        .limit(1);

    if (upsertError) {
        console.error("[Auth] Client-side sync failed:", upsertError);
        throw upsertError;
    }

    return profileRows && profileRows.length > 0 ? profileRows[0] : null;
}

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

export const getUserProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*, chat_users(phone_number)')
        .eq('id', userId)
        .maybeSingle() as any; // Cast the result of maybeSingle() to any

    if (error) throw error

    // Process to pull phone_number to top level for compatibility
    if (data && data.chat_users) {
        data.phone_number = data.chat_users.phone_number;
    }

    return data
}

export const updateUserProfile = async (userId: string, updates: any) => {
    const { data: dataRows, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .limit(1)

    if (error) throw error
    return dataRows && dataRows.length > 0 ? dataRows[0] : null
}

export const uploadAvatar = async (userId: string, file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath)

    await updateUserProfile(userId, { avatar_url: publicUrl })

    // Also update Supabase Auth metadata to ensure persistence on logout/login
    await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
    });

    return publicUrl
}

export const searchUsers = async (query: string, currentUserId: string) => {
    if (!query || query.length < 2) return [];

    // Only search for users who are fully verified for chat
    const { data, error } = await (supabase
        .from('user_profiles')
        .select(`
            id, 
            full_name, 
            avatar_url,
            chat_users!inner(phone_number, is_verified)
        `)
        .neq('id', currentUserId)
        .eq('chat_users.is_verified', true)
        .or(`full_name.ilike.%${query}%, email.ilike.%${query}%`)
        .limit(10) as any);

    if (error) throw error;
    return data;
}

// ============================================================================
// ONBOARDING
// ============================================================================

export const saveOnboardingResponses = async (userId: string, responses: any) => {
    // Calculate daily calorie goal based on responses
    const { age, gender, height_cm, weight_kg, goal, activity_level } = responses;

    // Default fallback
    let dailyCalorieGoal = 2000;

    if (age && gender && height_cm && weight_kg) {
        // Mifflin-St Jeor Equation
        let bmr;
        if (gender.toLowerCase().includes('male')) {
            bmr = (10 * Number(weight_kg)) + (6.25 * Number(height_cm)) - (5 * Number(age)) + 5;
        } else {
            bmr = (10 * Number(weight_kg)) + (6.25 * Number(height_cm)) - (5 * Number(age)) - 161;
        }

        // Activity multiplier
        const activityMap: any = {
            "Sedentary (office job)": 1.2,
            "Lightly Active (walking, light exercise)": 1.375,
            "Moderately Active (regular exercise)": 1.55,
            "Very Active (intense exercise/manual labor)": 1.725,
            "Extra Active (athlete/physical job)": 1.9
        };

        const multiplier = activityMap[activity_level] || 1.375;
        let tdee = bmr * multiplier;

        // Goal adjustment
        if (goal === 'Lose Weight') tdee -= 500;
        else if (goal === 'Gain Weight') tdee += 500;

        dailyCalorieGoal = Math.round(tdee);
    }

    // Filter responses to only include valid database columns
    const validColumns = [
        'full_name', 'age', 'gender', 'height_cm', 'weight_kg',
        'goal', 'budget', 'preferences', 'daily_meal_frequency',
        'liked_foods', 'restrictions', 'cooking_skill', 'meal_prep_time',
        'target', 'dietary_lifestyle', 'calorie_flexibility', 'activity_level',
        'preferred_cuisines', 'sleep_duration', 'sleep_quality', 'stress_level',
        'dietary_preference', 'medical_conditions', 'allergies', 'weekly_budget',
        'daily_reminders'
    ];

    const filteredResponses: any = {};
    validColumns.forEach(col => {
        if (responses[col] !== undefined) {
            filteredResponses[col] = responses[col];
        }
    });

    console.log("Saving Onboarding with Filtered Responses:", filteredResponses);

    const { data: dataRows, error } = await supabase
        .from('onboarding_responses')
        .upsert({
            user_id: userId,
            ...filteredResponses,
            daily_calorie_goal: dailyCalorieGoal,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })
        .select()
        .limit(1)

    if (error) {
        console.error("Supabase Onboarding Upsert Error Details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            payload: { user_id: userId, ...filteredResponses }
        });
        throw error;
    }

    const data = dataRows && dataRows.length > 0 ? dataRows[0] : null;

    // Mark onboarding as complete in profile and update the goal and full_name
    await updateUserProfile(userId, {
        full_name: filteredResponses.full_name || undefined,
        onboarding_completed: true,
        goal_calories: dailyCalorieGoal
    });

    // Also update Supabase Auth metadata so the user's name appears correctly in the Supabase Dashboard!
    if (filteredResponses.full_name) {
        await supabase.auth.updateUser({
            data: { full_name: filteredResponses.full_name }
        });
    }

    // Initialize daily progress and user settings in the background to avoid blocking the user redirect
    (async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // 1. Initialize daily progress (Fixed: removed non-existent columns causing 400 error)
            await supabase.from('daily_progress').upsert({
                user_id: userId,
                progress_date: today,
                calories_goal: dailyCalorieGoal,
                calories_consumed: 0,
                meals_logged: 0
            }, { onConflict: 'user_id,progress_date' });

            // 2. Detect location to save settings
            const loc = await detectLocation();
            await supabase.from('user_settings').upsert({
                user_id: userId,
                language: getPrimaryLanguage(loc?.languages),
                currency: loc?.currency || 'USD',
                timezone: loc?.timezone || 'UTC',
                country_code: loc?.country_code,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        } catch (err) {
            console.warn("Non-critical background post-onboarding tasks failed:", err);
        }
    })();

    return data

}

export const getOnboardingResponses = async (userId: string) => {
    const { data: rows, error } = await supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', userId)
        .limit(1)

    if (error) throw error
    return rows && rows.length > 0 ? rows[0] : null
}

// ============================================================================
// PHONE VERIFICATION FOR CHAT
// ============================================================================

export const sendPhoneVerification = async (userId: string, phoneNumber: string, countryCode: string, channel: 'sms' | 'whatsapp' = 'sms') => {
    const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phoneNumber, countryCode, channel })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
        console.error("OTP send error:", data);
        throw new Error(data.message || 'Failed to send OTP');
    }
    return data;
}

export const verifyPhoneCode = async (userId: string, phoneNumber: string, code: string) => {
    const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phoneNumber, code })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.message || 'Verification failed');
    }
    return data;
}
