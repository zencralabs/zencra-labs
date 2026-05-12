"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CandidateCarousel — horizontal snap-scroll carousel
//
// Layout:
//   - overflow-x: auto + scroll-snap-type: x mandatory
//   - native touch swipe (touch-action: pan-x)
//   - hidden scrollbar cross-browser
//   - left/right edge fades for depth
//   - skeleton placeholder cards while remaining candidates load
//
// All media corners remain sharp (borderRadius: 0) via CandidateCard.
// ─────────────────────────────────────────────────────────────────────────────

import CandidateCard from "./CandidateCard";

// ── Props ─────────────────────────────────────────────────────────────────────

interface CandidateCarouselProps {
  candidates:      string[];
  failedSlots?:    number;         // how many jobs resolved with no URL (failed/cancelled)
  activeUrl:       string | null;
  compareUrls:     string[];
  accent:          string;
  isLocking:       boolean;
  lockedUrls:      string[];       // urls that have been locked
  lockingUrl:      string | null;  // url currently being locked (per-card spinner)
  slotsFull:       boolean;        // global slot limit reached
  onSetActive:     (url: string) => void;
  onPreview:       (url: string) => void;
  onToggleCompare: (url: string) => void;
  onSelect:        (url: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CandidateCarousel({
  candidates, failedSlots = 0, activeUrl, compareUrls, accent,
  isLocking, lockedUrls, lockingUrl, slotsFull,
  onSetActive, onPreview, onToggleCompare, onSelect,
}: CandidateCarouselProps) {
  const maxCompareReached = compareUrls.length >= 3;

  // When failedSlots is provided, all generation is done — show failed cards not skeletons.
  // When no failedSlots (undefined/0 with no failed jobs), show skeletons as before.
  const skeletonCount = failedSlots > 0 ? 0 : Math.max(0, 4 - candidates.length);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .candidate-carousel::-webkit-scrollbar { display: none; }
        .candidate-carousel { scrollbar-width: none; -ms-overflow-style: none; }
        @keyframes candidateSkeletonSweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(300%); }
        }
        @keyframes candidateSkeletonPulse {
          0%, 100% { opacity: 0.30; }
          50%       { opacity: 0.55; }
        }
      `}</style>

      {/* ── Carousel track ─────────────────────────────────────────────── */}
      <div
        className="candidate-carousel"
        style={{
          display:         "flex",
          gap:             16,
          overflowX:       "auto",
          scrollSnapType:  "x mandatory",
          WebkitOverflowScrolling: "touch",   // momentum scroll on iOS
          touchAction:     "pan-x",
          paddingLeft:     32,
          paddingRight:    48,
          paddingBottom:   8,
          paddingTop:      4,
        }}
      >
        {/* ── Real candidate cards ──────────────────────────────────── */}
        {candidates.map((url, i) => (
          <CandidateCard
            key={url}
            url={url}
            index={i + 1}
            accent={accent}
            isActive={url === activeUrl}
            isInCompare={compareUrls.includes(url)}
            isLocking={isLocking}
            isBeingLocked={lockingUrl === url}
            isLocked={lockedUrls.includes(url)}
            maxCompare={maxCompareReached && !compareUrls.includes(url)}
            slotsFull={slotsFull && !lockedUrls.includes(url)}
            onPreview={() => { onSetActive(url); onPreview(url); }}
            onCompare={() => onToggleCompare(url)}
            onSelect={() => onSelect(url)}
          />
        ))}

        {/* ── Failed job cards — shown when generation resolved with no URL ── */}
        {failedSlots > 0 && Array.from({ length: failedSlots }).map((_, i) => (
          <FailedCard key={`fail-${i}`} index={candidates.length + i + 1} />
        ))}

        {/* ── Skeleton cards while remaining candidates load ────────── */}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={`sk-${i}`} accent={accent} delay={i * 0.28} />
        ))}

        {/* Right trailing spacer — prevents last card from touching the fade */}
        <div style={{ flexShrink: 0, width: 8 }} aria-hidden="true" />
      </div>

      {/* ── Left edge fade ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 8,
        width: 32, pointerEvents: "none",
        background: "linear-gradient(to right, rgba(5,7,13,0.92), transparent)",
        zIndex: 10,
      }} aria-hidden="true" />

      {/* ── Right edge fade ────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 8,
        width: 56, pointerEvents: "none",
        background: "linear-gradient(to left, rgba(5,7,13,0.92), transparent)",
        zIndex: 10,
      }} aria-hidden="true" />
    </div>
  );
}

// ── Failed generation card ────────────────────────────────────────────────────

function FailedCard({ index }: { index: number }) {
  return (
    <div style={{
      flexShrink:   0,
      width:        "clamp(220px, 70vw, 260px)",
      height:       380,
      borderRadius: 0,
      border:       "1px solid rgba(239,68,68,0.18)",
      background:   "rgba(239,68,68,0.04)",
      scrollSnapAlign: "start",
      position:     "relative",
      overflow:     "hidden",
      display:      "flex",
      flexDirection: "column",
      alignItems:   "center",
      justifyContent: "center",
      gap: 10,
    }}>
      {/* Candidate number badge */}
      <div style={{
        position:   "absolute", top: 10, left: 10,
        padding:    "3px 8px",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        fontSize:   11, fontWeight: 600, letterSpacing: "0.12em",
        color:      "rgba(255,255,255,0.40)",
        textTransform: "uppercase" as const,
      }}>
        {String(index).padStart(2, "0")}
      </div>

      {/* Error icon */}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="rgba(239,68,68,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      {/* Label */}
      <div style={{ textAlign: "center", padding: "0 16px" }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 11, fontWeight: 700,
          letterSpacing: "0.10em", textTransform: "uppercase" as const,
          color: "rgba(239,68,68,0.70)",
          marginBottom: 4,
        }}>
          Generation Failed
        </div>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 10, fontWeight: 400,
          color: "rgba(255,255,255,0.25)",
          lineHeight: 1.5,
        }}>
          This candidate did not complete.
          Start a new run to try again.
        </div>
      </div>
    </div>
  );
}

// ── Skeleton placeholder card ─────────────────────────────────────────────────

function SkeletonCard({ accent, delay }: { accent: string; delay: number }) {
  return (
    <div style={{
      flexShrink:   0,
      width:        "clamp(220px, 70vw, 260px)",
      height:       380,
      borderRadius: 0,                       // sharp
      border:       "1px solid rgba(255,255,255,0.06)",
      background:   "rgba(255,255,255,0.025)",
      scrollSnapAlign: "start",
      position:     "relative",
      overflow:     "hidden",
      animation:    `candidateSkeletonPulse 2.0s ease-in-out ${delay}s infinite`,
    }}>
      {/* Shimmer sweep */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, width: "60%",
        background: `linear-gradient(
          105deg,
          transparent 0%,
          ${accent}0c 50%,
          transparent 100%
        )`,
        animation: `candidateSkeletonSweep 2.4s ease-in-out ${delay}s infinite`,
      }} />

      {/* Bottom info area skeleton */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 64,
        background: "rgba(0,0,0,0.30)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "12px 12px",
      }}>
        {/* Fake label bar */}
        <div style={{
          width: 72, height: 8,
          background: "rgba(255,255,255,0.07)",
          marginBottom: 8,
        }} />
        <div style={{
          width: "80%", height: 6,
          background: "rgba(255,255,255,0.04)",
        }} />
      </div>
    </div>
  );
}
