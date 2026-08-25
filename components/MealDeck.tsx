"use client"
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/lib/api/translation";

interface MealDeckProps {
    mealType: string;
    meals: Array<{
        name: string;
        calories: number;
        image: string;
        subtitle: string;
    }>;
    onCycleComplete?: () => void;
}

export function MealDeck({ mealType, meals, onCycleComplete }: MealDeckProps) {
    const { t } = useTranslation();
    const deckRef = useRef<HTMLDivElement>(null);
    const [cardOrder, setCardOrder] = useState<number[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const cycleCount = useRef(0);

    // Initialize cardOrder when meals are available
    useEffect(() => {
        if (meals && meals.length > 0) {
            setCardOrder(meals.map((_, i) => i));
        }
    }, [meals]);

    const handleNext = () => {
        setCardOrder(prev => {
            const newOrder = [...prev];
            newOrder.push(newOrder.shift()!);
            return newOrder;
        });

        cycleCount.current += 1;
        if (meals && cycleCount.current % meals.length === 0 && onCycleComplete) {
            onCycleComplete();
        }
    };

    const handlePrev = () => {
        setCardOrder(prev => {
            const newOrder = [...prev];
            newOrder.unshift(newOrder.pop()!);
            return newOrder;
        });
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setStartX(e.clientX);
        if (deckRef.current) {
            deckRef.current.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        const dx = e.clientX - startX;
        if (dx > 40) handlePrev();
        else if (dx < -40) handleNext();
        if (deckRef.current) {
            try {
                deckRef.current.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore
            }
        }
    };

    const handlePointerCancel = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") handleNext();
            if (e.key === "ArrowLeft") handlePrev();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Safety check AFTER all hooks
    if (!meals || meals.length === 0 || cardOrder.length === 0) {
        return (
            <div className="meal-carousel-container">
                <div className="flex items-center justify-center h-64 text-slate-500">
                    {t('loading_meals')}
                </div>
            </div>
        );
    }

    return (
        <div className="meal-carousel-container">
            <div className="meal-deck-wrapper">
                <button
                    className="carousel-nav prev"
                    onClick={handlePrev}
                    aria-label={`Previous ${mealType}`}
                >
                    ←
                </button>
                <div
                    ref={deckRef}
                    className="meal-deck"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                >
                    {cardOrder.map((cardIndex, posIndex) => {
                        const meal = meals[cardIndex];
                        const pos = Math.min(posIndex, 5);
                        return (
                            <div key={cardIndex} className={`meal-card card-pos-${pos}`}>
                                <div className="meal-card-media">
                                    <img src={meal.image} alt={meal.name} />
                                </div>
                                <div className="meal-card-header">
                                    <h2 className="meal-card-name">{meal.name}</h2>
                                    <p className="meal-card-sub">{meal.subtitle}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button
                    className="carousel-nav next"
                    onClick={handleNext}
                    aria-label={`Next ${mealType}`}
                >
                    →
                </button>
            </div>
        </div>
    );
}
