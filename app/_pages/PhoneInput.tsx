"use client"
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Smartphone, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { sendPhoneVerification } from "@/lib/api/auth";
import { fetchCountries, Country } from "@/lib/api/countries";
import { detectLocation } from "@/lib/api/location";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/api/translation";

export default function PhoneInput() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch Countries
    const { data: countries } = useQuery({
        queryKey: ['countries'],
        queryFn: fetchCountries,
        staleTime: Infinity
    });

    // Detect initial country
    useEffect(() => {
        const init = async () => {
            try {
                const loc = await detectLocation();
                if (countries) {
                    const country = countries.find(c => c.code === loc.country_code) || countries.find(c => c.dialCode === '+1') || countries[0];
                    setSelectedCountry(country);
                }
            } catch (e) {
                if (countries) setSelectedCountry(countries[0]);
            }
        };
        init();
    }, [countries]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCountries = useMemo(() => {
        if (!countries) return [];
        const excludedCodes = ['IL', 'AE', 'US', 'GB'];
        return countries
            .filter(c =>
                (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.dialCode.includes(searchQuery) ||
                c.code.toLowerCase().includes(searchQuery.toLowerCase())) &&
                !excludedCodes.includes(c.code)
            )
            .sort((a, b) => a.name.localeCompare(b.name)); // Explicit alphabetical sort
    }, [countries, searchQuery]);

    const handleContinue = async () => {
        if (!user || !selectedCountry) return;

        // Basic validation: must be at least 7 digits (global minimum roughly)
        if (phoneNumber.length < 7) {
            toast.error("Please enter a valid phone number");
            return;
        }

        try {
            setLoading(true);
            const fullNumber = `${selectedCountry.dialCode}${phoneNumber}`.replace(/\+/g, '');
            const e164 = `+${fullNumber}`;

            const response = await sendPhoneVerification(user.id, phoneNumber, selectedCountry.dialCode);

            // Store phone number reference
            localStorage.setItem("phoneNumber", e164);
            localStorage.setItem("localPhoneNumber", phoneNumber);
            localStorage.setItem("pending_otp", "true");

            // In a development/testing environment, the backend might return the OTP
            if (response && response.code) {
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    notification_type: 'system',
                    title: 'Kode Verifikasi',
                    content: `Kode verifikasi chat Anda adalah: ${response.code}`
                });
            }

            // Navigate to OTP entry
            toast.success(t('code_sent_msg') || "Verification code sent!");
            router.push("/verification-code");
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
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
                <h2 className="font-bold text-slate-800 dark:text-white uppercase tracking-widest text-xs">{t('verify_phone')}</h2>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 flex flex-col items-center px-6 pt-12 max-w-md mx-auto w-full relative">
                <div className="size-20 bg-vic-green/10 rounded-3xl flex items-center justify-center mb-8">
                    <Smartphone className="text-vic-green" size={36} />
                </div>

                <h1 className="text-3xl font-black text-slate-900 dark:text-white text-center mb-4">
                    {t('chat_verify_title')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-10 leading-relaxed max-w-[280px]">
                    Enter your phone number to enable your global secure chat account.
                </p>

                {/* Custom Input Structure */}
                <div className="w-full space-y-4 relative z-30">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">{t('phone_number_label')}</label>
                        <div className="relative flex items-center bg-white dark:bg-[#1f2c34] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm focus-within:ring-2 focus-within:ring-vic-green/30 focus-within:border-vic-green transition-all overflow-visible">
                            {/* Custom Country Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-2 h-14 px-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-l-2xl border-r border-slate-100 dark:border-slate-800 transition-all min-w-[110px] justify-between"
                                >
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xl">{(selectedCountry as any)?.emoji || '🏳️'}</span>
                                        <span className="font-black text-slate-900 dark:text-white text-sm whitespace-nowrap">
                                            {selectedCountry?.dialCode || '--'}
                                        </span>
                                    </div>
                                    <ChevronDown className="text-slate-400 shrink-0" size={14} />
                                </button>

                                <AnimatePresence>
                                    {isDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full left-0 mt-2 w-[calc(100vw-48px)] sm:w-[320px] bg-white dark:bg-[#1f2c34] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50 origin-top-left"
                                        >
                                            <div className="p-3 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
                                                <input
                                                    type="text"
                                                    placeholder={t('search_country')}
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-[#0d1418] border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-1 focus:ring-vic-green outline-none"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto p-1 py-2 custom-scrollbar">
                                                {filteredCountries.map((country) => (
                                                    <button
                                                        key={`${country.code}-${country.dialCode}`}
                                                        onClick={() => {
                                                            setSelectedCountry(country);
                                                            setIsDropdownOpen(false);
                                                            setSearchQuery("");
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                                                    >
                                                        <span className="text-xl">{(country as any).emoji}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-800 dark:text-white text-xs truncate">
                                                                {country.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 uppercase">{country.code}</p>
                                                        </div>
                                                        <span className="font-bold text-vic-green text-xs">
                                                            {country.dialCode}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                                placeholder={t('phone_number_label')}
                                className="flex-1 h-14 px-4 text-lg font-black bg-transparent text-slate-900 dark:text-white outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 placeholder:font-medium"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleContinue}
                        disabled={phoneNumber.length < 7 || loading}
                        className="w-full py-5 bg-vic-green text-slate-900 font-black rounded-2xl shadow-xl shadow-vic-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale mt-6 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                        {loading && <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent" />}
                        {loading ? "ENABLING CHAT..." : "ENABLE SECURE CHAT"}
                    </button>
                </div>

                <p className="mt-8 text-[10px] text-slate-400 dark:text-slate-500 text-center px-8 relative z-10 leading-relaxed uppercase tracking-tighter">
                    ONE-CLICK VERIFICATION. NO EXTERNAL PROVIDER REQUIRED.
                </p>
            </main>
        </div>
    );
}
