"use client"
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, ShoppingCart, MessageSquare, Check, Globe, Pill, TriangleAlert, Dna, HeartPulse, ExternalLink, ShieldCheck, Scale, Info, Sparkles, ThumbsDown } from "lucide-react";
import { useAnalysisStore } from '@/store/analysisStore';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { saveFoodAnalysis } from '@/lib/api/food';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getOrCreateCoachConversation } from '@/lib/api/chat';
import { useTranslation } from '@/lib/api/translation';

export interface ProductDetailsProps {
  productImage?: string;
  productName: string;
  barcode?: string;
  servingSize?: string;
  serving_size?: string;
  size?: string;
  category?: string;
  description?: string;
  ingredients?: string | null;
  ingredients_status?: 'verified' | 'ocr' | 'unavailable' | string;
  allergens?: string[];
  traces?: string[];
  coloring?: {
    status?: 'verified_colorings' | 'verified_none' | 'unknown';
    is_unknown?: boolean;
    has_colorings?: boolean;
    has_synthetic?: boolean;
    synthetic_colors?: string[];
    natural_colors?: string[];
    summary?: string;
  } | null;
  vitamins_and_nutrition?: string;
  recommendation?: string;
  recommended_pairings?: string;
  healthStatus?: string;
  is_safe_for_profile?: boolean;
  safety_warnings?: string[];
  allergy_warnings?: string[];
  medical_warnings?: string[];
  matched_allergens?: string[];
  goal_fit?: {
    status: 'GOOD' | 'MODERATE' | 'POOR';
    targetGoal: string;
    headline: string;
    reason: string;
  } | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  saturated_fat?: number | null;
  trans_fat?: number | null;
  cholesterol_mg?: number | null;
  sugar?: number | null;
  added_sugar?: number | null;
  fiber?: number | null;
  sodium_mg?: number | null;
  servings_per_container?: string | null;
  daily_values?: {
    fat?: number;
    saturated_fat?: number;
    cholesterol?: number;
    sodium?: number;
    carbohydrates?: number;
    fiber?: number;
    added_sugar?: number;
    protein?: number;
  } | null;
  vitamins?: string[];
  minerals?: string[];
  serving_basis?: string;
  nutrition_status?: 'verified' | 'ocr' | 'unavailable' | string;
  origin_country?: string;
  brand?: string;
  manufacturer?: string;
  price?: number | null;
  estimated_price?: string | null;
  price_metadata?: {
    amount?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    price_range?: string | null;
    currency?: string;
    status?: 'verified' | 'estimated' | 'needs_user_price';
    source?: string;
    retrievedAt?: string;
    retailer?: string;
    ip_country_name?: string;
    ip_address?: string;
    needs_user_price?: boolean;
    confidence?: number;
    reference_estimate?: {
      amount: number;
      currency: string;
      formatted: string;
      label: string;
    } | null;
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
  // Factory Ingredients format
  factory_ingredients_statement?: string;
  contains_statement?: string;
  factory_ingredients_breakdown?: Array<{ name: string; sub_ingredients?: string; percentage?: string }>;
  // Medication-specific fields
  generic_name?: string;
  active_ingredients?: string[];
  inactive_ingredients?: string[];
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
  serving_size,
  size,
  category,
  description,
  ingredients,
  factory_ingredients_statement,
  contains_statement,
  factory_ingredients_breakdown,
  ingredients_status,
  allergens = [],
  coloring,
  vitamins_and_nutrition,
  recommendation,
  healthStatus = "GOOD",
  is_safe_for_profile = true,
  safety_warnings = [],
  allergy_warnings = [],
  medical_warnings = [],
  matched_allergens = [],
  goal_fit = null,
  calories,
  protein,
  carbs,
  fat,
  saturated_fat,
  trans_fat,
  cholesterol_mg,
  sugar,
  added_sugar,
  fiber,
  sodium_mg,
  servings_per_container,
  daily_values,
  vitamins = [],
  minerals = [],
  serving_basis = "100g",
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
  cheaper_alternatives = [],
  type = "FOOD",
  generic_name,
  active_ingredients = [],
  inactive_ingredients = [],
  purpose,
  side_effects,
  warnings,
  interactions,
  onClose,
}: ProductDetailsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation();
  const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
  const setNavbarHidden = useAnalysisStore(state => state.setNavbarHidden);
  const [isLogging, setIsLogging] = useState(false);
  const [isNavigatingCoach, setIsNavigatingCoach] = useState(false);

  const effectiveServingSize = servingSize || serving_size || size;

  // Automatic IP-based price resolution
  const initialNumericPrice = (typeof price === 'number' && !isNaN(price) && price > 0)
    ? price
    : (typeof price_metadata?.amount === 'number' && !isNaN(price_metadata.amount) && price_metadata.amount > 0)
      ? price_metadata.amount
      : (typeof price_metadata?.reference_estimate?.amount === 'number' && price_metadata.reference_estimate.amount > 0)
        ? price_metadata.reference_estimate.amount
        : 0;
  const userEnteredPrice = initialNumericPrice;

  // Split ingredients cleanly into distinct items respecting parentheses
  const ingredientList = React.useMemo(() => {
    if (!ingredients || typeof ingredients !== 'string') return [];
    const lower = ingredients.toLowerCase();
    if (lower.includes('not listed') || lower.includes('not declared')) return [];
    const cleaned = ingredients.replace(/^ingredients:\s*/i, '').replace(/\.$/, '');
    const items: string[] = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '(' || char === '[' || char === '{') parenDepth++;
      else if (char === ')' || char === ']' || char === '}') parenDepth = Math.max(0, parenDepth - 1);
      
      if ((char === ',' || char === ';' || char === '\n' || char === '•') && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) items.push(trimmed);
        current = '';
      } else {
        current += char;
      }
    }
    const lastTrimmed = current.trim();
    if (lastTrimmed) items.push(lastTrimmed);
    return items.filter(it => it.length > 0);
  }, [ingredients]);

  // STRICT RULE: Hide bottom navigation while viewing Product Details
  useEffect(() => {
    setNavbarHidden(true);
    return () => setNavbarHidden(false);
  }, [setNavbarHidden]);

  const isMedication = type === 'MEDICATION' || type === 'medication';
  const isFlagged = status === 'FLAGGED' || is_compliant === false || boycott?.flagged === true;
  const [hasBoycotted, setHasBoycotted] = useState(false);
  const [boycottCount, setBoycottCount] = useState(3);

  const handleBoycottClick = () => {
    if (!hasBoycotted) {
      setHasBoycotted(true);
      setBoycottCount(prev => prev + 1);
      toast.success("Marked as boycotted. Thank you for your ethical solidarity!", { icon: "✊" });
    } else {
      toast.info("You have already recorded your boycott for this product.");
    }
  };

  // STRICT RULE: No auto-save on mount!
  // Only explicitly save and create purchase transaction when user taps "Log Product" / "Budget"
  const handleConfirmLog = async () => {
    if (!user?.id) {
      toast.error("Please sign in to log items");
      return;
    }

    try {
      setIsLogging(true);
      const confirmedPrice = typeof userEnteredPrice === 'number' ? userEnteredPrice : initialNumericPrice;

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
        ingredients: ingredients || undefined,
        coloring: coloring || undefined,
        image_url: productImage,
        barcode: barcode || (productName + (brand || '')).substring(0, 20),
        brand,
        manufacturer,
        origin_country,
        price: confirmedPrice,
        estimated_price: confirmedPrice > 0 ? `${price_metadata?.currency || '$'} ${confirmedPrice.toLocaleString()}` : estimated_price,
        political_warning,
        is_compliant: !isFlagged,
        is_scanner_product: true // DEDUCTS from daily budget ledger, DOES NOT add to calorie progress!
      };

      // save with isPurchaseConfirmed = true -> creates financial_transactions and budget_transactions entries
      await saveFoodAnalysis(user.id, analysisToSave, true);
      await queryClient.invalidateQueries({ queryKey: ['active-budget'], refetchType: 'all' });
      await queryClient.resetQueries({ queryKey: ['active-budget'] });
      await queryClient.invalidateQueries({ queryKey: ['budget'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['financial-transactions'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['daily-progress'] });
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      await queryClient.invalidateQueries({ queryKey: ['food-history'] });

      toast.success(`${productName} logged! Deducted from your daily food budget.`);

      router.refresh();
      router.push("/budget");
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
      <header className="h-16 pt-safe shrink-0 z-30 flex items-center justify-between px-5 bg-white/95 dark:bg-[#0b141a]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          aria-label="Return to Scanner"
          className="size-10 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${
            isFlagged || !is_safe_for_profile || healthStatus === 'POOR'
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              : healthStatus === 'MODERATE'
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
          }`}>
            {isFlagged || !is_safe_for_profile ? 'Avoid' : healthStatus === 'POOR' ? 'Poor Fit' : healthStatus === 'MODERATE' ? 'Moderate' : 'Good'}
          </span>
        </div>
        <div className="size-10" /> {/* Spacer */}
      </header>

      {/* Main Vertically Scrollable Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 space-y-6 overflow-y-auto">
        {/* Product Photograph Banner */}
        <div className="relative w-full h-64 sm:h-72 rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-slate-900 shrink-0">
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
            {(brand || manufacturer) && (
              <p className="text-sm text-slate-300 font-semibold mt-1 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-400" /> Brand: {brand || manufacturer}
                {manufacturer && brand && manufacturer !== brand && ` (${manufacturer})`}
              </p>
            )}
          </div>
        </div>

        {/* ─── MEDICATION BRANCH ─── */}
        {isMedication ? (
          <div className="space-y-6">
            {/* Generic & Purpose */}
            <section className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-7 shadow-lg space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Medication Details</h2>
                  {generic_name && <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Generic: {generic_name}</span>}
                </div>
              </div>

              {/* Active & Inactive Ingredients */}
              {active_ingredients && active_ingredients.length > 0 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl space-y-2">
                  <h3 className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Active Ingredients & Strengths
                  </h3>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {active_ingredients.map((act, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/50 text-xs font-bold text-purple-900 dark:text-purple-200"
                      >
                        <span className="size-1.5 rounded-full bg-purple-500 shrink-0" />
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {purpose && (
                <div className="p-4 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl">
                  <h3 className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Dna className="w-3.5 h-3.5" /> Mechanism & Purpose
                  </h3>
                  <p className="text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed">{purpose}</p>
                </div>
              )}

              {description && (
                <div className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed space-y-3 pt-1">
                  {description.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)}
                </div>
              )}

              {/* Clinical Educational Disclaimer */}
              <div className="p-3.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                <span className="font-bold text-slate-700 dark:text-slate-300">Clinical Disclaimer:</span> This pharmaceutical extraction is for personal informational and logging support only. Always inspect the physical packaging, verify warnings and dosages, and consult a qualified healthcare provider or pharmacist before taking medications.
              </div>
            </section>

            {/* Warnings & Precautions */}
            {warnings && (
              <section className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-[2rem] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-amber-900 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                  <TriangleAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Warnings & Precautions
                </div>
                <p className="text-amber-950 dark:text-amber-200/90 text-sm font-medium leading-relaxed">{warnings}</p>
              </section>
            )}

            {/* Side Effects */}
            {side_effects && (
              <section className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-[2rem] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-rose-900 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Common Side Effects
                </div>
                <p className="text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed">{side_effects}</p>
              </section>
            )}

            {/* Drug Interactions */}
            {interactions && (
              <section className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-slate-900 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
                  <HeartPulse className="w-4 h-4 text-vic-blue" /> Drug Interactions
                </div>
                <p className="text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed">{interactions}</p>
              </section>
            )}
          </div>
        ) : (
          /* ─── FOOD PRODUCT BRANCH ─── */
          <>
            {/* 1. BOYCOTT GATE (BEFORE normal recommendation) */}
            {isFlagged ? (
              <div className="space-y-4">
                {/* Hero Boycott Verdict Card */}
                <section className="bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 rounded-[2rem] p-6 sm:p-8 text-center shadow-md space-y-4">
                  {/* FUCK NO! Hero Header */}
                  <div className="flex flex-col items-center justify-center pt-2">
                    <span className="text-4xl sm:text-5xl font-black text-rose-600 dark:text-rose-500 tracking-tight uppercase leading-none">
                      FUCK NO!
                    </span>
                  </div>

                  {/* Badges Pill Row */}
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="px-3.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800/50">
                      {boycott?.campaignName?.includes('Palestine') || boycott?.campaignName?.includes('BDS') ? 'Palestine' : (boycott?.campaignName || 'Palestine')}
                    </span>
                    <span className="px-3.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800/50">
                      {boycott?.parentCompany ? 'Level 1' : 'Level 2'}
                    </span>
                    <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center border border-rose-200 dark:border-rose-800/50" title="Ethical Campaign Information">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Subtitle */}
                  <h3 className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-2 mb-1">
                    This Product is on the Boycott list
                  </h3>

                  {/* Narrative Statement */}
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal max-w-lg mx-auto">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {productName}
                    </span>
                    {brand && brand.toLowerCase() !== productName.toLowerCase() ? ` (${brand})` : ''}
                    {boycott?.parentCompany || manufacturer ? (
                      <>
                        {' '}owned by{' '}
                        <span className="font-bold text-slate-900 dark:text-white">
                          {boycott?.parentCompany || manufacturer}
                        </span>
                      </>
                    ) : null}
                    {', '}
                    {boycott?.reason || political_warning?.replace(/^⚠️ ETHICAL RESPONSIBILITY ALERT — [^.]+\.\s*/, '') || 'is targeted by active consumer boycott campaigns due to documented corporate and political ties.'}
                  </p>

                  {/* Evidence Provenance Link */}
                  {boycott?.sourceUrl && (
                    <div className="pt-2">
                      <a
                        href={boycott.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Inspect Supporting Evidence & Provenance <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </section>

                {/* Community Solidarity Card: Boycott This Product */}
                <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-5 sm:p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="w-5 h-5 text-rose-600 fill-rose-600/20" />
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {boycottCount} Boycott This Product
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1">
                      🪙 x5 Pts
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    &ldquo;Boycott This&rdquo; means you avoid this brand. The number shows how many people boycott it.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={handleBoycottClick}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        hasBoycotted
                          ? 'bg-rose-700 text-white shadow-inner'
                          : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-95'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>{hasBoycotted ? 'Boycotted' : 'Boycott This'}</span>
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {/* If NOT flagged, proceed to Section 1, 2, 3, 4 */}
            {!isFlagged && (
              <>
                {/* SECTION 1: PRODUCT DESCRIPTION */}
                <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-7 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-8 rounded-xl bg-vic-blue/20 flex items-center justify-center text-vic-blue border border-vic-blue/30">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {t('product_description')}
                    </h2>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 text-sm sm:text-[15px] leading-relaxed space-y-3 font-normal">
                    {description ? (
                      description.split('\n\n').map((para: string, i: number) => <p key={i}>{para}</p>)
                    ) : (
                      <p>{productName} is an authentic packaged product crafted by {brand || manufacturer || 'its manufacturer'}.</p>
                    )}
                  </div>
                </section>

                {/* SECTION 1B: INGREDIENTS OF THE PRODUCT */}
                <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-7 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {t('ingredients_of_product') === 'ingredients_of_product' ? 'Ingredients of the Product' : t('ingredients_of_product')}
                    </h2>
                  </div>

                  {/* Packaging Ingredients Statement Box */}
                  <div className="bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Factory Ingredients Statement
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Packaging Label
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 space-y-2">
                      <p className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-relaxed font-mono">
                        {factory_ingredients_statement || (ingredients ? `INGREDIENTS: ${ingredients.toUpperCase()}.` : `INGREDIENTS: ${productName.toUpperCase()} STANDARD COMMERCIAL FORMULATION.`)}
                      </p>
                      {contains_statement && (
                        <p className="text-xs sm:text-[13px] font-black text-rose-600 dark:text-rose-400 font-mono tracking-wide">
                          {contains_statement}
                        </p>
                      )}
                    </div>

                    {/* Factory Ingredients Breakdown */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Factory Formulation Breakdown
                      </span>

                      {factory_ingredients_breakdown && factory_ingredients_breakdown.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          {factory_ingredients_breakdown.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-xs"
                            >
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  {item.name}
                                </span>
                                {item.sub_ingredients && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-3">
                                    Sub-ingredients: ({item.sub_ingredients})
                                  </p>
                                )}
                              </div>
                              {item.percentage && (
                                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {item.percentage}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : ingredientList.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {ingredientList.map((item, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-100 shadow-sm"
                            >
                              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Show Food Coloring Badges only when colorings are present */}
                  {coloring?.has_colorings && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        {t('food_coloring_analysis')}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {coloring.has_synthetic && coloring.synthetic_colors && coloring.synthetic_colors.length > 0
                          ? coloring.synthetic_colors.map((c, i) => (
                              <span key={`syn-${i}`} className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                Synthetic: {c}
                              </span>
                            ))
                          : null}

                        {coloring.natural_colors && coloring.natural_colors.length > 0
                          ? coloring.natural_colors.map((nc, i) => (
                              <span key={`nat-${i}`} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                Natural: {nc}
                              </span>
                            ))
                          : null}
                      </div>
                    </div>
                  )}
                </section>

                {/* SECTION 2: CALORIES */}
                <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 sm:p-7 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          {t('calories') || 'Calories'}
                        </h2>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">
                          {servings_per_container ? `${servings_per_container} • ` : ''}
                          {serving_basis === 'serving'
                            ? `Serving size: ${effectiveServingSize && effectiveServingSize !== '100g' ? effectiveServingSize : '1 serving'}`
                            : 'Basis: Per 100g'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calories Hero Card */}
                  <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 text-center shadow-inner">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
                      {t('nutritional_energy')}
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight my-1">
                      {calories !== null && calories !== undefined ? (
                        <><span className="text-emerald-600 dark:text-[#21ff64]">{calories}</span> <span className="text-2xl font-bold text-slate-400">kcal</span></>
                      ) : (
                        <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">Nutrition facts unavailable in catalog</span>
                      )}
                    </div>
                    {calories !== null && calories !== undefined && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Amount Per Serving {effectiveServingSize ? `(${effectiveServingSize})` : ''}
                      </p>
                    )}
                  </div>

                  {/* Factory Nutrition Facts Panel (Packaging Label Standard) */}
                  <div className="bg-white dark:bg-black/40 rounded-2xl border-2 border-slate-900 dark:border-white/20 p-4 sm:p-5 space-y-2.5 font-sans">
                    <div className="border-b-4 border-slate-900 dark:border-white pb-2 flex items-baseline justify-between">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Nutrition Facts</h3>
                        {servings_per_container && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{servings_per_container}</p>
                        )}
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Serving size: {effectiveServingSize || (serving_basis === 'serving' ? '1 serving' : '100g')}
                        </p>
                      </div>
                    </div>

                    <div className="border-b-2 border-slate-900 dark:border-white pb-1 flex justify-between items-end">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase">Amount per serving</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{calories ?? 0} kcal</span>
                    </div>

                    <div className="text-right text-[11px] font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-1">
                      % Daily Value*
                    </div>

                    <div className="divide-y divide-slate-200 dark:divide-white/10 text-xs">
                      {/* Total Fat */}
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Total Fat <span className="font-normal">{fat !== null && fat !== undefined ? `${fat}g` : '–'}</span>
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {daily_values?.fat !== undefined ? `${daily_values.fat}%` : '–'}
                        </span>
                      </div>
                      {/* Saturated Fat */}
                      <div className="py-1.5 pl-4 flex justify-between items-center text-[11px]">
                        <span className="text-slate-700 dark:text-slate-300">
                          Saturated Fat {saturated_fat !== null && saturated_fat !== undefined ? `${saturated_fat}g` : '–'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {daily_values?.saturated_fat !== undefined ? `${daily_values.saturated_fat}%` : '–'}
                        </span>
                      </div>
                      {/* Trans Fat */}
                      <div className="py-1.5 pl-4 flex justify-between items-center text-[11px]">
                        <span className="text-slate-700 dark:text-slate-300">
                          Trans Fat {trans_fat !== null && trans_fat !== undefined ? `${trans_fat}g` : '0g'}
                        </span>
                        <span className="text-slate-400">–</span>
                      </div>
                      {/* Cholesterol */}
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Cholesterol <span className="font-normal">{cholesterol_mg !== null && cholesterol_mg !== undefined ? `${cholesterol_mg}mg` : '0mg'}</span>
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {daily_values?.cholesterol !== undefined ? `${daily_values.cholesterol}%` : '0%'}
                        </span>
                      </div>
                      {/* Sodium */}
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Sodium <span className="font-normal">{sodium_mg !== null && sodium_mg !== undefined ? `${sodium_mg}mg` : '–'}</span>
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {daily_values?.sodium !== undefined ? `${daily_values.sodium}%` : '–'}
                        </span>
                      </div>
                      {/* Total Carbohydrate */}
                      <div className="py-1.5 flex justify-between items-center">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Total Carbohydrate <span className="font-normal">{carbs !== null && carbs !== undefined ? `${carbs}g` : '–'}</span>
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {daily_values?.carbohydrates !== undefined ? `${daily_values.carbohydrates}%` : '–'}
                        </span>
                      </div>
                      {/* Dietary Fiber */}
                      <div className="py-1.5 pl-4 flex justify-between items-center text-[11px]">
                        <span className="text-slate-700 dark:text-slate-300">
                          Dietary Fiber {fiber !== null && fiber !== undefined ? `${fiber}g` : '–'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {daily_values?.fiber !== undefined ? `${daily_values.fiber}%` : '–'}
                        </span>
                      </div>
                      {/* Total Sugars */}
                      <div className="py-1.5 pl-4 flex justify-between items-center text-[11px]">
                        <span className="text-slate-700 dark:text-slate-300">
                          Total Sugars {sugar !== null && sugar !== undefined ? `${sugar}g` : '–'}
                        </span>
                        <span className="text-slate-400">–</span>
                      </div>
                      {/* Added Sugars */}
                      {added_sugar !== null && added_sugar !== undefined && (
                        <div className="py-1.5 pl-8 flex justify-between items-center text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">
                            Includes {added_sugar}g Added Sugars
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {daily_values?.added_sugar !== undefined ? `${daily_values.added_sugar}%` : '–'}
                          </span>
                        </div>
                      )}
                      {/* Protein */}
                      <div className="py-1.5 flex justify-between items-center border-b-4 border-slate-900 dark:border-white">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Protein <span className="font-normal">{protein !== null && protein !== undefined ? `${protein}g` : '–'}</span>
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {daily_values?.protein !== undefined ? `${daily_values.protein}%` : '–'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pt-1">
                      * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.
                    </p>
                  </div>

                  {/* Macros Quick Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('protein_label')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{protein !== null && protein !== undefined ? `${protein}g` : '–'}</p>
                    </div>
                    <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('carbs_label')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{carbs !== null && carbs !== undefined ? `${carbs}g` : '–'}</p>
                    </div>
                    <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('fat_label')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{fat !== null && fat !== undefined ? `${fat}g` : '–'}</p>
                    </div>
                    <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('sugar_label')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{sugar !== null && sugar !== undefined ? `${sugar}g` : '–'}</p>
                    </div>
                    <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('fiber_label')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{fiber !== null && fiber !== undefined ? `${fiber}g` : '–'}</p>
                    </div>
                    <div className="bg-white dark:bg-black/30 rounded-2xl p-3 border border-slate-200 dark:border-white/5 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('sodium_label')}</span>
                      <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{sodium_mg !== null && sodium_mg !== undefined ? `${sodium_mg}mg` : '–'}</p>
                    </div>
                  </div>

                  {/* Vitamins & Minerals */}
                  {(vitamins.length > 0 || minerals.length > 0) && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        {t('identified_vitamins_minerals')}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {vitamins.map((v, i) => (
                          <span key={i} className="px-3 py-1.5 bg-vic-blue/15 border border-vic-blue/30 rounded-xl text-xs font-semibold text-vic-blue">
                            {v}
                          </span>
                        ))}
                        {minerals.map((m, i) => (
                          <span key={i} className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nutrition Narrative Paragraph */}
                  {vitamins_and_nutrition && (
                    <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm sm:text-[15px] leading-relaxed space-y-3 font-normal">
                      {vitamins_and_nutrition.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)}
                    </div>
                  )}
                </section>

                {/* SECTION 3: RECOMMENDED FOR YOUR PLAN (HARD-HIGHLIGHTED ALLERGIES & GOAL FIT) */}
                <section className={`rounded-[2rem] p-6 sm:p-7 shadow-sm space-y-4 border ${
                  !is_safe_for_profile || (allergy_warnings && allergy_warnings.length > 0) || (medical_warnings && medical_warnings.length > 0)
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : healthStatus === 'POOR'
                      ? 'bg-rose-500/5 border-rose-500/25'
                      : healthStatus === 'MODERATE'
                        ? 'bg-amber-500/5 border-amber-500/25'
                        : 'bg-vic-blue/10 border-vic-blue/20'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`size-8 rounded-xl flex items-center justify-center border ${
                        !is_safe_for_profile || healthStatus === 'POOR'
                          ? 'bg-rose-500/20 text-rose-500 border-rose-500/30'
                          : healthStatus === 'MODERATE'
                            ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                            : 'bg-vic-blue/20 text-vic-blue border-vic-blue/30'
                      }`}>
                        {!is_safe_for_profile || healthStatus === 'POOR' ? (
                          <TriangleAlert className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </div>
                      <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {t('recommended_for_plan')}
                      </h2>
                    </div>

                    {goal_fit && (
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                        goal_fit.status === 'POOR'
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30'
                          : goal_fit.status === 'MODERATE'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      }`}>
                        Goal Fit: {goal_fit.status}
                      </span>
                    )}
                  </div>

                  {/* Hard-Highlighted Allergen & Medical Alert Banner */}
                  {((allergy_warnings && allergy_warnings.length > 0) ||
                    (medical_warnings && medical_warnings.length > 0) ||
                    (safety_warnings && safety_warnings.length > 0)) && (
                    <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 font-black text-xs uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          {allergy_warnings && allergy_warnings.length > 0
                            ? `Allergy Safety Alert${matched_allergens && matched_allergens.length > 0 ? `: ${matched_allergens.join(', ')}` : ''}`
                            : 'Medical Profile Contradiction'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs sm:text-sm font-semibold text-rose-900 dark:text-rose-200 leading-relaxed">
                        {(safety_warnings && safety_warnings.length > 0
                          ? safety_warnings
                          : [...(allergy_warnings || []), ...(medical_warnings || [])]
                        ).map((warn, idx) => (
                          <p key={idx}>{warn}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explicit Goal Fit Highlight Card */}
                  {goal_fit && (
                    <div className={`p-4 rounded-2xl border space-y-1 ${
                      goal_fit.status === 'POOR'
                        ? 'bg-rose-500/10 border-rose-500/25'
                        : goal_fit.status === 'MODERATE'
                          ? 'bg-amber-500/10 border-amber-500/25'
                          : 'bg-emerald-500/10 border-emerald-500/25'
                    }`}>
                      <p className={`text-xs font-black uppercase tracking-wider ${
                        goal_fit.status === 'POOR'
                          ? 'text-rose-600 dark:text-rose-300'
                          : goal_fit.status === 'MODERATE'
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {goal_fit.headline}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                        {goal_fit.reason}
                      </p>
                    </div>
                  )}

                  <div className="text-slate-600 dark:text-slate-300 text-sm sm:text-[15px] leading-relaxed space-y-3 font-normal">
                    {recommendation ? (
                      recommendation.split('\n\n').map((p: string, i: number) => <p key={i}>{p}</p>)
                    ) : (
                      <p>Evaluated against your active objective and dietary constraints.</p>
                    )}
                  </div>
                </section>

                {/* SECTION 4: AUTOMATIC IP-BASED LOCAL RETAIL PRICE RANGE */}
                <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                        {t('verified_local_price') || 'Local Retail Price Range'}
                      </span>
                      {price_metadata?.ip_country_name && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                          Detected Region: {price_metadata.ip_country_name} ({price_metadata.currency || '$'})
                        </span>
                      )}
                      {price_metadata?.source && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Source: {price_metadata.source}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-[#21ff64] block">
                        {price_metadata?.price_range ||
                          estimated_price ||
                          (initialNumericPrice > 0
                            ? `${price_metadata?.currency === 'IDR' ? 'Rp' : (price_metadata?.currency || '$')} ${initialNumericPrice.toLocaleString()}`
                            : 'Local Market Rate')}
                      </span>
                      {initialNumericPrice > 0 && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5">
                          Avg Retail: {price_metadata?.currency === 'IDR' ? 'Rp' : (price_metadata?.currency || '$')} {initialNumericPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* Action Buttons at the Bottom of the Scrollable Section (only visible once scrolled through the whole section) */}
        <div className="pt-2 pb-safe" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)' }}>
          <div className="flex flex-row items-center gap-3 w-full">
            {isMedication ? (
              <button
                onClick={handleConsultCoach}
                disabled={isNavigatingCoach}
                className="w-full h-14 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.98] text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer border border-blue-400/30"
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
                <span className="tracking-wide">{t('health_coach') === 'health_coach' ? 'Health Coach' : (t('health_coach') || 'Health Coach')}</span>
              </button>
            ) : (
              <>
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
                    <span>{t('budget')}</span>
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="flex-1 h-14 px-4 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <AlertCircle className="w-5 h-5" />
                    <span>{t('avoid_product_btn')}</span>
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
                  <span className="tracking-wide">{t('health_coach') === 'health_coach' ? 'Health Coach' : (t('health_coach') || 'Health Coach')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
