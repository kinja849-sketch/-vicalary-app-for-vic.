import fallbackCountries from './countries.json';

export interface Country {
    name: string;
    flag: string;
    emoji: string;
    dialCode: string;
    code: string;
}

export const fetchCountries = async (): Promise<Country[]> => {
    try {
        // Try fetching with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,idd,cca2', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();

        return data.map((c: any) => {
            const root = c.idd?.root || '';
            const suffix = c.idd?.suffixes?.[0] || '';
            return {
                name: c.name?.common || 'Unknown',
                flag: c.flags?.png || '',
                emoji: String.fromCodePoint(...(c.cca2.toUpperCase().split('').map((char: string) => 127397 + char.charCodeAt(0)))),
                dialCode: `${root}${suffix}`,
                code: c.cca2
            };
        }).sort((a: any, b: any) => a.name.localeCompare(b.name));
    } catch (error) {
        console.warn('REST Countries API failed or timed out, using fallback data:', error);
        return (fallbackCountries as Country[]).sort((a, b) => a.name.localeCompare(b.name));
    }
}
