"use client";

import { useRouter } from "next/navigation";
import { Zap, Star, Rocket, Building2, Check, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Locked plan data (mirrors production billing values) ──────────────────────
interface Plan {
  key: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  name: string;
  oldPrice: string;
  price: string;
  yearlyPrice: string;
  highlight: boolean;
  credits: string;
  capacity: string;
  bullets: string[];
}

const PLANS: Plan[] = [
  {
    key: "starter",
    Icon: Zap,
    iconColor: "#60A5FA",
    iconBg: "rgba(96,165,250,0.10)",
    name: "Starter",
    oldPrice: "$19",
    price: "$12",
    yearlyPrice: "$120 / yr",
    highlight: false,
    credits: "600 credits / month",
    capacity: "Up to 75 images or 5 clips / mo",
    bullets: [
      "Basic & Pro Image Models",
      "Fast Video Generation",
      "AI Audio Tools",
      "Standard Priority",
      "Community Support",
    ],
  },
  {
    key: "creator",
    Icon: Star,
    iconColor: "#A78BFA",
    iconBg: "rgba(167,139,250,0.12)",
    name: "Creator",
    oldPrice: "$49",
    price: "$29",
    yearlyPrice: "$290 / yr",
    highlight: true,
    credits: "1,600 credits / month",
    capacity: "Up to 200 images or 13 clips / mo",
    bullets: [
      "All Image Models",
      "All Video Models",
      "AI Audio & Voiceover",
      "Priority Generation",
      "Email Support",
    ],
  },
  {
    key: "pro",
    Icon: Rocket,
    iconColor: "#34D399",
    iconBg: "rgba(52,211,153,0.10)",
    name: "Pro",
    oldPrice: "$79",
    price: "$49",
    yearlyPrice: "$490 / yr",
    highlight: false,
    credits: "3,500 credits / month",
    capacity: "Up to 437 images or 29 clips / mo",
    bullets: [
      "All Image Models",
      "All Video Models",
      "AI Audio & Voiceover",
      "Advanced Features",
      "Priority Support",
    ],
  },
  {
    key: "business",
    Icon: Building2,
    iconColor: "#FBBF24",
    iconBg: "rgba(251,191,36,0.10)",
    name: "Business",
    oldPrice: "$149",
    price: "$89",
    yearlyPrice: "$890 / yr",
    highlight: false,
    credits: "8,000 credits / month",
    capacity: "Up to 1,000 images or 66 clips / mo",
    bullets: [
      "All Image & Video Models",
      "AI Audio & Voiceover",
      "Highest Priority Generation",
      "Workspace Asset Library",
      "Dedicated Support",
    ],
  },
];

// ── Scoped styles ─────────────────────────────────────────────────────────────
const CSS = `
  /* ── HomePricingPreview ──────────────────────────────────────────────── */
  .hpp-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 32px 24px 28px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.022);
    border-radius: 0;
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    overflow: visible;
  }
  .hpp-card:hover {
    transform: translateY(-5px);
    border-color: rgba(255,255,255,0.18);
    box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 32px rgba(99,102,241,0.08);
  }
  .hpp-card-hl {
    background: linear-gradient(160deg,
      rgba(99,102,241,0.12) 0%,
      rgba(139,92,246,0.08) 55%,
      rgba(99,102,241,0.05) 100%);
    border-color: rgba(139,92,246,0.30);
    box-shadow: 0 0 50px rgba(139,92,246,0.09), 0 0 120px rgba(99,102,241,0.04);
  }
  .hpp-card-hl:hover {
    border-color: rgba(139,92,246,0.52);
    box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 48px rgba(139,92,246,0.16);
  }

  /* Most Popular badge */
  .hpp-badge {
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 16px;
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #fff;
    white-space: nowrap;
    border-radius: 0;
    box-shadow: 0 4px 20px rgba(99,102,241,0.38), 0 0 0 1px rgba(139,92,246,0.25);
  }

  /* Plan header row — icon + name side by side */
  .hpp-plan-header {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 20px;
  }

  /* Plan icon box */
  .hpp-icon-box {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0;
    flex-shrink: 0;
  }

  /* Plan name */
  .hpp-plan-name {
    font-family: var(--font-display, 'Syne', sans-serif);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    margin: 0;
    line-height: 1;
  }

  /* Strikethrough old price */
  .hpp-old-price {
    font-size: 12px;
    color: rgba(255,255,255,0.40);
    text-decoration: line-through;
    line-height: 1;
    margin-bottom: 4px;
  }

  /* Main price */
  .hpp-price-row {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    margin-bottom: 6px;
    line-height: 1;
  }
  .hpp-price-num {
    font-family: var(--font-display, 'Syne', sans-serif);
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #F8FAFC;
    line-height: 1;
  }
  .hpp-price-per {
    font-size: 13px;
    color: rgba(255,255,255,0.38);
    margin-bottom: 4px;
  }

  /* Yearly row */
  .hpp-yearly-row {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 20px;
  }
  .hpp-yearly-text {
    font-size: 11px;
    color: rgba(255,255,255,0.34);
  }
  .hpp-save-pill {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #34D399;
    background: rgba(52,211,153,0.10);
    border: 1px solid rgba(52,211,153,0.22);
    padding: 2px 7px;
    border-radius: 0;
  }

  /* Credits block */
  .hpp-credits {
    font-size: 13px;
    font-weight: 700;
    color: #F1F5F9;
    margin: 0 0 3px;
    line-height: 1.3;
  }
  .hpp-capacity {
    font-size: 11px;
    color: rgba(255,255,255,0.36);
    margin: 0 0 18px;
    line-height: 1.5;
  }

  /* Divider */
  .hpp-divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin-bottom: 16px;
  }

  /* Bullet list */
  .hpp-bullets {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }
  .hpp-bullet {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.68);
    line-height: 1.45;
  }
  .hpp-bullet-check {
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* CTA band */
  .hpp-cta-band {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 30px 32px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    margin-top: 36px;
    border-radius: 0;
    flex-wrap: wrap;
  }
  .hpp-cta-icon-stack {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .hpp-cta-icon-ring {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--page-bg, #07090F);
  }
  .hpp-cta-copy {
    flex: 1;
    min-width: 0;
  }
  .hpp-cta-title {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: #F8FAFC;
    margin: 0 0 5px;
    line-height: 1.2;
  }
  .hpp-cta-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.42);
    margin: 0;
    line-height: 1.4;
  }
  .hpp-cta-btn-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .hpp-cta-btn-glow {
    position: absolute;
    inset: -8px -12px;
    background: radial-gradient(ellipse 100% 100% at 50% 50%, rgba(99,102,241,0.22) 0%, transparent 70%);
    pointer-events: none;
    border-radius: 0;
  }
  .hpp-cta-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    border-radius: 0;
    transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    white-space: nowrap;
    box-shadow: 0 4px 24px rgba(99,102,241,0.35);
  }
  .hpp-cta-btn:hover {
    opacity: 0.88;
    transform: translateY(-1px);
    box-shadow: 0 8px 26px rgba(99,102,241,0.32);
  }

  @media (max-width: 640px) {
    .hpp-cta-band {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
    .hpp-cta-btn { width: 100%; justify-content: center; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hpp-card, .hpp-cta-btn { transition: none; }
    .hpp-card:hover { transform: none; }
    .hpp-cta-btn:hover { transform: none; }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export function HomePricingPreview() {
  const router = useRouter();

  return (
    <section
      className="py-14 md:py-20"
      style={{ backgroundColor: "var(--page-bg)", position: "relative", overflow: "hidden" }}
    >
      <style>{CSS}</style>

      {/* Ambient top glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "340px",
          background: "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div className="container-site" style={{ position: "relative", zIndex: 1 }}>

        {/* ── Section header ─────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "52px" }}>
          <p style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(99,102,241,0.90)",
            marginBottom: "16px",
          }}>
            Flexible Pricing
          </p>
          <h2
            className="font-display"
            style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#F8FAFC",
              margin: "0 0 16px",
            }}
          >
            Plans for Every Creator
          </h2>
          <p style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.44)",
            lineHeight: 1.65,
            maxWidth: "400px",
            margin: "0 auto",
          }}>
            Choose the perfect plan and scale your creativity.
          </p>
        </div>

        {/* ── 4-card grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {PLANS.map(({ key, Icon, iconColor, iconBg, name, oldPrice, price, yearlyPrice,
                        highlight, credits, capacity, bullets }) => (
            <div
              key={key}
              className={`hpp-card${highlight ? " hpp-card-hl" : ""}`}
            >
              {/* Most Popular badge */}
              {highlight && <div className="hpp-badge">Most Popular</div>}

              {/* Icon + Plan name row */}
              <div className="hpp-plan-header">
                <div
                  className="hpp-icon-box"
                  style={{ background: iconBg, border: `1px solid ${iconColor}35` }}
                >
                  <Icon size={20} style={{ color: iconColor }} />
                </div>
                <p className="hpp-plan-name" style={{ color: iconColor }}>{name}</p>
              </div>

              {/* Pricing */}
              <p className="hpp-old-price">{oldPrice}<span style={{ fontSize: "10px" }}>/mo</span></p>
              <div className="hpp-price-row">
                <span className="hpp-price-num">{price}</span>
                <span className="hpp-price-per">/mo</span>
              </div>
              <div className="hpp-yearly-row">
                <span className="hpp-yearly-text">{yearlyPrice}</span>
                <span className="hpp-save-pill">Save 20%</span>
              </div>

              {/* Credits + capacity */}
              <p className="hpp-credits">{credits}</p>
              <p className="hpp-capacity">{capacity}</p>

              {/* Divider */}
              <div className="hpp-divider" />

              {/* Feature bullets */}
              <ul className="hpp-bullets">
                {bullets.map((b) => (
                  <li key={b} className="hpp-bullet">
                    <Check
                      size={12}
                      className="hpp-bullet-check"
                      style={{ color: highlight ? "#A78BFA" : "rgba(255,255,255,0.32)" }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── CTA band ───────────────────────────────────────────────────── */}
        <div className="hpp-cta-band">

          {/* Icon stack */}
          <div className="hpp-cta-icon-stack">
            <div
              className="hpp-cta-icon-ring"
              style={{ background: "linear-gradient(135deg, #1E293B, #0F172A)", zIndex: 2 }}
            >
              <Zap size={17} style={{ color: "#FBBF24" }} />
            </div>
            <div
              className="hpp-cta-icon-ring"
              style={{
                background: "linear-gradient(135deg, #1E1B4B, #312E81)",
                marginLeft: "-11px",
                zIndex: 1,
              }}
            >
              <Star size={17} style={{ color: "#A78BFA" }} />
            </div>
          </div>

          {/* Copy */}
          <div className="hpp-cta-copy">
            <p className="hpp-cta-title">Not sure which plan fits you best?</p>
            <p className="hpp-cta-sub">Upgrade, downgrade, or cancel anytime.</p>
          </div>

          {/* CTA button → /waitlist (temporary until /pricing is live) */}
          <div className="hpp-cta-btn-wrap">
            <div className="hpp-cta-btn-glow" aria-hidden="true" />
            <button
              className="hpp-cta-btn"
              onClick={() => router.push("/waitlist")}
            >
              View All Plans &amp; Features
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
