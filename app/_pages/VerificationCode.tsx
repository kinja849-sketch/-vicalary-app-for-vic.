"use client"
import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { verifyPhoneCode, sendPhoneVerification } from "@/lib/api/auth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/api/translation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole } from "lucide-react";

export default function VerificationCode() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const phoneNumber = (typeof window !== 'undefined' ? localStorage.getItem("phoneNumber") : null) || "your phone";
    const localPhoneNumber = (typeof window !== 'undefined' ? localStorage.getItem("localPhoneNumber") : null) || "";

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

    // Auto-submit when all digits filled
    useEffect(() => {
        if (code.every(d => d !== "") && !loading) {
            handleVerify();
        }
    }, [code]);

    const handleResend = async () => {
        if (!user) return;
        toast.promise(sendPhoneVerification(user.id, phoneNumber, ""), {
            loading: t('resending_code_msg'),
            success: t('code_sent_msg'),
            error: t('failed_resend_msg')
        });
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
        </div>
    );
}
