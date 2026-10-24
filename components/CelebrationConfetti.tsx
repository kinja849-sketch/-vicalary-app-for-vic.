"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface CelebrationConfettiProps {
  active: boolean;
  onComplete?: () => void;
  duration?: number;
}

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  tilt: number;
  vTilt: number;
  color: string;
  shape: 'rect' | 'circle' | 'ribbon';
}

const CELEBRATION_COLORS = [
  '#13ec37', // VicCalary Green
  '#22c55e', // Emerald
  '#fbbf24', // Amber / Gold
  '#f59e0b', // Deep Gold
  '#3b82f6', // Bright Blue
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#ffffff'  // Sparkle White
];

export const CelebrationConfetti: React.FC<CelebrationConfettiProps> = ({
  active,
  onComplete,
  duration = 5000
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active || !mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];
    const count = 160;

    // Launch Cannon 1: Left bottom corner shooting upwards-right
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
      const angle = -Math.PI / 3 + (Math.random() - 0.5) * 0.6; // ~60 deg
      const speed = Math.random() * 16 + 14;
      particles.push({
        x: width * 0.05,
        y: height * 0.95,
        w: Math.random() * 8 + 6,
        h: Math.random() * 14 + 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.25,
        tilt: Math.random() * 10,
        vTilt: Math.random() * 0.15 + 0.05,
        color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
        shape: Math.random() > 0.4 ? 'rect' : Math.random() > 0.5 ? 'ribbon' : 'circle'
      });
    }

    // Launch Cannon 2: Right bottom corner shooting upwards-left
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
      const angle = (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.6; // ~120 deg
      const speed = Math.random() * 16 + 14;
      particles.push({
        x: width * 0.95,
        y: height * 0.95,
        w: Math.random() * 8 + 6,
        h: Math.random() * 14 + 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.25,
        tilt: Math.random() * 10,
        vTilt: Math.random() * 0.15 + 0.05,
        color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
        shape: Math.random() > 0.4 ? 'rect' : Math.random() > 0.5 ? 'ribbon' : 'circle'
      });
    }

    // Launch Cannon 3: Mid-air explosion around center
    for (let i = 0; i < Math.floor(count * 0.2); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      particles.push({
        x: width * 0.5 + (Math.random() - 0.5) * 60,
        y: height * 0.35 + (Math.random() - 0.5) * 60,
        w: Math.random() * 8 + 6,
        h: Math.random() * 12 + 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.25,
        tilt: Math.random() * 10,
        vTilt: Math.random() * 0.15 + 0.05,
        color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
        shape: Math.random() > 0.3 ? 'rect' : 'circle'
      });
    }

    let animationFrameId: number;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const opacity = elapsed > duration - 1200 ? Math.max(0, (duration - elapsed) / 1200) : 1;
      ctx.globalAlpha = opacity;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // Realistic gravity
        p.vx *= 0.985; // Air drag
        p.angle += p.vAngle;
        p.tilt += p.vTilt;

        const tiltFactor = Math.sin(p.tilt);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'ribbon') {
          ctx.fillRect(-p.w * 0.5 * tiltFactor, -p.h * 0.5, p.w * tiltFactor, p.h);
        } else {
          ctx.fillRect(-p.w * 0.5, -p.h * 0.5 * tiltFactor, p.w, p.h * Math.abs(tiltFactor));
        }

        ctx.restore();
      }

      ctx.restore();

      if (elapsed < duration) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        if (canvas) {
          const cleanCtx = canvas.getContext('2d');
          cleanCtx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        if (onComplete) onComplete();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active, mounted, duration, onComplete]);

  if (!mounted || !active) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden">
      {/* Canvas for rich particle physics */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
    </div>,
    document.body
  );
};
