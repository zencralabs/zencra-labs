"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PricingOverlay v8 — Visual system upgrades
// Outer: black blur backdrop (rgba(0,0,0,0.68) + blur(18px)) — page shows through
// Panel: colorful bg contained inside panel + optional BG image hook
// Hero: video reel strip behind headline, one-line title
// Boost: 4 card-buttons (whole card highlights), right preview no-overflow
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

const GOLD   = "#FFD56A";
const TEAL   = "#22d3ee";
const AMBER  = "#F59E0B";
const WHITE  = "#ffffff";
const BODY   = "rgba(241,245,249,0.88)";

// v8 — Optional panel background image. Set path to activate; leave "" for gradient fallback.
const PRICING_PANEL_BG = ""; // e.g. "/pricing/pricing-panel-bg.png"

// Shared section max-width token — all section wrappers align to this.
const PRICING_CONTENT_MAX_WIDTH = 1180;

// v8 — Hero reel placeholder video paths (replace with real assets)
const REEL_VIDEOS = [
  "/pricing/reel-1.mp4",
  "/pricing/reel-2.mp4",
  "/pricing/reel-3.mp4",
  "/pricing/reel-4.mp4",
  "/pricing/reel-5.mp4",
];

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
    border: "rgba(34,211,238,0.75)",
    hoverGlow: "0 0 45px rgba(34,211,238,.32)",
    ctaLabel: "Start Free (Upgrade later)",
    ctaBg: "transparent",
    ctaColor: "#22d3ee",
    ctaBorder: "1.5px solid rgba(34,211,238,0.38)",
    ctaHoverShadow: "0 0 24px rgba(34,211,238,0.40)",
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
    border: "rgba(217,70,239,0.78)",
    hoverGlow: "0 0 50px rgba(217,70,239,.34)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(90deg, #ff4fc3, #8b5cf6, #22d3ee)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 40px rgba(217,70,239,0.50), 0 0 80px rgba(139,92,246,0.25)",
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
    border: "rgba(124,58,237,0.78)",
    hoverGlow: "0 0 45px rgba(124,58,237,.32)",
    ctaLabel: "Get Started",
    ctaBg: "linear-gradient(90deg, #7c3aed, #9333ea)",
    ctaColor: "#fff",
    ctaBorder: "none",
    ctaHoverShadow: "0 0 32px rgba(124,58,237,0.55), 0 0 64px rgba(147,51,234,0.28)",
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
    border: "rgba(255,255,255,0.95)",
    hoverGlow: "0 0 55px rgba(255,255,255,.34), 0 0 90px rgba(59,130,246,.18)",
    ctaLabel: "Get Started",
    ctaBg: "#ffffff",
    ctaColor: "transparent",
    ctaBorder: "none",
    ctaGradientText: "linear-gradient(90deg, #2563eb, #0f1b4d)",
    ctaHoverShadow: "0 0 20px rgba(255,255,255,0.30), 0 0 40px rgba(255,255,255,0.12)",
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
    values: ["—", "—", "Add-on", "Add-on"],
  },
  {
    icon: "💬",
    name: "Support",
    sub: "Get help when you need",
    values: ["Ticket", "Ticket", "Ticket (Priority)", "Ticket (Priority)"],
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
  from { opacity: 0; transform: translateY(24px) scale(0.99); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes zpo-slidedown {
  from { opacity: 1; transform: translateY(0)    scale(1);    }
  to   { opacity: 0; transform: translateY(18px) scale(0.99); }
}
@keyframes zpo-bg-drift {
  0%,100% { transform: scale(1.06) translate(0%,    0%);   }
  33%      { transform: scale(1.08) translate(0.9%,  0.6%); }
  66%      { transform: scale(1.07) translate(-0.5%, 1.1%); }
}
@keyframes zpo-launch-float {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes zpo-badge-glow {
  0%,100% { opacity: 0.92; }
  50%      { opacity: 1;    }
}
@keyframes zpo-reel {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes zpo-sweep {
  0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
  40%  { opacity: 0.85; }
  100% { transform: translateX(260%) skewX(-18deg); opacity: 0; }
}
`;

const CLOSE_MS = 300;

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
        animation: "zpo-launch-float 4s ease-in-out infinite",
      }}>Save 20%</div>
    </div>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────────

function PricingCard({
  plan, billing, selected, onSelect,
}: {
  plan: Plan; billing: BillingCycle; selected: boolean; onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const price        = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const period       = billing === "yearly" ? "yr" : "mo";
  const displayImages = billing === "yearly" ? plan.images * 12 : plan.images;
  const displayClips  = billing === "yearly" ? plan.clips  * 12 : plan.clips;
  const outputLabel   = billing === "yearly" ? "/ year"         : "/ month";

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
        height: 560,
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: 22,
        padding: "28px 26px",
        background: "linear-gradient(180deg, rgba(18,24,48,0.72) 0%, rgba(8,10,24,0.86) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: `1.5px solid ${borderColor}`,
        boxShadow,
        transform,
        transition: "transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s, border-color .28s",
        cursor: "pointer",
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>{plan.icon}</span>
          <span style={{
            fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.18em", color: plan.border.replace(/[\d.]+\)$/, "1)"),
            textTransform: "uppercase",
          }}>{plan.name}</span>
        </div>

        {/* Price */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, lineHeight: 1 }}>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 40, fontWeight: 900,
              letterSpacing: "-0.04em",
              color: WHITE,
            }}>${price}</span>
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13, color: "rgba(148,163,184,0.50)",
              marginBottom: 8,
            }}>/{period}</span>
          </div>
          {billing === "monthly" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 5,
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11.5, color: "rgba(100,116,139,0.60)",
            }}>
              <span>${plan.yearlyPrice} / yr</span>
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
          {plan.credits.toLocaleString()} credits / month
        </div>

        {/* Output */}
        <div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 12, color: "rgba(148,163,184,0.55)", marginBottom: 3,
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
            fontSize: 13, color: "rgba(203,213,225,0.75)", marginTop: 3,
          }}>
            images or {displayClips} clips {outputLabel}
          </div>
        </div>
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
          style={{
            width: "100%", padding: "13px 0",
            borderRadius: 12,
            border: plan.ctaBorder,
            background: plan.ctaBg,
            color: plan.ctaColor,
            fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
            letterSpacing: "0.06em", cursor: "pointer",
            transition: "all 0.22s ease",
            marginBottom: 16,
            overflow: "hidden",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = plan.ctaHoverShadow;
            e.currentTarget.style.filter = "brightness(1.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.filter = "brightness(1)";
          }}
          onClick={e => e.stopPropagation()}
        >
          {plan.ctaGradientText ? (
            <span style={{
              backgroundImage: plan.ctaGradientText,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              letterSpacing: "0.06em",
            }}>{plan.ctaLabel}</span>
          ) : plan.ctaLabel}
        </button>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {plan.features.map((f, i) => (
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

// ── FCSStrip ──────────────────────────────────────────────────────────────────

function FCSStrip() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div style={{ margin: "0 auto", maxWidth: PRICING_CONTENT_MAX_WIDTH, width: "100%", padding: "0 32px" }}>
      <div style={{
        borderRadius: 20,
        background: `
          radial-gradient(circle at 10% 50%, rgba(255,180,60,.16), transparent 30%),
          linear-gradient(90deg, rgba(34,18,8,.62) 0%, rgba(40,18,52,.58) 100%)
        `,
        border: "1px solid rgba(255,213,106,0.75)",
        padding: "28px 36px",
        display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap",
        boxShadow: "0 0 35px rgba(255,180,60,.22), inset 0 1px 0 rgba(255,255,255,.08)",
      }}>
        {/* Left */}
        <div style={{ flex: "1 1 260px", display: "flex", alignItems: "flex-start", gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(255,180,60,0.22) 0%, rgba(139,92,246,0.20) 100%)",
            border: "1.5px solid rgba(255,213,106,0.50)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26,
            boxShadow: "0 0 28px rgba(255,180,60,0.28)",
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
            onClick={() => setEnabled(v => !v)}
            style={{
              width: 58, height: 32, borderRadius: 16, border: "none",
              background: enabled
                ? `linear-gradient(135deg, ${GOLD} 0%, #8b5cf6 100%)`
                : "rgba(51,65,85,0.90)",
              position: "relative", cursor: "pointer",
              transition: "background 0.30s ease",
              outline: enabled ? "none" : "1px solid rgba(148,163,184,0.22)",
              boxShadow: enabled
                ? "0 0 32px rgba(255,213,106,0.65), 0 0 64px rgba(255,213,106,0.28)"
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
            color: enabled ? GOLD : "rgba(148,163,184,0.75)",
            transition: "color 0.22s",
          }}>{enabled ? "Enabled" : "Enable FCS"}</span>
        </div>
      </div>
    </div>
  );
}

// ── BoostSelector v8 — 4 full card-buttons ────────────────────────────────────

function BoostSelector() {
  const [selected, setSelected] = useState(1);
  const pack = BOOST_PACKS[selected];

  const packLabels = ["Starter Pack", "Creator Pack", "Studio Pack", "Pro Pack"];
  const packIcons  = ["⚡", "🚀", "🎬", "💎"];

  return (
    <div style={{ margin: "0 auto", maxWidth: PRICING_CONTENT_MAX_WIDTH, width: "100%", padding: "0 32px" }}>
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(14,165,160,0.06) 0%, rgba(14,165,160,0.02) 100%)",
        border: "1px solid rgba(14,165,160,0.18)",
        padding: "32px 40px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800,
            letterSpacing: "0.08em", color: WHITE, textTransform: "uppercase",
          }}>Boost Credit Packs</div>
        </div>
        <div style={{
          fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13.5,
          color: "rgba(203,213,225,0.70)", marginBottom: 24,
        }}>
          Add extra credits when you need more. Boost credits expire after 90 days.
        </div>

        {/* Single-row grid: 4 pack cards + preview card */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) 260px", alignItems: "stretch", gap: 16 }}>
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
                    ? "0 0 24px rgba(34,211,238,0.38), 0 0 48px rgba(34,211,238,0.15)"
                    : "none",
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

          {/* Preview card — 5th column, same row as pack cards */}
          <div style={{
            alignSelf: "stretch",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 18,
            background: "linear-gradient(160deg, rgba(139,92,246,0.14) 0%, rgba(34,211,238,0.10) 100%)",
            border: "1px solid rgba(139,92,246,0.22)",
            boxShadow: "0 0 36px rgba(139,92,246,0.12)",
            position: "relative",
            overflow: "hidden",
            textAlign: "center",
          }}>
            {/* Sweep light effect */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)",
              animation: "zpo-sweep 3.5s ease-in-out infinite",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ComparisonTable ───────────────────────────────────────────────────────────

function ComparisonTable() {
  const planColors = [
    "rgba(34,211,238,0.90)",
    "rgba(168,85,247,0.90)",  // Creator — purple
    "rgba(124,58,237,0.90)",
    "rgba(255,255,255,0.90)",
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
    // ── Flat premium dark section — no overlays, no gradients ──
    <section style={{
      margin: "0 auto",
      maxWidth: PRICING_CONTENT_MAX_WIDTH,
      width: "100%",
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)",
      background: "#171717",
    }}>
      {/* Label */}
      <div style={{ textAlign: "center", padding: "36px 32px 28px" }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.20em", color: "rgba(100,116,139,0.55)",
          textTransform: "uppercase",
        }}>Compare All Features</div>
      </div>

      {/* ── Table shell — no background, no glass, no blur ── */}
      <div style={{ padding: "0 32px 36px" }}>
        <div style={{ overflow: "hidden" }}>

          {/* Column headers — no glow, plain text only */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.2fr repeat(4, minmax(120px, 1fr))",
            padding: "14px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(71,85,105,0.55)", fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Feature</div>

            {PLANS.map((p, i) => (
              <div key={p.id} style={{ textAlign: "center", padding: "4px 8px" }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  // Creator = purple; others = muted white
                  color: i === 1
                    ? "#a855f7"
                    : "rgba(255,255,255,0.55)",
                  ...(i === 1 ? { fontWeight: 600 } : {}),
                }}>
                  {p.icon} {p.name}
                </div>
              </div>
            ))}
          </div>

          {/* Rows — flat, no alternating backgrounds, Creator column = vertical strip */}
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

              {/* Value cells — Creator column = flat tint, no border-radius */}
              {row.values.map((val, colIdx) => (
                <div key={colIdx} style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  padding: "4px 8px", height: "100%",
                  // Creator = continuous flat strip, no rounded corners
                  background: colIdx === 1 ? "rgba(168,85,247,0.08)" : "transparent",
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

// ─────────────────────────────────────────────────────────────────────────────
// Main PricingOverlay
// ─────────────────────────────────────────────────────────────────────────────

export function PricingOverlay({ onClose }: PricingOverlayProps) {
  const [billing, setBilling]   = useState<BillingCycle>("monthly");
  const [selected, setSelected] = useState<string>("creator");
  const [closing, setClosing]   = useState(false);

  useEffect(() => {
    const id = "zpo-kf-v8";
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

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        overflowY: "auto",
        background: "rgba(0,0,0,0.68)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        animation: closing
          ? `zpo-fadeout ${CLOSE_MS}ms ease forwards`
          : "zpo-fadein 0.32s ease",
      }}
    >
      {/* ── Click-outside-to-close wrapper ── */}
      <div
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
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 1440,
            minHeight: "calc(100vh - 48px)",
            position: "relative",
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.16)",
            background: PRICING_PANEL_BG ? "transparent" : "rgba(3,6,18,0.42)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            boxShadow: `
              0 0 80px rgba(104,80,255,0.18),
              inset 0 0 80px rgba(255,255,255,0.03)
            `,
            animation: closing
              ? `zpo-slidedown ${CLOSE_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`
              : "zpo-slideup 0.45s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* ── Panel background — clipped by border-radius (stays inside panel) ── */}
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
              {/* Colorful gradient — inside panel only */}
              <div style={{
                position: "absolute", inset: "-6%", zIndex: 0,
                background: `
                  radial-gradient(circle at 18% 18%, rgba(70,110,255,0.28), transparent 32%),
                  radial-gradient(circle at 82% 18%, rgba(255,55,180,0.34), transparent 34%),
                  radial-gradient(circle at 50% 70%, rgba(120,30,255,0.22), transparent 42%),
                  linear-gradient(180deg, #050716 0%, #07051a 48%, #05020d 100%)
                `,
                animation: "zpo-bg-drift 35s ease-in-out infinite",
                pointerEvents: "none",
              }} />
              {/* Star / noise layer */}
              <div style={{
                position: "absolute", inset: 0, zIndex: 1,
                backgroundImage: `
                  radial-gradient(circle, rgba(255,255,255,0.85) 1px, transparent 1px),
                  radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1px)
                `,
                backgroundSize: "80px 80px, 130px 130px",
                backgroundPosition: "0 0, 40px 65px",
                opacity: 0.06,
                pointerEvents: "none",
              }} />
              {/* Vignette */}
              <div style={{
                position: "absolute", inset: 0, zIndex: 2,
                boxShadow: "inset 0 0 180px rgba(0,0,0,0.75)",
                pointerEvents: "none",
              }} />
            </>
          )}

          {/* ── Close button — inside panel, top right ── */}
          <button
            onClick={handleClose}
            title="Close (Esc)"
            style={{
              position: "absolute", top: 24, right: 24, zIndex: 10,
              width: 40, height: 40, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(3,6,18,0.72)",
              backdropFilter: "blur(16px)",
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

          {/* ── Content wrapper — sits above bg layers (zIndex > 2) ── */}
          <div style={{ position: "relative", zIndex: 3 }}>

          {/* ── Hero ── */}
          <div style={{ textAlign: "center", padding: "88px 24px 52px", position: "relative", overflow: "hidden" }}>

            {/* ── Video reel strip — behind headline ── */}
            <div style={{
              position: "absolute", inset: 0,
              overflow: "hidden",
              opacity: 0.35,
              pointerEvents: "none",
              zIndex: 0,
            }}>
              <div style={{
                display: "flex",
                animation: "zpo-reel 36s linear infinite",
                width: "fit-content",
                // Anchor to the top so cards sit behind the headline, not mid-hero
                alignItems: "flex-start",
                paddingTop: "20px",
              }}>
                {[...REEL_VIDEOS, ...REEL_VIDEOS].map((src, i) => (
                  <div key={i} style={{
                    // 360×202 keeps 16:9 and fills ~3 full + 2 partial cards at panel width
                    width: 360, height: 202,
                    flexShrink: 0,
                    margin: "0 12px",
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid rgba(139,92,246,0.50)",
                    boxShadow: "0 0 22px rgba(104,80,255,0.32), inset 0 0 28px rgba(0,0,0,0.45)",
                    background: "linear-gradient(135deg, rgba(40,20,80,0.70) 0%, rgba(15,10,40,0.85) 100%)",
                    position: "relative",
                  }}>
                    {/* Video layer */}
                    <video
                      src={src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                    />
                    {/* Fallback gradient — visible when mp4 is not yet present */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: `linear-gradient(135deg,
                        rgba(${[
                          "70,40,180","120,30,200","30,80,200","180,30,120","60,140,220",
                          "70,40,180","120,30,200","30,80,200","180,30,120","60,140,220"
                        ][i % 10]},0.60) 0%,
                        rgba(10,5,30,0.80) 100%)`,
                    }} />
                    {/* Dark overlay — keeps headline legible, sits above video + fallback */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(0,0,0,0.50)",
                    }} />
                    {/* Play icon — topmost layer */}
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 1,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        border: "1.5px solid rgba(255,255,255,0.20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="rgba(255,255,255,0.50)">
                          <polygon points="3,1 11,6 3,11" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Hero text — above reel ── */}
            <div style={{ position: "relative", zIndex: 1 }}>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(28px, 4.8vw, 80px)",
              fontWeight: 900, lineHeight: 0.95,
              letterSpacing: "-0.045em",
              margin: "0 0 24px",
              whiteSpace: "nowrap",
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
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28,
              animation: "zpo-launch-float 4s ease-in-out infinite",
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
            </div>{/* /hero text wrapper */}
          </div>

          {/* ── Pricing cards ── */}
          <div style={{
            display: "flex", gap: 18,
            padding: "28px 32px 20px",
            maxWidth: 1200, margin: "0 auto",
            justifyContent: "center",
            alignItems: "flex-start",
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

          {/* ── FCS Strip ── */}
          <div style={{ marginBottom: 40 }}>
            <FCSStrip />
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
          }}>
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: 800, height: 280,
              background: "rgba(139,92,246,0.10)",
              filter: "blur(100px)", pointerEvents: "none",
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
                color: "rgba(230,237,243,0.75)",
                margin: "0 auto 40px", maxWidth: 380, lineHeight: 1.6,
              }}>
                Join thousands of creators building the future with Zencra.
              </p>
              <button style={{
                padding: "16px 56px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                color: "#fff", fontFamily: "'Syne', sans-serif",
                fontSize: 16, fontWeight: 700, letterSpacing: "0.04em",
                cursor: "pointer",
                boxShadow: "0 0 40px rgba(139,92,246,0.48), 0 0 80px rgba(139,92,246,0.20)",
                transition: "all 0.25s ease",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "scale(1.04)";
                  e.currentTarget.style.boxShadow = "0 0 60px rgba(139,92,246,0.68), 0 0 120px rgba(139,92,246,0.30)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 0 40px rgba(139,92,246,0.48), 0 0 80px rgba(139,92,246,0.20)";
                }}
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
                }}>Trusted by 50,000+ creators worldwide</span>
              </div>
            </div>

            {/* Legal */}
            <div style={{
              textAlign: "center", padding: "24px 24px 48px",
              fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
              color: "rgba(71,85,105,0.42)", lineHeight: 1.7,
            }}>
              Prices shown in USD. Credit costs vary by model and resolution.<br />
              All plans include a commercial license. Future Cinema Studio requires Pro or Business subscription.<br />
              <span style={{ fontStyle: "italic" }}>ⓘ Output may vary based on model selection and quality settings.</span>
              {"  ·  "}Credits reset monthly. Unused credits do not roll over.
            </div>
          </div>

          </div>{/* /content wrapper */}
        </div>{/* /glass panel */}
      </div>{/* /click-outside wrapper */}
    </div>
  );
}

export default PricingOverlay;
