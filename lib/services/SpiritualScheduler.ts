import { useEffect, useRef } from 'react';
import { getPrayerTimes, getPersonalizedSpiritualReminder } from '@/lib/api/prayerTimes';
import { getUserSettings } from '@/lib/api/settings';
import { useNotificationStore } from '@/store/notificationStore';

export const useSpiritualScheduler = (userId: string | null) => {
    const { addNotification } = useNotificationStore();
    const initializedDate = useRef<string | null>(null);
    const timers = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        if (!userId) return;

        const initScheduler = async () => {
            const today = new Date().toISOString().split('T')[0];
            if (initializedDate.current === today) return; // Already scheduled for today

            try {
                const rawSettings = await getUserSettings(userId);
                const settings = rawSettings as any;
                if (!settings) return;

                // Request browser permission automatically as this is a strict requirement
                if (typeof window !== 'undefined' && 'Notification' in window) {
                    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                        await Notification.requestPermission();
                    }
                }

                const prayerTimes = await getPrayerTimes();
                if (!prayerTimes) return;

                const preMins = settings.pre_prayer_mins ?? 15;
                const postMins = settings.post_prayer_mins ?? 15;
                const sleepAware = settings.sleep_aware ?? true;

                const now = new Date();
                
                // Clear any existing timers from previous days
                timers.current.forEach(clearTimeout);
                timers.current = [];

                const timeToDate = (timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    return d;
                };

                const scheduleNotification = async (targetDate: Date, title: string, getBody: () => Promise<string>, type: 'info'|'success') => {
                    const delay = targetDate.getTime() - now.getTime();
                    if (delay > 0) { // Only schedule future events
                        const timerId = setTimeout(async () => {
                            // Check sleep aware (e.g. 10 PM to 4 AM)
                            if (sleepAware) {
                                const h = new Date().getHours();
                                if (h >= 22 || h < 4) return;
                            }

                            const body = await getBody();
                            
                            // In-App Notification
                            addNotification(type, `${title}: ${body}`);

                            // OS Native Notification
                            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                                new Notification(title, { body, icon: '/icon.png' });
                            }
                        }, delay);
                        timers.current.push(timerId);
                    }
                };

                // Setup pipeline for each prayer
                Object.entries(prayerTimes).forEach(([name, timeStr]) => {
                    if (name === 'Imsak' || name === 'Midnight' || name === 'Sunrise' || name === 'Sunset') return;
                    
                    const exactTime = timeToDate(timeStr as string);

                    // 1. Pre-Prayer (Hadith)
                    const preTime = new Date(exactTime.getTime() - preMins * 60000);
                    scheduleNotification(
                        preTime, 
                        `Preparing for ${name}`, 
                        async () => {
                            const data = await getPersonalizedSpiritualReminder(userId, 'pre-prayer');
                            return data ? `"${data.content}" - ${data.reference}` : "Take a moment to prepare for Salah.";
                        },
                        'info'
                    );

                    // 2. Exact Time
                    scheduleNotification(
                        exactTime, 
                        `Time for ${name}`, 
                        async () => `It is time to pray ${name}.`,
                        'success'
                    );

                    // 3. Post-Prayer (Quran)
                    const postTime = new Date(exactTime.getTime() + postMins * 60000);
                    scheduleNotification(
                        postTime, 
                        `${name} Reflection`, 
                        async () => {
                            const data = await getPersonalizedSpiritualReminder(userId, 'post-prayer');
                            return data ? `"${data.content}" - ${data.reference}` : "May Allah accept your prayers.";
                        },
                        'info'
                    );
                });

                initializedDate.current = today;
            } catch (error) {
                console.error("[SpiritualScheduler] Failed to initialize:", error);
            }
        };

        initScheduler();
        
        // Re-check every hour in case date rolls over while app is open
        const interval = setInterval(() => {
            const today = new Date().toISOString().split('T')[0];
            if (initializedDate.current !== today) {
                initScheduler();
            }
        }, 3600000);

        return () => {
            clearInterval(interval);
            // We don't clear timeouts on unmount to allow them to fire if the user navigates away 
            // from the component but the app is still open (e.g. single page app).
            // But if userId changes (logout), we should clear them.
            if (!userId) {
                timers.current.forEach(clearTimeout);
                timers.current = [];
                initializedDate.current = null;
            }
        };
    }, [userId, addNotification]);
};
