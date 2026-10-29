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

export interface GoalFitEvaluation {
  status: 'GOOD' | 'MODERATE' | 'POOR';
  targetGoal: string;
  headline: string;
  reason: string;
}

export interface SafetyCheckResult {
  isSafe: boolean;
  verdict: 'GOOD' | 'MODERATE' | 'POOR';
  warningTitle?: string;
  warningMessage?: string;
  matchedAllergen?: string;
  matchedAllergens?: string[];
  matchedCondition?: string;
  allergyWarnings?: string[];
  medicalWarnings?: string[];
  goalFit?: GoalFitEvaluation;
  alternativeSuggestion?: any;
}

const ALLERGEN_SYNONYM_GROUPS: Array<{
  canonical: string;
  userTriggers: string[];
  productKeywords: string[];
}> = [
  {
    canonical: 'milk / dairy',
    userTriggers: ['milk', 'dairy', 'lactose', 'whey', 'casein', 'susu', 'keju'],
    productKeywords: [
      'milk',
      'dairy',
      'lactose',
      'whey',
      'casein',
      'caseinate',
      'butter',
      'butterfat',
      'buttermilk',
      'cheese',
      'cream',
      'yogurt',
      'yoghurt',
      'curd',
      'ghee',
      'lactalbumin',
      'lactoglobulin',
      'skimmed milk',
      'whole milk',
      'milk powder',
      'susu',
      'keju',
      'mentega',
      'krim'
    ]
  },
  {
    canonical: 'eggs',
    userTriggers: ['egg', 'eggs', 'telur'],
    productKeywords: [
      'egg',
      'eggs',
      'albumin',
      'ovalbumin',
      'ovomucoid',
      'egg white',
      'egg yolk',
      'egg powder',
      'dried egg',
      'lysozyme',
      'mayonnaise',
      'meringue',
      'telur'
    ]
  },
  {
    canonical: 'peanuts',
    userTriggers: ['peanut', 'peanuts', 'groundnut', 'kacang tanah'],
    productKeywords: ['peanut', 'peanuts', 'groundnut', 'arachis', 'peanut butter', 'peanut oil', 'kacang tanah']
  },
  {
    canonical: 'tree nuts',
    userTriggers: ['nut', 'nuts', 'tree nut', 'tree nuts', 'almond', 'hazelnut', 'walnut', 'cashew', 'pecan', 'pistachio', 'macadamia', 'kacang'],
    productKeywords: [
      'almond',
      'hazelnut',
      'filbert',
      'walnut',
      'cashew',
      'pecan',
      'pistachio',
      'macadamia',
      'brazil nut',
      'pine nut',
      'chestnut',
      'praline',
      'marzipan',
      'gianduja',
      'tree nut',
      'kacang mede',
      'kacang mete',
      'kacang almond',
      'kacang hazelnut'
    ]
  },
  {
    canonical: 'fish',
    userTriggers: ['fish', 'salmon', 'tuna', 'cod', 'ikan'],
    productKeywords: [
      'fish',
      'salmon',
      'tuna',
      'cod',
      'anchovy',
      'anchovies',
      'sardine',
      'mackerel',
      'trout',
      'halibut',
      'haddock',
      'pollock',
      'tilapia',
      'snapper',
      'grouper',
      'herring',
      'catfish',
      'ikan'
    ]
  },
  {
    canonical: 'shellfish / crustaceans',
    userTriggers: ['shellfish', 'crustacean', 'seafood', 'shrimp', 'prawn', 'crab', 'lobster', 'udang', 'kepiting', 'kerang'],
    productKeywords: [
      'shellfish',
      'crustacean',
      'shrimp',
      'prawn',
      'crab',
      'lobster',
      'crayfish',
      'krill',
      'mollusc',
      'mollusk',
      'oyster',
      'clam',
      'mussel',
      'scallop',
      'squid',
      'calamari',
      'octopus',
      'udang',
      'kepiting',
      'kerang',
      'cumi'
    ]
  },
  {
    canonical: 'wheat / gluten',
    userTriggers: ['wheat', 'gluten', 'celiac', 'coeliac', 'barley', 'rye', 'terigu', 'gandum'],
    productKeywords: [
      'wheat',
      'gluten',
      'barley',
      'rye',
      'malt',
      'spelt',
      'kamut',
      'triticale',
      'semolina',
      'durum',
      'farina',
      'bulgur',
      'couscous',
      'seitan',
      'tepung terigu',
      'gandum'
    ]
  },
  {
    canonical: 'soy',
    userTriggers: ['soy', 'soya', 'soybean', 'kedelai'],
    productKeywords: [
      'soy',
      'soya',
      'soybean',
      'soybeans',
      'soy lecithin',
      'lecithin (soy)',
      'lecithin (soya)',
      'tofu',
      'tempeh',
      'edamame',
      'miso',
      'tamari',
      'shoyu',
      'kedelai'
    ]
  },
  {
    canonical: 'sesame',
    userTriggers: ['sesame', 'tahini', 'wijen'],
    productKeywords: ['sesame', 'tahini', 'sesamum', 'gingelly', 'wijen']
  },
  {
    canonical: 'sulfites',
    userTriggers: ['sulfite', 'sulfites', 'sulphite', 'sulphites', 'so2'],
    productKeywords: [
      'sulfite',
      'sulphite',
      'sulfur dioxide',
      'sulphur dioxide',
      'metabisulfite',
      'metabisulphite',
      'e220',
      'e221',
      'e222',
      'e223',
      'e224',
      'e226',
      'e227',
      'e228'
    ]
  }
];

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

    const allergies = Array.from(
      new Set(
        rawAllergies
          .flatMap(a => String(a).split(','))
          .map(a => a.trim().toLowerCase())
          .filter(a => a.length > 0 && a !== 'none' && a !== 'no' && a !== 'nil' && a !== 'n/a')
      )
    );

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

    let dietaryLifestyle: string[] = [];
    if (onboarding && onboarding.dietary_lifestyle) {
      dietaryLifestyle = Array.isArray(onboarding.dietary_lifestyle)
        ? onboarding.dietary_lifestyle.map((d: any) => String(d).toLowerCase())
        : [String(onboarding.dietary_lifestyle).toLowerCase()];
    }

    const isDiabetic =
      medicalConditions.some(c => c.includes('diabet') || c.includes('sugar') || c.includes('glucose')) ||
      dietaryLifestyle.some(d => d.includes('diabet'));

    const hasHypertension = medicalConditions.some(
      c => c.includes('hypertens') || c.includes('blood pressure') || c.includes('bp') || c.includes('darah tinggi')
    );

    const userGoal = onboarding?.goal || 'maintain a healthy lifestyle';
    const dailyCalorieGoal = Number(onboarding?.daily_calorie_goal || 2000);
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

  static formatAllergenWarning(allergen: string, lang: string = 'en'): string {
    const formattedAllergen = allergen.toLowerCase();

    const warningTemplates: Record<string, string> = {
      en: `ALLERGY ALERT: This product contains ${formattedAllergen}, which conflicts with your declared allergy profile. Avoid consumption.`,
      ar: `تنبيه حساسية: هذا المنتج يحتوي على ${formattedAllergen}، وهو ما يتعارض مع ملف الحساسية الخاص بك. يرجى تجنبه.`,
      es: `ALERTA DE ALERGIA: Este producto contiene ${formattedAllergen}, lo cual entra en conflicto con tu perfil de alergias. Evita su consumo.`,
      fr: `ALERTE ALLERGIE : Ce produit contient ${formattedAllergen}, ce qui est incompatible avec votre profil d'allergies. Évitez de le consommer.`,
      id: `PERINGATAN ALERGI: Produk ini mengandung ${formattedAllergen} yang bertentangan dengan profil alergi Anda. Hindari konsumsi.`,
      de: `ALLERGIEWARNUNG: Dieses Produkt enthält ${formattedAllergen}, was mit Ihrem Allergieprofil kollidiert. Bitte meiden.`,
      hi: `एलर्जी चेतावनी: इस उत्पाद में ${formattedAllergen} है, जो आपकी एलर्जी प्रोफ़ाइल के विरुद्ध है। इसके सेवन से बचें।`,
      ur: `الرجی الرٹ: اس پروڈکٹ میں ${formattedAllergen} شامل ہے، جو آپ کی الرجی پروفائل کے خلاف ہے۔ اس سے پرہیز کریں۔`,
      bn: `অ্যালার্জি সতর্কতা: এই পণ্যটিতে ${formattedAllergen} রয়েছে, যা আপনার অ্যালার্জি প্রোফাইলের সাথে সাংঘর্ষিক। এটি এড়িয়ে চলুন।`,
      zh: `过敏警告：该产品含有 ${formattedAllergen}，与您申报的过敏档案冲突，请避免食用。`,
      pt: `ALERTA DE ALERGIA: Este produto contém ${formattedAllergen}, o que conflita com seu perfil de alergia. Evite o consumo.`,
      ru: `ПРЕДУПРЕЖДЕНИЕ ОБ АЛЛЕРГИИ: Этот продукт содержит ${formattedAllergen}, что противоречит вашему профилю аллергии. Избегайте употребления.`,
      tr: `ALERJİ UYARISI: Bu ürün alerji profilinizle çelişen ${formattedAllergen} içeriyor. Tüketmekten kaçının.`,
      vi: `CẢNH BÁO DỊ ỨNG: Sản phẩm này có chứa ${formattedAllergen}, xung đột với hồ sơ dị ứng của bạn. Hãy tránh sử dụng.`,
      ko: `알레르기 경고: 이 제품에는 귀하의 알레르기 프로필과 충돌하는 ${formattedAllergen}이(가) 포함되어 있습니다. 섭취를 피하세요.`
    };

    return warningTemplates[lang] || warningTemplates['en'];
  }

  static formatDiabeticWarning(sugarAmount: number, lang: string = 'en'): string {
    const templates: Record<string, string> = {
      en: `DIABETIC WARNING: This product contains a high sugar load (${sugarAmount}g), which poses a glycemic risk for your diabetic profile. Avoid consumption.`,
      ar: `تنبيه لمرضى السكري: يحتوي هذا المنتج على نسبة سكر عالية (${sugarAmount}غ) مما يشكل خطراً على مستوى السكر لديك. تجنبه!`,
      es: `ADVERTENCIA DIABÉTICA: Este producto tiene un alto contenido de azúcar (${sugarAmount}g), riesgoso para tu condición diabética. ¡Evítalo!`,
      fr: `AVERTISSEMENT DIABÈTE : Cet aliment contient une teneur élevée en sucre (${sugarAmount}g), dangereuse pour votre diabète. Évitez-le !`,
      id: `PERINGATAN DIABETES: Produk ini memiliki kandungan gula tinggi (${sugarAmount}g) yang berisiko bagi kondisi diabetes Anda. Hindari!`,
      de: `DIABETES-WARNUNG: Dieses Produkt hat einen hohen Zuckergehalt (${sugarAmount}g), was für Ihren Diabetes gefährlich ist. Bitte meiden!`,
      hi: `मधुमेह चेतावनी: इस उत्पाद में ${sugarAmount}g उच्च शर्करा मात्रा है जो आपकी मधुमेह स्थिति के लिए जोखिमपूर्ण है। इससे बचें!`,
      zh: `糖尿病警告：该产品含有高达 ${sugarAmount}g 的糖分，对您的血糖控制存在风险，请勿食用！`
    };

    return templates[lang] || templates['en'];
  }

  static formatHypertensionWarning(sodiumMg: number, lang: string = 'en'): string {
    const templates: Record<string, string> = {
      en: `HYPERTENSION WARNING: This product is high in sodium (${sodiumMg}mg), which conflicts with your blood pressure profile. Avoid or strictly limit consumption.`,
      id: `PERINGATAN HIPERTENSI: Produk ini tinggi natrium (${sodiumMg}mg), berisiko bagi tekanan darah Anda. Hindari atau batasi ketat.`,
      ar: `تنبيه ضغط الدم: يحتوي هذا المنتج على نسبة عالية من الصوديوم (${sodiumMg}ملغ) مما يتعارض مع ضغط الدم لديك.`,
      es: `ADVERTENCIA DE HIPERTENSIÓN: Este producto es alto en sodio (${sodiumMg}mg), lo que afecta tu presión arterial.`,
      fr: `AVERTISSEMENT HYPERTENSION : Ce produit est riche en sodium (${sodiumMg}mg), déconseillé pour votre tension artérielle.`
    };
    return templates[lang] || templates['en'];
  }

  /**
   * Deterministically evaluates meal analysis for declared allergies & medical condition safety gates.
   * (Preserved for Camera Meal Analysis).
   */
  static evaluateMealSafety(foodItems: any[], nutrition: any, profile: UserSafetyProfile): SafetyCheckResult {
    const textToSearch = foodItems.map(f => `${f.name} ${f.portion_description || ''}`).join(' ').toLowerCase();

    for (const allergy of profile.allergies) {
      const normAllergy = allergy.toLowerCase();
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
        normAllergy.includes('egg') &&
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
   * Deterministically evaluates how a packaged barcode product fits the user's active goal and calorie budget.
   */
  static evaluateGoalFit(product: any, nutrition: any, profile: UserSafetyProfile): GoalFitEvaluation {
    const targetGoal = profile.userGoal || 'Healthy Lifestyle';
    const goalLower = targetGoal.toLowerCase();
    const dailyTarget = profile.dailyCalorieGoal || 2000;

    const calories = typeof nutrition?.calories === 'number' && !isNaN(nutrition.calories) ? nutrition.calories : null;
    const protein = typeof nutrition?.protein === 'number' && !isNaN(nutrition.protein) ? nutrition.protein : null;
    const carbs = typeof nutrition?.carbohydrates === 'number' && !isNaN(nutrition.carbohydrates) ? nutrition.carbohydrates : null;
    const fat = typeof nutrition?.fat === 'number' && !isNaN(nutrition.fat) ? nutrition.fat : null;
    const sugar = typeof nutrition?.sugar === 'number' && !isNaN(nutrition.sugar) ? nutrition.sugar : null;
    const fiber = typeof nutrition?.fiber === 'number' && !isNaN(nutrition.fiber) ? nutrition.fiber : null;
    const sodium = typeof nutrition?.sodium_mg === 'number' && !isNaN(nutrition.sodium_mg) ? nutrition.sodium_mg : null;
    const basisLabel = nutrition?.basis === 'serving' ? `per serving (${product?.serving_size || '1 serving'})` : 'per 100g';

    if (calories === null) {
      return {
        status: 'MODERATE',
        targetGoal,
        headline: `Goal Fit (${targetGoal}): Nutrition Facts Unavailable`,
        reason: `Catalog calories and macronutrients are not documented for this barcode. Inspect the physical label against your ${dailyTarget} kcal/day target.`
      };
    }

    const isWeightLossGoal =
      goalLower.includes('lose') ||
      goalLower.includes('weight loss') ||
      goalLower.includes('fat') ||
      goalLower.includes('slim') ||
      goalLower.includes('cut') ||
      goalLower.includes('deficit') ||
      goalLower.includes('turun');

    const isMuscleGainGoal =
      goalLower.includes('muscle') ||
      goalLower.includes('gain') ||
      goalLower.includes('strength') ||
      goalLower.includes('bulk') ||
      goalLower.includes('protein') ||
      goalLower.includes('otot');

    const pctOfDaily = Math.round((calories / dailyTarget) * 100);

    if (isWeightLossGoal) {
      const highSugar = (sugar !== null && sugar >= 15);
      const highEnergy = (nutrition?.basis === 'serving' ? calories >= 320 : calories >= 420);
      const highFat = (fat !== null && (nutrition?.basis === 'serving' ? fat >= 15 : fat >= 20));

      if (highSugar || highEnergy || highFat) {
        const triggers: string[] = [];
        if (highEnergy) triggers.push(`high energy (${calories} kcal ${basisLabel}, ~${pctOfDaily}% of daily goal)`);
        if (highSugar) triggers.push(`high sugar (${sugar}g)`);
        if (highFat) triggers.push(`high fat (${fat}g)`);
        return {
          status: 'POOR',
          targetGoal,
          headline: `Poor Fit for ${targetGoal}`,
          reason: `Contains ${triggers.join(' and ')}, which works against a calorie-deficit / weight-loss plan (${dailyTarget} kcal/day).`
        };
      }

      if (calories >= 160 || (sugar !== null && sugar >= 8) || (fat !== null && fat >= 9)) {
        return {
          status: 'MODERATE',
          targetGoal,
          headline: `Moderate Fit for ${targetGoal} — Portion Control Advised`,
          reason: `Provides ${calories} kcal ${basisLabel} (${protein ?? 0}g protein, ${sugar ?? 0}g sugar, ${fat ?? 0}g fat). Fit only in controlled portions within your ${dailyTarget} kcal daily budget.`
        };
      }

      return {
        status: 'GOOD',
        targetGoal,
        headline: `Good Fit for ${targetGoal}`,
        reason: `Low energy load (${calories} kcal ${basisLabel}, ${sugar ?? 0}g sugar${protein ? `, ${protein}g protein` : ''}) fits comfortably within your ${dailyTarget} kcal daily goal.`
      };
    }

    if (isMuscleGainGoal) {
      if (protein !== null && protein >= 10 && (sugar === null || sugar <= 18)) {
        return {
          status: 'GOOD',
          targetGoal,
          headline: `Strong Fit for ${targetGoal}`,
          reason: `Delivers ${protein}g protein and ${calories} kcal ${basisLabel} to support muscle synthesis and daily recovery.`
        };
      }

      if ((protein === null || protein < 4) && ((sugar !== null && sugar >= 14) || calories >= 250)) {
        return {
          status: 'POOR',
          targetGoal,
          headline: `Poor Fit for ${targetGoal}`,
          reason: `Low protein content (${protein ?? 0}g) alongside ${calories} kcal and ${sugar ?? 0}g sugar ${basisLabel} provides poor macronutrient quality for muscle building.`
        };
      }

      return {
        status: 'MODERATE',
        targetGoal,
        headline: `Moderate Fit for ${targetGoal}`,
        reason: `Provides ${protein ?? 0}g protein and ${calories} kcal ${basisLabel} (${carbs ?? 0}g carbs, ${fat ?? 0}g fat). Pair with a lean protein source to reach your target.`
      };
    }

    // General wellness / maintenance objective
    const excessiveSugar = sugar !== null && sugar >= 18;
    const excessiveSodium = sodium !== null && sodium >= 550;
    const excessiveCalories = nutrition?.basis === 'serving' ? calories >= 400 : calories >= 480;

    if (excessiveSugar || excessiveSodium || excessiveCalories) {
      const reasons: string[] = [];
      if (excessiveCalories) reasons.push(`${calories} kcal ${basisLabel}`);
      if (excessiveSugar) reasons.push(`high sugar (${sugar}g)`);
      if (excessiveSodium) reasons.push(`high sodium (${sodium}mg)`);
      return {
        status: 'POOR',
        targetGoal,
        headline: `Poor Nutritional Fit for Your Plan (${targetGoal})`,
        reason: `Flagged for ${reasons.join(', ')}, which exceeds healthy single-item thresholds for your ${dailyTarget} kcal/day plan.`
      };
    }

    if (
      (sugar !== null && sugar >= 10) ||
      (sodium !== null && sodium >= 350) ||
      (fat !== null && fat >= 14) ||
      calories >= 220
    ) {
      return {
        status: 'MODERATE',
        targetGoal,
        headline: `Moderate Fit for Your Plan (${targetGoal})`,
        reason: `Supplies ${calories} kcal ${basisLabel} (${protein ?? 0}g protein, ${carbs ?? 0}g carbs, ${fat ?? 0}g fat, ${sugar ?? 0}g sugar). Consume mindfully within your ${dailyTarget} kcal/day target.`
      };
    }

    return {
      status: 'GOOD',
      targetGoal,
      headline: `Good Fit for Your Plan (${targetGoal})`,
      reason: `Balanced nutrient profile (${calories} kcal ${basisLabel}, ${protein ?? 0}g protein, ${sugar ?? 0}g sugar${fiber ? `, ${fiber}g fiber` : ''}) aligns well with your ${targetGoal} goal.`
    };
  }

  /**
   * Evaluates packaged products scanned via Barcode for:
   * 1. Declared Allergens (comprehensive synonym matching on ingredients, allergens_tags, traces, and product name)
   * 2. Medical Conditions (Diabetes sugar gate, Hypertension sodium gate)
   * 3. Active User Goal Fit (Weight Loss, Muscle Gain, or General Wellness)
   */
  static evaluateProductSafety(product: any, nutrition: any, profile: UserSafetyProfile): SafetyCheckResult {
    const rawIngredients = (product.ingredients || '').toLowerCase();
    const ingredients =
      rawIngredients.includes('not listed in database') || rawIngredients.includes('not declared')
        ? ''
        : rawIngredients;
    const allergensStr = Array.isArray(product.allergens)
      ? product.allergens.join(' ').toLowerCase()
      : String(product.allergens || '').toLowerCase();
    const tracesStr = Array.isArray(product.traces)
      ? product.traces.join(' ').toLowerCase()
      : String(product.traces || '').toLowerCase();
    const productName = (product.name || '').toLowerCase();
    const combined = ` ${productName} ${ingredients} ${allergensStr} ${tracesStr} `;

    const matchedAllergensSet = new Set<string>();
    const allergyWarnings: string[] = [];

    // 1. Check comprehensive allergen groups + direct custom user allergies
    for (const allergy of profile.allergies) {
      const normAllergy = allergy.toLowerCase().trim();
      if (!normAllergy) continue;

      let matchedGroup = false;
      for (const group of ALLERGEN_SYNONYM_GROUPS) {
        const userHasGroupAllergy = group.userTriggers.some(
          trig => normAllergy.includes(trig) || trig.includes(normAllergy)
        );
        if (userHasGroupAllergy) {
          const foundKeyword = group.productKeywords.find(kw => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`\\b${escaped}\\b`, 'i').test(combined);
          });
          if (foundKeyword) {
            matchedGroup = true;
            if (!matchedAllergensSet.has(group.canonical)) {
              matchedAllergensSet.add(group.canonical);
              allergyWarnings.push(this.formatAllergenWarning(`${group.canonical} (${foundKeyword})`, profile.language));
            }
          }
        }
      }

      if (!matchedGroup && normAllergy.length > 2) {
        const escaped = normAllergy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(combined)) {
          if (!matchedAllergensSet.has(normAllergy)) {
            matchedAllergensSet.add(normAllergy);
            allergyWarnings.push(this.formatAllergenWarning(normAllergy, profile.language));
          }
        }
      }
    }

    // 2. Check Medical Conditions (Diabetes & Hypertension)
    const medicalWarnings: string[] = [];
    let matchedCondition: string | undefined = undefined;

    if (profile.isDiabetic && nutrition) {
      const sugar = typeof nutrition.sugar === 'number' ? nutrition.sugar : 0;
      if (sugar > 12) {
        matchedCondition = 'diabetic';
        medicalWarnings.push(this.formatDiabeticWarning(sugar, profile.language));
      }
    }

    if (profile.hasHypertension && nutrition) {
      const sodiumMg = typeof nutrition.sodium_mg === 'number' ? nutrition.sodium_mg : 0;
      if (sodiumMg >= 400) {
        matchedCondition = matchedCondition || 'hypertension';
        medicalWarnings.push(this.formatHypertensionWarning(sodiumMg, profile.language));
      }
    }

    // 3. Evaluate Goal Fit
    const goalFit = this.evaluateGoalFit(product, nutrition, profile);

    const matchedAllergens = Array.from(matchedAllergensSet);
    const hasHardSafetyViolation = allergyWarnings.length > 0 || medicalWarnings.length > 0;

    if (hasHardSafetyViolation) {
      const allWarnings = [...allergyWarnings, ...medicalWarnings];
      return {
        isSafe: false,
        verdict: 'POOR',
        matchedAllergen: matchedAllergens[0],
        matchedAllergens,
        matchedCondition,
        allergyWarnings,
        medicalWarnings,
        warningTitle: allergyWarnings.length > 0 ? 'Allergy Safety Alert' : 'Medical Condition Alert',
        warningMessage: allWarnings.join(' '),
        goalFit: {
          ...goalFit,
          status: 'POOR',
          headline: allergyWarnings.length > 0
            ? `Unsafe — Contains Declared Allergen (${matchedAllergens.join(', ')})`
            : `Unsafe — Medical Contradiction (${matchedCondition})`
        }
      };
    }

    return {
      isSafe: true,
      verdict: goalFit.status,
      allergyWarnings: [],
      medicalWarnings: [],
      goalFit
    };
  }
}
