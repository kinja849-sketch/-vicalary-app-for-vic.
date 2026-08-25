"use client"
import { create } from 'zustand'

interface AnalysisStore {
    pendingAnalysisContext: {
        productImage: string;
        productName: string;
        brand?: string;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        sugar?: number;
        price?: number;
        currency?: string;
        country?: string;
        political_warning?: string;
        is_compliant?: boolean;
        healthStatus?: string;
        // Medication
        type?: string;
        generic_name?: string;
        purpose?: string;
        side_effects?: string;
        warnings?: string;
        interactions?: string;
    } | null;
    setPendingAnalysisContext: (data: any) => void;
    clearPendingAnalysisContext: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
    pendingAnalysisContext: null,
    setPendingAnalysisContext: (data) => set({ pendingAnalysisContext: data }),
    clearPendingAnalysisContext: () => set({ pendingAnalysisContext: null }),
}))
