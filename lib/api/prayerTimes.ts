import { LocationData, detectLocation } from './location';
import { getTranslation } from './translation';
import { supabase } from '../supabase';

export interface PrayerTimes {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Sunset: string;
    Maghrib: string;
    Isha: string;
    Imsak: string;
    Midnight: string;
}

let inFlightPrayerRequest: Promise<PrayerTimes | null> | null = null;

export const getPrayerTimes = async (location?: LocationData): Promise<PrayerTimes | null> => {
    try {
        const loc = location || await detectLocation();
        if (!loc) return null;
        const date = new Date().toISOString().split('T')[0];
        const cacheKey = `prayer_times_${loc.city}_${date}`;
        
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
        }

        if (inFlightPrayerRequest) {
            return inFlightPrayerRequest;
        }

        inFlightPrayerRequest = (async () => {
            try {
                // Ensure valid coordinates to prevent Aladhan API geocoding timeouts
                const lat = loc.latitude || -6.2088;
                const lon = loc.longitude || 106.8456;

                const timestamp = Math.floor(Date.now() / 1000);
                const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lon}&method=2`;

                const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
                if (!response.ok) throw new Error("API failure");
                const data = await response.json();
                
                if (data.code === 200) {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(cacheKey, JSON.stringify(data.data.timings));
                    }
                    return data.data.timings;
                }
                return null;
            } catch (error) {
                console.log("[PrayerTimes] Using fallback times to prevent timeouts.");
                const fallback = {
                    Fajr: "04:30", Sunrise: "05:45", Dhuhr: "11:45", Asr: "15:00",
                    Maghrib: "17:45", Isha: "18:55", Imsak: "04:20", Midnight: "23:45", Sunset: "17:45"
                } as PrayerTimes;
                
                if (typeof window !== 'undefined') {
                    localStorage.setItem(cacheKey, JSON.stringify(fallback));
                }
                return fallback;
            } finally {
                inFlightPrayerRequest = null;
            }
        })();

        return inFlightPrayerRequest;
    } catch (e) {
        return null;
    }
};

const quranEditions: Record<string, string> = {
    'en': 'en.asad', 'id': 'id.indonesian', 'fr': 'fr.hamidullah',
    'de': 'de.aburida', 'es': 'es.cortes', 'ru': 'ru.kuliev',
    'tr': 'tr.diyanet', 'ur': 'ur.jalandhry', 'bn': 'bn.bengali',
    'hi': 'hi.hindi', 'zh': 'zh.jian'
};

const hadithLangs: Record<string, string> = {
    'en': 'eng', 'id': 'ind', 'fr': 'fra', 'de': 'deu',
    'es': 'spa', 'ru': 'rus', 'tr': 'tur', 'ur': 'urd',
    'bn': 'ben', 'ta': 'tam', 'mr': 'mar', 'te': 'tel'
};

export const getPersonalizedSpiritualReminder = async (userId: string, phase: 'pre-prayer' | 'post-prayer', lang: string = 'en'): Promise<{ 
    type: 'quran' | 'hadith', 
    content: string, 
    content_ar?: string,
    reference: string, 
    verifyUrl?: string 
} | null> => {
    try {
        const { data: settings } = await supabase
            .from('user_settings')
            .select('last_quran_index, last_hadith_index')
            .eq('user_id', userId)
            .single();
            
        let qIndex = (settings as any)?.last_quran_index || 1;
        let hIndex = (settings as any)?.last_hadith_index || 1;

        if (phase === 'post-prayer') {
            const edition = quranEditions[lang] || 'en.asad';
            
            const [resEn, resAr] = await Promise.all([
                fetch(`https://api.alquran.cloud/v1/ayah/${qIndex}/${edition}`, { signal: AbortSignal.timeout(5000) }),
                fetch(`https://api.alquran.cloud/v1/ayah/${qIndex}/quran-uthmani`, { signal: AbortSignal.timeout(5000) })
            ]);
            
            const dataEn = await resEn.json();
            const dataAr = await resAr.json();

            let nextIndex = qIndex + 1;
            if (nextIndex > 6236) nextIndex = 1;
            await supabase.from('user_settings').update({ last_quran_index: nextIndex } as any).eq('user_id', userId);

            return {
                type: 'quran',
                content: dataEn.data.text,
                content_ar: dataAr.data.text,
                reference: `Quran ${dataEn.data.surah.numberOfSurah}:${dataEn.data.numberInSurah}`
            };
        } else {
            const hLang = hadithLangs[lang] || 'eng';
            let validHadithFound = false;
            let dataEn, dataAr;
            let currentIdx = hIndex;

            // Some hadith indices might be missing in the API, so we try up to 3 times to find a valid one
            for(let attempt = 0; attempt < 3; attempt++) {
                try {
                    const [resEn, resAr] = await Promise.all([
                        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${hLang}-bukhari/${currentIdx}.json`, { signal: AbortSignal.timeout(5000) }),
                        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-bukhari/${currentIdx}.json`, { signal: AbortSignal.timeout(5000) })
                    ]);
                    
                    if (resEn.ok && resAr.ok) {
                        dataEn = await resEn.json();
                        dataAr = await resAr.json();
                        validHadithFound = true;
                        break;
                    }
                } catch (e) {
                    // skip and try next
                }
                currentIdx++;
            }

            if (!validHadithFound) {
                currentIdx++; // Force skip if completely failed
                return {
                    type: 'hadith',
                    content: "The best among you are those who have the best manners and character.",
                    content_ar: "خياركم أحسنكم أخلاقا",
                    reference: "Sahih Bukhari (Fallback)",
                };
            }

            let nextIndex = currentIdx + 1;
            if (nextIndex > 7000) nextIndex = 1; // reset around 7k
            await supabase.from('user_settings').update({ last_hadith_index: nextIndex } as any).eq('user_id', userId);

            const text = dataEn.hadiths[0].text.replace(/<[^>]*>?/gm, ''); // Strip HTML if any
            const arabicText = dataAr.hadiths[0].text;

            return {
                type: 'hadith',
                content: text,
                content_ar: arabicText,
                reference: `Sahih Bukhari, Hadith ${dataEn.hadiths[0].hadithnumber}`
            };
        }
    } catch (error: any) {
        console.error("Spiritual reminder error:", error);
        return {
            type: 'hadith',
            content: "The best among you are those who have the best manners and character.",
            content_ar: "خياركم أحسنكم أخلاقا",
            reference: "Sahih Bukhari",
        };
    }
};



export const getPrayerWindow = (prayerTimes: PrayerTimes): { inWindow: boolean, phase: 'pre-prayer' | 'post-prayer' | 'none' } => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const timeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const timings = Object.entries(prayerTimes).map(([name, time]) => ({
        name,
        minutes: timeToMinutes(time)
    }));

    for (const t of timings) {
        // Skip Sunrise/Sunset which are non-standard prayer bounds if you want strictly the 5 prayers, 
        // but typically users want reminders around all of them.
        if (t.name === 'Imsak' || t.name === 'Midnight') continue;

        const diff = currentTime - t.minutes;
        if (diff >= -15 && diff < 0) {
            // 15 mins before up to exactly prayer time -> Hadith
            return { inWindow: true, phase: 'pre-prayer' };
        } else if (diff >= 0 && diff <= 15) {
            // exactly prayer time to 15 mins after -> Quran
            return { inWindow: true, phase: 'post-prayer' };
        }
    }

    return { inWindow: false, phase: 'none' };
};
