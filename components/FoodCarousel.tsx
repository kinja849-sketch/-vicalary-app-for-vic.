"use client"
import React, { useState, useEffect } from "react";
import { useTranslation } from "@/lib/api/translation";
import { Sunrise, Sun, Moon, ChevronLeft, ChevronRight, UtensilsCrossed, Heart } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toggleFavoriteRecipe, getFavoriteRecipes } from "@/lib/api/recipes";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FavoriteButton } from "./FavoriteButton";


interface Meal {
    id: string;
    name: string;
    subtitle: string;
    calories: number;
    image: string;
    meal_type: string;
}

interface FoodCarouselProps {
    breakfastMeals?: Meal[];
    lunchMeals?: Meal[];
    dinnerMeals?: Meal[];
    initialMealType?: 'breakfast' | 'lunch' | 'dinner';
    singleCategoryMeals?: Meal[];
    categoryTitle?: string;
}

export default function FoodCarousel({
    breakfastMeals = [],
    lunchMeals = [],
    dinnerMeals = [],
    initialMealType = 'breakfast',
    strictMode = false,
    singleCategoryMeals,
    categoryTitle
}: FoodCarouselProps & { strictMode?: boolean }) {
    // Process meals: ensure exactly 12 items and map unified schema to legacy props
    const processMeals = (meals: any[]) => (meals || []).slice(0, 12).map(m => {
        const mappedName = m.title || m.name || '';
        const mappedImage = (m.image_url || m.image || "").trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop";
        const mappedCalories = m.total_calories || m.calories || 0;
        const mappedId = m.id || m.external_id || '';
        
        return {
            ...m,
            id: mappedId,
            name: mappedName,
            image: mappedImage,
            calories: mappedCalories
        };
    });

    const isSingleMode = !!singleCategoryMeals;


    // Combine all meals into a single array of 36 cards
    const allMeals = [
        ...processMeals(breakfastMeals),
        ...processMeals(lunchMeals),
        ...processMeals(dinnerMeals)
    ];

    // Use a local state for the active tab, initialized with initialMealType
    const [selectedTab, setSelectedTab] = useState<'breakfast' | 'lunch' | 'dinner'>(initialMealType);
    const [localIdx, setLocalIdx] = useState(0);

    // Sync local state when prop changes (e.g. backend confirms session)
    useEffect(() => {
        setSelectedTab(initialMealType);
        setLocalIdx(0);
    }, [initialMealType]);

    const activeMeals = processMeals(
        isSingleMode ? singleCategoryMeals! :
            (selectedTab === 'breakfast' ? breakfastMeals :
                selectedTab === 'lunch' ? lunchMeals :
                    dinnerMeals)
    );

    const { t } = useTranslation();

    const getVisibleCards = () => {
        if (activeMeals.length === 0) return [];
        const cards = [];
        const total = activeMeals.length;
        for (let i = -2; i <= 2; i++) {
            const idx = (localIdx + i + total) % total;
            // Map i (-2 to 2) to pos (0=center, 1=L1, 2=R1, 3=L2, 4=R2)
            const pos = i === 0 ? 0 : (i === -1 ? 1 : (i === 1 ? 2 : (i === -2 ? 3 : 4)));
            cards.push({
                meal: activeMeals[idx],
                position: pos,
            });
        }
        return cards;
    };

    const visibleCards = getVisibleCards();

    const mealLabels: any = {
        breakfast: { title: t('breakfast') || "Breakfast", time: "6:00 AM - 11:00 AM", icon: Sunrise },
        lunch: { title: t('lunch') || "Lunch", time: "11:00 AM - 4:00 PM", icon: Sun },
        dinner: { title: t('dinner') || "Dinner", time: "4:00 PM - 4:00 AM", icon: Moon },
        single: { title: categoryTitle || "Suggested", time: "Tailored for you", icon: UtensilsCrossed }
    };

    const handleNext = () => setLocalIdx((prev) => (prev + 1) % activeMeals.length);
    const handlePrev = () => setLocalIdx((prev) => (prev - 1 + activeMeals.length) % activeMeals.length);

    const activeLabelKey = isSingleMode ? 'single' : selectedTab;

    return (
        <div className={`food-carousel-container px-4 ${isSingleMode ? 'mb-12' : ''}`}>
            {!isSingleMode && (
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-black dark:text-white uppercase tracking-tighter">
                        {t('meal_suggestions_title')}
                    </h1>
                    <div className="size-10 bg-vic-green/10 rounded-full flex items-center justify-center">
                        {React.createElement(mealLabels[activeLabelKey].icon, { className: "text-vic-green text-xl", size: 20 })}
                    </div>
                </div>
            )}

            {/* Strict Meal Type Selector - HIDDEN in strict mode or single mode */}
            {!strictMode && !isSingleMode && (

                <div className="flex gap-2 mb-6">
                    {(['breakfast', 'lunch', 'dinner'] as const).map(type => {
                        const isNotActive = type !== initialMealType;
                        
                        return (
                            <button
                                key={type}
                                onClick={() => { if (!isNotActive) { setSelectedTab(type); setLocalIdx(0); } }}
                                disabled={isNotActive}
                                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    selectedTab === type
                                        ? 'bg-vic-green text-slate-900 shadow-lg shadow-vic-green/20'
                                        : isNotActive 
                                            ? 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-600 opacity-30 cursor-not-allowed grayscale'
                                            : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-600'
                                }`}
                            >
                                {t(type)}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="tile active">
                <div className="meal-header">
                    <div>
                        <div className="meal-title">{mealLabels[activeLabelKey].title}</div>
                        <div className="meal-time opacity-50 uppercase tracking-widest text-[10px] font-bold">
                            {mealLabels[activeLabelKey].time}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {!isSingleMode && (
                            <div className="badge animate-pulse">
                                {selectedTab === initialMealType ? "NOW" : "BROWSE"}
                            </div>
                        )}
                        <div className="text-[10px] font-black text-vic-green tabular-nums">
                            {activeMeals.length > 0 ? `${localIdx + 1} / ${activeMeals.length}` : ''}
                        </div>
                    </div>
                </div>


                <div className="carousel h-[420px]">
                    {activeMeals.length > 0 ? (
                        <>
                            <button className="nav prev" onClick={handlePrev}>
                                <ChevronLeft />
                            </button>

                            <div className="deck">
                                {visibleCards.map(({ meal, position }) => (
                                    <div key={`${meal.id}-${position}`} className={`product-card card-pos-${position}`}>
                                        <div className="product-media">
                                            <img
                                                src={meal.image}
                                                alt={meal.name}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    if (!target.src.includes('unsplash')) {
                                                        target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop";
                                                    }
                                                }}
                                            />
                                            {/* Gradient Overlay for Text Readability */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                                            
                                            {/* Heart Button */}
                                            <div className="absolute top-4 right-4 z-20">
                                                <FavoriteButton recipeId={meal.internal_id || meal.id} />
                                            </div>
                                        </div>
                                        <div className="product-info-overlay">
                                            <div className="flex justify-between items-end mb-1">
                                                <h2 className="product-name">{meal.name}</h2>
                                                <div className="product-calories-badge">
                                                    {meal.calories} <span className="text-[8px] opacity-70">KCAL</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-white/60 font-bold uppercase tracking-wider">
                                                <div className="flex items-center gap-1">
                                                    <Sunrise size={10} className="text-vic-green" />
                                                    {meal.subtitle || mealLabels[selectedTab].title}
                                                </div>
                                                <div className="w-1 h-1 bg-white/20 rounded-full" />
                                                <div className="flex items-center gap-1">
                                                    {mealLabels[selectedTab].time.split(' - ')[0]}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                ))}
                            </div>

                            <button className="nav next" onClick={handleNext}>
                                <ChevronRight />
                            </button>

                            {/* Pagination Dots */}
                            <div className="pagination-dots">
                                {activeMeals.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`pagination-dot ${i === localIdx ? 'active' : ''}`}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 italic text-center">
                            <img src="/clock.gif" alt="Loading" className="w-16 h-16 mb-2 object-contain" />
                            <p>{t('checking_kitchen') || "Checking the kitchen for today's best meals..."}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


