"use client"
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { X, Smile, Zap, Leaf, BatteryLow, BrainCircuit, Frown, Save } from 'lucide-react';

interface ManualProgressInputProps {
    onClose: () => void;
    onSuccess?: () => void;
    initialDate?: Date;
}

const MOODS = [
    { label: 'Happy', icon: Smile, color: 'text-yellow-500' },
    { label: 'Energetic', icon: Zap, color: 'text-orange-500' },
    { label: 'Calm', icon: Leaf, color: 'text-blue-500' },
    { label: 'Tired', icon: BatteryLow, color: 'text-slate-500' },
    { label: 'Stressed', icon: BrainCircuit, color: 'text-purple-500' },
    { label: 'Sad', icon: Frown, color: 'text-indigo-500' },
];

export function ManualProgressInput({ onClose, onSuccess, initialDate = new Date() }: ManualProgressInputProps) {
    const { user } = useAuth();
    const [weight, setWeight] = useState('');
    const [mood, setMood] = useState('');
    const [reflection, setReflection] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSubmitting(true);
        try {
            const dateStr = initialDate.toISOString().split('T')[0];

            // 1. Log to progress_measurements
            const { error: measError } = await supabase.from('progress_measurements').upsert({
                user_id: user.id,
                measurement_date: dateStr,
                weight: weight ? parseFloat(weight) : undefined,
                mood,
                reflection
            });

            if (measError) throw measError;

            // 2. Update daily_progress to ensure visibility in calendar/analysis
            const { data: existingProgress } = await supabase
                .from('daily_progress')
                .select('*')
                .eq('user_id', user.id)
                .eq('progress_date', dateStr)
                .maybeSingle();

            if (!existingProgress) {
                await supabase.from('daily_progress').insert({
                    user_id: user.id,
                    progress_date: dateStr,
                    calories_consumed: 0,
                    meals_logged: 0
                });
            }

            toast.success('Daily progress updated!');
            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to update progress: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Daily Check-in</h2>
                    <button onClick={onClose} className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <X size={14} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Weight */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Morning Weight (kg)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="0.0"
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border-none text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-vic-green transition-all"
                        />
                    </div>

                    {/* Mood */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Mood</label>
                        <div className="grid grid-cols-3 gap-2">
                            {MOODS.map((m) => (
                                <button
                                    key={m.label}
                                    type="button"
                                    onClick={() => setMood(m.label)}
                                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all border ${mood === m.label
                                            ? 'bg-vic-green/10 border-vic-green shadow-lg shadow-vic-green/10'
                                            : 'bg-slate-50 dark:bg-black/20 border-transparent hover:bg-slate-100 dark:hover:bg-black/30'
                                        }`}
                                >
                                    <m.icon className={mood === m.label ? 'text-vic-green' : m.color} size={20} />
                                    <span className="text-[10px] font-bold text-slate-500">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reflection */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reflections / Wins</label>
                        <textarea
                            value={reflection}
                            onChange={(e) => setReflection(e.target.value)}
                            placeholder="What went well today?"
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-black/20 border-none text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-vic-green transition-all resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-vic-green text-slate-900 font-black rounded-2xl shadow-xl shadow-vic-green/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-slate-900"></div>
                        ) : (
                            <>
                                <Save size={18} />
                                SAVE PROGRESS
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
