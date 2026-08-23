"use client"
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { detectLocation, getPrimaryLanguage } from './location';
import { updateSettings } from './settings';
import { toast } from 'sonner';

import i18n from 'i18next';
import { initReactI18next, useTranslation as useI18nextTranslation } from 'react-i18next';

import { en } from '../translations/en';
import { ar } from '../translations/ar';
import { ur } from '../translations/ur';
import { bn } from '../translations/bn';
import { hi } from '../translations/hi';
import { zh } from '../translations/zh';
import { es } from '../translations/es';
import { fr } from '../translations/fr';
import { pt } from '../translations/pt';
import { ru } from '../translations/ru';
import { id } from '../translations/id';
import { sw } from '../translations/sw';
import { mr } from '../translations/mr';
import { te } from '../translations/te';
import { ta } from '../translations/ta';
import { vi } from '../translations/vi';
import { so } from '../translations/so';
import { my } from '../translations/my';
import { ko } from '../translations/ko';
import { tr } from '../translations/tr';
import { de } from '../translations/de';

export type Language = 'en' | 'ar' | 'ur' | 'bn' | 'hi' | 'zh' | 'es' | 'fr' | 'pt' | 'ru' | 'id' | 'sw' | 'mr' | 'te' | 'ta' | 'vi' | 'so' | 'my' | 'ko' | 'tr' | 'de';

const translations: Record<Language, Record<string, string>> = {
    en, ar, ur, bn, hi, zh, es, fr, pt, ru, id, sw, mr, te, ta, vi, so, my, ko, tr, de
};

const resources = Object.keys(translations).reduce((acc, key) => {
    acc[key] = { translation: translations[key as Language] };
    return acc;
}, {} as Record<string, any>);

import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'app_lang',
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false
    }
  });

export const getTranslation = (lang: string = 'en', key: string): string => {
    return i18n.getResource(lang, 'translation', key) || i18n.getResource('en', 'translation', key) || key;
};

export const useTranslation = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { t: i18nT } = useI18nextTranslation();

    const { data: settings } = useQuery({
        queryKey: ['settings', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .limit(1);
            return data && data.length > 0 ? data[0] : null;
        },
        enabled: !!user?.id
    });

    const { data: detectedLoc, refetch: refreshLocation } = useQuery({
        queryKey: ['detected-location'],
        queryFn: () => detectLocation(),
        staleTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        initialData: () => {
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem('vicalary_location_v3');
                if (cached) {
                    try {
                        const { data, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                            return data;
                        }
                    } catch (e) {}
                }
            }
            return undefined;
        }
    });

    const getBrowserLang = () => {
        if (typeof window !== 'undefined' && window.navigator) {
            const navLangs = window.navigator.languages;
            if (navLangs && navLangs.length > 0) {
                return getPrimaryLanguage(navLangs as string[]) || 'en';
            }
            return getPrimaryLanguage(window.navigator.language) || 'en';
        }
        return 'en';
    };

    const isAuto = (settings as any)?.is_language_auto !== false;
    const cachedLang = (typeof window !== 'undefined' ? localStorage.getItem('app_lang') : null) as Language;

    const rawLang = !isAuto
        ? ((settings as any)?.language || cachedLang || getBrowserLang() || 'en')
        : (getPrimaryLanguage(detectedLoc?.languages) || (settings as any)?.language || cachedLang || getBrowserLang() || 'en');

    // Location-only effect removed in favor of direct finalLang syncing to app_lang below

    useEffect(() => {
        if (user && detectedLoc && isAuto) {
            const syncKey = `location_synced_${user.id}`;
            const toastKey = `location_toasted_${user.id}`;
            
            const lastSync = typeof window !== 'undefined' ? localStorage.getItem(syncKey) : null;
            const todayStr = new Date().toISOString().split('T')[0];
            if (lastSync === todayStr) return;

            const s = settings as any;
            const needsSync = !s ||
                s.language !== getPrimaryLanguage(detectedLoc?.languages) ||
                s.country_code !== detectedLoc?.country_code ||
                s.currency !== detectedLoc?.currency ||
                (s.timezone !== detectedLoc?.timezone);

            if (needsSync) {
                if (typeof window !== 'undefined') localStorage.setItem(syncKey, todayStr);
                updateSettings(user.id, {
                    language: getPrimaryLanguage(detectedLoc?.languages),
                    currency: detectedLoc?.currency,
                    timezone: detectedLoc?.timezone,
                    country_code: detectedLoc?.country_code,
                    is_language_auto: true
                }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['settings', user.id] });

                    if (s && s.country_code !== detectedLoc?.country_code && typeof window !== 'undefined' && !localStorage.getItem(toastKey)) {
                        toast.success(getTranslation(getPrimaryLanguage(detectedLoc?.languages), 'location_updated_toast').replace('%s', detectedLoc?.country_name || ''), {
                            icon: '🌎',
                            duration: 5000
                        });
                        localStorage.setItem(toastKey, todayStr);
                    }
                }).catch(err => {
                    console.error("Failed to sync location settings:", err);
                    if (typeof window !== 'undefined') localStorage.removeItem(syncKey);
                });
            } else {
                if (typeof window !== 'undefined') localStorage.setItem(syncKey, todayStr);
            }
        }
    }, [detectedLoc, isAuto, user, settings, queryClient]);

    const langMap: Record<string, Language> = {
        'ind': 'id', 'eng': 'en', 'fra': 'fr', 'deu': 'de', 'ger': 'de',
        'hin': 'hi', 'msa': 'id', 'may': 'id', 'nld': 'de', 'dut': 'de',
        'spa': 'es', 'ita': 'es', 'jpn': 'zh', 'kor': 'ko', 'chi': 'zh', 'zho': 'zh',
        'ara': 'ar', 'urd': 'ur', 'ben': 'bn', 'por': 'pt', 'rus': 'ru',
        'swa': 'sw', 'mar': 'mr', 'tel': 'te', 'tam': 'ta', 'vie': 'vi',
        'som': 'so', 'mya': 'my', 'tur': 'tr'
    };

    const finalLang = langMap[rawLang.toLowerCase()] || (translations[rawLang as Language] ? rawLang : 'en') as Language;

    useEffect(() => {
        if (i18n.language !== finalLang) {
            i18n.changeLanguage(finalLang);
        }
        if (typeof window !== 'undefined' && finalLang) {
            localStorage.setItem('app_lang', finalLang);
        }
    }, [finalLang]);

    const lang = finalLang;
    const currency = (settings as any)?.currency || detectedLoc?.currency || 'USD';
    const timezone = (settings as any)?.timezone || detectedLoc?.timezone || 'UTC';
    const country = (settings as any)?.country_code || detectedLoc?.country_name || 'Global';
    const countryCode = (settings as any)?.country_code || detectedLoc?.country_code || 'US';
    const countryFlag = detectedLoc?.flag || '';

    const currencySymbols: Record<string, string> = {
        'USD': '$', 'GBP': '£', 'EUR': '€', 'IDR': 'Rp', 'NGN': '₦', 'MYR': 'RM', 'INR': '₹',
        'SAR': 'SR', 'AED': 'DH', 'PKR': 'Rs', 'BDT': '৳', 'BRL': 'R$', 'RUB': '₽', 'KES': 'KSh',
        'VND': '₫', 'SOS': 'Sh', 'MMK': 'K', 'TRY': '₺', 'CNY': '¥'
    };

    const currencySymbol = (settings as any)?.currency_symbol || detectedLoc?.currency_symbol || currencySymbols[currency] || '$';
    
    // Explicitly fallback to old logic if i18next returns key directly due to missing resource
    const t = (key: string) => {
        const res = i18nT(key);
        return res === key ? getTranslation(lang, key) : res;
    };

    const formatCurrency = (amount: number) => {
        return `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getLocalHour = () => {
        try {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = { hour: 'numeric', hour12: false, timeZone: timezone };
            const formatter = new Intl.DateTimeFormat('en-US', options);
            return parseInt(formatter.format(now));
        } catch (e) {
            return new Date().getHours();
        }
    };

    const localHour = getLocalHour();

    const speak = (text: string) => {
        if (!text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const langCodeMap: Record<Language, string> = {
            'en': 'en-US', 'ar': 'ar-SA', 'ur': 'ur-PK', 'bn': 'bn-BD',
            'hi': 'hi-IN', 'zh': 'zh-CN', 'es': 'es-ES', 'fr': 'fr-FR',
            'pt': 'pt-PT', 'ru': 'ru-RU', 'id': 'id-ID', 'sw': 'sw-KE',
            'mr': 'mr-IN', 'te': 'te-IN', 'ta': 'ta-IN', 'vi': 'vi-VN',
            'so': 'so-SO', 'my': 'my-MM', 'ko': 'ko-KR', 'tr': 'tr-TR', 'de': 'de-DE'
        };
        utterance.lang = langCodeMap[lang] || 'en-US';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    };

    return { 
        t, 
        lang: finalLang, 
        currency, 
        currencySymbol, 
        timezone, 
        country, 
        countryCode,
        countryFlag,
        localHour, 
        formatCurrency, 
        speak, 
        refreshLocation, 
        isAuto 
    };
};
