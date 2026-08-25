"use client"
import { useState, useEffect } from "react";
import Link from "next/link"
import { ArrowLeft, Search, Coffee, Utensils, ChefHat, Cookie, GlassWater, Candy, Heart, Star, Flame, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { searchRecipes, getDailyMealSuggestions, getCookbookSuggestions } from "@/lib/api/recipes";
import { useTranslation } from "@/lib/api/translation";
import FoodCarousel from "@/components/FoodCarousel";
import { FavoriteButton } from "@/components/FavoriteButton";
import { getFavoriteRecipes } from "@/lib/api/recipes";

const CATEGORIES = [
    { id: 'breakfast', label: 'Breakfast', fallbackIcon: Coffee, animUrl: '/oat.gif' },
    { id: 'lunch', label: 'Lunch', fallbackIcon: Utensils, animUrl: '/lunch-box.gif' },
    { id: 'dinner', label: 'Dinner', fallbackIcon: ChefHat, animUrl: '/dinner.gif' },
    { id: 'snacks', label: 'Snacks', fallbackIcon: Cookie, animUrl: '/cookie.gif' },
    { id: 'drinks', label: 'Drinks', fallbackIcon: GlassWater, animUrl: '/mineral-water.gif' },
    { id: 'desserts', label: 'Desserts', fallbackIcon: Candy, animUrl: '/ice-cream.gif' },
] as const;

export default function Cookbook() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"all" | "for you" | "favorites">("for you");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [currentSession, setCurrentSession] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
    const { t } = useTranslation();

    const { data: cookbookData } = useQuery({
        queryKey: ['cookbook-suggestions-v2', user?.id],
        queryFn: () => getCookbookSuggestions(user!.id),
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 60, // 1 hour
        refetchOnWindowFocus: false,
        retry: 1
    });

    const { data: suggestions } = useQuery({
        queryKey: ['suggestions-v2', user?.id],
        queryFn: () => getDailyMealSuggestions(user!.id),
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 60, // 1 hour
        refetchOnWindowFocus: false,
        retry: 1
    });

    useEffect(() => {
        if (suggestions?.currentSession) {
            setCurrentSession(suggestions.currentSession as 'breakfast' | 'lunch' | 'dinner');
        }
    }, [suggestions?.currentSession]);

    const { data: favorites } = useQuery({
        queryKey: ['favorite-recipes', user?.id],
        queryFn: () => getFavoriteRecipes(user!.id),
        enabled: !!user?.id && activeTab === 'favorites'
    });

    const { data: searchResults } = useQuery({
        queryKey: ['recipes-search', searchQuery],
        queryFn: () => searchRecipes(searchQuery),
        enabled: searchQuery.length > 2
    });

    return (
        <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full bg-slate-50 dark:bg-[#0d1418]">
            <header className="p-6 bg-white dark:bg-[#0d1418] relative z-20">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/dashboard" className="text-slate-900 dark:text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('cookbook')}</h1>
                </div>

                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-[#1f2c34] rounded-2xl border-none focus:ring-2 focus:ring-vic-green text-slate-900 dark:text-white font-medium placeholder:text-slate-400"
                    />
                </div>

                {!searchQuery && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('categories')}</h2>
                            <span className="text-[10px] font-black text-vic-green uppercase tracking-widest">{t('swipe_for_more')}</span>
                        </div>
                        <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2 -mx-6 px-6">
                            {CATEGORIES.map(cat => {
                                const isMainMeal = ['breakfast', 'lunch', 'dinner'].includes(cat.id);
                                const isNotActive = isMainMeal && cat.id !== currentSession;
                                
                                return (
                                    <div key={cat.id} className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => !isNotActive && setSelectedCategory(cat.id)}
                                        disabled={isNotActive}
                                        className={`aspect-square min-w-[88px] w-[88px] rounded-2xl flex items-center justify-center transition-all overflow-hidden relative group border-none shadow-none
                                            ${isNotActive ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:brightness-95 active:scale-95'}
                                            ${selectedCategory === cat.id ? 'bg-[#D1F7C4] dark:bg-[#1a2e21]' : 'bg-white dark:bg-[#1f2c34]'}
                                        `}
                                    >
                                        {!isNotActive && <div className="absolute inset-0 bg-black/5 opacity-0 dark:group-hover:opacity-20 transition-opacity" />}
                                        <img 
                                            src={cat.animUrl} 
                                            alt={t(cat.id)} 
                                            className="w-[110%] h-[110%] object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                            }}
                                        />
                                        <div className={`hidden ${selectedCategory === cat.id ? 'text-vic-green' : 'text-slate-400 dark:text-slate-500'}`}>
                                            <cat.fallbackIcon size={36} />
                                        </div>
                                    </button>
                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${selectedCategory === cat.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'} ${isNotActive ? 'opacity-50' : ''}`}>{t(cat.id)}</span>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-6 border-b border-slate-200 dark:border-white/10">
                    {(['all', 'for you', 'favorites'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedCategory(null); }}
                            className={`pb-3 text-sm font-bold capitalize transition-all relative ${activeTab === tab && !selectedCategory
                                ? 'text-vic-green' 
                                : 'text-slate-400'}`}
                        >
                            {tab === 'all' ? t('all_recipes') : tab === 'for you' ? t('for_you') : t('favorites')}
                            {activeTab === tab && !selectedCategory && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-vic-green rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <main className="p-6 pb-24">
                <div className="space-y-6">
                    {searchQuery ? (
                        <div className="grid grid-cols-1 gap-6">
                            {searchResults?.map((recipe: any) => (
                                <CookbookCard key={recipe.id} item={recipe} />
                            ))}
                        </div>
                    ) : selectedCategory ? (
                        <div className="grid grid-cols-1 gap-4">
                            {((suggestions as any)?.[selectedCategory] || []).map((meal: any, index: number) => (
                                <CookbookCard key={`${meal.id}-${index}`} item={meal} />
                            ))}
                        </div>
                    ) : activeTab === "favorites" ? (
                        <div className="grid grid-cols-1 gap-4">
                            {favorites && favorites.length > 0 ? (
                                favorites.map((fav: any) => (
                                    <CookbookCard key={fav.id} item={fav.recipes} />
                                ))
                            ) : (
                                <div className="text-center py-24 text-slate-400 italic">
                                    <Heart className="mx-auto mb-4 opacity-20" size={48} />
                                    <p>{t('saved_recipes_appear_here')}</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === "for you" ? (
                        <div className="space-y-8 -mx-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4 px-6">
                                    {t(currentSession)} {t('suggestions_label')}
                                </h3>
                                <div className="flex overflow-x-auto gap-4 pb-4 px-6 snap-x no-scrollbar">
                                    {((suggestions as any)?.[currentSession] || []).length > 0 ? (
                                        ((suggestions as any)?.[currentSession] || []).map((meal: any, index: number) => (
                                            <div key={`${meal.id}-${index}`} className="w-[85%] shrink-0 snap-center">
                                                <CookbookCard item={meal} />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="w-full text-center py-12 text-slate-400 italic">
                                            {t('cooking_suggestions')}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="px-6">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">{t('snacks_and_more')}</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {[...(suggestions?.snacks || []), ...(suggestions?.drinks || []), ...(suggestions?.desserts || [])].map((meal: any, index: number) => (
                                        <CookbookCard key={`${meal.id}-${index}`} item={meal} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {/* In "All" tab, show everything or prompt search */}
                            {[...(suggestions?.breakfast || []), ...(suggestions?.lunch || []), ...(suggestions?.dinner || [])].map((meal: any, index: number) => (
                                <CookbookCard key={`${meal.id}-${index}`} item={meal} />
                            ))}
                        </div>
                    )}
                </div>
                <div className="h-20" />
            </main>
        </div>
    );
}

function CookbookCard({ item }: { item: any }) {
    const { t } = useTranslation();
    if (!item) return null;
    const id = item.internal_id || item.id;
    const title = item.title || item.name || t('untitled_recipe');
    const image = item.image_url || item.image;
    const calories = item.total_calories || item.calories;
    const time = item.prep_time_minutes || item.prep_time || "20";

    return (
        <div className="relative group w-full h-64 rounded-[32px] overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500">
            <Link href={`/recipe/${id}`} className="block w-full h-full">
                <img 
                    src={image} 
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300'; }}
                    alt={title} 
                    className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                
                {/* Calories Pill */}
                <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white tracking-wide">
                    {calories} {t('cal_unit')}
                </div>

                {/* Bottom Content */}
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div className="flex-1 pr-4">
                        <h3 className="text-xl font-black text-white leading-tight mb-1 line-clamp-2">{title}</h3>
                        <p className="text-sm text-white/90 font-medium">{time} {t('minutes_label')}</p>
                    </div>
                    <div className="bg-[#a5e076] text-[#1c2e22] px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm hover:bg-[#92cc63] transition-colors">
                        {t('view_recipe')}
                    </div>
                </div>
            </Link>
            <FavoriteButton recipeId={id} className="absolute top-4 left-4" />
        </div>
    );
}
