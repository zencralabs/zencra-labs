"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PricingOverlay v3 — Full cinematic visual rebuild
// Matches mockup: cosmic nebula bg · vibrant glows · conversion-focused layout
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
  glow: string;
  glowStrong: string;
  border: string;
  borderHover: string;
  ctaLabel: string;
  ctaBg: string;
  ctaColor: string;
  ctaShadow: string;
  highlight?: boolean;
  features: string[];
}

// ── Tokens ────────────────────────────────────────────────────────────────────

const TEAL    = "#0EA5A0";
const PURPLE  = "#8B5CF6";
const AMBER   = "#F59E0B";
const BLUE    = "#3B82F6";
const CYAN    = "#06B6D4";
const WHITE   = "#F8FAFC";
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
    glow: "rgba(6,182,212,0.22)",
    glowStrong: "rgba(6,182,212,0.45)",
    border: "rgba(6,182,212,0.35)",
    borderHover: "rgba(6,182,212,0.80)",
    ctaLabel: "Start Free (Upgrade later)",
    ctaBg: "rgba(6,182,212,0.10)",
    ctaColor: CYAN,
    ctaShadow: "none",
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
    glow: "rgba(14,165,160,0.35)",
    glowStrong: "rgba(192,38,211,0.55)",
    border: "rgba(14,165,160,0.60)",
    borderHover: "rgba(192,38,211,0.90)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(135deg, #C026D3 0%, #8B5CF6 50%, #0EA5A0 100%)",
    ctaColor: "#fff",
    ctaShadow: "0 0 36px rgba(192,38,211,0.55), 0 0 72px rgba(139,92,246,0.28)",
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
    glow: "rgba(139,92,246,0.25)",
    glowStrong: "rgba(139,92,246,0.55)",
    border: "rgba(139,92,246,0.42)",
    borderHover: "rgba(139,92,246,0.92)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
    ctaColor: "#fff",
    ctaShadow: "0 0 28px rgba(139,92,246,0.50)",
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
    glow: "rgba(96,165,250,0.20)",
    glowStrong: "rgba(248,250,252,0.32)",
    border: "rgba(248,250,252,0.50)",
    borderHover: "rgba(248,250,252,1.0)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
    ctaColor: "#fff",
    ctaShadow: "0 0 24px rgba(59,130,246,0.48)",
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

// ── Comparison features (matches mockup) ─────────────────────────────────────

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
@keyframes zpo-glow-pulse {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 1.0; }
}
@keyframes zpo-badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(192,38,211,0.60); }
  50%       { box-shadow: 0 0 0 8px rgba(192,38,211,0); }
}
@keyframes zpo-node-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(14,165,160,0.70), 0 0 24px rgba(14,165,160,0.38); }
  50%       { box-shadow: 0 0 24px rgba(14,165,160,1.0), 0 0 48px rgba(14,165,160,0.60); }
}
@keyframes zpo-nebula-drift {
  0%   { transform: translate(0, 0) scale(1.0) rotate(0deg); opacity: 0.80; }
  25%  { transform: translate(25px, -18px) scale(1.06) rotate(1deg); opacity: 0.95; }
  50%  { transform: translate(-15px, 30px) scale(1.10) rotate(-1.5deg); opacity: 0.85; }
  75%  { transform: translate(35px, 12px) scale(1.04) rotate(0.5deg); opacity: 1.0; }
  100% { transform: translate(0, 0) scale(1.0) rotate(0deg); opacity: 0.80; }
}
@keyframes zpo-star-twinkle {
  0%, 100% { opacity: 0.15; transform: scale(1); }
  50%       { opacity: 0.85; transform: scale(1.4); }
}
@keyframes zpo-launch-pulse {
  0%, 100% { opacity: 0.90; }
  50%       { opacity: 1.0; }
}
@keyframes zpo-card-glow {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 1.0; }
}
`;

const CLOSE_MS = 330;

// ── Star particles ────────────────────────────────────────────────────────────

const STARS = [
  { top:  8, left: 12, size: 2, delay: 0.0  },
  { top: 15, left: 78, size: 1.5, delay: 0.8 },
  { top: 22, left: 45, size: 1, delay: 1.6  },
  { top:  5, left: 60, size: 2.5, delay: 2.2 },
  { top: 35, left: 88, size: 1, delay: 0.4  },
  { top: 45, left:  5, size: 1.5, delay: 1.2 },
  { top: 55, left: 33, size: 1, delay: 3.0  },
  { top: 70, left: 92, size: 2, delay: 0.6  },
  { top: 80, left: 18, size: 1.5, delay: 2.8 },
  { top: 90, left: 55, size: 1, delay: 1.4  },
  { top: 12, left: 30, size: 1, delay: 3.5  },
  { top: 65, left: 70, size: 2, delay: 0.9  },
  { top: 40, left: 52, size: 1.5, delay: 2.0 },
  { top: 28, left: 95, size: 1, delay: 1.7  },
  { top: 75, left: 40, size: 1, delay: 4.0  },
  { top: 18, left: 65, size: 2, delay: 3.2  },
  { top: 85, left: 82, size: 1.5, delay: 0.3 },
  { top: 50, left: 15, size: 1, delay: 2.5  },
  { top: 95, left: 28, size: 2, delay: 1.1  },
  { top:  3, left: 85, size: 1, delay: 4.2  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CheckIcon({ color = TEAL, size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={color} strokeOpacity="0.30" />
      <polyline
        points="4.5 8 7 10.5 11.5 5.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── BillingToggle ─────────────────────────────────────────────────────────────

function BillingToggle({ billing, onChange }: { billing: BillingCycle; onChange: (c: BillingCycle) => void }) {
  const yearly = billing === "yearly";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
      <button
        onClick={() => onChange("monthly")}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
          color: !yearly ? WHITE : "rgba(148,163,184,0.50)",
          transition: "color 0.22s",
          letterSpacing: "0.02em",
        }}
      >
        Monthly
      </button>

      {/* Toggle track */}
      <button
        onClick={() => onChange(yearly ? "monthly" : "yearly")}
        style={{
          width: 48, height: 26, borderRadius: 13, border: "none",
          background: yearly
            ? `linear-gradient(135deg, ${PURPLE} 0%, ${TEAL} 100%)`
            : "rgba(255,255,255,0.12)",
          position: "relative", cursor: "pointer", flexShrink: 0,
          transition: "background 0.30s ease",
          boxShadow: yearly ? `0 0 18px rgba(139,92,246,0.50)` : "none",
        }}
      >
        <div style={{
          position: "absolute",
          top: 3,
          left: yearly ? 25 : 3,
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
          color: yearly ? WHITE : "rgba(148,163,184,0.50)",
          transition: "color 0.22s",
          letterSpacing: "0.02em",
        }}
      >
        Yearly
      </button>

      {/* Save badge */}
      <div style={{
        padding: "3px 12px", borderRadius: 20,
        background: "rgba(245,158,11,0.15)",
        border: "1px solid rgba(245,158,11,0.35)",
        fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
        color: AMBER, letterSpacing: "0.08em",
        animation: "zpo-launch-pulse 3s ease-in-out infinite",
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
  const monthly = plan.monthlyPrice;
  const yearly  = plan.yearlyPrice;

  const active = hovered || selected;
  const borderColor = active ? plan.borderHover : plan.border;

  const transform = plan.highlight
    ? `translateY(-18px)${hovered ? " scale(1.025)" : ""}`
    : hovered
      ? "translateY(-6px) scale(1.03)"
      : "translateY(0) scale(1)";

  const boxShadow = active
    ? `0 0 60px ${plan.glow}, 0 0 120px ${plan.glowStrong}, inset 0 1px 0 rgba(255,255,255,0.08)`
    : plan.highlight
      ? `0 0 42px ${plan.glow}, 0 0 80px ${plan.glowStrong}, inset 0 1px 0 rgba(255,255,255,0.05)`
      : `0 0 24px ${plan.glow}, inset 0 1px 0 rgba(255,255,255,0.03)`;

  const cardBg = plan.id === "creator"
    ? "linear-gradient(160deg, rgba(192,38,211,0.08) 0%, rgba(14,165,160,0.06) 100%)"
    : plan.id === "business"
      ? "linear-gradient(160deg, rgba(248,250,252,0.06) 0%, rgba(59,130,246,0.04) 100%)"
      : "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)";

  return (
    <div
      style={{
        position: "relative",
        flex: "1 1 220px",
        minWidth: 215,
        maxWidth: 278,
        borderRadius: 22,
        padding: plan.highlight ? "36px 24px 28px" : "28px 22px 24px",
        background: cardBg,
        border: `1.5px solid ${borderColor}`,
        boxShadow,
        transform,
        transition: "box-shadow 0.32s ease, transform 0.30s cubic-bezier(0.22,1,0.36,1), border-color 0.22s ease",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
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
          boxShadow: `0 0 24px rgba(192,38,211,0.65)`,
          animation: "zpo-badge-pulse 2.5s ease-in-out infinite",
        }}>
          <span style={{ fontSize: 11 }}>★</span> MOST POPULAR
        </div>
      )}

      {/* Icon + Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{plan.icon}</span>
        <span style={{
          fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.18em", color: plan.accentColor, textTransform: "uppercase",
        }}>
          {plan.name}
        </span>
      </div>

      {/* Credits */}
      <div style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 13, fontWeight: 600,
        color: "rgba(203,213,225,0.75)",
        marginBottom: 14, letterSpacing: "0.01em",
      }}>
        {plan.credits.toLocaleString()} credits / month
      </div>

      {/* Output line — large number format */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 12, color: "rgba(148,163,184,0.55)",
          marginBottom: 2,
        }}>
          Create up to
        </div>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 56, fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          ...(plan.highlight
            ? {
                background: `linear-gradient(135deg, ${WHITE} 0%, ${TEAL} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }
            : { color: WHITE }),
          transition: "all 0.22s",
        }}>
          {plan.images.toLocaleString()}
        </div>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 13, fontWeight: 600,
          color: "rgba(203,213,225,0.72)",
          marginTop: 2,
        }}>
          images or {plan.clips} video clips
        </div>
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`,
        marginBottom: 18,
      }} />

      {/* Price */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
          <span style={{
            fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800,
            lineHeight: 1, color: WHITE, letterSpacing: "-0.03em",
          }}>
            ${monthly}
          </span>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 13, color: "rgba(148,163,184,0.55)",
            marginBottom: 6,
          }}>
            / month
          </span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 12, color: "rgba(100,116,139,0.60)",
        }}>
          <span>${yearly} / year</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: AMBER,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.25)",
            padding: "1px 7px", borderRadius: 8,
          }}>Save 20%</span>
        </div>
      </div>

      {/* CTA */}
      <button
        style={{
          width: "100%", padding: "13px 0", marginTop: 18, marginBottom: 20,
          borderRadius: 12,
          border: plan.id === "starter" ? `1.5px solid ${plan.accentColor}44` : "none",
          background: plan.ctaBg,
          color: plan.ctaColor,
          fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
          letterSpacing: "0.06em", cursor: "pointer",
          boxShadow: plan.ctaShadow,
          transition: "all 0.22s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.filter = "brightness(1.12)";
          e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.filter = "brightness(1)";
          e.currentTarget.style.transform = "scale(1)";
        }}
        onClick={e => e.stopPropagation()}
      >
        {plan.ctaLabel}
      </button>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: "auto" }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <CheckIcon color={plan.accentColor} />
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 12.5, color: "rgba(203,213,225,0.72)",
            }}>
              {f}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FCSStrip — Future Cinema Studio (single strip, single toggle) ─────────────

function FCSStrip() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div style={{ margin: "0 auto", maxWidth: 1100, padding: "0 24px" }}>
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(139,92,246,0.09) 50%, rgba(245,158,11,0.05) 100%)",
        border: "1px solid rgba(245,158,11,0.22)",
        padding: "28px 36px",
        display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
      }}>
        {/* Left: icon + title + desc */}
        <div style={{ flex: "1 1 260px", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(139,92,246,0.18) 100%)",
            border: "1px solid rgba(245,158,11,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>
            🎬
          </div>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
              letterSpacing: "0.14em", color: AMBER, textTransform: "uppercase", marginBottom: 5,
            }}>
              Future Cinema Studio
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13,
              color: "rgba(203,213,225,0.65)", lineHeight: 1.60, maxWidth: 380,
            }}>
              Unlock cinematic filmmaking tools. Advanced directors mode, shot control, timeline editor, professional export and more.
            </div>
          </div>
        </div>

        {/* Price columns */}
        <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(148,163,184,0.55)", marginBottom: 4, letterSpacing: "0.04em",
            }}>For Pro</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
              color: WHITE, letterSpacing: "-0.02em",
            }}>
              +$29<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.45)" }}>/mo</span>
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(100,116,139,0.55)", marginTop: 2,
            }}>+800 credits / month</div>
          </div>

          <div style={{
            width: 1, height: 48,
            background: "rgba(255,255,255,0.06)",
          }} />

          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(148,163,184,0.55)", marginBottom: 4, letterSpacing: "0.04em",
            }}>For Business</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
              color: WHITE, letterSpacing: "-0.02em",
            }}>
              +$49<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.45)" }}>/mo</span>
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(100,116,139,0.55)", marginTop: 2,
            }}>+1,800 credits / month</div>
          </div>
        </div>

        {/* Enable toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setEnabled(v => !v)}
            style={{
              width: 56, height: 30, borderRadius: 15, border: "none",
              background: enabled
                ? `linear-gradient(135deg, ${PURPLE} 0%, ${TEAL} 100%)`
                : "rgba(30,41,59,0.80)",
              position: "relative", cursor: "pointer",
              transition: "background 0.28s ease",
              boxShadow: enabled ? `0 0 20px rgba(139,92,246,0.55)` : "none",
            }}
          >
            <div style={{
              position: "absolute", top: 4, left: enabled ? 30 : 4,
              width: 22, height: 22, borderRadius: 11, background: "#fff",
              transition: "left 0.25s cubic-bezier(0.22,1,0.36,1)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }} />
          </button>
          <span style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11, fontWeight: 600,
            color: enabled ? PURPLE : "rgba(100,116,139,0.55)",
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
        border: "1px solid rgba(14,165,160,0.18)",
        padding: "32px 40px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 32,
        alignItems: "center",
      }}>
        {/* Left: header + slider */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
              letterSpacing: "0.12em", color: WHITE, textTransform: "uppercase",
            }}>
              Boost Your Output
            </div>
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13,
            color: "rgba(148,163,184,0.55)", marginBottom: 36,
          }}>
            Add extra credits instantly. Use anytime.
          </div>

          {/* Track */}
          <div style={{ position: "relative", paddingBottom: 48 }}>
            {/* Track bar */}
            <div style={{
              position: "absolute", top: 13,
              left: 13, right: 13, height: 4, borderRadius: 2,
              background: "rgba(30,41,59,0.90)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${trackFill}%`,
                background: `linear-gradient(90deg, ${TEAL}, rgba(14,165,160,0.50))`,
                borderRadius: 2,
                transition: "width 0.30s cubic-bezier(0.22,1,0.36,1)",
                boxShadow: `0 0 12px ${TEAL}99`,
              }} />
            </div>

            {/* Snap nodes */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              position: "relative", zIndex: 1,
            }}>
              {BOOST_PACKS.map((b, i) => (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                }}>
                  <button
                    onClick={() => setSelected(i)}
                    style={{
                      width: i === selected ? 30 : 18,
                      height: i === selected ? 30 : 18,
                      borderRadius: "50%",
                      border: `2px solid ${
                        i === selected ? TEAL : i < selected ? "rgba(14,165,160,0.55)" : "rgba(30,41,59,0.80)"
                      }`,
                      background: i === selected
                        ? `radial-gradient(circle, ${TEAL} 0%, #0C8E8A 100%)`
                        : i < selected
                          ? "rgba(14,165,160,0.45)"
                          : "rgba(15,23,42,0.85)",
                      cursor: "pointer",
                      animation: i === selected ? "zpo-node-pulse 2.2s ease-in-out infinite" : "none",
                      transition: "all 0.28s cubic-bezier(0.22,1,0.36,1)",
                      padding: 0,
                    }}
                  />
                  <div style={{ textAlign: "center", minWidth: 56 }}>
                    <div style={{
                      fontFamily: "'Familjen Grotesk', sans-serif",
                      fontSize: i === selected ? 14 : 12,
                      fontWeight: i === selected ? 700 : 500,
                      color: i === selected ? TEAL : "rgba(100,116,139,0.50)",
                      transition: "all 0.22s", whiteSpace: "nowrap",
                    }}>
                      {b.credits.toLocaleString()} cr
                    </div>
                    <div style={{
                      fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
                      color: i === selected ? "rgba(203,213,225,0.70)" : "rgba(71,85,105,0.45)",
                      transition: "color 0.22s",
                    }}>
                      ${b.price}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              style={{
                padding: "12px 40px", borderRadius: 12,
                border: `1px solid rgba(14,165,160,0.40)`,
                background: "rgba(14,165,160,0.10)",
                color: TEAL, fontFamily: "'Syne', sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                cursor: "pointer", transition: "all 0.22s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(14,165,160,0.22)";
                e.currentTarget.style.boxShadow = `0 0 24px rgba(14,165,160,0.40)`;
                e.currentTarget.style.borderColor = "rgba(14,165,160,0.70)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(14,165,160,0.10)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "rgba(14,165,160,0.40)";
              }}
            >
              Add {pack.credits.toLocaleString()} cr for ${pack.price}
            </button>
          </div>
        </div>

        {/* Right: callout */}
        <div style={{
          textAlign: "center", padding: "28px 32px",
          borderRadius: 18,
          background: "linear-gradient(160deg, rgba(139,92,246,0.14) 0%, rgba(14,165,160,0.10) 100%)",
          border: "1px solid rgba(139,92,246,0.25)",
          boxShadow: `0 0 40px rgba(139,92,246,0.15)`,
          minWidth: 160,
          transition: "all 0.25s ease",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800,
            color: WHITE, letterSpacing: "-0.04em", lineHeight: 1,
            transition: "all 0.22s ease",
          }}>
            +{pack.credits.toLocaleString()}
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 13, color: "rgba(203,213,225,0.60)",
            marginTop: 6,
          }}>
            credits instantly
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 11, color: "rgba(100,116,139,0.50)",
            marginTop: 4,
          }}>
            You get
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ComparisonTable ───────────────────────────────────────────────────────────

function ComparisonTable() {
  const planColors = [
    "rgba(148,163,184,0.75)",
    TEAL,
    PURPLE,
    "#60A5FA",
  ];
  const planIcons = ["⚡", "👑", "⚡", "💎"];

  const renderVal = (val: string | boolean, colIdx: number) => {
    if (val === true) return <CheckIcon color={planColors[colIdx]} size={15} />;
    if (val === "—") return (
      <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 14, color: "rgba(71,85,105,0.45)" }}>—</span>
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
        color: "rgba(203,213,225,0.75)",
        ...(colIdx === 1 ? { fontWeight: 600 } : {}),
      }}>{val as string}</span>
    );
  };

  return (
    <div style={{ margin: "0 auto", maxWidth: 1100, padding: "0 24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.20em", color: "rgba(100,116,139,0.55)",
          textTransform: "uppercase",
        }}>Compare All Features</div>
      </div>

      <div style={{
        borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.015)", overflow: "hidden",
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
              padding: "6px 8px",
              borderRadius: 10,
              ...(i === 1 ? {
                background: "rgba(14,165,160,0.09)",
                border: "1px solid rgba(14,165,160,0.18)",
              } : {}),
            }}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.12em", color: planColors[i],
                textTransform: "uppercase",
              }}>
                {planIcons[i]} {p.name}
              </div>
            </div>
          ))}
        </div>

        {/* Feature rows */}
        {COMPARE_FEATURES.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr repeat(4, minmax(120px, 1fr))",
              padding: "16px 28px",
              borderBottom: rowIdx < COMPARE_FEATURES.length - 1
                ? "1px solid rgba(255,255,255,0.04)"
                : "none",
              background: rowIdx % 2 === 0 ? "rgba(255,255,255,0.010)" : "transparent",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 13.5, fontWeight: 600, color: "rgba(203,213,225,0.82)",
                marginBottom: 2,
              }}>
                {row.icon} {row.name}
              </div>
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11, color: "rgba(100,116,139,0.50)",
              }}>
                {row.sub}
              </div>
            </div>
            {row.values.map((val, colIdx) => (
              <div key={colIdx} style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                padding: "4px 8px",
                ...(colIdx === 1 ? {
                  background: "rgba(14,165,160,0.045)",
                  borderRadius: 8,
                } : {}),
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

  // Inject keyframes once
  useEffect(() => {
    const id = "zpo-kf-v3";
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
      {/* Backdrop */}
      <div
        onClick={handleBackdrop}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(4,0,20,0.90)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          animation: closing
            ? `zpo-fadeout ${CLOSE_MS}ms ease forwards`
            : "zpo-fadein 0.28s ease",
        }}
      />

      {/* Panel */}
      <div
        ref={scrollRef}
        style={{
          position: "fixed", inset: 0, zIndex: 1001,
          overflowY: "auto", overflowX: "hidden",
          animation: closing
            ? `zpo-slidedown ${CLOSE_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`
            : "zpo-slideup 0.45s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* ── Cosmic background ── */}
        <div style={{
          minHeight: "100%", position: "relative",
          background: "#06011A",
        }}>

          {/* Nebula glow layers */}
          <div style={{
            position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          }}>
            {/* Top-center: bright cosmic explosion */}
            <div style={{
              position: "absolute", top: "-10%", left: "50%",
              transform: "translateX(-50%)",
              width: "120%", height: "70%",
              background: "radial-gradient(ellipse 80% 70% at 50% 20%, rgba(192,38,211,0.28) 0%, rgba(139,92,246,0.18) 30%, transparent 70%)",
              animation: "zpo-nebula-drift 20s ease-in-out infinite",
            }} />
            {/* Secondary teal-left glow */}
            <div style={{
              position: "absolute", top: "20%", left: "-10%",
              width: "55%", height: "60%",
              background: "radial-gradient(ellipse at 30% 40%, rgba(14,165,160,0.18) 0%, transparent 65%)",
              animation: "zpo-nebula-drift 26s ease-in-out infinite reverse",
            }} />
            {/* Secondary pink-right glow */}
            <div style={{
              position: "absolute", top: "10%", right: "-10%",
              width: "55%", height: "55%",
              background: "radial-gradient(ellipse at 70% 30%, rgba(236,72,153,0.16) 0%, transparent 60%)",
              animation: "zpo-nebula-drift 22s ease-in-out infinite",
              animationDelay: "-8s",
            }} />
            {/* Deep purple base wash */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
              background: "linear-gradient(180deg, transparent 0%, rgba(139,92,246,0.05) 100%)",
            }} />
            {/* Edge vignette */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 55%, rgba(4,0,20,0.80) 100%)",
            }} />
          </div>

          {/* Star particles */}
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
            {STARS.map((star, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  width: star.size, height: star.size,
                  borderRadius: "50%",
                  background: "#fff",
                  animation: `zpo-star-twinkle ${2.5 + (i % 3)}s ease-in-out infinite`,
                  animationDelay: `${star.delay}s`,
                }}
              />
            ))}
          </div>

          {/* ── Content ── */}
          <div style={{ position: "relative", zIndex: 1 }}>

            {/* ── TopBar — Log in + Close only (no logo) ── */}
            <div style={{
              position: "sticky", top: 0, zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              padding: "14px 32px",
              background: "rgba(6,1,26,0.75)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button style={{
                  padding: "7px 20px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(203,213,225,0.75)",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.18s",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.color = WHITE;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "rgba(203,213,225,0.75)";
                  }}
                >
                  Log in
                </button>

                <button
                  onClick={handleClose}
                  title="Close (Esc)"
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(148,163,184,0.65)",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s", padding: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.14)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)";
                    e.currentTarget.style.color = "#EF4444";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                    e.currentTarget.style.color = "rgba(148,163,184,0.65)";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Hero ── */}
            <div style={{ textAlign: "center", padding: "72px 24px 48px", position: "relative" }}>

              {/* Hero radial glow */}
              <div style={{
                position: "absolute", top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 800, height: 340,
                background: "radial-gradient(ellipse, rgba(192,38,211,0.14) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
                animation: "zpo-glow-pulse 4.5s ease-in-out infinite",
                pointerEvents: "none",
              }} />

              {/* Headline */}
              <h1 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 800, lineHeight: 1.0,
                letterSpacing: "-0.035em",
                margin: "0 0 20px",
                background: `linear-gradient(135deg, ${WHITE} 0%, ${WHITE} 40%, rgba(192,38,211,0.95) 70%, ${TEAL} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                ⚡ Create Without Limits
              </h1>

              {/* Model names */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, flexWrap: "wrap", marginBottom: 20,
              }}>
                {["Nano Banana Pro", "FLUX Pro", "Seedream", "Kling 3.0"].map((model, i) => (
                  <span key={model} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, fontWeight: 600,
                      color: "rgba(148,163,184,0.60)", letterSpacing: "0.03em",
                    }}>{model}</span>
                    {i < 3 && (
                      <span style={{ color: "rgba(100,116,139,0.35)", fontSize: 10 }}>•</span>
                    )}
                  </span>
                ))}
              </div>

              {/* Launch offer */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginBottom: 36,
                animation: "zpo-launch-pulse 3s ease-in-out infinite",
              }}>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
                  letterSpacing: "0.01em",
                  color: "rgba(203,213,225,0.80)",
                }}>
                  Launch Offer —
                </span>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800,
                  background: `linear-gradient(135deg, ${AMBER} 0%, #FCD34D 100%)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  Up to 40% OFF
                </span>
              </div>

              {/* Subtitle */}
              <p style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: "clamp(14px, 1.8vw, 16px)",
                color: "rgba(148,163,184,0.65)",
                margin: "0 auto 40px", maxWidth: 460, lineHeight: 1.65,
              }}>
                Generate images, videos, and audio with cutting-edge AI models and tools.
              </p>

              {/* Billing toggle */}
              <BillingToggle billing={billing} onChange={setBilling} />
            </div>

            {/* ── Plan Cards ── */}
            <div style={{ position: "relative" }}>
              {/* Ambient glow behind cards */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: "100%", maxWidth: 1000, height: 500,
                background: "radial-gradient(ellipse, rgba(192,38,211,0.06) 0%, rgba(14,165,160,0.04) 50%, transparent 75%)",
                animation: "zpo-card-glow 7s ease-in-out infinite",
                pointerEvents: "none",
              }} />

              <div style={{
                display: "flex", gap: 18, padding: "0 24px",
                maxWidth: 1180, margin: "0 auto",
                justifyContent: "center", alignItems: "flex-start",
                flexWrap: "wrap", position: "relative", zIndex: 1,
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
            </div>

            {/* Micro copy */}
            <div style={{ textAlign: "center", padding: "18px 24px 52px" }}>
              <span style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11.5, color: "rgba(71,85,105,0.55)", fontStyle: "italic",
              }}>
                ⓘ Output may vary based on model selection and quality settings.
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
              {/* Bottom glow */}
              <div style={{
                position: "absolute", top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: 800, height: 300,
                background: "radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

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
                  color: "rgba(148,163,184,0.62)",
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
                  boxShadow: `0 0 40px rgba(139,92,246,0.50), 0 0 80px rgba(139,92,246,0.22)`,
                  transition: "all 0.25s ease",
                  display: "inline-flex", alignItems: "center", gap: 10,
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "scale(1.04)";
                    e.currentTarget.style.boxShadow = `0 0 60px rgba(139,92,246,0.70), 0 0 120px rgba(139,92,246,0.32)`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = `0 0 40px rgba(139,92,246,0.50), 0 0 80px rgba(139,92,246,0.22)`;
                  }}
                >
                  Choose your plan →
                </button>
              </div>

              {/* Trust footer bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 16,
                margin: "52px auto 0", maxWidth: 1100, padding: "20px 24px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke={TEAL} strokeWidth="1.8" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, color: "rgba(100,116,139,0.65)" }}>
                      Secure payments
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <polyline points="3.5 8 6.5 11 12.5 5" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, color: "rgba(100,116,139,0.65)" }}>
                      Cancel anytime
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Avatar circles */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {["#8B5CF6", "#0EA5A0", "#EC4899", "#F59E0B", "#3B82F6"].map((color, i) => (
                      <div key={i} style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: `radial-gradient(circle at 35% 35%, ${color}BB, ${color}55)`,
                        border: "2px solid rgba(6,1,26,0.90)",
                        marginLeft: i === 0 ? 0 : -8,
                        zIndex: 5 - i,
                        position: "relative",
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12,
                    color: "rgba(100,116,139,0.65)",
                  }}>
                    Trusted by 50,000+ creators worldwide
                  </span>
                </div>
              </div>

              {/* Legal footer */}
              <div style={{
                textAlign: "center", padding: "24px 24px 48px",
                fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
                color: "rgba(71,85,105,0.45)", lineHeight: 1.7,
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
