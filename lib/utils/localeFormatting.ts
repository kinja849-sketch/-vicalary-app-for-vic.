/**
 * Global Locale Formatting Engine
 * Provides deterministic numeral systems conversion and username language adaptation
 * across VicCalary.
 */

// Native numeral systems mapping
export const NUMERAL_SYSTEMS: Record<string, string[]> = {
  ar: ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
  ur: ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
  bn: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
  hi: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  mr: ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  my: ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'],
};

/**
 * Localizes any numeric digits (0-9) inside a string or number to the target language's
 * native numeral system (e.g. Arabic Eastern numerals ٠-٩).
 */
export function localizeDigits(input: string | number | null | undefined, lang: string = 'en'): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  const normalizedLang = (lang || 'en').toLowerCase().split('-')[0];
  const digits = NUMERAL_SYSTEMS[normalizedLang];
  if (!digits) return str;

  return str.replace(/\d/g, (digit) => digits[parseInt(digit, 10)] ?? digit);
}

/**
 * Formats a number with standard options and localizes digits into the target numeral system.
 */
export function localizeNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
  lang: string = 'en'
): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  const formatted = new Intl.NumberFormat('en-US', options).format(value);
  return localizeDigits(formatted, lang);
}

// Canonical name dictionaries across supported scripts
const CANONICAL_NAMES: Record<string, Record<string, string>> = {
  // Common Islamic / Somali / Middle Eastern & Global names
  'liban': {
    ar: 'ليبان',
    ur: 'لیبان',
    bn: 'লিবান',
    hi: 'लिबान',
    mr: 'लिबान',
    ru: 'Либан',
    zh: '利班',
    ko: '리반',
    my: 'လီဘန်'
  },
  'said': {
    ar: 'سعيد',
    ur: 'سعید',
    bn: 'সাইদ',
    hi: 'सईद',
    mr: 'सईद',
    ru: 'Саид',
    zh: '赛义德',
    ko: '사이드',
    my: 'ဆာအိဒ်'
  },
  'saeed': {
    ar: 'سعيد',
    ur: 'سعید',
    bn: 'সাইদ',
    hi: 'सईद',
    mr: 'सईद',
    ru: 'Саид',
    zh: '赛义德',
    ko: '사이드',
    my: 'ဆာအိဒ်'
  },
  'sultan': {
    ar: 'سلطان',
    ur: 'سلطان',
    bn: 'সুলতান',
    hi: 'सुल्तान',
    mr: 'सुल्तान',
    ru: 'Султан',
    zh: '苏丹',
    ko: '술탄',
    my: 'ဆူလ်တန်'
  },
  'najib': {
    ar: 'نجيب',
    ur: 'نجیب',
    bn: 'নাজিব',
    hi: 'नजीब',
    mr: 'नजीब',
    ru: 'Наджиб',
    zh: '纳吉布',
    ko: '나지브',
    my: 'နာဂျစ်'
  },
  'najeeb': {
    ar: 'نجيب',
    ur: 'نجیب',
    bn: 'নাজিব',
    hi: 'नजीब',
    mr: 'नजीब',
    ru: 'Наджиб',
    zh: '纳吉布',
    ko: '나지브',
    my: 'နာဂျစ်'
  },
  'abdirahman': {
    ar: 'عبد الرحمن',
    ur: 'عبد الرحمٰن',
    bn: 'আবদুর রহমান',
    hi: 'अब्दुर्रहमान',
    mr: 'अब्दुर्रहमान',
    ru: 'Абдирахман',
    zh: '阿卜杜勒-拉赫曼',
    ko: '압디라흐만',
    my: 'အဗ္ဗဒူရ်ရဟ်မန်'
  },
  'abdulrahman': {
    ar: 'عبد الرحمن',
    ur: 'عبد الرحمٰن',
    bn: 'আবদুর রহমান',
    hi: 'अब्दुर्रहमान',
    mr: 'अब्दुर्रहमान',
    ru: 'Абдулрахман',
    zh: '阿卜杜勒-拉赫曼',
    ko: '압둘라흐만',
    my: 'အဗ္ဗဒူရ်ရဟ်မန်'
  },
  'abdi': {
    ar: 'عبدي',
    ur: 'عبدی',
    bn: 'আবদি',
    hi: 'अबदी',
    mr: 'अबदी',
    ru: 'Абди',
    zh: '阿卜迪',
    ko: '압디',
    my: 'အဗ္ဗဒီ'
  },
  'mohamed': {
    ar: 'محمد',
    ur: 'محمد',
    bn: 'মোহাম্মদ',
    hi: 'मोहम्मद',
    mr: 'मोहम्मद',
    ru: 'Мохамед',
    zh: '穆罕默德',
    ko: '모하메드',
    my: 'မိုဟာမက်'
  },
  'muhammad': {
    ar: 'محمد',
    ur: 'محمد',
    bn: 'মুহাম্মদ',
    hi: 'मुहम्मद',
    mr: 'मुहम्मद',
    ru: 'Мухаммад',
    zh: '穆罕默德',
    ko: '무함마드',
    my: 'မိုဟာမက်'
  },
  'ahmed': {
    ar: 'أحمد',
    ur: 'احمد',
    bn: 'আহমেদ',
    hi: 'अहमद',
    mr: 'अहमद',
    ru: 'Ахмед',
    zh: '艾哈迈德',
    ko: '아흐메드',
    my: 'အာမက်'
  },
  'ali': {
    ar: 'علي',
    ur: 'علی',
    bn: 'আলী',
    hi: 'अली',
    mr: 'अली',
    ru: 'Али',
    zh: '阿里',
    ko: '알리',
    my: 'အလီ'
  },
  'omar': {
    ar: 'عمر',
    ur: 'عمر',
    bn: 'ওমর',
    hi: 'उमर',
    mr: 'उमर',
    ru: 'Омар',
    zh: '奥马尔',
    ko: '오마르',
    my: 'အိုမာ'
  },
  'ibrahim': {
    ar: 'إبراهيم',
    ur: 'ابراہیم',
    bn: 'ইব্রাহিম',
    hi: 'इब्राहिम',
    mr: 'इब्राहिम',
    ru: 'Ибрагим',
    zh: '易卜拉欣',
    ko: '이브라힘',
    my: 'အီဗရာဟင်'
  },
  'hassan': {
    ar: 'حسن',
    ur: 'حسن',
    bn: 'হাসান',
    hi: 'हसन',
    mr: 'हसन',
    ru: 'Хасан',
    zh: '哈桑',
    ko: '하산',
    my: 'ဟာဆန်'
  },
  'hussein': {
    ar: 'حسين',
    ur: 'حسین',
    bn: 'হোসেন',
    hi: 'हुसैन',
    mr: 'हुसैन',
    ru: 'Хусейн',
    zh: '侯赛因',
    ko: '후세인',
    my: 'ဟူစိန်'
  },
  'yusuf': {
    ar: 'يوسف',
    ur: 'یوسف',
    bn: 'ইউসুফ',
    hi: 'यूसुफ़',
    mr: 'यूसुफ',
    ru: 'Юсуф',
    zh: '优素福',
    ko: '유수프',
    my: 'ယူဆွဖ်'
  },
  'fatima': {
    ar: 'فاطمة',
    ur: 'فاطمہ',
    bn: 'ফাতিমা',
    hi: 'फातिमा',
    mr: 'फातिमा',
    ru: 'Фатима',
    zh: '法蒂玛',
    ko: '파티마',
    my: 'ဖာတီမာ'
  },
  'aisha': {
    ar: 'عائشة',
    ur: 'عائشہ',
    bn: 'আয়েশা',
    hi: 'आयशा',
    mr: 'आयशा',
    ru: 'Айша',
    zh: '阿伊莎',
    ko: '아이샤',
    my: 'အာအီရှာ'
  },
  'maryam': {
    ar: 'مريم',
    ur: 'مریم',
    bn: 'মরিয়ম',
    hi: 'मरियम',
    mr: 'मरियम',
    ru: 'Марьям',
    zh: '玛利亚姆',
    ko: '마리암',
    my: 'မာရီယမ်'
  },
  'khadija': {
    ar: 'خديجة',
    ur: 'خدیجہ',
    bn: 'খাদিজা',
    hi: 'खदीजा',
    mr: 'खदीजा',
    ru: 'Хадиджа',
    zh: '海迪彻',
    ko: '카디자',
    my: 'ခါဒီဂျာ'
  },
  'zainab': {
    ar: 'زينب',
    ur: 'زینب',
    bn: 'জয়নব',
    hi: 'ज़ैनब',
    mr: 'जैनब',
    ru: 'Зайнаб',
    zh: '宰奈卜',
    ko: '자이나브',
    my: 'ဇိုင်နဗ်'
  },
  'user': {
    ar: 'المستخدم',
    ur: 'صارف',
    bn: 'ব্যবহারকারী',
    hi: 'उपयोगकर्ता',
    mr: 'वापरकर्ता',
    ru: 'Пользователь',
    zh: '用户',
    ko: '사용자',
    my: 'အသုံးပြုသူ',
    id: 'Pengguna',
    es: 'Usuario',
    fr: 'Utilisateur',
    de: 'Benutzer',
    pt: 'Usuário',
    tr: 'Kullanıcı',
    vi: 'Người dùng',
    sw: 'Mtumiaji',
    so: 'Isticmaale'
  }
};

// Simple phonetic transliteration map for Arabic
const PHONETIC_MAP_AR: Record<string, string> = {
  'th': 'ث', 'kh': 'خ', 'sh': 'ش', 'dh': 'ذ', 'ch': 'تش', 'ph': 'ف',
  'a': 'ا', 'b': 'ب', 'c': 'ك', 'd': 'د', 'e': 'ي', 'f': 'ف', 'g': 'ج',
  'h': 'ه', 'i': 'ي', 'j': 'ج', 'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن',
  'o': 'و', 'p': 'ب', 'q': 'ق', 'r': 'ر', 's': 'س', 't': 'ت', 'u': 'و',
  'v': 'ف', 'w': 'و', 'x': 'كس', 'y': 'ي', 'z': 'ز'
};

function transliterateToArabic(word: string): string {
  let lower = word.toLowerCase();
  let result = '';
  let i = 0;
  while (i < lower.length) {
    if (i + 1 < lower.length) {
      const two = lower.substring(i, i + 2);
      if (PHONETIC_MAP_AR[two]) {
        result += PHONETIC_MAP_AR[two];
        i += 2;
        continue;
      }
    }
    const one = lower[i];
    result += PHONETIC_MAP_AR[one] || one;
    i++;
  }
  return result;
}

/**
 * Adapts a user's name according to the active language script.
 * For non-Latin languages (e.g. Arabic, Urdu, Bengali, Hindi, Russian, Chinese),
 * translates or transliterates each name component into native script.
 */
export function localizeUserName(name: string | null | undefined, lang: string = 'en'): string {
  if (!name || !name.trim()) return lang === 'ar' ? 'المستخدم' : 'User';

  const cleanName = name.trim();
  const normalizedLang = (lang || 'en').toLowerCase().split('-')[0];

  // If already in target script (e.g., Arabic characters in Arabic), return as is
  if (normalizedLang === 'ar' && /[\u0600-\u06FF]/.test(cleanName)) {
    return cleanName;
  }
  if ((normalizedLang === 'hi' || normalizedLang === 'mr') && /[\u0900-\u097F]/.test(cleanName)) {
    return cleanName;
  }
  if (normalizedLang === 'bn' && /[\u0980-\u09FF]/.test(cleanName)) {
    return cleanName;
  }
  if (normalizedLang === 'ru' && /[\u0400-\u04FF]/.test(cleanName)) {
    return cleanName;
  }
  if (normalizedLang === 'zh' && /[\u4E00-\u9FFF]/.test(cleanName)) {
    return cleanName;
  }

  // Check if generic "User"
  if (cleanName.toLowerCase() === 'user' && CANONICAL_NAMES['user']?.[normalizedLang]) {
    return CANONICAL_NAMES['user'][normalizedLang];
  }

  // For Latin-script languages (en, id, es, fr, de, pt, vi, sw, so, tr), keep Latin name
  const latinLanguages = ['en', 'id', 'es', 'fr', 'de', 'pt', 'vi', 'sw', 'so', 'tr'];
  if (latinLanguages.includes(normalizedLang)) {
    return cleanName;
  }

  // Tokenize compound name (e.g., "Liban Said" -> ["Liban", "Said"])
  const tokens = cleanName.split(/\s+/);
  const localizedTokens = tokens.map((token) => {
    const key = token.toLowerCase();
    if (CANONICAL_NAMES[key]?.[normalizedLang]) {
      return CANONICAL_NAMES[key][normalizedLang];
    }

    // Fallback transliteration
    if (normalizedLang === 'ar' || normalizedLang === 'ur') {
      return transliterateToArabic(token);
    }

    return token;
  });

  return localizedTokens.join(' ');
}
