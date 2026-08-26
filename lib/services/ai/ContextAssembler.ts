import { SupabaseClient } from '@supabase/supabase-js';

export interface UserProfileContext {
  id: string;
  fullName?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  goal?: string;
  activityLevel?: string;
  dietaryPreference?: string;
  allergies?: string[];
  medicalConditions?: string[];
  dailyCalorieGoal?: number;
  macroGoals?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
  };
  likedFoods?: string[];
  preferredCuisines?: string[];
  cookingSkill?: string;
  mealPrepTime?: string;
  dailyMealFrequency?: string;
  budget?: number;
}

export interface MealPlanContext {
  todaysMeals: Array<{
    mealType?: string;
    foodName?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  }>;
  totalCaloriesLoggedToday: number;
  calorieTarget: number;
}

export interface BudgetContext {
  dailyTarget: number;
  totalBudget: number;
  spentSoFar: number;
  remainingBudget: number;
  currency: string;
  status: 'within_budget' | 'near_limit' | 'exceeded';
}

export interface AffiliationRecord {
  companyName: string;
  parentCompany?: string | null;
  affiliationType?: string | null;
  usAffiliated?: boolean;
  israelAffiliated?: boolean;
  uaeAffiliated?: boolean;
  notes?: string | null;
  dataSources?: string[];
  verificationStatus?: string | null;
}

export interface AssembledContext {
  profile?: UserProfileContext | null;
  mealPlan?: MealPlanContext | null;
  budget?: BudgetContext | null;
  affiliation?: AffiliationRecord | null;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const profileCache = new Map<string, { data: UserProfileContext | null; timestamp: number }>();
const PROFILE_CACHE_TTL = 60 * 1000; // 60 seconds

export async function loadUserProfileContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfileContext | null> {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.data;
  }

  try {
    const [profileRes, onboardingRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, age, gender, height, current_weight, primary_goal, dietary_preference, allergies, medical_conditions, daily_calorie_target')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('onboarding_responses')
        .select('full_name, age, gender, height_cm, weight_kg, goal, dietary_lifestyle, dietary_preference, restrictions, allergies, liked_foods, preferences, preferred_cuisines, cooking_skill, meal_prep_time, activity_level, daily_meal_frequency, calorie_flexibility, protein_goal, carbs_goal, fat_goal, fiber_goal, sugar_goal, medical_conditions, health_conditions, daily_calorie_goal, budget')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    const profile = profileRes.data;
    const onboarding = onboardingRes.data;

    if (!profile && !onboarding) return null;

    // Collect allergies and restrictions
    const rawAllergies: string[] = [];
    if (profile?.allergies) {
      if (Array.isArray(profile.allergies)) rawAllergies.push(...profile.allergies);
      else if (typeof profile.allergies === 'string') rawAllergies.push(...profile.allergies.split(/[,;\n]+/).map((s: string) => s.trim()));
    }
    if (onboarding?.allergies) {
      if (Array.isArray(onboarding.allergies)) {
        rawAllergies.push(...onboarding.allergies);
      } else if (typeof onboarding.allergies === 'string') {
        const cleanedStr = onboarding.allergies.trim();
        if (cleanedStr && cleanedStr.toLowerCase() !== 'none') {
          if (cleanedStr.includes(',')) {
            rawAllergies.push(...cleanedStr.split(',').map((s: string) => s.trim()));
          } else {
            const tokens = cleanedStr.split(/\s+/).filter(Boolean);
            const merged: string[] = [];
            for (let i = 0; i < tokens.length; i++) {
              if (tokens[i].toLowerCase() === 'egg' && tokens[i+1]?.toLowerCase() === 'whites') {
                merged.push('Egg whites');
                i++;
              } else {
                merged.push(tokens[i]);
              }
            }
            rawAllergies.push(...merged);
          }
        }
      }
    }
    if (onboarding?.restrictions) {
      if (Array.isArray(onboarding.restrictions)) {
        rawAllergies.push(...onboarding.restrictions.filter((r: any) => typeof r === 'string' && r.toLowerCase() !== 'none'));
      } else if (typeof onboarding.restrictions === 'string' && onboarding.restrictions.toLowerCase() !== 'none') {
        rawAllergies.push(...onboarding.restrictions.split(/[,;\n]+/).map((s: string) => s.trim()));
      }
    }
    const allergies = Array.from(new Set(rawAllergies.map((a: string) => a.trim()).filter((a: string) => a && a.toLowerCase() !== 'none')));

    // Collect medical conditions
    const rawConditions: string[] = [];
    if (profile?.medical_conditions) {
      if (Array.isArray(profile.medical_conditions)) rawConditions.push(...profile.medical_conditions);
      else rawConditions.push(String(profile.medical_conditions));
    }
    if (onboarding?.medical_conditions && String(onboarding.medical_conditions).toLowerCase() !== 'none') {
      rawConditions.push(String(onboarding.medical_conditions).trim());
    }
    if (onboarding?.health_conditions && String(onboarding.health_conditions).toLowerCase() !== 'none') {
      rawConditions.push(String(onboarding.health_conditions).trim());
    }
    const medicalConditions = Array.from(new Set(rawConditions.filter(Boolean)));

    // Dietary lifestyles / preferences
    const dietaryLifestyles: string[] = [];
    if (profile?.dietary_preference) dietaryLifestyles.push(profile.dietary_preference);
    if (onboarding?.dietary_preference && onboarding.dietary_preference.toLowerCase() !== 'none') {
      dietaryLifestyles.push(onboarding.dietary_preference);
    }
    if (onboarding?.dietary_lifestyle) {
      if (Array.isArray(onboarding.dietary_lifestyle)) {
        dietaryLifestyles.push(...onboarding.dietary_lifestyle.filter((d: any) => typeof d === 'string' && d.toLowerCase() !== 'none'));
      } else if (typeof onboarding.dietary_lifestyle === 'string' && onboarding.dietary_lifestyle.toLowerCase() !== 'none') {
        dietaryLifestyles.push(onboarding.dietary_lifestyle);
      }
    }
    const cleanDietary = Array.from(new Set(dietaryLifestyles.map((d: string) => d.trim()).filter(Boolean)));

    // Parse Liked Foods & Cuisines
    let likedFoods: string[] = [];
    if (onboarding?.liked_foods) {
      if (Array.isArray(onboarding.liked_foods)) likedFoods = onboarding.liked_foods.map(String);
      else if (typeof onboarding.liked_foods === 'string') likedFoods = onboarding.liked_foods.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    let preferredCuisines: string[] = [];
    if (onboarding?.preferred_cuisines) {
      if (Array.isArray(onboarding.preferred_cuisines)) preferredCuisines = onboarding.preferred_cuisines.map(String);
      else if (typeof onboarding.preferred_cuisines === 'string') preferredCuisines = onboarding.preferred_cuisines.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    const result: UserProfileContext = {
      id: profile?.id || userId,
      fullName: profile?.full_name || onboarding?.full_name || 'User',
      age: profile?.age || onboarding?.age || undefined,
      gender: profile?.gender || onboarding?.gender || undefined,
      height: profile?.height ? Number(profile.height) : (onboarding?.height_cm ? Number(onboarding.height_cm) : undefined),
      weight: profile?.current_weight ? Number(profile.current_weight) : (onboarding?.weight_kg ? Number(onboarding.weight_kg) : undefined),
      goal: profile?.primary_goal || onboarding?.goal || 'General Health',
      activityLevel: onboarding?.activity_level || undefined,
      dietaryPreference: cleanDietary.join(', ') || 'Standard',
      allergies,
      medicalConditions,
      dailyCalorieGoal: profile?.daily_calorie_target || onboarding?.daily_calorie_goal || 2000,
      macroGoals: {
        protein: Number(onboarding?.protein_goal) || undefined,
        carbs: Number(onboarding?.carbs_goal) || undefined,
        fat: Number(onboarding?.fat_goal) || undefined,
        fiber: Number(onboarding?.fiber_goal) || undefined,
        sugar: Number(onboarding?.sugar_goal) || undefined,
      },
      likedFoods,
      preferredCuisines,
      cookingSkill: onboarding?.cooking_skill || undefined,
      mealPrepTime: onboarding?.meal_prep_time || undefined,
      dailyMealFrequency: onboarding?.daily_meal_frequency || undefined,
      budget: onboarding?.budget ? Number(onboarding.budget) : undefined
    };

    profileCache.set(userId, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.warn('[ContextAssembler] Error loading user profile:', err);
    return null;
  }
}

export async function loadMealPlanContext(
  supabase: SupabaseClient,
  userId: string
): Promise<MealPlanContext | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Load logged food for today
    const { data: loggedHistory } = await supabase
      .from('food_analysis_history')
      .select('meal_type, food_name, calories, protein, carbs, fat')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`);

    const meals = (loggedHistory || []).map((item: any) => ({
      mealType: item.meal_type || 'meal',
      foodName: item.food_name || 'Food item',
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0
    }));

    const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);

    // Get daily progress target if exists
    const { data: progress } = await supabase
      .from('daily_progress')
      .select('calories_goal')
      .eq('user_id', userId)
      .eq('progress_date', today)
      .maybeSingle();

    return {
      todaysMeals: meals,
      totalCaloriesLoggedToday: totalCalories,
      calorieTarget: progress?.calories_goal || 2000
    };
  } catch (err) {
    console.warn('[ContextAssembler] Error loading meal context:', err);
    return null;
  }
}

export async function loadBudgetContext(
  supabase: SupabaseClient,
  userId: string
): Promise<BudgetContext | null> {
  try {
    const { data: budget } = await supabase
      .from('user_budgets')
      .select('id, total_amount, spent_amount, currency, period_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!budget) return null;

    const total = Number(budget.total_amount) || 0;
    const spent = Number(budget.spent_amount) || 0;
    const remaining = Math.max(0, total - spent);
    const daily = total > 0 ? Number((total / 30).toFixed(2)) : 0;

    let status: 'within_budget' | 'near_limit' | 'exceeded' = 'within_budget';
    if (spent >= total && total > 0) status = 'exceeded';
    else if (spent >= total * 0.85 && total > 0) status = 'near_limit';

    return {
      dailyTarget: daily,
      totalBudget: total,
      spentSoFar: spent,
      remainingBudget: remaining,
      currency: budget.currency || 'USD',
      status
    };
  } catch (err) {
    console.warn('[ContextAssembler] Error loading budget context:', err);
    return null;
  }
}

export async function loadAffiliationContext(
  supabase: SupabaseClient,
  queryOrEntity?: string | null
): Promise<AffiliationRecord | null> {
  if (!queryOrEntity) return null;
  try {
    const term = queryOrEntity.trim();
    // Search in companies table by name or alias
    const { data: company } = await supabase
      .from('companies')
      .select('name, parent_company_id, affiliation_type, us_affiliated, israel_affiliated, uae_affiliated, notes, data_sources, enrichment_status')
      .ilike('name', `%${term}%`)
      .limit(1)
      .maybeSingle();

    if (!company) return null;

    return {
      companyName: company.name,
      parentCompany: company.parent_company_id,
      affiliationType: company.affiliation_type,
      usAffiliated: company.us_affiliated || false,
      israelAffiliated: company.israel_affiliated || false,
      uaeAffiliated: company.uae_affiliated || false,
      notes: company.notes,
      dataSources: company.data_sources || [],
      verificationStatus: company.enrichment_status
    };
  } catch (err) {
    console.warn('[ContextAssembler] Error loading affiliation context:', err);
    return null;
  }
}

export async function loadRecentConversationHistory(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  try {
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!msgs || msgs.length === 0) return [];

    const COACH_ID = '00000000-0000-0000-0000-000000000001';
    return msgs
      .reverse()
      .filter((m: any) => m.content && typeof m.content === 'string')
      .map((m: any) => ({
        role: m.sender_id === COACH_ID ? ('assistant' as const) : ('user' as const),
        content: m.content
      }));
  } catch (err) {
    console.warn('[ContextAssembler] Error loading conversation history:', err);
    return [];
  }
}
