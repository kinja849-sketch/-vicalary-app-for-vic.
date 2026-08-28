"use client"
import React, { useState, useEffect } from "react";
import { useTranslation } from "@/lib/api/translation";
import { Sunrise, Sun, Moon, ChevronLeft, ChevronRight, UtensilsCrossed, Heart } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toggleFavoriteRecipe, getFavoriteRecipes } from "@/lib/api/recipes";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FavoriteButton } from "./FavoriteButton";
import { MealImage } from "./MealImage";
import { getFoodImageUrl } from "@/lib/services/FoodImageService";


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
    const processMeals = (meals: any[], cat: string = 'lunch') => (meals || []).slice(0, 12).map(m => {
        const mappedName = m.title || m.name || 'Healthy Meal';
        const mappedCuisine = m.cuisine || m.cuisine_type || 'Indonesian';
        const mappedCategory = m.meal_type || cat;
        const mappedImage = (m.image_url || m.image || "").trim() || getFoodImageUrl(mappedName, mappedCuisine, mappedCategory);
        const mappedCalories = m.total_calories || m.calories || 350;
        const mappedId = m.id || m.external_id || '';
        
        return {
            ...m,
            id: mappedId,
            name: mappedName,
            image: mappedImage,
            image_url: mappedImage,
            calories: mappedCalories
        };
    });

    const isSingleMode = !!singleCategoryMeals;

    // Combine all meals into a single array of 36 cards
    const allMeals = [
        ...processMeals(breakfastMeals, 'breakfast'),
        ...processMeals(lunchMeals, 'lunch'),
        ...processMeals(dinnerMeals, 'dinner')
    ];

    // Use a local state for the active tab, initialized with initialMealType
    const [selectedTab, setSelectedTab] = useState<'breakfast' | 'lunch' | 'dinner'>(initialMealType);
    const [localIdx, setLocalIdx] = useState(0);

    // Sync local state when prop changes (e.g. backend confirms session)
    useEffect(() => {
        setSelectedTab(initialMealType);
        setLocalIdx(0);
    }, [initialMealType]);

    const DEFAULT_MEALS = {
        breakfast: [
            { id: 'fb1', name: 'Bubur Oatmeal Ayam Suwir Kuning', calories: 360, image: getFoodImageUrl('Bubur Oatmeal Ayam Suwir Kuning', 'Indonesian', 'breakfast'), subtitle: '360 kcal' },
            { id: 'fb2', name: 'Omelet Tahu Bayam Bumbu Bawang', calories: 310, image: getFoodImageUrl('Omelet Tahu Bayam Bumbu Bawang', 'Asian', 'breakfast'), subtitle: '310 kcal' },
            { id: 'fb3', name: 'Nasi Merah Telur Ceplok & Lalapan', calories: 380, image: getFoodImageUrl('Nasi Merah Telur Ceplok & Lalapan', 'Indonesian', 'breakfast'), subtitle: '380 kcal' },
            { id: 'fb4', name: 'Roti Gandum Alpukat Telur Rebus', calories: 340, image: getFoodImageUrl('Roti Gandum Alpukat Telur Rebus', 'Western', 'breakfast'), subtitle: '340 kcal' },
            { id: 'fb5', name: 'Smoothie Bowl Pisang Buah Naga Chia', calories: 290, image: getFoodImageUrl('Smoothie Bowl Pisang Buah Naga Chia', 'Healthy', 'breakfast'), subtitle: '290 kcal' },
            { id: 'fb6', name: 'Scrambled Eggs Jamur Tiram & Tomat', calories: 270, image: getFoodImageUrl('Scrambled Eggs Jamur Tiram & Tomat', 'Western', 'breakfast'), subtitle: '270 kcal' },
            { id: 'fb7', name: 'Bubur Manado Sehat Tanpa Santan', calories: 320, image: getFoodImageUrl('Bubur Manado Sehat Tanpa Santan', 'Indonesian', 'breakfast'), subtitle: '320 kcal' },
            { id: 'fb8', name: 'Pancake Oatmeal Pisang Kayu Manis', calories: 330, image: getFoodImageUrl('Pancake Oatmeal Pisang Kayu Manis', 'Healthy', 'breakfast'), subtitle: '330 kcal' },
            { id: 'fb9', name: 'Sandwich Dada Ayam Panggang Gandum', calories: 390, image: getFoodImageUrl('Sandwich Dada Ayam Panggang Gandum', 'Western', 'breakfast'), subtitle: '390 kcal' },
            { id: 'fb10', name: 'Bihun Kuah Sayur Dada Ayam', calories: 350, image: getFoodImageUrl('Bihun Kuah Sayur Dada Ayam', 'Asian', 'breakfast'), subtitle: '350 kcal' },
            { id: 'fb11', name: 'Greek Yogurt Parfait Buah Segar', calories: 260, image: getFoodImageUrl('Greek Yogurt Parfait Buah Segar', 'Healthy', 'breakfast'), subtitle: '260 kcal' },
            { id: 'fb12', name: 'Pepes Tahu Jamur Kukus Gurih', calories: 220, image: getFoodImageUrl('Pepes Tahu Jamur Kukus Gurih', 'Indonesian', 'breakfast'), subtitle: '220 kcal' }
        ],
        lunch: [
            { id: 'fl1', name: 'Nasi Merah Ayam Bakar Bumbu Rujak', calories: 520, image: getFoodImageUrl('Nasi Merah Ayam Bakar Bumbu Rujak', 'Indonesian', 'lunch'), subtitle: '520 kcal' },
            { id: 'fl2', name: 'Sate Dada Ayam Panggang Bumbu Kacang', calories: 450, image: getFoodImageUrl('Sate Dada Ayam Panggang Bumbu Kacang', 'Indonesian', 'lunch'), subtitle: '450 kcal' },
            { id: 'fl3', name: 'Capcay Goreng Seafood & Tahu', calories: 380, image: getFoodImageUrl('Capcay Goreng Seafood & Tahu', 'Asian', 'lunch'), subtitle: '380 kcal' },
            { id: 'fl4', name: 'Gado-Gado Siram Bumbu Kacang Sehat', calories: 410, image: getFoodImageUrl('Gado-Gado Siram Bumbu Kacang Sehat', 'Indonesian', 'lunch'), subtitle: '410 kcal' },
            { id: 'fl5', name: 'Ayam Teriyaki Wijen Nasi Coklat', calories: 490, image: getFoodImageUrl('Ayam Teriyaki Wijen Nasi Coklat', 'Asian', 'lunch'), subtitle: '490 kcal' },
            { id: 'fl6', name: 'Tumis Tempe Tahu Buncis Saus Tiram', calories: 370, image: getFoodImageUrl('Tumis Tempe Tahu Buncis Saus Tiram', 'Indonesian', 'lunch'), subtitle: '370 kcal' },
            { id: 'fl7', name: 'Pepes Ikan Nila Kemangi Bumbu Kuning', calories: 420, image: getFoodImageUrl('Pepes Ikan Nila Kemangi Bumbu Kuning', 'Indonesian', 'lunch'), subtitle: '420 kcal' },
            { id: 'fl8', name: 'Soto Ayam Bening Segar Jeruk Nipis', calories: 410, image: getFoodImageUrl('Soto Ayam Bening Segar Jeruk Nipis', 'Indonesian', 'lunch'), subtitle: '410 kcal' },
            { id: 'fl9', name: 'Tumis Kangkung Terasi Bawang Putih', calories: 180, image: getFoodImageUrl('Tumis Kangkung Terasi Bawang Putih', 'Indonesian', 'lunch'), subtitle: '180 kcal' },
            { id: 'fl10', name: 'Ikan Tongkol Balado Rendah Minyak', calories: 430, image: getFoodImageUrl('Ikan Tongkol Balado Rendah Minyak', 'Indonesian', 'lunch'), subtitle: '430 kcal' },
            { id: 'fl11', name: 'Daging Sapi Cah Brokoli Saus Tiram', calories: 480, image: getFoodImageUrl('Daging Sapi Cah Brokoli Saus Tiram', 'Asian', 'lunch'), subtitle: '480 kcal' },
            { id: 'fl12', name: 'Sup Jagung Telur Dada Ayam', calories: 340, image: getFoodImageUrl('Sup Jagung Telur Dada Ayam', 'Asian', 'lunch'), subtitle: '340 kcal' }
        ],
        dinner: [
            { id: 'fd1', name: 'Sup Ikan Kakap Kuah Bening Asam Segar', calories: 340, image: getFoodImageUrl('Sup Ikan Kakap Kuah Bening Asam Segar', 'Indonesian', 'dinner'), subtitle: '340 kcal' },
            { id: 'fd2', name: 'Dada Ayam Panggang Bumbu Rosemary Lemon', calories: 380, image: getFoodImageUrl('Dada Ayam Panggang Bumbu Rosemary Lemon', 'Western', 'dinner'), subtitle: '380 kcal' },
            { id: 'fd3', name: 'Tumis Brokoli Kangkung Bawang Putih & Tahu', calories: 290, image: getFoodImageUrl('Tumis Brokoli Kangkung Bawang Putih & Tahu', 'Asian', 'dinner'), subtitle: '290 kcal' },
            { id: 'fd4', name: 'Ikan Nila Bakar Madu Pedas Ringan', calories: 390, image: getFoodImageUrl('Ikan Nila Bakar Madu Pedas Ringan', 'Indonesian', 'dinner'), subtitle: '390 kcal' },
            { id: 'fd5', name: 'Sup Ayam Jamur Sayuran Bening', calories: 310, image: getFoodImageUrl('Sup Ayam Jamur Sayuran Bening', 'Indonesian', 'dinner'), subtitle: '310 kcal' },
            { id: 'fd6', name: 'Tumis Tauge Tahu Tempe Daun Bawang', calories: 240, image: getFoodImageUrl('Tumis Tauge Tahu Tempe Daun Bawang', 'Indonesian', 'dinner'), subtitle: '240 kcal' },
            { id: 'fd7', name: 'Steak Tempe Saus Lada Hitam', calories: 350, image: getFoodImageUrl('Steak Tempe Saus Lada Hitam', 'Fusion', 'dinner'), subtitle: '350 kcal' },
            { id: 'fd8', name: 'Salad Dada Ayam Panggang Saus Wijen', calories: 360, image: getFoodImageUrl('Salad Dada Ayam Panggang Saus Wijen', 'Healthy', 'dinner'), subtitle: '360 kcal' },
            { id: 'fd9', name: 'Udang Tumis Bawang Putih Daun Ketumbar', calories: 320, image: getFoodImageUrl('Udang Tumis Bawang Putih Daun Ketumbar', 'Asian', 'dinner'), subtitle: '320 kcal' },
            { id: 'fd10', name: 'Sup Tomat Telur Serabut Lembut', calories: 220, image: getFoodImageUrl('Sup Tomat Telur Serabut Lembut', 'Asian', 'dinner'), subtitle: '220 kcal' },
            { id: 'fd11', name: 'Ayam Suwir Kukus Sambal Matah Rendah Minyak', calories: 370, image: getFoodImageUrl('Ayam Suwir Kukus Sambal Matah Rendah Minyak', 'Indonesian', 'dinner'), subtitle: '370 kcal' },
            { id: 'fd12', name: 'Sayur Bening Bayam Jagung Manis', calories: 160, image: getFoodImageUrl('Sayur Bening Bayam Jagung Manis', 'Indonesian', 'dinner'), subtitle: '160 kcal' }
        ]
    };

    const rawActiveMeals = isSingleMode ? singleCategoryMeals! :
        (selectedTab === 'breakfast' ? breakfastMeals :
            selectedTab === 'lunch' ? lunchMeals :
                dinnerMeals);

    const activeMeals = processMeals(
        rawActiveMeals && rawActiveMeals.length > 0 ? rawActiveMeals : DEFAULT_MEALS[selectedTab]
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
                                    <div key={meal.id} className={`product-card card-pos-${position}`}>
                                        <div className="product-media">
                                            <MealImage
                                                src={meal.image_url || meal.image}
                                                alt={meal.name}
                                                className="w-full h-full object-cover"
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


