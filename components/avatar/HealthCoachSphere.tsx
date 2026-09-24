"use client";

import React from "react";
import HealthCoachAvatar, { CoachState } from "./HealthCoachAvatar";

export type AvatarState = "idle" | "listening" | "transcribing" | "thinking" | "researching" | "searching" | "preparing" | "speaking" | "error";

interface HealthCoachSphereProps {
  state: AvatarState;
  intent?: string;
  audioLevel?: number;
  micLevel?: number;
  className?: string;
  size?: number;
  onClick?: () => void;
}

export default function HealthCoachSphere({
  state,
  intent,
  audioLevel = 0,
  micLevel = 0,
  className = "",
  size = 240,
  onClick,
}: HealthCoachSphereProps) {
  // Normalize legacy state names to CoachState
  let coachState: CoachState = "idle";
  if (state === "listening") coachState = "listening";
  else if (state === "transcribing" || state === "thinking") coachState = "thinking";
  else if (state === "researching" || state === "searching") coachState = "searching";
  else if (state === "preparing") coachState = "preparing";
  else if (state === "speaking") coachState = "speaking";
  else if (state === "error") coachState = "error";

  const searchStatus = (intent === "factual_research" || state === "researching" || state === "searching")
    ? "Searching factual sources..."
    : undefined;

  return (
    <HealthCoachAvatar
      state={coachState}
      micLevel={micLevel}
      audioLevel={audioLevel}
      searchStatus={searchStatus}
      size={size}
      className={className}
      onClick={onClick}
    />
  );
}
