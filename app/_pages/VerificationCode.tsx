"use client"
import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { verifyPhoneCode, sendPhoneVerification } from "@/lib/api/auth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/api/translation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, KeyRound, Check, Copy, X } from "lucide-react";

export default function VerificationCode() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
    const [popupCode, setPopupCode] = useState<string | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [copied, setCopied] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const phoneNumber = (typeof window !== 'undefined' ? localStorage.getItem("phoneNumber") : null) || "your phone";
    const localPhoneNumber = (typeof window !== 'undefined' ? localStorage.getItem("localPhoneNumber") : null) || "";

    // Read pending OTP code on mount
    useEffect(() => {
        const pending = typeof window !== 'undefined' ? sessionStorage.getItem("pending_otp_code") : null;
        if (pending) {
            setPopupCode(pending);
            setShowPopup(true);
        }
    }, []);

    // Focus first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();

        if (!user) return;

        // NEW: Subscribe to chat_users changes for this user
        // This enables the "automatic verification" as soon as the alert is sent
        const channel = supabase
            .channel('chat-user-sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_users',
                filter: `user_id=eq.${user.id}`
            }, (payload: any) => {
                if (payload.new && payload.new.is_verified) {
                    queryClient.setQueryData(['chat-verified', user.id], true);
                    toast.success(t('phone_verified_msg'));

                    // Add verification alert notification
                    supabase.from('notifications').insert({
                        user_id: user.id,
                        notification_type: 'verification_success',
                        title: 'Phone Verified!',
                        content: 'Your phone number has been successfully verified for chat.'
                    }).then(() => { });

                    localStorage.removeItem("pending_otp");
                    sessionStorage.removeItem("pending_otp_code");
                    setShowPopup(false);
                    router.push("/chat?view=contacts");
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, router, t, queryClient]);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        // Take the last character if value.length > 1 (e.g. mobile auto-fill or keyboard quirks)
        const char = value.slice(-1);
        newCode[index] = char;
        setCode(newCode);

        // Auto-focus next input
        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            e.preventDefault(); // Prevent default backspace behavior
            const newCode = [...code];
            if (code[index] !== "") {
                newCode[index] = "";
                setCode(newCode);
            } else if (index > 0) {
                newCode[index - 1] = "";
                setCode(newCode);
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").trim();
        if (!/^\d+$/.test(pastedData)) return; // Only allow digits

        const digits = pastedData.slice(0, 6).split("");
        const newCode = [...code];
        digits.forEach((d, i) => {
            newCode[i] = d;
        });
        setCode(newCode);

        // Focus the last filled box or last box if all filled
        const nextFocus = Math.min(digits.length, 5);
        inputRefs.current[nextFocus]?.focus();
    };

    const handleVerify = async () => {
        if (!user) return;

        const verificationCode = code.join("");
        if (verificationCode.length === 6) {
            try {
                setLoading(true);
                // Use the full E164 number stored in localStorage for consistent verification
                await verifyPhoneCode(user.id, phoneNumber, verificationCode);
                queryClient.setQueryData(['chat-verified', user.id], true);
                toast.success(t('phone_verified_msg'));

                // Add verification alert notification
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    notification_type: 'verification_success',
                    title: 'Phone Verified!',
                    content: 'Your phone number has been successfully verified for chat.'
                });

                localStorage.removeItem("pending_otp");
                sessionStorage.removeItem("pending_otp_code");
                setShowPopup(false);
                router.push("/chat?view=contacts");
            } catch (error: any) {
                toast.error(`Verification failed: ${error.message}`);
                setCode(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            } finally {
                setLoading(false);
            }
        }
    };

    const handleInsertCode = () => {
        if (!popupCode) return;
        const digits = popupCode.slice(0, 6).split("");
        setCode(digits);
        setShowPopup(false);
    };

    const handleCopyCode = () => {
        if (!popupCode) return;
        navigator.clipboard.writeText(popupCode);
        setCopied(true);
        toast.success("Code copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    // Auto-submit when all digits filled
    useEffect(() => {
        if (code.every(d => d !== "") && !loading) {
            handleVerify();
        }
    }, [code]);

    const handleResend = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const res = await sendPhoneVerification(user.id, phoneNumber, "");
            const newCode = res?.code || res?.devCode;
            if (newCode) {
                sessionStorage.setItem("pending_otp_code", newCode);
                setPopupCode(newCode);
                setShowPopup(true);

                // Add to notifications table for Alerts tab
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    notification_type: 'system',
                    title: 'Kode Verifikasi',
                    content: `Kode verifikasi chat Anda adalah: ${newCode}`
                });
            }
            toast.success(t('code_sent_msg') || "Verification code sent!");
        } catch (error: any) {
            toast.error(t('failed_resend_msg') || error.message || "Failed to resend code");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-slate-50 dark:bg-[#0d1418] font-display overflow-hidden">
            {/* Header */}
            <header className="p-4 flex items-center justify-between sticky top-0 z-20 bg-white/80 dark:bg-[#0d1418]/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
                <button onClick={() => router.back()} className="text-slate-600 dark:text-slate-400 p-2">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="font-bold text-slate-800 dark:text-white">{t('enter_code_title')}</h2>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 flex flex-col items-center px-6 pt-12 max-w-md mx-auto w-full">
                <div className="size-20 bg-vic-green/10 rounded-3xl flex items-center justify-center mb-8 rotate-12">
                    <LockKeyhole className="text-vic-green" size={36} />
                </div>

                <h1 className="text-3xl font-black text-slate-900 dark:text-white text-center mb-4">
                    {t('check_messages')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-10 leading-relaxed font-medium">
                    {t('sent_code_to')} <span className="text-vic-green font-bold">{phoneNumber}</span>
                </p>

                {/* Code Inputs */}
                <div className="flex justify-center gap-2 sm:gap-3 mb-10" onPaste={handlePaste}>
                    {code.map((digit, index) => (
                        <motion.input
                            key={index}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            ref={(el) => { inputRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onFocus={() => setFocusedIndex(index)}
                            onBlur={() => setFocusedIndex(null)}
                            className={`size-12 sm:size-14 text-center text-2xl font-black rounded-2xl border bg-white dark:bg-[#1f2c34] text-slate-900 dark:text-white shadow-sm outline-none transition-all
                                ${focusedIndex === index 
                                    ? 'border-vic-green ring-2 ring-vic-green/20' 
                                    : digit 
                                        ? 'border-vic-green/50 dark:border-vic-green/30' 
                                        : 'border-slate-200 dark:border-slate-800'
                                }
                            `}
                        />
                    ))}
                </div>

                <div className="w-full space-y-6">
                    <button
                        onClick={handleVerify}
                        disabled={code.some(d => d === "") || loading}
                        className="w-full py-5 bg-vic-green text-slate-900 font-black rounded-2xl shadow-xl shadow-vic-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                    >
                        {loading && <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent" />}
                        {loading ? t('verifying_btn') : t('verify_code_btn')}
                    </button>

                    <div className="text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            {t('didnt_receive_code')}
                        </p>
                        <button
                            onClick={handleResend}
                            className="text-vic-green font-black hover:underline mt-1 underline-offset-4"
                        >
                            {t('resend_code')}
                        </button>
                    </div>
                </div>
            </main>

            {/* Verification Code On-Screen Popup */}
            <AnimatePresence>
                {showPopup && popupCode && (
                    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 350 }}
                            className="w-full max-w-sm bg-white dark:bg-[#1f2c34] rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative mt-12 sm:mt-0"
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setShowPopup(false)}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors"
                                aria-label="Dismiss"
                            >
                                <X size={18} />
                            </button>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="size-10 rounded-2xl bg-vic-green/10 flex items-center justify-center text-vic-green">
                                    <KeyRound size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                        Verification Code
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        In-app verification delivery
                                    </p>
                                </div>
                            </div>

                            {/* Digits Display */}
                            <div className="my-5 p-4 bg-slate-50 dark:bg-[#0d1418] rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center gap-2">
                                {popupCode.split("").map((digit, i) => (
                                    <span
                                        key={i}
                                        className="size-10 flex items-center justify-center text-2xl font-black text-slate-900 dark:text-white bg-white dark:bg-[#1f2c34] rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700 font-mono"
                                    >
                                        {digit}
                                    </span>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2.5">
                                <button
                                    onClick={handleInsertCode}
                                    className="w-full py-3.5 bg-vic-green text-slate-900 font-black rounded-xl shadow-lg shadow-vic-green/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                                >
                                    <Check size={16} strokeWidth={3} />
                                    Insert Code
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopyCode}
                                        className="flex-1 py-2.5 bg-slate-100 dark:bg-[#2a3942] hover:bg-slate-200 dark:hover:bg-[#32424b] text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs"
                                    >
                                        {copied ? <Check size={14} className="text-vic-green" /> : <Copy size={14} />}
                                        {copied ? "Copied" : "Copy Code"}
                                    </button>
                                    <button
                                        onClick={() => setShowPopup(false)}
                                        className="py-2.5 px-4 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-semibold rounded-xl transition-colors text-xs"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
