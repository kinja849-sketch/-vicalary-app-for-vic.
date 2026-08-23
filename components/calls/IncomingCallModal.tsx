"use client";

import React from 'react';
import { Phone, Video, User, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface IncomingCallModalProps {
    callId?: string;
    conversationId?: string;
    callerId?: string;
    callerName?: string;
    callerAvatar?: string | null;
    callType?: 'voice' | 'video';
    onAccept: (type: 'audio' | 'video') => void;
    onDecline: () => void;
}

export default function IncomingCallModal({
    callId,
    conversationId,
    callerId,
    callerName = 'Incoming Call',
    callerAvatar,
    callType = 'voice',
    onAccept,
    onDecline
}: IncomingCallModalProps) {

    const handleAcceptCall = async () => {
        try {
            await fetch('/api/stream/call/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    call_id: callId,
                    conversation_id: conversationId,
                    caller_id: callerId,
                    status: 'connected',
                    type: callType === 'video' ? 'video' : 'audio'
                })
            });
        } catch (e) {
            console.warn('[IncomingCallModal] Error accepting call status:', e);
        }
        onAccept(callType === 'video' ? 'video' : 'audio');
    };

    const handleDeclineCall = async () => {
        try {
            await fetch('/api/stream/call/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    call_id: callId,
                    conversation_id: conversationId,
                    caller_id: callerId,
                    status: 'declined',
                    type: callType === 'video' ? 'video' : 'audio'
                })
            });
        } catch (e) {
            console.warn('[IncomingCallModal] Error declining call status:', e);
        }
        onDecline();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-3xl flex flex-col justify-between items-center p-8 select-none text-white overflow-hidden"
            >
                {/* Background Ambient Glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-slate-950 pointer-events-none" />

                {/* Top Header */}
                <div className="relative z-10 flex flex-col items-center gap-2 pt-6 text-center">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        <ShieldCheck size={14} />
                        <span>Incoming {callType === 'video' ? 'Video' : 'Audio'} Call</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-100 tracking-tight mt-2">{callerName}</h2>
                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest animate-pulse mt-1">Incoming Call...</p>
                </div>

                {/* Center Pulsing Avatar */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        <motion.div
                            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.6, 0.2] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                            className="absolute inset-2 rounded-full bg-emerald-400/20 blur-xl"
                        />
                        <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-emerald-500/50 shadow-[0_0_80px_rgba(16,185,129,0.4)] bg-slate-900 flex items-center justify-center relative z-10">
                            {callerAvatar ? (
                                <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" />
                            ) : (
                                <User size={64} className="text-emerald-400" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom WhatsApp Style Call Action Buttons */}
                <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6 pb-6">
                    <div className="flex items-center justify-around w-full gap-8">
                        {/* Decline Button */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={handleDeclineCall}
                                className="w-18 h-18 w-[72px] h-[72px] bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-600/40 scale-105 active:scale-95 transition-all duration-200"
                                title="Decline Call"
                            >
                                <Phone className="w-8 h-8 rotate-[135deg]" />
                            </button>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Decline</span>
                        </div>

                        {/* Accept Button */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={handleAcceptCall}
                                className="w-18 h-18 w-[72px] h-[72px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 scale-110 active:scale-95 transition-all duration-200 ring-4 ring-emerald-500/30 animate-pulse"
                                title="Accept Call"
                            >
                                {callType === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                            </button>
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Accept</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
