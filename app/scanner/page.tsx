"use client"
import React, { Suspense } from "react";
import CameraComponent from "../_pages/Camera";

export default function ScannerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-vic-green"></div>
      </div>
    }>
      <CameraComponent initialMode="BARCODE" />
    </Suspense>
  );
}
