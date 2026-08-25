"use client"
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';
import { detectLocation, getPrimaryLanguage } from './api/location';
import { getUserSettings, updateSettings } from './api/settings';
import { useSpiritualScheduler } from './services/SpiritualScheduler';
import { useDailySummaryTracker } from './services/DailySummaryTracker';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: any | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize the Daily Spiritual Scheduler globally
    useSpiritualScheduler(user?.id ?? null);
    
    // Initialize the End of Day summary tracker
    useDailySummaryTracker(user?.id ?? null);

    useEffect(() => {
        // Check active sessions and sets the user
        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            if (!session) {
                setLoading(false);
            }
        };

        getInitialSession();

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (!session) {
                setLoading(false);
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Listen for profile changes
    useEffect(() => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Initial profile fetch
        const fetchProfile = async () => {
            try {
                const { data } = await supabase
                    .from('user_profiles')
                    .select('*, chat_users!chat_users_user_id_fkey(phone_number, is_verified)')
                    .eq('id', user.id)
                    .maybeSingle();

                if (data) {
                    setProfile(data);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                console.error("Profile fetch error in AuthContext:", err);
            } finally {
                setLoading(false);
            }
        };

        const handleLocationConfig = async (uid: string) => {
            try {
                const settings = await getUserSettings(uid);
                // If language is already manually set or settings exist with values, we might skip
                // But the user wants real-time detection to set default language.
                if (!settings || settings.is_language_auto !== false) {
                    const loc = await detectLocation();
                    if (loc) {
                        const lang = getPrimaryLanguage(loc.languages);
                        await updateSettings(uid, {
                            language: lang,
                            country_code: loc.country_code,
                            timezone: loc.timezone,
                            currency: loc.currency,
                            is_language_auto: true
                        });
                        console.log(`[Auth] Auto-configured location: ${loc.country_name}, Lang: ${lang}, Method: ${loc.method}`);
                    } else {
                        console.warn("[Auth] No location detected by detectLocation()");
                    }
                }
            } catch (err) {
                console.error("[Auth] Location config failed:", err);
            }
        };

        fetchProfile();
        handleLocationConfig(user.id);

        // Real-time subscription to profile updates
        const profileSubscription = supabase
            .channel(`profile:${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_profiles',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                console.log('Profile update received:', payload.new);
                setProfile((prev: any) => ({ ...prev, ...payload.new }));
            })
            .subscribe();

        return () => {
            profileSubscription.unsubscribe();
        };
    }, [user]);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    const value = React.useMemo(() => ({
        user,
        session,
        profile,
        loading,
        signOut,
    }), [user, session, profile, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
