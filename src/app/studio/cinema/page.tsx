"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Clapperboard, ArrowRight, ArrowLeft,
  Scissors, LayoutGrid, UserSquare2, MoveRight, Contrast,
} from "lucide-react";
import CinemaHero from "@/components/studio/CinemaHero";

// ─────────────────────────────────────────────────────────────────────────────
// FUTURE CINEMA STUDIO — FCS landing page
// Palette: deep navy base · silver/white type · gold as accent only
// ─────────────────────────────────────────────────────────────────────────────

const CINEMATIC_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// ── Motion animation lookup ───────────────────────────────────────────────────
type MotionKey = "slowZoom" | "structured" | "focusShift" | "lateralPan" | "lightFlicker" | "projection";

const MOTION_ANIMS: Record<MotionKey, { slow: string; slowTiming: string }> = {
  slowZoom:     { slow: "motionSlowZoomSlow",     slowTiming: "18s ease-in-out infinite alternate" },
  structured:   { slow: "motionStructuredSlow",   slowTiming: "18s linear infinite"                },
  focusShift:   { slow: "motionFocusShiftSlow",   slowTiming: "13s ease-in-out infinite"           },
  lateralPan:   { slow: "motionLateralPanSlow",   slowTiming: "18s linear infinite alternate"      },
  lightFlicker: { slow: "motionLightFlickerSlow", slowTiming: "16s ease-in-out infinite"           },
  projection:   { slow: "motionProjectionSlow",   slowTiming: "24s ease-in-out infinite alternate" },
};

// ── Reel strip accent colours ─────────────────────────────────────────────────
const REEL_COLORS = [
  "#C9A84C","#94A3B8","#8A6B2A","#CBD5E1",
  "#C9A84C","#7E9BB5","#F0C060","#B0C0D0",
  "#C9A84C","#94A3B8",
];

// ── Takeover card data ────────────────────────────────────────────────────────
type TakeoverCard = {
  title: string; category: string; desc: string;
  Icon: LucideIcon;
  poster: string; video: string;
  motionKey: MotionKey;
  // transform-origin for the expansion illusion — matches grid position
  origin: string;
};

const TAKEOVER_CARDS: TakeoverCard[] = [
  { title: "Scene-based Editing",   category: "EDITING",        desc: "Build films scene by scene with precise control over pacing, cuts, and continuity.",    Icon: Scissors,    poster: "/cinema-stills/still-1.svg", video: "/cinema-previews/preview-1.mp4", motionKey: "slowZoom",     origin: "0% 0%"    },
  { title: "Storyboard Workflow",   category: "WORKFLOW",       desc: "Translate ideas into structured visual sequences before final rendering.",               Icon: LayoutGrid,  poster: "/cinema-stills/still-2.svg", video: "/cinema-previews/preview-2.mp4", motionKey: "structured",   origin: "50% 0%"   },
  { title: "Character Consistency", category: "CHARACTERS",     desc: "Maintain identity, appearance, and motion across every scene.",                          Icon: UserSquare2, poster: "/cinema-stills/still-3.jpg", video: "/cinema-previews/preview-3.mp4", motionKey: "focusShift",   origin: "100% 0%"  },
  { title: "Shot Sequencing",       category: "CINEMATOGRAPHY", desc: "Design camera movement, composition, and shot transitions.",                             Icon: MoveRight,   poster: "/cinema-stills/still-4.svg", video: "/cinema-previews/preview-4.mp4", motionKey: "lateralPan",   origin: "0% 100%"  },
  { title: "Cinematic Grade",       category: "COLOR",          desc: "Apply professional color grading and tonal consistency.",                                Icon: Contrast,    poster: "/cinema-stills/still-5.svg", video: "/cinema-previews/preview-5.mp4", motionKey: "lightFlicker", origin: "50% 100%" },
  { title: "Export Ready",          category: "OUTPUT",         desc: "Render final outputs ready for distribution and publishing.",                            Icon: Clapperboard,poster: "/cinema-stills/still-6.svg", video: "/cinema-previews/preview-6.mp4", motionKey: "projection",   origin: "100% 100%"},
];

// ── CinemaTakeover ────────────────────────────────────────────────────────────
// 6-card grid that morphs into a full cinematic stage on hover.
// The hovered card expands from its grid corner; all others cut to invisible.
function CinemaTakeover() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const stageActive = activeIdx !== null;
  const activeCard  = activeIdx !== null ? TAKEOVER_CARDS[activeIdx] : null;

  function enter(i: number) {
    // Pause whichever video was playing before
    if (activeIdx !== null && activeIdx !== i) {
      const prev = videoRefs.current[activeIdx];
      if (prev) { prev.pause(); prev.currentTime = 0; }
    }
    setActiveIdx(i);
    const v = videoRefs.current[i];
    if (v) { v.preload = "auto"; v.play().catch(() => {}); }
  }

  function leave() {
    if (activeIdx !== null) {
      const v = videoRefs.current[activeIdx];
      if (v) { v.pause(); v.currentTime = 0; }
    }
    setActiveIdx(null);
  }

  return (
    // Fixed-height outer shell — no layout reflow during state switch
    <div style={{ position: "relative", height: 460, overflow: "hidden" }} onMouseLeave={leave}>

      {/* ── GRID PANEL ─────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 20, alignContent: "start",
      }}>
        {TAKEOVER_CARDS.map((card, i) => {
          const isActive = activeIdx === i;
          const isOther  = activeIdx !== null && !isActive;
          const anim     = MOTION_ANIMS[card.motionKey];

          return (
            <div
              key={i}
              onMouseEnter={() => enter(i)}
              style={{
                position: "relative",
                borderRadius: 16,
                overflow: "hidden",
                background: "#05070f",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                aspectRatio: "16 / 9",
                // ── Disappearance: cut in 140ms linear ──────────────────────
                // ── Expansion:     scale from grid corner ───────────────────
                opacity: isOther ? 0 : 1,
                transform: isActive ? "scale(1.75)" : "scale(1)",
                transformOrigin: card.origin,
                transition: isOther
                  ? "opacity 140ms linear"
                  : isActive
                  ? `transform 450ms ${CINEMATIC_EASE}`
                  : `opacity 220ms ${CINEMATIC_EASE}, transform 220ms ${CINEMATIC_EASE}`,
              }}
            >
              {/* Poster — slow cinematic drift */}
              <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <div style={{
                  position: "relative",
                  width: "106%", height: "106%",
                  top: "-3%", left: "-3%",
                  animation: `${anim.slow} ${anim.slowTiming}`,
                }}>
                  <Image
                    src={card.poster}
                    alt={card.title}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 1280px) 33vw, 420px"
                  />
                </div>
              </div>

              {/* Bottom reading gradient */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(to top, rgba(4,7,15,0.88) 0%, rgba(4,7,15,0.18) 48%, transparent 70%)",
              }} />

              {/* Edge vignette */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse at center, transparent 48%, rgba(4,7,15,0.50) 100%)",
              }} />

              {/* Top-left: icon + category */}
              <div style={{
                position: "absolute", top: 0, left: 0, padding: 20,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <card.Icon
                  size={20}
                  strokeWidth={1.4}
                  style={{ color: "rgba(200,210,230,0.70)" }}
                />
                <span style={{
                  fontSize: 11, letterSpacing: "0.12em",
                  textTransform: "uppercase", fontWeight: 600,
                  color: "rgba(200,210,230,0.55)",
                }}>
                  {card.category}
                </span>
              </div>

              {/* Bottom-left: title */}
              <div style={{ position: "absolute", bottom: 0, left: 0, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#F0F4FF", margin: 0, lineHeight: 1.3 }}>
                  {card.title}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── STAGE PANEL ────────────────────────────────────────────────────── */}
      {/* Absolute, covers full grid area. Appears on top of the expanding card,
          completing the morphing illusion. Delayed 150ms on entry so the
          expansion motion registers first. */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        borderRadius: 20, overflow: "hidden",
        background: "#020408",
        opacity: stageActive ? 1 : 0,
        pointerEvents: stageActive ? "auto" : "none",
        transition: stageActive
          ? `opacity 300ms ${CINEMATIC_EASE} 150ms`  // delayed — expansion shows first
          : `opacity 200ms ${CINEMATIC_EASE}`,        // snap collapse on leave
      }}>

        {/* Media layers — all 6 mounted; only active one is visible.
            Cross-fades on card-to-card switch (200ms). */}
        {TAKEOVER_CARDS.map((card, i) => (
          <div key={i} style={{ position: "absolute", inset: 0 }}>
            {/* Poster fallback */}
            <div style={{
              position: "absolute", inset: 0,
              opacity: activeIdx === i ? 1 : 0,
              transition: `opacity 200ms ${CINEMATIC_EASE}`,
            }}>
              <Image
                src={card.poster}
                alt=""
                aria-hidden
                fill
                style={{ objectFit: "cover" }}
                sizes="100vw"
              />
            </div>
            {/* Video — loads only on hover */}
            <video
              ref={el => { videoRefs.current[i] = el; }}
              preload="none"
              muted
              loop
              playsInline
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
                zIndex: 1,
                opacity: activeIdx === i ? 1 : 0,
                transition: `opacity 200ms ${CINEMATIC_EASE}`,
              }}
            >
              <source src={card.video} type="video/mp4" />
            </video>
          </div>
        ))}

        {/* Center light bloom — projector-on-screen feel */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none",
          background: "radial-gradient(circle at 50% 45%, rgba(220,235,255,0.05) 0%, transparent 52%)",
        }} />

        {/* Deep edge vignette — corners collapse into darkness */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, transparent 22%, rgba(4,7,15,0.58) 68%, rgba(4,7,15,0.90) 100%)",
        }} />

        {/* Letterbox bars — 6px, cinematic weight */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "rgba(0,0,0,0.80)", zIndex: 8, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: "rgba(0,0,0,0.80)", zIndex: 8, pointerEvents: "none" }} />

        {/* Content overlay — keyed to activeIdx so it re-animates on card switch */}
        <div
          key={`content-${activeIdx}`}
          style={{
            position: "absolute", bottom: 0, left: 0,
            padding: 32, zIndex: 9, pointerEvents: "none",
            animation: `stageContentIn 420ms ${CINEMATIC_EASE} both`,
          }}
        >
          {activeCard && (
            <>
              {/* Category pill */}
              <div style={{
                display: "inline-flex", alignItems: "center",
                height: 28, padding: "0 12px",
                borderRadius: 9999,
                background: "rgba(10,10,16,0.60)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                color: "rgba(200,210,230,0.85)",
                textTransform: "uppercase",
                marginBottom: 12, whiteSpace: "nowrap",
              }}>
                {activeCard.category}
              </div>

              {/* Title */}
              <div style={{
                fontSize: 28, fontWeight: 700, color: "#F0F4FF",
                lineHeight: 1.2, marginBottom: 10,
                textShadow: "0 1px 8px rgba(0,0,0,0.70)",
              }}>
                {activeCard.title}
              </div>

              {/* Description */}
              <p style={{
                fontSize: 14, color: "rgba(200,210,230,0.75)",
                maxWidth: 480, lineHeight: 1.65, margin: 0,
                textShadow: "0 1px 4px rgba(0,0,0,0.50)",
              }}>
                {activeCard.desc}
              </p>
            </>
          )}
        </div>

        {/* Gold playback bar — re-keys on switch to restart progress */}
        <div style={{
          position: "absolute", bottom: 6, left: 0, right: 0,
          zIndex: 10, height: 2, overflow: "hidden", pointerEvents: "none",
        }}>
          <div
            key={`bar-${activeIdx}`}
            style={{
              height: "100%",
              background: "linear-gradient(to right, #6B4F1E, #C9A84C, #F0C060)",
              animation: "playbackProgress 8s linear forwards",
              borderRadius: "0 1px 0 0",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CinemaStudioPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #04070f 0%, #070c16 35%, #0a0f1c 65%, #0c1220 100%)",
        color: "#F0F4FF",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* ── CSS keyframes — cinema-specific, scoped to this page ── */}
      <style>{`

        /* ── Playback progress bar ── */
        @keyframes playbackProgress {
          from { width: 0%; }
          to   { width: 88%; }
        }

        /* ── Stage content slide-up ── */
        @keyframes stageContentIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        /* ── Reel section animations ── */
        @keyframes reelSweep {
          0%   { transform: translateX(-130%) skewX(10deg); opacity: 0; }
          5%   { opacity: 1; }
          36%  { transform: translateX(240%) skewX(10deg); opacity: 0; }
          100% { transform: translateX(240%) skewX(10deg); opacity: 0; }
        }
        @keyframes reelDrift {
          0%, 100% { transform: translateX(0px); }
          50%       { transform: translateX(-3px); }
        }
        @keyframes playheadAdvance {
          from { width: 3%; }
          to   { width: 70%; }
        }

        /* ── Reel console: grain shift ── */
        @keyframes grainShift {
          0%  { transform: translate(0%,    0%); }
          25% { transform: translate(-2.5%, -1.5%); }
          50% { transform: translate(1.5%,  2%); }
          75% { transform: translate(2%,    -1%); }
          100%{ transform: translate(-1%,   1.5%); }
        }

        /* ── Reel console: icon soft pulse ── */
        @keyframes iconPulse {
          0%,  100% { transform: scale(1.00); opacity: 1; }
          48%        { transform: scale(1.06); opacity: 0.80; }
          52%        { transform: scale(1.06); opacity: 0.80; }
        }

        /* ═══════════════════════════════════════════════════════
           Per-card motion identities — slow poster drift only
           (cards no longer have hover-activated fast variants)
        ═══════════════════════════════════════════════════════ */

        /* 1. Scene Editing — locked-off slow push */
        @keyframes motionSlowZoomSlow {
          from { transform: scale(1.0) translate(0%, 0%); }
          to   { transform: scale(1.05) translate(-0.3%, -0.3%); }
        }

        /* 2. Storyboard — precise mechanical rack */
        @keyframes motionStructuredSlow {
          0%   { transform: translate(-1.1%, 0%); }
          50%  { transform: translate(1.1%, 0%); }
          100% { transform: translate(-1.1%, 0%); }
        }

        /* 3. Character — organic focus shift */
        @keyframes motionFocusShiftSlow {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          40%  { transform: scale(1.03) translate(0.2%, -0.35%); }
          100% { transform: scale(1.0) translate(0%, 0%); }
        }

        /* 4. Shot Sequencing — constant lateral pan */
        @keyframes motionLateralPanSlow {
          from { transform: translateX(-1.5%); }
          to   { transform: translateX(1.5%); }
        }

        /* 5. Cinematic Grade — almost imperceptible exposure drift */
        @keyframes motionLightFlickerSlow {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          20%  { transform: scale(1.01) translate(-0.1%, 0%); }
          45%  { transform: scale(1.015) translate(-0.05%, -0.1%); }
          70%  { transform: scale(1.01) translate(0.05%, -0.05%); }
          100% { transform: scale(1.0) translate(0%, 0%); }
        }

        /* 6. Export — very slow diagonal projection drift */
        @keyframes motionProjectionSlow {
          from { transform: translate(-0.35%, -0.35%) scale(1.0); }
          to   { transform: translate(0.55%, 0.40%) scale(1.035); }
        }

      `}</style>

      {/* ── Ambient atmosphere ── */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div style={{ position: "absolute", width: "65%", height: "65%", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,50,110,0.12) 0%, transparent 70%)", top: "-18%", right: "-12%", filter: "blur(100px)" }} />
        <div style={{ position: "absolute", width: "55%", height: "55%", borderRadius: "50%", background: "radial-gradient(circle, rgba(10,25,60,0.10) 0%, transparent 70%)", bottom: "-12%", left: "-10%", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", width: "35%", height: "35%", borderRadius: "50%", background: "radial-gradient(circle, rgba(160,120,40,0.05) 0%, transparent 70%)", top: "38%", left: "32%", filter: "blur(90px)" }} />
      </div>

      {/* ── Subtle grid ── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ opacity: 0.018, backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "80px 80px" }}
        aria-hidden="true"
      />

      {/* ── Back nav ── */}
      <div className="container-site pt-8 pb-0">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium transition-all duration-200"
          style={{ color: "rgba(200,210,230,0.35)", textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(200,210,230,0.75)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(200,210,230,0.35)")}
        >
          <ArrowLeft size={14} />
          Back to Zencra Labs
        </Link>
      </div>

      {/* ── HERO — full bleed ── */}
      <CinemaHero />

      {/* Hero → Reel dissolve */}
      <div
        aria-hidden="true"
        style={{ height: 84, background: "linear-gradient(to bottom, transparent 0%, rgba(4,7,15,0.55) 55%, rgba(4,7,15,0.92) 100%)", marginTop: -84, pointerEvents: "none", position: "relative", zIndex: 2 }}
      />

      {/* ── CINEMATIC REEL / PREVIEW SECTION ── */}
      <section className="container-site" style={{ paddingBottom: "84px" }}>
        <div
          className="relative w-full rounded-3xl"
          style={{
            aspectRatio: "16/9",
            overflow: "hidden",
            background: "linear-gradient(135deg, #04070f 0%, #070c18 45%, #0c1220 100%)",
            border: "1px solid rgba(201,168,76,0.13)",
            boxShadow: "0 0 90px rgba(0,0,0,0.75), 0 32px 90px rgba(0,0,0,0.65), inset 0 28px 40px rgba(4,7,15,0.5)",
          }}
        >
          {/* Base video layer — /cinema-reel/preview-deck.mp4 (16:9 landscape) */}
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              zIndex: 0,
              opacity: 0.72,   // let the dark frame show through slightly
            }}
          >
            <source src="/cinema-reel/preview-deck.mp4" type="video/mp4" />
          </video>

          {/* Interior orbs — cool blue top-right, gold bottom-left */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div style={{ position: "absolute", width: "50%", height: "65%", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,50,110,0.16) 0%, transparent 70%)", top: "-10%", right: "-8%", filter: "blur(70px)" }} />
            <div style={{ position: "absolute", width: "38%", height: "48%", borderRadius: "50%", background: "radial-gradient(circle, rgba(160,120,40,0.07) 0%, transparent 70%)", bottom: "-8%", left: "8%", filter: "blur(60px)" }} />
          </div>

          {/* Centered cool blue inner glow — cinematic console ambience */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(24,70,190,0.09) 0%, rgba(14,40,120,0.04) 45%, transparent 72%)",
              filter: "blur(18px)",
            }}
          />

          {/* Stronger edge vignette — darkens corners for console depth */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background: "radial-gradient(ellipse at center, transparent 36%, rgba(4,7,15,0.48) 64%, rgba(4,7,15,0.76) 100%)",
            }}
          />

          {/* Moving grain/noise overlay — near-invisible texture motion */}
          <div
            className="pointer-events-none absolute"
            aria-hidden="true"
            style={{
              top: "-4%", left: "-4%", width: "108%", height: "108%",
              opacity: 0.028,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
              backgroundSize: "160px 160px",
              animation: "grainShift 0.55s steps(4) infinite",
            }}
          />

          {/* Reel sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "32%", height: "120%", background: "linear-gradient(to right, transparent, rgba(255,255,255,0.020), transparent)", animation: "reelSweep 13s ease-in-out infinite" }} />
          </div>

          {/* Fine grid */}
          <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.022, backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {/* Center icon — +10% size, 8s soft pulse */}
            <div
              className="flex items-center justify-center rounded-3xl"
              style={{
                width: 88, height: 88,
                background: "rgba(201,168,76,0.07)",
                border: "1px solid rgba(201,168,76,0.20)",
                boxShadow: "0 0 36px rgba(201,168,76,0.07)",
                animation: "iconPulse 8s ease-in-out infinite",
              }}
            >
              <Clapperboard size={40} style={{ color: "rgba(201,168,76,0.65)" }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "rgba(240,244,255,0.40)" }}>Cinema Preview Deck</p>
            <p style={{ fontSize: 13, color: "rgba(200,210,230,0.24)", textAlign: "center", maxWidth: 360, lineHeight: 1.65 }}>
              A living surface for scene previews, sequencing, and final visual review.
            </p>
          </div>

          {/* Playhead timeline */}
          <div style={{ position: "absolute", bottom: 44, left: 16, right: 16, height: 1, background: "rgba(255,255,255,0.04)", borderRadius: 1 }}>
            <div style={{ height: "100%", background: "linear-gradient(to right, #6B4F1E, #C9A84C)", animation: "playheadAdvance 14s linear infinite", borderRadius: 1 }} />
          </div>

          {/* Reel strip */}
          <div className="absolute bottom-0 left-0 right-0" style={{ background: "linear-gradient(to top, rgba(4,7,15,0.97), transparent)", padding: "6px 12px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, animation: "reelDrift 9s ease-in-out infinite" }}>
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: 14, borderRadius: 2, background: i % 5 === 0 ? `${REEL_COLORS[i % REEL_COLORS.length]}48` : i % 9 === 0 ? `${REEL_COLORS[(i + 3) % REEL_COLORS.length]}28` : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.032)" }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reel → Cards dissolve */}
      <div
        aria-hidden="true"
        style={{ height: 56, background: "linear-gradient(to bottom, rgba(4,7,15,0.55), transparent)", marginTop: -56, pointerEvents: "none", position: "relative", zIndex: 2 }}
      />

      {/* ── CINEMATIC TAKEOVER SECTION ── */}
      <section className="container-site" style={{ paddingBottom: "100px" }}>
        <div className="text-center" style={{ marginBottom: "56px" }}>
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#C9A84C", marginBottom: "16px" }}>What&apos;s Coming</p>
          <h2 className="tracking-tight" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 700, color: "rgba(240,244,255,0.92)" }}>
            Designed for Real Filmmakers
          </h2>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: "rgba(200,210,230,0.50)", lineHeight: 1.7 }}>
            Every feature is built around professional cinematic storytelling workflows — not just clip generation.
          </p>
        </div>

        <CinemaTakeover />
      </section>

      {/* ── FOOTER CTA ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "70px 0", textAlign: "center" }}>
        <div className="container-site flex flex-col items-center gap-5">
          <h2 className="tracking-tight" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#F0F4FF" }}>
            Ready to direct the future?
          </h2>
          <p style={{ color: "rgba(200,210,230,0.50)", maxWidth: 440, lineHeight: 1.7 }}>
            Join the waitlist for early access to Future Cinema Studio and be the first to create AI films at scale.
          </p>
          <p style={{ color: "rgba(200,210,230,0.38)", maxWidth: 400, lineHeight: 1.65, fontSize: 14, fontStyle: "italic" }}>
            Step into a new way of filmmaking — where a single creator becomes the entire production.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/studio/image"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(200,210,230,0.65)", textDecoration: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLElement).style.color = "#F0F4FF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(200,210,230,0.65)"; }}
            >
              Try Image Studio now
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-300"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #8A6B2A 100%)", color: "#0a0c10", border: "none", textDecoration: "none", fontWeight: 700, boxShadow: "0 0 24px rgba(201,168,76,0.22)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 42px rgba(201,168,76,0.42)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(201,168,76,0.22)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
            >
              Explore Zencra Labs
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
