import { supabase } from '../supabase'

export const LOCATION_CACHE_KEY = 'vicalary_location_v5';

export interface LocationData {
  ip?: string;
  country_code: string;
  country_name: string;
  country: string; // Guaranteed full country name (e.g. "Japan", "Indonesia", "Kenya")
  city?: string;
  region?: string;
  formatted_location?: string; // e.g. "Osaka, Japan", "Purwakarta, Indonesia", "Nairobi, Kenya"
  currency?: string;
  currency_symbol?: string;
  timezone?: string;
  languages?: string[];
  flag?: string;
  method?: 'DEVICE_GPS' | 'GOOGLE_GEOCODING' | 'EDGE' | 'BROWSER' | 'CACHE' | 'FALLBACK';
  latitude?: number;
  longitude?: number;
}

let pendingRequest: Promise<LocationData | null> | null = null;

export const countryToLangMap: Record<string, string[]> = {
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
  'JP': ['ja', 'en'],
  'KR': ['ko', 'en'],
  'SG': ['en', 'zh', 'ms'],
  'MY': ['ms', 'en'],
  'TH': ['th', 'en'],
  'PH': ['en', 'tl'],
  'AU': ['en'],
  'NZ': ['en'],
  'CA': ['en', 'fr'],
  
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
  'KP': ['ko', 'en'],
  
  // German-speaking countries
  'AT': ['de', 'en'], 'CH': ['de', 'fr', 'en'], 'LI': ['de', 'en'], 'LU': ['de', 'fr', 'en'],
  
  // French-speaking countries
  'MC': ['fr', 'en'], 'BE': ['fr', 'de', 'en'], 'SN': ['fr', 'en'],
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

export const countryToCurrencyMap: Record<string, { code: string, symbol: string }> = {
  'ID': { code: 'IDR', symbol: 'Rp' }, 'US': { code: 'USD', symbol: '$' },
  'GB': { code: 'GBP', symbol: '£' }, 'FR': { code: 'EUR', symbol: '€' },
  'DE': { code: 'EUR', symbol: '€' }, 'ES': { code: 'EUR', symbol: '€' },
  'IT': { code: 'EUR', symbol: '€' }, 'NL': { code: 'EUR', symbol: '€' },
  'BE': { code: 'EUR', symbol: '€' }, 'AT': { code: 'EUR', symbol: '€' },
  'CH': { code: 'CHF', symbol: 'CHF' }, 'CA': { code: 'CAD', symbol: 'CA$' },
  'AU': { code: 'AUD', symbol: 'A$' }, 'NZ': { code: 'NZD', symbol: 'NZ$' },
  'SG': { code: 'SGD', symbol: 'S$' }, 'MY': { code: 'MYR', symbol: 'RM' },
  'TH': { code: 'THB', symbol: '฿' }, 'PH': { code: 'PHP', symbol: '₱' },
  'VN': { code: 'VND', symbol: '₫' }, 'JP': { code: 'JPY', symbol: '¥' },
  'KR': { code: 'KRW', symbol: '₩' }, 'CN': { code: 'CNY', symbol: '¥' },
  'SA': { code: 'SAR', symbol: 'SR' }, 'AE': { code: 'AED', symbol: 'DH' },
  'IN': { code: 'INR', symbol: '₹' }, 'BD': { code: 'BDT', symbol: '৳' },
  'PK': { code: 'PKR', symbol: 'Rs' }, 'RU': { code: 'RUB', symbol: '₽' },
  'BR': { code: 'BRL', symbol: 'R$' }, 'TR': { code: 'TRY', symbol: '₺' },
  'KE': { code: 'KES', symbol: 'KSh' }, 'SO': { code: 'SOS', symbol: 'Sh' }
};

/**
 * Reverse geocodes coordinates (lat, lng) to resolve exact city/town/province + country.
 */
export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<{
  city: string;
  region: string;
  country: string;
  country_code: string;
  formatted_location: string;
  provider: string;
} | null> {
  // 1. Try our internal server route (which uses Google Maps Geocoding API if key configured)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('/api/location/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.country) {
        return data;
      }
    }
  } catch (_e) {
    // Fall back to client-side reverse geocoders
  }

  // 2. Direct BigDataCloud Client Reverse Geocode Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const city = bdcData.city || bdcData.locality || bdcData.principalSubdivision || '';
      const region = bdcData.principalSubdivision || '';
      const country = bdcData.countryName || '';
      const countryCode = (bdcData.countryCode || '').toUpperCase();

      if (country) {
        const primaryLoc = city || region;
        const formatted = primaryLoc && country ? `${primaryLoc}, ${country}` : (primaryLoc || country);
        return {
          city: primaryLoc,
          region,
          country,
          country_code: countryCode,
          formatted_location: formatted,
          provider: 'bigdatacloud'
        };
      }
    }
  } catch (_e) {}

  // 3. OpenStreetMap Nominatim Client Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'VicalaryHealthCoach/1.0' }
      }
    );
    clearTimeout(timeoutId);

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const addr = nomData.address || {};
      const city = addr.city || addr.town || addr.municipality || addr.suburb || addr.village || addr.county || '';
      const region = addr.state || addr.province || addr.region || '';
      const country = addr.country || '';
      const countryCode = (addr.country_code || '').toUpperCase();

      if (country) {
        const primaryLoc = city || region;
        const formatted = primaryLoc && country ? `${primaryLoc}, ${country}` : (primaryLoc || country);
        return {
          city: primaryLoc,
          region,
          country,
          country_code: countryCode,
          formatted_location: formatted,
          provider: 'nominatim'
        };
      }
    }
  } catch (_e) {}

  return null;
}

/**
 * Attempts to obtain the user's high-accuracy real-time coordinates using device location services.
 */
function getDeviceGeolocationCoords(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 3500); // 3.5s timeout for snappy performance

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        }
      },
      (_err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(null);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 3500,
        maximumAge: 60000 // Accept 1 minute cached GPS to reduce battery drain
      }
    );
  });
}

export const detectLocation = async (forceRefresh = false): Promise<LocationData | null> => {
  let cachedData: LocationData | null = null;

  if (typeof window !== 'undefined' && !forceRefresh) {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        // Refresh cache every 6 hours so travel is reflected dynamically
        if (data && data.method !== 'FALLBACK' && (!timestamp || Date.now() - timestamp < 6 * 60 * 60 * 1000)) {
          cachedData = { ...data, method: 'CACHE' };
        }
      } catch (_e) {
        localStorage.removeItem(LOCATION_CACHE_KEY);
      }
    }
  }

  // If pending request exists and not forced, reuse it
  if (pendingRequest && !forceRefresh) return pendingRequest;

  pendingRequest = (async () => {
    try {
      // 1. PRIMARY: Try Device Location Services (GPS / Hardware Geolocation)
      const deviceCoords = await getDeviceGeolocationCoords();
      if (deviceCoords) {
        const geocodeResult = await reverseGeocodeCoordinates(deviceCoords.latitude, deviceCoords.longitude);
        if (geocodeResult && geocodeResult.country) {
          const countryCode = geocodeResult.country_code || 'US';
          const currencyInfo = countryToCurrencyMap[countryCode] || { code: 'USD', symbol: '$' };
          const langInfo = countryToLangMap[countryCode] || ['en'];

          const result: LocationData = {
            country_code: countryCode,
            country_name: geocodeResult.country,
            country: geocodeResult.country,
            city: geocodeResult.city,
            region: geocodeResult.region,
            formatted_location: geocodeResult.formatted_location,
            flag: `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`,
            currency: currencyInfo.code,
            currency_symbol: currencyInfo.symbol,
            languages: langInfo,
            timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
            method: 'DEVICE_GPS',
            latitude: deviceCoords.latitude,
            longitude: deviceCoords.longitude
          };

          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
          }
          return result;
        }
      }

      // 2. SECONDARY: IP-based Geolocation with high accuracy
      // Try ipgeolocation.io with key if available
      const ipGeoKey = process.env.NEXT_PUBLIC_IPGEO_API_KEY || '63bbbfcb76a843b6be7bc3083f5a807c';
      if (ipGeoKey) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${ipGeoKey}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data.country_code2) {
              const countryCode = data.country_code2.toUpperCase();
              const countryName = data.country_name || 'United States';
              const city = data.city || data.state_prov || '';
              const currencyInfo = countryToCurrencyMap[countryCode] || { code: data.currency?.code || 'USD', symbol: data.currency?.symbol || '$' };
              const langInfo = countryToLangMap[countryCode] || ['en'];
              const formattedLoc = city ? `${city}, ${countryName}` : countryName;

              const result: LocationData = {
                ip: data.ip || undefined,
                country_code: countryCode,
                country_name: countryName,
                country: countryName,
                city,
                region: data.state_prov || '',
                formatted_location: formattedLoc,
                timezone: data.time_zone?.name || 'UTC',
                flag: `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`,
                currency: currencyInfo.code,
                currency_symbol: currencyInfo.symbol,
                languages: langInfo,
                method: 'EDGE',
                latitude: parseFloat(data.latitude) || undefined,
                longitude: parseFloat(data.longitude) || undefined
              };

              if (typeof window !== 'undefined') {
                localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
              }
              return result;
            }
          }
        } catch (_e) {}
      }

      // 3. TERTIARY: geojs.io (unlimited, fast, CORS-friendly)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.country_code) {
            const countryCode = data.country_code.toUpperCase();
            const countryName = data.country || 'United States';
            const city = data.city || '';
            const currencyInfo = countryToCurrencyMap[countryCode] || { code: 'USD', symbol: '$' };
            const langInfo = countryToLangMap[countryCode] || ['en'];
            const formattedLoc = city ? `${city}, ${countryName}` : countryName;

            const result: LocationData = {
              ip: data.ip || undefined,
              country_code: countryCode,
              country_name: countryName,
              country: countryName,
              city,
              formatted_location: formattedLoc,
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
              localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
            }
            return result;
          }
        }
      } catch (_e) {
        console.log("[Location] geojs.io fetch timed out or failed, trying fallback.");
      }

      // 4. QUATERNARY: ipwho.is
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch('https://ipwho.is/', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const countryCode = (data.country_code || 'US').toUpperCase();
            const countryName = data.country || 'United States';
            const city = data.city || '';
            const currencyInfo = countryToCurrencyMap[countryCode] || { code: 'USD', symbol: '$' };
            const langInfo = countryToLangMap[countryCode] || ['en'];
            const formattedLoc = city ? `${city}, ${countryName}` : countryName;

            const result: LocationData = {
              ip: data.ip || undefined,
              country_code: countryCode,
              country_name: countryName,
              country: countryName,
              city,
              formatted_location: formattedLoc,
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
              localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
            }
            return result;
          }
        }
      } catch (_e) {
        console.log("[Location] ipwho.is failed.");
      }

      // If network requests failed but we have a valid cached location, use it
      if (cachedData) {
        return cachedData;
      }

      // Final fallback - Honest unmanufactured data (no fake country assumption)
      return {
        country_code: '',
        country_name: '',
        country: '',
        city: '',
        formatted_location: 'Unknown Location',
        currency: 'USD',
        currency_symbol: '$',
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
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
};

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
