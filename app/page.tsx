"use client";

import React, { Suspense } from "react";
import IndexComponent from "./_pages/Index";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-vic-green"></div>
        </div>
      }
    >
      <IndexComponent />
    </Suspense>
  );
}
