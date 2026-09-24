"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export type CoachState =
  | "idle"
  | "listening"
  | "thinking"
  | "searching"
  | "preparing"
  | "speaking"
  | "error";

interface HealthCoachAvatarProps {
  state: CoachState;
  micLevel?: number; // 0.0 to 1.0 (microphone input amplitude during listening)
  audioLevel?: number; // 0.0 to 1.0 (output TTS audio amplitude during speaking)
  searchStatus?: string; // Optional search status message
  size?: number; // Avatar diameter in pixels (default 220)
  className?: string;
  onClick?: () => void;
}

interface EyeGazeOffset {
  x: number;
  y: number;
}

// Highly Noticeable, Dramatically Shifted 360° Directional Eye Gaze Offsets
const GAZE_OFFSETS: Record<string, EyeGazeOffset> = {
  center: { x: 10, y: -6 },
  farLeft: { x: -28, y: -6 },
  farRight: { x: 48, y: -6 },
  lookUp: { x: 10, y: -28 },
  lookDown: { x: 10, y: 16 },
  upLeft: { x: -22, y: -24 },
  upRight: { x: 42, y: -24 },
  downLeft: { x: -22, y: 12 },
  downRight: { x: 42, y: 12 },
};

const GAZE_PRESETS = Object.values(GAZE_OFFSETS);

export default function HealthCoachAvatar({
  state,
  micLevel = 0,
  audioLevel = 0,
  searchStatus,
  size = 220,
  className = "",
  onClick,
}: HealthCoachAvatarProps) {
  // Eye Blinking & Winking
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWinking, setIsWinking] = useState(false);

  // Dynamic 360° Unpredictable Eye Gaze Offset
  const [eyeGaze, setEyeGaze] = useState<EyeGazeOffset>(GAZE_OFFSETS.center);

  // Irregular Blinking & Winking Cadence
  useEffect(() => {
    let blinkTimer: NodeJS.Timeout;

    const scheduleBlink = () => {
      const delay = Math.random() * 4000 + 3000;
      blinkTimer = setTimeout(() => {
        const wink = Math.random() < 0.08;
        if (wink) {
          setIsWinking(true);
          setTimeout(() => setIsWinking(false), 220);
        } else {
          setIsBlinking(true);
          setTimeout(() => setIsBlinking(false), 160);
        }
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => clearTimeout(blinkTimer);
  }, []);

  // Unpredictable 360° Eye Gaze Movement Controller (Active Across ALL States including speaking & listening)
  useEffect(() => {
    let gazeTimer: NodeJS.Timeout;

    const scheduleGazeShift = () => {
      // Shift eye direction unpredictably every 1.2s to 3.2s
      const delay = Math.random() * 2000 + 1200;
      gazeTimer = setTimeout(() => {
        // Pick an unpredictable random directional offset from the gaze pool
        const randomIndex = Math.floor(Math.random() * GAZE_PRESETS.length);
        const nextGaze = GAZE_PRESETS[randomIndex];
        setEyeGaze(nextGaze);

        scheduleGazeShift();
      }, delay);
    };

    scheduleGazeShift();
    return () => clearTimeout(gazeTimer);
  }, []); // Run continuously across all states

  const isBouncing = state === "thinking" || state === "searching";
  const isSettling = state === "preparing";

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center select-none cursor-pointer ${className}`}
      style={{ width: size, height: size + 20 }}
    >
      <div className="relative flex items-center justify-center w-full h-full">

        {/* Minimalist Soft Shadow Underneath Avatar */}
        <motion.div
          animate={{
            scaleX: isBouncing ? [0.8, 0.5, 0.8] : [0.75, 0.82, 0.75],
            opacity: isBouncing ? [0.2, 0.06, 0.2] : [0.18, 0.25, 0.18],
          }}
          transition={{ repeat: Infinity, duration: isBouncing ? 0.9 : 3.2, ease: "easeInOut" }}
          className="absolute -bottom-1 w-3/5 h-3 bg-emerald-950/20 rounded-full blur-md pointer-events-none z-0"
        />

        {/* Clean Minimalist Primary Green Sphere */}
        <motion.div
          animate={{
            y: isBouncing
              ? [0, -20, 0]
              : isSettling
              ? [-6, 0]
              : state === "listening"
              ? [0, -2, 0]
              : [-4, 4, -4],
            scaleY: isBouncing
              ? [1, 1.06, 0.94, 1]
              : state === "speaking"
              ? [1, 1.03 + audioLevel * 0.08, 0.99]
              : state === "listening"
              ? [1, 1.02 + micLevel * 0.05, 1]
              : [1, 1.01, 1],
            scaleX: isBouncing
              ? [1, 0.94, 1.06, 1]
              : state === "speaking"
              ? [1, 0.98, 1.02]
              : [1, 0.99, 1],
            rotate: state === "listening" ? micLevel * 4 - 2 : 0,
          }}
          transition={{
            y: { repeat: isBouncing || state === "idle" || state === "listening" ? Infinity : 0, duration: isBouncing ? 0.9 : 3.2, ease: "easeInOut" },
            scaleY: { repeat: Infinity, duration: isBouncing ? 0.9 : 2.4, ease: "easeInOut" },
            scaleX: { repeat: Infinity, duration: isBouncing ? 0.9 : 2.4, ease: "easeInOut" },
            rotate: { duration: 0.2 },
          }}
          className="relative flex items-center justify-center rounded-full z-10 shadow-lg overflow-hidden"
          style={{
            width: size * 0.85,
            height: size * 0.85,
            backgroundColor: "#10b981",
            backgroundImage: "radial-gradient(circle at 35% 30%, #34d399 0%, #10b981 55%, #059669 100%)",
            boxShadow: `0 12px 32px rgba(16, 185, 129, 0.35)`,
          }}
        >
          {/* Solid White Capsule Eyes with Unpredictable, Highly Noticeable Gaze Displacement */}
          <motion.div
            animate={{
              x: eyeGaze.x,
              y: eyeGaze.y,
            }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
            }}
            className="relative flex items-center justify-between z-20 pointer-events-none"
            style={{ width: size * 0.34, height: size * 0.22 }}
          >
            {/* Left Capsule Eye */}
            <motion.div
              animate={{
                scaleY: isBlinking || isWinking ? 0.1 : 1,
                scaleX: state === "listening" ? 1 + micLevel * 0.15 : 1,
              }}
              transition={{ duration: 0.08 }}
              className="rounded-full bg-white shadow-sm pointer-events-none"
              style={{
                width: size * 0.078,
                height: size * 0.165,
                transformOrigin: "center center",
              }}
            />

            {/* Right Capsule Eye */}
            <motion.div
              animate={{
                scaleY: isBlinking && !isWinking ? 0.1 : 1,
                scaleX: state === "listening" ? 1 + micLevel * 0.15 : 1,
              }}
              transition={{ duration: 0.08 }}
              className="rounded-full bg-white shadow-sm pointer-events-none"
              style={{
                width: size * 0.078,
                height: size * 0.165,
                transformOrigin: "center center",
              }}
            />
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
}
