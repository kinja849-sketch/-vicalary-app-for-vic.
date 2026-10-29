"use client"
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, SwitchCamera, ArrowLeft, RefreshCw, Camera as CameraIcon, Images, AlertCircle } from "lucide-react";
import { analyzeFoodImage, scanProduct, saveFoodAnalysis, analyzeMedication } from "@/lib/api/food";
import { logMeal } from "@/lib/api/progress";
import { useAnalysisStore } from "@/store/analysisStore";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { requestCameraAccess } from "@/lib/api/permissions";
import { useNotificationStore } from "@/store/notificationStore";
import { useCoachInjectionStore } from "@/store/coachInjectionStore";
import { useAuth } from "@/lib/AuthContext";
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
  const { user } = useAuth();

  const isScanner = initialMode === "BARCODE" ||
    searchParams?.get("mode") === "scanner" ||
    searchParams?.get("mode") === "barcode" ||
    pathname?.includes("/scanner");

  const setPendingAnalysisContext = useAnalysisStore(state => state.setPendingAnalysisContext);
  const addNotification = useNotificationStore(state => state.addNotification);
  const setLatestAnalysis = useCoachInjectionStore(state => state.setLatestAnalysis);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanMode, setScanMode] = useState<ScanMode>(isScanner ? "BARCODE" : "FOOD");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [medicationWarningAlert, setMedicationWarningAlert] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const barcodeIntervalRef = useRef<number | null>(null);
  const scanFrameIdRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const zxingReaderRef = useRef<any>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize BarcodeDetector and ZXing singleton reader once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        (window as any).BarcodeDetector.getSupportedFormats().then((formats: string[]) => {
          barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats });
        }).catch(() => {
          barcodeDetectorRef.current = new (window as any).BarcodeDetector();
        });
      } catch (e) {
        try {
          barcodeDetectorRef.current = new (window as any).BarcodeDetector();
        } catch (err) {
          barcodeDetectorRef.current = null;
        }
      }
    }
    // Preload ZXing reader with TRY_HARDER and broad 1D/2D formats
    Promise.all([
      import('@zxing/browser'),
      import('@zxing/library')
    ]).then(([{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }]) => {
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.UPC_A,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE
      ]);
      zxingReaderRef.current = new BrowserMultiFormatReader(hints);
    }).catch(() => {
      import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
        zxingReaderRef.current = new BrowserMultiFormatReader();
      }).catch(() => {});
    });
  }, []);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isAnalyzing) return;
    const activeUserId = user?.id || userId || 'anon';

    setIsAnalyzing(true);
    const imageUrl = URL.createObjectURL(file);
    setCapturedImage(imageUrl);

    try {
      if (scanMode === "BARCODE" || isScanner) {
        // In Scanner mode, attempt barcode detection from uploaded image canvas
        const img = new Image();
        img.src = imageUrl;
        await new Promise((resolve) => { img.onload = resolve; });

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        let detectedBarcode: string | null = null;

        if (ctx) {
          ctx.drawImage(img, 0, 0);
          if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({
                formats: ['ean_13', 'upc_a', 'upc_e', 'ean_8', 'code_128', 'code_39', 'code_93', 'itf', 'qr_code', 'data_matrix']
              });
              const barcodes = await detector.detect(canvas);
              if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                detectedBarcode = barcodes[0].rawValue;
              }
            } catch (e) {}
          }

          if (!detectedBarcode) {
            try {
              const { BrowserMultiFormatReader } = await import("@zxing/browser");
              const reader = new BrowserMultiFormatReader();
              const result = reader.decodeFromCanvas(canvas);
              if (result && result.getText()) {
                detectedBarcode = result.getText();
              }
            } catch (e) {}
          }
        }

        if (detectedBarcode) {
          await handleBarcodeDetected(detectedBarcode);
          return;
        }

        // Fallback: analyze medication / product image directly if barcode not readable in photo
        const result = await analyzeMedication(activeUserId, file);
        const fullResult = { ...result, type: result.type || 'BARCODE' as const };
        setAnalysisResult(fullResult);
        setLatestAnalysis(fullResult);
        addNotification('success', "Product analysis complete!");
      } else {
        const result = await analyzeFoodImage(activeUserId, file);
        const fullResult = { ...result, type: 'FOOD' as const };
        setAnalysisResult(fullResult);
        setLatestAnalysis(fullResult);
        addNotification('success', "Food analysis complete!");
      }
    } catch (err: any) {
      console.error("Gallery analysis failed:", err);
      if (err?.not_medication || err?.message?.toLowerCase().includes('not a medicine')) {
        const msg = err.message || "Be serious. This is not a medicine at all.";
        setMedicationWarningAlert(msg);
        toast.error(`⚠️ ${msg}`, { duration: 7000 });
      } else {
        toast.error(err.message || "Failed to analyze uploaded image.");
      }
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
      if (scanFrameIdRef.current) cancelAnimationFrame(scanFrameIdRef.current);
      if (barcodeIntervalRef.current) clearInterval(barcodeIntervalRef.current);
    };
  }, []);

  // Camera stream watchdog: ensure video element is always bound to live stream & playing when active
  useEffect(() => {
    if (analysisResult) return;

    const ensureCameraActive = async () => {
      const video = videoRef.current;
      const currentStream = streamRef.current;
      const hasLiveTracks = currentStream && currentStream.getVideoTracks().some(track => track.readyState === 'live');

      if (hasLiveTracks && currentStream) {
        if (video) {
          if (video.srcObject !== currentStream) {
            video.srcObject = currentStream;
          }
          if (video.paused) {
            try {
              await video.play();
            } catch (e) {
              console.warn("Camera play resumed:", e);
            }
          }
        }
      } else {
        await startCamera(facingMode);
      }
    };

    ensureCameraActive();
  }, [analysisResult, isAnalyzing, facingMode]);

  // Handle mobile / desktop tab backgrounding & return
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !analysisResult) {
        const video = videoRef.current;
        const currentStream = streamRef.current;
        const hasLiveTracks = currentStream && currentStream.getVideoTracks().some(track => track.readyState === 'live');
        if (hasLiveTracks && currentStream && video) {
          if (video.srcObject !== currentStream) video.srcObject = currentStream;
          video.play().catch(e => console.warn("Visibility resume error:", e));
        } else {
          startCamera(facingMode);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [analysisResult, facingMode]);

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

  // Real-time Automatic Barcode Detection Loop (Throttled at ~120ms with downscaled canvas)
  useEffect(() => {
    let lastScanTime = 0;
    let isActive = true;

    const loop = (timestamp: number) => {
      if (!isActive) return;
      if (
        scanMode === "BARCODE" &&
        stream &&
        !isAnalyzing &&
        !analysisResult &&
        !isScanningBarcode &&
        timestamp - lastScanTime >= 120
      ) {
        lastScanTime = timestamp;
        scanForBarcode();
      }
      scanFrameIdRef.current = requestAnimationFrame(loop);
    };

    if (scanMode === "BARCODE" && stream && !isAnalyzing && !analysisResult && !isScanningBarcode) {
      scanFrameIdRef.current = requestAnimationFrame(loop);
    }

    return () => {
      isActive = false;
      if (scanFrameIdRef.current) {
        cancelAnimationFrame(scanFrameIdRef.current);
        scanFrameIdRef.current = null;
      }
    };
  }, [scanMode, stream, isAnalyzing, analysisResult, isScanningBarcode]);

  const scanForBarcode = async () => {
    if (!videoRef.current || isAnalyzing || analysisResult || isScanningBarcode || isScanningRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    isScanningRef.current = true;
    try {
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;

      // Tier 1: Native BarcodeDetector directly on raw video element (hardware accelerated zero-copy Chromium)
      if (barcodeDetectorRef.current) {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
            handleBarcodeDetected(barcodes[0].rawValue);
            return;
          }
        } catch (e) {
          // Fall through to canvas detection if raw video detection throws
        }
      }

      // Tier 2: Sharp 1:1 center viewfinder crop (65% width x 50% height)
      // Maintains 100% pixel crispness for dense 1D barcodes without downsampling blur
      if (!cropCanvasRef.current) {
        cropCanvasRef.current = document.createElement("canvas");
      }
      const cropCanvas = cropCanvasRef.current;
      const cropW = Math.round(videoW * 0.65);
      const cropH = Math.round(videoH * 0.50);
      const cropX = Math.round((videoW - cropW) / 2);
      const cropY = Math.round((videoH - cropH) / 2);

      if (cropCanvas.width !== cropW || cropCanvas.height !== cropH) {
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
      }
      const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true });
      if (cropCtx) {
        cropCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Try native detector on viewfinder crop
        if (barcodeDetectorRef.current) {
          try {
            const cropBarcodes = await barcodeDetectorRef.current.detect(cropCanvas);
            if (cropBarcodes && cropBarcodes.length > 0 && cropBarcodes[0]?.rawValue) {
              handleBarcodeDetected(cropBarcodes[0].rawValue);
              return;
            }
          } catch (e) {}
        }

        // Try ZXing reader on viewfinder crop
        if (zxingReaderRef.current) {
          try {
            const zxingCropRes = zxingReaderRef.current.decodeFromCanvas(cropCanvas);
            if (zxingCropRes && zxingCropRes.getText()) {
              handleBarcodeDetected(zxingCropRes.getText());
              return;
            }
          } catch (e) {}
        }
      }

      // Tier 3: Full resolution canvas fallback
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== videoW || canvas.height !== videoH) {
          canvas.width = videoW;
          canvas.height = videoH;
        }
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, videoW, videoH);

          if (zxingReaderRef.current) {
            try {
              const fullResult = zxingReaderRef.current.decodeFromCanvas(canvas);
              if (fullResult && fullResult.getText()) {
                handleBarcodeDetected(fullResult.getText());
                return;
              }
            } catch (e) {}
          }
        }
      }
    } finally {
      isScanningRef.current = false;
    }
  };

  const handleBarcodeDetected = async (barcode: string) => {
    if (isAnalyzing || isScanningBarcode) return;
    const activeUserId = user?.id || userId || 'anon';
    setIsScanningBarcode(true);
    setIsAnalyzing(true);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) {}
    }

    // Capture current frame for preview image
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        setCapturedImage(c.toDataURL("image/jpeg"));
      }
    }

    try {
      const result = await scanProduct(activeUserId, barcode);
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
    } finally {
      setIsAnalyzing(false);
      setIsScanningBarcode(false);
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;
    const activeUserId = user?.id || userId || 'anon';

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
        ? await analyzeMedication(activeUserId, file)
        : await analyzeFoodImage(activeUserId, file);

      const fullResult = { ...result, type: (result.type || (scanMode === "BARCODE" ? 'MEDICATION' : 'FOOD')) as any };
      setAnalysisResult(fullResult);
      setLatestAnalysis(fullResult);
      addNotification('success', scanMode === "BARCODE" ? "Medication analysis complete!" : "Food analysis complete!");
      // NO auto-save on photo capture! User confirms via "Log to Food Diary"
    } catch (err: any) {
      console.error("Analysis failed:", err);
      if (err?.not_medication || err?.message?.toLowerCase().includes('not a medicine')) {
        const msg = err.message || "Be serious. This is not a medicine at all.";
        setMedicationWarningAlert(msg);
        toast.error(`⚠️ ${msg}`, { duration: 7000 });
      } else {
        toast.error(err?.message || "Analysis failed. Please try again.");
      }
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    const activeUserId = user?.id || userId;
    if (!activeUserId || !analysisResult) return;
    try {
      await saveFoodAnalysis(activeUserId, analysisResult);
      
      const mealToLog = {
        mealImage: capturedImage || analysisResult.image_url,
        totalCalories: analysisResult.calories,
        foodItems: (analysisResult.items && analysisResult.items.length > 0)
          ? analysisResult.items.map((i: any) => ({
              name: i.count ? `${i.name} (${i.count})` : i.name,
              calories: i.calories,
              image: i.image_url || capturedImage || analysisResult.image_url,
              protein: i.protein,
              carbs: i.carbs,
              fat: i.fat,
              fiber: i.fiber,
              sugar: i.sugar
            }))
          : [{
              name: analysisResult.name,
              calories: analysisResult.calories,
              image: capturedImage || analysisResult.image_url,
              protein: analysisResult.protein,
              carbs: analysisResult.carbs,
              fat: analysisResult.fat,
              fiber: analysisResult.fiber,
              sugar: analysisResult.sugar
            }],
        alreadySaved: true
      };

      const logResult = await logMeal(activeUserId, mealToLog);
      if (logResult?.exceededGoal) {
        toast.warning(logResult.message, { duration: 7000 });
      } else if (logResult?.justAchieved) {
        toast.success(logResult.message, { duration: 6000 });
      } else {
        addNotification('success', "Logged to your diary successfully!");
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save to log.");
    }
  };

  const dismissMedicationAlert = () => {
    setMedicationWarningAlert(null);
    setCapturedImage(null);
    setIsAnalyzing(false);

    const video = videoRef.current;
    const currentStream = streamRef.current;
    const hasLiveTracks = currentStream && currentStream.getVideoTracks().some(track => track.readyState === 'live');
    if (hasLiveTracks && currentStream && video) {
      if (video.srcObject !== currentStream) {
        video.srcObject = currentStream;
      }
      video.play().catch(e => console.warn("Alert dismiss play error:", e));
    } else {
      startCamera(facingMode);
    }
  };

  const handleRetry = () => {
    setAnalysisResult(null);
    setCapturedImage(null);
    setIsAnalyzing(false);
    setIsScanningBarcode(false);

    const video = videoRef.current;
    const currentStream = streamRef.current;
    const hasLiveTracks = currentStream && currentStream.getVideoTracks().some(track => track.readyState === 'live');
    if (hasLiveTracks && currentStream && video) {
      if (video.srcObject !== currentStream) {
        video.srcObject = currentStream;
      }
      video.play().catch(e => console.warn("Retry play error:", e));
    } else {
      startCamera(facingMode);
    }
  };

  return (
    <div className="h-full flex-1 w-full bg-[#0a0f14] text-white flex flex-col relative overflow-hidden">
      {/* ─── CONTINUOUS PERSISTENT CAMERA VIEWFINDER ─── */}
      <div className={`relative w-full h-full overflow-hidden bg-black flex-1 ${analysisResult ? 'hidden' : 'flex'}`}>
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
        {!isAnalyzing && (
          <Link
            href="/dashboard"
            className="absolute top-8 left-6 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/60 transition-all z-20"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
        )}

        {/* Top Right Switch Camera - Hidden in Scanner Mode */}
        {!isScanner && scanMode !== "BARCODE" && !isAnalyzing && (
          <button
            onClick={switchCamera}
            disabled={isSwitching}
            aria-label={facingMode === 'environment' ? 'Switch to front camera' : 'Switch to back camera'}
            className="absolute top-8 right-6 p-3 bg-black/40 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/60 transition-all active:scale-90 z-20 disabled:opacity-50"
          >
            <SwitchCamera className={`w-6 h-6 transition-transform duration-300 ${isSwitching ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Scanning Frame for Barcode */}
        {scanMode === "BARCODE" && !isAnalyzing && (
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
          </div>
        )}

        {/* Bottom Controls */}
        {!isAnalyzing && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center justify-center gap-6 z-20 w-full px-6 max-w-md">
            {!isScanner && scanMode !== "BARCODE" ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="size-14 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-all active:scale-90 shadow-2xl shrink-0 cursor-pointer"
                title="Upload image from gallery"
                aria-label="Upload image from gallery"
              >
                <Images className="w-6 h-6 text-white pointer-events-none" />
              </button>
            ) : null}

            {scanMode === "FOOD" ? (
              <button
                onClick={takePhoto}
                className="w-20 h-20 bg-vic-blue rounded-full flex items-center justify-center border-4 border-white/30 shadow-lg shadow-vic-blue/50 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                aria-label="Take photo"
              >
                <div className="w-16 h-16 rounded-full border-2 border-white/50 pointer-events-none" />
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={takePhoto}
                  className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center border-4 border-white/30 shadow-lg shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                  aria-label="Capture medicine packaging"
                  title="Capture medicine packaging"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-slate-900/60 flex items-center justify-center pointer-events-none">
                    <CameraIcon className="w-6 h-6 text-white" />
                  </div>
                </button>
                <span className="text-[10px] font-bold tracking-wider text-slate-300 uppercase bg-black/60 px-2 py-0.5 rounded-full border border-white/10">
                  Medicine Photo
                </span>
              </div>
            )}

            {!isScanner && scanMode !== "BARCODE" && (
              <div className="size-14 invisible shrink-0" />
            )}
          </div>
        )}

        {/* Analyzing Overlay (Over active live camera view) */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              key="analyzing-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md"
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
          )}
        </AnimatePresence>

        {/* Non-Medication Rejection Alert Modal */}
        <AnimatePresence>
          {medicationWarningAlert && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md"
            >
              <div className="max-w-xs sm:max-w-sm w-full bg-white dark:bg-[#111c24] text-slate-900 dark:text-white border border-rose-200 dark:border-rose-900/50 rounded-[2rem] p-6 sm:p-7 text-center space-y-4 shadow-2xl">
                <div className="size-16 mx-auto rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
                  <AlertCircle className="w-9 h-9 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight leading-snug">
                    Be serious. This is not a medicine at all.
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    This scanner is configured for medicines only. Please scan an authentic medication package, blister pack, or prescription bottle, or switch to Food mode.
                  </p>
                </div>
                <button
                  onClick={dismissMedicationAlert}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleGalleryUpload}
          className="hidden"
        />
      </div>

      {/* ─── DEDICATED FULL SCREEN RESULTS ─── */}
      {analysisResult && (
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


      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
