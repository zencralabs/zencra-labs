"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Film, ImageIcon, Mic, Layers, Clapperboard, Users, Check, ArrowRight,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
} from "lucide-react";
import Image from "next/image";
import { AuthModal }   from "@/components/auth/AuthModal";
import { useAuth }     from "@/components/auth/AuthContext";
import type { PublicAsset } from "@/lib/types/generation";

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
    imageSrc: "/how-it-works/step-1.jpg",  // image — drop step-1.jpg into public/how-it-works/
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

// ── Showcase carousel — tool colour + display name helpers ───────────────────
const TOOL_COLOR: Record<string, string> = {
  "kling-30":       "#2563EB",
  "kling-26":       "#0EA5A0",
  "kling-25":       "#0EA5A0",
  "runway-gen4":    "#EF4444",
  "runway-gen3":    "#EF4444",
  "seedance":       "#F59E0B",
  "veo2":           "#A855F7",
  "veo3":           "#A855F7",
  "ltx-video":      "#6366F1",
  "heygen":         "#EC4899",
};
const DEFAULT_TOOL_COLOR = "#0EA5A0";

const TOOL_NAME: Record<string, string> = {
  "kling-30":    "Kling 3.0",
  "kling-26":    "Kling 2.6",
  "kling-25":    "Kling 2.5 Turbo",
  "runway-gen4": "Runway Gen-4",
  "runway-gen3": "Runway Gen-3",
  "seedance":    "Seedance",
  "veo2":        "Google Veo 2",
  "veo3":        "Google Veo 3",
  "ltx-video":   "LTX Video",
  "heygen":      "HeyGen",
};
function toolDisplayName(id: string | undefined): string {
  if (!id) return "";
  return TOOL_NAME[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Showcase — curated static videos ─────────────────────────────────────────
// Videos are served from Supabase Storage CDN (not Vercel static assets).
// To update: run scripts/upload-showcase.ts, then update URLs here.
const SUPABASE_SHOWCASE = "https://qlhfmhawhdpagkxaldae.supabase.co/storage/v1/object/public/showcase";
const SHOWCASE_STATIC: PublicAsset[] = [
  { id: "sc1", tool: "kling-30",    tool_category: "video", prompt: "Cinematic chase through neon city streets at night",         result_url: `${SUPABASE_SHOWCASE}/showcase-kling-30.mp4`,  result_urls: null, credits_used: 10, visibility: "public", project_id: null, created_at: "" },
  { id: "sc2", tool: "kling-26",    tool_category: "video", prompt: "Character walks through misty forest, depth of field",       result_url: `${SUPABASE_SHOWCASE}/showcase-kling-26.mp4`,  result_urls: null, credits_used: 8,  visibility: "public", project_id: null, created_at: "" },
  { id: "sc3", tool: "runway-gen4", tool_category: "video", prompt: "Aerial drone shot over mountains at golden hour",             result_url: `${SUPABASE_SHOWCASE}/showcase-runway.mp4`,    result_urls: null, credits_used: 12, visibility: "public", project_id: null, created_at: "" },
  { id: "sc4", tool: "veo2",        tool_category: "video", prompt: "Ocean waves crash in slow motion, cinematic grade",          result_url: `${SUPABASE_SHOWCASE}/showcase-veo.mp4`,       result_urls: null, credits_used: 15, visibility: "public", project_id: null, created_at: "" },
  { id: "sc5", tool: "seedance",    tool_category: "video", prompt: "Epic warrior portrait, dramatic rim lighting",               result_url: `${SUPABASE_SHOWCASE}/showcase-seedance.mp4`,  result_urls: null, credits_used: 10, visibility: "public", project_id: null, created_at: "" },
  { id: "sc6", tool: "heygen",      tool_category: "video", prompt: "AI presenter delivers pitch with perfect lip sync",          result_url: `${SUPABASE_SHOWCASE}/showcase-heygen.mp4`,    result_urls: null, credits_used: 20, visibility: "public", project_id: null, created_at: "" },
  { id: "sc7", tool: "ltx-video",   tool_category: "video", prompt: "Luxury product reveal, studio lighting, slow rotate",       result_url: `${SUPABASE_SHOWCASE}/showcase-ltx.mp4`,       result_urls: null, credits_used: 8,  visibility: "public", project_id: null, created_at: "" },
  { id: "sc8", tool: "kling-30",    tool_category: "video", prompt: "Sci-fi battle sequence, laser effects, epic scale",         result_url: `${SUPABASE_SHOWCASE}/showcase-kling-30b.mp4`, result_urls: null, credits_used: 10, visibility: "public", project_id: null, created_at: "" },
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

// ── Auto-scroll slider (hero area) — your 8 uploaded showcase videos ─────────
const sliderRow1 = [
  { gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)", label: "Cinematic Video", tool: "Kling 3.0",    color: "#2563EB", videoSrc: `${SUPABASE_SHOWCASE}/showcase-kling-30.mp4` },
  { gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 60%, #14b8a6 100%)", label: "Cinematic Video", tool: "Runway ML",    color: "#0EA5A0", videoSrc: `${SUPABASE_SHOWCASE}/showcase-runway.mp4` },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #60a5fa 100%)", label: "AI Scene",        tool: "Google Veo",  color: "#60A5FA", videoSrc: `${SUPABASE_SHOWCASE}/showcase-veo.mp4` },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 60%, #ef4444 100%)", label: "Cinematic Video", tool: "Seedance 2.0", color: "#EF4444", videoSrc: `${SUPABASE_SHOWCASE}/showcase-seedance.mp4` },
];
const sliderRow1Doubled = [...sliderRow1, ...sliderRow1, ...sliderRow1];

const sliderRow2 = [
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 60%, #10b981 100%)", label: "Cinematic Video", tool: "Kling 2.6",   color: "#10B981", videoSrc: `${SUPABASE_SHOWCASE}/showcase-kling-26.mp4` },
  { gradient: "linear-gradient(160deg, #1a0f1a 0%, #4c0d8a 60%, #c084fc 100%)", label: "Talking Avatar",  tool: "HeyGen",      color: "#C084FC", videoSrc: `${SUPABASE_SHOWCASE}/showcase-heygen.mp4` },
  { gradient: "linear-gradient(160deg, #0f0a1a 0%, #1e1035 60%, #818cf8 100%)", label: "Cinematic Video", tool: "LTX Video",   color: "#818CF8", videoSrc: `${SUPABASE_SHOWCASE}/showcase-ltx.mp4` },
  { gradient: "linear-gradient(160deg, #0a1020 0%, #162040 60%, #2563eb 100%)", label: "Cinematic Video", tool: "Kling 3.0",   color: "#2563EB", videoSrc: `${SUPABASE_SHOWCASE}/showcase-kling-30b.mp4` },
];
const sliderRow2Doubled = [...sliderRow2, ...sliderRow2, ...sliderRow2];

// ── VideoMuted — drop-in video replacement with premium mute toggle ──────────
// Renders <video autoPlay muted loop> + an absolute-positioned mute button.
// Parent container MUST have position:relative (or be absolute-stretched).
// preload="metadata" loads only first frame + duration — not the full file.
function VideoMuted({
  src,
  style,
  className,
  preload = "metadata",
  poster,
  btnPos = { bottom: "10px", right: "10px" },
}: {
  src: string;
  style?: React.CSSProperties;
  className?: string;
  preload?: "none" | "metadata" | "auto";
  poster?: string;
  btnPos?: { top?: string; bottom?: string; left?: string; right?: string };
}) {
  const [muted, setMuted] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !muted;
    if (ref.current) ref.current.muted = next;
    setMuted(next);
  }

  return (
    <>
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        preload={preload}
        poster={poster}
        style={style}
        className={className}
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Premium mute toggle — frosted glass circle, cinema-grade */}
      <button
        onClick={toggle}
        aria-label={muted ? "Unmute video" : "Mute video"}
        style={{
          position: "absolute",
          top:    btnPos.top,
          bottom: btnPos.bottom,
          left:   btnPos.left,
          right:  btnPos.right,
          zIndex: 25,
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          background: muted
            ? "rgba(0,0,0,0.55)"
            : "rgba(14,165,160,0.30)",
          border: `1px solid ${muted ? "rgba(255,255,255,0.18)" : "rgba(14,165,160,0.65)"}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: muted
            ? "0 2px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "0 0 18px rgba(14,165,160,0.50), inset 0 1px 0 rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: muted ? "rgba(255,255,255,0.75)" : "#5EEAD4",
          transition: "all 0.2s ease",
          flexShrink: 0,
          pointerEvents: "auto",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1.12)";
          el.style.background = muted ? "rgba(255,255,255,0.14)" : "rgba(14,165,160,0.45)";
          el.style.borderColor = muted ? "rgba(255,255,255,0.35)" : "rgba(14,165,160,0.9)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1)";
          el.style.background = muted ? "rgba(0,0,0,0.55)" : "rgba(14,165,160,0.30)";
          el.style.borderColor = muted ? "rgba(255,255,255,0.18)" : "rgba(14,165,160,0.65)";
        }}
      >
        {muted
          ? <VolumeX size={12} />
          : <Volume2 size={12} />
        }
      </button>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  // Open auth modal if middleware redirected here with ?auth=login|signup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    if (authParam === "login" || authParam === "signup") {
      setAuthModal(authParam);
    }
  }, []);

  // After successful login, redirect to the ?next URL
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      router.push(decodeURIComponent(next));
    }
  }, [user, router]);

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

  // Showcase — member public gallery (falls back to SHOWCASE_STATIC when empty)
  const [showcaseAssets,  setShowcaseAssets]  = useState<PublicAsset[]>([]);
  const [showcaseLoaded,  setShowcaseLoaded]  = useState(false);
  useEffect(() => {
    fetch("/api/generations/showcase")
      .then(r => r.json())
      .then(json => { if (json.success) setShowcaseAssets(json.data ?? []); })
      .catch(() => {})
      .finally(() => setShowcaseLoaded(true));
  }, []);
  const showcaseSlides = showcaseLoaded
    ? (showcaseAssets.length > 0 ? showcaseAssets : SHOWCASE_STATIC)
    : SHOWCASE_STATIC;

  const maxIdx = Math.max(0, showcaseSlides.length - carouselVisible);

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
        {/* Video background — full on desktop, slightly reduced on mobile for text readability */}
        <VideoMuted
          src="/hero-video.mp4"
          preload="metadata"
          poster="/hero-poster.jpg"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75 md:opacity-100"
          btnPos={{ bottom: "52px", right: "20px" }}
        />

        {/* Animated orbs — desktop only (blur+animation is GPU-heavy on mobile) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block" aria-hidden="true">
          <div className="animate-orb-1 absolute" style={{ width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)", top: "-10%", left: "20%", filter: "blur(40px)" }} />
          <div className="animate-orb-2 absolute" style={{ width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,160,0.25) 0%, transparent 70%)", bottom: "0%", right: "15%", filter: "blur(50px)" }} />
          <div className="animate-orb-3 absolute" style={{ width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)", top: "40%", left: "-5%", filter: "blur(60px)" }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(248,250,252,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(248,250,252,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        {/* Hero content */}
        <div className="container-site relative z-10 flex flex-col items-center gap-6 pt-20 pb-12 md:gap-8 md:pt-32 md:pb-16 text-center">
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
            className="leading-[1.2] tracking-tight w-full"
            style={{ fontSize: "clamp(1.5rem, 8vw, 3rem)", fontWeight: 800 }}
          >
            <span style={{ display: "block", textShadow: "0 2px 24px rgba(0,0,0,0.95), 0 1px 8px rgba(0,0,0,0.9)" }}>Create Cinematic AI Videos</span>
            <span
              style={{
                display: "block",
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
            style={{ color: "#94A3B8", textShadow: "0 1px 12px rgba(0,0,0,0.95)" }}
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

      {/* ── AUTO-SCROLL SHOWCASE STRIP — desktop only (too heavy for mobile) ── */}
      <section className="hidden md:block strip-section" style={{ overflow: "hidden", position: "relative", backgroundColor: "var(--page-bg)", paddingBottom: "0" }}>
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10" style={{ width: "120px", background: "linear-gradient(to right, var(--page-bg), transparent)" }} aria-hidden="true" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10" style={{ width: "120px", background: "linear-gradient(to left, var(--page-bg), transparent)" }} aria-hidden="true" />

        {/* Row 1 — slides left */}
        <div style={{ overflow: "hidden", marginBottom: "12px" }}>
          <div className="flex strip-slide-left" style={{ gap: "16px", animation: "slide-left 38s linear infinite", width: "max-content", paddingLeft: "16px" }}>
            {sliderRow1Doubled.map((card, i) => (
              <div key={i} className="relative flex-shrink-0 rounded-2xl" style={{ width: "380px", height: "230px", background: card.gradient, border: `1px solid ${card.color}30`, boxShadow: `0 6px 30px rgba(0,0,0,0.45), inset 0 1px 0 ${card.color}15`, overflow: "hidden" }}>
                {card.videoSrc && (
                  <video autoPlay muted loop playsInline preload="none"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
                    onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}>
                    <source src={card.videoSrc} type="video/mp4" />
                  </video>
                )}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color, boxShadow: `0 0 10px ${card.color}` }} />
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>{card.tool}</span>
                </div>
                <div className="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 — slides right */}
        <div style={{ overflow: "hidden", paddingBottom: "0" }}>
          <div className="flex strip-slide-right" style={{ gap: "16px", animation: "slide-right 42s linear infinite", width: "max-content", paddingLeft: "16px" }}>
            {sliderRow2Doubled.map((card, i) => (
              <div key={i} className="relative flex-shrink-0 rounded-2xl" style={{ width: "380px", height: "210px", background: card.gradient, border: `1px solid ${card.color}30`, boxShadow: `0 6px 30px rgba(0,0,0,0.45), inset 0 1px 0 ${card.color}15`, overflow: "hidden" }}>
                {card.videoSrc && (
                  <video autoPlay muted loop playsInline preload="none"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
                    onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}>
                    <source src={card.videoSrc} type="video/mp4" />
                  </video>
                )}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color, boxShadow: `0 0 10px ${card.color}` }} />
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>{card.tool}</span>
                </div>
                <div className="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}>
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. HOW ZENCRA WORKS — full-width 3-step ─────────────────────────── */}
      <section className="py-14 md:py-24">
        <div className="container-site">
          <div className="text-center mb-10 md:mb-16">
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
                    className="w-full relative aspect-video"
                    style={{ background: step.sample, overflow: "hidden" }}
                  >
                    {/* Image or video depending on step */}
                    {"imageSrc" in step && step.imageSrc ? (
                      <Image
                        src={step.imageSrc}
                        alt={step.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        style={{ objectFit: "cover", opacity: 1 }}
                        priority
                      />
                    ) : (
                      <VideoMuted
                        src={`/how-it-works/step-${parseInt(step.num)}.mp4`}
                        preload="none"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
                        btnPos={{ bottom: "8px", right: "8px" }}
                      />
                    )}
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
      <section className="py-14 md:py-20">
        {/* Section header inside container */}
        <div className="container-site">
          <div className="text-center mb-8 md:mb-12">
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
          {/* Fade edges — hidden on mobile, visible on desktop */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 hidden md:block" style={{ width: "80px", background: "linear-gradient(to right, var(--page-bg), transparent)" }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 hidden md:block" style={{ width: "80px", background: "linear-gradient(to left, var(--page-bg), transparent)" }} />

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
            {showcaseSlides.map((asset, i) => {
              const color      = (asset.tool && TOOL_COLOR[asset.tool]) ?? DEFAULT_TOOL_COLOR;
              const toolLabel  = toolDisplayName(asset.tool);
              const caption    = asset.prompt
                ? asset.prompt.length > 60 ? asset.prompt.slice(0, 57) + "…" : asset.prompt
                : "";
              const categoryLabel = asset.tool === "heygen" ? "Talking Avatar"
                : asset.tool_category === "video" ? "Cinematic Video" : "AI Scene";

              return (
              <div
                key={asset.id ?? i}
                className="relative flex-shrink-0 overflow-hidden rounded-2xl cursor-pointer group"
                style={{
                  width: cardWidthCss,
                  aspectRatio: "16/9",
                  background: "linear-gradient(160deg,#0F1A32 0%,#0d1a2a 100%)",
                  border: `1px solid ${color}30`,
                  boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${color}15`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-6px) scale(1.01)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.6), 0 0 50px ${color}30`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${color}15`;
                }}
              >
                {/* Video + mute toggle */}
                {asset.result_url && (
                  <VideoMuted
                    src={asset.result_url}
                    preload="none"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ opacity: 1 }}
                    btnPos={{ bottom: "52px", right: "10px" }}
                  />
                )}

                {/* Label badge top-right */}
                <div className="absolute top-4 right-4">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase"
                    style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
                  >
                    {categoryLabel}
                  </span>
                </div>

                {/* Play icon on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.25)" }}
                  >
                    <div style={{ width: 0, height: 0, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", borderLeft: "15px solid rgba(255,255,255,0.9)", marginLeft: "3px" }} />
                  </div>
                </div>

                {/* Bottom gradient + tool name + caption */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-5"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                      <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{toolLabel}</p>
                    </div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)", maxWidth: "55%", textAlign: "right" }}>{caption}</p>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* ── 4. FUTURE CINEMA STUDIO ─────────────────────────────────────────── */}
      {/* Mobile: full-bleed 9:16 card with content-first layout             */}
      {/* Desktop: contained 16:9 card                                       */}
      <section className="py-10 md:py-16">
        {/* Full-bleed on mobile, contained on desktop */}
        <div className="px-0 md:px-12 lg:px-20 xl:px-28">
          <div
            className="cinema-card relative w-full overflow-hidden md:rounded-3xl"
            style={{
              background: "linear-gradient(135deg, #050a14 0%, #0a0f1e 30%, #120a26 60%, #1a0d3a 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
              boxShadow: "0 0 100px rgba(168,85,247,0.10), 0 30px 80px rgba(0,0,0,0.5)",
            }}
          >

            {/* Background video */}
            <VideoMuted
              src="/cinema/bg.mp4"
              preload="none"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
              btnPos={{ top: "16px", right: "16px" }}
            />

            {/* Glows */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div style={{ position: "absolute", width: "60%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)", top: "-20%", right: "-10%", filter: "blur(80px)" }} />
              <div style={{ position: "absolute", width: "40%", height: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)", bottom: "-15%", left: "5%", filter: "blur(60px)" }} />
            </div>

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} aria-hidden="true" />

            {/* Bottom text gradient for readability */}
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,10,20,0.92) 0%, rgba(5,10,20,0.45) 45%, transparent 100%)" }} />

            {/* Content — bottom-anchored on mobile so text is always visible */}
            <div className="relative z-10 flex h-full flex-col justify-end gap-4 px-6 pb-10 text-center items-center md:justify-center md:gap-6 md:px-8 md:pb-0">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#C084FC", backdropFilter: "blur(8px)" }}
              >
                <Clapperboard size={13} />
                Future Cinema Studio · Coming Soon
              </div>

              {/* Headline */}
              <h2
                className="leading-tight tracking-tight"
                style={{ fontSize: "clamp(1.75rem, 6vw, 4rem)", fontWeight: 800, color: "#F8FAFC", textShadow: "0 2px 20px rgba(0,0,0,0.9)" }}
              >
                Direct AI Films.{" "}
                <span style={{
                  background: "linear-gradient(135deg, #A855F7 0%, #60A5FA 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>
                  Scene by Scene.
                </span>
              </h2>

              {/* Subline */}
              <p className="max-w-sm md:max-w-xl text-sm md:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.75)", textShadow: "0 1px 12px rgba(0,0,0,0.9)" }}>
                Move beyond clips. Direct full AI films with scene control, character continuity, and cinematic storytelling tools — your complete filmmaking environment.
              </p>

              {/* Feature pills — 2-col grid on mobile */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs md:flex md:flex-wrap md:justify-center md:gap-3 md:max-w-none">
                {["Scene-based editing", "Storyboard workflow", "Character consistency", "Shot sequencing"].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 md:px-4"
                    style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.22)", backdropFilter: "blur(8px)" }}
                  >
                    <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: "#A855F7", boxShadow: "0 0 6px #A855F7" }} />
                    <span className="text-xs font-medium" style={{ color: "#C084FC" }}>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-2 md:flex-row md:gap-4 mt-1">
                <button
                  onClick={() => router.push("/studio/cinema")}
                  className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold w-full justify-center md:w-auto"
                  style={{ background: "linear-gradient(135deg, #A855F7, #6366F1)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 0 30px rgba(168,85,247,0.35)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(168,85,247,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(168,85,247,0.35)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  Join the Waitlist
                  <ArrowRight size={15} />
                </button>
                <span className="text-xs" style={{ color: "#94A3B8" }}>No credit card required</span>
              </div>
            </div>

            {/* Bottom timeline strip — desktop only */}
            <div
              className="absolute bottom-0 left-0 right-0 hidden md:flex items-center gap-1 px-6 py-3"
              style={{ background: "linear-gradient(to top, rgba(5,10,20,0.9), transparent)" }}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{
                  height: "14px",
                  background: i % 4 === 0 ? "rgba(168,85,247,0.5)" : i % 7 === 0 ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(168,85,247,0.08)",
                }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. TARGET AUDIENCE — full-width 16:9 cards ──────────────────────── */}
      <section className="py-12 md:py-20">
        <div className="container-site">
          <div className="text-center mb-10 md:mb-16">
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
                  {/* Background video — full opacity, no overlay */}
                  {card.videoSrc && (
                    <VideoMuted
                      src={card.videoSrc}
                      preload="none"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
                      btnPos={{ bottom: "8px", right: "8px" }}
                    />
                  )}

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

                  {/* Bottom content — subtle gradient + text shadows for readability */}
                  <div
                    className="absolute bottom-0 left-0 right-0 p-6"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }}
                  >
                    <h3 className="mb-2 text-xl font-bold" style={{ color: "#F8FAFC", textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>{card.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.65, fontSize: "0.875rem", textShadow: "0 1px 8px rgba(0,0,0,0.85)" }}>{card.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING PREVIEW ──────────────────────────────────────────────── */}
      <section className="py-12 md:py-24">
        <div className="container-site">
          <div className="text-center mb-10 md:mb-16">
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
                className="relative flex flex-col rounded-2xl p-6 md:p-8"
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
        className="py-14 md:py-20"
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(14,165,160,0.04) 50%, rgba(168,85,247,0.06) 100%)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="container-site flex flex-col items-center gap-6 text-center px-6 md:px-0">
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

    <style>{`
      @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      /* Cinema Studio card: 9:16 on mobile → 16:9 on desktop */
      .cinema-card { aspect-ratio: 9/16; }
      @media (min-width: 768px) { .cinema-card { aspect-ratio: 16/9; } }

      /* ── Scroll performance ─────────────────────────────────────────── */
      /* Carousel card hover lift uses transform — promote to GPU layer    */
      .carousel-card { will-change: transform; }

      /* Mobile: strip is hidden, so no cost. On desktop, isolate the strip
         section to avoid triggering full-page repaints during animation.   */
      @media (min-width: 768px) {
        .strip-section { contain: layout style; }
      }

      /* Mute button hover fix — keep hover state in sync with React state */
      button[aria-label="Unmute video"]:hover { opacity: 1 !important; }
      button[aria-label="Mute video"]:hover   { opacity: 1 !important; }
    `}</style>

    {authModal && (
      <AuthModal
        defaultTab={authModal}
        onClose={() => setAuthModal(null)}
      />
    )}
    </>
  );
}
