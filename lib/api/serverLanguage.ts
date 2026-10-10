import { SupabaseClient } from '@supabase/supabase-js';

export type SupportedLanguage = 
  | 'en' | 'ar' | 'ur' | 'bn' | 'hi' | 'zh' | 'es' | 'fr' | 'pt' | 'ru' 
  | 'id' | 'sw' | 'mr' | 'te' | 'ta' | 'vi' | 'so' | 'my' | 'ko' | 'tr' | 'de';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'en', 'ar', 'ur', 'bn', 'hi', 'zh', 'es', 'fr', 'pt', 'ru',
  'id', 'sw', 'mr', 'te', 'ta', 'vi', 'so', 'my', 'ko', 'tr', 'de'
];

export const RTL_LANGUAGES: SupportedLanguage[] = ['ar', 'ur'];

export const LANGUAGE_META: Record<SupportedLanguage, { name: string; native: string; speechCode: string; isRTL: boolean }> = {
  en: { name: 'English', native: 'English', speechCode: 'en-US', isRTL: false },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia', speechCode: 'id-ID', isRTL: false },
  ar: { name: 'Arabic', native: 'العربية', speechCode: 'ar-SA', isRTL: true },
  ur: { name: 'Urdu', native: 'اردو', speechCode: 'ur-PK', isRTL: true },
  bn: { name: 'Bengali', native: 'বাংলা', speechCode: 'bn-BD', isRTL: false },
  hi: { name: 'Hindi', native: 'हिन्दी', speechCode: 'hi-IN', isRTL: false },
  zh: { name: 'Mandarin Chinese', native: '中文', speechCode: 'zh-CN', isRTL: false },
  es: { name: 'Spanish', native: 'Español', speechCode: 'es-ES', isRTL: false },
  fr: { name: 'French', native: 'Français', speechCode: 'fr-FR', isRTL: false },
  pt: { name: 'Portuguese', native: 'Português', speechCode: 'pt-PT', isRTL: false },
  ru: { name: 'Russian', native: 'Русский', speechCode: 'ru-RU', isRTL: false },
  sw: { name: 'Swahili', native: 'Kiswahili', speechCode: 'sw-KE', isRTL: false },
  mr: { name: 'Marathi', native: 'मराठी', speechCode: 'mr-IN', isRTL: false },
  te: { name: 'Telugu', native: 'తెలుగు', speechCode: 'te-IN', isRTL: false },
  ta: { name: 'Tamil', native: 'தமிழ்', speechCode: 'ta-IN', isRTL: false },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt', speechCode: 'vi-VN', isRTL: false },
  so: { name: 'Somali', native: 'Soomaali', speechCode: 'so-SO', isRTL: false },
  my: { name: 'Burmese', native: 'မြန်မာ', speechCode: 'my-MM', isRTL: false },
  ko: { name: 'Korean', native: '한국어', speechCode: 'ko-KR', isRTL: false },
  tr: { name: 'Turkish', native: 'Türkçe', speechCode: 'tr-TR', isRTL: false },
  de: { name: 'German', native: 'Deutsch', speechCode: 'de-DE', isRTL: false },
};

export const CODE_ALIAS_MAP: Record<string, SupportedLanguage> = {
  'ind': 'id', 'indonesia': 'id', 'id-id': 'id',
  'eng': 'en', 'english': 'en', 'en-us': 'en', 'en-gb': 'en',
  'fra': 'fr', 'fre': 'fr', 'french': 'fr', 'fr-fr': 'fr',
  'deu': 'de', 'ger': 'de', 'german': 'de', 'de-de': 'de', 'nld': 'de', 'dut': 'de',
  'hin': 'hi', 'hindi': 'hi', 'hi-in': 'hi',
  'msa': 'id', 'may': 'id', 'malay': 'id', 'ms-my': 'id',
  'spa': 'es', 'spanish': 'es', 'es-es': 'es', 'es-mx': 'es', 'ita': 'es',
  'jpn': 'zh', 'kor': 'ko', 'korean': 'ko', 'ko-kr': 'ko',
  'chi': 'zh', 'zho': 'zh', 'chinese': 'zh', 'zh-cn': 'zh', 'zh-tw': 'zh',
  'ara': 'ar', 'arabic': 'ar', 'ar-sa': 'ar', 'ar-ae': 'ar', 'ar-eg': 'ar',
  'urd': 'ur', 'urdu': 'ur', 'ur-pk': 'ur',
  'ben': 'bn', 'bengali': 'bn', 'bn-bd': 'bn',
  'por': 'pt', 'portuguese': 'pt', 'pt-pt': 'pt', 'pt-br': 'pt',
  'rus': 'ru', 'russian': 'ru', 'ru-ru': 'ru',
  'swa': 'sw', 'swahili': 'sw', 'sw-ke': 'sw',
  'mar': 'mr', 'marathi': 'mr', 'mr-in': 'mr',
  'tel': 'te', 'telugu': 'te', 'te-in': 'te',
  'tam': 'ta', 'tamil': 'ta', 'ta-in': 'ta',
  'vie': 'vi', 'vietnamese': 'vi', 'vi-vn': 'vi',
  'som': 'so', 'somali': 'so', 'so-so': 'so',
  'mya': 'my', 'burmese': 'my', 'my-mm': 'my',
  'tur': 'tr', 'turkish': 'tr', 'tr-tr': 'tr'
};

export const COUNTRY_TO_LANG: Record<string, SupportedLanguage> = {
  'ID': 'id', 'MY': 'id',
  'US': 'en', 'GB': 'en', 'CA': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en',
  'FR': 'fr', 'MC': 'fr', 'SN': 'fr', 'CI': 'fr', 'CM': 'fr', 'CD': 'fr',
  'DE': 'de', 'AT': 'de', 'LI': 'de', 'LU': 'de',
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'PE': 'es', 'CL': 'es',
  'SA': 'ar', 'AE': 'ar', 'EG': 'ar', 'QA': 'ar', 'KW': 'ar', 'OM': 'ar',
  'BH': 'ar', 'JO': 'ar', 'LB': 'ar', 'YE': 'ar', 'IQ': 'ar', 'DZ': 'ar',
  'MA': 'ar', 'TN': 'ar', 'LY': 'ar', 'SD': 'ar', 'SY': 'ar', 'PS': 'ar',
  'IN': 'hi', 'BD': 'bn', 'PK': 'ur', 'CN': 'zh', 'TW': 'zh', 'HK': 'zh',
  'RU': 'ru', 'BY': 'ru', 'KZ': 'ru', 'KG': 'ru',
  'BR': 'pt', 'PT': 'pt', 'AO': 'pt', 'MZ': 'pt',
  'VN': 'vi', 'TR': 'tr', 'KR': 'ko', 'MM': 'my',
  'KE': 'sw', 'TZ': 'sw', 'UG': 'sw', 'RW': 'sw',
  'SO': 'so', 'DJ': 'so'
};

export function normalizeLanguageCode(raw?: string | null): SupportedLanguage | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim().toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(clean as SupportedLanguage)) {
    return clean as SupportedLanguage;
  }
  const prefix = clean.split('-')[0].split('_')[0];
  if (SUPPORTED_LANGUAGES.includes(prefix as SupportedLanguage)) {
    return prefix as SupportedLanguage;
  }
  if (CODE_ALIAS_MAP[clean]) {
    return CODE_ALIAS_MAP[clean];
  }
  if (CODE_ALIAS_MAP[prefix]) {
    return CODE_ALIAS_MAP[prefix];
  }
  return null;
}

export interface ResolveUserLanguageOptions {
  userId?: string | null;
  requestLanguage?: string | null;
  locationContext?: {
    country_code?: string;
    country?: string;
    language?: string;
    languages?: string[];
  } | null;
  supabase?: SupabaseClient | any;
}

/**
 * Resolves authoritative language following the strict 4-step hierarchy:
 * 1. Manual User Selection (is_language_auto === false in user_settings, or explicit requestLanguage)
 * 2. IP / Geolocation Location Context
 * 3. Fallback to English
 */
export async function resolveUserLanguage(options: ResolveUserLanguageOptions): Promise<SupportedLanguage> {
  const { userId, requestLanguage, locationContext, supabase } = options;

  let dbSettings: { language?: string; is_language_auto?: boolean; country_code?: string } | null = null;

  if (userId && supabase) {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('language, is_language_auto, country_code')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) dbSettings = data;
    } catch (e) {
      // ignore
    }
  }

  // 1. Check if user manually selected a language in DB settings
  if (dbSettings && dbSettings.is_language_auto === false && dbSettings.language) {
    const normalized = normalizeLanguageCode(dbSettings.language);
    if (normalized) return normalized;
  }

  // 2. Check explicit request language from client (e.g. from useTranslation / localStorage)
  if (requestLanguage) {
    const normalized = normalizeLanguageCode(requestLanguage);
    if (normalized) return normalized;
  }

  // 3. If settings has a language saved and not explicitly auto, check it
  if (dbSettings?.language && dbSettings.is_language_auto !== true) {
    const normalized = normalizeLanguageCode(dbSettings.language);
    if (normalized) return normalized;
  }

  // 4. IP Geolocation context
  if (locationContext) {
    if (locationContext.language) {
      const normalized = normalizeLanguageCode(locationContext.language);
      if (normalized) return normalized;
    }
    if (Array.isArray(locationContext.languages) && locationContext.languages.length > 0) {
      for (const candidate of locationContext.languages) {
        const normalized = normalizeLanguageCode(candidate);
        if (normalized) return normalized;
      }
    }
    const countryCode = (locationContext.country_code || locationContext.country || '').toUpperCase();
    if (countryCode && COUNTRY_TO_LANG[countryCode]) {
      return COUNTRY_TO_LANG[countryCode];
    }
  }

  if (dbSettings?.country_code) {
    const countryCode = dbSettings.country_code.toUpperCase();
    if (COUNTRY_TO_LANG[countryCode]) {
      return COUNTRY_TO_LANG[countryCode];
    }
  }

  return 'en';
}

/**
 * Standard AI prompt directive to enforce output exclusively in the target language.
 */
export function buildAILanguageDirective(lang: SupportedLanguage): string {
  const meta = LANGUAGE_META[lang] || LANGUAGE_META.en;
  if (lang === 'en') {
    return `CRITICAL LANGUAGE REQUIREMENT: You MUST generate your response in fluent English.`;
  }
  return `CRITICAL LANGUAGE REQUIREMENT:
You MUST write and generate your entire output EXCLUSIVELY in fluent ${meta.name} (${meta.native}, language code: '${lang}').
Under NO circumstance should you output in English. Every text, explanation, recommendation, and description must be in ${meta.name}.`;
}
