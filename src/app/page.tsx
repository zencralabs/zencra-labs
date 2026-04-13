"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Film, ImageIcon, Mic, Layers, Clapperboard, Users, Check, ArrowRight,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA LABS — Cinematic AI Creation Studio
// ─────────────────────────────────────────────────────────────────────────────

// ── Hero tool chip badge data ─────────────────────────────────────────────────
const heroTools = ["Kling 3.0", "Runway ML", "Veo", "FLUX Pro", "Suno AI", "ElevenLabs", "HeyGen"];

// ── How Zencra Works — 3-step cards ─────────────────────────────────────────
const workflowSteps = [
  {
    icon: ImageIcon,
    num: "01",
    color: "#2563EB",
    title: "Generate Visuals",
    desc: "Create high-quality AI images for any concept — characters, scenes, products, or worlds — in seconds.",
    gradient: "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.04) 100%)",
    border: "rgba(37,99,235,0.20)",
    sample: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)",
  },
  {
    icon: Film,
    num: "02",
    color: "#0EA5A0",
    title: "Animate to Video",
    desc: "Turn images into cinematic motion with consistent characters. Direct movement, camera angles, and pacing.",
    gradient: "linear-gradient(135deg, rgba(14,165,160,0.10) 0%, rgba(14,165,160,0.04) 100%)",
    border: "rgba(14,165,160,0.20)",
    sample: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 60%, #0ea5a0 100%)",
  },
  {
    icon: Mic,
    num: "03",
    color: "#A855F7",
    title: "Add Voice & Lip Sync",
    desc: "Bring content to life with realistic AI voices. Perfect lip-sync. Natural emotion. Any language.",
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0.04) 100%)",
    border: "rgba(168,85,247,0.20)",
    sample: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 60%, #a855f7 100%)",
  },
];

// ── Video Showcase Carousel — 6 VIDEO-only slides ────────────────────────────
// videoSrc: drop the matching file into /public/ to activate real video playback.
// While the file is absent the gradient placeholder renders automatically.
const videoShowcase = [
  {
    gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 50%, #1d4ed8 100%)",
    color: "#2563EB",
    label: "Cinematic Video",
    caption: "AI-directed urban scene with natural motion blur",
    tool: "Kling 2.6",
    videoSrc: "/Showcase/showcase-kling-26.mp4",
  },
  {
    gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 50%, #0ea5a0 100%)",
    color: "#0EA5A0",
    label: "Cinematic Video",
    caption: "Forest timelapse with AI-driven light simulation",
    tool: "Kling 3.0",
    videoSrc: "/Showcase/showcase-kling-30.mp4",
  },
  {
    gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 50%, #dc2626 100%)",
    color: "#EF4444",
    label: "AI Scene",
    caption: "Emotional narrative with dynamic camera movement",
    tool: "Seedance 2.0",
    videoSrc: "/Showcase/showcase-seedance.mp4",
  },
  {
    gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 50%, #2563eb 100%)",
    color: "#60A5FA",
    label: "Cinematic Video",
    caption: "Stylised slow-motion with cinematic grade",
    tool: "Runway ML",
    videoSrc: "/Showcase/showcase-runway.mp4",
  },
  {
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 50%, #7c3aed 100%)",
    color: "#A855F7",
    label: "Talking Avatar",
    caption: "Lip-synced presenter from any voice recording",
    tool: "HeyGen",
    videoSrc: "/Showcase/showcase-heygen.mp4",
  },
  {
    gradient: "linear-gradient(160deg, #1a1206 0%, #422006 50%, #f59e0b 100%)",
    color: "#F59E0B",
    label: "Cinematic Video",
    caption: "Desert dune flyover with AI motion design",
    tool: "Google Veo",
    videoSrc: "/Showcase/showcase-veo.mp4",
  },
];

// ── Audience cards ────────────────────────────────────────────────────────────
const audienceCards = [
  {
    icon: Film,
    title: "Filmmakers",
    desc: "Turn story ideas into full visual sequences — without a production crew, camera equipment, or post-production budget.",
    color: "#2563EB",
    gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 55%, #2563EB 100%)",
    stat: "10× faster than traditional production",
    videoSrc: "/audience/filmmakers.mp4",
  },
  {
    icon: Users,
    title: "Content Creators",
    desc: "Build a consistent, cinematic presence on Instagram, TikTok, and YouTube using AI that matches your creative vision.",
    color: "#0EA5A0",
    gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 55%, #0EA5A0 100%)",
    stat: "For Instagram, TikTok & YouTube",
    videoSrc: "/audience/creators.mp4",
  },
  {
    icon: Layers,
    title: "Agencies",
    desc: "Deliver premium AI-generated media at scale. Faster briefs, faster delivery, higher creative output for every client.",
    color: "#A855F7",
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 55%, #A855F7 100%)",
    stat: "Agency-grade volume & API access",
    videoSrc: "/audience/agencies.mp4",
  },
];

// ── Pricing tiers ─────────────────────────────────────────────────────────────
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
    cta: "Try Free",
    highlight: true,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/ month",
    description: "Full cinematic workflows for professionals and agencies.",
    color: "#A855F7",
    features: ["High-volume credit pool", "Cinema Studio access", "Scene-based editing", "Character consistency", "API access", "Dedicated support"],
    cta: "Go Studio",
    highlight: false,
  },
];

// ── Auto-scroll slider (hero area) ───────────────────────────────────────────
const sliderRow1 = [
  { gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)", label: "Cinematic Video", tool: "Kling 3.0",       color: "#2563EB" },
  { gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 60%, #14b8a6 100%)", label: "Cinematic Video", tool: "Runway ML",        color: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 60%, #ef4444 100%)", label: "AI Scene",        tool: "Seedance 2.0",     color: "#EF4444" },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #60a5fa 100%)", label: "Cinematic Video", tool: "Google Veo",       color: "#60A5FA" },
  { gradient: "linear-gradient(160deg, #1a0f1a 0%, #4c0d8a 60%, #c084fc 100%)", label: "Talking Avatar",  tool: "HeyGen",           color: "#C084FC" },
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 60%, #10b981 100%)", label: "Cinematic Video", tool: "Kling 2.6",        color: "#10B981" },
  { gradient: "linear-gradient(160deg, #1a1206 0%, #422006 60%, #f59e0b 100%)", label: "Cinematic Video", tool: "Seedance 2.0",     color: "#F59E0B" },
  { gradient: "linear-gradient(160deg, #0d0d1a 0%, #2d1b69 60%, #8b5cf6 100%)", label: "Cinematic Video", tool: "Runway ML",        color: "#A855F7" },
];
const sliderRow1Doubled = [...sliderRow1, ...sliderRow1];

const sliderRow2 = [
  { gradient: "linear-gradient(160deg, #0a1020 0%, #162040 60%, #2563eb 100%)", label: "Cinematic Video", tool: "Kling 3.0",        color: "#2563EB" },
  { gradient: "linear-gradient(160deg, #0f1a32 0%, #1e3a5f 60%, #0ea5a0 100%)", label: "Talking Avatar",  tool: "HeyGen",           color: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #2d1020 60%, #e11d48 100%)", label: "Cinematic Video", tool: "Seedance 2.0",     color: "#E11D48" },
  { gradient: "linear-gradient(160deg, #0f0a1a 0%, #1e1035 60%, #818cf8 100%)", label: "Cinematic Video", tool: "Runway ML",        color: "#818CF8" },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #38bdf8 100%)", label: "Cinematic Video", tool: "Google Veo",       color: "#38BDF8" },
  { gradient: "linear-gradient(160deg, #1a0f00 0%, #3d2500 60%, #f59e0b 100%)", label: "Cinematic Video", tool: "Kling 2.6",        color: "#F59E0B" },
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #052e16 60%, #22c55e 100%)", label: "Cinematic Video", tool: "Google Veo",       color: "#22C55E" },
  { gradient: "linear-gradient(160deg, #0d0d1a 0%, #1a0d2e 60%, #7c3aed 100%)", label: "AI Scene",        tool: "Runway ML",        color: "#7c3aed" },
];
const sliderRow2Doubled = [...sliderRow2, ...sliderRow2];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  // Carousel state — visible count is responsive (1 mobile / 2 tablet / 3 desktop)
  const [carouselIdx,     setCarouselIdx]     = useState(0);
  const [carouselVisible, setCarouselVisible] = useState(3);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateVisible() {
      const w = window.innerWidth;
      const next = w < 640 ? 1 : w < 1024 ? 2 : 3;
      setCarouselVisible(v => {
        if (v !== next) setCarouselIdx(0); // reset position on breakpoint change
        return next;
      });
    }
    updateVisible();
    window.addEventListener("resize", updateVisible);
    return () => window.removeEventListener("resize", updateVisible);
  }, []);

  const maxIdx = Math.max(0, videoShowcase.length - carouselVisible);

  // Card width formula keyed to visible count — matches the CSS `width` on each card
  const cardWidthCss =
    carouselVisible === 1
      ? "calc(100vw - 48px)"
      : carouselVisible === 2
      ? "min(calc((100vw - 48px) / 2 - 10px), 520px)"
      : "min(calc((100vw - clamp(48px, 10vw, 160px)) / 3), 560px)";

  function carouselPrev() {
    setCarouselIdx((i) => Math.max(0, i - 1));
  }
  function carouselNext() {
    setCarouselIdx((i) => Math.min(maxIdx, i + 1));
  }

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
          preload="auto"
          poster="/hero-poster.jpg"
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
            className="leading-[1.2] tracking-tight"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800 }}
          >
            <span style={{ display: "block", whiteSpace: "nowrap" }}>Create Cinematic AI Videos</span>
            <span
              style={{
                display: "block",
                whiteSpace: "nowrap",
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

          {/* Tool badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {heroTools.map((tool) => (
              <span
                key={tool}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: "var(--page-bg-2)", border: "1px solid var(--border-subtle)", color: "var(--page-text-2)" }}
              >
                {tool}
              </span>
            ))}
            <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ color: "#2563EB" }}>+ more</span>
          </div>
        </div>

        {/* Fades */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-24" style={{ background: "linear-gradient(to bottom, var(--page-bg), transparent)" }} aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32" style={{ background: "linear-gradient(to bottom, transparent, var(--page-bg))" }} aria-hidden="true" />
      </section>

      {/* ── AUTO-SCROLL SHOWCASE STRIP ──────────────────────────────────────── */}
      <section style={{ overflow: "hidden", position: "relative", backgroundColor: "var(--page-bg)", paddingBottom: "0" }}>
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

      {/* ── 2. HOW ZENCRA WORKS — full-width 3-step ─────────────────────────── */}
      <section style={{ padding: "100px 0 80px" }}>
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#2563EB" }}>The Workflow</p>
            <h2 className="tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "var(--page-text)" }}>
              How Zencra Works
            </h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Three steps. One platform. Infinite creative possibilities.
            </p>
          </div>

          {/* Steps — 16:9 visual preview per card */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative rounded-2xl overflow-hidden"
                  style={{ background: step.gradient, border: `1px solid ${step.border}` }}
                >
                  {/* 16:9 sample visual at top */}
                  <div
                    className="w-full relative"
                    style={{ paddingBottom: "56.25%", background: step.sample, overflow: "hidden" }}
                  >
                    {/* Video if available */}
                    <video
                      autoPlay muted loop playsInline preload="metadata"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
                      onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
                    >
                      <source src={`/how-it-works/step-${parseInt(step.num)}.mp4`} type="video/mp4" />
                    </video>
                    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />
                    {/* Step number watermark */}
                    <div
                      className="absolute bottom-3 right-4 text-6xl font-black"
                      style={{ color: `${step.color}20`, lineHeight: 1 }}
                    >
                      {step.num}
                    </div>
                    {/* Icon badge */}
                    <div
                      className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${step.color}25`, border: `1px solid ${step.color}40`, backdropFilter: "blur(8px)" }}
                    >
                      <Icon size={20} style={{ color: step.color }} />
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="p-7">
                    <h3 className="mb-3 text-xl font-bold" style={{ color: "var(--page-text)" }}>{step.title}</h3>
                    <p style={{ color: "#64748B", lineHeight: 1.7, fontSize: "0.95rem" }}>{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. WHAT YOU CAN CREATE — single-row video carousel ──────────────── */}
      <section style={{ padding: "80px 0" }}>
        {/* Section header inside container */}
        <div className="container-site">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#0EA5A0" }}>Video Showcase</p>
            <h2 className="tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "var(--page-text)" }}>
              What You Can Create
            </h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Every output below represents real AI video you can generate inside Zencra Labs.
            </p>
          </div>
        </div>

        {/* Carousel — full-width with controlled scroll */}
        <div className="relative" style={{ overflow: "hidden" }}>
          {/* Fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10" style={{ width: "80px", background: "linear-gradient(to right, var(--page-bg), transparent)" }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10" style={{ width: "80px", background: "linear-gradient(to left, var(--page-bg), transparent)" }} />

          {/* Track */}
          <div
            ref={carouselRef}
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              gap: "20px",
              paddingLeft:  carouselVisible === 1 ? "24px" : "clamp(24px, 5vw, 80px)",
              paddingRight: carouselVisible === 1 ? "24px" : "clamp(24px, 5vw, 80px)",
              transform: `translateX(calc(-${carouselIdx} * (${cardWidthCss} + 20px)))`,
            }}
          >
            {videoShowcase.map((slide, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 overflow-hidden rounded-2xl cursor-pointer group"
                style={{
                  width: cardWidthCss,
                  aspectRatio: "16/9",
                  background: slide.gradient,
                  border: `1px solid ${slide.color}30`,
                  boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${slide.color}15`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-6px) scale(1.01)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.6), 0 0 50px ${slide.color}30`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${slide.color}15`;
                }}
              >
                {/* Background video — autoplays always */}
                {slide.videoSrc && (
                  <video
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ opacity: 0.92 }}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  >
                    <source src={slide.videoSrc} type="video/mp4" />
                  </video>
                )}
                {/* Inner shimmer */}
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.1) 0%, transparent 55%)" }} />
                {/* Cinematic grain */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

                {/* Label badge top-left */}
                <div className="absolute top-4 left-4">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase"
                    style={{ background: `${slide.color}20`, color: slide.color, border: `1px solid ${slide.color}40`, backdropFilter: "blur(8px)" }}
                  >
                    {slide.label}
                  </span>
                </div>

                {/* Play icon (appears on hover) */}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.25)" }}
                  >
                    <div style={{ width: 0, height: 0, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", borderLeft: "15px solid rgba(255,255,255,0.9)", marginLeft: "3px" }} />
                  </div>
                </div>

                {/* Bottom gradient + info */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-5"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: slide.color, boxShadow: `0 0 8px ${slide.color}` }} />
                      <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{slide.tool}</p>
                    </div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)", maxWidth: "55%", textAlign: "right" }}>{slide.caption}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Prev / Next controls */}
          <button
            onClick={carouselPrev}
            disabled={carouselIdx === 0}
            className="absolute left-4 top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200"
            style={{
              transform: "translateY(-50%)",
              background: carouselIdx === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(12px)",
              color: carouselIdx === 0 ? "rgba(255,255,255,0.2)" : "#fff",
              cursor: carouselIdx === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={carouselNext}
            disabled={carouselIdx >= maxIdx}
            className="absolute right-4 top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200"
            style={{
              transform: "translateY(-50%)",
              background: carouselIdx >= maxIdx ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(12px)",
              color: carouselIdx >= maxIdx ? "rgba(255,255,255,0.2)" : "#fff",
              cursor: carouselIdx >= maxIdx ? "not-allowed" : "pointer",
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dot indicators — count matches maxIdx so dots == number of scrollable positions */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {Array.from({ length: maxIdx + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCarouselIdx(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === carouselIdx ? "24px" : "8px",
                height: "8px",
                background: i === carouselIdx ? "#0EA5A0" : "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </section>

      {/* ── 4. FUTURE CINEMA STUDIO — full-width 16:9 coming-soon card ──────── */}
      <section style={{ padding: "60px 0 80px" }}>
        <div className="container-site">
          {/* Full 16:9 card */}
          <div
            className="relative w-full overflow-hidden rounded-3xl"
            style={{
              aspectRatio: "16/9",
              background: "linear-gradient(135deg, #050a14 0%, #0a0f1e 30%, #120a26 60%, #1a0d3a 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
              boxShadow: "0 0 100px rgba(168,85,247,0.10), 0 30px 80px rgba(0,0,0,0.5)",
            }}
          >
            {/* Background video (place /public/cinema/bg.mp4 to activate) */}
            <video
              autoPlay muted loop playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.45 }}
              onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
            >
              <source src="/cinema/bg.mp4" type="video/mp4" />
            </video>

            {/* Background glows */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div style={{ position: "absolute", width: "60%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)", top: "-20%", right: "-10%", filter: "blur(80px)" }} />
              <div style={{ position: "absolute", width: "40%", height: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)", bottom: "-15%", left: "5%", filter: "blur(60px)" }} />
              <div style={{ position: "absolute", width: "30%", height: "40%", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,160,0.08) 0%, transparent 70%)", top: "30%", left: "20%", filter: "blur(50px)" }} />
            </div>

            {/* Subtle film-grain overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} aria-hidden="true" />

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} aria-hidden="true" />

            {/* Content */}
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.35)", color: "#C084FC", backdropFilter: "blur(8px)" }}
              >
                <Clapperboard size={13} />
                Future Cinema Studio · Coming Soon
              </div>

              {/* Headline */}
              <h2
                className="max-w-3xl leading-tight tracking-tight"
                style={{ fontSize: "clamp(2rem, 5vw, 4rem)", fontWeight: 800, color: "#F8FAFC" }}
              >
                Direct AI Films.{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #A855F7 0%, #60A5FA 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Scene by Scene.
                </span>
              </h2>

              {/* Subline */}
              <p className="max-w-xl text-base leading-relaxed" style={{ color: "#94A3B8" }}>
                Move beyond clips. Direct full AI films with scene control, character continuity, and cinematic storytelling tools — your complete filmmaking environment.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-3">
                {["Scene-based editing", "Storyboard workflow", "Character consistency", "Shot sequencing"].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-2 rounded-xl px-4 py-2"
                    style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.18)", backdropFilter: "blur(8px)" }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#A855F7", boxShadow: "0 0 6px #A855F7" }} />
                    <span className="text-sm font-medium" style={{ color: "#C084FC" }}>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={() => router.push("/studio/cinema")}
                  className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-300"
                  style={{ background: "linear-gradient(135deg, #A855F7, #6366F1)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 0 30px rgba(168,85,247,0.35)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(168,85,247,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(168,85,247,0.35)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  Join the Waitlist
                  <ArrowRight size={15} />
                </button>
                <span className="text-xs" style={{ color: "#64748B" }}>No credit card required</span>
              </div>
            </div>

            {/* Bottom timeline strip */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center gap-1 px-6 py-3"
              style={{ background: "linear-gradient(to top, rgba(5,10,20,0.9), transparent)" }}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: "14px",
                    background: i % 4 === 0 ? "rgba(168,85,247,0.5)" : i % 7 === 0 ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(168,85,247,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. TARGET AUDIENCE — full-width 16:9 cards ──────────────────────── */}
      <section style={{ padding: "60px 0 80px" }}>
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#0EA5A0" }}>Who It&apos;s For</p>
            <h2 className="tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "var(--page-text)" }}>
              Built for Creators, Filmmakers,<br className="hidden md:block" /> and Agencies
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Zencra Labs is designed for modern content creators who want cinematic quality without complex tools.
            </p>
          </div>

          {/* Audience cards — 16:9 visual style */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {audienceCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="relative overflow-hidden rounded-2xl group cursor-pointer"
                  style={{
                    aspectRatio: "4/3",
                    background: card.gradient,
                    border: `1px solid ${card.color}25`,
                    boxShadow: `0 8px 40px rgba(0,0,0,0.4)`,
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-6px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 24px 70px rgba(0,0,0,0.55), 0 0 50px ${card.color}25`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.4)`;
                  }}
                >
                  {/* Background video */}
                  {card.videoSrc && (
                    <video
                      autoPlay muted loop playsInline preload="metadata"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
                      onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
                    >
                      <source src={card.videoSrc} type="video/mp4" />
                    </video>
                  )}
                  {/* Shimmer */}
                  <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 60%)" }} />

                  {/* Icon top-left */}
                  <div className="absolute top-6 left-6">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ background: `${card.color}20`, border: `1px solid ${card.color}35`, backdropFilter: "blur(8px)" }}
                    >
                      <Icon size={24} style={{ color: card.color }} />
                    </div>
                  </div>

                  {/* Stat badge top-right */}
                  <div className="absolute top-6 right-6">
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-semibold"
                      style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      {card.stat}
                    </span>
                  </div>

                  {/* Bottom content */}
                  <div
                    className="absolute bottom-0 left-0 right-0 p-6"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
                  >
                    <h3 className="mb-2 text-xl font-bold" style={{ color: "#F8FAFC" }}>{card.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.65, fontSize: "0.875rem" }}>{card.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING PREVIEW ──────────────────────────────────────────────── */}
      <section style={{ padding: "60px 0 100px" }}>
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: "#2563EB" }}>Simple Pricing</p>
            <h2 className="tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, color: "var(--page-text)" }}>
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
                    : "var(--page-bg-2)",
                  border: tier.highlight ? `1px solid ${tier.color}40` : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: tier.highlight ? `0 0 60px ${tier.color}15` : "none",
                }}
              >
                {tier.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: `linear-gradient(135deg, ${tier.color}, #0EA5A0)`, color: "#fff" }}>
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em]" style={{ color: tier.color }}>{tier.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black" style={{ color: "var(--page-text)" }}>{tier.price}</span>
                    <span className="mb-1.5 text-sm" style={{ color: "#64748B" }}>{tier.period}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#64748B" }}>{tier.description}</p>
                </div>

                <ul className="mb-8 flex flex-col gap-2.5">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm" style={{ color: "#94A3B8" }}>
                      <Check size={14} style={{ color: tier.color, flexShrink: 0 }} />
                      {feat}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <button
                    onClick={handleStartCreating}
                    className="w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200"
                    style={{
                      background: tier.highlight ? `linear-gradient(135deg, ${tier.color}, #0EA5A0)` : "var(--page-bg-3)",
                      border: tier.highlight ? "none" : "1px solid var(--border-medium)",
                      color: tier.highlight ? "#fff" : "var(--page-text-2)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => {
                      if (!tier.highlight) {
                        (e.currentTarget as HTMLElement).style.background = "var(--page-bg-2)";
                        (e.currentTarget as HTMLElement).style.color = "var(--page-text)";
                      } else {
                        (e.currentTarget as HTMLElement).style.opacity = "0.9";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!tier.highlight) {
                        (e.currentTarget as HTMLElement).style.background = "var(--page-bg-3)";
                        (e.currentTarget as HTMLElement).style.color = "var(--page-text-2)";
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
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="container-site flex flex-col items-center gap-6 text-center">
          <h2 className="tracking-tight" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, color: "var(--page-text)" }}>
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
            Try Free
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

    </div>

    {authModal && (
      <AuthModal
        defaultTab={authModal}
        onClose={() => setAuthModal(null)}
      />
    )}
    </>
  );
}
