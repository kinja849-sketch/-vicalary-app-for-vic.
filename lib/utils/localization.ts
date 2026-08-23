export interface GeoLocationData {
    city: string;
    country: string;
    country_code: string;
    currency: string;
    languages: string;
    latitude: number;
    longitude: number;
    timezone: string;
}

/**
 * Detects the user's location based on their IP address.
 * Uses a centralized internal proxy to avoid CORS and rate limits.
 */
export async function detectUserLocation(): Promise<GeoLocationData | null> {
    try {
        const { detectLocation } = await import('../api/location');
        const data = await detectLocation();
        
        return {
            city: data.city || 'Unknown',
            country: data.country_name,
            country_code: data.country_code,
            currency: data.currency || 'USD',
            languages: Array.isArray(data.languages) ? data.languages[0] || 'en' : (data.languages || 'en'),
            latitude: 0,
            longitude: 0,
            timezone: data.timezone || 'UTC',
        };
    } catch (error) {
        console.warn('Geolocation detection failed:', error);
        return null;
    }
}

/**
 * Formats a numeric amount into a currency string based on the detected locale.
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
}

/**
 * Returns the appropriate currency symbol for a given country code.
 */
export function getCurrencySymbol(currencyCode: string): string {
    try {
        return (0).toLocaleString(undefined, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).replace(/\d/g, '').trim();
    } catch (e) {
        return currencyCode;
    }
}
