"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

export type AvatarState = "idle" | "listening" | "transcribing" | "thinking" | "researching" | "speaking";

interface HealthCoachSphereProps {
  state: AvatarState;
  intent?: string; // 'factual_research' | 'nutrition_analysis' | 'motivation' | 'meal_planning' | 'casual_chat'
  audioLevel?: number; // 0 to 1 audio amplitude
  className?: string;
  size?: number; // pixel size for canvas container
}

// 3D Inner Core Mesh with animated morphing surface
function AnimatedSphereMesh({ state, intent, audioLevel = 0 }: { state: AvatarState; intent?: string; audioLevel?: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<any>(null!);

  // Dynamic colors based on intent & state
  const colors = useMemo(() => {
    if (state === "researching" || intent === "factual_research") {
      return { core: "#06b6d4", outer: "#3b82f6", distort: 0.6, speed: 4 }; // Cyan / Blue quantum research
    }
    if (state === "speaking") {
      return { core: "#10b981", outer: "#34d399", distort: 0.55, speed: 3.5 }; // Vibrant Emerald Speaking
    }
    if (state === "listening") {
      return { core: "#14b8a6", outer: "#06b6d4", distort: 0.4, speed: 2.5 }; // Teal listening
    }
    if (state === "thinking") {
      return { core: "#8b5cf6", outer: "#ec4899", distort: 0.7, speed: 5 }; // Violet / Pink reasoning
    }
    return { core: "#059669", outer: "#10b981", distort: 0.25, speed: 1.5 }; // Idle emerald
  }, [state, intent]);

  useFrame((stateObj, delta) => {
    if (!meshRef.current) return;

    // Smooth rotation
    meshRef.current.rotation.x += delta * 0.2;
    meshRef.current.rotation.y += delta * 0.3;

    // React to audio level during speaking/listening
    const targetScale = state === "speaking" || state === "listening" 
      ? 1 + audioLevel * 0.35 + Math.sin(stateObj.clock.elapsedTime * 6) * 0.05
      : 1 + Math.sin(stateObj.clock.elapsedTime * 2) * 0.04;

    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    if (materialRef.current) {
      materialRef.current.distort = THREE.MathUtils.lerp(
        materialRef.current.distort,
        colors.distort + (state === "speaking" ? audioLevel * 0.3 : 0),
        0.1
      );
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, colors.speed, 0.1);
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
      <Sphere ref={meshRef} args={[1.3, 64, 64]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={colors.core}
          emissive={colors.outer}
          emissiveIntensity={0.6}
          roughness={0.15}
          metalness={0.8}
          distort={colors.distort}
          speed={colors.speed}
        />
      </Sphere>
    </Float>
  );
}

// 3D Orbital Research Rings for ChatGPT-style research mode
function ResearchOrbitRings({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.x += delta * 0.8;
      groupRef.current.rotation.y += delta * 1.2;
      groupRef.current.rotation.z += delta * 0.5;
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.0, 0.03, 16, 100]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1} wireframe />
      </mesh>
      <mesh rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
        <torusGeometry args={[2.3, 0.02, 16, 100]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// 2D Canvas Fallback for environments without full WebGL context
function Canvas2DFallback({ state, intent }: { state: AvatarState; intent?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseRadius = 70;

      // Color scheme based on state
      let primaryColor = "rgba(16, 185, 129, 0.8)"; // emerald
      let secondaryColor = "rgba(6, 182, 212, 0.5)"; // cyan

      if (state === "researching" || intent === "factual_research") {
        primaryColor = "rgba(6, 182, 212, 0.9)";
        secondaryColor = "rgba(59, 130, 246, 0.6)";
      } else if (state === "thinking") {
        primaryColor = "rgba(139, 92, 246, 0.9)";
        secondaryColor = "rgba(236, 72, 153, 0.6)";
      } else if (state === "speaking") {
        primaryColor = "rgba(52, 211, 153, 0.95)";
        secondaryColor = "rgba(16, 185, 129, 0.7)";
      }

      // Outer glow aura
      const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, baseRadius * 1.5);
      grad.addColorStop(0, primaryColor);
      grad.addColorStop(0.7, secondaryColor);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * (1.3 + Math.sin(time * 2) * 0.1), 0, Math.PI * 2);
      ctx.fill();

      // Deformed liquid core sphere
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      const points = 12;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave = Math.sin(time * 3 + i) * (state === "speaking" ? 12 : state === "thinking" ? 8 : 4);
        const r = baseRadius + wave;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [state, intent]);

  return <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />;
}

export default function HealthCoachSphere({
  state,
  intent,
  audioLevel = 0,
  className = "",
  size = 240,
}: HealthCoachSphereProps) {
  const [webGlSupported, setWebGlSupported] = React.useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const isSupported = !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
      setWebGlSupported(isSupported);
    } catch (e) {
      setWebGlSupported(false);
    }
  }, []);

  return (
    <div
      className={`relative flex items-center justify-center rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {webGlSupported === true ? (
        <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <pointLight position={[-10, -10, -5]} intensity={1} color="#06b6d4" />
          <AnimatedSphereMesh state={state} intent={intent} audioLevel={audioLevel} />
          <ResearchOrbitRings active={state === "researching" || intent === "factual_research"} />
        </Canvas>
      ) : webGlSupported === false ? (
        <Canvas2DFallback state={state} intent={intent} />
      ) : null}
    </div>
  );
}
