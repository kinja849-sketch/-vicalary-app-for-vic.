export interface PrayerTimes {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
}

export interface SpiritualVerse {
    text: string;
    reference: string;
}

/**
 * Fetches Islamic prayer times for a given location.
 */
export async function getPrayerTimes(latitude: number, longitude: number): Promise<PrayerTimes | null> {
    try {
        const date = new Date().toISOString().split('T')[0];
        const response = await fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=2`);
        if (!response.ok) throw new Error('Failed to fetch prayer times');
        const data = await response.json();
        return data.data.timings;
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        return null;
    }
}

/**
 * Fetches a random Quranic verse.
 */
export async function getRandomQuranVerse(): Promise<SpiritualVerse | null> {
    try {
        const randomAyah = Math.floor(Math.random() * 6236) + 1;
        const response = await fetch(`https://api.alquran.cloud/v1/ayah/${randomAyah}/en.asad`); // Default to English translation
        if (!response.ok) throw new Error('Failed to fetch Quran verse');
        const data = await response.json();
        return {
            text: data.data.text,
            reference: `Quran ${data.data.surah.numberOfSurah}:${data.data.numberInSurah}`,
        };
    } catch (error) {
        console.error('Error fetching Quran verse:', error);
        return null;
    }
}

/**
 * Fetches a random Hadith.
 */
export async function getRandomHadith(): Promise<SpiritualVerse | null> {
    try {
        // Using a public Hadith API (Example endpoint, can be adjusted)
        const response = await fetch('https://random-hadith-generator.vercel.app/bukhari');
        if (!response.ok) throw new Error('Failed to fetch Hadith');
        const data = await response.json();
        return {
            text: data.data.hadith_english,
            reference: `Sahih Bukhari, Hadith ${data.data.hadith_number}`,
        };
    } catch (error) {
        console.error('Error fetching Hadith:', error);
        return {
            text: "The best among you are those who have the best manners and character.",
            reference: "Sahih Bukhari"
        };
    }
}
