"use client"
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { saveOnboardingResponses, getUserProfile } from "@/lib/api/auth";
import { useCurrency } from "@/lib/CurrencyContext";
import { toast } from "sonner";
import { useTranslation } from "@/lib/api/translation";
import { Plus, Minus, Moon, Wallet, Sparkles } from "lucide-react";

interface Question {
  id: number;
  key: string;
  title: string;
  type:
  | "text"
  | "age"
  | "gender"
  | "height"
  | "weight"
  | "radio"
  | "checkbox"
  | "slider"
  | "range";
  imageAnimation: "left" | "right" | "bottom" | "top";
  imageSrc: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export default function Onboarding() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { currencySymbol, exchangeRate, formatCurrency, formatNumber } = useCurrency();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<any>({});

  const questions: Question[] = useMemo(() => [
    {
      id: 0,
      key: "full_name",
      title: t('whats_your_name'),
      type: "text",
      imageAnimation: "left",
      imageSrc: "/what is your name.jpg",
    },
    {
      id: 1,
      key: "age",
      title: t('how_old'),
      type: "age",
      imageAnimation: "left",
      imageSrc: "/how old are you.jpg",
    },
    {
      id: 2,
      key: "gender",
      title: t('whats_gender'),
      type: "gender",
      imageAnimation: "right",
      imageSrc: "/gender.jpg",
      options: [t('male'), t('female')],
    },
    {
      id: 3,
      key: "height_cm",
      title: t('whats_height'),
      type: "height",
      imageAnimation: "bottom",
      imageSrc: "/height.jpg",
      min: 140,
      max: 220,
      unit: "cm",
    },
    {
      id: 4,
      key: "weight_kg",
      title: t('whats_weight'),
      type: "weight",
      imageAnimation: "top",
      imageSrc: "/what is your weight.jpg",
      min: 30,
      max: 150,
      unit: "kg",
    },
    {
      id: 5,
      key: "goal",
      title: t('primary_goal'),
      type: "radio",
      imageAnimation: "left",
      imageSrc: "/what is your primary goal.jpg",
      options: [t('lose_weight_opt'), t('maintain_weight_opt'), t('gain_weight_opt')],
    },
    {
      id: 6,
      key: "activity_level",
      title: t('activity_level_q'),
      type: "radio",
      imageAnimation: "top",
      imageSrc: "/Activity Level.jpg",
      options: [
        t('sedentary'),
        t('lightly_active'),
        t('moderately_active'),
        t('very_active'),
        t('extra_active')
      ],
    },
    {
      id: 7,
      key: "sleep_duration",
      title: t('sleep_duration_q'),
      type: "slider",
      imageAnimation: "right",
      imageSrc: "/Sleep duration.jpg",
      min: 4,
      max: 12,
      step: 0.5,
      unit: t('hours'),
    },
    {
      id: 8,
      key: "sleep_quality",
      title: t('sleep_quality_q'),
      type: "radio",
      imageAnimation: "bottom",
      imageSrc: "/Rate your sleep quality.jpg",
      options: [t('poor'), t('fair'), t('good'), t('excellent')],
    },
    {
      id: 9,
      key: "stress_level",
      title: t('stress_level_q'),
      type: "radio",
      imageAnimation: "top",
      imageSrc: "/Daily stress level.jpg",
      options: [t('low'), t('moderate'), t('high'), t('very_high')],
    },
    {
      id: 10,
      key: "dietary_preference",
      title: t('dietary_preference_q'),
      type: "radio",
      imageAnimation: "left",
      imageSrc: "/Dietary Preference.jpg",
      options: [t('vegan'), t('keto'), t('low_carb'), t('high_protein'), t('none')],
    },
    {
      id: 11,
      key: "dietary_lifestyle",
      title: t('dietary_lifestyle_q'),
      type: "checkbox",
      imageAnimation: "right",
      imageSrc: "/Specific dietary lifestyle.jpg",
      options: [
        t('halal'),
        t('vegetarian'),
        t('vegan'),
        t('balanced'),
        t('none'),
      ],
    },
    {
      id: 12,
      key: "medical_conditions",
      title: t('health_conditions_q'),
      type: "text",
      imageAnimation: "bottom",
      imageSrc: "/Any medical conditions.jpg",
    },
    {
      id: 13,
      key: "allergies",
      title: t('allergies_q'),
      type: "text",
      imageAnimation: "top",
      imageSrc: "/Any food allergies.jpg",
    },
    {
      id: 14,
      key: "meal_prep_time",
      title: t('meal_prep_time'),
      type: "radio",
      imageAnimation: "left",
      imageSrc: "/Preparation Time.jpg",
      options: [
        t('less_15m'),
        t('15_30m'),
        t('30_60m'),
        t('1h_plus'),
      ],
    },
    {
      id: 15,
      key: "cooking_skill",
      title: t('cooking_skill'),
      type: "radio",
      imageAnimation: "right",
      imageSrc: "/Cooking Skill.jpg",
      options: [t('beginner'), t('intermediate'), t('advanced')],
    },
    {
      id: 16,
      key: "weekly_budget",
      title: t('weekly_budget_q'),
      type: "slider",
      imageAnimation: "bottom",
      imageSrc: "/Weekly Budget.jpg",
      min: Math.round((20 * exchangeRate) / 10) * 10,
      max: Math.round((500 * exchangeRate) / 10) * 10,
      step: Math.round((10 * exchangeRate) / 10) * 10 || 10,
      unit: currencySymbol,
    },
    {
      id: 17,
      key: "daily_reminders",
      title: t('daily_reminders_q'),
      type: "radio",
      imageAnimation: "top",
      imageSrc: "/Daily Reminders.jpg",
      options: [t('yes'), t('no')],
    },
  ], [t, currencySymbol, exchangeRate]);

  // Pre-load all onboarding images
  useEffect(() => {
    questions.forEach((q) => {
      const img = new Image();
      img.src = q.imageSrc;
    });
  }, [questions]);

  const [syncAttempted, setSyncAttempted] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/auth");
      } else {
        // Check if profile exists, and sync if not
        getUserProfile(user.id).then(profile => {
          if (profile) {
            if (profile.onboarding_completed) {
              router.push("/dashboard");
            }
          } else if (!syncAttempted) {
            // Profile missing and no sync attempted yet!
            setSyncAttempted(true);
            console.warn("Profile missing in Onboarding, triggering initial sync...");
            import("../../lib/api/auth").then(({ syncUserWithSupabase }) => {
              syncUserWithSupabase(user).then(() => {
                // Refresh query after sync
                queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
              }).catch(err => {
                console.error("Critical: Failed to sync profile during onboarding recovery:", err);
                if (err?.code === '42883' || err?.code === '42501' || String(err).includes('operator does not exist')) {
                  setSyncFailed(true);
                  return;
                }
                toast.error(t('failed_init_profile'));
              });
            });
          }
        }).catch(err => {
            console.error("Profile fetch error in onboarding:", err);
            if (err?.code === '42883' || String(err).includes('operator does not exist')) {
                setSyncFailed(true);
            }
        });
      }
    }
  }, [authLoading, user, router, syncAttempted, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Round all numbers to integers to prevent PostgreSQL 'invalid input syntax for type integer' crashes
      const payload = { ...data };
      for (const key in payload) {
        if (typeof payload[key] === 'number') {
           payload[key] = Math.round(payload[key]);
        }
      }

      // One last check for profile before saving to avoid foreign key violation
      const profile = await getUserProfile(user!.id);
      if (!profile) {
        const { syncUserWithSupabase } = await import("../../lib/api/auth");
        await syncUserWithSupabase(user);
      }
      return saveOnboardingResponses(user!.id, payload);
    },
    onSuccess: () => {
      router.push("/dashboard");
    },
    onError: (error: any) => {
      console.error("Onboarding Save Error:", error);
      toast.error(t('failed_save_onboarding').replace('%s', error.message || 'Check console for details'));
    }
  });

  const currentQuestion = questions[currentStep];
  const progressPercent = ((currentStep + 1) / questions.length) * 100;

  const animationClass = useMemo(() => {
    switch (currentQuestion.imageAnimation) {
      case "left": return "animate-slide-in-left";
      case "right": return "animate-slide-in-right";
      case "bottom": return "animate-slide-in-bottom";
      case "top": return "animate-slide-in-top";
      default: return "animate-slide-in-left";
    }
  }, [currentQuestion.imageAnimation]);

  const textAnimationClass = useMemo(() => {
    switch (currentQuestion.imageAnimation) {
      case "left": return "animate-slide-in-left";
      case "right": return "animate-slide-in-right";
      case "bottom": return "animate-slide-in-bottom";
      case "top": return "animate-slide-in-top";
      default: return "animate-slide-in-left";
    }
  }, [currentQuestion.imageAnimation]);

  const handleContinue = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      console.log("Submitting Onboarding Responses:", responses);
      saveMutation.mutate(responses);
    }
  };

  const updateResponse = (key: string, value: any) => {
    setResponses((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (syncFailed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white text-center px-4">
        <h2 className="text-2xl font-bold text-red-600 mb-4">{t('profile_setup_failed')}</h2>
        <p className="text-gray-600 mb-6">{t('db_error_onboarding')}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-vic-blue text-white rounded-lg font-bold hover:bg-vic-blue/90 transition-colors">
          {t('reload_page')}
        </button>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1418]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vic-green"></div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col font-display overflow-x-hidden">
      {/* Full screen background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-vic-green-start to-vic-green-end -z-10" />
      {/* Progress Bar */}
      <div className="w-full px-6 pt-4 sticky top-0 z-20 bg-gradient-to-b from-vic-green-start to-vic-green-end">
        <div className="flex justify-between items-center mb-2">
          <span className="text-vic-blue text-sm font-medium">
            {t('step_of').replace('%s', (currentStep + 1).toString()).replace('%s', questions.length.toString())}
          </span>
          <button
            onClick={handleBack}
            className={`text-vic-blue text-sm font-medium underline transition-all duration-300 ${currentStep === 0
              ? "opacity-0 pointer-events-none"
              : "opacity-100"
              }`}
          >
            {t('back')}
          </button>
        </div>
        <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
          <div
            className="bg-vic-blue h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Content */}
      <div className="flex flex-col flex-1">
        {/* Image Section */}
        <div className="relative w-full flex-shrink-0 flex justify-center">
          <div
            className={`${animationClass} w-full max-w-5xl bg-center bg-no-repeat bg-cover h-[45vh] md:h-[55vh] lg:h-[65vh] transition-all duration-700`}
            style={{ backgroundImage: `url("${currentQuestion.imageSrc}")` }}
          >
            <div className="absolute inset-0 image-fade-overlay" />
          </div>

          {/* Wave divider */}
          <div className="absolute bottom-0 left-0 w-full z-10 -mb-px">
            <svg
              className="w-full h-auto"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 1440 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                className="fill-vic-green-start"
                d="M0 50C120 10 240 10 360 50C480 90 600 90 720 50C840 10 960 10 1080 50C1200 90 1320 90 1440 50V100H0V50Z"
              />
            </svg>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex flex-col flex-1 px-8 pt-10 pb-12 md:pb-16 max-w-2xl mx-auto w-full">
          <h1 className={`${textAnimationClass} text-vic-blue tracking-tight text-3xl sm:text-4xl font-bold leading-tight text-center pb-10 sm:pb-14`}>
            {currentQuestion.title}
          </h1>

          {/* Input section */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {currentQuestion.type === "text" && (
              <div className="w-full max-w-md px-4">
                <input
                  type="text"
                  value={responses[currentQuestion.key] || ""}
                  onChange={(e) => updateResponse(currentQuestion.key, e.target.value)}
                  placeholder={
                    currentQuestion.key === "full_name" ? t('enter_name') :
                    currentQuestion.key === "medical_conditions" ? t('health_conditions_placeholder') :
                    currentQuestion.key === "allergies" ? t('allergies_placeholder') :
                    t('enter_name')
                  }
                  className="w-full h-16 px-6 rounded-2xl border-2 border-vic-blue/15 focus:border-vic-blue focus:ring-4 focus:ring-vic-blue/5 focus:outline-none text-vic-blue text-xl font-medium bg-white/90 backdrop-blur-sm shadow-sm transition-all text-center"
                  autoFocus
                />
              </div>
            )}
            {currentQuestion.type === "age" && (
              <AgeSelector
                value={responses[currentQuestion.key]}
                yearsLabel={t('years')}
                onChange={(val) => updateResponse(currentQuestion.key, val)}
              />
            )}
            {currentQuestion.type === "gender" && (
              <RadioOptions options={currentQuestion.options || []} value={responses[currentQuestion.key]} onChange={(val) => { updateResponse(currentQuestion.key, val); setTimeout(handleContinue, 400); }} />
            )}
            {currentQuestion.type === "height" && (
              <NumberSlider
                label={t('whats_height')}
                min={currentQuestion.min || 140}
                max={currentQuestion.max || 220}
                unit={currentQuestion.unit}
                value={responses[currentQuestion.key]}
                onChange={(val) => updateResponse(currentQuestion.key, val)}
              />
            )}
            {currentQuestion.type === "weight" && (
              <NumberSlider
                label={t('whats_weight')}
                min={currentQuestion.min || 30}
                max={currentQuestion.max || 150}
                unit={currentQuestion.unit}
                value={responses[currentQuestion.key]}
                onChange={(val) => updateResponse(currentQuestion.key, val)}
              />
            )}
            {currentQuestion.type === "radio" && (
              <RadioOptions options={currentQuestion.options || []} value={responses[currentQuestion.key]} onChange={(val) => { updateResponse(currentQuestion.key, val); setTimeout(handleContinue, 400); }} />
            )}
            {currentQuestion.type === "checkbox" && (
              <CheckboxOptions options={currentQuestion.options || []} value={responses[currentQuestion.key]} onChange={(val) => updateResponse(currentQuestion.key, val)} />
            )}
            {currentQuestion.type === "slider" && (
              <SliderInput
                label={currentQuestion.title}
                min={currentQuestion.min || 50}
                max={currentQuestion.max || 1000}
                step={currentQuestion.step || 1}
                unit={currentQuestion.unit}
                isCurrency={currentQuestion.key === "weekly_budget"}
                formatCurrency={formatCurrency}
                formatNumber={formatNumber}
                value={responses[currentQuestion.key]}
                onChange={(val) => updateResponse(currentQuestion.key, val)}
              />
            )}
            {currentQuestion.type === "range" && (
              <RangeSlider
                label={t('weight_change_target')}
                min={currentQuestion.min || -5}
                max={currentQuestion.max || 5}
                step={currentQuestion.step || 0.5}
                unit={currentQuestion.unit}
                value={responses[currentQuestion.key]}
                t={t}
                onChange={(val) => updateResponse(currentQuestion.key, val)}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-12 sm:mt-16 space-y-6 flex flex-col items-center w-full">
            {/* Hide Continue button for auto-advancing types */}
            {!['radio', 'gender'].includes(currentQuestion.type) && (
              <button
                onClick={handleContinue}
                disabled={saveMutation.isPending}
                className="continue-btn flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-16 px-8 w-full max-w-md bg-white text-vic-blue text-lg font-bold leading-normal tracking-[0.015em] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:translate-y-0.5 disabled:opacity-50 mx-auto"
              >
                <span className="truncate">
                  {saveMutation.isPending ? "..." : currentStep === questions.length - 1 ? t('finish') : t('continue')}
                </span>
              </button>
            )}
            <p
              onClick={handleContinue}
              className="skip-btn text-vic-blue/60 text-sm font-semibold leading-normal text-center underline decoration-2 underline-offset-4 cursor-pointer hover:text-vic-blue transition-colors mx-auto py-2"
            >
              {t('skip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgeSelector({ value, yearsLabel, onChange }: { value?: number, yearsLabel: string, onChange: (val: number) => void }) {
  const age = value !== undefined ? value : 25;

  useEffect(() => {
    if (value === undefined) {
      onChange(25);
    }
  }, [value, onChange]);

  const pct = Math.max(0, Math.min(100, ((age - 18) / (90 - 18)) * 100));

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm space-y-6 select-none touch-manipulation">
      {/* High-visibility Age Display */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border-2 border-vic-blue/10 w-full text-center">
        <span className="text-xs uppercase tracking-widest text-vic-blue/60 font-black block mb-1">Selected Age</span>
        <div className="text-vic-blue text-5xl font-black flex items-baseline justify-center gap-2">
          {age}
          <span className="text-xl font-bold text-vic-blue/70">{yearsLabel}</span>
        </div>
      </div>

      {/* Slider Control with Non-Interactive Visual Direction Guides */}
      <div className="flex items-center gap-3 w-full px-2">
        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Minus size={20} />
        </div>

        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={18}
            max={90}
            step={1}
            value={age}
            onChange={(e) => onChange(Number(e.target.value))}
            className="onboarding-slider w-full"
            style={{
              background: `linear-gradient(to right, #0B3C7C ${pct}%, rgba(255,255,255,0.7) ${pct}%)`
            }}
          />
        </div>

        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Plus size={20} />
        </div>
      </div>
    </div>
  );
}

function RadioOptions({ options, value, onChange }: { options: string[], value?: string, onChange: (val: string) => void }) {
  return (
    <div className="flex flex-col space-y-3 w-full max-w-sm mb-6 select-none touch-manipulation">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex cursor-pointer h-16 w-full items-center justify-between overflow-hidden rounded-2xl px-6 py-3 transition-all active:scale-[0.98] ${
            value === option
              ? "bg-vic-blue text-white shadow-xl ring-2 ring-white/50 scale-[1.02]"
              : "bg-white/90 backdrop-blur-sm text-vic-blue shadow-md hover:bg-white hover:shadow-lg"
          } text-base font-bold`}
        >
          <span className="truncate">{option}</span>
          <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${
            value === option ? "border-white bg-vic-green" : "border-vic-blue/30 bg-transparent"
          }`}>
            {value === option && <div className="size-2.5 rounded-full bg-vic-blue" />}
          </div>
        </button>
      ))}
    </div>
  );
}

function CheckboxOptions({ options, value, onChange }: { options: string[], value?: string[], onChange: (val: string[]) => void }) {
  const isLargeList = options.length > 5;
  const selected = value || [];

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(o => o !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div
      className={`${isLargeList ? "grid grid-cols-2 gap-3" : "flex flex-col space-y-3"
        } w-full max-w-sm mb-6 select-none touch-manipulation`}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`flex cursor-pointer ${isLargeList ? "h-14 px-4" : "h-16 px-6"} w-full items-center justify-between overflow-hidden rounded-2xl transition-all active:scale-[0.98] ${
              isSelected
                ? "bg-vic-blue text-white shadow-xl ring-2 ring-white/50 scale-[1.02]"
                : "bg-white/90 backdrop-blur-sm text-vic-blue shadow-md hover:bg-white hover:shadow-lg"
            } text-sm font-bold`}
          >
            <span className="truncate">{option}</span>
            <div className={`size-5 rounded-lg border-2 flex items-center justify-center transition-all ${
              isSelected ? "border-white bg-vic-green" : "border-vic-blue/30 bg-transparent"
            }`}>
              {isSelected && <div className="size-2 rounded-sm bg-vic-blue" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function NumberSlider({
  label,
  min,
  max,
  unit: defaultUnit,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  unit?: string;
  value?: number;
  onChange: (val: number) => void;
}) {
  const [unit, setUnit] = useState(defaultUnit || "kg");
  const isWeight = defaultUnit === "kg";
  const isHeight = defaultUnit === "cm";

  const rawValue = value !== undefined ? value : (min + max) / 2;

  useEffect(() => {
    if (value === undefined) {
      onChange((min + max) / 2);
    }
  }, [value, min, max, onChange]);

  const displayValue = useMemo(() => {
    if (unit === "lbs" && isWeight) return Math.round(rawValue * 2.20462);
    if (unit === "inches" && isHeight) return Math.round(rawValue / 2.54);
    return Math.round(rawValue);
  }, [rawValue, unit, isWeight, isHeight]);

  const pct = Math.max(0, Math.min(100, ((rawValue - min) / (max - min)) * 100));

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm space-y-6 select-none touch-manipulation">
      {/* Unit Toggle & Display Card */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border-2 border-vic-blue/10 w-full relative">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs uppercase tracking-widest text-vic-blue/60 font-black">Value</span>
          {/* Unit Toggle */}
          <div className="flex bg-vic-blue/10 p-1 rounded-xl">
            {isWeight && (
              <>
                <button
                  type="button"
                  onClick={() => setUnit("kg")}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${unit === "kg" ? "bg-vic-blue text-white shadow-md" : "text-vic-blue"}`}
                >
                  KG
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("lbs")}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${unit === "lbs" ? "bg-vic-blue text-white shadow-md" : "text-vic-blue"}`}
                >
                  LBS
                </button>
              </>
            )}
            {isHeight && (
              <>
                <button
                  type="button"
                  onClick={() => setUnit("cm")}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${unit === "cm" ? "bg-vic-blue text-white shadow-md" : "text-vic-blue"}`}
                >
                  CM
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("inches")}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${unit === "inches" ? "bg-vic-blue text-white shadow-md" : "text-vic-blue"}`}
                >
                  IN
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-vic-blue text-5xl font-black flex items-baseline justify-center gap-2">
          {displayValue}
          <span className="text-xl font-bold text-vic-blue/70">{unit}</span>
        </div>
      </div>

      {/* Slider Control with Non-Interactive Visual Direction Guides */}
      <div className="flex items-center gap-3 w-full px-2">
        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Minus size={20} />
        </div>

        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={rawValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="onboarding-slider w-full"
            style={{
              background: `linear-gradient(to right, #0B3C7C ${pct}%, rgba(255,255,255,0.7) ${pct}%)`
            }}
          />
        </div>

        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Plus size={20} />
        </div>
      </div>
    </div>
  );
}

function SliderInput({
  label,
  min,
  max,
  step = 1,
  unit,
  isCurrency = false,
  formatCurrency,
  formatNumber,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  isCurrency?: boolean;
  formatCurrency?: (val: number | string) => string;
  formatNumber?: (val: number | string) => string;
  value?: number;
  onChange: (val: number) => void;
}) {
  const defaultValue = Math.round(((min + max) / 2) / step) * step;
  const rawValue = value !== undefined ? value : defaultValue;

  useEffect(() => {
    if (value === undefined) {
      onChange(defaultValue);
    }
  }, [value, defaultValue, onChange]);

  const pct = Math.max(0, Math.min(100, ((rawValue - min) / (max - min)) * 100));

  // Formatted display
  const formattedDisplay = isCurrency
    ? (formatCurrency ? formatCurrency(rawValue) : `${unit}${formatNumber ? formatNumber(rawValue) : rawValue}`)
    : `${rawValue} ${unit}`;

  const minFormatted = isCurrency && formatCurrency ? formatCurrency(min) : `${min} ${unit || ''}`;
  const maxFormatted = isCurrency && formatCurrency ? formatCurrency(max) : `${max}+ ${unit || ''}`;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm space-y-6 select-none touch-manipulation">
      {/* Visual Highlight Card with High Contrast Display */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border-2 border-vic-blue/10 w-full text-center relative overflow-hidden">
        {isCurrency && (
          <div className="absolute top-3 right-3 p-2 bg-vic-green/20 rounded-full text-vic-blue">
            <Wallet size={16} />
          </div>
        )}
        {!isCurrency && (
          <div className="absolute top-3 right-3 p-2 bg-vic-blue/10 rounded-full text-vic-blue">
            <Moon size={16} />
          </div>
        )}

        <span className="text-xs uppercase tracking-widest text-vic-blue/60 font-black block mb-1">
          {isCurrency ? "Weekly Budget Target" : "Sleep Duration"}
        </span>

        <div className="text-vic-blue text-4xl sm:text-5xl font-black tracking-tight drop-shadow-sm">
          {formattedDisplay}
        </div>

        {/* Quality status badge for sleep */}
        {!isCurrency && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-vic-blue/10 rounded-full text-xs font-black text-vic-blue">
            <Sparkles size={12} className="text-vic-blue" />
            {rawValue >= 7 && rawValue <= 9 ? "Optimal Sleep Range (7-9h)" : rawValue < 7 ? "Short Sleep (<7h)" : "Extended Sleep (>9h)"}
          </div>
        )}
      </div>

      {/* Slider Control with Non-Interactive Visual Direction Guides */}
      <div className="flex items-center gap-3 w-full px-2">
        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Minus size={20} />
        </div>

        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={rawValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="onboarding-slider w-full"
            style={{
              background: `linear-gradient(to right, #0B3C7C ${pct}%, rgba(255,255,255,0.7) ${pct}%)`
            }}
          />
        </div>

        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Plus size={20} />
        </div>
      </div>

      {/* Min / Max bounds */}
      <div className="flex justify-between text-vic-blue text-xs font-bold w-full px-4 -mt-3">
        <span>Min: {minFormatted}</span>
        <span>Max: {maxFormatted}</span>
      </div>
    </div>
  );
}

function RangeSlider({
  label,
  min,
  max,
  step,
  unit,
  value,
  t,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  value?: number;
  t: any;
  onChange: (val: number) => void;
}) {
  const rawValue = value !== undefined ? value : 0;

  useEffect(() => {
    if (value === undefined) {
      onChange(0);
    }
  }, [value, onChange]);

  const pct = Math.max(0, Math.min(100, ((rawValue - min) / (max - min)) * 100));
  const goalText = rawValue < 0 ? t('lose_weight_opt') : rawValue > 0 ? t('gain_weight_opt') : t('maintain');

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm space-y-6 select-none touch-manipulation">
      {/* High Visibility Card */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border-2 border-vic-blue/10 w-full text-center">
        <span className="text-xs uppercase tracking-widest text-vic-blue/60 font-black block mb-1">Target Change</span>
        <div className="text-vic-blue text-4xl sm:text-5xl font-black flex items-baseline justify-center gap-2">
          {rawValue > 0 ? `+${rawValue}` : rawValue}
          <span className="text-xl font-bold text-vic-blue/70">{unit}</span>
        </div>
        <div className="mt-2 inline-block px-3 py-1 bg-vic-blue/10 rounded-full text-xs font-black text-vic-blue">
          {goalText}
        </div>
      </div>

      {/* Slider with Non-Interactive Visual Direction Guides */}
      <div className="flex items-center gap-3 w-full px-2">
        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Minus size={20} />
        </div>

        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={rawValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="onboarding-slider w-full"
            style={{
              background: `linear-gradient(to right, #0B3C7C ${pct}%, rgba(255,255,255,0.7) ${pct}%)`
            }}
          />
        </div>

        <div
          className="size-11 rounded-2xl bg-white/80 text-vic-blue/60 shadow-sm flex items-center justify-center font-black pointer-events-none select-none shrink-0"
          aria-hidden="true"
        >
          <Plus size={20} />
        </div>
      </div>
    </div>
  );
}
