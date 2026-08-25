import { supabase } from '../supabase'

export interface LocationData {
  country_code: string
  country_name: string
  city?: string
  currency?: string
  currency_symbol?: string
  timezone?: string
  languages?: string[]
  flag?: string
  method?: 'EDGE' | 'BROWSER' | 'CACHE' | 'FALLBACK'
  latitude?: number
  longitude?: number
}

let pendingRequest: Promise<LocationData | null> | null = null;

const countryToLangMap: Record<string, string[]> = {
  'ID': ['id', 'en'], 
  'US': ['en'], 
  'GB': ['en'], 
  'FR': ['fr', 'en'],
  'DE': ['de', 'en'], 
  'ES': ['es', 'en'], 
  'SA': ['ar', 'en'],
  'AE': ['ar', 'en'], 
  'IN': ['hi', 'en'], 
  'BD': ['bn', 'en'],
  'PK': ['ur', 'en'], 
  'CN': ['zh', 'en'], 
  'RU': ['ru', 'en'],
  'BR': ['pt', 'en'], 
  'VN': ['vi', 'en'], 
  'TR': ['tr', 'en'],
  
  // Additional Arabic-speaking countries
  'EG': ['ar', 'en'], 'QA': ['ar', 'en'], 'KW': ['ar', 'en'], 'OM': ['ar', 'en'],
  'BH': ['ar', 'en'], 'JO': ['ar', 'en'], 'LB': ['ar', 'en'], 'YE': ['ar', 'en'],
  'IQ': ['ar', 'en'], 'DZ': ['ar', 'en'], 'MA': ['ar', 'en'], 'TN': ['ar', 'en'],
  'LY': ['ar', 'en'], 'SD': ['ar', 'en'], 'SY': ['ar', 'en'], 'PS': ['ar', 'en'],
  
  // Swahili-speaking countries
  'KE': ['sw', 'en'], 'TZ': ['sw', 'en'], 'UG': ['sw', 'en'], 'RW': ['sw', 'en'], 'BI': ['sw', 'en'],
  
  // Somali-speaking countries
  'SO': ['so', 'en'], 'DJ': ['so', 'en'],
  
  // Burmese-speaking countries
  'MM': ['my', 'en'],
  
  // Korean-speaking countries
  'KR': ['ko', 'en'], 'KP': ['ko', 'en'],
  
  // German-speaking countries
  'AT': ['de', 'en'], 'CH': ['de', 'fr', 'en'], 'LI': ['de', 'en'], 'LU': ['de', 'fr', 'en'],
  
  // French-speaking countries
  'MC': ['fr', 'en'], 'BE': ['fr', 'de', 'en'], 'CA': ['en', 'fr'], 'SN': ['fr', 'en'],
  'CI': ['fr', 'en'], 'CM': ['fr', 'en'], 'CD': ['fr', 'en'], 'CG': ['fr', 'en'],
  'GA': ['fr', 'en'], 'NE': ['fr', 'en'], 'ML': ['fr', 'en'], 'TG': ['fr', 'en'],
  'BJ': ['fr', 'en'], 'CF': ['fr', 'en'],
  
  // Portuguese-speaking countries
  'PT': ['pt', 'en'], 'AO': ['pt', 'en'], 'MZ': ['pt', 'en'], 'CV': ['pt', 'en'],
  'GW': ['pt', 'en'], 'TL': ['pt', 'en'],
  
  // Russian-speaking countries
  'BY': ['ru', 'en'], 'KZ': ['ru', 'en'], 'KG': ['ru', 'en'], 'MD': ['ru', 'en'],
  
  // Spanish-speaking countries
  'MX': ['es', 'en'], 'AR': ['es', 'en'], 'CO': ['es', 'en'], 'PE': ['es', 'en'],
  'VE': ['es', 'en'], 'CL': ['es', 'en'], 'EC': ['es', 'en'], 'GT': ['es', 'en'],
  'CU': ['es', 'en'], 'BO': ['es', 'en'], 'DO': ['es', 'en'], 'HN': ['es', 'en'],
  'PY': ['es', 'en'], 'SV': ['es', 'en'], 'NI': ['es', 'en'], 'CR': ['es', 'en'],
  'UY': ['es', 'en'], 'PA': ['es', 'en'], 'GQ': ['es', 'en']
};

const countryToCurrencyMap: Record<string, { code: string, symbol: string }> = {
  'ID': { code: 'IDR', symbol: 'Rp' }, 'US': { code: 'USD', symbol: '$' },
  'GB': { code: 'GBP', symbol: '£' }, 'FR': { code: 'EUR', symbol: '€' },
  'DE': { code: 'EUR', symbol: '€' }, 'ES': { code: 'EUR', symbol: '€' },
  'SA': { code: 'SAR', symbol: 'SR' }, 'AE': { code: 'AED', symbol: 'DH' },
  'IN': { code: 'INR', symbol: '₹' }, 'BD': { code: 'BDT', symbol: '৳' },
  'PK': { code: 'PKR', symbol: 'Rs' }, 'CN': { code: 'CNY', symbol: '¥' },
  'RU': { code: 'RUB', symbol: '₽' }, 'BR': { code: 'BRL', symbol: 'R$' },
  'VN': { code: 'VND', symbol: '₫' }, 'TR': { code: 'TRY', symbol: '₺' },
  'KE': { code: 'KES', symbol: 'KSh' }, 'SO': { code: 'SOS', symbol: 'Sh' }
};

export const detectLocation = async (forceRefresh = false): Promise<LocationData | null> => {
  const CACHE_KEY = 'vicalary_location_v3';
  if (!forceRefresh && typeof window !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return { ...data, method: 'CACHE' };
      }
    }
  }

  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    try {
      // Primary: geojs.io (unlimited, fast)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.country_code) {
            const countryCode = data.country_code;
            const currencyInfo = countryToCurrencyMap[countryCode] || { code: 'USD', symbol: '$' };
            const langInfo = countryToLangMap[countryCode] || ['en'];

            const result: LocationData = {
              country_code: countryCode,
              country_name: data.country || 'United States',
              city: data.city || 'Unknown',
              timezone: data.timezone || 'UTC',
              flag: `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`,
              currency: currencyInfo.code,
              currency_symbol: currencyInfo.symbol,
              languages: langInfo,
              method: 'EDGE',
              latitude: parseFloat(data.latitude) || undefined,
              longitude: parseFloat(data.longitude) || undefined
            };
            
            if (typeof window !== 'undefined') {
               localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
            }
            return result;
          }
        }
      } catch (e) {
        console.log("[Location] geojs.io failed.");
      }

      // Secondary: ipwho.is
      try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const countryCode = data.country_code || 'US';
            const currencyInfo = countryToCurrencyMap[countryCode] || { code: 'USD', symbol: '$' };
            const langInfo = countryToLangMap[countryCode] || ['en'];

            const result: LocationData = {
              country_code: countryCode,
              country_name: data.country || 'United States',
              city: data.city || 'Unknown',
              timezone: data.timezone?.id || 'UTC',
              flag: data.flag?.img || '',
              currency: data.currency?.code || currencyInfo.code,
              currency_symbol: data.currency?.symbol || currencyInfo.symbol,
              languages: langInfo,
              method: 'EDGE',
              latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
              longitude: typeof data.longitude === 'number' ? data.longitude : undefined
            };
            
            if (typeof window !== 'undefined') {
               localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
            }
            return result;
          }
        }
      } catch (e) {
        console.log("[Location] ipwho.is failed (likely offline).");
      }

      // Secondary: ipapi.co
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const countryCode = data.country_code || 'US';
          const currencyInfo = countryToCurrencyMap[countryCode] || { code: 'USD', symbol: '$' };
          const langInfo = countryToLangMap[countryCode] || ['en'];

          const result: LocationData = {
            country_code: countryCode,
            country_name: data.country_name || 'United States',
            city: data.city || 'Unknown',
            timezone: data.timezone || 'UTC',
            flag: `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`,
            currency: data.currency || currencyInfo.code,
            currency_symbol: currencyInfo.symbol,
            languages: data.languages ? data.languages.split(',') : langInfo,
            method: 'EDGE',
            latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
            longitude: typeof data.longitude === 'number' ? data.longitude : undefined
          };
          
          if (typeof window !== 'undefined') {
             localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
          }
          return result;
        }
      } catch (e) {
        console.log("[Location] ipapi.co failed (likely offline).");
      }

      // Fallback
      return {
        country_code: 'US',
        country_name: 'United States',
        currency: 'USD',
        currency_symbol: '$',
        timezone: 'UTC',
        languages: ['en'],
        method: 'FALLBACK'
      };
    } finally {
      pendingRequest = null;
    }
  })();

  const result = await pendingRequest;
  if (result && typeof window !== 'undefined' && (!result.languages || result.languages.length === 0)) {
    result.languages = navigator.languages as string[];
  }
  return result;
}

export const getUserLocation = detectLocation;

export const getPrimaryLanguage = (languages?: string[] | string): string | undefined => {
  if (!languages) return undefined;
  if (Array.isArray(languages)) {
    if (languages.length === 0) return undefined;
    return languages[0].split('-')[0].toLowerCase();
  }
  const str = languages.split(',')[0].split('-')[0].trim().toLowerCase();
  return str || undefined;
};
