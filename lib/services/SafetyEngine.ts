import { SupabaseClient } from '@supabase/supabase-js';

export interface UserSafetyProfile {
  userId: string;
  userGoal: string;
  dailyCalorieGoal: number;
  allergies: string[];
  medicalConditions: string[];
  dietaryLifestyle: string[];
  isDiabetic: boolean;
  hasHypertension: boolean;
  language: string;
}

export interface SafetyCheckResult {
  isSafe: boolean;
  verdict: 'GOOD' | 'MODERATE' | 'POOR';
  warningTitle?: string;
  warningMessage?: string;
  matchedAllergen?: string;
  matchedCondition?: string;
  alternativeSuggestion?: any;
}

export class SafetyEngine {
  /**
   * Loads and normalizes user health profile from Supabase onboarding & profile tables.
   */
  static async getUserSafetyProfile(userId: string, supabase: SupabaseClient, fallbackLang: string = 'en'): Promise<UserSafetyProfile> {
    const [
      { data: onboarding },
      { data: userSettings },
      { data: profile }
    ] = await Promise.all([
      supabase.from('onboarding_responses').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_settings').select('language').eq('user_id', userId).maybeSingle(),
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
    ]);

    // Extract allergies
    let rawAllergies: string[] = [];
    if (profile && (profile as any).allergies) {
      const pAlg = (profile as any).allergies;
      rawAllergies = Array.isArray(pAlg) ? pAlg : [String(pAlg)];
    } else if (onboarding && (onboarding as any).allergies) {
      const oAlg = (onboarding as any).allergies;
      rawAllergies = Array.isArray(oAlg) ? oAlg : [String(oAlg)];
    }

    if (onboarding && (onboarding as any).restrictions && Array.isArray((onboarding as any).restrictions)) {
      rawAllergies = [...rawAllergies, ...(onboarding as any).restrictions];
    }

    const allergies = Array.from(new Set(rawAllergies.map(a => String(a).trim().toLowerCase()))).filter(Boolean);

    // Extract medical & health conditions
    let rawConditions: string[] = [];
    if (onboarding) {
      if (onboarding.medical_conditions) {
        if (typeof onboarding.medical_conditions === 'string') rawConditions.push(onboarding.medical_conditions);
        else if (Array.isArray(onboarding.medical_conditions)) rawConditions.push(...onboarding.medical_conditions);
      }
      if (onboarding.health_conditions) {
        if (typeof onboarding.health_conditions === 'string') rawConditions.push(onboarding.health_conditions);
        else if (Array.isArray(onboarding.health_conditions)) rawConditions.push(...onboarding.health_conditions);
      }
    }
    if (profile && (profile as any).health_conditions) {
      const pCond = (profile as any).health_conditions;
      if (typeof pCond === 'string') rawConditions.push(pCond);
      else if (Array.isArray(pCond)) rawConditions.push(...pCond);
    }

    const medicalConditions = Array.from(new Set(rawConditions.map(c => String(c).trim().toLowerCase()))).filter(Boolean);

    // Extract dietary lifestyle
    let dietaryLifestyle: string[] = [];
    if (onboarding && onboarding.dietary_lifestyle) {
      dietaryLifestyle = Array.isArray(onboarding.dietary_lifestyle) ? onboarding.dietary_lifestyle.map((d: any) => String(d).toLowerCase()) : [String(onboarding.dietary_lifestyle).toLowerCase()];
    }

    const isDiabetic = medicalConditions.some(c => c.includes('diabet') || c.includes('sugar') || c.includes('glucose')) ||
                      dietaryLifestyle.some(d => d.includes('diabet'));

    const hasHypertension = medicalConditions.some(c => c.includes('hypertens') || c.includes('blood pressure') || c.includes('bp'));

    const userGoal = onboarding?.goal || 'maintain a healthy lifestyle';
    const dailyCalorieGoal = onboarding?.daily_calorie_goal || 2000;
    const language = userSettings?.language || fallbackLang || 'en';

    return {
      userId,
      userGoal,
      dailyCalorieGoal,
      allergies,
      medicalConditions,
      dietaryLifestyle,
      isDiabetic,
      hasHypertension,
      language
    };
  }

  /**
   * Helper to format localized warning statements:
   * e.g., "Hey, the food that you just scanned has fish in it, avoid it"
   */
  static formatAllergenWarning(allergen: string, lang: string = 'en'): string {
    const formattedAllergen = allergen.toLowerCase();
    
    // Multilingual translations for the explicit allergen warning
    const warningTemplates: Record<string, string> = {
      en: `Hey, the food that you just scanned has ${formattedAllergen} in it, avoid it.`,
      ar: `تنبيه: الطعام الذي قمت بمسحه يحتوي على ${formattedAllergen}، يرجى تجنبه.`,
      es: `Oye, la comida que acabas de escanear contiene ${formattedAllergen}, evítala.`,
      fr: `Attention, la nourriture que vous venez de scanner contient des ${formattedAllergen}, évitez-la.`,
      id: `Hei, makanan yang baru saja Anda pindai mengandung ${formattedAllergen}, hindari makanan ini.`,
      de: `Achtung, das gerade gescannte Essen enthält ${formattedAllergen}, bitte meiden.`,
      hi: `अरे, आपके द्वारा अभी स्कैन किए गए भोजन में ${formattedAllergen} है, इससे बचें।`,
      ur: `توجہ فرمائیں: جو کھانا آپ نے اسکین کیا ہے اس میں ${formattedAllergen} شامل ہے، اس سے پرہیز کریں۔`,
      bn: `হে, আপনার স্ক্যান করা খাবারে ${formattedAllergen} রয়েছে, এটি এড়িয়ে চলুন।`,
      zh: `注意，您刚刚扫描的食物中含有 ${formattedAllergen}，请避免食用。`,
      pt: `Atenção, a comida que você acabou de escanear contém ${formattedAllergen}, evite-a.`,
      ru: `Внимание, еда, которую вы только что отсканировали, содержит ${formattedAllergen}, избегайте ее.`,
      tr: `Dikkat, az önce taradığınız yiyecek ${formattedAllergen} içeriyor, tüketmekten kaçının.`,
      vi: `Chú ý, thực phẩm bạn vừa quét có chứa ${formattedAllergen}, hãy tránh dùng.`,
      ko: `주의: 방금 스캔한 음식에 ${formattedAllergen}이(가) 포함되어 있습니다. 섭취를 피하세요.`
    };

    return warningTemplates[lang] || warningTemplates['en'];
  }

  /**
   * Helper to format localized diabetic warnings
   */
  static formatDiabeticWarning(sugarAmount: number, lang: string = 'en'): string {
    const templates: Record<string, string> = {
      en: `Hey, this food has a high sugar content of ${sugarAmount}g which is dangerous for your diabetic condition. Avoid it!`,
      ar: `تنبيه: هذا الطعام يحتوي على نسبة سكر عالية قدرها ${sugarAmount}غ مما يشكل خطراً على حالة السكري لديك. تجنبه!`,
      es: `Oye, esta comida tiene un alto contenido de azúcar de ${sugarAmount}g, lo cual es peligroso para tu condición diabética. ¡Evítala!`,
      fr: `Attention, cet aliment contient une teneur élevée en sucre de ${sugarAmount}g, ce qui est dangereux pour votre diabète. Évitez-le !`,
      id: `Hei, makanan ini memiliki kandungan gula tinggi sebesar ${sugarAmount}g yang berbahaya untuk kondisi diabetes Anda. Hindari!`,
      de: `Achtung, dieses Essen hat einen hohen Zuckergehalt von ${sugarAmount}g, was gefährlich für deinen Diabetes ist. Meide es!`,
      hi: `अरे, इस भोजन में ${sugarAmount}g की उच्च शर्करा मात्रा है जो आपकी मधुमेह स्थिति के लिए खतरनाक है। इससे बचें!`,
      zh: `注意，该食物含有高达 ${sugarAmount}g 的糖分，对您的糖尿病状况非常危险。请勿食用！`
    };

    return templates[lang] || templates['en'];
  }

  /**
   * Deterministically evaluates meal analysis for declared allergies & medical condition safety gates.
   */
  static evaluateMealSafety(foodItems: any[], nutrition: any, profile: UserSafetyProfile): SafetyCheckResult {
    const textToSearch = foodItems.map(f => `${f.name} ${f.portion_description || ''}`).join(' ').toLowerCase();

    // 1. Check Allergies
    for (const allergy of profile.allergies) {
      const normAllergy = allergy.toLowerCase();
      // Keyword matching
      if (
        (normAllergy.includes('fish') || normAllergy.includes('salmon') || normAllergy.includes('tuna')) &&
        (textToSearch.includes('fish') || textToSearch.includes('salmon') || textToSearch.includes('tuna') || textToSearch.includes('cod') || textToSearch.includes('trout') || textToSearch.includes('mackerel') || textToSearch.includes('ikan'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'fish',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('fish', profile.language)
        };
      }

      if (
        (normAllergy.includes('egg')) &&
        (textToSearch.includes('egg') || textToSearch.includes('omelet') || textToSearch.includes('scrambled') || textToSearch.includes('mayo') || textToSearch.includes('telur'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'eggs',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('eggs', profile.language)
        };
      }

      if (
        (normAllergy.includes('peanut') || normAllergy.includes('nut')) &&
        (textToSearch.includes('peanut') || textToSearch.includes('almond') || textToSearch.includes('walnut') || textToSearch.includes('cashew') || textToSearch.includes('nut') || textToSearch.includes('kacang'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'nuts',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('nuts', profile.language)
        };
      }

      if (
        (normAllergy.includes('milk') || normAllergy.includes('dairy') || normAllergy.includes('lactose')) &&
        (textToSearch.includes('milk') || textToSearch.includes('cheese') || textToSearch.includes('butter') || textToSearch.includes('cream') || textToSearch.includes('susu') || textToSearch.includes('keju'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'dairy',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('dairy', profile.language)
        };
      }

      if (normAllergy.length > 2 && textToSearch.includes(normAllergy)) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: normAllergy,
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning(normAllergy, profile.language)
        };
      }
    }

    // 2. Check Diabetic Safety Gate
    if (profile.isDiabetic && nutrition) {
      const sugar = Number(nutrition.total_sugar || 0);
      if (sugar > 14) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedCondition: 'diabetic',
          warningTitle: 'Diabetic Risk Warning',
          warningMessage: this.formatDiabeticWarning(sugar, profile.language)
        };
      }
    }

    return { isSafe: true, verdict: 'GOOD' };
  }

  /**
   * Evaluates packaged products scanned via Barcode.
   */
  static evaluateProductSafety(product: any, nutrition: any, profile: UserSafetyProfile): SafetyCheckResult {
    const ingredients = (product.ingredients || '').toLowerCase();
    const allergensStr = Array.isArray(product.allergens) ? product.allergens.join(' ').toLowerCase() : String(product.allergens || '').toLowerCase();
    const productName = (product.name || '').toLowerCase();
    const combined = `${productName} ${ingredients} ${allergensStr}`;

    for (const allergy of profile.allergies) {
      const normAllergy = allergy.toLowerCase();

      if (
        (normAllergy.includes('fish') || normAllergy.includes('salmon') || normAllergy.includes('tuna')) &&
        (combined.includes('fish') || combined.includes('salmon') || combined.includes('tuna') || combined.includes('cod') || combined.includes('ikan'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'fish',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('fish', profile.language)
        };
      }

      if (
        (normAllergy.includes('egg')) &&
        (combined.includes('egg') || combined.includes('ovalbumin') || combined.includes('telur'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'eggs',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('eggs', profile.language)
        };
      }

      if (
        (normAllergy.includes('peanut') || normAllergy.includes('nut')) &&
        (combined.includes('peanut') || combined.includes('almond') || combined.includes('hazelnut') || combined.includes('kacang'))
      ) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: 'nuts',
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning('nuts', profile.language)
        };
      }

      if (normAllergy.length > 2 && combined.includes(normAllergy)) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedAllergen: normAllergy,
          warningTitle: 'Allergy Safety Warning',
          warningMessage: this.formatAllergenWarning(normAllergy, profile.language)
        };
      }
    }

    if (profile.isDiabetic && nutrition) {
      const sugar = Number(nutrition.sugar || 0);
      if (sugar > 12) {
        return {
          isSafe: false,
          verdict: 'POOR',
          matchedCondition: 'diabetic',
          warningTitle: 'Diabetic Risk Warning',
          warningMessage: this.formatDiabeticWarning(sugar, profile.language)
        };
      }
    }

    return { isSafe: true, verdict: 'GOOD' };
  }
}
