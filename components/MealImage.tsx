"use client";

import React, { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

interface MealImageProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt?: string;
  className?: string;
}

export function MealImage({ src, fallbackSrc, alt = "Meal", className = "" }: MealImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(src || fallbackSrc || null);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    setCurrentSrc(src || fallbackSrc || null);
    setHasTriedFallback(false);
    setHasError(false);
    setIsLoaded(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!hasTriedFallback && fallbackSrc && fallbackSrc !== currentSrc) {
      setHasTriedFallback(true);
      setCurrentSrc(fallbackSrc);
      setIsLoaded(false);
    } else {
      setHasError(true);
    }
  };

  if (!currentSrc || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-[#0d1418] text-slate-500 ${className}`}>
        <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
          <UtensilsCrossed size={22} className="text-vic-green opacity-60" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-70 px-4 text-center truncate max-w-full">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      onLoad={() => setIsLoaded(true)}
      onError={handleError}
      className={`${className} ${!isLoaded ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
    />
  );
}
