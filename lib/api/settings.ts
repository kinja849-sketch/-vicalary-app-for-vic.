import { supabase } from '../supabase'

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const getNotifications = async (userId: string, limit = 50) => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data
}

export const getUnreadNotifications = async (userId: string) => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export const markNotificationAsRead = async (notificationId: string) => {
    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
}

export const markAllNotificationsAsRead = async (userId: string) => {
    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
}

export const createNotification = async (
    userId: string,
    type: 'alert' | 'update' | 'verse' | 'hadith' | 'reminder',
    title: string,
    content: string,
    actionUrl?: string
) => {
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            notification_type: type,
            title,
            content,
            action_url: actionUrl,
        })
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================================================
// SETTINGS
// ============================================================================

export const getUserSettings = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    return data
}

export const updateSettings = async (userId: string, settings: Partial<{
    theme: 'light' | 'dark'
    push_notifications_enabled: boolean
    language: string
    currency: string
    timezone: string
    country_code: string
    is_language_auto: boolean
    country: string
    currency_symbol: string
    prayer_notifications_enabled: boolean
    pre_prayer_mins: number
    post_prayer_mins: number
    spiritual_intensity: string
    sleep_aware: boolean
}>) => {
    const { data, error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: userId,
            ...settings,
        }, {
            onConflict: 'user_id',
            ignoreDuplicates: false,
        })
        .select()
        .single()

    if (error) {
        console.error("Settings upsert error:", error);
        throw error;
    }
    return data
}

export const updateTheme = async (userId: string, theme: 'light' | 'dark') => {
    return updateSettings(userId, { theme })
}

export const togglePushNotifications = async (userId: string, enabled: boolean) => {
    return updateSettings(userId, { push_notifications_enabled: enabled })
}

export const updateLanguage = async (userId: string, language: string) => {
    return updateSettings(userId, { language })
}

export const updateCurrency = async (userId: string, currency: string) => {
    return updateSettings(userId, { currency })
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

export const getSubscriptionStatus = async (userId: string) => {
    const settings = await getUserSettings(userId)
    return {
        status: settings?.subscription_status || 'free',
        expiresAt: settings?.subscription_expires_at,
    }
}

export const updateSubscription = async (
    userId: string,
    status: 'free' | 'premium',
    expiresAt?: string
) => {
    const { data, error } = await supabase
        .from('user_settings')
        .update({
            subscription_status: status,
            subscription_expires_at: expiresAt,
        })
        .eq('user_id', userId)
        .select()
        .maybeSingle()

    if (error) throw error
    return data
}
