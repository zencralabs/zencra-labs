"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PricingOverlay — Fullscreen cinematic pricing preview (v2 polish)
// Design: Space-dark base · per-plan neon glows · CSS-only animation
// Typography: Syne (display) · Familjen Grotesk (body/UI)
// Standalone component — wire separately
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
  monthlyPrice: number;
  yearlyPrice: number;
  credits: number;
  outputLine: string;
  tagline: string;
  glow: string;
  glowStrong: string;
  border: string;
  borderHover: string;
  ctaLabel: string;
  ctaBg: string;
  ctaColor: string;
  ctaShadow: string;
  highlight?: boolean;
  highlightLabel?: string;
  whiteCard?: boolean;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const TEAL   = "#0EA5A0";
const PURPLE = "#8B5CF6";
const AMBER  = "#F59E0B";
const BLUE   = "#3B82F6";
const WHITE  = "#F8FAFC";

// ── Plan definitions ──────────────────────────────────────────────────────────
// Fix #1: Creator is primary (highlight, lift, badge). Pro is secondary.
// Fix #2: Output lines lead with "Create up to…"

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 12,
    yearlyPrice: 120,
    credits: 600,
    outputLine: "Create up to 75 images or 5 video clips",
    tagline: "Start creating with AI today.",
    glow: "rgba(100,116,139,0.25)",
    glowStrong: "rgba(100,116,139,0.50)",
    border: "rgba(100,116,139,0.25)",
    borderHover: "rgba(100,116,139,0.65)",
    ctaLabel: "Start Free (Upgrade later)",
    ctaBg: "rgba(100,116,139,0.18)",
    ctaColor: "#CBD5E1",
    ctaShadow: "none",
  },
  {
    id: "creator",
    name: "Creator",
    monthlyPrice: 29,
    yearlyPrice: 290,
    credits: 1600,
    outputLine: "Create up to 200 images or 13 video clips",
    tagline: "For active creators going daily.",
    glow: "rgba(14,165,160,0.32)",
    glowStrong: "rgba(14,165,160,0.65)",
    border: "rgba(14,165,160,0.50)",
    borderHover: "rgba(14,165,160,0.95)",
    ctaLabel: "Get Started",
    ctaBg: `linear-gradient(135deg, ${TEAL} 0%, #0C8E8A 100%)`,
    ctaColor: "#fff",
    ctaShadow: `0 0 28px rgba(14,165,160,0.55)`,
    highlight: true,
    highlightLabel: "Most Popular",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    yearlyPrice: 490,
    credits: 3500,
    outputLine: "Create up to 437 images or 29 video clips",
    tagline: "Power users. Priority everything.",
    glow: "rgba(139,92,246,0.28)",
    glowStrong: "rgba(139,92,246,0.55)",
    border: "rgba(139,92,246,0.45)",
    borderHover: "rgba(139,92,246,0.90)",
    ctaLabel: "Get Started",
    ctaBg: `linear-gradient(135deg, ${PURPLE} 0%, #6D28D9 100%)`,
    ctaColor: "#fff",
    ctaShadow: `0 0 28px rgba(139,92,246,0.50)`,
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 89,
    yearlyPrice: 890,
    credits: 8000,
    outputLine: "Create up to 1,000 images or 66 video clips",
    tagline: "Studios, teams, and heavy pipelines.",
    glow: "rgba(59,130,246,0.28)",
    glowStrong: "rgba(59,130,246,0.55)",
    border: "rgba(248,250,252,0.65)",
    borderHover: "rgba(248,250,252,1.0)",
    ctaLabel: "Get Started",
    ctaBg: `linear-gradient(135deg, #2563EB 0%, ${BLUE} 100%)`,
    ctaColor: "#fff",
    ctaShadow: `0 0 24px rgba(59,130,246,0.45)`,
    whiteCard: true,
  },
];

// ── Boost pack definitions ────────────────────────────────────────────────────

const BOOST_PACKS = [
  { credits: 500,  price: 15, label: "500 cr",  sublabel: "$15" },
  { credits: 1000, price: 25, label: "1,000 cr", sublabel: "$25" },
  { credits: 2500, price: 59, label: "2,500 cr", sublabel: "$59" },
  { credits: 5000, price: 99, label: "5,000 cr", sublabel: "$99" },
];

// ── Comparison table ──────────────────────────────────────────────────────────

const COMPARE_ROWS: { feature: string; values: (string | boolean)[] }[] = [
  { feature: "Monthly Credits",     values: ["600",    "1,600",      "3,500",    "8,000"]  },
  { feature: "AI Image Generation", values: [true,     true,         true,       true]     },
  { feature: "AI Video Generation", values: ["Basic",  "All models", "All models","All models"] },
  { feature: "Max Video Length",    values: ["5s",     "10s",        "20s",      "Custom"] },
  { feature: "Concurrent Jobs",     values: ["1",      "2",          "5",        "10"]     },
  { feature: "Asset Storage",       values: ["5 GB",   "15 GB",      "50 GB",    "200 GB"] },
  { feature: "Commercial License",  values: [true,     true,         true,       true]     },
  { feature: "Priority Queue",      values: [false,    false,        true,       true]     },
  { feature: "API Access",          values: [false,    false,        true,       true]     },
  { feature: "Film Creative Suite", values: [false,    false,        "Add-on",   "Add-on"] },
  { feature: "Priority Support",    values: [false,    false,        false,      true]     },
  { feature: "Custom Brand Kit",    values: [false,    false,        false,      true]     },
];

// ── CSS keyframes injected once ───────────────────────────────────────────────
// Fix #3: Added bg-drift for animated depth
// Fix #5: Added node-pulse for boost slider active state
// Fix #7: Added fadeout + slidedown for smooth close

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
  from { opacity: 0; transform: translateY(28px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
@keyframes zpo-slidedown {
  from { opacity: 1; transform: translateY(0)   scale(1); }
  to   { opacity: 0; transform: translateY(22px) scale(0.97); }
}
@keyframes zpo-glow-pulse {
  0%, 100% { opacity: 0.65; }
  50%       { opacity: 1.0; }
}
@keyframes zpo-badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,160,0.55); }
  50%       { box-shadow: 0 0 0 7px rgba(14,165,160,0); }
}
@keyframes zpo-bg-drift {
  0%   { transform: translate(0px,   0px)   scale(1.00); opacity: 0.10; }
  33%  { transform: translate(30px, -15px)  scale(1.12); opacity: 0.16; }
  66%  { transform: translate(-20px, 20px)  scale(1.08); opacity: 0.13; }
  100% { transform: translate(0px,   0px)   scale(1.00); opacity: 0.10; }
}
@keyframes zpo-node-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(14,165,160,0.65), 0 0 22px rgba(14,165,160,0.35); }
  50%       { box-shadow: 0 0 20px rgba(14,165,160,0.95), 0 0 40px rgba(14,165,160,0.55); }
}
@keyframes zpo-card-radial {
  0%, 100% { opacity: 0.60; }
  50%       { opacity: 1.0; }
}
`;

// ── Close duration (ms) ───────────────────────────────────────────────────────
const CLOSE_MS = 330;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CheckIcon({ color = TEAL }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" stroke={color} strokeOpacity="0.35" />
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

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="rgba(71,85,105,0.40)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="rgba(71,85,105,0.40)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────────
// Fix #1: Creator highlighted, Pro no longer lifted
// Fix #2: Output line is visually primary (larger, gradient text on highlight)
// Fix #4: Hover = scale(1.03) + glow intensifies + border brightens

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
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  // Border brightens on hover
  const borderColor = hovered || selected ? plan.borderHover : plan.border;

  // Transform: highlighted card stays lifted; others scale up on hover
  const transform = plan.highlight
    ? `translateY(-14px)${hovered ? " scale(1.02)" : ""}`
    : hovered
      ? "translateY(-5px) scale(1.03)"
      : "translateY(0) scale(1)";

  const boxShadow = (hovered || selected)
    ? `0 0 56px ${plan.glow}, 0 0 110px ${plan.glowStrong}, inset 0 1px 0 rgba(255,255,255,0.07)`
    : plan.highlight
      ? `0 0 38px ${plan.glow}, 0 0 72px ${plan.glowStrong}, inset 0 1px 0 rgba(255,255,255,0.05)`
      : `0 0 22px ${plan.glow}, inset 0 1px 0 rgba(255,255,255,0.03)`;

  // Plan accent color (used for name, checks — avoids highlight vs id confusion)
  const accentColor =
    plan.id === "creator"  ? TEAL   :
    plan.id === "pro"      ? PURPLE :
    plan.whiteCard         ? BLUE   :
    "rgba(148,163,184,0.75)";

  const features: string[] = [
    "AI image generation",
    "AI video generation",
    plan.id === "starter" ? "Basic video models" : "All video models",
    plan.id !== "starter" && plan.id !== "creator" ? "Priority queue" : "",
    plan.id !== "starter" && plan.id !== "creator" ? "API access" : "",
    "Commercial license",
    plan.id === "business" ? "Priority support" : "",
    plan.id === "business" ? "Custom brand kit" : "",
  ].filter(Boolean);

  return (
    <div
      style={{
        position: "relative",
        flex: "1 1 220px",
        minWidth: 210,
        maxWidth: 280,
        borderRadius: 20,
        padding: plan.highlight ? "32px 24px 26px" : "28px 24px 24px",
        background: plan.whiteCard
          ? "linear-gradient(160deg, rgba(248,250,252,0.07) 0%, rgba(59,130,246,0.05) 100%)"
          : plan.highlight
            ? "linear-gradient(160deg, rgba(14,165,160,0.08) 0%, rgba(14,165,160,0.03) 100%)"
            : "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1.5px solid ${borderColor}`,
        boxShadow,
        transition: "box-shadow 0.32s ease, transform 0.28s cubic-bezier(0.22,1,0.36,1), border-color 0.22s ease",
        transform,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(plan.id)}
    >
      {/* Popular badge — Creator only */}
      {plan.highlight && (
        <div style={{
          position: "absolute",
          top: -14,
          left: "50%",
          transform: "translateX(-50%)",
          background: `linear-gradient(90deg, ${TEAL} 0%, #0C8E8A 100%)`,
          color: "#fff",
          fontSize: 10,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          letterSpacing: "0.14em",
          padding: "4px 16px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          boxShadow: `0 0 20px rgba(14,165,160,0.60)`,
          animation: "zpo-badge-pulse 2.5s ease-in-out infinite",
        }}>
          {plan.highlightLabel?.toUpperCase()}
        </div>
      )}

      {/* Plan name */}
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.16em",
        color: accentColor,
        textTransform: "uppercase",
        marginBottom: 10,
      }}>
        {plan.name}
      </div>

      {/* Price */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 16 }}>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 50,
          fontWeight: 800,
          lineHeight: 1,
          color: WHITE,
          letterSpacing: "-0.035em",
        }}>
          ${price}
        </span>
        <span style={{
          fontFamily: "'Familjen Grotesk', sans-serif",
          fontSize: 13,
          color: "rgba(148,163,184,0.60)",
          marginBottom: 9,
        }}>
          / {billing === "yearly" ? "yr" : "mo"}
        </span>
      </div>

      {/* OUTPUT LINE — Primary selling point (Fix #2) */}
      <div style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: plan.highlight ? 15 : 14,
        fontWeight: 700,
        lineHeight: 1.35,
        marginBottom: 6,
        // Gradient text for Creator (primary plan)
        ...(plan.highlight
          ? {
              background: `linear-gradient(135deg, #fff 0%, ${TEAL} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }
          : {
              color: "rgba(248,250,252,0.88)",
            }),
      }}>
        {plan.outputLine}
      </div>

      {/* Credits — secondary */}
      <div style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 11.5,
        color: "rgba(100,116,139,0.55)",
        marginBottom: 20,
        letterSpacing: "0.02em",
      }}>
        {plan.credits.toLocaleString()} credits / month
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`,
        marginBottom: 16,
      }} />

      {/* Tagline */}
      <div style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 12,
        color: "rgba(148,163,184,0.50)",
        marginBottom: 14,
        fontStyle: "italic",
      }}>
        {plan.tagline}
      </div>

      {/* Feature list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckIcon color={accentColor} />
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 12.5,
              color: "rgba(203,213,225,0.78)",
            }}>
              {f}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop: "auto" }}>
        <button
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 10,
            border: "none",
            background: plan.ctaBg,
            color: plan.ctaColor,
            fontFamily: "'Syne', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.07em",
            cursor: "pointer",
            boxShadow: plan.ctaShadow,
            transition: "all 0.22s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "0.88";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1)";
          }}
          onClick={e => e.stopPropagation()}
        >
          {plan.ctaLabel}
        </button>
      </div>
    </div>
  );
}

// ── FCSStrip ──────────────────────────────────────────────────────────────────

function FCSStrip() {
  const [proEnabled, setProEnabled]   = useState(false);
  const [bizEnabled, setBizEnabled]   = useState(false);

  const Toggle = ({ active, onChange, color }: { active: boolean; onChange: () => void; color: string }) => (
    <button
      onClick={onChange}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: active ? color : "rgba(30,41,59,0.80)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.25s ease",
        boxShadow: active ? `0 0 14px ${color}60` : "none",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute",
        top: 3,
        left: active ? 20 : 3,
        width: 16,
        height: 16,
        borderRadius: 8,
        background: "#fff",
        transition: "left 0.22s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
      }} />
    </button>
  );

  return (
    <div style={{ margin: "0 auto", maxWidth: 1080, padding: "0 24px" }}>
      <div style={{
        borderRadius: 18,
        background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.08) 50%, rgba(245,158,11,0.04) 100%)",
        border: "1px solid rgba(245,158,11,0.20)",
        padding: "28px 36px",
        display: "flex",
        alignItems: "center",
        gap: 40,
        flexWrap: "wrap",
      }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: 3,
              background: `linear-gradient(135deg, ${AMBER}, ${PURPLE})`,
              boxShadow: `0 0 8px ${AMBER}88`,
            }} />
            <span style={{
              fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.16em", color: AMBER, textTransform: "uppercase",
            }}>Film Creative Suite</span>
          </div>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13,
            color: "rgba(203,213,225,0.68)", lineHeight: 1.65, maxWidth: 400,
          }}>
            Professional film-grade tools: lip sync, voice cloning, audio detection, and advanced sequence control. Available as an add-on on Pro and Business.
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          {/* Pro */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            padding: "16px 22px", borderRadius: 12,
            background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.20)",
            minWidth: 160,
          }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: "0.12em", textTransform: "uppercase" }}>Pro Add-on</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: WHITE, letterSpacing: "-0.02em" }}>
              +$29<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.55)" }}>/mo</span>
            </div>
            <div style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11, color: "rgba(148,163,184,0.50)" }}>+800 credits/mo</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, color: proEnabled ? PURPLE : "rgba(100,116,139,0.65)" }}>
                {proEnabled ? "Enabled" : "Enable"}
              </span>
              <Toggle active={proEnabled} onChange={() => setProEnabled(v => !v)} color={PURPLE} />
            </div>
          </div>

          {/* Business */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            padding: "16px 22px", borderRadius: 12,
            background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)",
            minWidth: 160,
          }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: "0.12em", textTransform: "uppercase" }}>Business Add-on</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: WHITE, letterSpacing: "-0.02em" }}>
              +$49<span style={{ fontSize: 12, fontWeight: 400, color: "rgba(148,163,184,0.55)" }}>/mo</span>
            </div>
            <div style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11, color: "rgba(148,163,184,0.50)" }}>+1,800 credits/mo</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, color: bizEnabled ? AMBER : "rgba(100,116,139,0.65)" }}>
                {bizEnabled ? "Enabled" : "Enable"}
              </span>
              <Toggle active={bizEnabled} onChange={() => setBizEnabled(v => !v)} color={AMBER} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BoostSlider ───────────────────────────────────────────────────────────────
// Fix #5: Active node pulses, larger knob, stronger selected tier callout

function BoostSlider() {
  const [selected, setSelected] = useState(1);
  const pack = BOOST_PACKS[selected];
  const trackFill = (selected / (BOOST_PACKS.length - 1)) * 100;

  return (
    <div style={{ margin: "0 auto", maxWidth: 1080, padding: "0 24px" }}>
      <div style={{
        borderRadius: 18,
        background: "linear-gradient(135deg, rgba(14,165,160,0.05) 0%, rgba(14,165,160,0.02) 100%)",
        border: "1px solid rgba(14,165,160,0.15)",
        padding: "32px 40px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.16em", color: TEAL, textTransform: "uppercase", marginBottom: 6,
            }}>Boost Packs</div>
            <div style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, color: "rgba(148,163,184,0.60)" }}>
              Need more? Add credits to any plan — one-time purchase, no expiry.
            </div>
          </div>

          {/* Selected pack callout — stronger highlight */}
          <div style={{
            padding: "12px 24px",
            borderRadius: 12,
            background: "rgba(14,165,160,0.14)",
            border: "1px solid rgba(14,165,160,0.40)",
            textAlign: "center",
            boxShadow: `0 0 24px rgba(14,165,160,0.20)`,
            transition: "all 0.25s ease",
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800,
              color: TEAL, letterSpacing: "-0.025em",
              transition: "all 0.22s ease",
            }}>
              {pack.label}
            </div>
            <div style={{ fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, color: "rgba(203,213,225,0.60)", marginTop: 2 }}>
              for {pack.sublabel}
            </div>
          </div>
        </div>

        {/* Snap track */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", marginBottom: 16 }}>
          {/* Track */}
          <div style={{
            position: "absolute",
            left: 13,
            right: 13,
            top: 13,
            height: 4,
            borderRadius: 2,
            background: "rgba(30,41,59,0.90)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${trackFill}%`,
              background: `linear-gradient(90deg, ${TEAL}, rgba(14,165,160,0.55))`,
              borderRadius: 2,
              transition: "width 0.30s cubic-bezier(0.22,1,0.36,1)",
              boxShadow: `0 0 10px ${TEAL}88`,
            }} />
          </div>

          {/* Snap points */}
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
            {BOOST_PACKS.map((b, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <button
                  onClick={() => setSelected(i)}
                  style={{
                    width: i === selected ? 28 : 16,
                    height: i === selected ? 28 : 16,
                    borderRadius: "50%",
                    border: `2px solid ${i === selected ? TEAL : i < selected ? "rgba(14,165,160,0.50)" : "rgba(30,41,59,0.80)"}`,
                    background: i === selected
                      ? `radial-gradient(circle, ${TEAL} 0%, #0C8E8A 100%)`
                      : i < selected
                        ? "rgba(14,165,160,0.45)"
                        : "rgba(15,23,42,0.85)",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                    // Fix #5: pulse animation on active node
                    animation: i === selected ? "zpo-node-pulse 2.2s ease-in-out infinite" : "none",
                    padding: 0,
                  }}
                />
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: i === selected ? 13 : 12,
                    fontWeight: i === selected ? 700 : 500,
                    color: i === selected ? TEAL : "rgba(100,116,139,0.50)",
                    transition: "all 0.22s ease",
                    whiteSpace: "nowrap",
                  }}>
                    {b.label}
                  </div>
                  <div style={{
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    fontSize: 11,
                    color: i === selected ? "rgba(203,213,225,0.70)" : "rgba(71,85,105,0.45)",
                    transition: "color 0.22s",
                  }}>
                    {b.sublabel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <button
            style={{
              padding: "11px 34px",
              borderRadius: 10,
              border: `1px solid rgba(14,165,160,0.40)`,
              background: "rgba(14,165,160,0.10)",
              color: TEAL,
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "all 0.22s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(14,165,160,0.20)";
              e.currentTarget.style.boxShadow = `0 0 20px rgba(14,165,160,0.35)`;
              e.currentTarget.style.borderColor = "rgba(14,165,160,0.65)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(14,165,160,0.10)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(14,165,160,0.40)";
            }}
          >
            Add {pack.label} for {pack.sublabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ComparisonTable ───────────────────────────────────────────────────────────
// Fix #6: More row spacing, Creator column subtle highlight, reduced noise

function ComparisonTable({ billing }: { billing: BillingCycle }) {
  const planColors = [
    "rgba(100,116,139,0.65)",
    TEAL,
    PURPLE,
    BLUE,
  ];

  const renderValue = (val: string | boolean, colIdx: number) => {
    if (val === true)  return <CheckIcon color={planColors[colIdx]} />;
    if (val === false) return <CrossIcon />;
    if (val === "Add-on") return (
      <span style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 11, fontWeight: 600, color: AMBER,
        background: "rgba(245,158,11,0.09)",
        border: "1px solid rgba(245,158,11,0.22)",
        borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap",
      }}>Add-on</span>
    );
    return (
      <span style={{
        fontFamily: "'Familjen Grotesk', sans-serif",
        fontSize: 12.5, color: "rgba(203,213,225,0.78)",
        // Highlight Creator column values slightly
        ...(colIdx === 1 ? { fontWeight: 600 } : {}),
      }}>{val as string}</span>
    );
  };

  return (
    <div style={{ margin: "0 auto", maxWidth: 1080, padding: "0 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.16em", color: "rgba(100,116,139,0.50)", textTransform: "uppercase",
        }}>Full Comparison</div>
      </div>

      <div style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(255,255,255,0.015)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr repeat(4, 120px)",
          padding: "18px 28px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 11, color: "rgba(71,85,105,0.60)",
            fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          }}>Feature</div>
          {PLANS.map((p, i) => (
            <div key={p.id} style={{
              textAlign: "center",
              fontFamily: "'Syne', sans-serif",
              fontSize: 12, fontWeight: 700,
              letterSpacing: "0.10em",
              color: planColors[i],
              textTransform: "uppercase",
              // Creator column header highlight
              ...(i === 1 ? {
                background: "rgba(14,165,160,0.08)",
                borderRadius: 8,
                padding: "4px 0",
              } : {}),
            }}>{p.name}</div>
          ))}
        </div>

        {/* Rows */}
        {COMPARE_ROWS.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr repeat(4, 120px)",
              padding: "17px 28px",
              borderBottom: rowIdx < COMPARE_ROWS.length - 1
                ? "1px solid rgba(255,255,255,0.035)"
                : "none",
              background: rowIdx % 2 === 0
                ? "rgba(255,255,255,0.008)"
                : "transparent",
              alignItems: "center",
            }}
          >
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13, color: "rgba(148,163,184,0.72)",
            }}>
              {row.feature}
            </div>
            {row.values.map((val, colIdx) => (
              <div key={colIdx} style={{
                display: "flex",
                justifyContent: "center",
                // Creator column subtle bg tint
                ...(colIdx === 1 ? {
                  background: "rgba(14,165,160,0.04)",
                  borderRadius: 6,
                  padding: "4px 0",
                } : {}),
              }}>
                {renderValue(val, colIdx)}
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
  const [selected, setSelected] = useState<string>("creator");    // Fix #1: Creator default
  const [closing, setClosing]   = useState(false);               // Fix #7: smooth close state
  const scrollRef               = useRef<HTMLDivElement>(null);

  // Inject keyframes once
  useEffect(() => {
    const id = "zpo-keyframes";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = KEYFRAMES;
      document.head.appendChild(s);
    }
  }, []);

  // Fix #7: Smooth close — animate out, then call onClose after CLOSE_MS
  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(), CLOSE_MS);
  }, [closing, onClose]);

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(2,6,23,0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          // Fix #7: reverse animation on close
          animation: closing
            ? `zpo-fadeout ${CLOSE_MS}ms ease forwards`
            : "zpo-fadein 0.30s ease",
        }}
      />

      {/* ── Panel ── */}
      <div
        ref={scrollRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1001,
          overflowY: "auto",
          overflowX: "hidden",
          animation: closing
            ? `zpo-slidedown ${CLOSE_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`
            : "zpo-slideup 0.45s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Fix #3: Space gradient + animated depth layers + edge vignette */}
        <div style={{
          minHeight: "100%",
          position: "relative",
          background: `
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(14,165,160,0.13) 0%, transparent 65%),
            radial-gradient(ellipse 70% 50% at 15% 85%, rgba(139,92,246,0.09) 0%, transparent 55%),
            radial-gradient(ellipse 55% 45% at 85% 85%, rgba(59,130,246,0.07) 0%, transparent 55%),
            linear-gradient(180deg, #020617 0%, #060D1A 50%, #020617 100%)
          `,
        }}>
          {/* Animated depth blob — drifts slowly for cinematic depth */}
          <div style={{
            position: "fixed",
            top: "10%",
            left: "25%",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14,165,160,0.09) 0%, transparent 70%)",
            animation: "zpo-bg-drift 18s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 0,
          }} />
          <div style={{
            position: "fixed",
            top: "50%",
            left: "60%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
            animation: "zpo-bg-drift 24s ease-in-out infinite reverse",
            pointerEvents: "none",
            zIndex: 0,
          }} />
          {/* Edge vignette */}
          <div style={{
            position: "fixed",
            inset: 0,
            background: `
              radial-gradient(ellipse 100% 100% at 50% 50%, transparent 60%, rgba(2,6,23,0.70) 100%)
            `,
            pointerEvents: "none",
            zIndex: 0,
          }} />

          {/* Content above depth layers */}
          <div style={{ position: "relative", zIndex: 1 }}>

            {/* ── TopBar ── */}
            <div style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 32px",
              background: "rgba(2,6,23,0.82)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(255,255,255,0.045)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `linear-gradient(135deg, ${TEAL} 0%, #0C8E8A 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 14px rgba(14,165,160,0.50)`,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#fff" />
                    <path d="M2 17l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    <path d="M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800,
                  color: WHITE, letterSpacing: "0.04em",
                }}>
                  Zencra<span style={{ color: TEAL }}>.</span>
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button style={{
                  padding: "7px 18px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.09)", background: "transparent",
                  color: "rgba(203,213,225,0.72)",
                  fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.18s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = WHITE; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(203,213,225,0.72)"; }}
                >Log in</button>

                {/* Close button — Fix #7: uses handleClose */}
                <button
                  onClick={handleClose}
                  title="Close (Esc)"
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(148,163,184,0.65)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s", padding: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.12)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.30)";
                    e.currentTarget.style.color = "#EF4444";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
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

            {/* ── Hero Section ── */}
            <div style={{ textAlign: "center", padding: "72px 24px 52px", position: "relative" }}>
              {/* Hero ambient glow */}
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 700, height: 320, borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(14,165,160,0.14) 0%, transparent 70%)",
                animation: "zpo-glow-pulse 4s ease-in-out infinite",
                pointerEvents: "none",
              }} />

              {/* Launch badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 16px", borderRadius: 20,
                background: "rgba(14,165,160,0.10)", border: "1px solid rgba(14,165,160,0.28)",
                marginBottom: 24,
                animation: "zpo-badge-pulse 3s ease-in-out infinite",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: TEAL, boxShadow: `0 0 7px ${TEAL}` }} />
                <span style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.14em", color: TEAL, textTransform: "uppercase",
                }}>Early Access — Launch Pricing</span>
              </div>

              <h1 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(38px, 6vw, 68px)",
                fontWeight: 800, color: WHITE,
                letterSpacing: "-0.03em", lineHeight: 1.05,
                margin: "0 0 16px",
              }}>
                Create Without Limits.
              </h1>

              <p style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: "clamp(15px, 2vw, 18px)",
                color: "rgba(148,163,184,0.72)",
                margin: "0 auto 24px", maxWidth: 480, lineHeight: 1.6,
              }}>
                World-class AI generation. One subscription.
              </p>

              {/* Model names row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, flexWrap: "wrap", marginBottom: 40,
              }}>
                {["Nano Banana Pro", "FLUX Pro", "Seedream v5", "Kling 3.0"].map((model, i) => (
                  <span key={model} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12, fontWeight: 600,
                      color: "rgba(148,163,184,0.50)", letterSpacing: "0.04em",
                    }}>{model}</span>
                    {i < 3 && <span style={{ color: "rgba(71,85,105,0.35)", fontSize: 10 }}>•</span>}
                  </span>
                ))}
              </div>

              {/* Billing toggle */}
              <div style={{
                display: "inline-flex", alignItems: "center",
                borderRadius: 12, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)", padding: 4,
              }}>
                {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBilling(cycle)}
                    style={{
                      padding: "8px 22px", borderRadius: 9, border: "none",
                      background: billing === cycle
                        ? "linear-gradient(135deg, rgba(14,165,160,0.28) 0%, rgba(14,165,160,0.13) 100%)"
                        : "transparent",
                      color: billing === cycle ? TEAL : "rgba(100,116,139,0.55)",
                      fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "capitalize",
                      cursor: "pointer", transition: "all 0.22s ease",
                      boxShadow: billing === cycle ? "0 0 16px rgba(14,165,160,0.22)" : "none",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    {cycle === "yearly" ? "Yearly" : "Monthly"}
                    {cycle === "yearly" && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
                        color: billing === "yearly" ? TEAL : "rgba(71,85,105,0.50)",
                        background: billing === "yearly" ? "rgba(14,165,160,0.14)" : "transparent",
                        padding: "2px 7px", borderRadius: 10,
                        border: billing === "yearly" ? "1px solid rgba(14,165,160,0.28)" : "1px solid transparent",
                        transition: "all 0.22s",
                      }}>SAVE 20%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Pricing Cards ── */}
            {/* Fix #3: Radial glow behind cards section */}
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 900,
                height: 500,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(14,165,160,0.07) 0%, transparent 70%)",
                animation: "zpo-card-radial 6s ease-in-out infinite",
                pointerEvents: "none",
              }} />
              <div style={{
                display: "flex", gap: 16, padding: "0 24px 0",
                maxWidth: 1140, margin: "0 auto",
                justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap",
                position: "relative", zIndex: 1,
              }}>
                {PLANS.map((plan) => (
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

            {/* Fix #8: Micro copy under cards */}
            <div style={{ textAlign: "center", padding: "20px 24px 52px" }}>
              <span style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11.5,
                color: "rgba(71,85,105,0.60)",
                fontStyle: "italic",
              }}>
                Output may vary based on model selection and quality settings.
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
            <div style={{ marginBottom: 60 }}>
              <ComparisonTable billing={billing} />
            </div>

            {/* ── Bottom CTA ── */}
            <div style={{
              textAlign: "center", padding: "60px 24px 80px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                width: 600, height: 240, borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(14,165,160,0.09) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

              <h2 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "clamp(26px, 4vw, 42px)",
                fontWeight: 800, color: WHITE, letterSpacing: "-0.02em",
                margin: "0 0 14px",
              }}>
                Start creating today.
              </h2>
              <p style={{
                fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 15,
                color: "rgba(148,163,184,0.62)", margin: "0 auto 36px", maxWidth: 400,
              }}>
                Join creators using Zencra to build images, videos, and worlds with AI.
              </p>

              <button style={{
                padding: "15px 48px", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${TEAL} 0%, #0C8E8A 100%)`,
                color: "#fff", fontFamily: "'Syne', sans-serif",
                fontSize: 15, fontWeight: 700, letterSpacing: "0.07em",
                cursor: "pointer",
                boxShadow: `0 0 36px rgba(14,165,160,0.48), 0 0 72px rgba(14,165,160,0.20)`,
                transition: "all 0.25s ease",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "scale(1.04)";
                  e.currentTarget.style.boxShadow = `0 0 56px rgba(14,165,160,0.70), 0 0 110px rgba(14,165,160,0.30)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = `0 0 36px rgba(14,165,160,0.48), 0 0 72px rgba(14,165,160,0.20)`;
                }}
              >
                Get Started Free
              </button>

              {/* Trust signals */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 28, marginTop: 32, flexWrap: "wrap",
              }}>
                {["No credit card required", "Cancel anytime", "Commercial license included"].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <polyline points="3.5 8 6.5 11 12.5 5" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{
                      fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 12.5,
                      color: "rgba(100,116,139,0.65)",
                    }}>{item}</span>
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <div style={{
                marginTop: 48,
                fontFamily: "'Familjen Grotesk', sans-serif", fontSize: 11,
                color: "rgba(71,85,105,0.55)", lineHeight: 1.7,
              }}>
                Prices shown in USD. Credit costs vary by model and resolution.<br />
                All plans include a commercial license. FCS requires a Pro or Business subscription.
              </div>
            </div>

          </div>{/* /content zIndex wrapper */}
        </div>{/* /bg */}
      </div>{/* /panel */}
    </>
  );
}

export default PricingOverlay;
