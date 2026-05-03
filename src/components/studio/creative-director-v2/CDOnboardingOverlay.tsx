"use client";

/**
 * CDOnboardingOverlay — first-time cinematic onboarding for Creative Director.
 *
 * Shown only when:
 *   • Canvas has no elements and no frames
 *   • sessionStorage does NOT have "cd_onboarding_seen" = "1"
 *
 * Dismissed by: "Start Creating" button, "Skip" link, or × close button.
 * On dismiss: sets the sessionStorage flag and calls onDismiss()
 *             which removes the overlay from the tree entirely.
 *
 * Design rules:
 *   - The overlay is a backdrop, not the star. CDMiniFlow is the star.
 *   - Minimal text. Maximum scene.
 *   - No tutorial tone. No instruction panels.
 */

import { useState, useEffect, useCallback } from "react";
import { CDMiniFlow } from "./CDMiniFlow";

// ─── Keyframes ─────────────────────────────────────────────────────────────────

const OVERLAY_KEYFRAMES = `
@keyframes cd-ob-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes cd-ob-overlay-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes cd-ob-content-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
`;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CDOnboardingOverlayProps {
  onDismiss: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CDOnboardingOverlay({ onDismiss }: CDOnboardingOverlayProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem("cd_onboarding_seen", "1");
    } catch {
      // Private browsing mode — sessionStorage may be blocked; fail silently
    }
    setDismissing(true);
    // Allow fade-out to complete before unmounting
    setTimeout(onDismiss, 260);
  }, [onDismiss]);

  // Escape key dismisses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDismiss]);

  return (
    <>
      <style>{OVERLAY_KEYFRAMES}</style>

      <div
        style={{
          position:             "absolute",
          inset:                0,
          zIndex:               60,
          background:           "rgba(6,5,10,0.84)",
          backdropFilter:       "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          display:              "flex",
          flexDirection:        "column",
          alignItems:           "center",
          justifyContent:       "center",
          gap:                  28,
          animation:            dismissing
            ? "cd-ob-overlay-out 0.26s ease both"
            : "cd-ob-overlay-in  0.5s  ease both",
          pointerEvents: dismissing ? "none" : "auto",
        }}
      >
        {/* ── × Close ─────────────────────────────────────────────────────── */}
        <button
          onClick={handleDismiss}
          title="Close"
          style={{
            position:     "absolute",
            top:          16,
            right:        20,
            background:   "transparent",
            border:       "1px solid rgba(255,255,255,0.12)",
            borderRadius: "50%",
            width:        28,
            height:       28,
            color:        "rgba(255,255,255,0.35)",
            fontSize:     15,
            lineHeight:   1,
            cursor:       "pointer",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            padding:      0,
            transition:   "all 0.15s ease",
            fontFamily:   "sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background   = "rgba(255,255,255,0.08)";
            e.currentTarget.style.borderColor  = "rgba(255,255,255,0.28)";
            e.currentTarget.style.color        = "rgba(255,255,255,0.70)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background   = "transparent";
            e.currentTarget.style.borderColor  = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color        = "rgba(255,255,255,0.35)";
          }}
        >
          ×
        </button>

        {/* ── Title + subtitle ─────────────────────────────────────────────── */}
        <div
          style={{
            textAlign:   "center",
            animation:   "cd-ob-content-in 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s both",
          }}
        >
          <h2
            style={{
              fontFamily:    "var(--font-syne), sans-serif",
              fontSize:      24,
              fontWeight:    600,
              letterSpacing: "0.01em",
              color:         "rgba(255,255,255,0.92)",
              margin:        "0 0 10px",
              lineHeight:    1.15,
            }}
          >
            Direct the Frame
          </h2>
          <p
            style={{
              fontFamily:    "var(--font-familjen-grotesk), sans-serif",
              fontSize:      14,
              color:         "rgba(255,255,255,0.38)",
              margin:        0,
              lineHeight:    1.55,
              maxWidth:      460,
              letterSpacing: "0.01em",
            }}
          >
            Place your subject. Set the world. Shape the light.
            <br />
            One direction becomes the image.
          </p>
        </div>

        {/* ── Mini flow diagram — the scene is dominant, always ───────────── */}
        <div
          style={{
            animation: "cd-ob-content-in 0.75s cubic-bezier(0.16,1,0.3,1) 0.25s both",
          }}
        >
          <CDMiniFlow />
        </div>

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        <div
          style={{
            display:   "flex",
            alignItems: "center",
            gap:        14,
            animation: "cd-ob-content-in 0.7s cubic-bezier(0.16,1,0.3,1) 0.40s both",
          }}
        >
          {/* Primary — Start Creating */}
          <button
            onClick={handleDismiss}
            style={{
              background:    "rgba(139,92,246,0.90)",
              border:        "1px solid rgba(139,92,246,0.6)",
              borderRadius:  10,
              color:         "rgba(255,255,255,0.95)",
              fontSize:      13,
              fontFamily:    "var(--font-sans)",
              fontWeight:    600,
              letterSpacing: "0.03em",
              cursor:        "pointer",
              padding:       "10px 26px",
              lineHeight:    1,
              transition:    "all 0.18s ease",
              boxShadow:     "0 0 24px rgba(139,92,246,0.22)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139,92,246,1)";
              e.currentTarget.style.boxShadow  = "0 0 36px rgba(139,92,246,0.38)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(139,92,246,0.90)";
              e.currentTarget.style.boxShadow  = "0 0 24px rgba(139,92,246,0.22)";
            }}
          >
            Start Creating
          </button>

          {/* Ghost — Skip */}
          <button
            onClick={handleDismiss}
            style={{
              background:    "transparent",
              border:        "none",
              borderRadius:  10,
              color:         "rgba(255,255,255,0.28)",
              fontSize:      12,
              fontFamily:    "var(--font-sans)",
              letterSpacing: "0.04em",
              cursor:        "pointer",
              padding:       "10px 14px",
              lineHeight:    1,
              transition:    "color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.28)"; }}
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
