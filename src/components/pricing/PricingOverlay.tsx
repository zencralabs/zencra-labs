"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PricingOverlay v9 — Performance, polish, FCS logic, upsell modal
// Perf: static bg (no drift animation), reduced backdrop blur, will-change only
//       on animated elements, reel paused via IntersectionObserver, video
//       pointer-events:none, heavy box-shadows reduced.
// UX:   panel slides DOWN from translateY(-24px), 420ms spring easing.
//       Star dots with slow pulse. FCS CTA guards. Boost deselect. FCS modal.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingOverlayProps { onClose: () => void; }
type BillingCycle = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  originalPrice: number;
  credits: number;
  images: number;
  clips: number;
  border: string;
  hoverGlow: string;
  ctaLabel: string;
  ctaBg: string;
  ctaColor: string;
  ctaBorder: string;
  ctaHoverShadow: string;
  ctaGradientText?: string;
  highlight?: boolean;
  features: string[];
}

// ── Tokens ────────────────────────────────────────────────────────────────────

const GOLD  = "#FFD56A";
const TEAL  = "#22d3ee";
const AMBER = "#F59E0B";
const WHITE = "#ffffff";
const BODY  = "rgba(241,245,249,0.88)";

// v8 — Optional panel background image. Set path to activate; leave "" for gradient fallback.
const PRICING_PANEL_BG = ""; // e.g. "/pricing/pricing-panel-bg.png"

// Shared section max-width token — all section wrappers align to this.
const PRICING_CONTENT_MAX_WIDTH = 1180;

// v8 — Hero reel placeholder video paths (replace with real assets)
const REEL_IMAGES = [
  "/pricing/reel-1.jpg",
  "/pricing/reel-2.jpg",
  "/pricing/reel-3.jpg",
  "/pricing/reel-4.jpg",
  "/pricing/reel-5.jpg",
];

// ── Plans (LOCKED — do not change prices, credits, or names) ─────────────────

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    icon: "⚡",
    monthlyPrice: 12,
    yearlyPrice: 120,
    originalPrice: 19,
    credits: 600,
    images: 75,
    clips: 5,
    border: "rgba(255,255,255,0.75)",
    hoverGlow: "0 0 45px rgba(255,255,255,.20)",
    ctaLabel: "Start Free (Upgrade later)",
    ctaBg: "linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 24px rgba(29,78,216,0.55)",
    features: [
      "Basic & Pro Image Models",
      "Fast Video Generation",
      "AI Audio Tools",
      "Standard Priority",
      "Community Support",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    icon: "👑",
    monthlyPrice: 29,
    yearlyPrice: 290,
    originalPrice: 49,
    credits: 1600,
    images: 200,
    clips: 13,
    border: "rgba(236,72,153,0.78)",
    hoverGlow: "0 0 50px rgba(236,72,153,.34)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(135deg, #f472b6 0%, #c026d3 100%)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 40px rgba(192,38,211,0.55), 0 0 80px rgba(244,114,182,0.25)",
    highlight: true,
    features: [
      "All Image Models",
      "All Video Models",
      "AI Audio & Voiceover",
      "Priority Generation",
      "Advanced Features",
      "Email Support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    icon: "⚡",
    monthlyPrice: 49,
    yearlyPrice: 490,
    originalPrice: 79,
    credits: 3500,
    images: 437,
    clips: 29,
    border: "rgba(52,211,153,0.78)",
    hoverGlow: "0 0 45px rgba(52,211,153,.32)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 32px rgba(5,150,105,0.55), 0 0 64px rgba(52,211,153,0.28)",
    features: [
      "All Image Models",
      "All Video Models",
      "AI Audio & Voiceover",
      "Advanced Features",
      "Early Access",
      "Priority Support",
    ],
  },
  {
    id: "business",
    name: "Business",
    icon: "💎",
    monthlyPrice: 89,
    yearlyPrice: 890,
    originalPrice: 149,
    credits: 8000,
    images: 1000,
    clips: 66,
    border: "rgba(59,130,246,0.92)",
    hoverGlow: "0 0 55px rgba(59,130,246,.40), 0 0 90px rgba(37,99,235,.22)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(135deg, #60a5fa 0%, #1e40af 100%)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 28px rgba(30,64,175,0.55), 0 0 56px rgba(96,165,250,0.28)",
    features: [
      "All Image Models",
      "All Video Models",
      "AI Audio & Voiceover",
      "Highest Priority",
      "Advanced Features",
      "Team Collaboration",
      "Dedicated Support",
    ],
  },
];

// ── Boost packs (LOCKED — do not change prices) ───────────────────────────────

const BOOST_PACKS = [
  { credits: 500,  price: 15 },
  { credits: 1000, price: 25 },
  { credits: 2500, price: 59 },
  { credits: 5000, price: 99 },
];

// ── Comparison features ───────────────────────────────────────────────────────

const COMPARE_FEATURES = [
  {
    icon: "🖼️",
    name: "Image Generation",
    sub: "Basic, Pro & Advanced Models",
    values: ["Up to 75 / month", "Up to 200 / month", "Up to 437 / month", "Up to 1,000 / month"],
  },
  {
    icon: "🎬",
    name: "Video Generation",
    sub: "Fast, Pro & Omni Models",
    values: ["Up to 5 clips / month", "Up to 13 clips / month", "Up to 29 clips / month", "Up to 66 clips / month"],
  },
  {
    icon: "🎵",
    name: "AI Audio & Voiceover",
    sub: "Music, SFX & Voice",
    values: [true, true, true, true],
  },
  {
    icon: "⚡",
    name: "Priority Speed",
    sub: "Faster generations",
    values: ["Standard", "Priority", "High Priority", "Highest Priority"],
  },
  {
    icon: "🎥",
    name: "Future Cinema Studio",
    sub: "Cinematic Filmmaking Tools",
    values: ["—", "—", "Add-on", "Add-on"],
  },
  {
    icon: "💬",
    name: "Support",
    sub: "Get help when you need",
    values: ["Ticket", "Ticket", "Ticket (Priority)", "Ticket (Priority)"],
  },
];

// ── Cinematic 3-layer star system ─────────────────────────────────────────────
// Layer A: pure CSS background — zero DOM elements, zero animation
// Layer B: 2px soft glow divs — only 5 get slow opacity-only pulse (no scale)
// Layer C: 3px bloom divs — radial-gradient, static, no animation

// Layer A background is embedded directly in the star container's backgroundImage
// (see render — no constant needed)

// Layer B — 10 soft glow stars; pulse:true = slow bloom-pulse (opacity only)
const STAR_B = [
  { x: 12, y: 18, pulse: true,  d: 0.0, o: 0.28 },
  { x: 28, y:  8, pulse: true,  d: 2.1, o: 0.30 },
  { x: 45, y: 32, pulse: false, d: 0.0, o: 0.22 },
  { x: 62, y: 14, pulse: true,  d: 3.8, o: 0.27 },
  { x: 78, y: 42, pulse: false, d: 0.0, o: 0.20 },
  { x: 88, y: 12, pulse: true,  d: 1.6, o: 0.25 },
  { x: 34, y: 58, pulse: false, d: 0.0, o: 0.18 },
  { x: 55, y: 75, pulse: true,  d: 4.5, o: 0.28 },
  { x: 72, y: 68, pulse: false, d: 0.0, o: 0.20 },
  { x: 20, y: 82, pulse: false, d: 0.0, o: 0.18 },
];

// Layer C — 6 rare premium bloom stars, fully static
const STAR_C = [
  { x: 22, y: 15 },
  { x: 48, y:  6 },
  { x: 70, y: 28 },
  { x: 85, y: 55 },
  { x: 38, y: 70 },
  { x: 15, y: 48 },
];

// ── Keyframes ─────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes zpo-fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes zpo-fadeout {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes zpo-panel-open {
  from { opacity: 0; transform: translateY(-24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes zpo-panel-close {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-24px); }
}
@keyframes zpo-launch-float {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-3px); }
}
@keyframes zpo-badge-glow {
  0%,100% { opacity: 0.92; }
  50%     { opacity: 1; }
}
@keyframes zpo-sweep {
  0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
  40%  { opacity: 0.85; }
  100% { transform: translateX(260%) skewX(-18deg); opacity: 0; }
}
@keyframes zpo-bloom-pulse {
  0%,100% { opacity: var(--bo); }
  50%     { opacity: calc(var(--bo) * 1.9); }
}
.zpo-cta-btn {
  position: relative;
  overflow: hidden;
}
.zpo-cta-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
  transition: transform 0.75s ease;
  pointer-events: none;
}
.zpo-cta-btn:hover::before {
  transform: translateX(120%);
}

/* ── Mobile Responsiveness ──────────────────────────────────────────────── */
@media (max-width: 640px) {
  .zpo-click-outer {
    padding: 8px !important;
  }
  .zpo-panel {
    border-radius: 16px !important;
    min-height: calc(100vh - 16px) !important;
  }
  .zpo-hero {
    padding: 56px 20px 36px !important;
  }
  .zpo-launch-offer {
    flex-direction: column !important;
    gap: 4px !important;
  }
  .zpo-launch-offer span {
    font-size: 18px !important;
  }
  #pricing-plans {
    padding: 12px 16px !important;
    gap: 12px !important;
  }
  #pricing-plans > div {
    flex: 1 1 100% !important;
    min-width: unset !important;
    max-width: 100% !important;
  }
  .zpo-fcs-strip {
    padding: 0 16px !important;
  }
  .zpo-boost-wrap {
    padding: 0 16px !important;
  }
  .zpo-boost-inner {
    padding: 24px 20px !important;
  }
  .zpo-boost-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 12px !important;
  }
  .zpo-boost-preview {
    grid-column: 1 / -1 !important;
    min-height: 72px !important;
    align-self: auto !important;
  }
  .zpo-compare-section {
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }
  .zpo-compare-label {
    padding: 24px 16px 16px !important;
  }
  .zpo-compare-shell {
    padding: 0 0 24px !important;
  }
  .zpo-compare-inner {
    min-width: 560px;
    overflow: visible !important;
    padding: 0 16px;
  }
}
@media (min-width: 641px) and (max-width: 900px) {
  #pricing-plans {
    padding: 20px 24px 14px !important;
  }
  #pricing-plans > div {
    flex: 1 1 calc(50% - 16px) !important;
    min-width: unset !important;
    max-width: calc(50% - 9px) !important;
  }
}
`;

const CLOSE_MS = 320;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CheckIcon({ color = TEAL, size = 15 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="7.5" stroke={color} strokeOpacity="0.30" />
      <polyline points="4.5 8 7 10.5 11.5 5.5" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── BillingToggle ─────────────────────────────────────────────────────────────

function BillingToggle({ billing, onChange }: {
  billing: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  const yearly = billing === "yearly";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
      <button
        onClick={() => onChange("monthly")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          color: !yearly ? WHITE : "rgba(148,163,184,0.45)",
          transition: "color 0.22s", letterSpacing: "0.02em",
        }}
      >Monthly</button>

      <button
        onClick={() => onChange(yearly ? "monthly" : "yearly")}
        style={{
          width: 52, height: 28, borderRadius: 14, border: "none",
          background: yearly
            ? "linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%)"
            : "rgba(255,255,255,0.10)",
          position: "relative", cursor: "pointer", flexShrink: 0,
          transition: "background 0.30s ease",
          boxShadow: yearly ? "0 0 20px rgba(139,92,246,0.50)" : "none",
        }}
      >
        <div style={{
          position: "absolute", top: 4,
          left: yearly ? 27 : 4,
          width: 20, height: 20, borderRadius: 10, background: "#fff",
          transition: "left 0.25s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.40)",
          willChange: "left",
        }} />
      </button>

      <button
        onClick={() => onChange("yearly")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          color: yearly ? WHITE : "rgba(148,163,184,0.45)",
          transition: "color 0.22s", letterSpacing: "0.02em",
        }}
      >Yearly</button>

      <div style={{
        padding: "3px 14px", borderRadius: 20,
        background: `rgba(255,213,106,0.14)`,
        border: `1px solid rgba(255,213,106,0.38)`,
        fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
        color: GOLD, letterSpacing: "0.08em",
      }}>Save 20%</div>
    </div>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────────

function PricingCard({
  plan, billing, selected, onSelect, fcsEnabled, onFCSUpsell,
  businessSeats = 2, onBusinessSeatsChange,
}: {
  plan: Plan;
  billing: BillingCycle;
  selected: boolean;
  onSelect: (id: string) => void;
  fcsEnabled: boolean;
  onFCSUpsell: (plan: Plan) => void;
  businessSeats?: number;
  onBusinessSeatsChange?: (n: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const basePeriod    = billing === "yearly" ? "yr" : "mo";
  const displayImages = billing === "yearly" ? plan.images * 12 : plan.images;
  const displayClips  = billing === "yearly" ? plan.clips  * 12 : plan.clips;
  const outputLabel   = billing === "yearly" ? "/ year"         : "/ month";

  // Business workspace dynamic pricing
  const isBusiness          = plan.id === "business";
  const bSeats              = isBusiness ? businessSeats : 2;
  const bMonthlyPrice       = isBusiness ? 89 + (bSeats - 2) * 29    : plan.monthlyPrice;
  const bYearlyPrice        = isBusiness ? bMonthlyPrice * 10         : plan.yearlyPrice;
  const bCredits            = isBusiness ? 8000 + (bSeats - 2) * 4000 : plan.credits;
  const price               = billing === "yearly" ? bYearlyPrice : bMonthlyPrice;
  const displayCredits      = bCredits;
  // Launch discount — original (crossed) price; Business original scales with extra seats
  const displayOriginalPrice = billing === "yearly"
    ? null
    : isBusiness
      ? plan.originalPrice + (bSeats - 2) * 29
      : plan.originalPrice;

  // FCS CTA logic
  const isFCSDisabled = fcsEnabled && (plan.id === "starter" || plan.id === "creator");
  const hasFCSUpsell  = !fcsEnabled && (plan.id === "pro" || plan.id === "business");

  const active      = hovered || selected;
  const borderColor = active ? plan.border : plan.border.replace(/[\d.]+\)$/, "0.22)");
  const boxShadow   = active
    ? `${plan.hoverGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`
    : "inset 0 1px 0 rgba(255,255,255,0.08)";
  const transform   = hovered ? "scale(1.025)" : "scale(1)";

  return (
    <div
      style={{
        position: "relative",
        flex: "1 1 220px",
        minWidth: 215, maxWidth: 275,
        minHeight: 560,
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: 22,
        padding: "28px 26px",
        background: "linear-gradient(180deg, rgba(18,24,48,0.72) 0%, rgba(8,10,24,0.86) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1.5px solid ${borderColor}`,
        boxShadow,
        transform,
        transition: "transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s, border-color .28s",
        cursor: "pointer",
        willChange: "transform",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(plan.id)}
    >
      {/* Badge */}
      {plan.highlight && (
        <div style={{
          position: "absolute", top: -16, left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(90deg, #d946ef 0%, #8b5cf6 60%, #22d3ee 100%)",
          color: "#fff",
          fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700,
          letterSpacing: "0.14em", padding: "4px 18px",
          borderRadius: 20, whiteSpace: "nowrap",
          animation: "zpo-badge-glow 3s ease-in-out infinite",
        }}>★ MOST POPULAR</div>
      )}

      {/* ── TOP GROUP ── */}
      <div>
        {/* Plan name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isBusiness ? 8 : 16 }}>
          <span style={{ fontSize: 18 }}>{plan.icon}</span>
          <span style={{
            fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.18em", color: plan.border.replace(/[\d.]+\)$/, "1)"),
            textTransform: "uppercase",
          }}>{plan.name}</span>
        </div>

        {/* ── Business Workspace identity badge ── */}
        {isBusiness && (
          <div style={{ marginBottom: 14 }}>
            {/* Workspace label — 2-line, no icon */}
            <div style={{
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(59,130,246,0.10)",
              border: "1px solid rgba(59,130,246,0.28)",
              marginBottom: 10,
              width: "100%",
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.12em",
                color: "rgba(147,197,253,0.90)",
                textTransform: "uppercase",
              }}>Team Workspace</div>
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11, fontWeight: 500,
                color: "rgba(226,232,240,0.65)",
              }}>{bSeats} Seats Included</div>
            </div>

            {/* TEAM SIZE stepper */}
            <div style={{
              display: "flex", alignItems: "center", gap: 0,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 10,
              overflow: "hidden",
              width: "100%",
            }}>
              {/* Label */}
              <span style={{
                flex: 1,
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11.5, fontWeight: 600,
                color: "rgba(148,163,184,0.70)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "7px 10px",
              }}>Team Size</span>

              {/* Minus */}
              <button
                disabled={bSeats <= 2}
                onClick={e => { e.stopPropagation(); onBusinessSeatsChange?.(Math.max(2, bSeats - 1)); }}
                style={{
                  width: 32, height: 32,
                  border: "none",
                  borderLeft: "1px solid rgba(255,255,255,0.10)",
                  background: bSeats <= 2 ? "transparent" : "rgba(255,255,255,0.06)",
                  color: bSeats <= 2 ? "rgba(100,116,139,0.35)" : "rgba(226,232,240,0.80)",
                  cursor: bSeats <= 2 ? "not-allowed" : "pointer",
                  fontSize: 16, fontWeight: 300,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.18s, color 0.18s",
                }}
              >−</button>

              {/* Count */}
              <span style={{
                width: 32, textAlign: "center",
                fontFamily: "'Syne', sans-serif",
                fontSize: 14, fontWeight: 700,
                color: "#ffffff",
                borderLeft: "1px solid rgba(255,255,255,0.10)",
                borderRight: "1px solid rgba(255,255,255,0.10)",
                lineHeight: "32px",
                flexShrink: 0,
              }}>{bSeats}</span>

              {/* Plus */}
              <button
                disabled={bSeats >= 3}
                onClick={e => { e.stopPropagation(); onBusinessSeatsChange?.(Math.min(3, bSeats + 1)); }}
                style={{
                  width: 32, height: 32,
                  border: "none",
                  background: bSeats >= 3 ? "transparent" : "rgba(255,255,255,0.06)",
                  color: bSeats >= 3 ? "rgba(100,116,139,0.35)" : "rgba(226,232,240,0.80)",
                  cursor: bSeats >= 3 ? "not-allowed" : "pointer",
                  fontSize: 16, fontWeight: 300,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.18s, color 0.18s",
                }}
              >+</button>
            </div>

            {/* Enterprise upsell — shown only at max (3 seats) */}
            {bSeats >= 3 && (
              <div style={{
                marginTop: 7,
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11, lineHeight: 1.5,
                color: "rgba(148,163,184,0.60)",
                textAlign: "center",
              }}>
                Need larger teams?{" "}
                <span style={{
                  color: "rgba(255,255,255,0.75)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}>Contact Enterprise Sales</span>
              </div>
            )}
          </div>
        )}

        {/* Price */}
        <div style={{ marginBottom: 12 }}>
          {/* Crossed original price — monthly only */}
          {displayOriginalPrice && (
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 15, fontWeight: 500,
              color: "rgba(203,213,225,0.82)",
              textDecoration: "line-through",
              marginBottom: 2,
            }}>${displayOriginalPrice}/mo</div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, lineHeight: 1 }}>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 40, fontWeight: 900,
              letterSpacing: "-0.04em",
              color: WHITE,
            }}>${price}</span>
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 15, color: "rgba(203,213,225,0.82)",
              marginBottom: 8,
            }}>/{basePeriod}</span>
          </div>
          {billing === "monthly" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 5,
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13, color: "rgba(203,213,225,0.75)",
            }}>
              <span>${bYearlyPrice} / yr</span>
              <span style={{
                color: GOLD, background: `rgba(255,213,106,0.10)`,
                border: `1px solid rgba(255,213,106,0.22)`,
                fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 8,
              }}>Save 20%</span>
            </div>
          )}
        </div>

        {/* Credits */}
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 15, fontWeight: 600,
          color: "rgba(226,232,240,0.78)",
          marginBottom: 14,
        }}>
          {displayCredits.toLocaleString()} credits / month
        </div>

        {/* Output */}
        <div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 14, color: "rgba(203,213,225,0.85)", marginBottom: 3,
          }}>Create up to</div>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 20, fontWeight: 800,
            color: "#f8fafc", lineHeight: 1.1,
          }}>
            {displayImages.toLocaleString()}
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 15, color: "rgba(226,232,240,0.92)", marginTop: 3,
          }}>
            images or {displayClips} clips {outputLabel}
          </div>
        </div>

        {/* ── Included active models pills ── */}
        {!isBusiness && (
          <div style={{ marginTop: 18 }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 9.5, fontWeight: 700,
              letterSpacing: "0.10em", textTransform: "uppercase",
              color: "rgba(148,163,184,0.50)",
              marginBottom: 8,
            }}>Included Active Models</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {[
                { name: "GPT Image 2",       isNew: true  },
                { name: "Nano Banana 2",     isNew: true  },
                { name: "Seedream 4.5", isNew: false },
                { name: "FLUX.2",            isNew: false },
                { name: "Kling 3.0",         isNew: false },
                { name: "Seedance 2.0",      isNew: true  },
                { name: "Hailuo 2.3",        isNew: true  },
                { name: "Motion Control",    isNew: false },
                { name: "Lip Sync",          isNew: false },
                { name: "AI Influencer",     isNew: false },
              ].map(m => (
                <span key={m.name} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 10, fontWeight: 500,
                  color: "rgba(203,213,225,0.70)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 6,
                  padding: "3px 7px",
                }}>
                  {m.name}
                  {m.isNew && (
                    <span style={{
                      fontSize: 8, fontWeight: 700,
                      color: TEAL,
                      background: "rgba(34,211,238,0.10)",
                      border: "1px solid rgba(34,211,238,0.20)",
                      borderRadius: 4, padding: "1px 4px",
                      letterSpacing: "0.04em",
                    }}>NEW</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM GROUP ── */}
      <div>
        {/* Divider */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${plan.border}, transparent)`,
          marginBottom: 16,
        }} />

        {/* CTA button */}
        <button
          disabled={isFCSDisabled}
          className="zpo-cta-btn"
          style={{
            width: "100%", padding: "13px 0",
            borderRadius: 12,
            border: isFCSDisabled ? "1px solid rgba(71,85,105,0.28)" : plan.ctaBorder,
            background: isFCSDisabled ? "rgba(20,28,48,0.50)" : plan.ctaBg,
            color: isFCSDisabled ? "rgba(100,116,139,0.50)" : plan.ctaColor,
            fontFamily: isFCSDisabled ? "'Familjen Grotesk', sans-serif" : "'Syne', sans-serif",
            fontSize: isFCSDisabled ? 10.5 : 13,
            fontWeight: 600,
            letterSpacing: isFCSDisabled ? "0.03em" : "0.06em",
            cursor: isFCSDisabled ? "not-allowed" : "pointer",
            transition: "all 0.22s ease",
            marginBottom: 16,
            overflow: "hidden",
            position: "relative",
          }}
          onMouseEnter={e => {
            if (!isFCSDisabled) {
              e.currentTarget.style.boxShadow = plan.ctaHoverShadow;
              e.currentTarget.style.filter = "brightness(1.08)";
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.filter = "brightness(1)";
          }}
          onClick={e => {
            e.stopPropagation();
            if (isFCSDisabled) return;
            if (hasFCSUpsell) {
              onFCSUpsell(plan);
            } else {
              onSelect(plan.id);
            }
          }}
        >
          {isFCSDisabled ? "FCS requires Pro or Business" : plan.ctaLabel}
        </button>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {(isBusiness ? [
            `${bSeats} Team Seats, Shared Credit Pool`,
            "All Image & Video Models",
            "AI Audio & Voiceover",
            "Highest Priority Generation",
            "Workspace Asset Library",
            "Member Invite & Roles",
            "Dedicated Support",
          ] : plan.features).map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
              <CheckIcon color={plan.border.replace(/[\d.]+\)$/, "0.90)")} />
              <span style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 14, lineHeight: 1.55,
                color: BODY,
              }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FCSStrip — controlled ─────────────────────────────────────────────────────

function FCSStrip({ enabled, onToggle }: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="zpo-fcs-strip" style={{ margin: "0 auto", maxWidth: PRICING_CONTENT_MAX_WIDTH, width: "100%", padding: "0 32px" }}>
      <div style={{
        borderRadius: 20,
        background: `
          radial-gradient(circle at 10% 50%, rgba(255,180,60,.16), transparent 30%),
          linear-gradient(90deg, rgba(34,18,8,.62) 0%, rgba(40,18,52,.58) 100%)
        `,
        border: "1px solid rgba(255,213,106,0.75)",
        padding: "28px 36px",
        display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
        boxShadow: "0 0 28px rgba(255,180,60,.16), inset 0 1px 0 rgba(255,255,255,.08)",
      }}>
        {/* Left */}
        <div style={{ flex: "1 1 260px", display: "flex", alignItems: "flex-start", gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(255,180,60,0.22) 0%, rgba(139,92,246,0.20) 100%)",
            border: "1.5px solid rgba(255,213,106,0.50)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26,
            boxShadow: "0 0 22px rgba(255,180,60,0.22)",
          }}>🎬</div>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
              letterSpacing: "0.08em", color: GOLD, textTransform: "uppercase",
              marginBottom: 6,
              textShadow: "0 0 24px rgba(255,213,106,0.55)",
            }}>Future Cinema Studio</div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13.5,
              color: BODY, lineHeight: 1.65, maxWidth: 380,
            }}>
              Unlock cinematic filmmaking tools. Advanced directors mode, shot control,
              timeline editor, professional export and more.
            </div>
          </div>
        </div>

        {/* Price columns */}
        <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          {[
            { label: "For Pro",      price: "+$29", credits: "+800 credits / month" },
            { label: "For Business", price: "+$49", credits: "+1,800 credits / month" },
          ].map((item, i) => (
            <div key={i} style={{ display: "contents" }}>
              {i === 1 && (
                <div style={{ width: 1, height: 52, background: "rgba(255,213,106,0.18)" }} />
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
                  color: "rgba(203,213,225,0.65)", marginBottom: 5, letterSpacing: "0.04em",
                }}>{item.label}</div>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
                  color: WHITE, letterSpacing: "-0.025em",
                }}>
                  {item.price}
                  <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.45)" }}>/mo</span>
                </div>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
                  color: "rgba(148,163,184,0.55)", marginTop: 3,
                }}>{item.credits}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <button
            onClick={() => onToggle(!enabled)}
            style={{
              width: 58, height: 32, borderRadius: 16, border: "none",
              background: enabled
                ? `linear-gradient(135deg, ${GOLD} 0%, #8b5cf6 100%)`
                : "rgba(51,65,85,0.90)",
              position: "relative", cursor: "pointer",
              transition: "background 0.30s ease",
              outline: enabled ? "none" : "1px solid rgba(148,163,184,0.22)",
              boxShadow: enabled
                ? "0 0 28px rgba(255,213,106,0.55), 0 0 56px rgba(255,213,106,0.22)"
                : "none",
            }}
          >
            <div style={{
              position: "absolute", top: 4, left: enabled ? 30 : 4,
              width: 24, height: 24, borderRadius: 12, background: "#fff",
              transition: "left 0.25s cubic-bezier(0.22,1,0.36,1)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.38)",
              willChange: "left",
            }} />
          </button>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, fontWeight: 600,
            color: enabled ? GOLD : "rgba(148,163,184,0.75)",
            transition: "color 0.22s",
          }}>{enabled ? "Enabled" : "Enable FCS"}</span>
        </div>
      </div>
    </div>
  );
}

// ── BoostSelector — null default, deselect support ────────────────────────────

function BoostSelector() {
  const [selected, setSelected] = useState<number | null>(null);

  const pack       = selected !== null ? BOOST_PACKS[selected] : null;
  const packLabels = ["Starter Pack", "Creator Pack", "Studio Pack", "Pro Pack"];
  const packIcons  = ["⚡", "🚀", "🎬", "💎"];

  return (
    <div className="zpo-boost-wrap" style={{ margin: "0 auto", maxWidth: PRICING_CONTENT_MAX_WIDTH, width: "100%", padding: "0 32px" }}>
      <div className="zpo-boost-inner" style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(14,165,160,0.06) 0%, rgba(14,165,160,0.02) 100%)",
        border: "1px solid rgba(14,165,160,0.18)",
        padding: "32px 40px",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
              letterSpacing: "0.08em", color: WHITE, textTransform: "uppercase",
            }}>Boost Credit Packs</div>
          </div>
          {/* Deselect / status indicator */}
          {selected !== null ? (
            <button
              onClick={() => setSelected(null)}
              style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)",
                borderRadius: 8, padding: "5px 12px", cursor: "pointer",
                fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11, fontWeight: 600,
                color: "rgba(239,68,68,0.70)", letterSpacing: "0.04em",
                transition: "all 0.18s ease",
                flexShrink: 0, marginTop: 6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.16)";
                e.currentTarget.style.color = "rgba(239,68,68,0.90)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                e.currentTarget.style.color = "rgba(239,68,68,0.70)";
              }}
            >✕ Remove boost</button>
          ) : (
            <div style={{
              padding: "5px 12px", borderRadius: 8, marginTop: 6, flexShrink: 0,
              background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.18)",
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11, fontWeight: 600,
              color: "rgba(94,234,212,0.50)", letterSpacing: "0.04em",
            }}>Optional</div>
          )}
        </div>

        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13.5,
          color: "rgba(203,213,225,0.70)", marginBottom: 24,
        }}>
          Add extra credits when you need more. Boost credits expire after 90 days.
        </div>

        {/* Single-row grid: 4 pack cards + preview card */}
        <div className="zpo-boost-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) 260px", alignItems: "stretch", gap: 16 }}>
          {BOOST_PACKS.map((b, i) => {
            const isActive = i === selected;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                style={{
                  padding: "18px 12px",
                  borderRadius: 16,
                  border: `1.5px solid ${isActive ? TEAL : "rgba(30,41,59,0.75)"}`,
                  background: isActive
                    ? "linear-gradient(135deg, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0.06) 100%)"
                    : "rgba(15,23,42,0.65)",
                  cursor: "pointer",
                  textAlign: "center",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                  transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                  boxShadow: isActive
                    ? "0 0 20px rgba(34,211,238,0.30), 0 0 40px rgba(34,211,238,0.12)"
                    : "none",
                  willChange: "transform",
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.borderColor = "rgba(34,211,238,0.40)";
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.borderColor = "rgba(30,41,59,0.75)";
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 8 }}>{packIcons[i]}</div>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.10em", textTransform: "uppercase",
                  color: isActive ? TEAL : "rgba(100,116,139,0.60)", marginBottom: 8,
                }}>{packLabels[i]}</div>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800,
                  color: isActive ? WHITE : "rgba(226,232,240,0.55)",
                  letterSpacing: "-0.03em", lineHeight: 1,
                }}>+{b.credits.toLocaleString()}</div>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 10,
                  color: "rgba(148,163,184,0.50)", marginTop: 3,
                }}>credits</div>
                <div style={{
                  marginTop: 10,
                  fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700,
                  color: isActive ? TEAL : "rgba(100,116,139,0.55)",
                }}>${b.price}</div>
              </button>
            );
          })}

          {/* Preview card — 5th column */}
          <div className="zpo-boost-preview" style={{
            alignSelf: "stretch",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 18,
            background: "#0b0614",
            border: `1px solid ${pack ? "rgba(139,92,246,0.28)" : "rgba(139,92,246,0.12)"}`,
            boxShadow: pack ? "0 0 28px rgba(139,92,246,0.10)" : "none",
            position: "relative",
            overflow: "hidden",
            textAlign: "center",
            transition: "border-color 0.30s ease, box-shadow 0.30s ease",
          }}>
            {/* Sweep light — only when pack selected */}
            {pack && (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
                animation: "zpo-sweep 3.5s ease-in-out infinite",
                pointerEvents: "none",
                willChange: "transform",
              }} />
            )}
            <div style={{ position: "relative", zIndex: 1 }}>
              {pack ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "clamp(22px, 2.5vw, 32px)",
                    fontWeight: 800,
                    color: WHITE, letterSpacing: "-0.04em", lineHeight: 1,
                    transition: "all 0.22s ease",
                  }}>+{pack.credits.toLocaleString()}</div>
                  <div style={{
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: 13, color: "rgba(203,213,225,0.65)", marginTop: 6,
                  }}>credits instantly</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 26, marginBottom: 10, opacity: 0.28 }}>⚡</div>
                  <div style={{
                    fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, fontWeight: 600,
                    color: "rgba(148,163,184,0.35)", lineHeight: 1.5,
                  }}>No boost<br />selected</div>
                  <div style={{
                    fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 10.5,
                    color: "rgba(100,116,139,0.30)", marginTop: 8,
                  }}>Select a pack to add credits</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ComparisonTable ───────────────────────────────────────────────────────────

function ComparisonTable() {
  // Colors aligned to each plan's border hue
  const planColors = [
    "rgba(255,255,255,0.82)",    // Starter — white
    "rgba(236,72,153,0.90)",     // Creator — pink
    "rgba(52,211,153,0.90)",     // Pro — teal-green
    "rgba(59,130,246,0.92)",     // Business — blue
  ];

  const renderVal = (val: string | boolean, colIdx: number) => {
    if (val === true) return <CheckIcon color={planColors[colIdx]} size={15} />;
    if (val === "—") return (
      <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 14, color: "rgba(71,85,105,0.40)" }}>—</span>
    );
    if (val === "Add-on") return (
      <span style={{
        fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11, fontWeight: 600,
        color: AMBER, background: "rgba(245,158,11,0.10)",
        border: "1px solid rgba(245,158,11,0.24)",
        borderRadius: 6, padding: "2px 9px", whiteSpace: "nowrap",
      }}>Add-on</span>
    );
    return (
      <span style={{
        fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12.5,
        color: "rgba(241,245,249,0.86)",
        ...(colIdx === 1 ? { fontWeight: 600 } : {}),
      }}>{val as string}</span>
    );
  };

  return (
    <section className="zpo-compare-section" style={{
      margin: "0 auto",
      maxWidth: PRICING_CONTENT_MAX_WIDTH,
      width: "100%",
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)",
      background: "#0b0614",
    }}>
      {/* Label */}
      <div className="zpo-compare-label" style={{ textAlign: "center", padding: "36px 32px 28px" }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.12em", color: "rgba(255,255,255,0.85)",
          textTransform: "uppercase",
          textShadow: "0 0 12px rgba(168,139,255,0.25)",
        }}>Compare All Features</div>
      </div>

      {/* Table shell */}
      <div className="zpo-compare-shell" style={{ padding: "0 32px 36px" }}>
        <div className="zpo-compare-inner" style={{ overflow: "hidden" }}>

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.2fr repeat(4, minmax(120px, 1fr))",
            padding: "14px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(255,255,255,0.75)", fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>Feature</div>

            {PLANS.map((p, i) => (
              <div key={p.id} style={{ textAlign: "center", padding: "4px 8px" }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: i === 1 ? "#EC4899" : "rgba(255,255,255,0.55)",
                  ...(i === 1 ? { fontWeight: 600 } : {}),
                }}>
                  {p.icon} {p.name}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {COMPARE_FEATURES.map((row, rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr repeat(4, minmax(120px, 1fr))",
                minHeight: 64,
                borderBottom: rowIdx < COMPARE_FEATURES.length - 1
                  ? "1px solid rgba(255,255,255,0.06)" : "none",
                alignItems: "center",
                transition: "background 0.20s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Feature label */}
              <div style={{ padding: "16px 0" }}>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 13.5, fontWeight: 600,
                  color: "rgba(241,245,249,0.86)", marginBottom: 2,
                }}>{row.icon} {row.name}</div>
                <div style={{
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 11.5, color: "rgba(148,163,184,0.55)",
                }}>{row.sub}</div>
              </div>

              {/* Value cells */}
              {row.values.map((val, colIdx) => (
                <div key={colIdx} style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  padding: "4px 8px", height: "100%",
                  background: colIdx === 1 ? "rgba(236,72,153,0.08)" : "transparent",
                  borderRadius: 0,
                }}>
                  {renderVal(val as string | boolean, colIdx)}
                </div>
              ))}
            </div>
          ))}

        </div>
      </div>
    </section>
  );
}

// ── FCSUpsellModal ────────────────────────────────────────────────────────────

function FCSUpsellModal({
  plan,
  onAddFCS,
  onContinue,
  onDismiss,
}: {
  plan: Plan;
  onAddFCS: () => void;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const fcsPrice = plan.id === "pro" ? "+$29" : "+$49";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1400,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "zpo-fadein 0.22s ease",
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          maxWidth: 520, width: "100%",
          background: "linear-gradient(160deg, #0B0F2A 0%, #12143A 50%, #1A1040 100%)",
          border: "1px solid rgba(255,213,106,0.35)",
          borderRadius: 20,
          padding: "36px 32px 32px",
          boxShadow: "0 0 60px rgba(139,92,246,0.25), 0 0 120px rgba(255,213,106,0.06)",
          position: "relative",
          animation: "zpo-panel-open 0.35s cubic-bezier(0.22,1,0.36,1)",
          willChange: "opacity, transform",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Dismiss X */}
        <button
          onClick={onDismiss}
          style={{
            position: "absolute", top: 16, right: 16,
            width: 32, height: 32, borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(3,6,18,0.60)",
            color: "rgba(148,163,184,0.65)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.18s",
            padding: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(239,68,68,0.16)";
            e.currentTarget.style.color = "#EF4444";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(3,6,18,0.60)";
            e.currentTarget.style.color = "rgba(148,163,184,0.65)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18,
          padding: "4px 12px", borderRadius: 20,
          background: "rgba(255,213,106,0.10)",
          border: "1px solid rgba(255,213,106,0.30)",
        }}>
          <span style={{ fontSize: 12 }}>🎬</span>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 10, fontWeight: 600,
            color: GOLD, letterSpacing: "0.10em", textTransform: "uppercase",
          }}>Future Cinema Studio</span>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
          color: WHITE, letterSpacing: "-0.02em", margin: "0 0 10px",
        }}>Add Future Cinema Studio?</h3>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13.5,
          color: BODY, lineHeight: 1.65, margin: "0 0 20px",
        }}>
          Unlock cinematic workflows, advanced director tools, and professional sequence control.
        </p>

        {/* 16:9 video */}
        <div style={{
          position: "relative", paddingBottom: "56.25%",
          borderRadius: 12, overflow: "hidden", marginBottom: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(5,2,15,0.80)",
        }}>
          <video
            src="/pricing/fcs-preview.mp4"
            autoPlay muted loop playsInline
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
          {/* Fallback */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, rgba(30,10,80,0.55), rgba(5,2,15,0.75))",
          }} />
        </div>

        {/* Price info */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 24,
          padding: "12px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ fontSize: 16 }}>{plan.icon}</span>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13,
            color: "rgba(203,213,225,0.65)",
          }}>Add-on for {plan.name}</span>
          <span style={{
            marginLeft: "auto",
            fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
            color: WHITE,
          }}>
            {fcsPrice}
            <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.45)" }}>/mo</span>
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onAddFCS}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${GOLD} 0%, #F59E0B 100%)`,
              color: "#07050F",
              fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800,
              letterSpacing: "0.04em", cursor: "pointer",
              transition: "filter 0.18s ease, transform 0.18s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.filter = "brightness(1.08)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >Add FCS</button>

          <button
            onClick={onContinue}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "transparent",
              color: "rgba(203,213,225,0.55)",
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, fontWeight: 600,
              letterSpacing: "0.02em", cursor: "pointer",
              transition: "color 0.18s ease, border-color 0.18s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "rgba(203,213,225,0.88)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "rgba(203,213,225,0.55)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
            }}
          >Continue without FCS</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PricingOverlay
// ─────────────────────────────────────────────────────────────────────────────

export function PricingOverlay({ onClose }: PricingOverlayProps) {
  const [billing, setBilling]           = useState<BillingCycle>("monthly");
  const [selected, setSelected]         = useState<string>("creator");
  const [closing, setClosing]           = useState(false);
  const [fcsEnabled, setFcsEnabled]     = useState(false);
  const [showFCSModal, setShowFCSModal] = useState(false);
  const [pendingPlan, setPendingPlan]   = useState<Plan | null>(null);
  const [businessSeats, setBusinessSeats] = useState<number>(2);

  // Inject keyframes once
  useEffect(() => {
    const id = "zpo-kf-v9";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = KEYFRAMES;
      document.head.appendChild(s);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(), CLOSE_MS);
  }, [closing, onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleClose]);

  // FCS upsell modal handlers
  const handleFCSUpsell = useCallback((plan: Plan) => {
    setPendingPlan(plan);
    setShowFCSModal(true);
  }, []);

  const handleModalAddFCS = useCallback(() => {
    setFcsEnabled(true);
    if (pendingPlan) setSelected(pendingPlan.id);
    setShowFCSModal(false);
    setPendingPlan(null);
  }, [pendingPlan]);

  const handleModalContinue = useCallback(() => {
    if (pendingPlan) setSelected(pendingPlan.id);
    setShowFCSModal(false);
    setPendingPlan(null);
  }, [pendingPlan]);

  const handleModalDismiss = useCallback(() => {
    setShowFCSModal(false);
    setPendingPlan(null);
  }, []);

  return (
    <>
      {/* FCS Upsell Modal — above the overlay */}
      {showFCSModal && pendingPlan && (
        <FCSUpsellModal
          plan={pendingPlan}
          onAddFCS={handleModalAddFCS}
          onContinue={handleModalContinue}
          onDismiss={handleModalDismiss}
        />
      )}

      {/* ── Backdrop ── */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 1200,
          overflowY: "auto",
          background: "rgba(0,0,0,0.72)",
          // Reduced from 18px — main perf win during scroll
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: closing
            ? `zpo-fadeout ${CLOSE_MS}ms ease forwards`
            : "zpo-fadein 420ms cubic-bezier(0.22,1,0.36,1)",
          willChange: "opacity",
        }}
      >
        {/* ── Click-outside-to-close wrapper ── */}
        <div
          className="zpo-click-outer"
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position: "relative", zIndex: 3,
            minHeight: "100%",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          {/* ── Glass panel ── */}
          <div
            className="zpo-panel"
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 1440,
              minHeight: "calc(100vh - 48px)",
              position: "relative",
              borderRadius: 24,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.14)",
              // No backdropFilter on panel — redundant & expensive on top of backdrop
              background: PRICING_PANEL_BG ? "transparent" : "rgba(3,6,18,0.60)",
              boxShadow: "0 0 48px rgba(104,80,255,0.12), inset 0 0 48px rgba(255,255,255,0.02)",
              // Panel slides DOWN from above — cubic-bezier spring
              animation: closing
                ? `zpo-panel-close ${CLOSE_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`
                : "zpo-panel-open 420ms cubic-bezier(0.22,1,0.36,1)",
              willChange: "opacity, transform",
            }}
          >
            {/* ── Panel background layers ── */}
            {PRICING_PANEL_BG ? (
              <div style={{
                position: "absolute", inset: 0, zIndex: 0,
                backgroundImage: `url(${PRICING_PANEL_BG})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
                pointerEvents: "none",
              }} />
            ) : (
              <>
                {/* Static gradient — NO drift animation (expensive on large element) */}
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  background: `
                    radial-gradient(circle at 18% 18%, rgba(70,110,255,0.28), transparent 32%),
                    radial-gradient(circle at 82% 18%, rgba(255,55,180,0.34), transparent 34%),
                    radial-gradient(circle at 50% 70%, rgba(120,30,255,0.22), transparent 42%),
                    linear-gradient(180deg, #050716 0%, #07051a 48%, #05020d 100%)
                  `,
                  pointerEvents: "none",
                }} />

                {/* ── 3-layer cinematic star system ── */}
                {/* Layer A: pure CSS tiny distant stars — zero DOM elements, zero animation */}
                <div style={{
                  position: "absolute", inset: 0, zIndex: 1,
                  pointerEvents: "none", overflow: "hidden",
                  backgroundImage: `
                    radial-gradient(circle 1px at  7%  5%, rgba(255,255,255,0.20) 0%, transparent 100%),
                    radial-gradient(circle 1px at 15% 28%, rgba(255,255,255,0.16) 0%, transparent 100%),
                    radial-gradient(circle 1px at 24% 12%, rgba(255,255,255,0.18) 0%, transparent 100%),
                    radial-gradient(circle 1px at 33% 42%, rgba(255,255,255,0.14) 0%, transparent 100%),
                    radial-gradient(circle 1px at 41%  8%, rgba(255,255,255,0.17) 0%, transparent 100%),
                    radial-gradient(circle 1px at 52% 35%, rgba(255,255,255,0.13) 0%, transparent 100%),
                    radial-gradient(circle 1px at 60% 18%, rgba(255,255,255,0.19) 0%, transparent 100%),
                    radial-gradient(circle 1px at 68% 50%, rgba(255,255,255,0.14) 0%, transparent 100%),
                    radial-gradient(circle 1px at 75%  7%, rgba(255,255,255,0.16) 0%, transparent 100%),
                    radial-gradient(circle 1px at 83% 30%, rgba(255,255,255,0.13) 0%, transparent 100%),
                    radial-gradient(circle 1px at 90% 15%, rgba(255,255,255,0.18) 0%, transparent 100%),
                    radial-gradient(circle 1px at 92% 60%, rgba(255,255,255,0.12) 0%, transparent 100%),
                    radial-gradient(circle 1px at  3% 70%, rgba(255,255,255,0.15) 0%, transparent 100%),
                    radial-gradient(circle 1px at 46% 65%, rgba(255,255,255,0.13) 0%, transparent 100%),
                    radial-gradient(circle 1px at 57% 90%, rgba(255,255,255,0.16) 0%, transparent 100%),
                    radial-gradient(circle 1px at 88% 88%, rgba(255,255,255,0.14) 0%, transparent 100%),
                    radial-gradient(circle 1px at 20% 85%, rgba(255,255,255,0.12) 0%, transparent 100%),
                    radial-gradient(circle 1px at 78% 80%, rgba(255,255,255,0.15) 0%, transparent 100%)
                  `,
                }} />

                {/* Layer B: 2px soft glow stars — opacity pulse on 5, static on rest */}
                <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
                  {STAR_B.map((star, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      left: `${star.x}%`, top: `${star.y}%`,
                      width: 2, height: 2,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.92)",
                      boxShadow: "0 0 8px rgba(255,255,255,0.35)",
                      opacity: star.o,
                      animation: star.pulse
                        ? `zpo-bloom-pulse ${7 + i * 0.8}s ${star.d}s ease-in-out infinite`
                        : undefined,
                      willChange: star.pulse ? "opacity" : undefined,
                      "--bo": star.o,
                    } as React.CSSProperties} />
                  ))}
                </div>

                {/* Layer C: 3px rare premium bloom — radial-gradient, fully static */}
                <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
                  {STAR_C.map((star, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      left: `${star.x}%`, top: `${star.y}%`,
                      width: 3, height: 3,
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(255,255,255,0.90), rgba(165,180,252,0.25), transparent 70%)",
                      filter: "blur(0.2px)",
                      opacity: 0.25,
                    }} />
                  ))}
                </div>

                {/* Vignette */}
                <div style={{
                  position: "absolute", inset: 0, zIndex: 2,
                  boxShadow: "inset 0 0 180px rgba(0,0,0,0.75)",
                  pointerEvents: "none",
                }} />
              </>
            )}

            {/* ── Close button ── */}
            <button
              onClick={handleClose}
              title="Close (Esc)"
              style={{
                position: "absolute", top: 24, right: 24, zIndex: 10,
                width: 40, height: 40, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(3,6,18,0.72)",
                backdropFilter: "blur(12px)",
                color: "rgba(148,163,184,0.72)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.18s", padding: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.16)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)";
                e.currentTarget.style.color = "#EF4444";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(3,6,18,0.72)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "rgba(148,163,184,0.72)";
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* ── Content wrapper ── */}
            <div style={{ position: "relative", zIndex: 3 }}>

              {/* ── Hero ── */}
              <div
                className="zpo-hero"
                style={{ textAlign: "center", padding: "88px 24px 52px", position: "relative", overflow: "hidden" }}
              >
                {/* ── Static cinematic preview cards — behind headline ── */}
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  overflow: "hidden",
                  pointerEvents: "none",
                  zIndex: 0,
                  opacity: 0.62,
                }}>
                  {/* Edge fade — outer cards partially clipped */}
                  <div style={{
                    position: "absolute", inset: 0, zIndex: 2,
                    background: "linear-gradient(90deg, rgba(5,7,22,0.92) 0%, transparent 14%, transparent 86%, rgba(5,7,22,0.92) 100%)",
                  }} />
                  {/* Bottom fade — blends cards into content below */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: "40%", zIndex: 2,
                    background: "linear-gradient(to bottom, transparent, rgba(5,7,22,0.85))",
                  }} />
                  {/* Card row — positioned near top so they sit behind the headline */}
                  <div style={{
                    position: "absolute",
                    top: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    width: "max-content",
                  }}>
                    {REEL_IMAGES.map((src, i) => {
                      const FALLBACK_GRADIENTS = [
                        "linear-gradient(135deg, rgba(55,30,160,0.95), rgba(20,10,60,1))",
                        "linear-gradient(135deg, rgba(100,20,170,0.95), rgba(30,8,70,1))",
                        "linear-gradient(135deg, rgba(20,60,180,0.95), rgba(8,20,70,1))",
                        "linear-gradient(135deg, rgba(160,20,100,0.95), rgba(60,8,40,1))",
                        "linear-gradient(135deg, rgba(40,110,200,0.95), rgba(10,35,80,1))",
                      ];
                      return (
                        <div key={i} style={{
                          width: 300, height: 169,
                          flexShrink: 0,
                          borderRadius: 14,
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.14)",
                          position: "relative",
                          background: FALLBACK_GRADIENTS[i],
                          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                        }}>
                          <img
                            src={src}
                            alt=""
                            style={{
                              width: "100%", height: "100%", objectFit: "cover",
                              position: "absolute", inset: 0,
                              display: "block",
                            }}
                          />
                          {/* Dark overlay — 30% (70% image visible) */}
                          <div style={{
                            position: "absolute", inset: 0,
                            background: "rgba(0,0,0,0.30)",
                          }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Hero text ── */}
                <div style={{ position: "relative", zIndex: 1 }}>
                  <h1 style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "clamp(28px, 4.8vw, 80px)",
                    fontWeight: 900, lineHeight: 0.95,
                    letterSpacing: "-0.045em",
                    margin: "0 0 24px",
                    background: "linear-gradient(90deg, #ffffff 0%, #f7f4ff 42%, #d946ef 72%, #7c8cff 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                    Create Without Limits
                  </h1>

                  {/* Model chips */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 10, flexWrap: "wrap", marginBottom: 24,
                  }}>
                    {["Nano Banana 2", "FLUX.2", "Seedream 4.5", "Kling 3.0"].map((m, i) => (
                      <span key={m} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, fontWeight: 600,
                          color: "rgba(203,213,225,0.65)", letterSpacing: "0.03em",
                        }}>{m}</span>
                        {i < 3 && <span style={{ color: "rgba(100,116,139,0.35)", fontSize: 10 }}>•</span>}
                      </span>
                    ))}
                  </div>

                  {/* Launch offer */}
                  <div className="zpo-launch-offer" style={{
                    display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28,
                  }}>
                    <span style={{
                      fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
                      color: "rgba(255,255,255,0.92)",
                    }}>Launch Offer —</span>
                    <span style={{
                      fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
                      background: `linear-gradient(135deg, ${GOLD} 0%, #fcd34d 100%)`,
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>Up to 40% OFF</span>
                  </div>

                  <p style={{
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: "clamp(14px, 1.8vw, 16px)",
                    color: "rgba(230,237,243,0.75)",
                    margin: "0 auto 44px", maxWidth: 460, lineHeight: 1.65,
                  }}>
                    Generate images, videos, and audio with cutting-edge AI models and tools.
                  </p>

                  <BillingToggle billing={billing} onChange={setBilling} />
                </div>
              </div>

              {/* ── Pricing cards ── */}
              <div id="pricing-plans" style={{
                display: "flex", gap: 18,
                padding: "28px 32px 20px",
                maxWidth: PRICING_CONTENT_MAX_WIDTH, margin: "0 auto",
                justifyContent: "center",
                alignItems: "stretch",
                flexWrap: "wrap",
              }}>
                {PLANS.map(plan => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    billing={billing}
                    selected={selected === plan.id}
                    onSelect={setSelected}
                    fcsEnabled={fcsEnabled}
                    onFCSUpsell={handleFCSUpsell}
                    businessSeats={plan.id === "business" ? businessSeats : undefined}
                    onBusinessSeatsChange={plan.id === "business" ? setBusinessSeats : undefined}
                  />
                ))}
              </div>

              {/* ── FCS Strip — controlled ── */}
              <div id="fcs-addon" style={{ marginBottom: 40 }}>
                <div style={{
                  textAlign: "center", marginBottom: 20,
                  display: "flex", alignItems: "center", gap: 16,
                  maxWidth: PRICING_CONTENT_MAX_WIDTH, margin: "0 auto 20px",
                  padding: "0 32px",
                }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,213,106,0.12)" }} />
                  <span style={{
                    fontFamily: "'Syne', sans-serif", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: "rgba(255,213,106,0.55)",
                  }}>Optional Add-on</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,213,106,0.12)" }} />
                </div>
                <FCSStrip
                  enabled={fcsEnabled}
                  onToggle={(v) => setFcsEnabled(v)}
                />
              </div>

              {/* ── Boost Selector ── */}
              <div style={{ marginBottom: 60 }}>
                <BoostSelector />
              </div>

              {/* ── Comparison Table ── */}
              <div style={{ marginBottom: 64 }}>
                <ComparisonTable />
              </div>

              {/* ── Bottom CTA ── */}
              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                padding: "64px 24px 0",
                position: "relative", overflow: "hidden",
                background: "linear-gradient(135deg, #0B0F2A 0%, #12143A 40%, #1A1040 75%, #0B0614 100%)",
                boxShadow: "inset 0 0 120px rgba(0,0,0,0.8)",
              }}>

                <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                  <h2 style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: "clamp(24px, 4vw, 40px)",
                    fontWeight: 800, color: WHITE,
                    letterSpacing: "-0.025em", margin: "0 0 12px",
                  }}>
                    Ready to bring your ideas to life?
                  </h2>
                  <p style={{
                    fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 15,
                    color: "rgba(230,237,243,0.75)",
                    margin: "0 auto 40px", maxWidth: 380, lineHeight: 1.6,
                  }}>
                    Join thousands of creators building the future with Zencra.
                  </p>
                  <button className="zpo-cta-btn" style={{
                    padding: "16px 56px", borderRadius: 14, border: "none",
                    background: "linear-gradient(135deg, #2563EB, #4F46E5, #7C3AED)",
                    color: "#fff", fontFamily: "'Syne', sans-serif",
                    fontSize: 16, fontWeight: 700, letterSpacing: "0.04em",
                    cursor: "pointer",
                    boxShadow: "none",
                    transition: "transform 0.25s ease, box-shadow 0.25s ease",
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "scale(1.04)";
                      e.currentTarget.style.boxShadow = "0 0 24px rgba(124,58,237,0.55), 0 0 48px rgba(37,99,235,0.35)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    onClick={() =>
                      document.getElementById("pricing-plans")?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Choose your plan →
                  </button>
                </div>

                {/* Trust bar */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 16,
                  margin: "52px auto 0", maxWidth: PRICING_CONTENT_MAX_WIDTH, width: "100%", padding: "20px 32px",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    {[
                      { icon: "🔒", text: "Secure payments" },
                      { icon: "✓",  text: "Cancel anytime" },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ color: TEAL, fontSize: 13 }}>{item.icon}</span>
                        <span style={{
                          fontFamily: "'Familjen Grotesk', sans-serif",
                          fontSize: 12.5, color: "rgba(148,163,184,0.70)",
                        }}>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {["#8B5CF6", "#22d3ee", "#EC4899", "#FFD56A", "#3B82F6"].map((color, i) => (
                        <div key={i} style={{
                          width: 28, height: 28, borderRadius: 14,
                          background: `radial-gradient(circle at 35% 35%, ${color}BB, ${color}55)`,
                          border: "2px solid rgba(3,6,18,0.90)",
                          marginLeft: i === 0 ? 0 : -8,
                          zIndex: 5 - i, position: "relative",
                        }} />
                      ))}
                    </div>
                    <span style={{
                      fontFamily: "'Familjen Grotesk', sans-serif",
                      fontSize: 12.5, color: "rgba(148,163,184,0.70)",
                    }}>Trusted by creators worldwide</span>
                  </div>
                </div>

                {/* Legal — slightly brighter for readability */}
                <div style={{
                  textAlign: "center", padding: "24px 24px 48px",
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
                  color: "rgba(148,163,184,0.55)", lineHeight: 1.7,
                }}>
                  Prices shown in USD. Credit costs vary by model and resolution.<br />
                  All plans include a commercial license. Future Cinema Studio requires Pro or Business subscription.<br />
                  <span style={{ fontStyle: "italic" }}>ⓘ Output may vary based on model selection and quality settings.</span>
                  {" · "}Credits reset monthly. Unused credits do not roll over.
                </div>
              </div>

            </div>{/* /content wrapper */}
          </div>{/* /glass panel */}
        </div>{/* /click-outside wrapper */}
      </div>
    </>
  );
}

export default PricingOverlay;
