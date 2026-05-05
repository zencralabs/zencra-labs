"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PricingOverlay v6 — Figma-level alignment pass
// Fixes: Creator card no translateY (equal baseline), Business gradient-text CTA,
// yearly output ×12 with /year label, price 36px dominant, minHeight 520px cards,
// unified card padding, hover-only glow for all cards, FCS gold boost, polish.
// Typography: Syne (display/headings) · Familjen Grotesk (body/UI)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingOverlayProps {
  onClose: () => void;
}

type BillingCycle = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  images: number;
  clips: number;
  accentColor: string;
  glowColor: string;
  border: string;
  borderHover: string;
  ctaLabel: string;
  ctaBg: string;
  ctaColor: string;
  ctaBorder: string;
  ctaHoverShadow: string;
  ctaGradientText?: string;   // gradient applied to CTA label text (background-clip: text)
  highlight?: boolean;
  features: string[];
}

// ── Tokens ────────────────────────────────────────────────────────────────────

const TEAL    = "#0EA5A0";
const PURPLE  = "#8B5CF6";
const AMBER   = "#F59E0B";
const CYAN    = "#06B6D4";
const WHITE   = "#F8FAFC";
const BODY    = "#E6EDF3";   // Fix #9 — brighter body text
const MAGENTA = "#C026D3";

// ── Plans ─────────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    icon: "⚡",
    monthlyPrice: 12,
    yearlyPrice: 120,
    credits: 600,
    images: 75,
    clips: 5,
    accentColor: CYAN,
    glowColor: "rgba(6,182,212,0.55)",
    border: "rgba(6,182,212,0.18)",
    borderHover: "rgba(6,182,212,0.72)",
    ctaLabel: "Start Free (Upgrade later)",
    // Fix #4 — Starter: subtle outline (keep as-is)
    ctaBg: "transparent",
    ctaColor: CYAN,
    ctaBorder: `1.5px solid rgba(6,182,212,0.35)`,
    ctaHoverShadow: `0 0 24px rgba(6,182,212,0.35)`,
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
    credits: 1600,
    images: 200,
    clips: 13,
    accentColor: TEAL,
    glowColor: "rgba(192,38,211,0.65)",
    border: "rgba(14,165,160,0.40)",
    borderHover: "rgba(192,38,211,0.85)",
    ctaLabel: "Get Started",
    // Fix #4 — Creator: gradient teal/purple (keep as-is)
    ctaBg: "linear-gradient(135deg, #C026D3 0%, #8B5CF6 50%, #0EA5A0 100%)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 40px rgba(192,38,211,0.55), 0 0 80px rgba(139,92,246,0.28)",
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
    credits: 3500,
    images: 437,
    clips: 29,
    accentColor: PURPLE,
    glowColor: "rgba(139,92,246,0.55)",
    border: "rgba(139,92,246,0.18)",
    borderHover: "rgba(139,92,246,0.80)",
    ctaLabel: "Get Started",
    // Fix #4 — Pro: solid purple gradient, white text
    ctaBg: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: `0 0 32px rgba(124,58,237,0.55), 0 0 64px rgba(109,40,217,0.28)`,
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
    credits: 8000,
    images: 1000,
    clips: 66,
    accentColor: "#60A5FA",
    glowColor: "rgba(248,250,252,0.45)",
    border: "rgba(248,250,252,0.18)",
    borderHover: "rgba(248,250,252,0.90)",
    ctaLabel: "Get Started",
    // Fix — Business: white button, midnight-blue gradient TEXT (Apple-style)
    ctaBg: "#ffffff",
    ctaColor: "transparent",      // text color transparent so gradient shows
    ctaBorder: "none",
    ctaGradientText: "linear-gradient(90deg, #2563EB, #1E3A8A)",
    ctaHoverShadow: `0 0 20px rgba(255,255,255,0.30), 0 0 40px rgba(255,255,255,0.12)`,
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

// ── Boost packs ───────────────────────────────────────────────────────────────

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
    values: ["—", "Add-on", "Add-on", "Add-on"],
  },
  {
    icon: "💬",
    name: "Support",
    sub: "Get help when you need",
    values: ["Community", "Email", "Priority", "Dedicated"],
  },
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
@keyframes zpo-slideup {
  from { opacity: 0; transform: translateY(32px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes zpo-slidedown {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(24px) scale(0.97); }
}
@keyframes zpo-blob-1 {
  0%   { transform: translate(0, 0) scale(1.00); }
  30%  { transform: translate(60px, -40px) scale(1.08); }
  60%  { transform: translate(-30px, 50px) scale(1.05); }
  100% { transform: translate(0, 0) scale(1.00); }
}
@keyframes zpo-blob-2 {
  0%   { transform: translate(0, 0) scale(1.00); }
  35%  { transform: translate(-50px, 30px) scale(1.06); }
  65%  { transform: translate(40px, -20px) scale(1.04); }
  100% { transform: translate(0, 0) scale(1.00); }
}
@keyframes zpo-blob-3 {
  0%   { transform: translate(0, 0) scale(1.00); }
  40%  { transform: translate(30px, 50px) scale(1.07); }
  70%  { transform: translate(-40px, -30px) scale(1.03); }
  100% { transform: translate(0, 0) scale(1.00); }
}
@keyframes zpo-node-pulse {
  0%, 100% { box-shadow: 0 0 14px rgba(14,165,160,0.75), 0 0 28px rgba(14,165,160,0.40); }
  50%       { box-shadow: 0 0 28px rgba(14,165,160,1.0), 0 0 56px rgba(14,165,160,0.65); }
}
@keyframes zpo-badge-glow {
  0%, 100% { box-shadow: 0 0 16px rgba(192,38,211,0.55); }
  50%       { box-shadow: 0 0 28px rgba(192,38,211,0.85), 0 0 56px rgba(192,38,211,0.30); }
}
@keyframes zpo-star-twinkle {
  0%, 100% { opacity: 0.12; transform: scale(1); }
  50%       { opacity: 0.75; transform: scale(1.5); }
}
@keyframes zpo-launch-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-3px); }
}
`;

const CLOSE_MS = 330;

// ── Star field ────────────────────────────────────────────────────────────────

const STARS = [
  { top:  7, left: 13, size: 1.5, delay: 0.0  },
  { top: 15, left: 79, size: 2.0, delay: 0.9  },
  { top: 23, left: 44, size: 1.0, delay: 1.8  },
  { top:  4, left: 61, size: 2.5, delay: 2.3  },
  { top: 35, left: 89, size: 1.0, delay: 0.5  },
  { top: 46, left:  4, size: 1.5, delay: 1.3  },
  { top: 57, left: 34, size: 1.0, delay: 3.1  },
  { top: 71, left: 93, size: 2.0, delay: 0.7  },
  { top: 81, left: 17, size: 1.5, delay: 2.9  },
  { top: 91, left: 56, size: 1.0, delay: 1.5  },
  { top: 13, left: 31, size: 1.0, delay: 3.6  },
  { top: 66, left: 71, size: 2.0, delay: 1.0  },
  { top: 41, left: 53, size: 1.5, delay: 2.1  },
  { top: 29, left: 96, size: 1.0, delay: 1.8  },
  { top: 76, left: 41, size: 1.0, delay: 4.1  },
  { top: 19, left: 66, size: 2.0, delay: 3.3  },
  { top: 86, left: 83, size: 1.5, delay: 0.4  },
  { top: 51, left: 14, size: 1.0, delay: 2.6  },
  { top: 96, left: 29, size: 2.0, delay: 1.2  },
  { top:  2, left: 86, size: 1.0, delay: 4.3  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CheckIcon({ color = TEAL, size = 15 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={color} strokeOpacity="0.28" />
      <polyline points="4.5 8 7 10.5 11.5 5.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── BillingToggle ─────────────────────────────────────────────────────────────

function BillingToggle({ billing, onChange }: { billing: BillingCycle; onChange: (c: BillingCycle) => void }) {
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
      >
        Monthly
      </button>

      <button
        onClick={() => onChange(yearly ? "monthly" : "yearly")}
        style={{
          width: 50, height: 28, borderRadius: 14, border: "none",
          background: yearly
            ? `linear-gradient(135deg, ${PURPLE} 0%, ${TEAL} 100%)`
            : "rgba(255,255,255,0.10)",
          position: "relative", cursor: "pointer", flexShrink: 0,
          transition: "background 0.30s ease",
          boxShadow: yearly ? `0 0 20px rgba(139,92,246,0.50)` : "none",
        }}
      >
        <div style={{
          position: "absolute", top: 4,
          left: yearly ? 26 : 4,
          width: 20, height: 20, borderRadius: 10,
          background: "#fff",
          transition: "left 0.25s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.40)",
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
      >
        Yearly
      </button>

      <div style={{
        padding: "3px 14px", borderRadius: 20,
        background: "rgba(245,158,11,0.14)",
        border: "1px solid rgba(245,158,11,0.38)",
        fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
        color: AMBER, letterSpacing: "0.08em",
        animation: "zpo-launch-float 4s ease-in-out infinite",
      }}>
        Save 20%
      </div>
    </div>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────────

function PricingCard({
  plan,
  billing,
  selected,
  onSelect,
}: {
  plan: Plan;
  billing: BillingCycle;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const price  = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const period = billing === "yearly" ? "yr" : "mo";
  // Fix — yearly outputs: ×12 when yearly selected
  const displayImages = billing === "yearly" ? plan.images * 12 : plan.images;
  const displayClips  = billing === "yearly" ? plan.clips  * 12 : plan.clips;
  const outputLabel   = billing === "yearly" ? "/ year"         : "/ month";
  const active = hovered || selected;

  const borderColor = active ? plan.borderHover : plan.border;

  const boxShadow = active
    ? `0 0 48px ${plan.glowColor}, 0 0 100px ${plan.glowColor.replace("0.55", "0.22").replace("0.65", "0.28").replace("0.45", "0.18")}, inset 0 1px 0 rgba(255,255,255,0.06)`
    : "0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)";

  // Fix — ALL cards same baseline: NO translateY. Hover lifts uniformly.
  const transform = hovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)";

  const cardBg = plan.highlight
    ? "linear-gradient(160deg, rgba(192,38,211,0.07) 0%, rgba(14,165,160,0.05) 100%)"
    : "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)";

  return (
    <div
      style={{
        position: "relative",
        flex: "1 1 220px",
        minWidth: 215, maxWidth: 275,
        // Fix — equal height + uniform padding for all cards (incl. Creator)
        minHeight: 520,
        display: "flex", flexDirection: "column",
        borderRadius: 22,
        padding: "32px 24px 28px",   // unified — Creator badge is absolute, no offset needed
        background: cardBg,
        border: `1.5px solid ${borderColor}`,
        // Fix — Creator gets slightly stronger resting border to signal premium
        ...(plan.highlight ? { border: `1.5px solid ${borderColor}` } : {}),
        boxShadow,
        transform,
        transition: "box-shadow 0.35s ease, transform 0.30s cubic-bezier(0.22,1,0.36,1), border-color 0.25s ease",
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(plan.id)}
    >
      {/* Most Popular badge */}
      {plan.highlight && (
        <div style={{
          position: "absolute", top: -15, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 5,
          background: `linear-gradient(90deg, ${MAGENTA} 0%, ${PURPLE} 60%, ${TEAL} 100%)`,
          color: "#fff",
          fontSize: 10, fontFamily: "'Syne', sans-serif", fontWeight: 700,
          letterSpacing: "0.14em", padding: "4px 18px",
          borderRadius: 20, whiteSpace: "nowrap",
          animation: "zpo-badge-glow 3s ease-in-out infinite",
        }}>
          ★ MOST POPULAR
        </div>
      )}

      {/* Icon + Plan name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{plan.icon}</span>
        <span style={{
          fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.18em", color: plan.accentColor, textTransform: "uppercase",
        }}>
          {plan.name}
        </span>
      </div>

      {/* ── PRICE — dominant at 36px ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, lineHeight: 1 }}>
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 36, fontWeight: 800,
            letterSpacing: "-0.035em",
            color: WHITE,
          }}>
            ${price}
          </span>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 13, color: "rgba(148,163,184,0.50)",
            marginBottom: 7,
          }}>
            /{period}
          </span>
        </div>
        {billing === "monthly" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7, marginTop: 4,
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 11.5, color: "rgba(100,116,139,0.60)",
          }}>
            <span>${plan.yearlyPrice} / yr</span>
            <span style={{
              color: AMBER,
              background: "rgba(245,158,11,0.10)",
              border: "1px solid rgba(245,158,11,0.22)",
              fontSize: 10, fontWeight: 600,
              padding: "1px 7px", borderRadius: 8,
            }}>Save 20%</span>
          </div>
        )}
      </div>

      {/* Credits */}
      <div style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 12.5, fontWeight: 600,
        color: "rgba(203,213,225,0.72)",
        marginBottom: 14, letterSpacing: "0.01em",
      }}>
        {plan.credits.toLocaleString()} credits / month
      </div>

      {/* ── OUTPUT — secondary, 22px, shows yearly multiplied values ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 11.5, color: "rgba(148,163,184,0.55)", marginBottom: 2,
        }}>
          Create up to
        </div>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 22, fontWeight: 700,
          lineHeight: 1.2, letterSpacing: "-0.02em",
          ...(plan.highlight
            ? {
                background: `linear-gradient(135deg, ${WHITE} 0%, ${TEAL} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }
            : { color: WHITE }),
        }}>
          {displayImages.toLocaleString()}
        </div>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 13, fontWeight: 600,
          color: "rgba(203,213,225,0.80)",
          marginTop: 2,
        }}>
          images or {displayClips} video clips {outputLabel}
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`,
        marginBottom: 18,
      }} />

      {/* CTA button — Business uses gradient text technique */}
      <button
        style={{
          width: "100%", padding: "13px 0",
          borderRadius: 12,
          border: plan.ctaBorder,
          background: plan.ctaBg,
          color: plan.ctaColor,
          fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
          letterSpacing: "0.06em", cursor: "pointer",
          transition: "all 0.22s ease",
          marginBottom: 22,
          overflow: "hidden",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = plan.ctaHoverShadow;
          e.currentTarget.style.filter = "brightness(1.08)";
          e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.filter = "brightness(1)";
          e.currentTarget.style.transform = "scale(1)";
        }}
        onClick={e => e.stopPropagation()}
      >
        {plan.ctaGradientText ? (
          // Gradient text for Business — white button bg, gradient label
          <span style={{
            backgroundImage: plan.ctaGradientText,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontFamily: "'Syne', sans-serif", fontWeight: 700,
            letterSpacing: "0.06em",
          }}>
            {plan.ctaLabel}
          </span>
        ) : plan.ctaLabel}
      </button>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <div style={{ marginTop: 1 }}>
              <CheckIcon color={plan.accentColor} />
            </div>
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13, lineHeight: 1.45,
              color: BODY,                        // Fix #9
            }}>
              {f}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FCSStrip — Future Cinema Studio ──────────────────────────────────────────

function FCSStrip() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div style={{ margin: "0 auto", maxWidth: 1100, padding: "0 24px" }}>
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(139,92,246,0.12) 50%, rgba(245,158,11,0.07) 100%)",
        border: "2px solid rgba(245,158,11,0.45)",
        padding: "28px 36px",
        display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
        // Fix #7 — stronger gold glow
        boxShadow: "0 0 60px rgba(245,158,11,0.18), 0 0 120px rgba(245,158,11,0.10), inset 0 1px 0 rgba(245,158,11,0.18)",
      }}>
        {/* Left: icon + label + desc */}
        <div style={{ flex: "1 1 260px", display: "flex", alignItems: "flex-start", gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(139,92,246,0.22) 100%)",
            border: "1.5px solid rgba(245,158,11,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26,
            boxShadow: "0 0 28px rgba(245,158,11,0.28)",
          }}>
            🎬
          </div>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.12em", color: AMBER, textTransform: "uppercase",
              marginBottom: 6,
              textShadow: `0 0 24px rgba(245,158,11,0.55)`,
            }}>
              Future Cinema Studio
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13.5,
              color: BODY,                   // Fix #7 — brighter text
              lineHeight: 1.65, maxWidth: 380,
            }}>
              Unlock cinematic filmmaking tools. Advanced directors mode, shot control, timeline editor, professional export and more.
            </div>
          </div>
        </div>

        {/* Price columns */}
        <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
              color: "rgba(203,213,225,0.65)", marginBottom: 5, letterSpacing: "0.04em",
            }}>For Pro</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
              color: WHITE, letterSpacing: "-0.025em",
            }}>
              +$29<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.45)" }}>/mo</span>
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
              color: "rgba(148,163,184,0.55)", marginTop: 3,
            }}>+800 credits / month</div>
          </div>

          <div style={{ width: 1, height: 52, background: "rgba(245,158,11,0.18)" }} />

          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
              color: "rgba(203,213,225,0.65)", marginBottom: 5, letterSpacing: "0.04em",
            }}>For Business</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
              color: WHITE, letterSpacing: "-0.025em",
            }}>
              +$49<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.45)" }}>/mo</span>
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
              color: "rgba(148,163,184,0.55)", marginTop: 3,
            }}>+1,800 credits / month</div>
          </div>
        </div>

        {/* Enable FCS toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
          <button
            onClick={() => setEnabled(v => !v)}
            style={{
              width: 58, height: 32, borderRadius: 16, border: "none",
              background: enabled
                ? `linear-gradient(135deg, ${AMBER} 0%, ${PURPLE} 100%)`
                // Fix #7 — off-state more visible (lighter, slightly bordered)
                : "rgba(51,65,85,0.90)",
              position: "relative", cursor: "pointer",
              transition: "background 0.30s ease",
              // Fix #7 — off-state has a subtle border to define the toggle shape
              outline: enabled ? "none" : "1px solid rgba(148,163,184,0.20)",
              boxShadow: enabled
                ? `0 0 32px rgba(245,158,11,0.65), 0 0 64px rgba(245,158,11,0.28)`
                : "none",
            }}
          >
            <div style={{
              position: "absolute", top: 4, left: enabled ? 30 : 4,
              width: 24, height: 24, borderRadius: 12, background: "#fff",
              transition: "left 0.25s cubic-bezier(0.22,1,0.36,1)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.38)",
            }} />
          </button>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, fontWeight: 600,
            color: enabled ? AMBER : "rgba(148,163,184,0.75)",   // Fix #7 — brighter off-state label
            transition: "color 0.22s",
          }}>
            {enabled ? "Enabled" : "Enable FCS"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── BoostSlider ───────────────────────────────────────────────────────────────

function BoostSlider() {
  const [selected, setSelected] = useState(1);
  const pack = BOOST_PACKS[selected];
  const trackFill = (selected / (BOOST_PACKS.length - 1)) * 100;

  return (
    <div style={{ margin: "0 auto", maxWidth: 1100, padding: "0 24px" }}>
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(14,165,160,0.06) 0%, rgba(14,165,160,0.02) 100%)",
        border: "1px solid rgba(14,165,160,0.16)",
        padding: "32px 40px",
        display: "grid",
        gridTemplateColumns: "1fr 200px",
        gap: 36,
        alignItems: "center",
      }}>
        {/* Left */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.12em", color: WHITE, textTransform: "uppercase",
            }}>Boost Your Output</div>
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13.5,
            color: "rgba(203,213,225,0.72)", marginBottom: 32,
          }}>
            Add extra credits instantly. Use anytime.
          </div>

          {/* ── Segmented track ── */}
          <div style={{ position: "relative", marginBottom: 48 }}>
            {/* Track bar */}
            <div style={{
              position: "absolute",
              left: 12, right: 12, top: 12,
              height: 4, borderRadius: 2,
              background: "rgba(30,41,59,0.90)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${trackFill}%`,
                background: `linear-gradient(90deg, ${TEAL}, rgba(14,165,160,0.55))`,
                borderRadius: 2,
                transition: "width 0.32s cubic-bezier(0.22,1,0.36,1)",
                boxShadow: `0 0 12px ${TEAL}99`,
              }} />
            </div>

            {/* Nodes — Fix #6: equal spacing, labels centered, inactive 50% opacity */}
            <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              {BOOST_PACKS.map((b, i) => {
                const isActive = i === selected;
                const isPast   = i < selected;
                // Fix #6 — inactive (future) nodes at 50% opacity
                const nodeOpacity = isActive ? 1 : isPast ? 1 : 0.5;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      gap: 14, opacity: nodeOpacity,
                      transition: "opacity 0.22s ease",
                    }}
                  >
                    <button
                      onClick={() => setSelected(i)}
                      style={{
                        width: isActive ? 28 : 18,
                        height: isActive ? 28 : 18,
                        borderRadius: "50%",
                        border: `2px solid ${isActive ? TEAL : isPast ? "rgba(14,165,160,0.45)" : "rgba(30,41,59,0.80)"}`,
                        background: isActive
                          ? `radial-gradient(circle, ${TEAL} 0%, #0C8E8A 100%)`
                          : isPast
                            ? "rgba(14,165,160,0.40)"
                            : "rgba(15,23,42,0.85)",
                        cursor: "pointer",
                        animation: isActive ? "zpo-node-pulse 2.5s ease-in-out infinite" : "none",
                        transition: "all 0.28s cubic-bezier(0.22,1,0.36,1)",
                        padding: 0,
                      }}
                    />
                    {/* Fix #6 — labels centered under each node */}
                    <div style={{ textAlign: "center", width: 60 }}>
                      <div style={{
                        fontFamily: "'Familjen Grotesk', sans-serif",
                        fontSize: isActive ? 14 : 12.5, fontWeight: isActive ? 700 : 500,
                        color: isActive ? TEAL : isPast ? "rgba(14,165,160,0.70)" : "rgba(148,163,184,0.55)",
                        transition: "all 0.22s", whiteSpace: "nowrap",
                      }}>
                        {b.credits.toLocaleString()} cr
                      </div>
                      <div style={{
                        fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11.5,
                        color: isActive ? "rgba(226,232,240,0.72)" : "rgba(71,85,105,0.45)",
                        transition: "color 0.22s",
                      }}>
                        ${b.price}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              style={{
                padding: "12px 42px", borderRadius: 12,
                border: `1px solid rgba(14,165,160,0.38)`,
                background: "rgba(14,165,160,0.09)",
                color: TEAL, fontFamily: "'Syne', sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                cursor: "pointer", transition: "all 0.22s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(14,165,160,0.20)";
                e.currentTarget.style.boxShadow = `0 0 28px rgba(14,165,160,0.40)`;
                e.currentTarget.style.borderColor = "rgba(14,165,160,0.65)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(14,165,160,0.09)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "rgba(14,165,160,0.38)";
              }}
            >
              Add {pack.credits.toLocaleString()} cr for ${pack.price}
            </button>
          </div>
        </div>

        {/* Right callout */}
        <div style={{
          textAlign: "center", padding: "28px 24px",
          borderRadius: 18,
          background: "linear-gradient(160deg, rgba(139,92,246,0.14) 0%, rgba(14,165,160,0.10) 100%)",
          border: "1px solid rgba(139,92,246,0.22)",
          boxShadow: "0 0 36px rgba(139,92,246,0.12)",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
            color: WHITE, letterSpacing: "-0.04em", lineHeight: 1,
            transition: "all 0.22s ease",
          }}>
            +{pack.credits.toLocaleString()}
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 13, color: "rgba(203,213,225,0.65)", marginTop: 6,
          }}>
            credits instantly
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ComparisonTable ───────────────────────────────────────────────────────────

function ComparisonTable() {
  const planColors = ["rgba(148,163,184,0.75)", TEAL, PURPLE, "#60A5FA"];
  const planIcons  = ["⚡", "👑", "⚡", "💎"];

  const renderVal = (val: string | boolean, colIdx: number) => {
    if (val === true) return <CheckIcon color={planColors[colIdx]} size={15} />;
    if (val === "—")  return (
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
        color: BODY,                              // Fix #9
        ...(colIdx === 1 ? { fontWeight: 600 } : {}),
      }}>{val as string}</span>
    );
  };

  return (
    <div style={{ margin: "0 auto", maxWidth: 1100, padding: "0 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.20em", color: "rgba(100,116,139,0.55)",
          textTransform: "uppercase",
        }}>Compare All Features</div>
      </div>

      <div style={{
        borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.012)", overflow: "hidden",
      }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr repeat(4, minmax(120px, 1fr))",
          padding: "18px 28px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.025)",
        }}>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
            color: "rgba(71,85,105,0.55)", fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>Feature</div>
          {PLANS.map((p, i) => (
            <div key={p.id} style={{
              textAlign: "center",
              padding: "6px 8px", borderRadius: 10,
              ...(i === 1 ? {
                background: "rgba(14,165,160,0.08)",
                border: "1px solid rgba(14,165,160,0.16)",
              } : {}),
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.12em", color: planColors[i], textTransform: "uppercase",
              }}>
                {planIcons[i]} {p.name}
              </div>
            </div>
          ))}
        </div>

        {/* Rows */}
        {COMPARE_FEATURES.map((row, rowIdx) => (
          <div key={rowIdx} style={{
            display: "grid",
            gridTemplateColumns: "1.2fr repeat(4, minmax(120px, 1fr))",
            padding: "16px 28px",
            borderBottom: rowIdx < COMPARE_FEATURES.length - 1
              ? "1px solid rgba(255,255,255,0.04)"
              : "none",
            background: rowIdx % 2 === 0 ? "rgba(255,255,255,0.010)" : "transparent",
            alignItems: "center",
          }}>
            <div>
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 13.5, fontWeight: 600,
                color: BODY, marginBottom: 2,       // Fix #9
              }}>
                {row.icon} {row.name}
              </div>
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11.5, color: "rgba(148,163,184,0.55)",
              }}>
                {row.sub}
              </div>
            </div>
            {row.values.map((val, colIdx) => (
              <div key={colIdx} style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                padding: "4px 8px",
                ...(colIdx === 1 ? { background: "rgba(14,165,160,0.040)", borderRadius: 8 } : {}),
              }}>
                {renderVal(val as string | boolean, colIdx)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PricingOverlay
// ─────────────────────────────────────────────────────────────────────────────

export function PricingOverlay({ onClose }: PricingOverlayProps) {
  const [billing, setBilling]   = useState<BillingCycle>("monthly");
  const [selected, setSelected] = useState<string>("creator");
  const [closing, setClosing]   = useState(false);
  const scrollRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = "zpo-kf-v5";
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

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  return (
    <>
      {/* ── Backdrop — Fix #3: z:1050 so Navbar (z:1100) stays visible ── */}
      <div
        onClick={handleBackdrop}
        style={{
          position: "fixed", inset: 0, zIndex: 1050,
          background: "rgba(3,0,14,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          animation: closing
            ? `zpo-fadeout ${CLOSE_MS}ms ease forwards`
            : "zpo-fadein 0.28s ease",
        }}
      />

      {/* ── Fix #2: Close button — fixed, below navbar (~88px from top) ── */}
      <button
        onClick={handleClose}
        title="Close (Esc)"
        style={{
          position: "fixed", top: 88, right: 28,
          zIndex: 1210,                            // above panel (1200) and navbar (1100)
          width: 40, height: 40, borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(3,0,14,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          color: "rgba(148,163,184,0.72)",
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          transition: "all 0.18s", padding: 0,
          animation: closing ? `zpo-fadeout ${CLOSE_MS}ms ease forwards` : "zpo-fadein 0.28s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(239,68,68,0.16)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)";
          e.currentTarget.style.color = "#EF4444";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(3,0,14,0.72)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          e.currentTarget.style.color = "rgba(148,163,184,0.72)";
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* ── Panel — Fix #3: z:1200 so content sits above Navbar ── */}
      <div
        ref={scrollRef}
        style={{
          position: "fixed", inset: 0, zIndex: 1200,
          overflowY: "auto", overflowX: "hidden",
          animation: closing
            ? `zpo-slidedown ${CLOSE_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`
            : "zpo-slideup 0.45s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* ── Cosmic background ── */}
        <div style={{ minHeight: "100%", position: "relative", background: "#06011A" }}>

          {/* Fix #8: blur-blob system — all blobs boosted to 180px+ */}
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>

            {/* Blob 1 — magenta/purple top-center */}
            <div style={{
              position: "absolute",
              top: "-15%", left: "25%",
              width: 900, height: 700,
              borderRadius: "50%",
              background: "rgba(192,38,211,0.26)",
              filter: "blur(180px)",              // Fix #8 — was 150px
              animation: "zpo-blob-1 32s ease-in-out infinite",
            }} />

            {/* Blob 2 — teal left */}
            <div style={{
              position: "absolute",
              top: "15%", left: "-10%",
              width: 700, height: 600,
              borderRadius: "50%",
              background: "rgba(14,165,160,0.20)",
              filter: "blur(180px)",              // Fix #8 — was 140px
              animation: "zpo-blob-2 38s ease-in-out infinite",
            }} />

            {/* Blob 3 — purple/pink right */}
            <div style={{
              position: "absolute",
              top: "5%", right: "-10%",
              width: 650, height: 600,
              borderRadius: "50%",
              background: "rgba(139,92,246,0.20)",
              filter: "blur(180px)",              // Fix #8 — was 140px
              animation: "zpo-blob-3 28s ease-in-out infinite",
              animationDelay: "-12s",
            }} />

            {/* Blob 4 — deep bottom purple wash */}
            <div style={{
              position: "absolute",
              bottom: "-20%", left: "30%",
              width: 800, height: 600,
              borderRadius: "50%",
              background: "rgba(88,28,135,0.18)",
              filter: "blur(200px)",              // Fix #8 — was 160px
              animation: "zpo-blob-1 44s ease-in-out infinite reverse",
              animationDelay: "-20s",
            }} />

            {/* Edge vignette */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 55%, rgba(3,0,14,0.80) 100%)",
            }} />
          </div>

          {/* Star field */}
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
            {STARS.map((star, i) => (
              <div key={i} style={{
                position: "absolute",
                top: `${star.top}%`, left: `${star.left}%`,
                width: star.size, height: star.size, borderRadius: "50%",
                background: "#fff",
                animation: `zpo-star-twinkle ${2.2 + (i % 4) * 0.7}s ease-in-out infinite`,
                animationDelay: `${star.delay}s`,
              }} />
            ))}
          </div>

          {/* ── Content ── */}
          <div style={{ position: "relative", zIndex: 1 }}>

            {/* ── Hero ── */}
            <div style={{ textAlign: "center", padding: "80px 24px 48px", position: "relative" }}>
              <h1 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.035em",
                margin: "0 0 20px",
                // Fix #9 — heading uses pure white at start of gradient
                background: `linear-gradient(135deg, ${WHITE} 0%, ${WHITE} 40%, rgba(192,38,211,0.95) 70%, ${TEAL} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                ⚡ Create Without Limits
              </h1>

              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, flexWrap: "wrap", marginBottom: 22,
              }}>
                {["Nano Banana Pro", "FLUX Pro", "Seedream", "Kling 3.0"].map((m, i) => (
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
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 36,
                animation: "zpo-launch-float 4s ease-in-out infinite",
              }}>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
                  color: "rgba(230,237,243,0.85)",            // Fix #9
                }}>Launch Offer —</span>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
                  background: `linear-gradient(135deg, ${AMBER} 0%, #FCD34D 100%)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>Up to 40% OFF</span>
              </div>

              <p style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: "clamp(14px, 1.8vw, 16px)",
                color: "rgba(230,237,243,0.78)",              // Fix #9
                margin: "0 auto 40px", maxWidth: 460, lineHeight: 1.65,
              }}>
                Generate images, videos, and audio with cutting-edge AI models and tools.
              </p>

              <BillingToggle billing={billing} onChange={setBilling} />
            </div>

            {/* ── Pricing Cards — equal height, badge breathing room ── */}
            <div style={{
              display: "flex", gap: 18,
              padding: "28px 24px 20px",   // extra top for absolute badge
              maxWidth: 1180, margin: "0 auto",
              justifyContent: "center",
              alignItems: "flex-start",    // equal baseline; cards grow via minHeight
              flexWrap: "wrap",
            }}>
              {PLANS.map(plan => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  billing={billing}
                  selected={selected === plan.id}
                  onSelect={setSelected}
                />
              ))}
            </div>

            {/* Micro copy */}
            <div style={{ textAlign: "center", padding: "18px 24px 8px" }}>
              <span style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11.5, color: "rgba(71,85,105,0.55)", fontStyle: "italic",
              }}>
                ⓘ Output may vary based on model selection and quality settings.
              </span>
            </div>

            {/* Credit reset notice */}
            <div style={{ textAlign: "center", padding: "4px 24px 52px" }}>
              <span style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 12, color: "rgba(100,116,139,0.55)",
              }}>
                Credits reset monthly. Unused credits do not roll over.
              </span>
            </div>

            {/* ── FCS Strip ── */}
            <div style={{ marginBottom: 40 }}>
              <FCSStrip />
            </div>

            {/* ── Boost Slider ── */}
            <div style={{ marginBottom: 60 }}>
              <BoostSlider />
            </div>

            {/* ── Comparison Table ── */}
            <div style={{ marginBottom: 64 }}>
              <ComparisonTable />
            </div>

            {/* ── Bottom CTA ── */}
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              padding: "64px 24px 0",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 800, height: 300,
                background: "rgba(139,92,246,0.10)",
                filter: "blur(100px)",
                pointerEvents: "none",
              }} />

              <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                <h2 style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "clamp(24px, 4vw, 40px)",
                  fontWeight: 800, color: WHITE,           // Fix #9 — pure white
                  letterSpacing: "-0.025em", margin: "0 0 12px",
                }}>
                  Ready to bring your ideas to life?
                </h2>
                <p style={{
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 15,
                  color: "rgba(230,237,243,0.78)",          // Fix #9
                  margin: "0 auto 40px", maxWidth: 380, lineHeight: 1.6,
                }}>
                  Join thousands of creators building the future with Zencra.
                </p>

                <button style={{
                  padding: "16px 56px", borderRadius: 14, border: "none",
                  background: `linear-gradient(135deg, ${PURPLE} 0%, #7C3AED 100%)`,
                  color: "#fff", fontFamily: "'Syne', sans-serif",
                  fontSize: 16, fontWeight: 700, letterSpacing: "0.04em",
                  cursor: "pointer",
                  boxShadow: `0 0 40px rgba(139,92,246,0.48), 0 0 80px rgba(139,92,246,0.20)`,
                  transition: "all 0.25s ease",
                  display: "inline-flex", alignItems: "center", gap: 10,
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.04)";
                    e.currentTarget.style.boxShadow = `0 0 60px rgba(139,92,246,0.68), 0 0 120px rgba(139,92,246,0.30)`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = `0 0 40px rgba(139,92,246,0.48), 0 0 80px rgba(139,92,246,0.20)`;
                  }}
                >
                  Choose your plan →
                </button>
              </div>

              {/* Trust footer */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 16,
                margin: "52px auto 0", maxWidth: 1100, padding: "20px 24px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  {[
                    { icon: "🔒", text: "Secure payments" },
                    { icon: "✓",  text: "Cancel anytime" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: TEAL, fontSize: 13 }}>{item.icon}</span>
                      <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12.5, color: "rgba(148,163,184,0.70)" }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {["#8B5CF6", "#0EA5A0", "#EC4899", "#F59E0B", "#3B82F6"].map((color, i) => (
                      <div key={i} style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: `radial-gradient(circle at 35% 35%, ${color}BB, ${color}55)`,
                        border: "2px solid rgba(3,0,14,0.90)",
                        marginLeft: i === 0 ? 0 : -8,
                        zIndex: 5 - i, position: "relative",
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12.5,
                    color: "rgba(148,163,184,0.70)",
                  }}>
                    Trusted by 50,000+ creators worldwide
                  </span>
                </div>
              </div>

              {/* Legal */}
              <div style={{
                textAlign: "center", padding: "24px 24px 48px",
                fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
                color: "rgba(71,85,105,0.42)", lineHeight: 1.7,
              }}>
                Prices shown in USD. Credit costs vary by model and resolution.<br />
                All plans include a commercial license. Future Cinema Studio requires Pro or Business subscription.
              </div>
            </div>

          </div>{/* /content */}
        </div>{/* /bg */}
      </div>{/* /panel */}
    </>
  );
}

export default PricingOverlay;
