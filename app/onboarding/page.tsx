"use client"
import { Suspense } from "react";
import Onboarding from "../_pages/Onboarding";

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vic-green"></div>
      </div>
    }>
      <Onboarding />
    </Suspense>
  );
}
