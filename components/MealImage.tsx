"use client";

import React, { useState } from "react";
import { UtensilsCrossed } from "lucide-react";

interface MealImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

export function MealImage({ src, alt = "Meal", className = "" }: MealImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!src || hasError) {
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
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      className={`${className} ${!isLoaded ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
    />
  );
}
