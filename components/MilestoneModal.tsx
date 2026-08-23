"use client"
import React, { useState, useEffect } from 'react';
import { upsertMilestone, getMilestone } from '@/lib/api/progress';
import { useTranslation } from '@/lib/api/translation';
import { toast } from 'sonner';
import { X, Scale, Dumbbell, Accessibility, Leaf } from 'lucide-react';

interface MilestoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date; // The Gregorian date corresponding to the Hijri milestone
    hijriDateString: string; // "7th Ramadan", etc.
    weekNumber?: number;
    userId: string;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({ isOpen, onClose, date, hijriDateString, weekNumber, userId }) => {
    const { t } = useTranslation();
    const [plan, setPlan] = useState('');
    const [objective, setObjective] = useState<"lose_weight" | "maintain" | "gain_muscle" | "build_muscle">("maintain");
    const [problems, setProblems] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (isOpen && userId) {
            setFetching(true);
            getMilestone(userId, date)
                .then((data) => {
                    if (data) {
                        setPlan(data.plan_suggestion || '');
                        setObjective(data.objective || 'maintain');
                        setProblems(data.problems_faced || '');
                    }
                })
                .catch((err) => console.error(err))
                .finally(() => setFetching(false));
        }
    }, [isOpen, userId, date]);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await upsertMilestone(userId, date, {
                plan_suggestion: plan,
                objective: objective,
                problems_faced: problems
            });
            toast.success(t('save_success'));
            onClose();
        } catch (error: any) {
            toast.error(`${t('update_failed')}: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-white dark:bg-[#1f2c34] p-6 text-left align-middle shadow-xl transition-all border border-white/20 dark:border-slate-700">
                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-vic-green/20 via-emerald-500/10 to-transparent pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <span className="text-xs font-bold text-vic-green uppercase tracking-widest">
                                {weekNumber ? `${t('milestone_week')} ${weekNumber}` : t('milestone_checkpoint')}
                            </span>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{hijriDateString}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <X className="text-slate-500" size={18} />
                        </button>
                    </div>

                    {fetching ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vic-green"></div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('update_objective')}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'lose_weight', label: t('lose_weight'), icon: Scale },
                                        { id: 'gain_muscle', label: t('build_muscle'), icon: Dumbbell },
                                        { id: 'maintain', label: t('maintain'), icon: Accessibility },
                                        { id: 'healthy', label: t('eat_healthy'), icon: Leaf }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setObjective(opt.id as any)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${objective === opt.id
                                                ? 'bg-vic-green text-slate-900 border-vic-green shadow-lg shadow-vic-green/20'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-vic-green/50'
                                                }`}
                                        >
                                            <opt.icon className="mb-1" size={20} />
                                            <span className="text-xs font-bold">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('current_plan_focus')}</label>
                                <textarea
                                    value={plan}
                                    onChange={(e) => setPlan(e.target.value)}
                                    placeholder={t("plan_placeholder")}
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 focus:border-vic-green focus:ring-1 focus:ring-vic-green outline-none min-h-[100px] text-slate-900 dark:text-white placeholder:text-slate-400 font-medium resize-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('challenges_faced')}</label>
                                <textarea
                                    value={problems}
                                    onChange={(e) => setProblems(e.target.value)}
                                    placeholder={t('challenges_placeholder')}
                                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none min-h-[80px] text-slate-900 dark:text-white placeholder:text-slate-400 font-medium resize-none transition-all"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full bg-vic-deep-blue dark:bg-vic-green text-white dark:text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-vic-deep-blue/20 dark:shadow-vic-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />}
                                {loading ? t('saving') : t('save_milestone')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
