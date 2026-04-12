"use client";

import { CheckCircle, Zap, Star, Building2, Users, ArrowRight, Clapperboard } from "lucide-react";

// ── Pricing hero slider — 4 clean cinematic gradient cards, no tool labels ────
// Replace with real <video> clips (16:9, 520×300px) when ready
const sliderCards = [
  { gradient: "linear-gradient(160deg, #060d1f 0%, #0f2255 40%, #1d4ed8 100%)", accent: "#2563EB" },
  { gradient: "linear-gradient(160deg, #060d18 0%, #0a2828 40%, #0d6b67 100%)", accent: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #0d0618 0%, #2a0e52 40%, #7c3aed 100%)", accent: "#A855F7" },
  { gradient: "linear-gradient(160deg, #180a06 0%, #3d1408 40%, #c2410c 100%)", accent: "#F97316" },
];

const plans = [
  {
    id: "free",
    icon: Zap,
    name: "Free",
    price: "0",
    period: "forever",
    description: "Explore Zencra Labs and try the platform with no commitment.",
    color: "#64748B",
    glow: "rgba(100,116,139,0.3)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a2035 100%)",
    border: "rgba(255,255,255,0.07)",
    cta: "Get Started Free",
    ctaStyle: "outline",
    badge: null,
    features: [
      "5 AI image generations / month",
      "3 AI video generations / month",
      "Standard quality output",
      "Access to Image & Video tools",
      "Community gallery access",
      "Email support",
    ],
    notIncluded: ["Audio & voice tools", "Priority processing", "Commercial licence"],
  },
  {
    id: "creator",
    icon: Star,
    name: "Creator",
    price: "29",
    period: "per month",
    description: "For independent creators ready to produce professional AI content at scale.",
    color: "#2563EB",
    glow: "rgba(37,99,235,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a1040 40%, #1e3a8a 100%)",
    border: "rgba(37,99,235,0.4)",
    cta: "Try Free",
    ctaStyle: "gradient",
    badge: "POPULAR",
    badgeBg: "linear-gradient(135deg, #2563EB, #0EA5A0)",
    features: [
      "100 AI image generations / month",
      "30 AI video generations / month",
      "20 AI audio / voiceover credits",
      "HD & 4K quality output",
      "All tools: Image, Video, Audio",
      "Priority processing queue",
      "Commercial licence included",
      "Priority email support",
    ],
    notIncluded: ["Custom AI workflows", "Dedicated account manager"],
  },
  {
    id: "studio",
    icon: Building2,
    name: "Studio",
    price: "99",
    period: "per month",
    description: "For agencies, studios and power users who need serious creative volume at a professional level.",
    color: "#0EA5A0",
    glow: "rgba(14,165,160,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #0d2626 40%, #0f4038 100%)",
    border: "rgba(14,165,160,0.3)",
    cta: "Go Studio",
    ctaStyle: "teal",
    badge: "BEST VALUE",
    badgeBg: "linear-gradient(135deg, #0EA5A0, #2563EB)",
    features: [
      "500 AI image generations / month",
      "150 AI video generations / month",
      "100 AI audio / voiceover credits",
      "8K quality output",
      "All tools + early access to new features",
      "Fastest processing priority",
      "Full commercial licence",
      "Custom AI creative workflows",
      "Dedicated account manager",
      "API access (coming soon)",
    ],
    notIncluded: [],
  },
  {
    id: "cinema",
    icon: Clapperboard,
    name: "Future Cinema Studio",
    price: "99",
    period: "per month",
    description: "For filmmakers and agencies who need cinematic AI tools, scene control, and advanced storytelling features.",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.4)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a0d2e 40%, #2d1060 100%)",
    border: "rgba(168,85,247,0.35)",
    cta: "Join Waitlist",
    ctaStyle: "purple-outline",
    badge: "COMING SOON",
    badgeBg: "linear-gradient(135deg, #A855F7, #2563EB)",
    features: [
      "Everything in Studio",
      "Scene-based video editing",
      "Storyboard workflow tools",
      "Character consistency across scenes",
      "Shot sequencing & director tools",
      "Full commercial licence",
      "Priority API access",
      "Dedicated account manager",
    ],
    notIncluded: [],
  },
  {
    id: "agency",
    icon: Users,
    name: "Agency",
    price: "—",
    period: "coming soon",
    description: "Multi-seat access for growing teams. Multiple members share one workspace and generate simultaneously.",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.3)",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a0d2e 40%, #3b0764 100%)",
    border: "rgba(168,85,247,0.25)",
    cta: "Join Waitlist",
    ctaStyle: "purple-outline",
    badge: "COMING SOON",
    badgeBg: "linear-gradient(135deg, #A855F7, #7c3aed)",
    features: [
      "Everything in Studio",
      "2+ seats per account",
      "Simultaneous generation (team mode)",
      "Shared asset library",
      "Team workspace & folders",
      "Admin dashboard",
      "Priority onboarding",
      "Dedicated account manager",
    ],
    notIncluded: [],
    comingSoon: true,
  },
];

export default function PricingPage() {
  return (
    <div style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)", minHeight: "100vh" }}>

      {/* ── HERO WITH VIDEO SLIDER BACKGROUND ──────────────────────────────── */}
      {/*
        3-layer system:
        Layer 1 — 4 big cinematic cards scrolling slowly behind
        Layer 2 — deep dark overlay so text stays readable
        Layer 3 — title + eyebrow on top
        Replace gradient cards with real <video autoPlay muted loop playsInline> when ready.
      */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden pt-36 pb-20 text-center"
        style={{ minHeight: "420px" }}
      >
        {/* ── Layer 1: Scrolling cinematic cards ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="flex items-center h-full"
            style={{
              gap: "28px",
              animation: "pricing-scroll 28s linear infinite",
              width: "max-content",
            }}
          >
            {/* Double the 4 cards so the loop is seamless */}
            {[...sliderCards, ...sliderCards, ...sliderCards].map((card, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 rounded-3xl overflow-hidden"
                style={{
                  // Big enough so only 3 + partial 4th fit across most screens
                  width: "420px",
                  height: "280px",
                  background: card.gradient,
                  border: `1px solid ${card.accent}25`,
                  boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${card.accent}15`,
                }}
              >
                {/* Inner shimmer */}
                <div
                  className="absolute inset-0"
                  style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)" }}
                />
                {/* Subtle colour accent dot bottom-right */}
                <div
                  className="absolute bottom-5 right-5 h-3 w-3 rounded-full"
                  style={{ backgroundColor: card.accent, boxShadow: `0 0 16px ${card.accent}, 0 0 40px ${card.accent}60` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Layer 2: Deep dark backdrop — 75% opacity so cards are subtle ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(8,14,28,0.78) 0%, rgba(8,14,28,0.65) 50%, rgba(8,14,28,0.88) 100%)",
          }}
          aria-hidden="true"
        />

        {/* ── Layer 3: Title ── */}
        <div className="relative z-10 mx-auto max-w-2xl px-6">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.35)", color: "#60A5FA" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#2563EB", boxShadow: "0 0 6px #2563EB", animation: "pulse 2s infinite" }} />
            Simple Pricing
          </div>
          <h1 className="mb-4 text-white" style={{ fontSize: "clamp(2.8rem, 6vw, 4.5rem)", lineHeight: 1.08, fontWeight: 800 }}>
            Choose Your{" "}
            <span style={{ background: "linear-gradient(135deg, #2563EB, #0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Plan
            </span>
          </h1>
          <p className="text-lg" style={{ color: "#94A3B8" }}>
            Start free. Scale when you&apos;re ready. No hidden fees, no contracts.
          </p>
        </div>
      </section>

      {/* ── PRICING CARDS ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-36 pt-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {plans.map(plan => {
            const Icon = plan.icon;
            const isPopular = plan.badge === "POPULAR";
            const isBestValue = plan.badge === "BEST VALUE";
            const isComingSoon = plan.comingSoon;

            return (
              /* Outer wrapper — NOT overflow-hidden so badge stays visible */
              <div key={plan.id} className="relative pt-4 h-full">

                {/* Badge — sits above the card */}
                {plan.badge && (
                  <div className="absolute -top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                    <span
                      className="inline-block rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap"
                      style={{
                        background: plan.badgeBg,
                        boxShadow: `0 0 16px ${plan.color}60`,
                      }}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Card */}
                <div
                  className="relative flex flex-col rounded-2xl p-7 transition-all duration-300 h-full"
                  style={{
                    background: plan.gradient,
                    border: `1px solid ${plan.border}`,
                    boxShadow: isPopular || isBestValue ? `0 0 40px ${plan.glow}` : "none",
                    opacity: isComingSoon ? 0.85 : 1,
                  }}
                >
                  {/* Coming soon overlay */}
                  {isComingSoon && (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: "rgba(0,0,0,0.15)", backdropFilter: "blur(0px)" }} />
                  )}

                  {/* Icon + Name */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${plan.color}20`, border: `1px solid ${plan.color}30` }}>
                      <Icon size={20} style={{ color: plan.color }} />
                    </div>
                    <span className="text-lg font-bold text-white">{plan.name}</span>
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <div className="flex items-end gap-1">
                      {plan.price !== "—" && <span className="text-sm font-semibold" style={{ color: "#64748B" }}>$</span>}
                      <span className="text-5xl font-bold text-white">{plan.price}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#475569" }}>{plan.period}</p>
                  </div>

                  <p className="mb-6 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>{plan.description}</p>

                  {/* CTA */}
                  <a
                    href={isComingSoon ? "#waitlist" : "/signup"}
                    className="mb-7 flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-300"
                    style={
                      plan.ctaStyle === "gradient"
                        ? { background: "linear-gradient(135deg, #2563EB, #0EA5A0)", color: "#fff", boxShadow: "0 0 25px rgba(37,99,235,0.4)" }
                        : plan.ctaStyle === "teal"
                        ? { background: "linear-gradient(135deg, #0EA5A0, #2563EB)", color: "#fff", boxShadow: "0 0 25px rgba(14,165,160,0.4)" }
                        : plan.ctaStyle === "purple-outline"
                        ? { background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)", color: "#C084FC" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#F8FAFC" }
                    }
                  >
                    {plan.cta} <ArrowRight size={14} />
                  </a>

                  {/* Divider */}
                  <div className="mb-5 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

                  {/* Features */}
                  <div className="flex flex-col gap-2.5">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-start gap-2.5">
                        <CheckCircle size={14} style={{ color: plan.color, flexShrink: 0, marginTop: 1 }} />
                        <span className="text-sm" style={{ color: "#CBD5E1" }}>{f}</span>
                      </div>
                    ))}
                    {plan.notIncluded.map(f => (
                      <div key={f} className="flex items-start gap-2.5 opacity-35">
                        <div className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full border" style={{ borderColor: "#475569" }} />
                        <span className="text-sm line-through" style={{ color: "#475569" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="mt-12 text-center text-sm" style={{ color: "#475569" }}>
          All plans include a monthly generation allowance. Need more?{" "}
          <a href="/dashboard/credits" style={{ color: "#60A5FA", textDecoration: "none" }}>
            Top up with credit packs
          </a>{" "}
          — from $4.99 for 100 credits. Prices in USD. Cancel subscriptions anytime.
        </p>
      </section>

    </div>
  );
}
