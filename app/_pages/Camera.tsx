"use client"
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, SwitchCamera, ArrowLeft, RefreshCw, Camera as CameraIcon, Images } from "lucide-react";
import { analyzeFoodImage, scanProduct, saveFoodAnalysis, analyzeMedication } from "@/lib/api/food";
import { useAnalysisStore } from "@/store/analysisStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { requestCameraAccess } from "@/lib/api/permissions";
import { useNotificationStore } from "@/store/notificationStore";
import { useCoachInjectionStore } from "@/store/coachInjectionStore";
import { MealAnalysis } from "@/components/MealAnalysis";
import { ProductDetails } from "@/components/ProductDetails";

type ScanMode = "FOOD" | "BARCODE";

interface CameraProps {
  initialMode?: "FOOD" | "BARCODE";
}

export default function Camera({ initialMode }: CameraProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const isScanner = initialMode === "BARCODE" ||
    searchParams?.get("mode") === "scanner" ||
    searchParams?.get("mode") === "barcode" ||
    pathname?.includes("/scanner");

  const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
  const addNotification = useNotificationStore(state => state.addNotification);
  const setLatestAnalysis = useCoachInjectionStore(state => state.setLatestAnalysis);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanMode, setScanMode] = useState<ScanMode>(isScanner ? "BARCODE" : "FOOD");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const barcodeIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || isAnalyzing) return;

    setIsAnalyzing(true);
    const imageUrl = URL.createObjectURL(file);
    setCapturedImage(imageUrl);

    try {
      const result = await analyzeFoodImage(userId, file);
      const fullResult = { ...result, type: 'FOOD' as const };
      setAnalysisResult(fullResult);
      setLatestAnalysis(fullResult);
      addNotification('success', "Food analysis complete!");
    } catch (err: any) {
      console.error("Gallery analysis failed:", err);
      toast.error(err.message || "Failed to analyze uploaded image.");
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user?.id || null);
    };
    getSession();
    startCamera('environment');
    return () => {
      stopCamera();
      if (barcodeIntervalRef.current) clearInterval(barcodeIntervalRef.current);
    };
  }, []);

  const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
    try {
      const oldStream = streamRef.current;

      const mediaStream = await requestCameraAccess({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!mediaStream) return;

      if (oldStream && oldStream !== mediaStream) {
        oldStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Video auto-play warning:", e);
        }
      }
    } catch (err) {
      console.error("Camera access failed in Camera.tsx:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  };

  const [isSwitching, setIsSwitching] = useState(false);

  const switchCamera = async () => {
    if (isSwitching) return;
    try {
      setIsSwitching(true);
      const targetFacing: 'environment' | 'user' = facingMode === 'environment' ? 'user' : 'environment';

      const currentTrack = streamRef.current?.getVideoTracks()?.[0];
      if (currentTrack && typeof currentTrack.applyConstraints === 'function') {
        try {
          await currentTrack.applyConstraints({
            facingMode: { ideal: targetFacing }
          });
          setFacingMode(targetFacing);
          return;
        } catch (e) {
          // Fall through
        }
      }

      setFacingMode(targetFacing);
      await startCamera(targetFacing);
    } catch (err) {
      console.error("switchCamera failed:", err);
      toast.error("Failed to switch camera direction");
    } finally {
      setIsSwitching(false);
    }
  };

  // Continuous Barcode Scanning Logic for Food Products
  useEffect(() => {
    if (scanMode === "BARCODE" && stream && !isAnalyzing && !analysisResult && !isScanningBarcode) {
      barcodeIntervalRef.current = window.setInterval(scanForBarcode, 400);
    } else {
      if (barcodeIntervalRef.current) {
        clearInterval(barcodeIntervalRef.current);
        barcodeIntervalRef.current = null;
      }
    }
    return () => {
      if (barcodeIntervalRef.current) clearInterval(barcodeIntervalRef.current);
    };
  }, [scanMode, stream, isAnalyzing, analysisResult, isScanningBarcode]);

  const scanForBarcode = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || analysisResult || isScanningBarcode) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'upc_a', 'upc_e', 'ean_8', 'code_128', 'code_39', 'code_93', 'itf', 'qr_code', 'data_matrix']
        });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0 && barcodes[0]?.rawValue) {
          handleBarcodeDetected(barcodes[0].rawValue);
          return;
        }
      } catch (e) {
        // fallback to zxing
      }
    }

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = reader.decodeFromCanvas(canvas);
      if (result && result.getText()) {
        handleBarcodeDetected(result.getText());
      }
    } catch (e) {
      // frame didn't contain a barcode, ignore
    }
  };

  const handleBarcodeDetected = async (barcode: string) => {
    if (!userId || isAnalyzing || isScanningBarcode) return;
    setIsScanningBarcode(true);
    setIsAnalyzing(true);
    setCapturedImage(canvasRef.current?.toDataURL("image/jpeg") || null);

    try {
      const result = await scanProduct(userId, barcode);
      if (result.error) throw new Error(result.error);
      const fullResult = { ...result, barcode, type: result.type || 'BARCODE' as const };
      setAnalysisResult(fullResult);
      setLatestAnalysis(fullResult);
      addNotification('success', "Product identified via Barcode!");
      // NO auto-save on scan detection! User must confirm via "Log Product"
    } catch (err: any) {
      console.error("Barcode scan failed:", err);
      toast.error(err.message || "Failed to identify product.");
      setCapturedImage(null);
      setIsScanningBarcode(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !userId || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");
    setCapturedImage(imageData);
    setIsAnalyzing(true);

    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

      const result = scanMode === "BARCODE"
        ? await analyzeMedication(userId, file)
        : await analyzeFoodImage(userId, file);

      const fullResult = { ...result, type: (result.type || (scanMode === "BARCODE" ? 'MEDICATION' : 'FOOD')) as any };
      setAnalysisResult(fullResult);
      setLatestAnalysis(fullResult);
      addNotification('success', scanMode === "BARCODE" ? "Medication analysis complete!" : "Food analysis complete!");
      // NO auto-save on photo capture! User confirms via "Log to Food Diary"
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error("Analysis failed. Please try again.");
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !analysisResult) return;
    try {
      await saveFoodAnalysis(userId, analysisResult);
      addNotification('success', "Logged to your diary successfully!");
      router.push("/dashboard");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save to log.");
    }
  };

  const handleRetry = () => {
    setAnalysisResult(null);
    setCapturedImage(null);
    setIsAnalyzing(false);
    setIsScanningBarcode(false);
    startCamera(facingMode);
  };

  return (
    <div className="h-full flex-1 w-full bg-[#0a0f14] text-white flex flex-col relative overflow-hidden">
      <AnimatePresence mode="wait">
        {!analysisResult && !isAnalyzing ? (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full overflow-hidden bg-black flex-1"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-transform duration-300 ${
                facingMode === 'user' ? '-scale-x-100' : 'scale-x-100'
              }`}
            />

            {/* Top Left Close */}
            <Link
              href="/dashboard"
              className="absolute top-8 left-6 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/60 transition-all z-20"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>

            {/* Top Right Switch Camera */}
            <button
              onClick={switchCamera}
              disabled={isSwitching}
              aria-label={facingMode === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
              className="absolute top-8 right-6 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/60 transition-all active:scale-90 z-20 disabled:opacity-50"
            >
              <SwitchCamera className={`w-6 h-6 transition-transform duration-300 ${isSwitching ? 'animate-spin' : ''}`} />
            </button>

            {/* Scanning Frame for Barcode */}
            {scanMode === "BARCODE" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <div className="w-64 h-48 border-2 border-vic-green/40 rounded-2xl relative shadow-[0_0_30px_rgba(33,255,100,0.15)]">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-vic-green rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-vic-green rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-vic-green rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-vic-green rounded-br-lg" />
                  <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-vic-green shadow-[0_0_12px_2px_rgba(33,255,100,0.6)]"
                  />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-300 mt-6 px-4 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                  Align product barcode to auto-detect
                </p>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6 z-20 w-full px-6 max-w-md">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="size-14 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-all active:scale-90 shadow-2xl shrink-0 cursor-pointer"
                title="Upload image from gallery"
                aria-label="Upload image from gallery"
              >
                <Images className="w-6 h-6 text-white pointer-events-none" />
              </button>

              {scanMode === "FOOD" ? (
                <button
                  onClick={takePhoto}
                  className="w-20 h-20 bg-vic-blue rounded-full flex items-center justify-center border-4 border-white/30 shadow-lg shadow-vic-blue/50 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                  aria-label="Take photo"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-white/50 pointer-events-none" />
                </button>
              ) : (
                /* For scanner: manual capture available for medication package photos */
                <button
                  onClick={takePhoto}
                  className="px-6 py-3 bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-black/80 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <CameraIcon className="w-4 h-4 pointer-events-none" /> Photo Package / Medication
                </button>
              )}

              <div className="size-14 invisible shrink-0" />
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleGalleryUpload}
              className="hidden"
            />
          </motion.div>
        ) : isAnalyzing ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative w-48 h-48 mx-auto mb-8">
              {capturedImage && (
                <img
                  src={capturedImage}
                  className="w-full h-full object-cover rounded-full grayscale opacity-40 border border-white/10"
                />
              )}
              <motion.div
                className={`absolute inset-0 border-4 rounded-full ${scanMode === 'BARCODE' ? 'border-vic-green' : 'border-vic-blue'}`}
                animate={{ scale: [1, 1.08, 1], opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className={`w-12 h-12 animate-pulse ${scanMode === 'BARCODE' ? 'text-vic-green' : 'text-vic-blue'}`} />
              </div>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold mb-3 ${scanMode === 'BARCODE' ? 'text-vic-green' : 'text-vic-blue'}`}>
              {scanMode === 'BARCODE' ? 'Resolving Product Intelligence' : 'Clinical Meal Analysis in Progress'}
            </h2>
            <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
              {scanMode === 'BARCODE'
                ? 'Retrieving exact manufacturer data, evaluating corporate affiliation gates, and local pricing...'
                : 'Identifying visible foods, normalizing against authoritative nutrition records, and comparing against your daily plan...'}
            </p>
          </motion.div>
        ) : (
          /* ─── DEDICATED FULL SCREEN RESULTS ─── */
          scanMode === "FOOD" ? (
            <MealAnalysis
              mealImage={capturedImage || analysisResult.image_url || ''}
              analysis={analysisResult}
              onClose={handleRetry}
              onLog={handleSave}
              onRetry={handleRetry}
            />
          ) : (
            <ProductDetails
              {...analysisResult}
              productName={analysisResult.name}
              productImage={capturedImage || analysisResult.image_url}
              onClose={handleRetry}
              onAddToDiary={() => router.push("/dashboard")}
            />
          )
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
