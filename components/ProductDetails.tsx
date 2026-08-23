"use client"
import { useRouter } from "next/navigation";
import { AlertCircle, ShoppingCart, Scale, MessageSquare, Check, Globe, Pill, TriangleAlert, Dna, HeartPulse, ChevronLeft } from "lucide-react";
import { useCurrency } from "@/lib/CurrencyContext";
import { useAnalysisStore } from '@/store/analysisStore';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useState, useEffect } from 'react';
import { saveFoodAnalysis, checkBudgetStatus } from '@/lib/api/food';
import { toast } from 'sonner';
import { CrowdsourceForm } from '@/components/CrowdsourceForm';

interface ProductDetailsProps {
    productImage: string;
    productName: string;
    servingSize?: string;
    description?: string;
    vitamins_and_nutrition?: string;
    recommendation?: string;
    recommended_pairings?: string;
    healthStatus?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;
    fiber?: number;
    origin_country?: string;
    brand?: string;
    manufacturer?: string;
    estimated_price?: string | number;
    is_compliant?: boolean;
    user_alignment_boolean?: boolean;
    political_warning?: string;
    needs_crowdsourcing?: boolean;
    cheaper_alternatives?: Array<{ name: string; price: string | number; reason: string }>;
    usage_instructions?: string;
    factory_ingredients?: string;
    suitability_analysis?: string;
    country_origin_details?: string;
    // Medication-specific fields
    type?: string;
    generic_name?: string;
    purpose?: string;
    side_effects?: string;
    warnings?: string;
    interactions?: string;
    onClose: () => void;
    onAddToDiary: () => void;
}


export function ProductDetails({
    productImage,
    productName,
    servingSize,
    description,
    vitamins_and_nutrition,
    recommendation,
    recommended_pairings,
    healthStatus,
    calories = 0,
    protein = 0,
    carbs = 0,
    fat = 0,
    sugar,
    fiber,
    origin_country,
    brand,
    manufacturer,
    estimated_price,
    is_compliant,
    user_alignment_boolean,
    political_warning,
    needs_crowdsourcing,
    cheaper_alternatives,
    usage_instructions,
    factory_ingredients,
    suitability_analysis,
    country_origin_details,
    type,
    generic_name,
    purpose,
    side_effects,
    warnings,
    interactions,
    onClose,
    onAddToDiary,
}: ProductDetailsProps) {
    const router = useRouter();
    const { formatCurrency } = useCurrency();
    const { user } = useAuth();
    const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
    const [isNavigating, setIsNavigating] = useState(false);
    const [showCrowdsourceForm, setShowCrowdsourceForm] = useState(false);
    const [budgetStatus, setBudgetStatus] = useState<{ isOver: boolean; budget: number } | null>(null);
    const isMedication = type === 'medication';

    // Immediate Persistence on mount for barcode/analysis results
    useEffect(() => {
        if (!user?.id || type === 'medication') return;

        const persistResult = async () => {
            try {
                // Prepare analysis object for storage
                const analysisToSave = {
                    name: productName,
                    calories,
                    protein,
                    carbs,
                    fat,
                    sugar,
                    fiber,
                    healthRating: healthStatus === 'Healthy' || healthStatus === 'Healty' ? 8 : 4,
                    description,
                    image_url: productImage,
                    barcode: (productName + (brand || '')).substring(0, 20), // Fallback if no barcode prop
                    brand,
                    manufacturer,
                    origin_country,
                    price: Number(estimated_price || 0),
                    political_warning,
                    is_compliant,
                    user_alignment_boolean
                };

                await saveFoodAnalysis(user.id, analysisToSave);

                // Budget check
                if (estimated_price) {
                    const status = await checkBudgetStatus(user.id, Number(estimated_price));
                    setBudgetStatus(status);

                    if (status.isOver) {
                        toast.warning(`Budget Alert: This item represents a significant portion of your monthly budget (${formatCurrency(status.budget)}).`);
                    }
                }
            } catch (err) {
                console.error("Auto-save failed:", err);
            }
        };

        persistResult();
    }, [user?.id]);

    const handleConsultCoach = async () => {
        if (!user?.id) return;
        setIsNavigating(true);

        try {
            // Ensure chats exist and grab the Coach ID
            const { data, error } = await (supabase as any).rpc('provision_user_system_chats', { p_user_id: user.id });
            if (error) throw error;

            const coachConvId = (data as any)?.coach_conversation_id;
            if (!coachConvId) throw new Error("Could not find Health Coach conversation");

            // Save complete context globally using structured pendingAnalysisContext
            setPendingAnalysisContext({
                productImage,
                productName,
                brand,
                calories,
                protein,
                carbs,
                fat,
                sugar,
                price: Number(estimated_price || 0),
                currency: 'USD',
                political_warning,
                healthStatus,
                ingredients: factory_ingredients || vitamins_and_nutrition,
                suitability_analysis,
                manufacturer,
                is_compliant,
                type: 'scan_handoff'
            });

            let initialMessage = '';

            if (isMedication) {
                initialMessage = `I just scanned ${productName} (${generic_name}). Can you tell me more and whether it's safe given my health profile?`;
            } else {
                const priceStr = estimated_price ? ` (${formatCurrency(estimated_price)})` : '';
                const originStr = origin_country ? `, manufactured in ${origin_country}` : '';
                const ethicalStr = political_warning ? ` and the manufacturer has flagged ethical/political concerns` : '';
                const budgetStr = budgetStatus?.isOver ? `. This purchase slightly exceeds my typical budget threshold` : '';

                initialMessage = `I scanned ${productName}${priceStr}${originStr}. The analysis shows it contains ${sugar || 0}g of sugar per serving${ethicalStr}${budgetStr}. Can you recommend a healthy alternative that fits my budget and goals?`;
            }

            sessionStorage.setItem('chatInitialMessage', initialMessage);
            router.push(`/chat/${coachConvId}`);
        } catch (error) {
            console.error("Failed to navigate to Coach:", error);
            setIsNavigating(false);
        }
    };

    const renderParagraphs = (text: string | undefined) => {
        if (!text) return null;
        return text.split('\n\n').filter(p => p.trim()).map((para, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                {para}
            </p>
        ));
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xl p-0 sm:p-4">
            <div className="w-full max-w-md sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col bg-white dark:bg-[#0a0f14] max-h-screen sm:max-h-[92vh] rounded-t-[2.5rem]">

                {/* POLITICAL ALERT / ETHICAL CONFIRMATION Banner */}
                {political_warning && (
                    <div className={`${!is_compliant ? 'bg-rose-600' : 'bg-emerald-600'} py-4 px-6 flex items-start gap-3 shrink-0`}>
                        {!is_compliant ? (
                            <AlertCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
                        ) : (
                            <Check className="w-5 h-5 text-white shrink-0 mt-0.5" strokeWidth={3} />
                        )}
                        <div>
                            <p className="text-white text-[12px] font-black uppercase tracking-wider mb-1">
                                {!is_compliant ? '⚠️ Ethical Responsibility Alert' : 'Ethically Clear'}
                            </p>
                            <p className="text-white/90 text-[12px] leading-relaxed">
                                {political_warning}
                            </p>
                        </div>
                    </div>
                )}

                {/* USER ALIGNMENT Banner (If cleared and aligns with health) */}
                {is_compliant && user_alignment_boolean && (
                    <div className="bg-[#0a2e52] py-3 px-6 flex items-center justify-center gap-2 shrink-0">
                        <HeartPulse className="w-4 h-4 text-white" strokeWidth={3} />
                        <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">
                            Personalized Match
                        </span>
                    </div>
                )}

                {/* Header Image */}
                <div className="relative h-52 shrink-0">
                    <img src={productImage} className="w-full h-full object-cover" alt={productName} />
                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0a0f14] via-black/20 to-transparent" />
                    <button
                        onClick={onClose}
                        className="absolute top-5 left-5 p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/60 transition-all"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>

                    {/* Country & Brand Badges */}
                    <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                        {origin_country && (
                            <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full border border-white/10 flex items-center gap-1">
                                <Globe className="w-3 h-3" /> {origin_country}
                            </span>
                        )}
                        {brand && (
                            <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full border border-white/10">
                                {brand}
                            </span>
                        )}
                    </div>
                </div>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto px-7 pb-4 space-y-8 -mt-8 relative z-10 custom-scrollbar">

                    {/* 1. Product Name & Manufacturer */}
                    <div>
                        <h2 className="text-[26px] font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                            {productName}
                        </h2>
                        {manufacturer && (
                            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5">
                                <ShoppingCart className="w-3.5 h-3.5" />
                                {manufacturer}
                            </p>
                        )}
                    </div>

                    {/* 2. Description Paragraphs */}
                    {description && (
                        <div className="space-y-4">
                            {renderParagraphs(description)}
                        </div>
                    )}

                    {/* Factory Analysis Blocks */}
                    {country_origin_details && (
                        <div className="space-y-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                            <h3 className="text-[13px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                <Globe className="w-4 h-4" /> Country of Origin
                            </h3>
                            <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">{country_origin_details}</p>
                        </div>
                    )}

                    {usage_instructions && (
                        <div className="space-y-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <h3 className="text-[13px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                Description & Usage
                            </h3>
                            <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">{usage_instructions}</p>
                        </div>
                    )}

                    {factory_ingredients && (
                        <div className="space-y-3 p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
                            <h3 className="text-[13px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Factory Ingredients
                            </h3>
                            <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">{factory_ingredients}</p>
                        </div>
                    )}

                    {suitability_analysis && (
                        <div className="space-y-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <h3 className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                <Check className="w-4 h-4" /> Suitability for You
                            </h3>
                            <p className="text-[14px] text-slate-700 dark:text-slate-300 leading-relaxed">{suitability_analysis}</p>
                        </div>
                    )}

                    {/* 3. Vitamins and Nutrition */}
                    {vitamins_and_nutrition && (
                        <div className="space-y-4">
                            <h3 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-white/8 pb-2">
                                Vitamins and Nutrition
                            </h3>
                            <div className="space-y-4">
                                {renderParagraphs(vitamins_and_nutrition)}
                            </div>
                        </div>
                    )}

                    {/* 4. Recommended Enhancements */}
                    {recommended_pairings && (
                        <div className="space-y-4">
                            <h3 className="text-[17px] font-black text-slate-900 dark:text-white tracking-tight border-b border-slate-100 dark:border-white/8 pb-2">
                                Recommended
                            </h3>
                            <div className="space-y-4">
                                {renderParagraphs(recommended_pairings)}
                            </div>
                        </div>
                    )}

                    {/* MEDICATION ANALYSIS SECTION */}
                    {isMedication ? (
                        <div className="space-y-5">
                            {generic_name && (
                                <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                                    <Pill className="w-5 h-5 text-purple-400 shrink-0" />
                                    <p className="text-sm text-slate-300">Generic Name: <span className="font-bold text-white">{generic_name}</span></p>
                                </div>
                            )}
                            {purpose && (
                                <div className="space-y-2">
                                    <h3 className="text-[14px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-2"><Dna className="w-4 h-4" /> Purpose</h3>
                                    <p className="text-sm text-slate-300 leading-relaxed">{purpose}</p>
                                </div>
                            )}
                            {warnings && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                    <h3 className="text-[13px] font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-2"><TriangleAlert className="w-4 h-4" /> Warnings</h3>
                                    <p className="text-sm text-amber-200/80 leading-relaxed">{warnings}</p>
                                </div>
                            )}
                            {side_effects && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                                    <h3 className="text-[13px] font-bold text-rose-300 uppercase tracking-wider mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Side Effects</h3>
                                    <p className="text-sm text-slate-300 leading-relaxed">{side_effects}</p>
                                </div>
                            )}
                            {interactions && (
                                <div className="p-4 bg-slate-800/60 border border-white/10 rounded-2xl">
                                    <h3 className="text-[13px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Drug Interactions</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{interactions}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 5. Calorie & Macro Summary — Food Products */
                        <div className="bg-slate-900 dark:bg-white/5 rounded-3xl p-6 text-center border border-slate-800 dark:border-white/10">
                            <div className="text-4xl font-black text-white mb-1">~{calories} kcal</div>
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <div className="bg-white/5 rounded-2xl py-3 px-2 border border-white/5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Protein</div>
                                    <div className="text-sm font-black text-white">{~~(protein || 0)}g</div>
                                </div>
                                <div className="bg-white/5 rounded-2xl py-3 px-2 border border-white/5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Carbs</div>
                                    <div className="text-sm font-black text-white">{~~(carbs || 0)}g</div>
                                </div>
                                <div className="bg-white/5 rounded-2xl py-3 px-2 border border-white/5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fat</div>
                                    <div className="text-sm font-black text-white">{~~(fat || 0)}g</div>
                                </div>
                            </div>
                            <div className="flex justify-center flex-wrap gap-2 mt-4">
                                {estimated_price && (
                                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full flex items-center gap-1">
                                        <ShoppingCart className="w-3 h-3" />
                                        {formatCurrency(estimated_price)} (market est.)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Personalized Recommendation */}
                    {recommendation && (
                        <div className="p-5 bg-[#0a2e52]/10 dark:bg-[#0a2e52]/20 border border-[#0a2e52]/20 rounded-2xl">
                            <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300 italic">
                                {recommendation}
                            </p>
                        </div>
                    )}

                    {/* Smart Alternatives (when political warning) */}
                    {cheaper_alternatives && cheaper_alternatives.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[13px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                {political_warning ? '🔄 Ethical Alternatives' : 'Smart Alternatives'}
                            </h3>
                            <div className="space-y-2">
                                {cheaper_alternatives.map((alt, i) => (
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
                        {!isMedication && is_compliant && (
                            <button
                                onClick={onAddToDiary}
                                className="flex-1 py-4 bg-[#0a2e52] text-white rounded-[1.5rem] font-black text-[15px] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2"
                            >
                                <Scale className="w-5 h-5" />
                                Log Product
                            </button>
                        )}
                        {!isMedication && !is_compliant && (
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 bg-rose-600 text-white rounded-[1.5rem] font-black text-[15px] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <AlertCircle className="w-5 h-5" />
                                Avoid Product
                            </button>
                        )}
                        <button
                            onClick={handleConsultCoach}
                            disabled={isNavigating}
                            className={`flex-1 py-4 rounded-[1.5rem] font-black text-[15px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isNavigating ? 'opacity-70 cursor-not-allowed' : ''} ${isMedication ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white'}`}
                        >
                            {isNavigating ? (
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <MessageSquare className="w-5 h-5" />
                            )}
                            {isMedication ? 'Ask Health Coach' : 'Ask Coach'}
                        </button>
                    </div>
                    {needs_crowdsourcing && (
                        <div className="pt-2">
                            <button
                                onClick={() => setShowCrowdsourceForm(true)}
                                className="w-full py-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-[1.5rem] font-bold text-sm hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Product missing? Report to our Database
                            </button>
                        </div>
                    )}
                </div>

                {showCrowdsourceForm && (
                    <CrowdsourceForm 
                        barcode={(productName + (brand || '')).substring(0, 20)} // Fallback if no barcode
                        productName={productName}
                        brandName={brand || manufacturer}
                        onClose={() => setShowCrowdsourceForm(false)}
                    />
                )}

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                    .dark\\:border-white\\/8 { border-color: rgba(255,255,255,0.08); }
                `}</style>
            </div>
        </div>
    );
}
