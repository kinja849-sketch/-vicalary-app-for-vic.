"use client"
import { useState, useEffect } from 'react';
import { getPrayerTimes, getPersonalizedSpiritualReminder, getPrayerWindow } from '@/lib/api/prayerTimes';
import { useTranslation } from '@/lib/api/translation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BadgeCheck, BookOpen } from 'lucide-react';

interface SpiritualReminderProps {
    userId: string;
}

export const SpiritualReminder = ({ userId }: SpiritualReminderProps) => {
    const { t, lang } = useTranslation();
    const [reminder, setReminder] = useState<{ type: 'quran' | 'hadith', content: string, content_ar?: string, reference: string } | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    // Keep track of the active phase so we don't re-fetch multiple times during the same phase
    const [currentPhase, setCurrentPhase] = useState<'pre-prayer' | 'post-prayer' | 'none'>('none');

    useEffect(() => {
        const checkSpiritualWindow = async () => {
            const prayerTimes = await getPrayerTimes();
            if (!prayerTimes) return;

            const { inWindow, phase } = getPrayerWindow(prayerTimes);

            if (inWindow && phase !== 'none') {
                const today = new Date().toISOString().split('T')[0];
                const seenKey = `spiritual_reminder_seen_${today}_${phase}`;
                
                // If we've already shown the reminder for this specific window today, do not show it again.
                if (localStorage.getItem(seenKey)) {
                    setIsVisible(false);
                    return;
                }

                // If phase changed (e.g. from none to pre-prayer, or pre-prayer to post-prayer)
                if (phase !== currentPhase) {
                    const data = await getPersonalizedSpiritualReminder(userId, phase, lang);
                    if (data) {
                        setReminder(data);
                        setCurrentPhase(phase);
                        setIsVisible(true);
                        // Lock this phase for the day so it never pops up on refresh
                        localStorage.setItem(seenKey, 'true');
                    }
                }
            } else {
                // Not in window
                if (currentPhase !== 'none') {
                    setIsVisible(false);
                    setReminder(null);
                    setCurrentPhase('none');
                }
            }
        };

        checkSpiritualWindow();
        const interval = setInterval(checkSpiritualWindow, 60 * 1000);
        return () => clearInterval(interval);
    }, [userId, currentPhase]);

    if (!isVisible || !reminder) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mx-4 my-6 p-6 rounded-[32px] bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-white/10 shadow-2xl relative overflow-hidden group"
            >
                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 size-40 bg-vic-green/10 rounded-full blur-3xl group-hover:bg-vic-green/20 transition-colors duration-700" />
                <div className="absolute -bottom-10 -left-10 size-40 bg-vic-pink/10 rounded-full blur-3xl group-hover:bg-vic-pink/20 transition-colors duration-700" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-2xl bg-vic-green/20 flex items-center justify-center">
                                <BookOpen className="text-vic-green" size={22} />
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-sm tracking-tight uppercase">
                                    {reminder.type === 'quran' ? (t('quran_reminder') || 'Quranic Verse') : (t('hadith_reminder') || 'Hadith Reminder')}
                                </h4>
                                <div className="flex items-center gap-1.5">
                                    <div className="size-1.5 rounded-full bg-vic-green animate-pulse shadow-[0_0_8px_rgba(19,236,55,0.8)]" />
                                    <p className="text-vic-green text-[10px] font-bold uppercase tracking-widest">{t('prayer_time_window')}</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsVisible(false)} className="text-white/20 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {reminder.content_ar && (
                        <p className="text-white text-2xl font-serif text-right leading-loose mb-6 drop-shadow-md" dir="rtl">
                            {reminder.content_ar}
                        </p>
                    )}

                    <p className="text-slate-200 text-lg font-medium leading-relaxed italic mb-6 font-serif border-l-2 border-vic-green/30 pl-4">
                        "{reminder.content}"
                    </p>


                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-vic-pink text-xs font-bold uppercase tracking-wider">— {reminder.reference}</span>
                            {(reminder as any).verifyUrl && (
                                <a
                                    href={(reminder as any).verifyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-vic-green/60 hover:text-vic-green flex items-center gap-1 transition-colors font-bold uppercase"
                                >
                                    <BadgeCheck size={12} />
                                    {t('verify_online') || 'Verify Online'}
                                </a>
                            )}
                        </div>
                        <div className="flex gap-1">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="size-1 rounded-full bg-vic-green/30" />
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
