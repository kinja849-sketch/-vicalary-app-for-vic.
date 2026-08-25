"use client"
import React, { useRef } from 'react';
import { useTranslation } from '@/lib/api/translation';
import { ImagePlus } from 'lucide-react';

interface ProgressCardProps {
    profile: any;
    dailyProgress: any;
    user: any;
    onAvatarUpload?: (file: File) => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({ profile, dailyProgress, user, onAvatarUpload }) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const caloriesGoal = dailyProgress?.calories_goal || profile?.goal_calories || 2000;
    const caloriesConsumed = dailyProgress?.calories_consumed || 0;
    const caloriesLeft = Math.max(0, caloriesGoal - caloriesConsumed);
    const percentage = Math.min(100, Math.round((caloriesConsumed / caloriesGoal) * 100));

    const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || user?.user_metadata?.full_name || 'User')}&background=13ec37&color=fff&size=128`;

    // SVG parameters for the circular progress
    const size = 120;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onAvatarUpload) {
            onAvatarUpload(file);
        }
    };

    return (
        <div className="p-4">
            <div className="relative overflow-hidden rounded-2xl p-6 shadow-xl shadow-vic-green/10 dark:shadow-black/40 border border-white/20 dark:border-white/5 ring-1 ring-black/5 dark:ring-white/10 transition-all hover:scale-[1.01] hover:shadow-2xl">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#D1F7C4] via-white to-[#A6EB67] dark:from-[#0d1418] dark:via-[#1a2e21] dark:to-[#0B3C7C] bg-[length:200%_200%] animate-gradient-x opacity-90 dark:opacity-100" />

                {/* Glass/Texture Overlay for 3D feel */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-white/20 dark:from-black/40 dark:to-white/5 pointer-events-none" />

                <div className="relative z-10 flex justify-between items-center mb-6 gap-4">
                    <div className="flex-1">
                        <p className="text-slate-700 dark:text-slate-300 text-xs uppercase tracking-widest mb-1 font-black drop-shadow-sm">{t('todays_progress')}</p>
                        <p className="text-6xl font-black text-slate-900 dark:text-white leading-tight drop-shadow-md">
                            {percentage}%
                        </p>
                    </div>

                    {/* Circular Progress with Profile Image */}
                    <div className="relative size-[130px] shrink-0">
                        <svg className="size-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
                            {/* Background Circle */}
                            <circle
                                className="stroke-slate-200/50 dark:stroke-slate-800/50"
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                strokeWidth={strokeWidth + 2}
                            />
                            {/* Progress Circle */}
                            <circle
                                className={`transition-all duration-1000 ease-out fill-none`}
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                strokeWidth={strokeWidth + 2}
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                style={{
                                    stroke: percentage > 100 ? '#ef4444' : percentage > 85 ? '#eab308' : '#13ec37',
                                    filter: 'drop-shadow(0 0 8px rgba(19, 236, 55, 0.3))'
                                }}
                            />
                        </svg>

                        {/* Profile Image in Center - Clickable */}
                        <div
                            onClick={handleAvatarClick}
                            className="absolute inset-3 flex items-center justify-center cursor-pointer group"
                        >
                            <div
                                className="size-full rounded-full border-4 border-white dark:border-[#1f2c34] shadow-xl overflow-hidden bg-cover bg-center transition-transform group-hover:scale-110"
                                style={{ backgroundImage: `url("${avatarUrl}")` }}
                            />

                            {/* Upload Badge */}
                            <div className="absolute -bottom-1 -right-1 size-9 bg-vic-green rounded-full border-2 border-white dark:border-[#1f2c34] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <ImagePlus className="text-slate-900" size={18} />
                            </div>
                        </div>

                        {/* Hidden File Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center py-6 border-t border-black/5 dark:border-white/10">
                    <div className="bg-white/40 dark:bg-black/20 p-2 rounded-xl backdrop-blur-sm border border-white/20 dark:border-white/5">
                        <p className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">{caloriesConsumed}</p>
                        <p className="text-[10px] text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">{t('eaten')}</p>
                    </div>
                    <div className="bg-white/40 dark:bg-black/20 p-2 rounded-xl backdrop-blur-sm border border-white/20 dark:border-white/5">
                        <p className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">{caloriesLeft}</p>
                        <p className="text-[10px] text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">{t('left')}</p>
                    </div>
                    <div className="bg-white/40 dark:bg-black/20 p-2 rounded-xl backdrop-blur-sm border border-white/20 dark:border-white/5">
                        <p className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">{caloriesGoal}</p>
                        <p className="text-[10px] text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">{t('goal_stat')}</p>
                    </div>
                </div>

            </div>
        </div>
    );
};
