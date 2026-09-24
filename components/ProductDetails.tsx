"use client"
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, ShoppingCart, MessageSquare, Check, Globe, Pill, TriangleAlert, Dna, HeartPulse, ExternalLink, ShieldCheck, Scale, Info, Sparkles } from "lucide-react";
import { useAnalysisStore } from '@/store/analysisStore';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { saveFoodAnalysis } from '@/lib/api/food';
import { toast } from 'sonner';
import { CrowdsourceForm } from '@/components/CrowdsourceForm';
import { useQueryClient } from '@tanstack/react-query';
import { getOrCreateCoachConversation } from '@/lib/api/chat';

export interface ProductDetailsProps {
  productImage?: string;
  productName: string;
  barcode?: string;
  servingSize?: string;
  category?: string;
  description?: string;
  vitamins_and_nutrition?: string;
  recommendation?: string;
  recommended_pairings?: string;
  healthStatus?: string;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  sugar?: number | null;
  fiber?: number | null;
  sodium_mg?: number | null;
  vitamins?: string[];
  minerals?: string[];
  serving_basis?: string;
  origin_country?: string;
  brand?: string;
  manufacturer?: string;
  price?: number | null;
  estimated_price?: string | null;
  price_metadata?: {
    amount?: number;
    currency?: string;
    source?: string;
    retrievedAt?: string;
    retailer?: string;
  } | null;
  is_compliant?: boolean;
  status?: 'FLAGGED' | 'APPROVED' | string;
  boycott?: {
    flagged: boolean;
    campaignName?: string;
    companyName?: string;
    parentCompany?: string;
    relationshipType?: string;
    reason?: string;
    sourceUrl?: string;
    verifiedAt?: string;
  } | null;
  political_warning?: string;
  needs_crowdsourcing?: boolean;
  cheaper_alternatives?: Array<{ name: string; price: string | number; reason: string }>;
  type?: string;
  // Medication-specific fields
  generic_name?: string;
  purpose?: string;
  side_effects?: string;
  warnings?: string;
  interactions?: string;
  onClose: () => void;
  onAddToDiary?: () => void;
}

export function ProductDetails({
  productImage,
  productName,
  barcode,
  servingSize,
  category,
  description,
  vitamins_and_nutrition,
  recommendation,
  healthStatus = "GOOD",
  calories,
  protein,
  carbs,
  fat,
  sugar,
  fiber,
  sodium_mg,
  vitamins = [],
  minerals = [],
  serving_basis = "serving",
  origin_country,
  brand,
  manufacturer,
  price,
  estimated_price,
  price_metadata,
  is_compliant = true,
  status = "APPROVED",
  boycott,
  political_warning,
  needs_crowdsourcing = false,
  cheaper_alternatives = [],
  type = "FOOD",
  generic_name,
  purpose,
  side_effects,
  warnings,
  interactions,
  onClose,
  onAddToDiary,
}: ProductDetailsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
  const setNavbarHidden = useAnalysisStore(state => state.setNavbarHidden);
  const [isLogging, setIsLogging] = useState(false);
  const [isNavigatingCoach, setIsNavigatingCoach] = useState(false);
  const [showCrowdsourceForm, setShowCrowdsourceForm] = useState(false);

  // STRICT RULE: Hide bottom navigation while viewing Product Details
  useEffect(() => {
    setNavbarHidden(true);
    return () => setNavbarHidden(false);
  }, [setNavbarHidden]);

  const isMedication = type === 'MEDICATION' || type === 'medication';
  const isFlagged = status === 'FLAGGED' || is_compliant === false || boycott?.flagged === true;

  // STRICT RULE: No auto-save on mount!
  // Only explicitly save and create purchase transaction when user taps "Log Product"
  const handleConfirmLog = async () => {
    if (!user?.id) {
      toast.error("Please sign in to log items");
      return;
    }

    try {
      setIsLogging(true);
      const analysisToSave = {
        name: productName,
        calories: calories ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        sugar: sugar ?? 0,
        fiber: fiber ?? 0,
        sodium_mg: sodium_mg ?? 0,
        healthRating: healthStatus === 'GOOD' ? 8 : 4,
        description,
        image_url: productImage,
        barcode: barcode || (productName + (brand || '')).substring(0, 20),
        brand,
        manufacturer,
        origin_country,
        price: price ?? (typeof estimated_price === 'number' ? estimated_price : 0),
        estimated_price,
        political_warning,
        is_compliant: !isFlagged
      };

      // save with isPurchaseConfirmed = true -> creates financial_transactions budget entry
      await saveFoodAnalysis(user.id, analysisToSave, true);
      queryClient.invalidateQueries({ queryKey: ['daily-progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['food-history'] });
      queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });

      toast.success(`${productName} logged! Viewing Today's Progress.`);

      if (onAddToDiary) {
        onAddToDiary();
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Log error:", err);
      toast.error(err.message || "Failed to log product");
    } finally {
      setIsLogging(false);
    }
  };

  const handleConsultCoach = async () => {
    if (!user?.id) return;
    setIsNavigatingCoach(true);
    try {
      const coachConvId = await getOrCreateCoachConversation(user.id);
      if (!coachConvId) throw new Error("Coach conversation not found");

      const imageToUse = productImage || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600";

      setPendingAnalysisContext({
        productName,
        brand,
        productImage: imageToUse,
        image: imageToUse,
        mealImage: imageToUse,
        calories: calories ?? 0,
        protein: protein ?? 0,
        carbs: carbs ?? 0,
        fat: fat ?? 0,
        sugar: sugar ?? 0,
        price: price ?? 0,
        country: origin_country,
        political_warning,
        is_compliant: !isFlagged,
        healthStatus,
        type: isMedication ? 'MEDICATION' : 'FOOD',
        description
      });

      let initialMessage = '';
      if (isMedication) {
        initialMessage = `I just scanned ${productName} (${generic_name || 'Medication'}). Can you tell me more about its mechanism, safety precautions, and interactions with my health profile?`;
      } else if (isFlagged) {
        initialMessage = `I scanned ${productName} (${brand || 'Brand'}), which is flagged for corporate/political ties (${boycott?.reason || political_warning}). Can you suggest healthy and ethical alternatives that fit my goals?`;
      } else {
        const priceStr = estimated_price ? ` costing ${estimated_price}` : '';
        initialMessage = `I scanned ${productName} by ${brand || 'brand'}${priceStr} (${calories ?? 0} kcal). How does this fit my daily diet and budget? Please explain its nutritional value and recommendations.`;
      }

      sessionStorage.setItem('chatInitialMessage', initialMessage);
      router.push(`/chat/${coachConvId}`);
    } catch (e: any) {
      console.error("Coach navigation error:", e);
      toast.error(e.message || "Failed to connect to Health Coach.");
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
          aria-label="Return to Scanner"
          className="size-10 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${
            isFlagged ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30' :
            healthStatus === 'MODERATE' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
            'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
          }`}>
            {isFlagged ? 'Avoid' : healthStatus === 'MODERATE' ? 'Moderate' : 'Good'}
          </span>
        </div>
        <div className="size-10" /> {/* Spacer */}
      </header>

      {/* Main Vertically Scrollable Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 space-y-6 overflow-y-auto">
        {/* Product Photograph Banner */}
        <div className="relative w-full h-64 sm:h-72 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-slate-900 shrink-0">
          <img
            src={productImage || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600"}
            alt={productName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f14] via-transparent to-transparent opacity-95" />

          {/* Badges */}
          <div className="absolute top-4 right-4 flex flex-wrap gap-2">
            {origin_country && (
              <span className="px-3 py-1 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold rounded-full border border-white/10 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-vic-blue" /> {origin_country}
              </span>
            )}
            {category && (
              <span className="px-3 py-1 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold rounded-full border border-white/10">
                {category}
              </span>
            )}
          </div>

          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
              {productName}
            </h1>
            {brand && (
              <p className="text-sm text-slate-300 font-semibold mt-1 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-400" /> Brand: {brand}
                {manufacturer && manufacturer !== brand && ` (${manufacturer})`}
              </p>
            )}
          </div>
        </div>

        {/* ─── MEDICATION BRANCH ─── */}
        {isMedication ? (
          <div className="space-y-6">
            {/* Generic & Purpose */}
            <section className="bg-white/5 border border-white/10 rounded-[2rem] p-6 sm:p-7 shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-wider">Medication Details</h2>
                  {generic_name && <span className="text-xs text-purple-300 font-semibold">Generic: {generic_name}</span>}
                </div>
              </div>

              {purpose && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Dna className="w-3.5 h-3.5" /> Mechanism & Purpose
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{purpose}</p>
                </div>
              )}

              {description && (
                <div className="text-slate-300 text-sm leading-relaxed space-y-3 pt-1">
                  {description.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)}
                </div>
              )}
            </section>

            {/* Warnings & Precautions */}
            {warnings && (
              <section className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                  <TriangleAlert className="w-4 h-4 text-amber-400" /> Warnings & Precautions
                </div>
                <p className="text-amber-200/90 text-sm leading-relaxed">{warnings}</p>
              </section>
            )}

            {/* Side Effects */}
            {side_effects && (
              <section className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-rose-400" /> Common Side Effects
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{side_effects}</p>
              </section>
            )}

            {/* Drug Interactions */}
            {interactions && (
              <section className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
                  <HeartPulse className="w-4 h-4 text-vic-blue" /> Drug Interactions
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{interactions}</p>
              </section>
            )}

            {/* Verified Price */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified Retail Price</span>
              <span className="text-base font-black text-white">
                {estimated_price || "Price unavailable"}
              </span>
            </section>
          </div>
        ) : (
          /* ─── FOOD PRODUCT BRANCH ─── */
          <>
            {/* 1. BOYCOTT GATE (BEFORE normal recommendation) */}
            {isFlagged ? (
              <section className="bg-rose-500/15 border-2 border-rose-500/40 rounded-[2rem] p-6 sm:p-7 shadow-2xl space-y-5">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-rose-400 uppercase tracking-wider">
                      Ethical Responsibility Alert — Flagged
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 font-medium">
                      Normal purchase recommendation is suspended at this safety gate.
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-black/40 border border-rose-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 uppercase font-bold tracking-wider">Campaign</span>
                    <span className="text-rose-300 font-black">{boycott?.campaignName || 'Corporate Responsibility Watch'}</span>
                  </div>

                  {boycott?.parentCompany && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 uppercase font-bold tracking-wider">Parent Company</span>
                      <span className="text-white font-bold">{boycott.parentCompany}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
                    <span className="font-bold text-white block mb-1">Documented Reason:</span>
                    {boycott?.reason || political_warning || 'Documented political affiliation or corporate relationship under active campaign boycott.'}
                  </div>

                  {boycott?.sourceUrl && (
                    <div className="pt-2">
                      <a
                        href={boycott.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-vic-blue hover:underline"
                      >
                        Inspect Supporting Evidence & Provenance <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {cheaper_alternatives && cheaper_alternatives.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      Recommended Ethical Alternatives
                    </h3>
                    <div className="space-y-2">
                      {cheaper_alternatives.map((alt, i) => (
                        <div key={i} className="flex items-center justify-between p-3.5 bg-black/30 rounded-xl border border-white/5">
                          <p className="text-sm font-bold text-white">{alt.name}</p>
                          <span className="text-xs text-emerald-400 font-semibold">{alt.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              /* PASSED GATE: Cleared Banner */
              <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Ethically Cleared — No active boycott or conflict flags on record
                </p>
              </div>
            )}

            {/* If NOT flagged, proceed to Section 1, 2, 3, 4 */}
            {!isFlagged && (
              <>
                {/* SECTION 1: PRODUCT DESCRIPTION */}
                <section className="bg-white/5 border border-white/10 rounded-[2rem] p-6 sm:p-7 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-8 rounded-xl bg-vic-blue/20 flex items-center justify-center text-vic-blue border border-vic-blue/30">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <h2 className="text-xs font-black text-white uppercase tracking-wider">
                      Product Description
                    </h2>
                  </div>
                  <div className="text-slate-300 text-sm sm:text-[15px] leading-relaxed space-y-3">
                    {description ? (
                      description.split('\n\n').map((para: string, i: number) => <p key={i}>{para}</p>)
                    ) : (
                      <p>{productName} is an authentic packaged food product registered under brand {brand || 'unspecified'}.</p>
                    )}
                  </div>
                </section>

                {/* SECTION 2: VITAMINS & NUTRITION */}
                <section className="bg-white/5 border border-white/10 rounded-[2rem] p-6 sm:p-7 shadow-lg space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-xs font-black text-white uppercase tracking-wider">
                          Vitamins & Nutrition
                        </h2>
                        <span className="text-[11px] text-slate-400">
                          {servingSize ? `Basis: ${servingSize}` : (serving_basis === 'serving' ? 'Per Serving' : 'Per 100g')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calories Card */}
                  <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-5 text-center shadow-inner">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Nutritional Energy
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-white tracking-tight my-1">
                      {calories !== null && calories !== undefined ? (
                        <>~{calories} <span className="text-2xl font-bold text-slate-400">kcal</span></>
                      ) : (
                        <span className="text-2xl font-bold text-slate-400">Calorie Data Pending</span>
                      )}
                    </div>
                    {servingSize && (
                      <p className="text-xs text-slate-300 font-medium">Serving Size: {servingSize}</p>
                    )}
                  </div>

                  {/* Macros Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    <div className="bg-black/30 rounded-2xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Protein</span>
                      <p className="text-base font-black text-white mt-0.5">{protein !== null && protein !== undefined ? `${protein}g` : '–'}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Carbs</span>
                      <p className="text-base font-black text-white mt-0.5">{carbs !== null && carbs !== undefined ? `${carbs}g` : '–'}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fat</span>
                      <p className="text-base font-black text-white mt-0.5">{fat !== null && fat !== undefined ? `${fat}g` : '–'}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sugar</span>
                      <p className="text-base font-black text-white mt-0.5">{sugar !== null && sugar !== undefined ? `${sugar}g` : '–'}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fiber</span>
                      <p className="text-base font-black text-white mt-0.5">{fiber !== null && fiber !== undefined ? `${fiber}g` : '–'}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-3 border border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sodium</span>
                      <p className="text-base font-black text-white mt-0.5">{sodium_mg !== null && sodium_mg !== undefined ? `${sodium_mg}mg` : '–'}</p>
                    </div>
                  </div>

                  {/* Vitamins & Minerals */}
                  {(vitamins.length > 0 || minerals.length > 0) && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Documented Vitamins & Minerals
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {vitamins.map((v, i) => (
                          <span key={i} className="px-3 py-1.5 bg-vic-blue/15 border border-vic-blue/30 rounded-xl text-xs font-semibold text-vic-blue">
                            {v}
                          </span>
                        ))}
                        {minerals.map((m, i) => (
                          <span key={i} className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nutrition Narrative Paragraph */}
                  {vitamins_and_nutrition && (
                    <div className="pt-2 border-t border-white/10 text-slate-300 text-sm sm:text-[15px] leading-relaxed space-y-3">
                      {vitamins_and_nutrition.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)}
                    </div>
                  )}
                </section>

                {/* SECTION 3: RECOMMENDED FOR YOUR PLAN */}
                <section className="bg-vic-blue/10 border border-vic-blue/20 rounded-[2rem] p-6 sm:p-7 shadow-lg space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-vic-blue/20 flex items-center justify-center text-vic-blue border border-vic-blue/30">
                      <Check className="w-4 h-4" />
                    </div>
                    <h2 className="text-xs font-black text-white uppercase tracking-wider">
                      Recommended for Your Plan
                    </h2>
                  </div>
                  <div className="text-slate-200 text-sm sm:text-[15px] leading-relaxed space-y-3">
                    {recommendation ? (
                      recommendation.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)
                    ) : (
                      <p>Evaluated against your active objective and dietary constraints.</p>
                    )}
                  </div>
                </section>

                {/* SECTION 4: LOCALIZED PRICE (No artificial hallucinated prices) */}
                <section className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Verified Local Price</span>
                    {price_metadata?.source && (
                      <span className="text-[11px] text-slate-400">Source: {price_metadata.source}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-white">
                      {estimated_price || "Price unavailable"}
                    </span>
                    {!estimated_price && (
                      <span className="text-[10px] text-slate-400 block">No verified retailer cache</span>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

      </main>

      {/* Sticky Bottom Action Dock: ALWAYS VISIBLE AND HORIZONTALLY PROPORTIONED */}
      <footer className="shrink-0 z-30 bg-white/95 dark:bg-[#0b141a]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 shadow-lg max-w-2xl mx-auto w-full">
        <div className="flex flex-row items-center gap-3 w-full">
          {!isFlagged ? (
            <button
              onClick={handleConfirmLog}
              disabled={isLogging}
              className="flex-1 h-14 px-4 bg-vic-green hover:bg-vic-green/90 active:scale-[0.98] text-slate-900 rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {isLogging ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-5 h-5 text-slate-900" strokeWidth={3} />
              )}
              <span>Log Product</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 h-14 px-4 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 transition-all whitespace-nowrap cursor-pointer"
            >
              <AlertCircle className="w-5 h-5" />
              <span>Avoid Product</span>
            </button>
          )}

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

        {needs_crowdsourcing && (
          <button
            onClick={() => setShowCrowdsourceForm(true)}
            className="w-full mt-2 py-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all"
          >
            Report Product Info to Database
          </button>
        )}
      </footer>

      {showCrowdsourceForm && (
        <CrowdsourceForm
          barcode={barcode || ''}
          productName={productName}
          brandName={brand || manufacturer}
          onClose={() => setShowCrowdsourceForm(false)}
        />
      )}
    </div>
  );
}
