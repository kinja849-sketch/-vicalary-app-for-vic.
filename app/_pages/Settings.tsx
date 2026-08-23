"use client"
import { useState, useEffect } from "react";
import Link from "next/link"
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Moon, Settings as SettingsIcon, ChevronRight, LogOut, QrCode } from "lucide-react";
import { MyQRCode } from "@/components/MyQRCode";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getUserSettings, updateSettings } from "@/lib/api/settings";
import { useTranslation } from "@/lib/api/translation";
import { useCurrency } from "@/lib/CurrencyContext";
import { toast } from "sonner";

export default function Settings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, signOut } = useAuth();
  const { t, lang, country, refreshLocation } = useTranslation();
  const { currencyCode, setManualOverride, clearOverride } = useCurrency();
  const [darkMode, setDarkMode] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const currenciesList = [
    { code: 'USD', name: 'US Dollar', symbol: '$', country: 'US' },
    { code: 'EUR', name: 'Euro', symbol: '€', country: 'EU' },
    { code: 'GBP', name: 'British Pound', symbol: '£', country: 'GB' },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', country: 'ID' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', country: 'IN' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', country: 'JP' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', country: 'CN' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', country: 'AE' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', country: 'SA' },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', country: 'MY' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', country: 'AU' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', country: 'CA' },
  ];

  // Fetch user settings
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['settings', user?.id],
    queryFn: () => getUserSettings(user!.id),
    enabled: !!user?.id
  });

  const languages = [
    { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
    { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
    { code: 'zh', name: 'Mandarin', native: '中文', flag: '🇨🇳' },
    { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
    { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
    { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'sw', name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪' },
    { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
    { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'so', name: 'Somali', native: 'Soomaali', flag: '🇸🇴' },
    { code: 'my', name: 'Burmese', native: 'မြန်မာ', flag: '🇲🇲' },
    { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
    { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  ];

  // Update settings mutation with optimistic updates for instantaneous language/theme transitions
  const updateSettingsMutation = useMutation({
    mutationFn: (updates: any) => updateSettings(user!.id, updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['settings', user?.id] });
      const previousSettings = queryClient.getQueryData(['settings', user?.id]);
      queryClient.setQueryData(['settings', user?.id], (old: any) => {
        if (!old) return updates;
        return { ...old, ...updates };
      });
      return { previousSettings };
    },
    onError: (error: any, updates, context: any) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings', user?.id], context.previousSettings);
      }
      toast.error(`Failed to update settings: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', user?.id] });
    }
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setDarkMode(savedTheme === "dark");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    updateSettingsMutation.mutate({ theme: newMode ? 'dark' : 'light' });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error: any) {
      toast.error(`Failed to sign out: ${error.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vic-green"></div>
      </div>
    );
  }

  const currentLangObj = languages.find(l => l.code === lang);

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto w-full bg-white dark:bg-[#0d1418]">
      <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 bg-white dark:bg-[#0d1418]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-vic-deep-blue dark:text-vic-green font-bold hover:opacity-70 transition-opacity"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-1 text-center">
          {t('account_settings')}
        </h1>
        <div className="w-6" />
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        {/* General Settings */}
        <SettingGroup title={t('general')}>
          <SettingItem
            label={t('account_settings')}
            icon="account_circle"
            onClick={() => router.push("/profile")}
          />
          <SettingItem
            label={t('language')}
            icon="language"
            value={((settings as any)?.is_language_auto !== false) ? `Auto (${currentLangObj?.native || lang.toUpperCase()})` : (currentLangObj?.native || lang.toUpperCase())}
            onClick={() => setShowLanguageModal(true)}
          />
          <SettingItem
            label="Currency & Region"
            icon="payments"
            value={currencyCode}
            onClick={() => setShowCurrencyModal(true)}
          />
          <SettingItem
            label="My VicCode (QR)"
            icon="qr_code"
            onClick={() => setShowQRModal(true)}
          />
        </SettingGroup>

        {showLanguageModal && (
          <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1f2c34] w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#0d1418]">
                <h2 className="text-lg font-bold">{t('language')}</h2>
                <button onClick={() => setShowLanguageModal(false)}><X size={20} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                <button
                  onClick={() => {
                    updateSettingsMutation.mutate({ is_language_auto: true });
                    setShowLanguageModal(false);
                  }}
                  className={`w-full p-4 text-left flex items-center justify-between border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${((settings as any)?.is_language_auto !== false) ? 'bg-vic-green/10 text-vic-green font-bold' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌎</span>
                    <span>Auto Detect</span>
                  </div>
                  {((settings as any)?.is_language_auto !== false) && <span className="text-vic-green font-bold">✓</span>}
                </button>
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('app_lang', l.code);
                      }
                      updateSettingsMutation.mutate({ language: l.code, is_language_auto: false });
                      setShowLanguageModal(false);
                    }}
                    className={`w-full p-4 text-left flex items-center justify-between border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${((settings as any)?.is_language_auto === false && lang === l.code) ? 'bg-vic-green/10 text-vic-green font-bold' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{l.flag}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{l.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{l.native}</span>
                      </div>
                    </div>
                    {((settings as any)?.is_language_auto === false && lang === l.code) && <span className="text-vic-green font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showCurrencyModal && (
          <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1f2c34] w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#0d1418]">
                <h2 className="text-lg font-bold">Currency & Region</h2>
                <button onClick={() => setShowCurrencyModal(false)}><X size={20} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                <button
                  onClick={() => {
                    clearOverride();
                    setShowCurrencyModal(false);
                    toast.success("Set to Auto Detect IP Location");
                  }}
                  className={`w-full p-4 text-left flex items-center justify-between border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-vic-green/10 text-vic-green font-bold`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌍</span>
                    <span>Auto Detect (IP Location)</span>
                  </div>
                </button>
                {currenciesList.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setManualOverride(c.country, c.code, c.symbol);
                      setShowCurrencyModal(false);
                      toast.success(`Currency set to ${c.code}`);
                    }}
                    className={`w-full p-4 text-left flex items-center justify-between border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${currencyCode === c.code ? 'bg-vic-green/10 text-vic-green font-bold' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold w-12 text-center text-slate-400">{c.code}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">({c.symbol})</span>
                      </div>
                    </div>
                    {currencyCode === c.code && <span className="text-vic-green font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Theme Settings */}
        <SettingGroup title={t('appearance')}>
          <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1f2c34] border-b border-slate-200 dark:border-slate-800 last:border-0">
            <div className="flex items-center gap-3">
              <Moon className="text-slate-600 dark:text-slate-400" size={20} />
              <span className="font-medium text-slate-900 dark:text-white">
                {t('dark_mode')}
              </span>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`w-12 h-7 rounded-full transition-colors ${darkMode ? "bg-vic-green" : "bg-slate-300"
                } relative`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${darkMode ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
        </SettingGroup>

        {/* Notification Settings */}
        <SettingGroup title={t('notifications_section')}>
          <div className="flex items-center justify-between p-4 bg-white dark:bg-[#1f2c34] border-b border-slate-200 dark:border-slate-800 last:border-0">
            <div className="flex items-center gap-3">
              <SettingsIcon className="text-slate-600 dark:text-slate-400" size={20} />
              <span className="font-medium text-slate-900 dark:text-white">
                {t('push_notifications')}
              </span>
            </div>
            <button
              onClick={() => updateSettingsMutation.mutate({ push_notifications_enabled: !settings?.push_notifications_enabled })}
              className={`w-12 h-7 rounded-full transition-colors ${settings?.push_notifications_enabled ? "bg-vic-green" : "bg-slate-300"
                } relative`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${settings?.push_notifications_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
        </SettingGroup>

        {/* Subscription Settings */}
        <SettingGroup title={t('subscription')}>
          <SettingItem
            label={t('premium_features')}
            icon="star"
            value={settings?.subscription_status || "Free Plan"}
            onClick={() => alert("Coming soon!")}
          />
        </SettingGroup>

        {/* Help & Info */}
        <SettingGroup title={t('help_info')}>
          <SettingItem
            label={t('privacy_policy')}
            icon="privacy_tip"
            onClick={() => router.push("/privacy")}
          />
          <SettingItem
            label={t('terms_service')}
            icon="description"
            onClick={() => router.push("/terms")}
          />
          <SettingItem
            label={t('app_version')}
            icon="info"
            value="1.0.0"
            clickable={false}
          />
        </SettingGroup>


        {showQRModal && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowQRModal(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <MyQRCode data={user?.id || ''} fullName={user?.user_metadata?.full_name || user?.email} />
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <div className="p-6 pb-2">
          <button
            onClick={handleSignOut}
            className="w-full px-6 py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            {t('sign_out')}
          </button>
        </div>
      </main>
    </div>
  );
}

function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 border-b border-slate-200 dark:border-slate-800">
      <h3 className="px-6 py-3 text-xs uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
        {title}
      </h3>
      <div className="bg-white dark:bg-[#1f2c34]">{children}</div>
    </div>
  );
}

function SettingItem({
  label,
  icon,
  value,
  onClick,
  clickable = true,
}: {
  label: string;
  icon: string;
  value?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={`w-full flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 last:border-0 ${clickable
        ? "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        : "cursor-default"
        }`}
    >
      <div className="flex items-center gap-3">
        {icon === "account_circle" && <div className="p-2 bg-blue-500/10 rounded-lg"><SettingsIcon size={18} className="text-blue-500" /></div>}
        {icon === "language" && <div className="p-2 bg-emerald-500/10 rounded-lg"><SettingsIcon size={18} className="text-emerald-500" /></div>}
        {icon === "payments" && <div className="p-2 bg-amber-500/10 rounded-lg"><SettingsIcon size={18} className="text-amber-500" /></div>}
        {icon === "qr_code" && <div className="p-2 bg-purple-500/10 rounded-lg"><QrCode size={18} className="text-purple-500" /></div>}
        <span className="font-medium text-slate-900 dark:text-white">
          {label}
        </span>
      </div>
      {value && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {value}
          </span>
          {clickable && (
            <ChevronRight className="text-slate-400" size={18} />
          )}
        </div>
      )}
    </button>
  );
}
