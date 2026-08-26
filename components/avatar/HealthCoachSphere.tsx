"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

export type AvatarState = "idle" | "listening" | "transcribing" | "thinking" | "researching" | "speaking";

interface HealthCoachSphereProps {
  state: AvatarState;
  intent?: string;
  audioLevel?: number;
  className?: string;
  size?: number;
}

export default function HealthCoachSphere({
  state,
  intent,
  audioLevel = 0,
  className = "",
  size = 240,
}: HealthCoachSphereProps) {
  // Dynamic color palette based on state and intent
  const theme = useMemo(() => {
    if (state === "thinking" || state === "transcribing") {
      return {
        coreGrad1: "#8b5cf6",
        coreGrad2: "#ec4899",
        coreGrad3: "#6366f1",
        glow: "rgba(139, 92, 246, 0.5)",
        outerGlow: "rgba(236, 72, 153, 0.3)",
        speed: 1.2,
      };
    }
    if (state === "speaking") {
      return {
        coreGrad1: "#10b981",
        coreGrad2: "#06b6d4",
        coreGrad3: "#34d399",
        glow: "rgba(16, 185, 129, 0.6)",
        outerGlow: "rgba(6, 182, 212, 0.4)",
        speed: 1.5,
      };
    }
    if (state === "listening") {
      return {
        coreGrad1: "#06b6d4",
        coreGrad2: "#14b8a6",
        coreGrad3: "#3b82f6",
        glow: "rgba(6, 182, 212, 0.55)",
        outerGlow: "rgba(20, 184, 166, 0.35)",
        speed: 2.0,
      };
    }
    if (state === "researching" || intent === "factual_research") {
      return {
        coreGrad1: "#06b6d4",
        coreGrad2: "#3b82f6",
        coreGrad3: "#0284c7",
        glow: "rgba(6, 182, 212, 0.6)",
        outerGlow: "rgba(59, 130, 246, 0.4)",
        speed: 1.8,
      };
    }
    // Idle state
    return {
      coreGrad1: "#059669",
      coreGrad2: "#10b981",
      coreGrad3: "#0d9488",
      glow: "rgba(16, 185, 129, 0.4)",
      outerGlow: "rgba(13, 148, 136, 0.25)",
      speed: 3.5,
    };
  }, [state, intent]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Layer 1: Ambient Diffuse Outer Glow */}
      <motion.div
        animate={{
          scale: state === "speaking" ? [1.1, 1.35, 1.1] : state === "thinking" ? [1.1, 1.25, 1.1] : [1, 1.15, 1],
          opacity: state === "speaking" ? [0.6, 0.85, 0.6] : [0.35, 0.6, 0.35],
        }}
        transition={{ repeat: Infinity, duration: 2.5 / theme.speed, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        style={{ background: theme.outerGlow }}
      />

      {/* Layer 2: Secondary Aura Ring with Counter-Rotation */}
      <motion.div
        animate={{
          borderRadius: [
            "40% 60% 60% 40% / 60% 30% 70% 40%",
            "60% 40% 30% 70% / 40% 70% 60% 30%",
            "40% 60% 60% 40% / 60% 30% 70% 40%",
          ],
          rotate: [360, 180, 0],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          borderRadius: { repeat: Infinity, duration: 8 / theme.speed, ease: "easeInOut" },
          rotate: { repeat: Infinity, duration: 20 / theme.speed, ease: "linear" },
          scale: { repeat: Infinity, duration: 3 / theme.speed, ease: "easeInOut" },
        }}
        className="absolute inset-2 blur-md opacity-70 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${theme.coreGrad2}, ${theme.coreGrad3})`,
        }}
      />

      {/* Layer 3: Main 3D Morphing Organic Blob Core */}
      <motion.div
        animate={{
          borderRadius: [
            "60% 40% 30% 70% / 60% 30% 70% 40%",
            "30% 60% 70% 40% / 50% 60% 30% 60%",
            "60% 40% 60% 40% / 70% 30% 50% 60%",
            "40% 60% 30% 70% / 40% 70% 60% 30%",
            "60% 40% 30% 70% / 60% 30% 70% 40%",
          ],
          rotate: [0, 90, 180, 270, 360],
          scale: state === "speaking" 
            ? [1, 1.08 + audioLevel * 0.15, 0.98, 1.05 + audioLevel * 0.12, 1] 
            : state === "listening" 
            ? [1, 1.04, 0.98, 1.03, 1]
            : state === "thinking"
            ? [1, 1.06, 0.95, 1.04, 1]
            : [1, 1.02, 0.99, 1.01, 1],
        }}
        transition={{
          borderRadius: { repeat: Infinity, duration: 6 / theme.speed, ease: "easeInOut" },
          rotate: { repeat: Infinity, duration: 18 / theme.speed, ease: "linear" },
          scale: { repeat: Infinity, duration: 2.2 / theme.speed, ease: "easeInOut" },
        }}
        className="relative w-4/5 h-4/5 shadow-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${theme.coreGrad3} 0%, ${theme.coreGrad1} 55%, ${theme.coreGrad2} 100%)`,
          boxShadow: `0 0 40px ${theme.glow}, inset 0 0 30px rgba(255, 255, 255, 0.25)`,
        }}
      >
        {/* Layer 4: Specular Light Glint for 3D Depth */}
        <motion.div
          animate={{
            x: [-6, 8, -6],
            y: [-8, 6, -8],
            opacity: [0.7, 0.95, 0.7],
          }}
          transition={{ repeat: Infinity, duration: 4 / theme.speed, ease: "easeInOut" }}
          className="absolute top-[20%] left-[25%] w-12 h-8 rounded-full bg-white/40 blur-sm pointer-events-none"
          style={{ transform: "rotate(-30deg)" }}
        />

        {/* Layer 5: Secondary Micro Glint */}
        <div className="absolute top-[22%] left-[28%] w-3 h-3 rounded-full bg-white/80 blur-[1px] pointer-events-none" />

        {/* Layer 6: Neural Core Pulse when Thinking / Speaking */}
        {(state === "thinking" || state === "speaking") && (
          <motion.div
            animate={{
              scale: [0.6, 1.1, 0.6],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{ repeat: Infinity, duration: 1.2 / theme.speed, ease: "easeInOut" }}
            className="w-1/2 h-1/2 rounded-full bg-white/20 blur-md pointer-events-none"
          />
        )}
      </motion.div>
    </div>
  );
}
