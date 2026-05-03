"use client";

/**
 * CDAutoSceneHint — Phase 2 floating glass pill hint.
 *
 * Shown while onboardingStep === 3 (auto scene build is in progress).
 * Fades in immediately, fades out after ~1.8s, then parent unmounts it
 * when onboardingStep advances to 4 (~1.1s after step 3 begins).
 *
 * pointer-events: none — purely decorative, never blocks interaction.
 */

import { useState, useEffect } from "react";

// ─── Keyframes ─────────────────────────────────────────────────────────────────

const HINT_KEYFRAMES = `
@keyframes cd-hint-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to   { opacity: 0.9; transform: translateX(-50%) translateY(0); }
}
@keyframes cd-hint-out {
  from { opacity: 0.9; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0;   transform: translateX(-50%) translateY(-4px); }
}
`;

// ─── Component ─────────────────────────────────────────────────────────────────

export function CDAutoSceneHint() {
  const [fading, setFading] = useState(false);

  // Start fade-out at 1.8s (parent unmounts at ~1.1s after step 3, but
  // we fade early so it's already going when unmount happens)
  useEffect(() => {
    const t = setTimeout(() => setFading(true), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{HINT_KEYFRAMES}</style>
      <div
        aria-hidden
        style={{
          position:             "absolute",
          top:                  72,
          left:                 "50%",
          zIndex:               55,
          pointerEvents:        "none",
          whiteSpace:           "nowrap",
          // Glass pill
          background:           "rgba(10,8,18,0.80)",
          border:               "1px solid rgba(255,255,255,0.09)",
          borderRadius:         100,
          padding:              "6px 16px",
          backdropFilter:       "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          animation:            fading
            ? "cd-hint-out 0.38s cubic-bezier(0.4,0,1,1) both"
            : "cd-hint-in  0.38s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--font-familjen-grotesk), sans-serif",
            fontSize:      12,
            fontWeight:    400,
            letterSpacing: "0.02em",
            color:         "rgba(255,255,255,0.58)",
            lineHeight:    1,
            display:       "block",
          }}
        >
          Creative Director builds your scene
        </span>
      </div>
    </>
  );
}
