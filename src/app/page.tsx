"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, ImageIcon, Mic, Layers, Clapperboard, Users, Zap, Check, ChevronRight, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA LABS — Cinematic AI Creation Studio
// Structure: Hero → How It Works → Output Showcase → Cinema Studio →
//            Target Audience → Pricing Preview → Footer CTA
// ─────────────────────────────────────────────────────────────────────────────

// ── Output Showcase Cards ────────────────────────────────────────────────────
const showcaseItems = [
  {
    id: 1,
    gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 50%, #1d4ed8 100%)",
    accentColor: "#2563EB",
    label: "Cinematic Video",
    caption: "AI video scene with natural motion",
    tool: "Kling 3.0",
  },
  {
    id: 2,
    gradient: "linear-gradient(160deg, #0d0d1a 0%, #1a0d2e 50%, #7c3aed 100%)",
    accentColor: "#A855F7",
    label: "AI Image",
    caption: "High-resolution character portrait",
    tool: "Nano Banana Pro",
  },
  {
    id: 3,
    gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 50%, #0ea5a0 100%)",
    accentColor: "#0EA5A0",
    label: "Talking Avatar",
    caption: "Lip-synced avatar from any voice",
    tool: "HeyGen",
  },
  {
    id: 4,
    gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 50%, #dc2626 100%)",
    accentColor: "#EF4444",
    label: "AI Scene",
    caption: "Cinematic landscape with depth",
    tool: "Runway ML",
  },
  {
    id: 5,
    gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 50%, #2563eb 100%)",
    accentColor: "#60A5FA",
    label: "Cinematic Video",
    caption: "Stylised urban slow-motion shot",
    tool: "Google Veo",
  },
  {
    id: 6,
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 50%, #7c3aed 100%)",
    accentColor: "#A855F7",
    label: "AI Music",
    caption: "Full cinematic track from a prompt",
    tool: "Suno AI",
  },
];

// Slider data — row 1
const sliderRow1 = [
  { gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)", label: "Cinematic Video", tool: "Kling 3.0", color: "#2563EB" },
  { gradient: "linear-gradient(160deg, #0d0d1a 0%, #2d1b69 60%, #8b5cf6 100%)", label: "AI Image",        tool: "Nano Banana Pro", color: "#A855F7" },
  { gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 60%, #14b8a6 100%)", label: "Cinematic Video", tool: "Runway ML",  color: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 60%, #ef4444 100%)", label: "AI Scene",        tool: "Flux",        color: "#EF4444" },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #60a5fa 100%)", label: "Cinematic Video", tool: "Google Veo",  color: "#60A5FA" },
  { gradient: "linear-gradient(160deg, #1a0f1a 0%, #4c0d8a 60%, #c084fc 100%)", label: "Talking Avatar",  tool: "HeyGen",      color: "#C084FC" },
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 60%, #10b981 100%)", label: "AI Image",        tool: "Seedream",    color: "#10B981" },
  { gradient: "linear-gradient(160deg, #1a1206 0%, #422006 60%, #f59e0b 100%)", label: "Cinematic Video", tool: "Seedance",    color: "#F59E0B" },
];
const sliderRow1Doubled = [...sliderRow1, ...sliderRow1];

const sliderRow2 = [
  { gradient: "linear-gradient(160deg, #0d0d1a 0%, #1a0d2e 60%, #7c3aed 100%)", label: "AI Scene",        tool: "Flux",           color: "#7c3aed" },
  { gradient: "linear-gradient(160deg, #0a1020 0%, #162040 60%, #2563eb 100%)", label: "Cinematic Video", tool: "LTX-2",          color: "#2563EB" },
  { gradient: "linear-gradient(160deg, #0f1a32 0%, #1e3a5f 60%, #0ea5a0 100%)", label: "Talking Avatar",  tool: "Kling 3.0",      color: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #2d1020 60%, #e11d48 100%)", label: "Cinematic Video", tool: "Runway ML",      color: "#E11D48" },
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #052e16 60%, #22c55e 100%)", label: "AI Image",        tool: "Nano Banana Pro",color: "#22C55E" },
  { gradient: "linear-gradient(160deg, #0f0a1a 0%, #1e1035 60%, #818cf8 100%)", label: "Cinematic Video", tool: "Seedance",       color: "#818CF8" },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #38bdf8 100%)", label: "Cinematic Video", tool: "Google Veo",     color: "#38BDF8" },
  { gradient: "linear-gradient(160deg, #1a0f00 0%, #3d2500 60%, #f59e0b 100%)", label: "AI Image",        tool: "Flux",           color: "#F59E0B" },
];
const sliderRow2Doubled = [...sliderRow2, ...sliderRow2];

// ── Pricing Tiers ────────────────────────────────────────────────────────────
const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Start creating with AI — no credit card needed.",
    color: "#64748B",
    features: ["Basic image generation", "10 credits / month", "Standard quality", "Community gallery access"],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/ month",
    description: "Faster generation, higher quality, priority processing.",
    color: "#2563EB",
    features: ["500 credits / month", "4K image quality", "HD video generation", "Lip-sync & voice tools", "Priority queue"],
    cta: "Start Creating",
    highlight: true,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/ month",
    description: "Full cinematic workflows for professionals and agencies.",
    color: "#A855F7",
    features: ["Unlimited credits", "Cinema Studio access", "Scene-based editing", "Character consistency", "API access", "Dedicated support"],
    cta: "Go Studio",
    highlight: false,
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  function handleStartCreating() {
    router.push("/studio/image");
  }

  return (
    <>
    <div style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)", minHeight: "100vh" }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "calc(100vh - 64px)" }}
      >
        {/* Video background */}
        <video
          autoPlay muted loop playsInline
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.55 }}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>

        {/* Cinematic overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(8,14,28,0.55) 0%, rgba(8,14,28,0.25) 40%, rgba(8,14,28,0.85) 100%)" }}
          aria-hidden="true"
        />

        {/* Animated orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="animate-orb-1 absolute" style={{ width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)", top: "-10%", left: "20%", filter: "blur(40px)" }} />
          <div className="animate-orb-2 absolute" style={{ width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,160,0.25) 0%, transparent 70%)", bottom: "0%", right: "15%", filter: "blur(50px)" }} />
          <div className="animate-orb-3 absolute" style={{ width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)", top: "40%", left: "-5%", filter: "blur(60px)" }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(248,250,252,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(248,250,252,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        {/* Hero content */}
        <div className="container-site relative z-10 flex flex-col items-center gap-8 pt-32 pb-16 text-center">

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", color: "#60A5FA", boxShadow: "0 0 20px rgba(37,99,235,0.15)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#2563EB", boxShadow: "0 0 6px #2563EB", animation: "pulse 2s infinite" }} />
            AI-Powered Creative Studio
          </div>

          {/* Headline */}
          <h1
            className="max-w-5xl font-bold leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(2.6rem, 7vw, 5.5rem)" }}
          >
            Create Cinematic AI Videos —{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 50%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              From Idea to Film in Minutes
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: "#94A3B8" }}
          >
            Generate images, animate them into videos, and add voice with perfect lip-sync — all in one unified AI workflow.
          </p>

          {/* Tool badges — no CTAs here */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {["Kling", "Runway ML", "Veo", "Flux", "Suno AI", "ElevenLabs", "HeyGen"].map((tool) => (
              <span
                key={tool}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748B" }}
              >
                {tool}
              </span>
            ))}
            <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ color: "#2563EB" }}>+ more</span>
          </div>
        </div>

        {/* Top fade */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-24" style={{ background: "linear-gradient(to bottom, #080E1C, transparent)" }} aria-hidden="true" />
        {/* Bottom fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32" style={{ background: "linear-gradient(to bottom, transparent, #080E1C)" }} aria-hidden="true" />
      </section>

      {/* ── SHOWCASE SLIDER (below hero) ─────────────────────────────────────── */}
      <section style={{ overflow: "hidden", position: "relative", backgroundColor: "var(--page-bg)", paddingBottom: "0" }}>
        {/* Left / right fades */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10" style={{ width: "120px", background: "linear-gradient(to right, var(--page-bg), transparent)" }} aria-hidden="true" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10" style={{ width: "120px", background: "linear-gradient(to left, var(--page-bg), transparent)" }} aria-hidden="true" />

        {/* Row 1 — slides left */}
        <div style={{ overflow: "hidden", marginBottom: "12px" }}>
          <div className="flex" style={{ gap: "16px", animation: "slide-left 38s linear infinite", width: "max-content", paddingLeft: "16px" }}>
            {sliderRow1Doubled.map((card, i) => (
              <div key={i} className="relative flex-shrink-0 rounded-2xl" style={{ width: "380px", height: "230px", background: card.gradient, border: `1px solid ${card.color}30`, boxShadow: `0 6px 30px rgba(0,0,0,0.45), inset 0 1px 0 ${card.color}15`, overflow: "hidden" }}>
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.07) 0%, transparent 55%)" }} />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color, boxShadow: `0 0 10px ${card.color}` }} />
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>{card.tool}</span>
                </div>
                <div className="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${card.color}20`, color: card.color, border: `1px solid ${card.color}40` }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 — slides right */}
        <div style={{ overflow: "hidden", paddingBottom: "0" }}>
          <div className="flex" style={{ gap: "16px", animation: "slide-right 42s linear infinite", width: "max-content", paddingLeft: "16px" }}>
            {sliderRow2Doubled.map((card, i) => (
              <div key={i} className="relative flex-shrink-0 rounded-2xl" style={{ width: "380px", height: "210px", background: card.gradient, border: `1px solid ${card.color}30`, boxShadow: `0 6px 30px rgba(0,0,0,0.45), inset 0 1px 0 ${card.color}15`, overflow: "hidden" }}>
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.07) 0%, transparent 55%)" }} />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color, boxShadow: `0 0 10px ${card.color}` }} />
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>{card.tool}</span>
                </div>
                <div className="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${card.color}20`, color: card.color, border: `1px solid ${card.color}40` }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. HOW ZENCRA WORKS ─────────────────────────────────────────────── */}
      <section style={{ padding: "100px 0 80px" }}>
        <div className="container-site">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#2563EB" }}>The Workflow</p>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#F8FAFC" }}>
              How Zencra Works
            </h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Three steps. One platform. Infinite creative possibilities.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Step 1 */}
            <div
              className="relative rounded-2xl p-8"
              style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.03) 100%)", border: "1px solid rgba(37,99,235,0.18)" }}
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
                <ImageIcon size={24} style={{ color: "#2563EB" }} />
              </div>
              <div className="absolute top-8 right-8 text-5xl font-black" style={{ color: "rgba(37,99,235,0.08)", lineHeight: 1 }}>01</div>
              <h3 className="mb-3 text-xl font-bold" style={{ color: "#F8FAFC" }}>Generate Visuals</h3>
              <p style={{ color: "#64748B", lineHeight: 1.7 }}>
                Create high-quality AI images for any concept — characters, scenes, products, or worlds — in seconds.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="relative rounded-2xl p-8"
              style={{ background: "linear-gradient(135deg, rgba(14,165,160,0.08) 0%, rgba(14,165,160,0.03) 100%)", border: "1px solid rgba(14,165,160,0.18)" }}
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(14,165,160,0.15)", border: "1px solid rgba(14,165,160,0.3)" }}>
                <Film size={24} style={{ color: "#0EA5A0" }} />
              </div>
              <div className="absolute top-8 right-8 text-5xl font-black" style={{ color: "rgba(14,165,160,0.08)", lineHeight: 1 }}>02</div>
              <h3 className="mb-3 text-xl font-bold" style={{ color: "#F8FAFC" }}>Animate to Video</h3>
              <p style={{ color: "#64748B", lineHeight: 1.7 }}>
                Turn images into cinematic motion with consistent characters. Direct movement, camera angles, and pacing.
              </p>
            </div>

            {/* Step 3 */}
            <div
              className="relative rounded-2xl p-8"
              style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.03) 100%)", border: "1px solid rgba(168,85,247,0.18)" }}
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}>
                <Mic size={24} style={{ color: "#A855F7" }} />
              </div>
              <div className="absolute top-8 right-8 text-5xl font-black" style={{ color: "rgba(168,85,247,0.08)", lineHeight: 1 }}>03</div>
              <h3 className="mb-3 text-xl font-bold" style={{ color: "#F8FAFC" }}>Add Voice &amp; Lip Sync</h3>
              <p style={{ color: "#64748B", lineHeight: 1.7 }}>
                Bring your content to life with realistic AI voices. Perfect lip-sync. Natural emotion. Any language.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. WHAT YOU CAN CREATE ──────────────────────────────────────────── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container-site">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#0EA5A0" }}>Output Showcase</p>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#F8FAFC" }}>
              What You Can Create
            </h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Every output below was created using AI tools available inside Zencra Labs.
            </p>
          </div>

          {/* Showcase grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseItems.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl cursor-pointer"
                style={{
                  height: "260px",
                  background: item.gradient,
                  border: `1px solid ${item.accentColor}25`,
                  boxShadow: `0 6px 30px rgba(0,0,0,0.4), inset 0 1px 0 ${item.accentColor}10`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-6px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${item.accentColor}30`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 30px rgba(0,0,0,0.4), inset 0 1px 0 ${item.accentColor}10`;
                }}
              >
                {/* Inner shimmer */}
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />

                {/* Badge top-left */}
                <div className="absolute top-4 left-4">
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" style={{ background: `${item.accentColor}20`, color: item.accentColor, border: `1px solid ${item.accentColor}40` }}>
                    {item.label}
                  </span>
                </div>

                {/* Tool top-right */}
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{item.tool}</span>
                </div>

                {/* Caption bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-5" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.accentColor, boxShadow: `0 0 8px ${item.accentColor}` }} />
                    <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{item.caption}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. CINEMA STUDIO — COMING SOON ──────────────────────────────────── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container-site">
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(135deg, #0a0f1a 0%, #0d1a32 40%, #1a0d2e 100%)",
              border: "1px solid rgba(168,85,247,0.2)",
              boxShadow: "0 0 80px rgba(168,85,247,0.08), 0 20px 60px rgba(0,0,0,0.4)",
              padding: "clamp(40px, 6vw, 80px)",
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)", top: "-20%", right: "-10%", filter: "blur(60px)" }} />
              <div style={{ position: "absolute", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%)", bottom: "-10%", left: "10%", filter: "blur(50px)" }} />
            </div>

            <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              {/* Left — text */}
              <div className="max-w-xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em]" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#C084FC" }}>
                  <Clapperboard size={12} />
                  Coming Soon
                </div>
                <h2 className="mb-4 font-bold tracking-tight" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: "#F8FAFC" }}>
                  Cinema Studio
                </h2>
                <p className="mb-8 text-base leading-relaxed" style={{ color: "#64748B" }}>
                  Move beyond clips. Direct full AI films with scene control, character continuity, and cinematic storytelling tools. Your complete filmmaking environment.
                </p>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-3">
                  {["Scene-based editing", "Storyboard workflow", "Character consistency"].map((feat) => (
                    <div
                      key={feat}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                      style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#A855F7", boxShadow: "0 0 6px #A855F7" }} />
                      <span className="text-sm font-medium" style={{ color: "#C084FC" }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — visual placeholder */}
              <div
                className="relative flex-shrink-0 overflow-hidden rounded-2xl"
                style={{
                  width: "clamp(280px, 35vw, 420px)",
                  height: "260px",
                  background: "linear-gradient(135deg, #0d0d1a 0%, #2d1b69 60%, #7c3aed 100%)",
                  border: "1px solid rgba(168,85,247,0.25)",
                }}
              >
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.07) 0%, transparent 60%)" }} />
                {/* Film reel icon centre */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Clapperboard size={48} style={{ color: "rgba(168,85,247,0.5)" }} />
                  <p className="text-sm font-semibold" style={{ color: "rgba(168,85,247,0.6)" }}>Coming Soon</p>
                </div>
                {/* Fake timeline strip at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-10 flex items-center gap-1 px-4" style={{ background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(168,85,247,0.15)" }}>
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: "18px", background: i % 3 === 0 ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(168,85,247,0.1)" }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. TARGET AUDIENCE ──────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0" }}>
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#0EA5A0" }}>Who It&apos;s For</p>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#F8FAFC" }}>
              Built for Creators, Filmmakers,<br className="hidden md:block" /> and Agencies
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Zencra Labs is designed for modern content creators who want cinematic quality without complex tools.
            </p>
          </div>

          {/* Audience cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                icon: Film,
                title: "Filmmakers",
                desc: "Turn story ideas into full visual sequences — without a production crew, camera equipment, or post-production budget.",
                color: "#2563EB",
              },
              {
                icon: Users,
                title: "Content Creators",
                desc: "Build a consistent, cinematic presence on Instagram, TikTok, and YouTube using AI that matches your creative vision.",
                color: "#0EA5A0",
              },
              {
                icon: Layers,
                title: "Agencies",
                desc: "Deliver premium AI-generated media at scale. Faster briefs, faster delivery, and higher creative output for every client.",
                color: "#A855F7",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl p-8"
                  style={{ background: `linear-gradient(135deg, ${card.color}08 0%, ${card.color}03 100%)`, border: `1px solid ${card.color}18` }}
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${card.color}15`, border: `1px solid ${card.color}30` }}>
                    <Icon size={22} style={{ color: card.color }} />
                  </div>
                  <h3 className="mb-3 text-lg font-bold" style={{ color: "#F8FAFC" }}>{card.title}</h3>
                  <p style={{ color: "#64748B", lineHeight: 1.7, fontSize: "0.9rem" }}>{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING PREVIEW ──────────────────────────────────────────────── */}
      <section style={{ padding: "80px 0 100px" }}>
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#2563EB" }}>Simple Pricing</p>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#F8FAFC" }}>
              Start Free. Scale as You Create.
            </h2>
            <p className="mt-4" style={{ color: "#64748B" }}>
              No hidden fees. No complicated plans. Pick what fits your workflow.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className="relative flex flex-col rounded-2xl p-8"
                style={{
                  background: tier.highlight
                    ? `linear-gradient(135deg, ${tier.color}12 0%, ${tier.color}06 100%)`
                    : "rgba(255,255,255,0.02)",
                  border: tier.highlight ? `1px solid ${tier.color}40` : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: tier.highlight ? `0 0 60px ${tier.color}15` : "none",
                }}
              >
                {/* Most popular badge */}
                {tier.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: `linear-gradient(135deg, ${tier.color}, #0EA5A0)`, color: "#fff" }}>
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier name & price */}
                <div className="mb-6">
                  <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em]" style={{ color: tier.color }}>{tier.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black" style={{ color: "#F8FAFC" }}>{tier.price}</span>
                    <span className="mb-1.5 text-sm" style={{ color: "#64748B" }}>{tier.period}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#64748B" }}>{tier.description}</p>
                </div>

                {/* Features */}
                <ul className="mb-8 flex flex-col gap-2.5">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm" style={{ color: "#94A3B8" }}>
                      <Check size={14} style={{ color: tier.color, flexShrink: 0 }} />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-auto">
                  <button
                    onClick={handleStartCreating}
                    className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200"
                    style={{
                      background: tier.highlight ? `linear-gradient(135deg, ${tier.color}, #0EA5A0)` : "rgba(255,255,255,0.05)",
                      border: tier.highlight ? "none" : "1px solid rgba(255,255,255,0.1)",
                      color: tier.highlight ? "#fff" : "#94A3B8",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => {
                      if (!tier.highlight) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                        (e.currentTarget as HTMLElement).style.color = "#F8FAFC";
                      } else {
                        (e.currentTarget as HTMLElement).style.opacity = "0.9";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!tier.highlight) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                        (e.currentTarget as HTMLElement).style.color = "#94A3B8";
                      } else {
                        (e.currentTarget as HTMLElement).style.opacity = "1";
                      }
                    }}
                  >
                    {tier.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA BAND ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 0",
          background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(14,165,160,0.04) 50%, rgba(168,85,247,0.06) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="container-site flex flex-col items-center gap-6 text-center">
          <h2 className="font-bold tracking-tight" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color: "#F8FAFC" }}>
            Ready to Create Something Cinematic?
          </h2>
          <p className="max-w-md" style={{ color: "#64748B", lineHeight: 1.7 }}>
            Join creators and filmmakers already building with Zencra Labs. Start free — no credit card required.
          </p>
          <button
            onClick={handleStartCreating}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-sm font-semibold text-white transition-all duration-300"
            style={{ background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)", boxShadow: "0 0 40px rgba(37,99,235,0.35)", border: "none", cursor: "pointer" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(37,99,235,0.6), 0 0 100px rgba(14,165,160,0.3)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(37,99,235,0.35)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            Start Creating
            <ArrowRight size={16} />
          </button>
          <p className="text-xs" style={{ color: "#334155" }}>Free plan · No credit card · Cancel anytime</p>
        </div>
      </section>

    </div>

    {/* Auth Modal */}
    {authModal && (
      <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />
    )}
    </>
  );
}
