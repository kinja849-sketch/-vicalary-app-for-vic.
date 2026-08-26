"use client"
import { useState, useEffect, useRef } from "react";
import { X, SwitchCamera, Images, Camera, Sun, Moon, RefreshCw } from "lucide-react";
import Link from "next/link"
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { MealDeck } from "@/components/MealDeck";
import { MealAnalysis } from "@/components/MealAnalysis";
import { ProductDetails } from "@/components/ProductDetails";
import FoodCarousel from "@/components/FoodCarousel";
import { getUserProfile } from "@/lib/api/auth";
import { getDailyProgress, logMeal, getDailySummary } from "@/lib/api/progress";
import { generateDailySummary } from "@/lib/api/coach";
import { getDailyMealSuggestions } from "@/lib/api/recipes";
import { analyzeFoodImage as apiAnalyzeFoodImage } from "@/lib/api/food";
import { toast } from "sonner";
import { ProgressCard } from "@/components/ProgressCard";
import { uploadAvatar } from "@/lib/api/auth";
import { CustomAnimatedIcon } from "@/components/CustomAnimatedIcon";
import { CheckpointCalendar } from "@/components/CheckpointCalendar";
import { useTranslation } from "@/lib/api/translation";
import { useCurrency } from "@/lib/CurrencyContext";
import { supabase } from "@/lib/supabase";
import { SpiritualReminder } from "@/components/SpiritualReminder";
import { ManualProgressInput } from "@/components/ManualProgressInput";
import dynamic from "next/dynamic";
const QRScanner = dynamic(() => import("@/components/QRScanner"), { ssr: false });
import { scanProduct, saveFoodAnalysis } from "@/lib/api/food";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { requestCameraAccess } from "@/lib/api/permissions";
import { useNotificationStore } from "@/store/notificationStore";
import { useCoachInjectionStore } from "@/store/coachInjectionStore";

export default function Dashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { t, country, countryFlag, lang, localHour, speak } = useTranslation();
  const [currentView, setCurrentView] = useState<"dashboard" | "progress">("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // Determine current meal type based on time
  const getCurrentMealType = () => {
    const hour = localHour;
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    return "dinner";
  };
  const [activeMealType, setActiveMealType] = useState<"breakfast" | "lunch" | "dinner">(getCurrentMealType());



  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showMealAnalysis, setShowMealAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { countryCode, currencySymbol: globalCurrencySymbol } = useCurrency();
  const [showProgressInput, setShowProgressInput] = useState(false);
  const addNotification = useNotificationStore(state => state.addNotification);
  const setLatestAnalysis = useCoachInjectionStore(state => state.setLatestAnalysis);

  // Derive locationContext from the global currency provider
  const locationContext = {
    country: countryCode,
    currency_symbol: globalCurrencySymbol
  };
  const [selectedProgressDate, setSelectedProgressDate] = useState<Date>(new Date());

  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);

  // Fetch user profile from Supabase
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id
  });

  // Fetch daily progress
  const today = new Date().toISOString().split('T')[0];

  const { data: dailyProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['daily-progress', user?.id, today],
    queryFn: () => getDailyProgress(user?.id || '', today),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch onboarding info for calorie goals
  const { data: onboarding } = useQuery({
    queryKey: ['onboarding', user?.id],
    queryFn: async () => {
      const { data: rows, error } = await (supabase
        .from('onboarding_responses') as any)
        .select('*')
        .eq('user_id', user!.id)
        .limit(1);
      if (error) throw error;
      return rows && rows.length > 0 ? rows[0] : null;
    },
    enabled: !!user?.id,
    staleTime: Infinity, // Onboarding data rarely changes
    refetchOnWindowFocus: false,
    retry: 1
  });

  const { data: dailySummary } = useQuery({
    queryKey: ['daily-summary', user?.id, today],
    queryFn: () => getDailySummary(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch suggestions
  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', user?.id, today],
    queryFn: () => getDailyMealSuggestions(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Update active meal type when suggestions load (backend logic takes precedence)
  useEffect(() => {
    if (suggestions?.currentSession) {
      setActiveMealType(suggestions.currentSession as "breakfast" | "lunch" | "dinner");
    }
  }, [suggestions]);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setDarkMode(savedTheme === "dark");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, [user, profile, authLoading]);

  // Route Guard: Redirect to onboarding if profile is incomplete or missing
  useEffect(() => {
    if (!authLoading) {
      if (profile === null || (profile && !profile.onboarding_completed)) {
        console.log("[Dashboard] Profile incomplete or missing. Redirecting to onboarding.");
        router.push("/onboarding");
      }
    }
  }, [profile, authLoading, router]);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Camera functions
  const openCamera = async () => {
    try {
      const stream = await requestCameraAccess({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 },
          advanced: [
            { exposureMode: 'continuous' } as any,
            { whiteBalanceMode: 'continuous' } as any,
            { focusMode: 'continuous' } as any,
            { brightness: 100 } as any,
            { contrast: 100 } as any
          ]
        }
      });
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraStreamRef.current = stream;
        try {
          await cameraVideoRef.current.play();
        } catch (e) {
          console.error("Video auto-play failed:", e);
        }
      }
      setShowCameraModal(true);
    } catch (err) {
      console.error("Camera access failed in Dashboard.tsx:", err);
      // Detailed error is already handled by requestCameraAccess toast
    }
  };

  const switchCamera = async () => {
    try {
      // Enumerate all video input devices (works on both desktop and mobile)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      if (videoDevices.length <= 1) {
        // Single camera: toggle facingMode as mobile fallback
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach(track => track.stop());
        }
        try {
          const stream = await requestCameraAccess({ video: { facingMode: newMode } });
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = stream;
            cameraStreamRef.current = stream;
            await cameraVideoRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.error("Failed to switch camera:", err);
        }
        return;
      }

      // Multi-camera: cycle to the next device by deviceId
      const currentTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const currentDeviceId = currentTrack?.getSettings().deviceId;
      const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];

      const label = nextDevice.label.toLowerCase();
      const newMode = label.includes('front') || label.includes('user') ? 'user' : 'environment';
      setFacingMode(newMode);

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
      }
      try {
        const stream = await requestCameraAccess({
          video: { deviceId: { exact: nextDevice.deviceId } }
        });
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraStreamRef.current = stream;
          await cameraVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Failed to switch camera:", err);
      }
    } catch (err) {
      console.error("switchCamera enumeration failed:", err);
    }
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setShowCameraModal(false);
  };

  const capturePhoto = async () => {
    if (!cameraVideoRef.current) return;

    try {
      setIsAnalyzing(true);
      const video = cameraVideoRef.current;
      const canvas = document.createElement("canvas");

      // Limit size to 800px max dimension to prevent timeouts
      const maxDim = 800;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
      if (!blob) throw new Error("Failed to capture image");

      const file = new File([blob], "meal.jpg", { type: "image/jpeg" });
      const analysis = await apiAnalyzeFoodImage(user!.id, file, {
        currentTime: new Date().toISOString(),
        locationContext
      });

      const imageData = canvas.toDataURL("image/jpeg");
      const formattedAnalysis = {
        mealImage: imageData,
        totalCalories: analysis.calories,
        foodItems: [
          {
            name: analysis.name,
            calories: analysis.calories,
            description: analysis.description,
            vitamins_and_nutrition: analysis.vitamins_and_nutrition,
            recommended_pairings: analysis.recommended_pairings,
            recommendation: analysis.recommendation,
            protein: analysis.protein,
            carbs: analysis.carbs,
            fat: analysis.fat,
            sugar: analysis.sugar,
            fiber: analysis.fiber,
            healthStatus: (analysis as any).verdict || analysis.healthStatus,
            is_compliant: analysis.is_compliant,
            user_alignment_boolean: analysis.user_alignment_boolean,
            political_warning: analysis.political_warning,
            estimated_price: analysis.estimated_price,
            cheaper_alternatives: analysis.cheaper_alternatives,
            type: 'FOOD' as const,
            brand: (analysis as any).brand,
            manufacturer: (analysis as any).manufacturer,
            country_of_origin: (analysis as any).country_of_origin,
            ingredients: (analysis as any).ingredients,
          }
        ],
        ...analysis
      };

      setAnalysisData(formattedAnalysis);
      setLatestAnalysis(formattedAnalysis);
      closeCamera();
      setShowMealAnalysis(true);
      addNotification('success', "Meal analyzed and ready for review");
    } catch (err: any) {
      console.error("Capture Photo Error:", err);
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsAnalyzing(true);

      // Resize image before upload to prevent AI timeouts
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      await new Promise((resolve) => { img.onload = resolve; img.src = imageUrl; });

      const canvas = document.createElement("canvas");
      const maxDim = 800;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
      } else {
        if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
      if (!blob) throw new Error("Failed to process image");
      const resizedFile = new File([blob], file.name, { type: "image/jpeg" });

      const analysis = await apiAnalyzeFoodImage(user.id, resizedFile, {
        currentTime: new Date().toISOString(),
        locationContext
      });

      const imageData = canvas.toDataURL("image/jpeg");

      const formattedAnalysis = {
        mealImage: imageUrl,
        totalCalories: analysis.calories,
        foodItems: [
          {
            name: analysis.name,
            calories: analysis.calories,
            description: analysis.description,
            vitamins_and_nutrition: analysis.vitamins_and_nutrition,
            recommended_pairings: analysis.recommended_pairings,
            recommendation: analysis.recommendation,
            protein: analysis.protein,
            carbs: analysis.carbs,
            fat: analysis.fat,
            sugar: analysis.sugar,
            fiber: analysis.fiber,
            healthStatus: (analysis as any).verdict || analysis.healthStatus,
            is_compliant: analysis.is_compliant,
            user_alignment_boolean: analysis.user_alignment_boolean,
            political_warning: analysis.political_warning,
            estimated_price: analysis.estimated_price,
            cheaper_alternatives: analysis.cheaper_alternatives,
            type: 'FOOD' as const,
            brand: (analysis as any).brand,
            manufacturer: (analysis as any).manufacturer,
            country_of_origin: (analysis as any).country_of_origin,
            ingredients: (analysis as any).ingredients,
          }
        ],
        ...analysis
      };

      setAnalysisData(formattedAnalysis);
      setLatestAnalysis(formattedAnalysis);
      closeCamera();
      setShowMealAnalysis(true);
      addNotification('success', "Image analyzed successfully");

      // Immediate Persistence
      saveFoodAnalysis(user.id, analysis).catch(e => console.error("Auto-save failed:", e));
    } catch (err: any) {
      console.error("Gallery Upload Error:", err);
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const handleLogMeal = async () => {
    if (!user || !analysisData) return;
    try {
      await logMeal(user.id, analysisData);
      addNotification('success', `Meal ${analysisData.name || ''} logged successfully!`);
      // toast.success("Meal logged!"); // Removing separate toast to avoid redundancy
      setShowMealAnalysis(false);
      queryClient.invalidateQueries({ queryKey: ['daily-progress', user.id, today] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary', user.id, today] });
      queryClient.invalidateQueries({ queryKey: ['onboarding', user.id] });
    } catch (err: any) {
      toast.error(`Failed to log meal: ${err.message}`);
    }
  };

  const openScanner = () => {
    setShowScannerModal(true);
  };

  const handleQRManualCapture = async (blob: Blob) => {
    if (!user) return;
    setIsAnalyzing(true);
    try {
      const file = new File([blob], "product_scan.jpg", { type: "image/jpeg" });
      const analysis = await apiAnalyzeFoodImage(user.id, file, {
        currentTime: new Date().toISOString(),
        locationContext,
        isProductScan: true
      });

      const imageData = URL.createObjectURL(blob);
      const formattedProduct = {
        productImage: analysis.image_url || imageData,
        productName: analysis.name || analysis.productName || "Unknown Product",
        servingSize: analysis.serving_size || "1 serving",
        description: analysis.description,
        vitamins_and_nutrition: analysis.vitamins_and_nutrition,
        recommendation: analysis.recommendation,
        recommended_pairings: analysis.recommended_pairings,
        healthStatus: analysis.healthStatus || analysis.verdict || 'GOOD',
        calories: analysis.calories,
        protein: analysis.protein,
        carbs: analysis.carbs,
        fat: analysis.fat,
        sugar: analysis.sugar,
        fiber: analysis.fiber,
        origin_country: analysis.country_of_origin || analysis.origin_country,
        brand: analysis.brand,
        manufacturer: analysis.manufacturer,
        estimated_price: analysis.estimated_price,
        cheaper_alternatives: analysis.cheaper_alternatives,
        is_compliant: analysis.is_compliant,
        user_alignment_boolean: analysis.user_alignment_boolean,
        political_warning: analysis.political_warning,
        usage_instructions: analysis.usage_instructions,
        factory_ingredients: analysis.factory_ingredients,
        suitability_analysis: analysis.suitability_analysis,
        country_origin_details: analysis.country_origin_details,
        type: analysis.type === 'medication' ? 'MEDICATION' : 'FOOD',
        generic_name: analysis.generic_name,
        purpose: analysis.purpose,
        side_effects: analysis.side_effects,
        interactions: analysis.interactions,
        warnings: analysis.warnings,
        storage: analysis.storage,
      };

      setProductData(formattedProduct);
      setLatestAnalysis(formattedProduct);
      setShowScannerModal(false);
      setShowProductDetails(true);
      addNotification('success', "Product analyzed visually!");

      // Immediate Persistence
      saveFoodAnalysis(user.id, analysis).catch(e => console.error("Auto-save failed:", e));
    } catch (err: any) {
      console.error("Manual QR Capture Error:", err);
      toast.error(`Visual analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setShowScannerModal(false); // Close modal after analysis is done
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (!user) return;
    try {
      setIsAnalyzing(true);
      const data = await scanProduct(user.id, barcode, {
        currentTime: new Date().toISOString(),
        locationContext,
        forceReload: true // Bypass 5-minute cache to instantly test Edge Function changes
      });

      const formattedProduct = {
        productImage: data.image_url || data.image || data.productImage || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300",
        productName: data.name || data.productName,
        servingSize: data.serving_size || "1 serving",
        description: data.description,
        vitamins_and_nutrition: data.vitamins_and_nutrition,
        recommendation: data.recommendation,
        recommended_pairings: data.recommended_pairings,
        healthStatus: data.healthStatus || data.verdict || 'GOOD',
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        sugar: data.sugar,
        fiber: data.fiber,
        origin_country: data.country_of_origin || data.origin_country,
        brand: data.brand,
        manufacturer: data.manufacturer,
        estimated_price: data.estimated_price,
        cheaper_alternatives: data.cheaper_alternatives,
        is_compliant: data.is_compliant,
        user_alignment_boolean: data.user_alignment_boolean,
        political_warning: data.political_warning,
        usage_instructions: data.usage_instructions,
        factory_ingredients: data.factory_ingredients,
        suitability_analysis: data.suitability_analysis,
        country_origin_details: data.country_origin_details,
        type: data.type === 'medication' ? 'MEDICATION' : 'FOOD',
        generic_name: data.generic_name,
        purpose: data.purpose,
        side_effects: data.side_effects,
        interactions: data.interactions,
        warnings: data.warnings,
        storage: data.storage,
      };

      setProductData(formattedProduct);
      setLatestAnalysis(formattedProduct);
      setShowScannerModal(false);
      setShowProductDetails(true);
      addNotification('success', "Product identified via Barcode!");

      // Immediate Persistence
      saveFoodAnalysis(user.id, data).catch(e => console.error("Auto-save failed:", e));
    } catch (err: any) {
      console.error("Barcode Scan Error:", err);
      toast.error(`Barcode scan failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogProduct = async () => {
    if (!user || !productData) return;
    try {
      const mealToLog = {
        mealImage: productData.productImage,
        totalCalories: productData.calories,
        foodItems: [{
          name: productData.productName,
          calories: productData.calories,
          image: productData.productImage,
          protein: productData.protein,
          carbs: productData.carbs,
          fat: productData.fat
        }],
        alreadySaved: true
      };
      await logMeal(user.id, mealToLog);
      addNotification('success', `${productData.productName} logged to your diary!`);
      // toast.success("Product logged!"); // Removing separate toast
      setShowProductDetails(false);
      queryClient.invalidateQueries({ queryKey: ['daily-progress', user.id, today] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary', user.id, today] });
      queryClient.invalidateQueries({ queryKey: ['onboarding', user.id] });
    } catch (err: any) {
      toast.error(`Failed to log product: ${err.message}`);
    }
  };

  const closeScanner = () => {
    setShowScannerModal(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    try {
      const promise = uploadAvatar(user.id, file);
      toast.promise(promise, {
        loading: 'Uploading avatar...',
        success: 'Avatar updated successfully!',
        error: 'Failed to upload avatar'
      });
      await promise;
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    } catch (err: any) {
      console.error(err);
    }
  };

  if (authLoading || profile === undefined) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-[#0d1418] p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('welcome_title')}</h1>
        <p className="mb-8 text-slate-600 dark:text-slate-400">Please sign in to view your dashboard.</p>
        <Link href="/auth" className="px-6 py-3 bg-vic-deep-blue text-white rounded-lg font-bold">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-auto min-h-screen w-full max-w-md flex-col bg-background-light dark:bg-[#0d1418] overflow-x-hidden font-display">
      {/* Modals */}
      <div className={`modal-overlay !bg-black ${showCameraModal ? "active" : ""}`}>
        <div className="modal-content !p-0 bg-black w-screen h-[100dvh] flex flex-col overflow-hidden">
          <div className="relative w-full h-full bg-black overflow-hidden">
            <video
              ref={cameraVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'contrast(1.1) brightness(1.1) saturate(1.2) sharpness(1.1)' } as any}
              autoPlay
              playsInline
            />

            {/* Immersive Scan Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/5" />

            {/* Top Glass Header */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
              <button
                onClick={closeCamera}
                className="size-10 rounded-full bg-black/20 backdrop-blur-2xl text-white flex items-center justify-center border border-white/10 hover:bg-black/40 transition-all active:scale-90"
              >
                <X size={20} />
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={switchCamera}
                  className="size-10 rounded-full bg-black/20 backdrop-blur-2xl text-white flex items-center justify-center border border-white/10 hover:bg-black/40 transition-all active:scale-90"
                >
                  <SwitchCamera size={20} />
                </button>
              </div>
            </div>

            {/* Bottom Perception Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-10 pb-16 flex flex-col items-center gap-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">


              <div className="flex items-center justify-center w-full max-w-md gap-8">
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="size-14 rounded-full bg-white/5 backdrop-blur-2xl text-white flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all active:scale-90 shadow-2xl"
                >
                  <Images size={24} />
                </button>

                <button
                  onClick={capturePhoto}
                  disabled={isAnalyzing}
                  className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white flex items-center justify-center active:scale-90 transition-all shadow-2xl"
                >
                  <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center">
                    {isAnalyzing && <RefreshCw className="text-vic-green animate-spin" size={28} />}
                  </div>
                </button>

                <div className="size-14 invisible" /> {/* Spacer */}
              </div>
              
            </div>

            <input
              type="file"
              ref={galleryInputRef}
              onChange={handleGalleryUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {showScannerModal && (
        <QRScanner
          isAnalyzing={isAnalyzing}
          onScan={handleBarcodeScan}
          onManualCapture={handleQRManualCapture}
          onClose={closeScanner}
        />
      )}

      {showMealAnalysis && analysisData && (
        <MealAnalysis
          mealImage={analysisData.mealImage}
          totalCalories={analysisData.totalCalories}
          dailyCalorieGoal={onboarding?.daily_calorie_goal}
          foodItems={analysisData.foodItems}
          onClose={() => setShowMealAnalysis(false)}
          onLog={handleLogMeal}
        />
      )}

      {showProductDetails && productData && (
        <ProductDetails
          {...productData}
          onClose={() => setShowProductDetails(false)}
          onAddToDiary={handleLogProduct}
        />
      )}

      <header className="flex items-center bg-background-light dark:bg-[#0d1418] p-4 pb-2 justify-between sticky top-0 z-10">
        <Link href="/settings" className="relative group block">
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border-[1.5px] border-vic-green/40 shadow-sm transition-transform group-hover:scale-105"
            style={{ backgroundImage: `url("${(profile as any)?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent((profile as any)?.full_name || user.user_metadata?.full_name || 'User')}&background=13ec37&color=fff&size=128`}")` }}
          />
          {countryFlag && (
            <div 
              className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full overflow-hidden border-2 border-background-light dark:border-[#0d1418] shadow-[0_2px_6px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_6px_rgba(255,255,255,0.08)] group-hover:shadow-[0_0_8px_rgba(19,236,55,0.3)] transition-all bg-slate-100 dark:bg-slate-800 flex items-center justify-center z-10"
              title={`${country} • ${lang.toUpperCase()}`}
            >
              <img src={countryFlag} alt={country} className="w-full h-full object-cover" />
            </div>
          )}
        </Link>
        <button onClick={toggleTheme} className="text-[#111812] dark:text-white p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          {darkMode ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </header>

      <div className="flex items-center gap-4 px-4 pt-4">
        <div className="flex flex-col">
          <h1 className="text-[#111812] dark:text-white tracking-light text-[32px] font-bold leading-tight">
            {t('welcome')}, {(profile as any)?.full_name || user.user_metadata?.full_name || user.user_metadata?.first_name || "User"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-base">{t('ready_journey')}</p>
        </div>
      </div>

      <SpiritualReminder userId={user.id} />

      <ProgressCard
        profile={profile}
        dailyProgress={dailyProgress}
        user={user}
        onAvatarUpload={handleAvatarUpload}
      />

      <div className="grid grid-cols-4 gap-3 px-4 py-6">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={openCamera}
            className="aspect-square w-full rounded-2xl bg-[#D1F7C4] dark:bg-[#1a2e21] flex items-center justify-center transition-all hover:brightness-95 active:scale-95 border-none shadow-none overflow-hidden relative group touch-manipulation cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 dark:group-hover:opacity-20 transition-opacity pointer-events-none" />
            <CustomAnimatedIcon
              src="/cute-camera.gif"
              size={120}
              className="w-[110%] h-[110%] pointer-events-none"
              loop={typeof window !== 'undefined' && window.innerWidth < 768}
            />
          </button>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter pointer-events-none">{t('camera')}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={openScanner}
            className="aspect-square w-full rounded-2xl bg-[#D1F7C4] dark:bg-[#1a2e21] flex items-center justify-center transition-all hover:brightness-95 active:scale-95 border-none shadow-none overflow-hidden relative group touch-manipulation cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 dark:group-hover:opacity-20 transition-opacity pointer-events-none" />
            <CustomAnimatedIcon
              src="/scan.gif"
              size={120}
              className="w-[110%] h-[110%] pointer-events-none"
              loop={typeof window !== 'undefined' && window.innerWidth < 768}
            />
          </button>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter pointer-events-none">{t('scanner')}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Link
            href="/cookbook?tab=suggested"
            className="aspect-square w-full rounded-2xl bg-[#D1F7C4] dark:bg-[#1a2e21] flex items-center justify-center transition-all hover:brightness-95 active:scale-95 border-none shadow-none overflow-hidden relative group touch-manipulation cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 dark:group-hover:opacity-20 transition-opacity pointer-events-none" />
            <CustomAnimatedIcon
              src="/chef.gif"
              size={120}
              className="w-[110%] h-[110%] pointer-events-none"
              loop={typeof window !== 'undefined' && window.innerWidth < 768}
            />
          </Link>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter pointer-events-none">{t('cook')}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Link
            href="/budget"
            className="aspect-square w-full rounded-2xl bg-[#D1F7C4] dark:bg-[#1a2e21] flex items-center justify-center transition-all hover:brightness-95 active:scale-95 border-none shadow-none overflow-hidden relative group touch-manipulation cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 dark:group-hover:opacity-20 transition-opacity pointer-events-none" />
            <CustomAnimatedIcon
              src="/money-bag.gif"
              size={120}
              className="w-[110%] h-[110%] pointer-events-none"
              loop={typeof window !== 'undefined' && window.innerWidth < 768}
            />
          </Link>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter pointer-events-none">{t('budget')}</span>
        </div>
      </div>

      <CheckpointCalendar
        joinDate={user?.created_at || new Date()}
        onEditProgress={(date) => {
          setSelectedProgressDate(date);
          setShowProgressInput(true);
        }}
      />

      {showProgressInput && (
        <ManualProgressInput
          initialDate={selectedProgressDate}
          onClose={() => setShowProgressInput(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['daily-progress', user.id] })}
        />
      )}

      <div className="mt-4 pb-4">
        <FoodCarousel
          breakfastMeals={suggestions?.breakfast || []}
          lunchMeals={suggestions?.lunch || []}
          dinnerMeals={suggestions?.dinner || []}
          initialMealType={activeMealType}
          strictMode={false}
        />
      </div>
    </div>
  );
}
