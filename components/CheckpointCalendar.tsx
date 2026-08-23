"use client"
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { format, addDays, startOfToday, isSameDay, differenceInDays, endOfMonth } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { MilestoneModal } from './MilestoneModal';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/api/translation';
import { BarChart2, Info } from 'lucide-react';

interface CheckpointCalendarProps {
    joinDate: string | Date;
    onEditProgress?: (date: Date) => void;
}

export const CheckpointCalendar: React.FC<CheckpointCalendarProps> = ({ joinDate, onEditProgress }) => {
    const { user } = useAuth();
    const { t, lang } = useTranslation();
    const router = useRouter();
    const today = startOfToday();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const todayRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to today on mount
    useEffect(() => {
        if (todayRef.current && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const element = todayRef.current;
            const offsetLeft = element.offsetLeft;
            const containerWidth = container.clientWidth;
            const elementWidth = element.clientWidth;

            container.scrollTo({
                left: offsetLeft - (containerWidth / 2) + (elementWidth / 2),
                behavior: 'smooth'
            });
        }
    }, [today]);

    const ISLAMIC_MONTHS = [
        'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 
        'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Shaaban', 
        'Ramadan', 'Shawwal', 'Dhu al-Qadah', 'Dhu al-Hijjah'
    ];

    const getHijriDateString = (date: Date) => {
        try {
            const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric'
            });
            const parts = formatter.formatToParts(date);
            const day = parts.find(p => p.type === 'day')?.value || '1';
            const mIndex = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
            const year = parts.find(p => p.type === 'year')?.value || '1447';
            const monthName = ISLAMIC_MONTHS[mIndex] || ISLAMIC_MONTHS[0];
            const suffix = lang === 'id' ? 'H' : 'AH';
            return `${day} ${monthName} ${year} ${suffix}`;
        } catch (e) {
            return '';
        }
    };

    const getHijriDay = (date: Date) => {
        try {
            const hijriLocale = `${lang}-u-ca-islamic-umalqura`;
            const parts = new Intl.DateTimeFormat(hijriLocale, {
                calendar: 'islamic-umalqura' as any,
                day: 'numeric'
            }).formatToParts(date);
            return parts.find(p => p.type === 'day')?.value || String(date.getDate());
        } catch (e) {
            return String(date.getDate());
        }
    };

    const getHijriMonthName = (date: Date) => {
        try {
            const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
                month: 'numeric'
            }).formatToParts(date);
            const mIndex = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
            return ISLAMIC_MONTHS[mIndex] || ISLAMIC_MONTHS[0];
        } catch (e) {
            return '';
        }
    };

    // Generate days: 15 days past, 90 days future
    const scrollableDays = useMemo(() => {
        const days: Date[] = [];
        const start = startOfToday();
        for (let i = -15; i <= 90; i++) {
            days.push(addDays(start, i));
        }
        return days;
    }, []);

    // Normalize date for comparison (midnight)
    const normalizeDate = (d: string | Date) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date;
    };

    // Milestone Logic: Every 7 days from joinDate
    const isMilestoneDay = (date: Date) => {
        if (!joinDate) return false;
        const start = normalizeDate(joinDate);
        const current = normalizeDate(date);
        const diff = differenceInDays(current, start);
        return diff > 0 && diff % 7 === 0;
    };

    const getMilestoneWeek = (date: Date) => {
        if (!joinDate) return 0;
        const start = normalizeDate(joinDate);
        const current = normalizeDate(date);
        return Math.floor(differenceInDays(current, start) / 7);
    };

    const handleDayClick = (date: Date, isMilestone: boolean) => {
        if (isMilestone) {
            setSelectedDate(date);
            setIsModalOpen(true);
        } else if (onEditProgress) {
            onEditProgress(date);
        }
    };

    const canViewAnalysis = () => {
        const d = new Date();
        const lastDay = endOfMonth(d).getDate();
        return (lastDay - d.getDate()) <= 3;
    };

    const handleAnalysisClick = () => {
        if (canViewAnalysis()) {
            router.push('/analysis');
        } else {
            toast.error(t('analysis_unlock_msg'));
        }
    };

    return (
        <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('hijri_timeline')}</h3>
                        <div className="size-2 rounded-full bg-vic-green animate-pulse" />
                    </div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-widest font-mono">
                        {getHijriDateString(today)}
                    </span>
                </div>

                <button
                    onClick={handleAnalysisClick}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${canViewAnalysis()
                        ? 'bg-vic-green/10 text-vic-green border-vic-green/20'
                        : 'bg-slate-100 text-slate-400 border-slate-200 opacity-70 dark:bg-slate-800 dark:border-slate-700'
                        }`}
                >
                    <BarChart2 size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{t('analysis')}</span>
                </button>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide snap-x -mx-4 px-4 scroll-smooth"
            >
                {scrollableDays.map((date) => {
                    const hijriDay = getHijriDay(date);
                    const isToday = isSameDay(date, today);
                    const isMilestone = isMilestoneDay(date);
                    const weekNum = getMilestoneWeek(date);

                    return (
                        <div
                            key={date.toISOString()}
                            ref={isToday ? todayRef : null}
                            onClick={() => handleDayClick(date, isMilestone)}
                            className={`
                                flex flex-col items-center justify-center min-w-[72px] h-[100px] rounded-2xl snap-center transition-all cursor-pointer relative overflow-hidden flex-shrink-0
                                ${isToday
                                    ? 'bg-vic-green text-slate-900 shadow-xl shadow-vic-green/30 z-10'
                                    : isMilestone
                                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-500/30'
                                        : 'bg-white dark:bg-[#1f2c34] border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }
                                ${isMilestone ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-[#0d1418] scale-[1.05]' : 'scale-100'}
                                active:scale-95
                            `}
                        >
                            {isMilestone && (
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                            )}

                            <span className={`text-[10px] uppercase font-bold tracking-tighter mb-1 ${isToday ? 'text-slate-900/60' : isMilestone ? 'text-indigo-200' : 'text-slate-400'
                                }`}>
                                {new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(date)}
                            </span>

                            <span className="text-2xl font-black leading-none mt-0.5">
                                {hijriDay}
                            </span>

                            <span className={`text-[9px] font-bold mt-1 uppercase ${isToday ? 'text-slate-900/50' : isMilestone ? 'text-indigo-300' : 'text-slate-400'
                                }`}>
                                {getHijriMonthName(date)}
                            </span>
                            
                            <span className={`text-[8px] font-bold mt-1 tracking-wider opacity-60 ${isToday ? 'text-slate-900' : isMilestone ? 'text-indigo-200' : 'text-slate-500'
                                }`}>
                                {date.getDate()} / Month {date.getMonth() + 1}
                            </span>

                            {isMilestone && (
                                <div className="absolute top-1.5 right-1.5 size-2 rounded-full bg-white animate-pulse" />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 flex items-start gap-3 mt-2 border border-indigo-100 dark:border-indigo-800/30 animate-in fade-in slide-in-from-bottom-2">
                <Info className="text-indigo-500 mt-0.5 shrink-0" size={18} />
                <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                    {t('today_is')} <span className="font-bold">{getHijriDateString(today)}</span>. {t('milestone_info')}
                </p>
            </div>

            {user && selectedDate && (
                <MilestoneModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    date={selectedDate}
                    hijriDateString={`${getHijriDay(selectedDate)}${lang === 'en' ? (['1', '21', '31'].includes(String(getHijriDay(selectedDate))) ? 'st' : ['2', '22'].includes(String(getHijriDay(selectedDate))) ? 'nd' : ['3', '23'].includes(String(getHijriDay(selectedDate))) ? 'rd' : 'th') : ''} ${getHijriMonthName(selectedDate)}`}
                    userId={user.id}
                    weekNumber={getMilestoneWeek(selectedDate)}
                />
            )}
        </div>
    );
};
