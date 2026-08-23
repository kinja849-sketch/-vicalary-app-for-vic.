"use client"
import React, { useMemo } from 'react';
import Link from 'next/link'
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award, Brain, Sparkles, BarChart2, CheckCircle, Rocket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile } from '@/lib/api/auth';
import { getDailyProgress, getMonthlyAnalysis } from '@/lib/api/progress';
import { differenceInDays, subDays, format, startOfMonth, eachDayOfInterval } from 'date-fns';
import { useTranslation } from '@/lib/api/translation';

export default function ProgressAnalysis() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useTranslation();

    const { data: profile } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: () => getUserProfile(user!.id),
        enabled: !!user?.id
    });

    // Fetch Monthly Analysis
    const { data: analysis, isLoading: analysisLoading, error: analysisError, refetch: refetchAnalysis } = useQuery({
        queryKey: ['monthly-analysis', user?.id, new Date().getMonth()],
        queryFn: () => getMonthlyAnalysis(user!.id, new Date().getFullYear(), new Date().getMonth() + 1),
        enabled: !!user?.id,
        retry: false
    });

    const joinDate = profile?.created_at ? new Date(profile.created_at) : new Date();
    const daysSinceJoin = differenceInDays(new Date(), joinDate);
    const monthsActive = Math.ceil(daysSinceJoin / 30);

    return (
        <div className="flex flex-col min-h-screen max-w-md mx-auto w-full bg-background-light dark:bg-[#0d1418]">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 bg-background-light/90 dark:bg-[#0d1418]/90 backdrop-blur-sm">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-vic-deep-blue dark:text-vic-green font-bold">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t('analysis')}</h1>
                <div className="size-6" /> {/* Spacer */}
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Milestone Summary */}
                <div className="bg-gradient-to-br from-vic-green/20 to-transparent p-6 rounded-3xl border border-vic-green/10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="size-12 rounded-2xl bg-vic-green flex items-center justify-center shadow-lg shadow-vic-green/20">
                            <Award className="text-slate-900" size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{t('elite_progress')}</h2>
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">{t('member_since').split(' ')[0]} {monthsActive} • {daysSinceJoin} {t('active')}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/50 dark:bg-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('checkpoints_label')}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{Math.floor(daysSinceJoin / 7)}</p>
                        </div>
                        <div className="bg-white/50 dark:bg-white/5 p-4 rounded-2xl">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{t('milestones_label')}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{monthsActive}</p>
                        </div>
                    </div>
                </div>

                {/* AI Insights */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{t('ai_insights_title')}</h3>
                        <span className="text-[10px] font-bold text-vic-green bg-vic-green/10 px-2 py-1 rounded-md">
                            {format(new Date(), 'MMMM yyyy')}
                        </span>
                    </div>

                    <div className="bg-white dark:bg-[#1f2c34] p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-black/5 relative overflow-hidden transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-vic-green" />

                        {analysisLoading ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vic-green"></div>
                                <p className="text-xs font-bold text-slate-400 animate-pulse">{t('analyzing_milestones')}</p>
                            </div>
                        ) : analysisError ? (
                            <div className="p-4 text-center">
                                <p className="text-sm text-red-500 font-bold mb-2">{t('analysis_unavailable')}</p>
                                <button onClick={() => refetchAnalysis()} className="text-xs font-bold underline">{t('try_again')}</button>
                            </div>
                        ) : analysis ? (
                            <div className="flex gap-4 items-start">
                                <div className="size-10 rounded-full bg-vic-green/10 flex items-center justify-center shrink-0">
                                    <Brain className="text-vic-green" size={20} />
                                </div>
                                <div className="space-y-4 flex-1">
                                    <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
                                        {analysis.summary}
                                    </p>

                                    {/* Action Plan */}
                                    <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-4 space-y-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('next_steps')}</p>
                                        <ul className="space-y-2">
                                            {analysis.actionPlan?.slice(0, 2).map((tip: string, i: number) => (
                                                <li key={i} className="flex gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    <span className="text-vic-green font-bold">•</span>
                                                    {tip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <Sparkles className="text-vic-green" size={14} />
                                        <p className="text-xs italic text-slate-500 font-medium">"{analysis.motivationalMessage}"</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <BarChart2 className="text-slate-300 mb-2" size={36} />
                                <p className="text-sm font-bold text-slate-500">{t('no_analysis_yet')}</p>
                                <p className="text-xs text-slate-400 mb-4">{t('unlock_milestones_msg')}</p>
                                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {t('check_data_btn')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Activity Feed placeholder */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{t('milestone_journey')}</h3>
                    <div className="space-y-3">
                        {[...Array(Math.min(4, Math.floor(daysSinceJoin / 7)))].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-[#1f2c34] rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="size-10 rounded-xl bg-slate-50 dark:bg-black/20 flex items-center justify-center font-black text-slate-400">
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{t('checkpoint_reached')}</p>
                                    <p className="text-xs text-slate-500">{t('completed_on')} {format(subDays(new Date(), (i + 1) * 7), 'MMM d, yyyy')}</p>
                                </div>
                                <CheckCircle className="text-vic-green" size={20} />
                            </div>
                        ))}
                        {Math.floor(daysSinceJoin / 7) === 0 && (
                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 grayscale opacity-50">
                                <Rocket size={56} />
                                <p className="text-sm font-bold text-slate-500">{t('journey_beginning')}<br />{t('reach_day_7_msg')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Bottom Nav Spacer */}
            <div className="h-20" />
        </div>
    );
}
