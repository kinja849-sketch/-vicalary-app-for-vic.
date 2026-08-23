"use client"
import { create } from 'zustand'

export interface AnalysisContext {
    productName: string;
    brand?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sugar?: number;
    fiber?: number;
    healthStatus?: string;
    is_compliant?: boolean;
    political_warning?: string;
    description: string;
    timestamp: number;
}

interface CoachInjectionStore {
    latestAnalysis: AnalysisContext | null;
    setLatestAnalysis: (analysis: any) => void;
    clearLatestAnalysis: () => void;
}

export const useCoachInjectionStore = create<CoachInjectionStore>((set) => ({
    latestAnalysis: null,
    setLatestAnalysis: (analysis) => set({
        latestAnalysis: {
            ...analysis,
            timestamp: Date.now()
        }
    }),
    clearLatestAnalysis: () => set({ latestAnalysis: null }),
}))
