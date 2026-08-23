"use client"
import { useState } from "react";
import { useTranslation } from "@/lib/api/translation";
import { AlertCircle, ShoppingCart, Scale, MessageSquare, Check, ChevronLeft, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/lib/CurrencyContext";
import { useAnalysisStore } from "@/store/analysisStore";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

interface FoodItem {
    name: string;
    calories: number;
    description?: string;
    vitamins_and_nutrition?: string;
    recommendation?: string;
    recommended_pairings?: string;
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;
    fiber?: number;
    healthStatus?: 'GOOD' | 'MODERATE' | 'POOR';
    verdict?: 'GOOD' | 'MODERATE' | 'POOR';
    is_compliant?: boolean;
    user_alignment_boolean?: boolean;
    political_warning?: string;
    estimated_price?: string;
    cheaper_alternatives?: Array<{ name: string; price: string; reason: string }>;
    // Barcode-specific
    brand?: string;
    manufacturer?: string;
    country_of_origin?: string;
    ingredients?: string;
    type?: 'FOOD' | 'BARCODE';
}

interface MealAnalysisProps {
    mealImage: string;
    totalCalories: number;
    dailyCalorieGoal?: number;
    foodItems: FoodItem[];
    onClose: () => void;
    onLog: () => void;
}

export function MealAnalysis({ mealImage, foodItems, totalCalories, dailyCalorieGoal, onClose, onLog }: MealAnalysisProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const router = useRouter();
    const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
    const [isSaved, setIsSaved] = useState(false);

    const item: FoodItem = foodItems[0] || {
        name: 'Meal Analysis',
        calories: 0,
        description: '',
        vitamins_and_nutrition: '',
        recommendation: '',
        protein: 0,
        carbs: 0,
        fat: 0,
        healthStatus: 'MODERATE'
    };

    const verdict = (item.healthStatus || item.verdict || 'MODERATE').toUpperCase();
    const isBarcode = item.type === 'BARCODE';

    const { formatCurrency } = useCurrency();

    const handleLog = () => {
        setIsSaved(true);
        onLog();
    };

    const handleConsultCoach = async () => {
        if (!user) return;

        // 1. Provision chats for immediate routing
        try {
            const { data, error } = await (supabase as any).rpc('provision_user_system_chats', { p_user_id: user.id });
            if (error) throw error;
            const coachConvId = (data as any)?.coach_conversation_id;
            if (!coachConvId) throw new Error("Coach conversation not found");

            // 2. Build complete context for the AI
            const contextData = {
                productName: item.name,
                calories: totalCalories || item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                sugar: item.sugar,
                fiber: item.fiber,
                price: item.estimated_price ? Number(item.estimated_price.replace(/[^0-9.]/g, '')) : 0,
                country: item.country_of_origin,
                political_warning: item.political_warning,
                is_compliant: item.is_compliant,
                healthStatus: item.healthStatus || item.verdict,
                type: item.type || 'FOOD',
                description: item.description,
                ingredients: item.ingredients,
                image: mealImage
            };
            
            setPendingAnalysisContext(contextData);

            const priceStr = item.estimated_price ? ` (${item.estimated_price})` : '';
            const originStr = item.country_of_origin ? `, manufactured in ${item.country_of_origin}` : '';
            const ethicalStr = item.political_warning ? ' and has some ethical manufacturer flags' : '';
            const initialMessage = `I just analyzed ${item.name}${priceStr}${originStr} (${totalCalories || item.calories} kcal)${ethicalStr}. How does this fit my health goals?`;

            sessionStorage.setItem('chatInitialMessage', initialMessage);
            router.push(`/chat/${coachConvId}`);
        } catch (err) {
            console.error("Coach nav error:", err);
            router.push('/chat');
        }
    };

    // Split narrative text into paragraphs
    const renderParagraphs = (text: string | undefined, fallback: string = "") => {
        if (!text) return <p className="text-slate-400 italic text-sm">{fallback}</p>;
        return (text.split('\n\n').filter(p => p.trim())).map((para, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                {para}
            </p>
        ));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xl p-0 sm:p-4 h-[100dvh]">
            <div className="w-full max-w-md sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col bg-white dark:bg-[#0a0f14] h-full sm:h-auto sm:max-h-[92vh] rounded-t-[2.5rem] relative">

                {/* Political Alert (Barcode Only) */}
                {item.political_warning && (
                    <div className={`${item.political_warning.includes('🔴') || item.political_warning.includes('concern') ? 'bg-rose-600' : 'bg-emerald-600'} py-3 px-6 flex items-center gap-3 shrink-0`}>
                        <AlertCircle className="w-4 h-4 text-white shrink-0" />
                        <p className="text-white text-[11px] font-bold leading-tight uppercase tracking-tight">
                            {item.political_warning}
                        </p>
                    </div>
                )}

                {/* User Alignment Banner */}
                {item.user_alignment_boolean && !item.political_warning && (
                    <div className="bg-[#0a2e52] py-3 px-6 flex items-center justify-center gap-2 shrink-0">
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                        <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">
                            Personalized Health Match
                        </span>
                    </div>
                )}

                {/* Header Image */}
                <div className="relative h-52 shrink-0">
                    <img src={mealImage} className="w-full h-full object-cover" alt="Meal" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0a0f14] via-black/20 to-transparent" />
                    <button
                        onClick={onClose}
                        className="absolute top-5 left-5 p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/60 transition-all"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>

                    {/* Barcode Badges */}
                    {isBarcode && (
                        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                            {item.country_of_origin && (
                                <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full border border-white/10">
                                    🌍 {item.country_of_origin}
                                </span>
                            )}
                            {item.brand && (
                                <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full border border-white/10">
                                    {item.brand}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto px-7 pb-4 space-y-8 -mt-8 relative z-10 custom-scrollbar">

                    {/* 1. Meal Name */}
                    <div>
                        <h2 className="text-[26px] font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                            {item.name || 'Meal Analysis'}
                        </h2>
                        {isBarcode && item.manufacturer && (
                            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5">
                                <ShoppingCart className="w-3.5 h-3.5" />
                                {item.manufacturer}
                            </p>
                        )}
                    </div>

                    {/* 2. Description – Narrative Paragraphs */}
                    <div className="space-y-4">
                        {renderParagraphs(
                            item.description,
                            "A detailed nutritional analysis of this meal is being prepared…"
                        )}
                    </div>

                    {/* 3. Vitamins and Nutrition */}
                    <div className="space-y-4">
                        <h3 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-white/8 pb-2">
                            Vitamins and Nutrition
                        </h3>
                        <div className="space-y-4">
                            {renderParagraphs(
                                item.vitamins_and_nutrition,
                                "Micronutrient and vitamin profile analysis in progress…"
                            )}
                        </div>
                    </div>

                    {/* 4. Recommended */}
                    {item.recommended_pairings && (
                        <div className="space-y-4">
                            <h3 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-white/8 pb-2">
                                Recommended
                            </h3>
                            <div className="space-y-4">
                                {renderParagraphs(item.recommended_pairings)}
                            </div>
                        </div>
                    )}

                    {/* Barcode: Ingredients */}
                    {isBarcode && item.ingredients && (
                        <div className="space-y-3">
                            <h3 className="text-[13px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                Ingredients
                            </h3>
                            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/3 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                {item.ingredients}
                            </p>
                        </div>
                    )}

                    {/* 5. Calorie & Macro Summary – Always Last */}
                    <div className="bg-slate-900 dark:bg-white/5 rounded-3xl p-6 text-center border border-slate-800 dark:border-white/10">
                        <div className="text-4xl font-black text-white mb-1">
                            ~{totalCalories || item.calories} kcal
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <div className="bg-white/5 rounded-2xl py-3 px-2 border border-white/5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Protein</div>
                                <div className="text-sm font-black text-white">{~~(item.protein || 0)}g</div>
                            </div>
                            <div className="bg-white/5 rounded-2xl py-3 px-2 border border-white/5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Carbs</div>
                                <div className="text-sm font-black text-white">{~~(item.carbs || 0)}g</div>
                            </div>
                            <div className="bg-white/5 rounded-2xl py-3 px-2 border border-white/5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fat</div>
                                <div className="text-sm font-black text-white">{~~(item.fat || 0)}g</div>
                            </div>
                        </div>
                        <div className="flex justify-center gap-3 mt-4">
                            {item.estimated_price && (
                                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full flex items-center gap-1">
                                    <ShoppingCart className="w-3 h-3" />
                                    {formatCurrency(item.estimated_price)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Personalized Recommendation */}
                    {item.recommendation && (
                        <div className="p-5 bg-[#0a2e52]/10 dark:bg-[#0a2e52]/20 border border-[#0a2e52]/20 rounded-2xl">
                            <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300 italic">
                                {item.recommendation}
                            </p>
                        </div>
                    )}

                    {/* Smart Alternatives (Barcode) */}
                    {item.cheaper_alternatives && item.cheaper_alternatives.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[13px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                Smart Alternatives
                            </h3>
                            <div className="space-y-2">
                                {item.cheaper_alternatives.map((alt, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                        <div>
                                            <p className="text-[14px] font-black text-slate-900 dark:text-white">{alt.name}</p>
                                            <p className="text-[11px] text-slate-500">{alt.reason}</p>
                                        </div>
                                        <span className="text-[13px] font-black text-emerald-500">{formatCurrency(alt.price)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {/* Footer Actions */}
                <div className="px-7 py-6 shrink-0 bg-white dark:bg-[#0a0f14] border-t border-slate-100 dark:border-white/5 space-y-3">
                    <div className="flex gap-3">
                        <button
                            onClick={handleLog}
                            className="flex-1 py-4 bg-[#0a2e52] text-white rounded-[1.5rem] font-black text-[15px] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2"
                        >
                            <Scale className="w-5 h-5" />
                            {isSaved ? 'Logged ✓' : 'Log Meal'}
                        </button>
                        <button
                            onClick={handleConsultCoach}
                            className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white rounded-[1.5rem] font-black text-[15px] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <MessageSquare className="w-5 h-5" />
                            Consult Coach
                        </button>
                    </div>
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                    .dark\\:border-white\\/8 { border-color: rgba(255,255,255,0.08); }
                    .bg-white\\/3 { background-color: rgba(255,255,255,0.03); }
                `}</style>
            </div>
        </div>
    );
}
