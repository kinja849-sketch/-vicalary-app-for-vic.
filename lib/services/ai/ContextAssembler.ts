import { SupabaseClient } from '@supabase/supabase-js';
import { parseAllergyTokens } from '@/lib/services/recipes/AllergenMatcher';

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
  dietaryLifestyle?: string[];
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
  dislikedFoods?: string[];
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
        .select('*')
        .eq('id', userId)
        .limit(1),
      supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    const profile: Record<string, any> | null = Array.isArray(profileRes.data) ? profileRes.data[0] || null : profileRes.data;
    const onboarding: Record<string, any> | null = Array.isArray(onboardingRes.data) ? onboardingRes.data[0] || null : onboardingRes.data;

    if (!profile && !onboarding) return null;

    // Collect allergies and restrictions via normalized parseAllergyTokens
    const rawAllergies: string[] = [];
    if (profile?.allergies) {
      rawAllergies.push(...parseAllergyTokens(profile.allergies));
    }
    if (onboarding?.allergies) {
      rawAllergies.push(...parseAllergyTokens(onboarding.allergies));
    }
    if (onboarding?.restrictions) {
      rawAllergies.push(...parseAllergyTokens(onboarding.restrictions));
    }
    const allergies = Array.from(
      new Set(
        rawAllergies
          .map((a: string) => a.trim())
          .filter((a: string) => a && a.toLowerCase() !== 'none')
      )
    );

    // Collect medical conditions
    const rawConditions: string[] = [];
    if (profile?.medical_conditions) {
      if (Array.isArray(profile.medical_conditions)) rawConditions.push(...profile.medical_conditions);
      else rawConditions.push(String(profile.medical_conditions));
    }
    if (profile?.health_conditions) {
      if (Array.isArray(profile.health_conditions)) rawConditions.push(...profile.health_conditions);
      else if (typeof profile.health_conditions === 'string') rawConditions.push(profile.health_conditions);
    }
    if (onboarding?.medical_conditions && String(onboarding.medical_conditions).toLowerCase() !== 'none') {
      rawConditions.push(String(onboarding.medical_conditions).trim());
    }
    if (onboarding?.health_conditions && String(onboarding.health_conditions).toLowerCase() !== 'none') {
      rawConditions.push(String(onboarding.health_conditions).trim());
    }
    const medicalConditions = Array.from(new Set(rawConditions.map(String).filter((c) => c && c.toLowerCase() !== 'none' && c !== '[]')));

    // Dietary lifestyles / preferences
    const dietaryLifestyles: string[] = [];
    if (profile?.dietary_preference) dietaryLifestyles.push(String(profile.dietary_preference));
    if (Array.isArray(profile?.dietary_preferences)) {
      dietaryLifestyles.push(...profile.dietary_preferences.map(String));
    }
    if (onboarding?.dietary_preference && String(onboarding.dietary_preference).toLowerCase() !== 'none') {
      dietaryLifestyles.push(String(onboarding.dietary_preference));
    }
    if (onboarding?.dietary_lifestyle) {
      if (Array.isArray(onboarding.dietary_lifestyle)) {
        dietaryLifestyles.push(...onboarding.dietary_lifestyle.filter((d: any) => typeof d === 'string' && d.toLowerCase() !== 'none'));
      } else if (typeof onboarding.dietary_lifestyle === 'string' && onboarding.dietary_lifestyle.toLowerCase() !== 'none') {
        dietaryLifestyles.push(onboarding.dietary_lifestyle);
      }
    }
    const cleanDietary = Array.from(new Set(dietaryLifestyles.map((d: string) => d.trim()).filter(Boolean)));

    // Parse Liked Foods, Disliked Foods & Cuisines
    let likedFoods: string[] = [];
    if (onboarding?.liked_foods) {
      if (Array.isArray(onboarding.liked_foods)) likedFoods = onboarding.liked_foods.map(String);
      else if (typeof onboarding.liked_foods === 'string') likedFoods = onboarding.liked_foods.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    let dislikedFoods: string[] = [];
    const rawDisliked = onboarding?.disliked_foods ?? onboarding?.dislikes ?? profile?.disliked_foods;
    if (rawDisliked) {
      if (Array.isArray(rawDisliked)) {
        dislikedFoods = rawDisliked.map(String).map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none');
      } else if (typeof rawDisliked === 'string') {
        dislikedFoods = rawDisliked.split(/[,;\n]+/).map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none');
      }
    }

    let preferredCuisines: string[] = [];
    if (onboarding?.preferred_cuisines) {
      if (Array.isArray(onboarding.preferred_cuisines)) preferredCuisines = onboarding.preferred_cuisines.map(String);
      else if (typeof onboarding.preferred_cuisines === 'string') preferredCuisines = onboarding.preferred_cuisines.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }

    const rawHeight = profile?.height_cm ?? profile?.height ?? onboarding?.height_cm;
    const rawWeight = profile?.weight_kg ?? profile?.current_weight ?? onboarding?.weight_kg;
    const rawCalorieGoal =
      onboarding?.daily_calorie_goal ||
      profile?.goal_calories ||
      profile?.daily_calorie_target ||
      2000;

    const result: UserProfileContext = {
      id: profile?.id || userId,
      fullName: profile?.full_name || onboarding?.full_name || 'User',
      age: profile?.age || onboarding?.age || undefined,
      gender: profile?.gender || onboarding?.gender || undefined,
      height: rawHeight ? Number(rawHeight) : undefined,
      weight: rawWeight ? Number(rawWeight) : undefined,
      goal: onboarding?.goal || profile?.primary_goal || 'General Health',
      activityLevel: onboarding?.activity_level || profile?.activity_level || undefined,
      dietaryPreference: cleanDietary.join(', ') || 'Standard',
      dietaryLifestyle: cleanDietary,
      allergies,
      medicalConditions,
      dailyCalorieGoal: Number(rawCalorieGoal) || 2000,
      macroGoals: {
        protein: Number(onboarding?.protein_goal || profile?.daily_protein_goal_g) || undefined,
        carbs: Number(onboarding?.carbs_goal || profile?.daily_carbs_goal_g) || undefined,
        fat: Number(onboarding?.fat_goal || profile?.daily_fat_goal_g) || undefined,
        fiber: Number(onboarding?.fiber_goal) || undefined,
        sugar: Number(onboarding?.sugar_goal) || undefined,
      },
      likedFoods,
      dislikedFoods,
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
    const { data: loggedHistory, error: historyError } = await supabase
      .from('food_analysis_history')
      .select('meal_type, food_name, calories, protein, carbs, fat')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`);

    if (historyError) {
      console.warn('[ContextAssembler] Error loading food_analysis_history:', historyError);
      return null;
    }

    // Get daily progress target if exists
    const { data: progress, error: progressError } = await supabase
      .from('daily_progress')
      .select('calories_goal')
      .eq('user_id', userId)
      .eq('progress_date', today)
      .maybeSingle();

    if (progressError) {
      console.warn('[ContextAssembler] Error loading daily_progress:', progressError);
      return null;
    }

    const meals = (loggedHistory || []).map((item: any) => ({
      mealType: item.meal_type || 'meal',
      foodName: item.food_name || 'Food item',
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0
    }));

    const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);

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
  const term = queryOrEntity.trim();
  if (!term || term.length < 2) return null;

  try {
    // Search in companies table by exact normalized name or aliases
    const { data: companies } = await supabase
      .from('companies')
      .select('name, parent_company_id, affiliation_type, us_affiliated, israel_affiliated, uae_affiliated, notes, data_sources, enrichment_status, aliases')
      .or(`name.ilike.${term},aliases.cs.{${term}}`)
      .limit(2);

    if (!companies || companies.length !== 1) return null;
    const company = companies[0];

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
