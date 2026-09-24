"use client"
import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, AlertCircle, Sparkles, MessageSquare, Flame, Apple, ShieldAlert, ChevronRight, Scale, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/store/analysisStore";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/api/translation";
import { getOrCreateCoachConversation } from "@/lib/api/chat";

export interface MealAnalysisProps {
  mealImage: string;
  totalCalories?: number;
  calorieRange?: { min: number; max: number };
  dailyCalorieGoal?: number;
  foodItems?: any[];
  analysis?: any;
  onClose: () => void;
  onLog: () => void;
  onRetry?: () => void;
}

export function MealAnalysis({
  mealImage,
  totalCalories,
  calorieRange,
  dailyCalorieGoal = 2000,
  foodItems = [],
  analysis,
  onClose,
  onLog,
  onRetry
}: MealAnalysisProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();
  const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
  const setNavbarHidden = useAnalysisStore(state => state.setNavbarHidden);
  const [isLogging, setIsLogging] = useState(false);
  const [isNavigatingCoach, setIsNavigatingCoach] = useState(false);

  // STRICT RULE: Hide bottom navigation while viewing Meal Analysis
  useEffect(() => {
    setNavbarHidden(true);
    return () => setNavbarHidden(false);
  }, [setNavbarHidden]);

  // Extract fields from analysis or fallback
  const data = analysis || {};
  const name = data.name || (foodItems[0]?.name) || "Meal Analysis";
  const mealDescription = data.description || (foodItems[0]?.description) || "";
  const vitaminsAndNutrition = data.vitamins_and_nutrition || (foodItems[0]?.vitamins_and_nutrition) || "";
  const recommendation = data.recommendation || (foodItems[0]?.recommendation) || "";
  const verdict = (data.verdict || data.healthStatus || (foodItems[0]?.healthStatus) || "MODERATE").toUpperCase();
  const isRecommended = data.is_recommended ?? (verdict !== "POOR");
  const alternativeMeal = data.alternative_meal || null;

  const calories = Number(data.calories ?? totalCalories ?? (foodItems[0]?.calories) ?? 0);
  const minCal = calorieRange?.min ?? data.calorie_range?.min ?? Math.round(calories * 0.88);
  const maxCal = calorieRange?.max ?? data.calorie_range?.max ?? Math.round(calories * 1.12);

  const protein = Number(data.protein ?? (foodItems[0]?.protein) ?? 0);
  const carbs = Number(data.carbs ?? (foodItems[0]?.carbs) ?? 0);
  const fat = Number(data.fat ?? (foodItems[0]?.fat) ?? 0);
  const fiber = Number(data.fiber ?? (foodItems[0]?.fiber) ?? 0);
  const sugar = Number(data.sugar ?? (foodItems[0]?.sugar) ?? 0);
  const sodium = Number(data.sodium_mg ?? (foodItems[0]?.sodium_mg) ?? 0);

  const vitamins: string[] = data.vitamins || ['Vitamin C', 'B Vitamins'];
  const minerals: string[] = data.minerals || ['Potassium', 'Iron', 'Magnesium'];

  const handleLogMeal = async () => {
    try {
      setIsLogging(true);
      await onLog();
      queryClient.invalidateQueries({ queryKey: ['daily-progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['food-history'] });
      queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      toast.success("Meal logged! Viewing Today's Progress.");
      router.push('/dashboard');
    } catch (e: any) {
      console.error("Log error:", e);
      toast.error(e.message || "Failed to log meal");
    } finally {
      setIsLogging(false);
    }
  };

  const handleConsultCoach = async () => {
    if (!user) return;
    setIsNavigatingCoach(true);
    try {
      const coachConvId = await getOrCreateCoachConversation(user.id);
      if (!coachConvId) throw new Error("Coach conversation not found");

      const imageToUse = mealImage;

      setPendingAnalysisContext({
        productName: name,
        productImage: imageToUse,
        image: imageToUse,
        mealImage: imageToUse,
        calories,
        protein,
        carbs,
        fat,
        sugar,
        fiber,
        healthStatus: verdict,
        type: 'FOOD',
        description: mealDescription
      });

      const initialMessage = `I just photographed and analyzed my meal: ${name} (estimated ${calories} kcal, ${protein}g protein, ${carbs}g carbs, ${fat}g fat). Please explain this meal to me, its health impact, and how it aligns with my daily target.`;
      sessionStorage.setItem('chatInitialMessage', initialMessage);
      router.push(`/chat/${coachConvId}`);
    } catch (err: any) {
      console.error("Coach navigation error:", err);
      toast.error(err.message || "Failed to connect to Health Coach.");
    } finally {
      setIsNavigatingCoach(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0b141a] text-slate-900 dark:text-white flex flex-col h-[100dvh] overflow-hidden">
      {/* Top Header Sticky with back button */}
      <header className="h-16 shrink-0 z-30 flex items-center justify-between px-5 bg-white/95 dark:bg-[#0b141a]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          aria-label="Return to Camera"
          className="size-10 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${
            verdict === 'GOOD' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
            verdict === 'MODERATE' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
            'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
          }`}>
            {verdict === 'GOOD' ? 'Good' : verdict === 'MODERATE' ? 'Moderate' : 'Avoid'}
          </span>
        </div>
        <div className="size-10" /> {/* Spacer */}
      </header>

      {/* Main Vertically Scrollable Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 space-y-6 overflow-y-auto">
        {/* Meal Photograph Banner */}
        <div className="relative w-full h-64 sm:h-72 rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-slate-900 shrink-0">
          <img
            src={mealImage}
            alt={name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90" />
          
          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
              {name}
            </h1>
            <p className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-vic-green" />
              Multi-Food Visual Analysis & Normalization
            </p>
          </div>
        </div>

        {/* SECTION 1: MEAL DESCRIPTION */}
        <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-xl bg-vic-green/20 flex items-center justify-center text-vic-green border border-vic-green/30">
              <Apple className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Meal Description
            </h2>
          </div>
          <div className="text-slate-600 dark:text-slate-300 text-sm sm:text-[15px] leading-relaxed font-normal space-y-3">
            {mealDescription ? (
              mealDescription.split('\n\n').map((para: string, i: number) => (
                <p key={i}>{para}</p>
              ))
            ) : (
              <p>Visual identification evaluated the full meal components, relative portions, and observable preparation characteristics.</p>
            )}
          </div>
        </section>

        {/* SECTION 2: VITAMINS & NUTRITION */}
        <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Vitamins & Nutrition
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Authoritative Food Normalization</span>
            </div>
          </div>

          {/* Calorie Card with Sensible Range & Estimate Label */}
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 text-center shadow-inner">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
              <span>Estimated Total Calories</span>
              <Info className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight my-1">
              ~{calories} <span className="text-2xl font-bold text-slate-400">kcal</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Estimated range: <span className="text-slate-900 dark:text-white font-bold">{minCal} – {maxCal} kcal</span> based on portion variance
            </div>
            {dailyCalorieGoal > 0 && (
              <div className="mt-3 inline-block px-3 py-1 bg-slate-100 dark:bg-white/10 rounded-full text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Represents ~{Math.round((calories / dailyCalorieGoal) * 100)}% of your daily {dailyCalorieGoal} kcal goal
              </div>
            )}
          </div>

          {/* Structured Macros Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Protein</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{protein}g</p>
            </div>
            <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Carbs</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{carbs}g</p>
            </div>
            <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fat</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{fat}g</p>
            </div>
            <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fiber</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{fiber}g</p>
            </div>
            <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sugar</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{sugar}g</p>
            </div>
            <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sodium</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{sodium}mg</p>
            </div>
          </div>

          {/* Meaningful Vitamins & Minerals Badges */}
          <div className="space-y-3 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Identified Vitamins & Minerals
            </span>
            <div className="flex flex-wrap gap-2">
              {vitamins.map((v, i) => (
                <span key={i} className="px-3 py-1.5 bg-vic-green/15 border border-vic-green/30 rounded-xl text-xs font-semibold text-vic-green dark:text-vic-green">
                  {v}
                </span>
              ))}
              {minerals.map((m, i) => (
                <span key={i} className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Nutritional Narrative Paragraph */}
          {vitaminsAndNutrition && (
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm sm:text-[15px] leading-relaxed space-y-3">
              {vitaminsAndNutrition.split('\n\n').map((para: string, i: number) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: RECOMMENDED FOR YOUR PLAN */}
        <section className={`border rounded-[2rem] p-6 sm:p-7 shadow-sm space-y-5 ${
          isRecommended ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`size-8 rounded-xl flex items-center justify-center border ${
              isRecommended ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
            }`}>
              {isRecommended ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Recommended for Your Plan
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Personalized Health Context & Goal Fit</span>
            </div>
          </div>

          {/* Detailed Paragraph Evaluation */}
          <div className="text-slate-700 dark:text-slate-200 text-sm sm:text-[15px] leading-relaxed space-y-3">
            {recommendation ? (
              recommendation.split('\n\n').map((para: string, i: number) => (
                <p key={i}>{para}</p>
              ))
            ) : (
              <p>Evaluated against your active objective, daily calorie budget, and dietary preferences.</p>
            )}
          </div>

          {/* CANONICAL ALTERNATIVE MEAL (If meal is not recommended) */}
          {!isRecommended && alternativeMeal && (
            <div className="mt-4 p-5 bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Recommended Alternative From Today's Plan
              </span>
              <div className="flex items-center gap-4">
                {alternativeMeal.image && (
                  <img
                    src={alternativeMeal.image}
                    alt={alternativeMeal.name}
                    className="size-16 rounded-xl object-cover border border-slate-200 dark:border-white/10 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">{alternativeMeal.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                    ~{alternativeMeal.calories} kcal • {alternativeMeal.session ? alternativeMeal.session.toUpperCase() : "Today's Suggested Meal"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Sticky Bottom Action Dock: ALWAYS VISIBLE AND HORIZONTALLY PROPORTIONED */}
      <footer className="shrink-0 z-30 bg-white/95 dark:bg-[#0b141a]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 shadow-lg max-w-2xl mx-auto w-full">
        <div className="flex flex-row items-center gap-3 w-full">
          <button
            onClick={handleLogMeal}
            disabled={isLogging}
            className="flex-1 h-14 px-4 bg-vic-green hover:bg-vic-green/90 active:scale-[0.98] text-slate-900 rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            {isLogging ? (
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5 text-slate-900" strokeWidth={3} />
            )}
            <span>Log Meal</span>
          </button>

          <button
            onClick={handleConsultCoach}
            disabled={isNavigatingCoach}
            className="flex-1 h-14 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.98] text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer border border-blue-400/30"
          >
            {isNavigatingCoach ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <img
                src="/app-logo.png"
                alt="Application Logo"
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-white/80 shadow-md"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', '/icon.png');
                }}
              />
            )}
            <span className="tracking-wide">Health Coach</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
