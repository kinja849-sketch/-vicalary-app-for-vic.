# Implementation Plan: Remove Floating Celebration Banner

## User Request
- The user requested to remove the floating `"100% CALORIE GOAL HIT!"` badge overlay that appears at the top of the screen during confetti celebration, keeping only the clean confetti particle animation.

## Changes
- In `components/CelebrationConfetti.tsx`: Remove the floating banner `<div>` element (lines 213-222). Only the canvas with particle animation will be rendered in the portal.

## Acceptance Criteria
- [x] Floating banner is completely removed.
- [x] Confetti particle animation continues to render cleanly across the viewport.
- [x] `npx tsc --noEmit` passes with 0 errors.
