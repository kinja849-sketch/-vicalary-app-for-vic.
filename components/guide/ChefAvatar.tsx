"use client";

import React, { useState, useEffect } from 'react';
import { ChefHat, Mic, Volume2, Sparkles, Radio, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ChefAvatarState = 'idle' | 'listening' | 'speaking' | 'connected' | 'thinking';

interface ChefAvatarProps {
    state?: ChefAvatarState;
    chefName?: string;
    statusText?: string;
    onStartVoiceSession?: () => void;
    onEndVoiceSession?: () => void;
    size?: 'sm' | 'md' | 'lg';
}

export default function ChefAvatar({
    state = 'idle',
    chefName = 'Chef Vic',
    statusText,
    onStartVoiceSession,
    onEndVoiceSession,
    size = 'md'
}: ChefAvatarProps) {
    const isConnected = state !== 'idle';

    const sizeClasses = {
        sm: 'w-16 h-16',
        md: 'w-24 h-24',
        lg: 'w-36 h-36'
    }[size];

    const iconSizes = {
        sm: 24,
        md: 36,
        lg: 52
    }[size];

    return (
        <div className="flex flex-col items-center gap-3 select-none">
            {/* Main Animated Avatar Container */}
            <div className="relative flex items-center justify-center">
                {/* Glow & Pulse Animation when Listening / Speaking */}
                <AnimatePresence>
                    {(state === 'listening' || state === 'speaking') && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ 
                                scale: state === 'speaking' ? [1, 1.25, 1] : [1, 1.1, 1],
                                opacity: [0.4, 0.8, 0.4] 
                            }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ repeat: Infinity, duration: state === 'speaking' ? 1.2 : 2, ease: "easeInOut" }}
                            className={`absolute inset-0 rounded-full blur-xl ${
                                state === 'speaking' ? 'bg-amber-400/40' : 'bg-emerald-500/40'
                            }`}
                        />
                    )}
                </AnimatePresence>

                {/* Outer Ring */}
                <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-tr from-amber-500 via-emerald-500 to-teal-400 p-1 shadow-2xl transition-all duration-500 ${
                    state === 'speaking' ? 'ring-4 ring-amber-400/50 scale-105' : 
                    state === 'listening' ? 'ring-4 ring-emerald-400/50' : ''
                }`}>
                    {/* Inner Content */}
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center relative overflow-hidden border-2 border-white/20">
                        {/* Chef Graphic / Icon */}
                        <div className="relative z-10 flex items-center justify-center text-amber-400">
                            {state === 'thinking' ? (
                                <Loader2 size={iconSizes} className="animate-spin text-teal-400" />
                            ) : (
                                <ChefHat size={iconSizes} className="drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]" />
                            )}
                        </div>

                        {/* Speaking Wave Overlay */}
                        {state === 'speaking' && (
                            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-amber-500/10">
                                <motion.div animate={{ height: ['20%', '80%', '20%'] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-amber-400 rounded-full" />
                                <motion.div animate={{ height: ['40%', '100%', '40%'] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.1 }} className="w-1 bg-amber-400 rounded-full" />
                                <motion.div animate={{ height: ['20%', '60%', '20%'] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} className="w-1 bg-amber-400 rounded-full" />
                            </div>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-full border-2 border-slate-950 text-white shadow-lg ${
                        state === 'speaking' ? 'bg-amber-500' :
                        state === 'listening' ? 'bg-emerald-500' :
                        state === 'thinking' ? 'bg-teal-500' :
                        'bg-slate-700'
                    }`}>
                        {state === 'speaking' ? <Volume2 size={12} /> :
                         state === 'listening' ? <Mic size={12} className="animate-pulse" /> :
                         state === 'thinking' ? <Sparkles size={12} /> :
                         <ChefHat size={12} />}
                    </div>
                </div>
            </div>

            {/* Chef Info & Status */}
            <div className="text-center">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5">
                    {chefName}
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        AI Guide
                    </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {statusText || (
                        state === 'speaking' ? 'Chef is speaking...' :
                        state === 'listening' ? 'Listening to your question...' :
                        state === 'thinking' ? 'Recipe AI thinking...' :
                        'Tap to start voice guide'
                    )}
                </p>
            </div>

            {/* Voice Guide Session Trigger Button */}
            {(onStartVoiceSession || onEndVoiceSession) && (
                <button
                    onClick={isConnected ? onEndVoiceSession : onStartVoiceSession}
                    className={`mt-1 px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                        isConnected ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:bg-rose-500/30' :
                        'bg-vic-green text-white hover:bg-emerald-600 shadow-emerald-500/20'
                    }`}
                >
                    {isConnected ? (
                        <>
                            <Radio size={14} className="animate-pulse" />
                            <span>End Voice Session</span>
                        </>
                    ) : (
                        <>
                            <Mic size={14} />
                            <span>Start Voice Session</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

/**
 * Extension Hook Foundation for future Stream voice agent sessions with Chef Avatar
 */
export function useChefVoiceSession(recipeId?: string) {
    const [avatarState, setAvatarState] = useState<ChefAvatarState>('idle');

    const startSession = async () => {
        setAvatarState('thinking');
        // Placeholder for Stream Audio Room / Voice Agent connection
        setTimeout(() => {
            setAvatarState('listening');
        }, 1000);
    };

    const endSession = async () => {
        setAvatarState('idle');
    };

    return {
        avatarState,
        setAvatarState,
        startSession,
        endSession
    };
}
