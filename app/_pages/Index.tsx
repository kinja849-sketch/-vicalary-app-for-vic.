"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/lib/api/translation";

const CinematicText = ({ text, onComplete }: { text: string; onComplete: () => void }) => {
  return (
    <motion.h2 
      className="font-semibold text-gray-900 text-3xl md:text-4xl tracking-tight text-center flex items-center justify-center mt-6 md:mt-8"
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.06,
            delayChildren: 0.4,
          }
        }
      }}
      initial="hidden"
      animate="visible"
      onAnimationComplete={onComplete}
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={index}
          variants={{
            hidden: { opacity: 0, filter: "blur(4px)", y: 2 },
            visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.5, ease: "easeOut" } }
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.h2>
  );
};

const SplashSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [isTypingDone, setIsTypingDone] = useState(false);
  const { t } = useTranslation();

  const handleTypingComplete = () => {
    setIsTypingDone(true);
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0, transition: { duration: 1.2, ease: "easeInOut" } }} 
      transition={{ duration: 0.8 }}
      className="absolute inset-0 w-full h-[100dvh] flex flex-col items-center justify-center bg-[#FDFCFB] z-50 px-6 overflow-hidden"
    >
      <div className="-mt-16 md:-mt-20 flex flex-col items-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ 
            duration: isTypingDone ? 8 : 4, // Heartbeat subtly slows down after typing
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white flex items-center justify-center p-3 md:p-4 border border-black/5"
        >
          <img src="/app logo.png" alt="VICALARY Logo" className="w-full h-full object-contain rounded-full" />
        </motion.div>
        
        <div className="h-16 md:h-20 flex items-center justify-center">
          <CinematicText text={t('welcome_to_vicalary')} onComplete={handleTypingComplete} />
        </div>
      </div>
    </motion.div>
  );
};

export default function Welcome() {
  const [animationPhase, setAnimationPhase] = useState<"idle" | "zooming" | "welcome" | "complete">("idle");
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && user) {
      if (profile && !profile.onboarding_completed) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, profile, loading, router]);

  const handleGetStarted = () => {
    setAnimationPhase("zooming");
    setTimeout(() => setAnimationPhase("welcome"), 500); // reduced from 2500
    // The transition to "/auth" is now handled dynamically by the SplashSequence component
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        body {
          font-family: 'Inter', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        
        .wl-root {
          width: 100%;
          height: 100dvh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background-color: white;
          position: relative;
        }

        .hero-mask {
          mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
        }
      `}</style>

      <div className="wl-root">
        <AnimatePresence>
          {(animationPhase === "idle" || animationPhase === "zooming") && (
            <motion.main 
              className="w-full h-[100dvh] flex flex-col lg:flex-row bg-white overflow-hidden"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* BEGIN: Hero Image Section */}
              <section className="relative w-full lg:w-1/2 flex-1 lg:h-full min-h-[50vh] bg-[#f1ca9e]" data-purpose="hero-section">
                <motion.img 
                  alt="Smiling woman holding a bowl of fresh vegetables" 
                  className="w-full h-full object-cover object-top lg:object-center hero-mask" 
                  src="/landing page.png"
                  initial={{ scale: 1 }}
                  animate={
                    animationPhase === "zooming"
                      ? { scale: 1.05, opacity: 0, transition: { duration: 2.4, ease: "easeInOut" } }
                      : { scale: 1 }
                  }
                  draggable={false}
                />
                {/* Mobile vertical fade */}
                <div className="absolute bottom-0 left-0 w-full h-32 md:h-48 bg-gradient-to-t from-white via-white/50 to-transparent lg:hidden"></div>
                {/* Desktop horizontal fade */}
                <div className="hidden lg:block absolute right-0 top-0 w-32 xl:w-48 h-full bg-gradient-to-l from-white via-white/50 to-transparent"></div>
              </section>
              {/* END: Hero Image Section */}

              {/* BEGIN: Content Section */}
              <motion.section 
                className="flex-none lg:w-1/2 lg:flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-8 md:py-10 lg:py-0 text-center bg-white z-10 relative" 
                data-purpose="onboarding-content"
                animate={
                  animationPhase === "zooming"
                    ? { opacity: 0, y: 10, transition: { duration: 0.5 } }
                    : { opacity: 1, y: 0 }
                }
              >
                <div className="max-w-xs sm:max-w-md md:max-w-2xl space-y-2 md:space-y-4">
                  <h1 className="font-bold tracking-tight text-gray-900 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold">
                    {t('start_your_journey')}
                  </h1>
                  <p className="text-gray-500 font-medium leading-relaxed text-base sm:text-lg md:text-xl lg:text-2xl">
                    {t('welcome_subtitle')}
                  </p>
                </div>
                
                <div className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[380px] mt-8 md:mt-12 lg:mt-14">
                  <button 
                    onClick={handleGetStarted}
                    disabled={animationPhase !== "idle"}
                    aria-label={t('get_started')}
                    className="w-full bg-black text-white py-3.5 sm:py-4 md:py-5 px-6 rounded-full font-semibold text-base sm:text-lg md:text-xl active:scale-95 transition-transform duration-100 shadow-lg" 
                    type="button"
                  >
                    {t('get_started')}
                  </button>
                </div>
                
                {/* Home Indicator (iOS Style) */}
                <div className="mt-8 block sm:hidden">
                  <div className="w-32 h-1.5 bg-gray-200 rounded-full mx-auto"></div>
                </div>
              </motion.section>
              {/* END: Content Section */}
            </motion.main>
          )}
        </AnimatePresence>

        {/* WELCOME SPLASH */}
        <AnimatePresence>
          {animationPhase === "welcome" && (
            <SplashSequence 
              key="splash-sequence"
              onComplete={() => {
                setAnimationPhase("complete");
                router.push("/auth");
              }} 
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
