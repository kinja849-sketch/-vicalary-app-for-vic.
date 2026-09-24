"use client"
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera as CameraIcon, RotateCw, Check, X, Info, Zap, Scale, HeartPulse, Activity, AlertCircle, ShoppingCart, Globe, FlaskConical, MessageSquare, Pill, TriangleAlert, Dna, SwitchCamera, ArrowLeft } from "lucide-react";
import { analyzeFoodImage, scanProduct, saveFoodAnalysis } from "@/lib/api/food";
import { useAnalysisStore } from "@/store/analysisStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { requestCameraAccess } from "@/lib/api/permissions";
import { useNotificationStore } from "@/store/notificationStore";
import { useCoachInjectionStore } from "@/store/coachInjectionStore";

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

      // 1. First attempt in-place track constraint switch (zero permissions, instant flip)
      const currentTrack = streamRef.current?.getVideoTracks()?.[0];
      if (currentTrack && typeof currentTrack.applyConstraints === 'function') {
        try {
          await currentTrack.applyConstraints({
            facingMode: { ideal: targetFacing }
          });
          setFacingMode(targetFacing);
          return;
        } catch (e) {
          // If in-place constraint switch is not supported by device, fall through to stream switch
        }
      }

      // 2. Direct facingMode stream switch keeping existing session permission intact
      setFacingMode(targetFacing);
      await startCamera(targetFacing);
    } catch (err) {
      console.error("switchCamera failed:", err);
      toast.error("Failed to switch camera direction");
    } finally {
      setIsSwitching(false);
    }
  };



  // Continuous Barcode Scanning Logic
  useEffect(() => {
    if (scanMode === "BARCODE" && stream && !isAnalyzing && !analysisResult) {
      barcodeIntervalRef.current = window.setInterval(scanForBarcode, 500);
    } else {
      if (barcodeIntervalRef.current) {
        clearInterval(barcodeIntervalRef.current);
        barcodeIntervalRef.current = null;
      }
    }
    return () => {
      if (barcodeIntervalRef.current) clearInterval(barcodeIntervalRef.current);
    };
  }, [scanMode, stream, isAnalyzing, analysisResult]);

  const scanForBarcode = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || analysisResult) return;

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
        console.error("BarcodeDetector error:", e);
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
    if (!userId || isAnalyzing) return;
    setIsAnalyzing(true);
    setCapturedImage(canvasRef.current?.toDataURL("image/jpeg") || null);

    try {
      const result = await scanProduct(userId, barcode);
      if (result.error) throw new Error(result.error);
      const fullResult = { ...result, type: result.type || 'BARCODE' as const };
      setAnalysisResult(fullResult);
      setLatestAnalysis(fullResult);
      addNotification('success', "Product identified via Barcode!");

      // Immediate Persistence
      saveFoodAnalysis(userId, fullResult).catch(e => console.error("Auto-save failed:", e));
    } catch (err: any) {
      console.error("Barcode scan failed:", err);
      toast.error(err.message || "Failed to identify product.");
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !userId) return;

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

      const result = await analyzeFoodImage(userId, file);
      const fullResult = { ...result, type: 'FOOD' as const };
      setAnalysisResult(fullResult);
      setLatestAnalysis(fullResult);
      addNotification('success', "Food analysis complete!");

      // Immediate Persistence
      saveFoodAnalysis(userId, fullResult).catch(e => console.error("Auto-save failed:", e));
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
      // toast.success("Saved!"); // Removing separate toast
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
    startCamera(facingMode);
  };

  return (
    <div className="h-full flex-1 w-full bg-slate-950 text-white flex flex-col relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-vic-blue rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-vic-deep-blue rounded-full blur-[150px]" />
      </div>

      <AnimatePresence mode="wait">
        {!capturedImage ? (
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

            {/* Overlay elements */}
            <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none" />

            {/* Top Left Close */}
            <Link href="/dashboard" className="absolute top-8 left-6 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/60 transition-all z-10">
              <ArrowLeft className="w-6 h-6" />
            </Link>

            {/* Top Right Switch Camera */}
            <button
              onClick={switchCamera}
              disabled={isSwitching}
              aria-label={facingMode === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
              className="absolute top-8 right-6 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/60 transition-all active:scale-90 z-10 disabled:opacity-50"
            >
              <SwitchCamera className={`w-6 h-6 transition-transform duration-300 ${isSwitching ? 'animate-spin' : ''}`} />
            </button>

            {/* Scanning Frame for Barcode */}
            {scanMode === "BARCODE" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-64 h-48 border-2 border-vic-green/30 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-vic-green rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-vic-green rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-vic-green rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-vic-green rounded-br-lg" />
                  <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-vic-green shadow-[0_0_10px_2px_rgba(33,255,100,0.5)] opacity-50"
                  />
                </div>
              </div>
            )}

            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center z-10 w-full px-6">
              {scanMode === "FOOD" && (
                <button
                  onClick={takePhoto}
                  className="w-20 h-20 bg-vic-blue rounded-full flex items-center justify-center border-4 border-white/20 shadow-lg shadow-vic-blue/50 hover:scale-105 active:scale-95 transition-all"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-white/40" />
                </button>
              )}
            </div>
          </motion.div>
        ) : isAnalyzing ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="relative w-64 h-64 mx-auto mb-8">
              <motion.img
                src={capturedImage}
                className="w-full h-full object-cover rounded-full grayscale opacity-50"
              />
              <motion.div
                className={`absolute inset-0 border-4 rounded-full ${scanMode === 'BARCODE' ? 'border-vic-green' : 'border-vic-blue'}`}
                animate={{ scale: [1, 1.1, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className={`w-12 h-12 animate-bounce ${scanMode === 'BARCODE' ? 'text-vic-green' : 'text-vic-blue'}`} />
              </div>
            </div>
            <h2 className={`text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent mb-4 ${scanMode === 'BARCODE' ? 'from-vic-green to-white' : 'from-vic-blue to-white'}`}>
              {scanMode === 'BARCODE' ? 'Decoding Product Intelligence' : 'Clinical Analysis in Progress'}
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              {scanMode === 'BARCODE'
                ? 'Retrieving manufacturer data, evaluating political affiliations, and localized pricing...'
                : 'Precisely identifying ingredients, estimating portion sizes, and calculating metabolic impact...'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl bg-slate-900/50 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row"
          >
            <div className="w-full md:w-1/3 h-64 md:h-auto relative">
              <img src={capturedImage} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

              {analysisResult.type === 'BARCODE' && (
                <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                  {analysisResult.country_of_origin && (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                      <Globe className="w-3.5 h-3.5 text-vic-blue" />
                      <span className="text-[10px] uppercase font-bold tracking-tight">{analysisResult.country_of_origin}</span>
                    </div>
                  )}
                  {analysisResult.brand && (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] uppercase font-bold tracking-tight">{analysisResult.brand}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 p-8 md:p-12 max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* ─── MEDICATION RESULT ─── */}
              {analysisResult.type === 'medication' ? (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-2xl border border-purple-500/30">
                      <Pill className="w-7 h-7 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">Verified Medication — FDA Database</div>
                      <h2 className="text-3xl font-bold">{analysisResult.name}</h2>
                      {analysisResult.generic_name && <p className="text-slate-400 text-sm mt-1">Generic: <span className="text-white font-semibold">{analysisResult.generic_name}</span></p>}
                    </div>
                  </div>

                  {/* Purpose */}
                  {analysisResult.purpose && (
                    <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                      <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-2 flex items-center gap-2"><Dna className="w-4 h-4" /> Purpose & Mechanism</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{analysisResult.purpose}</p>
                    </div>
                  )}

                  {/* Description */}
                  {analysisResult.description && (
                    <div className="text-sm text-slate-300 leading-relaxed">
                      {analysisResult.description.split('\n\n').map((para: string, i: number) => <p key={i}>{para}</p>)}
                    </div>
                  )}

                  {/* Warnings */}
                  {analysisResult.warnings && (
                    <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                      <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-2"><TriangleAlert className="w-4 h-4" /> Warnings & Precautions</h3>
                      <p className="text-sm text-amber-200/80 leading-relaxed">{analysisResult.warnings}</p>
                    </div>
                  )}

                  {/* Side Effects */}
                  {analysisResult.side_effects && (
                    <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                      <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Common Side Effects</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{analysisResult.side_effects}</p>
                    </div>
                  )}

                  {/* Interactions */}
                  {analysisResult.interactions && (
                    <div className="p-5 bg-slate-800/60 border border-white/10 rounded-2xl">
                      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Drug Interactions</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{analysisResult.interactions}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={async () => {
                        if (!userId) return;
                        try {
                          const { data, error } = await (supabase as any).rpc('provision_user_system_chats', { p_user_id: userId });
                          if (error) throw error;
                          const coachConvId = (data as any)?.coach_conversation_id;
                          if (!coachConvId) throw new Error("Coach conversation not found");

                          // set context
                          setPendingAnalysisContext({
                            productName: analysisResult.name,
                            brand: analysisResult.brand,
                            calories: analysisResult.calories,
                            protein: analysisResult.protein,
                            carbs: analysisResult.carbs,
                            fat: analysisResult.fat,
                            sugar: analysisResult.sugar,
                            price: analysisResult.estimated_price ? Number(analysisResult.estimated_price.replace(/[^0-9.]/g, '')) : 0,
                            country: analysisResult.origin_country || analysisResult.country_of_origin,
                            political_warning: analysisResult.political_warning,
                            is_compliant: analysisResult.is_compliant,
                            healthStatus: analysisResult.healthStatus || analysisResult.verdict,
                            type: 'MEDICATION',
                            productImage: analysisResult.image_url
                          });

                          // Navigate with context
                          sessionStorage.setItem('chatInitialMessage', `I just scanned ${analysisResult.name} (${analysisResult.generic_name}). Can you tell me more about it and if it's safe given my health profile?`);
                          router.push(`/chat/${coachConvId}`);
                        } catch (err) {
                          console.error("Coach nav error:", err);
                          toast.error("Failed to connect to Health Coach.");
                        }
                      }}
                      className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageSquare className="w-5 h-5" /> Ask Health Coach
                    </button>
                    <button onClick={handleRetry} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all text-slate-400">
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                /* ─── FOOD / BARCODE RESULT ─── */
                <div>
                  {/* Political Alert (Barcode Only) */}
                  {analysisResult.political_warning && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-4"
                    >
                      <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
                      <div>
                        <h4 className="text-rose-400 font-bold text-sm uppercase tracking-wider">Ethical Responsibility Alert</h4>
                        <p className="text-xs text-slate-300 mt-1">{analysisResult.political_warning}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Name */}
                  <div className="mb-8">
                    <h2 className="text-4xl font-bold mb-2">{analysisResult.name}</h2>
                    {analysisResult.brand && (
                      <span className="text-slate-400 text-sm flex items-center gap-1 uppercase tracking-tighter">
                        <Scale className="w-4 h-4" /> {analysisResult.brand}
                      </span>
                    )}
                  </div>

                  <div className="space-y-10">
                    {/* Description */}
                    {analysisResult.description && (
                      <section>
                        <div className="text-base text-slate-300 leading-relaxed font-medium space-y-4">
                          {analysisResult.description.split('\n\n').map((para: string, i: number) => <p key={i}>{para}</p>)}
                        </div>
                      </section>
                    )}

                    {/* Vitamins */}
                    {analysisResult.vitamins_and_nutrition && (
                      <section>
                        <h3 className="text-2xl font-bold mb-4 text-white border-b border-white/10 pb-2">Vitamins & Nutrition</h3>
                        <div className="text-sm text-slate-400 leading-relaxed space-y-4">
                          {analysisResult.vitamins_and_nutrition.split('\n\n').map((para: string, i: number) => <p key={i}>{para}</p>)}
                        </div>
                      </section>
                    )}

                    {/* Recommended Pairings */}
                    {analysisResult.recommended_pairings && (
                      <section>
                        <h3 className="text-2xl font-bold mb-4 text-white border-b border-white/10 pb-2">Recommended Pairings</h3>
                        <div className="text-sm text-slate-400 leading-relaxed space-y-4">
                          {analysisResult.recommended_pairings.split('\n\n').map((para: string, i: number) => <p key={i}>{para}</p>)}
                        </div>
                      </section>
                    )}

                    {/* Calorie Summary */}
                    <section className="pt-8 border-t border-white/10">
                      <div className="flex flex-col items-center justify-center py-6 bg-white/5 rounded-3xl border border-white/10">
                        <div className="text-3xl font-black text-white mb-2">~ {analysisResult.calories} kcal</div>
                        <div className="text-sm font-bold text-slate-400 tracking-wider">
                          P: {analysisResult.protein}g • F: {analysisResult.fat}g • C: {analysisResult.carbs}g
                        </div>
                        {analysisResult.estimated_price && (
                          <div className="mt-4 px-4 py-1.5 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold flex items-center gap-2">
                            <ShoppingCart className="w-3.5 h-3.5" /> {analysisResult.estimated_price}
                          </div>
                        )}
                      </div>
                    </section>

                    {/* AI Recommendation */}
                    {analysisResult.recommendation && (
                      <section className="p-6 bg-vic-blue/10 border border-vic-blue/20 rounded-2xl italic">
                        <p className="text-sm text-slate-300">{analysisResult.recommendation}</p>
                      </section>
                    )}
                  </div>

                  <div className="mt-10 flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="flex-1 py-4 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold hover:bg-white/10 flex items-center justify-center gap-2 transition-all"
                    >
                      <Check className="w-5 h-5 text-vic-green" /> Already Logged
                    </button>
                    <button
                      onClick={async () => {
                        if (!userId || !analysisResult) return;
                        try {
                          const { data, error } = await (supabase as any).rpc('provision_user_system_chats', { p_user_id: userId });
                          if (error) throw error;
                          const coachConvId = (data as any)?.coach_conversation_id;
                          if (!coachConvId) throw new Error("Coach conversation not found");

                          // set context
                          setPendingAnalysisContext({
                            productName: analysisResult.name,
                            calories: analysisResult.calories,
                            protein: analysisResult.protein,
                            carbs: analysisResult.carbs,
                            fat: analysisResult.fat,
                            sugar: analysisResult.sugar,
                            price: analysisResult.estimated_price ? Number(analysisResult.estimated_price.replace(/[^0-9.]/g, '')) : 0,
                            country: analysisResult.origin_country || analysisResult.country_of_origin,
                            political_warning: analysisResult.political_warning,
                            is_compliant: analysisResult.is_compliant,
                            healthStatus: analysisResult.healthStatus || analysisResult.verdict,
                            type: 'FOOD',
                            productImage: analysisResult.image_url
                          });

                          const priceStr = analysisResult.estimated_price ? ` (${analysisResult.estimated_price})` : '';
                          const originStr = analysisResult.origin_country || analysisResult.country_of_origin ? `, manufactured in ${analysisResult.origin_country || analysisResult.country_of_origin}` : '';
                          const ethicalStr = analysisResult.political_warning ? ' and has some ethical manufacturer flags' : '';

                          const initialMessage = `I just analyzed ${analysisResult.name}${priceStr}${originStr} (${analysisResult.calories} kcal)${ethicalStr}. How does this fit my health goals?`;

                          sessionStorage.setItem('chatInitialMessage', initialMessage);
                          router.push(`/chat/${coachConvId}`);
                        } catch (err) {
                          console.error("Coach nav error:", err);
                          toast.error("Failed to connect to Health Coach.");
                        }
                      }}
                      className="flex-1 py-4 bg-vic-blue text-white rounded-2xl font-bold hover:bg-vic-blue/90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-vic-blue/20"
                    >
                      <MessageSquare className="w-5 h-5" /> Consult Coach
                    </button>
                    <button onClick={handleRetry} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all text-slate-400">
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
