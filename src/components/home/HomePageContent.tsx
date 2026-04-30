"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Film, ImageIcon, Mic, Layers, Clapperboard, Users, Check, ArrowRight,
  Volume2, VolumeX,
} from "lucide-react";
import Image from "next/image";
import { AuthModal }   from "@/components/auth/AuthModal";
import { useAuth }     from "@/components/auth/AuthContext";
import type { PublicAsset } from "@/lib/types/generation";
import { HeroSection } from "@/components/home/hero/HeroSection";
import { VerticalStoriesSection } from "@/components/home/sections/VerticalStoriesSection";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA LABS — Homepage V2 | Cinematic AI Creation Studio
// Color system: #3B82F6 → #8B5CF6 only. No teal, amber, or red.
// Media: border-radius: 0 on all <video> and <img> elements.
// ─────────────────────────────────────────────────────────────────────────────

// ── How Zencra Works — 3-step cards ─────────────────────────────────────────
const workflowSteps = [
  {
    icon: ImageIcon,
    num: "01",
    color: "#3B82F6",
    title: "Generate Visuals",
    desc: "Create high-quality AI images for any concept — characters, scenes, products, or worlds — in seconds.",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.04) 100%)",
    border: "rgba(59,130,246,0.20)",
    sample: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)",
    imageSrc: "/how-it-works/step-1.jpg",
  },
  {
    icon: Film,
    num: "02",
    color: "#8B5CF6",
    title: "Animate to Video",
    desc: "Turn images into cinematic motion with consistent characters. Direct movement, camera angles, and pacing.",
    gradient: "linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.04) 100%)",
    border: "rgba(139,92,246,0.20)",
    sample: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 60%, #8b5cf6 100%)",
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
// V2: teal → blue, red → purple
const TOOL_COLOR: Record<string, string> = {
  "kling-30":       "#3B82F6",
  "kling-26":       "#3B82F6",
  "kling-25":       "#3B82F6",
  "runway-gen4":    "#8B5CF6",
  "runway-gen3":    "#8B5CF6",
  "seedance":       "#A855F7",
  "veo2":           "#A855F7",
  "veo3":           "#A855F7",
  "ltx-video":      "#6366F1",
  "heygen":         "#EC4899",
};
const DEFAULT_TOOL_COLOR = "#3B82F6";

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
// Videos served from Supabase Storage CDN.
const SUPABASE_SHOWCASE = "https://qlhfmhawhdpagkxaldae.supabase.co/storage/v1/object/public/showcase";
const SHOWCASE_STATIC: PublicAsset[] = [
  { id: "sc1", tool: "kling-30",    tool_category: "video", prompt: "Cinematic chase through neon city streets at night",   result_url: `${SUPABASE_SHOWCASE}/showcase-kling-30.mp4`,  result_urls: null, credits_used: 10, visibility: "public", project_id: null, created_at: "" },
  { id: "sc2", tool: "kling-26",    tool_category: "video", prompt: "Character walks through misty forest, depth of field", result_url: `${SUPABASE_SHOWCASE}/showcase-kling-26.mp4`,  result_urls: null, credits_used: 8,  visibility: "public", project_id: null, created_at: "" },
  { id: "sc3", tool: "runway-gen4", tool_category: "video", prompt: "Aerial drone shot over mountains at golden hour",       result_url: `${SUPABASE_SHOWCASE}/showcase-runway.mp4`,    result_urls: null, credits_used: 12, visibility: "public", project_id: null, created_at: "" },
  { id: "sc4", tool: "veo2",        tool_category: "video", prompt: "Ocean waves crash in slow motion, cinematic grade",    result_url: `${SUPABASE_SHOWCASE}/showcase-veo.mp4`,       result_urls: null, credits_used: 15, visibility: "public", project_id: null, created_at: "" },
  { id: "sc5", tool: "seedance",    tool_category: "video", prompt: "Epic warrior portrait, dramatic rim lighting",          result_url: `${SUPABASE_SHOWCASE}/showcase-seedance.mp4`,  result_urls: null, credits_used: 10, visibility: "public", project_id: null, created_at: "" },
  { id: "sc6", tool: "heygen",      tool_category: "video", prompt: "AI presenter delivers pitch with perfect lip sync",    result_url: `${SUPABASE_SHOWCASE}/showcase-heygen.mp4`,    result_urls: null, credits_used: 20, visibility: "public", project_id: null, created_at: "" },
  { id: "sc7", tool: "ltx-video",   tool_category: "video", prompt: "Luxury product reveal, studio lighting, slow rotate",  result_url: `${SUPABASE_SHOWCASE}/showcase-ltx.mp4`,       result_urls: null, credits_used: 8,  visibility: "public", project_id: null, created_at: "" },
  { id: "sc8", tool: "kling-30",    tool_category: "video", prompt: "Sci-fi battle sequence, laser effects, epic scale",   result_url: `${SUPABASE_SHOWCASE}/showcase-kling-30b.mp4`, result_urls: null, credits_used: 10, visibility: "public", project_id: null, created_at: "" },
];

// ── Audience cards ────────────────────────────────────────────────────────────
// V2: teal audience card → blue
const audienceCards = [
  {
    icon: Film,
    title: "Filmmakers",
    desc: "Turn story ideas into full visual sequences — without a production crew, camera equipment, or post-production budget.",
    color: "#3B82F6",
    gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 55%, #3B82F6 100%)",
    stat: "10× faster than traditional production",
    videoSrc: "/audience/filmmakers.mp4",
  },
  {
    icon: Users,
    title: "Content Creators",
    desc: "Build a consistent, cinematic presence on Instagram, TikTok, and YouTube using AI that matches your creative vision.",
    color: "#6366F1",
    gradient: "linear-gradient(160deg, #080b1a 0%, #1a1f4d 55%, #6366F1 100%)",
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
    color: "#3B82F6",
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

// ── VideoMuted — drop-in video replacement with premium mute toggle ──────────
// V2: active (unmuted) state uses purple instead of teal.
// Parent container MUST have position:relative.
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
        style={{ borderRadius: 0, ...style }}
        className={className}
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Premium mute toggle — frosted glass circle */}
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
            : "rgba(139,92,246,0.30)",
          border: `1px solid ${muted ? "rgba(255,255,255,0.18)" : "rgba(139,92,246,0.65)"}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: muted
            ? "0 2px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "0 0 18px rgba(139,92,246,0.50), inset 0 1px 0 rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: muted ? "rgba(255,255,255,0.75)" : "#C084FC",
          transition: "all 0.2s ease",
          flexShrink: 0,
          pointerEvents: "auto",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1.12)";
          el.style.background = muted ? "rgba(255,255,255,0.14)" : "rgba(139,92,246,0.45)";
          el.style.borderColor = muted ? "rgba(255,255,255,0.35)" : "rgba(139,92,246,0.9)";
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1)";
          el.style.background = muted ? "rgba(0,0,0,0.55)" : "rgba(139,92,246,0.30)";
          el.style.borderColor = muted ? "rgba(255,255,255,0.18)" : "rgba(139,92,246,0.65)";
        }}
      >
        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>
    </>
  );
}

// ── Main Page Content ─────────────────────────────────────────────────────────
export function HomePageContent() {
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
    if (next) router.push(decodeURIComponent(next));
  }, [user, router]);

  // Defer heavy video sections until after initial paint
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => setMounted(true));
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(t);
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

  function handleStartCreating() {
    router.push("/studio/image");
  }

  return (
    <>
    <div style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)", minHeight: "100vh" }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── 2. VERTICAL STORIES ─────────────────────────────────────────────── */}
      <VerticalStoriesSection />

      {/* ── 3. HOW ZENCRA WORKS — full-width 3-step ─────────────────────────── */}
      <section
        className="py-14 md:py-24"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        <div className="container-site">
          <div className="text-center mb-10 md:mb-16">
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#3B82F6",
                marginBottom: "16px",
              }}
            >
              The Workflow
            </p>
            <h2
              className="font-display tracking-tight"
              style={{
                fontFamily: "var(--font-display, 'Syne', sans-serif)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                color: "var(--page-text)",
                margin: "0 0 16px",
              }}
            >
              How Zencra Works
            </h2>
            <p style={{ color: "#64748B", lineHeight: 1.7, maxWidth: "480px", margin: "0 auto" }}>
              Three steps. One platform.
            </p>
          </div>

          {/* Steps — 16:9 visual preview per card */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative overflow-hidden"
                  style={{
                    background: step.gradient,
                    border: `1px solid ${step.border}`,
                    borderRadius: 0,
                  }}
                >
                  {/* 16:9 sample visual at top */}
                  <div
                    className="w-full relative aspect-video"
                    style={{ background: step.sample, overflow: "hidden" }}
                  >
                    {"imageSrc" in step && step.imageSrc ? (
                      <Image
                        src={step.imageSrc}
                        alt={step.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        style={{ objectFit: "cover", opacity: 1, borderRadius: 0 }}
                        priority
                      />
                    ) : (
                      <VideoMuted
                        src={`/how-it-works/step-${parseInt(step.num)}.mp4`}
                        preload="none"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1, borderRadius: 0 }}
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
                      className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center"
                      style={{
                        background: `${step.color}25`,
                        border: `1px solid ${step.color}40`,
                        backdropFilter: "blur(8px)",
                        borderRadius: 0,
                      }}
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

      {/* ── 4. WHAT YOU CAN CREATE — native horizontal scroll ───────────────── */}
      {/* V2: no JS arrow buttons; native scroll-snap with snap-x mandatory    */}
      <section className="py-14 md:py-20" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="container-site">
          <div className="text-center mb-8 md:mb-12">
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#3B82F6",
                marginBottom: "16px",
              }}
            >
              Video Showcase
            </p>
            <h2
              className="font-display tracking-tight"
              style={{
                fontFamily: "var(--font-display, 'Syne', sans-serif)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                color: "var(--page-text)",
                margin: "0 0 16px",
              }}
            >
              What You Can Create
            </h2>
            <p style={{ color: "#64748B", lineHeight: 1.7, maxWidth: "480px", margin: "0 auto" }}>
              Every clip below is real AI video — generated inside Zencra Labs.
            </p>
          </div>
        </div>

        {/* Native scroll track — full-width, no JS transform */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          {/* Edge fades — desktop only */}
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 hidden md:block"
            style={{ width: "80px", background: "linear-gradient(to right, var(--page-bg), transparent)" }}
          />
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 hidden md:block"
            style={{ width: "80px", background: "linear-gradient(to left, var(--page-bg), transparent)" }}
          />

          {/* Scrollable track */}
          <div
            className="flex gap-5 px-6 overflow-x-auto overflow-y-hidden"
            style={{
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
              paddingBottom: "10px",
              msOverflowStyle: "none",
              scrollbarWidth: "none",
            }}
          >
            {showcaseSlides.map((asset, i) => {
              const color = (asset.tool && TOOL_COLOR[asset.tool]) ?? DEFAULT_TOOL_COLOR;
              const toolLabel = toolDisplayName(asset.tool);
              const caption = asset.prompt
                ? asset.prompt.length > 60 ? asset.prompt.slice(0, 57) + "…" : asset.prompt
                : "";
              const categoryLabel = asset.tool === "heygen" ? "Talking Avatar"
                : asset.tool_category === "video" ? "Cinematic Video" : "AI Scene";

              return (
                <div
                  key={asset.id ?? i}
                  className="relative group"
                  style={{
                    scrollSnapAlign: "start",
                    flex: "0 0 auto",
                    width: "clamp(280px, 36vw, 420px)",
                    aspectRatio: "16/9",
                    background: "linear-gradient(160deg,#0F1A32 0%,#0d1a2a 100%)",
                    border: `1px solid ${color}28`,
                    boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${color}12`,
                    overflow: "hidden",
                    borderRadius: 0,
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-6px) scale(1.01)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.6), 0 0 50px ${color}28`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${color}12`;
                  }}
                >
                  {asset.result_url && (
                    <VideoMuted
                      src={asset.result_url}
                      preload="none"
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ opacity: 1, borderRadius: 0 }}
                      btnPos={{ bottom: "52px", right: "10px" }}
                    />
                  )}

                  {/* Label badge top-right */}
                  <div className="absolute top-4 right-4">
                    <span
                      className="px-3 py-1 text-[11px] font-bold uppercase"
                      style={{
                        background: "rgba(0,0,0,0.5)",
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        backdropFilter: "blur(8px)",
                        borderRadius: 0,
                      }}
                    >
                      {categoryLabel}
                    </span>
                  </div>

                  {/* Play icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div
                      className="flex h-14 w-14 items-center justify-center"
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.25)",
                        borderRadius: "50%",
                      }}
                    >
                      <div style={{ width: 0, height: 0, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", borderLeft: "15px solid rgba(255,255,255,0.9)", marginLeft: "3px" }} />
                    </div>
                  </div>

                  {/* Bottom gradient + tool + caption */}
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
            {/* End spacer */}
            <div aria-hidden="true" style={{ flex: "0 0 8px" }} />
          </div>
        </div>
      </section>

      {/* ── 5. FUTURE CINEMA STUDIO ─────────────────────────────────────────── */}
      <section className="py-10 md:py-16" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="px-0 md:px-12 lg:px-20 xl:px-28">
          <div
            className="cinema-card relative w-full overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #050a14 0%, #0a0f1e 30%, #120a26 60%, #1a0d3a 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
              boxShadow: "0 0 100px rgba(168,85,247,0.10), 0 30px 80px rgba(0,0,0,0.5)",
              borderRadius: 0,
            }}
          >
            {/* Background video */}
            <VideoMuted
              src="/cinema/bg.mp4"
              preload="none"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.7, borderRadius: 0 }}
              btnPos={{ top: "16px", right: "16px" }}
            />

            {/* Glows */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div style={{ position: "absolute", width: "60%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)", top: "-20%", right: "-10%", filter: "blur(80px)" }} />
              <div style={{ position: "absolute", width: "40%", height: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", bottom: "-15%", left: "5%", filter: "blur(60px)" }} />
            </div>

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} aria-hidden="true" />

            {/* Bottom text gradient */}
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,10,20,0.92) 0%, rgba(5,10,20,0.45) 45%, transparent 100%)" }} />

            {/* Content */}
            <div className="relative z-10 flex h-full flex-col justify-end gap-4 px-6 pb-10 text-center items-center md:justify-center md:gap-6 md:px-8 md:pb-0">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em]"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#C084FC", backdropFilter: "blur(8px)", borderRadius: 0 }}
              >
                <Clapperboard size={13} />
                Future Cinema Studio · Coming Soon
              </div>

              {/* Headline */}
              <h2
                className="font-display leading-tight tracking-tight"
                style={{
                  fontFamily: "var(--font-display, 'Syne', sans-serif)",
                  fontSize: "clamp(1.75rem, 6vw, 4rem)",
                  fontWeight: 800,
                  lineHeight: 0.95,
                  letterSpacing: "-0.04em",
                  color: "#F8FAFC",
                  textShadow: "0 2px 20px rgba(0,0,0,0.9)",
                  margin: 0,
                }}
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

              {/* Feature chips */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs md:flex md:flex-wrap md:justify-center md:gap-3 md:max-w-none">
                {["Scene-based editing", "Storyboard workflow", "Character consistency", "Shot sequencing"].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-1.5 px-3 py-2 md:px-4"
                    style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.22)", backdropFilter: "blur(8px)", borderRadius: 0 }}
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
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold w-full justify-center md:w-auto"
                  style={{
                    background: "linear-gradient(135deg, #A855F7, #6366F1)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 30px rgba(168,85,247,0.35)",
                    borderRadius: 0,
                  }}
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
                <div key={i} className="flex-1" style={{
                  height: "14px",
                  background: i % 4 === 0 ? "rgba(168,85,247,0.5)" : i % 7 === 0 ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(168,85,247,0.08)",
                  borderRadius: 0,
                }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. TARGET AUDIENCE ──────────────────────────────────────────────── */}
      <section className="py-12 md:py-20" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="container-site">
          <div className="text-center mb-10 md:mb-16">
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#3B82F6",
                marginBottom: "16px",
              }}
            >
              Who It&apos;s For
            </p>
            <h2
              className="font-display tracking-tight"
              style={{
                fontFamily: "var(--font-display, 'Syne', sans-serif)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                color: "var(--page-text)",
                margin: "0 0 16px",
              }}
            >
              Built for Creators, Filmmakers,{" "}
              <br className="hidden md:block" />
              and Agencies
            </h2>
            <p className="max-w-2xl mx-auto text-lg" style={{ color: "#64748B", lineHeight: 1.7 }}>
              Cinematic quality. No complex tools.
            </p>
          </div>

          {/* Audience cards — 4:3, sharp media */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {audienceCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="relative overflow-hidden group cursor-pointer"
                  style={{
                    aspectRatio: "4/3",
                    background: card.gradient,
                    border: `1px solid ${card.color}25`,
                    boxShadow: `0 8px 40px rgba(0,0,0,0.4)`,
                    borderRadius: 0,
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
                  {card.videoSrc && mounted && (
                    <VideoMuted
                      src={card.videoSrc}
                      preload="none"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1, borderRadius: 0 }}
                      btnPos={{ bottom: "8px", right: "8px" }}
                    />
                  )}

                  {/* Icon top-left */}
                  <div className="absolute top-6 left-6">
                    <div
                      className="flex h-12 w-12 items-center justify-center"
                      style={{ background: `${card.color}20`, border: `1px solid ${card.color}35`, backdropFilter: "blur(8px)", borderRadius: 0 }}
                    >
                      <Icon size={24} style={{ color: card.color }} />
                    </div>
                  </div>

                  {/* Stat badge top-right */}
                  <div className="absolute top-6 right-6">
                    <span
                      className="px-3 py-1 text-[11px] font-semibold"
                      style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 0 }}
                    >
                      {card.stat}
                    </span>
                  </div>

                  {/* Bottom content */}
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

      {/* ── 7. PRICING PREVIEW ──────────────────────────────────────────────── */}
      {/* V2: blue→purple gradient on highlight, no yellow                     */}
      <section className="py-12 md:py-24" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="container-site">
          <div className="text-center mb-10 md:mb-16">
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#3B82F6",
                marginBottom: "16px",
              }}
            >
              Simple Pricing
            </p>
            <h2
              className="font-display tracking-tight"
              style={{
                fontFamily: "var(--font-display, 'Syne', sans-serif)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                color: "var(--page-text)",
                margin: "0 0 16px",
              }}
            >
              Start Free. Scale as You Create.
            </h2>
            <p style={{ color: "#64748B" }}>No hidden fees. No complexity.</p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className="relative flex flex-col p-6 md:p-8"
                style={{
                  background: tier.highlight
                    ? `linear-gradient(135deg, ${tier.color}12 0%, rgba(139,92,246,0.06) 100%)`
                    : "var(--page-bg-2)",
                  border: tier.highlight ? `1px solid ${tier.color}40` : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: tier.highlight ? `0 0 60px ${tier.color}15` : "none",
                  borderRadius: 0,
                }}
              >
                {tier.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                      className="px-4 py-1 text-xs font-bold uppercase tracking-wide"
                      style={{ background: `linear-gradient(135deg, ${tier.color}, #8B5CF6)`, color: "#fff", borderRadius: 0 }}
                    >
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
                    className="w-full py-3 text-sm font-semibold transition-all duration-200"
                    style={{
                      background: tier.highlight
                        ? `linear-gradient(135deg, ${tier.color}, #8B5CF6)`
                        : "var(--page-bg-3)",
                      border: tier.highlight ? "none" : "1px solid var(--border-medium)",
                      color: tier.highlight ? "#fff" : "var(--page-text-2)",
                      cursor: "pointer",
                      borderRadius: 0,
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

      {/* ── 8. FOOTER CTA BAND ──────────────────────────────────────────────── */}
      {/* V2: blue→purple gradient only, no teal                               */}
      <section
        className="py-14 md:py-20"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.05) 50%, rgba(168,85,247,0.06) 100%)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="container-site flex flex-col items-center gap-6 text-center px-6 md:px-0">
          <h2
            className="font-display tracking-tight"
            style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              color: "var(--page-text)",
              margin: 0,
            }}
          >
            Ready to Create Something Cinematic?
          </h2>
          <p style={{ color: "#64748B", lineHeight: 1.7, maxWidth: "420px" }}>
            Start free — no credit card required.
          </p>
          <button
            onClick={handleStartCreating}
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-semibold text-white transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
              boxShadow: "0 0 40px rgba(59,130,246,0.35)",
              border: "none",
              cursor: "pointer",
              borderRadius: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 60px rgba(59,130,246,0.6), 0 0 100px rgba(139,92,246,0.3)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(59,130,246,0.35)";
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

      /* Scroll performance */
      .group { will-change: transform; }

      /* Hide scrollbars on showcase track */
      .overflow-x-auto::-webkit-scrollbar { display: none; }

      /* Mute button hover sync */
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
