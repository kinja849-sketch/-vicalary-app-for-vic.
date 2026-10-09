# Implementation Plan: Fix Netlify Deployment Build Failure

## Problem Analysis

### 1. The Incident History
By querying the Netlify API via the Netlify MCP integration for site `2870d318-45f0-48e8-a177-8818c7c5bde5` (`vicalarly`), we traced the exact deployment history:
- **Deploy `6ac87aa00688f90008f6b47a` (Commit `a0d42513`)**: **STATE: READY** (Success, deployed at 2026-10-09 05:25:50 UTC). 14 consecutive deploys before this point were also completely successful.
- **Deploy `6ac8cd70947b9f0008af41de` (Commit `c0717a6e`)**: **STATE: ERROR** (`Failed during stage 'building site': Build script returned non-zero exit code: 2`).
- **Deploy `6ac912db6231860008ad5d8b` (Commit `8ecbc793`)**: **STATE: ERROR** (`Build script returned non-zero exit code: 2`).
- **Deploy `6ac95a5691cc778edc2bcdf9` (Commit `8ecbc793` retry)**: **STATE: ERROR** (`Build script returned non-zero exit code: 2`).
- **Deploy `6ac965577ca32e00093f504c` (Commit `d56a9a13`)**: **STATE: ERROR** (`Build script returned non-zero exit code: 2`).

### 2. Root Cause
1. **301MB Native Binary Bloat**: In commit `c0717a6e`, `"kokoro-js": "^1.2.1"` and `"@huggingface/transformers": "^4.3.1"` were added to [package.json](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/package.json). This package dragged in `onnxruntime-node`, which contains 301 MB of uncompressed native binaries (`DirectML.dll`, `dxcompiler.dll`, `libonnxruntime.so`, etc.).
2. **Lambda Limit Breach**: In [next.config.mjs](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/next.config.mjs), `serverComponentsExternalPackages: ['kokoro-js', 'onnxruntime-node', '@huggingface/transformers']` was configured. When Netlify's `@netlify/plugin-nextjs` (OpenNext adapter) packages the Next.js server handler for AWS Lambda, it attempts to bundle and package these external dependencies into the lambda zip. AWS Lambda has a strict **250 MB uncompressed limit** and **50 MB compressed limit**. The lambda bundle exceeds 300 MB, causing the Netlify build packaging step to crash with exit code 2.
3. **Architectural & Scope Violation**: Running an 82-million parameter ONNX neural network inside a serverless lambda function is unviable due to cold start times, execution timeouts, RAM limits, and missing native C++ runtime libraries. Furthermore, [AGENTS.md](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/AGENTS.md) Section 1 explicitly forbids introducing arbitrary new local AI models beyond OpenAI and Google Generative AI already in use.
4. **Existing Cloud Pipeline**: [lib/ai/ai-fallback.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts) already has a production-ready primary TTS engine (OpenAI TTS) and an ultra-fast, zero-binary backup neural voice engine (Google Gemini TTS using the `Aoede` voice). Both execute lightweight HTTPS REST API calls that produce high-quality audio in under 400ms with zero local binaries or bundle bloat.

---

## Proposed Changes

### File 1: [package.json](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/package.json)
- Remove `"@huggingface/transformers": "^4.3.1"`
- Remove `"kokoro-js": "^1.2.1"`
- Regenerate a clean, lightweight [package-lock.json](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/package-lock.json) without onnxruntime / transformers bloat.

### File 2: [next.config.mjs](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/next.config.mjs)
- Revert [next.config.mjs](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/next.config.mjs) to its verified stable state matching commit `a0d42513`:
  - Keep `images.remotePatterns` for Supabase and Edamam.
  - Remove `experimental.serverComponentsExternalPackages`.
  - Remove Webpack dummy aliases and fallbacks added as a workaround for the onnxruntime leakage.

### File 3: [lib/ai/ai-fallback.ts](file:///c:/Users/acer/Desktop/my%20apps/the-app-belong-to-vic--main/the-app-belong-to-vic--main/lib/ai/ai-fallback.ts)
- In `synthesizeVoiceAudioWithFallback`, remove the dynamic import and execution of `synthesizeKokoroNeuralSpeech`.
- Preserve the 2-tier cloud TTS pipeline:
  1. Primary: OpenAI TTS (`nova`, `alloy`, `shimmer`, etc.)
  2. Backup: Google Gemini TTS (`Aoede` voice via Gemini API)
- Return clean error logging when both cloud services are unavailable.

---

## Verification Plan

1. **TypeScript Typecheck**:
   - Run `cmd /c "npm run typecheck"` to ensure 0 compiler errors across the entire codebase.
2. **Production Build (`next build`)**:
   - Run `cmd /c "npm run build"` to verify that Next.js creates optimized static and server chunks cleanly without any Webpack or Terser warnings.
3. **Bundle Size & Lambda Footprint**:
   - Verify that no ONNX native binaries remain in the server chunk output.
4. **Netlify Deployment Verification**:
   - Trigger a Netlify deployment or verify with Netlify MCP tools to confirm that the site transitions from `error` to `ready`.
