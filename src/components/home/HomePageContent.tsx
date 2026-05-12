"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Film, ImageIcon, Mic, Layers, Clapperboard, Users, Check, ArrowRight,
  Volume2, VolumeX, ChevronLeft, ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { useAuth }     from "@/components/auth/AuthContext";
import type { PublicAsset } from "@/lib/types/generation";
import { HeroSection } from "@/components/home/hero/HeroSection";
import { VerticalStoriesSection } from "@/components/home/sections/VerticalStoriesSection";
import { HomePricingPreview } from "@/components/home/HomePricingPreview";
import { HomeVideoAudioProvider, useHomeVideoAudio, AUDIO_LIME_COLORS } from "@/hooks/useHomeVideoAudio";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA LABS — Homepage V2 Correction Pass
//
// Layout DNA (matches mockup):
//   Every section below the hero uses a SPLIT layout on desktop:
//     [LEFT text block ~260-300px] | [RIGHT visual content flex-1]
//   Mobile stacks these vertically.
//
// Color system: #3B82F6 → #8B5CF6 only. No teal, amber, or red.
// Media: border-radius: 0 on all <video> and <img> elements.
// Section spacing: py-10 md:py-16 (tightened from py-14 md:py-24).
// ─────────────────────────────────────────────────────────────────────────────

// ── How Zencra Works ─────────────────────────────────────────────────────────
const workflowSteps = [
  {
    icon: ImageIcon,
    num: "01",
    color: "#3B82F6",
    title: "Generate Visuals",
    desc: "Describe your idea and let AI create stunning images or clips.",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.04) 100%)",
    border: "rgba(59,130,246,0.22)",
    sample: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)",
    imageSrc: "/how-it-works/step-1.jpg",
  },
  {
    icon: Film,
    num: "02",
    color: "#8B5CF6",
    title: "Animate to Video",
    desc: "Turn your visuals into cinematic videos with AI motion.",
    gradient: "linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.04) 100%)",
    border: "rgba(139,92,246,0.22)",
    sample: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 60%, #8b5cf6 100%)",
  },
  {
    icon: Mic,
    num: "03",
    color: "#A855F7",
    title: "Add Voice & Lip-Sync",
    desc: "Add realistic voice, auto lip-sync and sound to complete your story.",
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0.04) 100%)",
    border: "rgba(168,85,247,0.22)",
    sample: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 60%, #a855f7 100%)",
  },
];

// ── Showcase tool helpers ─────────────────────────────────────────────────────
const TOOL_COLOR: Record<string, string> = {
  "kling-30":    "#3B82F6",
  "kling-26":    "#3B82F6",
  "kling-25":    "#3B82F6",
  "runway-gen4": "#8B5CF6",
  "runway-gen3": "#8B5CF6",
  "seedance":    "#A855F7",
  "veo2":        "#A855F7",
  "veo3":        "#A855F7",
  "ltx-video":   "#6366F1",
  "heygen":      "#EC4899",
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

// ── Showcase static videos ────────────────────────────────────────────────────
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

// ── What You Can Create card definitions (mockup labels) ─────────────────────
// These map to SHOWCASE_STATIC slots; labels override the dynamic prompt caption
const WYCC_LABELS = [
  "Cinematic Scenes",
  "AI Influencers",
  "Short Films",
  "Music Videos",
  "Product Ads",
  "Cinematic Video",
  "Talking Avatar",
  "Cinematic Video",
];

// ── Audience cards ────────────────────────────────────────────────────────────
const audienceCards = [
  {
    icon: Film,
    title: "Filmmakers",
    desc: "Plan, visualize and produce films faster than ever.",
    color: "#3B82F6",
    gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 55%, #3B82F6 100%)",
    stat: "10× faster production",
    videoSrc: "/audience/filmmakers.mp4",
    isMostPopular: false,
  },
  {
    icon: Users,
    title: "Content Creators",
    desc: "Create engaging content that grows your audience.",
    color: "#8B5CF6",
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 55%, #8B5CF6 100%)",
    stat: "Instagram, TikTok & YouTube",
    videoSrc: "/audience/creators.mp4",
    isMostPopular: true,
  },
  {
    icon: Layers,
    title: "Agencies",
    desc: "Deliver high-quality content at scale for your clients.",
    color: "#A855F7",
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 55%, #A855F7 100%)",
    stat: "Agency-grade API access",
    videoSrc: "/audience/agencies.mp4",
    isMostPopular: false,
  },
];


// ── VideoMuted — video with global audio controller ───────────────────────────
// V3: driven by HomeVideoAudioProvider — only one video unmuted at a time.
// Hover = temporary preview. Button click = persistent until another takes over.
function VideoMuted({
  id,
  src,
  style,
  className,
  preload = "metadata",
  poster,
  btnPos = { bottom: "10px", right: "10px" },
}: {
  id: string;
  src: string;
  style?: React.CSSProperties;
  className?: string;
  preload?: "none" | "metadata" | "auto";
  poster?: string;
  btnPos?: { top?: string; bottom?: string; left?: string; right?: string };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isActive, hoverRequest, hoverRelease, togglePersistent } = useHomeVideoAudio(id);

  // Sync video muted state with global controller
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.muted = false;
      if (video.paused) {
        video.play().catch(() => {
          // Browser blocked unmuted autoplay — fall back gracefully
          if (videoRef.current) videoRef.current.muted = true;
        });
      }
    } else {
      video.muted = true;
    }
  }, [isActive]);

  return (
    <>
      <video
        ref={videoRef}
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
        onMouseEnter={hoverRequest}
        onMouseLeave={hoverRelease}
      >
        <source src={src} type="video/mp4" />
      </video>

      <button
        onClick={(e) => { e.stopPropagation(); togglePersistent(); }}
        aria-label={isActive ? "Mute video" : "Unmute video"}
        style={{
          position: "absolute",
          top:    btnPos.top,
          bottom: btnPos.bottom,
          left:   btnPos.left,
          right:  btnPos.right,
          zIndex: 25,
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: isActive ? AUDIO_LIME_COLORS.bg        : AUDIO_LIME_COLORS.mutedBg,
          border: `1px solid ${isActive ? AUDIO_LIME_COLORS.border  : AUDIO_LIME_COLORS.mutedBorder}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: isActive ? AUDIO_LIME_COLORS.glow       : AUDIO_LIME_COLORS.mutedGlow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: isActive ? AUDIO_LIME_COLORS.icon           : AUDIO_LIME_COLORS.mutedIcon,
          transition: "all 0.20s ease",
          flexShrink: 0,
          pointerEvents: "auto",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1.10)";
          el.style.background  = isActive ? AUDIO_LIME_COLORS.bgHover      : AUDIO_LIME_COLORS.mutedBgHover;
          el.style.boxShadow   = isActive ? AUDIO_LIME_COLORS.glowHover     : AUDIO_LIME_COLORS.mutedGlow;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1)";
          el.style.background  = isActive ? AUDIO_LIME_COLORS.bg            : AUDIO_LIME_COLORS.mutedBg;
          el.style.boxShadow   = isActive ? AUDIO_LIME_COLORS.glow          : AUDIO_LIME_COLORS.mutedGlow;
        }}
      >
        {isActive ? <Volume2 size={11} /> : <VolumeX size={11} />}
      </button>
    </>
  );
}

// ── Reusable left text block ──────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.25em",
      textTransform: "uppercase" as const,
      color: "#3B82F6",
      marginBottom: "12px",
    }}>
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display tracking-tight"
      style={{
        fontFamily: "var(--font-display, 'Syne', sans-serif)",
        fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
        fontWeight: 800,
        lineHeight: 1.0,
        letterSpacing: "-0.04em",
        color: "var(--page-text)",
        margin: "0 0 12px",
      }}
    >
      {children}
    </h2>
  );
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "13px", lineHeight: 1.65, color: "rgba(255,255,255,0.42)", marginBottom: "0" }}>
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function HomePageContent() {
  const router = useRouter();
  const { user } = useAuth();

  // Redirect after login
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) router.push(decodeURIComponent(next));
  }, [user, router]);

  // Defer heavy video sections
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => setMounted(true));
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Showcase API + static fallback
  const [showcaseAssets, setShowcaseAssets] = useState<PublicAsset[]>([]);
  const [showcaseLoaded, setShowcaseLoaded] = useState(false);
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

  function handleStartCreating() { router.push("/studio/image"); }

  // ── WYCC Carousel
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);

  function scrollCarousel(dir: 1 | -1) {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const gap = 16; // gap-4
    const cardW = card ? card.offsetWidth + gap : 340;
    el.scrollBy({ left: dir * cardW, behavior: "smooth" });
  }

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const gap = 16;
    const cardW = card ? card.offsetWidth + gap : 340;
    const idx = Math.min(
      Math.round(el.scrollLeft / cardW),
      showcaseSlides.length - 1,
    );
    setCarouselIdx(idx);
  }

  // ── Split layout helper widths
  const LEFT_W = "w-full md:w-[240px] lg:w-[270px] flex-shrink-0 text-center md:text-left";

  return (
    <HomeVideoAudioProvider>
    <div style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)", minHeight: "100vh" }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── 2. VERTICAL STORIES ─────────────────────────────────────────────── */}
      <VerticalStoriesSection />

      {/* ── 3. HOW ZENCRA WORKS ─────────────────────────────────────────────── */}
      {/* Split: left text + right 3-card grid */}
      <section className="py-10 md:py-16" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="container-site">
          <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">

            {/* Left text */}
            <div className={LEFT_W} style={{ paddingTop: "8px" }}>
              <SectionLabel>Simple, Powerful, Fast</SectionLabel>
              <SectionHeading>How Zencra Works</SectionHeading>
              <SectionSub>Three simple steps to bring your ideas to life with AI.</SectionSub>
            </div>

            {/* Right: 3 step cards */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4 hzw-cards-wrap">
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    style={{
                      background: step.gradient,
                      border: `1px solid ${step.border}`,
                      borderRadius: 0,
                      overflow: "hidden",
                    }}
                  >
                    {/* Landscape thumbnail */}
                    <div
                      className="relative w-full aspect-video"
                      style={{ background: step.sample, overflow: "hidden" }}
                    >
                      {"imageSrc" in step && step.imageSrc ? (
                        <Image
                          src={step.imageSrc}
                          alt={step.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          style={{ objectFit: "cover", borderRadius: 0 }}
                          priority
                        />
                      ) : (
                        <VideoMuted
                          id={`how-it-works-${step.num}`}
                          src={`/how-it-works/step-${parseInt(step.num)}.mp4`}
                          preload="none"
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 0 }}
                          btnPos={{ bottom: "6px", right: "6px" }}
                        />
                      )}

                      {/* Step number badge */}
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          left: "10px",
                          width: "26px",
                          height: "26px",
                          background: `${step.color}22`,
                          border: `1px solid ${step.color}55`,
                          backdropFilter: "blur(8px)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 0,
                        }}
                      >
                        <Icon size={13} style={{ color: step.color }} />
                      </div>

                      {/* Large step watermark number */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          right: "10px",
                          fontSize: "42px",
                          fontWeight: 900,
                          lineHeight: 1,
                          color: `${step.color}18`,
                          fontFamily: "var(--font-display, 'Syne', sans-serif)",
                        }}
                      >
                        {step.num}
                      </div>
                    </div>

                    {/* Text */}
                    <div style={{ padding: "14px 16px" }}>
                      <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--page-text)", margin: "0 0 6px" }}>
                        {step.title}
                      </h3>
                      <p style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. WHAT YOU CAN CREATE ──────────────────────────────────────────── */}
      {/* Split: left text+CTA + right native-scroll video row */}
      <section className="py-10 md:py-16" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="container-site">
          <div className="flex flex-col md:flex-row gap-8 md:gap-14 items-start">

            {/* Left text */}
            <div className={LEFT_W} style={{ paddingTop: "8px" }}>
              <SectionLabel>Endless Possibilities</SectionLabel>
              <SectionHeading>What You Can Create</SectionHeading>
              <SectionSub>
                From cinematic scenes to AI influencers, the possibilities are limitless.
              </SectionSub>

              {/* Explore Studio CTA */}
              <button
                onClick={handleStartCreating}
                className="inline-flex items-center gap-2 mt-6"
                style={{
                  padding: "10px 20px",
                  background: "rgba(59,130,246,0.10)",
                  border: "1px solid rgba(59,130,246,0.30)",
                  color: "#93C5FD",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: 0,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.18)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.10)"; }}
              >
                Explore Studio
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Right: JS-controlled cinematic carousel */}
            <div className="flex-1 min-w-0" style={{ overflow: "hidden" }}>

              {/* Arrow + strip wrapper */}
              <div style={{ position: "relative" }}>

                {/* ← Left arrow */}
                <button
                  aria-label="Previous"
                  onClick={() => scrollCarousel(-1)}
                  style={{
                    display: carouselIdx === 0 ? "none" : "flex",
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-60%)",
                    zIndex: 20,
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: "rgba(10,14,26,0.72)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    color: "rgba(255,255,255,0.88)",
                    cursor: "pointer",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
                    transition: "background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
                    padding: 0,
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(30,40,70,0.90)";
                    b.style.boxShadow = "0 6px 32px rgba(0,0,0,0.70), 0 0 18px rgba(59,130,246,0.18)";
                    b.style.transform = "translateY(-60%) scale(1.08)";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(10,14,26,0.72)";
                    b.style.boxShadow = "0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)";
                    b.style.transform = "translateY(-60%) scale(1)";
                  }}
                >
                  <ChevronLeft size={17} strokeWidth={2.2} />
                </button>

                {/* → Right arrow */}
                <button
                  aria-label="Next"
                  onClick={() => scrollCarousel(1)}
                  style={{
                    display: carouselIdx >= showcaseSlides.length - 1 ? "none" : "flex",
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-60%)",
                    zIndex: 20,
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: "rgba(10,14,26,0.72)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    color: "rgba(255,255,255,0.88)",
                    cursor: "pointer",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
                    transition: "background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
                    padding: 0,
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(30,40,70,0.90)";
                    b.style.boxShadow = "0 6px 32px rgba(0,0,0,0.70), 0 0 18px rgba(59,130,246,0.18)";
                    b.style.transform = "translateY(-60%) scale(1.08)";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(10,14,26,0.72)";
                    b.style.boxShadow = "0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)";
                    b.style.transform = "translateY(-60%) scale(1)";
                  }}
                >
                  <ChevronRight size={17} strokeWidth={2.2} />
                </button>

                {/* Scroll strip */}
                <div
                  ref={carouselRef}
                  onScroll={handleCarouselScroll}
                  className="flex gap-4 overflow-x-auto pb-3"
                  style={{
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                    scrollBehavior: "smooth",
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                  }}
                >
                  {showcaseSlides.map((asset, i) => {
                    const color = (asset.tool && TOOL_COLOR[asset.tool]) ?? DEFAULT_TOOL_COLOR;
                    const toolLabel = toolDisplayName(asset.tool);
                    const cardLabel = WYCC_LABELS[i] ?? (
                      asset.tool === "heygen" ? "Talking Avatar" : "Cinematic Video"
                    );

                    return (
                      <div
                        key={asset.id ?? i}
                        data-carousel-card
                        className="relative group"
                        style={{
                          scrollSnapAlign: "start",
                          flex: "0 0 auto",
                          /* Desktop ~2.5 visible | tablet ~2 | mobile ~1 */
                          width: "clamp(260px, 30vw, 390px)",
                          aspectRatio: "16/9",
                          background: "linear-gradient(160deg,#0F1A32 0%,#0d1a2a 100%)",
                          border: `1px solid ${color}22`,
                          overflow: "hidden",
                          borderRadius: 0,
                          transition: "transform 0.25s ease, box-shadow 0.25s ease",
                          cursor: "pointer",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.transform = "translateY(-4px) scale(1.01)";
                          (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 50px rgba(0,0,0,0.6), 0 0 40px ${color}22`;
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.transform = "";
                          (e.currentTarget as HTMLElement).style.boxShadow = "";
                        }}
                      >
                        {asset.result_url && (
                          <VideoMuted
                            id={`wycc-${asset.id ?? i}`}
                            src={asset.result_url}
                            preload="none"
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ opacity: 1, borderRadius: 0 }}
                            btnPos={{ bottom: "40px", right: "8px" }}
                          />
                        )}

                        {/* Category badge */}
                        <div style={{ position: "absolute", top: "10px", right: "10px" }}>
                          <span style={{
                            padding: "2px 8px",
                            background: "rgba(0,0,0,0.55)",
                            border: "1px solid rgba(255,255,255,0.14)",
                            backdropFilter: "blur(8px)",
                            fontSize: "9px",
                            fontWeight: 700,
                            textTransform: "uppercase" as const,
                            color: "rgba(255,255,255,0.85)",
                            letterSpacing: "0.06em",
                            borderRadius: 0,
                          }}>
                            {cardLabel}
                          </span>
                        </div>

                        {/* Bottom: tool dot + label */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: "10px 10px 8px",
                            background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)",
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{toolLabel}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div aria-hidden="true" style={{ flex: "0 0 4px" }} />
                </div>
              </div>

              {/* Dot indicators — synced to carouselIdx */}
              <div className="flex items-center gap-1.5 mt-4">
                {showcaseSlides.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Go to card ${i + 1}`}
                    onClick={() => {
                      const el = carouselRef.current;
                      if (!el) return;
                      const card = el.querySelector<HTMLElement>("[data-carousel-card]");
                      const gap = 16;
                      const cardW = card ? card.offsetWidth + gap : 340;
                      el.scrollTo({ left: i * cardW, behavior: "smooth" });
                    }}
                    style={{
                      width: i === carouselIdx ? "20px" : "6px",
                      height: "6px",
                      borderRadius: "3px",
                      background: i === carouselIdx ? "#3B82F6" : "rgba(255,255,255,0.18)",
                      transition: "width 0.22s ease, background 0.22s ease",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FUTURE CINEMA STUDIO ─────────────────────────────────────────── */}
      {/* Black + Gold luxury cinematic banner */}
      <section className="py-8 md:py-12" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="px-0 md:px-10 lg:px-16 xl:px-24">
          <div
            className="cinema-card relative w-full overflow-hidden"
            style={{
              /* Fixed cinematic banner height — no full-screen vertical stretch */
              height: "clamp(420px, 45vw, 580px)",
              background: "linear-gradient(135deg, #050502 0%, #0c0a04 35%, #100e06 60%, #0a0804 100%)",
              /* Subtle gold outer frame */
              border: "1px solid rgba(212,175,55,0.28)",
              boxShadow: "0 0 0 1px rgba(184,137,46,0.10), 0 0 60px rgba(212,175,55,0.06), 0 28px 80px rgba(0,0,0,0.65)",
              borderRadius: 0,
            }}
          >
            {/* BG video — same src, cropped to upper cinematic composition */}
            <VideoMuted
              id="fcs-bg"
              src="/cinema/bg.mp4"
              preload="none"
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
                objectPosition: "center 20%",   /* crop to upper/mid cinematic frame */
                opacity: 0.60,
                borderRadius: 0,
              }}
              btnPos={{ top: "14px", right: "14px" }}
            />

            {/* Gold atmospheric glows */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div style={{
                position: "absolute", width: "55%", height: "90%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 65%)",
                top: "-25%", right: "-5%", filter: "blur(90px)",
              }} />
              <div style={{
                position: "absolute", width: "35%", height: "60%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(184,137,46,0.08) 0%, transparent 70%)",
                bottom: "-20%", left: "10%", filter: "blur(70px)",
              }} />
            </div>

            {/* Subtle gold grid lines */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.018]"
              style={{
                backgroundImage: "linear-gradient(rgba(212,175,55,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.6) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
              aria-hidden="true"
            />

            {/* Left-side readability gradient — deep black base fading right */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(to right, rgba(4,3,2,0.95) 0%, rgba(4,3,2,0.72) 42%, rgba(4,3,2,0.15) 72%, transparent 100%)" }}
            />

            {/* Top thin gold accent line */}
            <div
              className="pointer-events-none absolute top-0 left-0 right-0"
              style={{ height: "1px", background: "linear-gradient(to right, rgba(212,175,55,0.55) 0%, rgba(212,175,55,0.18) 50%, transparent 100%)" }}
            />

            {/* Content — centered on mobile, left-aligned max 54% wide on desktop */}
            <div className="relative z-10 flex flex-col items-center md:items-start gap-4 px-8 py-10 md:py-12 md:max-w-[54%] text-center md:text-left fcs-content">

              {/* Main title — FUTURE CINEMA STUDIO (large gold, single occurrence) */}
              <h2 className="fcs-title-main">Future Cinema Studio</h2>

              {/* Secondary — Direct AI Films. (white) + Scene by Scene. (gold) */}
              <p className="fcs-subtitle-line">
                <span className="fcs-direct">Direct AI Films.</span>{" "}
                <span className="fcs-scene-text">Scene by Scene.</span>
              </p>
              {/* Thin gold accent underline */}
              <div className="fcs-scene-underline mx-auto md:mx-0" aria-hidden="true" />

              {/* Subline */}
              <p style={{
                fontSize: "13px",
                lineHeight: 1.65,
                color: "rgba(245,240,232,0.72)",
                textShadow: "0 1px 12px rgba(0,0,0,0.95)",
                maxWidth: "370px",
                margin: 0,
              }}>
                From concept to final cut — generate, edit, voice, and export your film in one seamless studio.
              </p>

              {/* Feature chips — black glass + gold */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {["AI Scene Generation", "Smart Continuity", "Voice & Lip-Sync", "Cinematic Export"].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-1.5 px-3 py-1.5"
                    style={{
                      background: "rgba(212,175,55,0.07)",
                      border: "1px solid rgba(212,175,55,0.28)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      borderRadius: 0,
                      transition: "background 0.18s ease, box-shadow 0.18s ease",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(212,175,55,0.13)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px rgba(212,175,55,0.14)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(212,175,55,0.07)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div style={{
                      width: "4px", height: "4px", borderRadius: "50%",
                      backgroundColor: "#D4AF37",
                      boxShadow: "0 0 5px rgba(212,175,55,0.7)",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#F5C76B" }}>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 mt-1 justify-center md:justify-start">
                {/* Primary — gold gradient */}
                <button
                  onClick={() => router.push("/studio/cinema")}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold"
                  style={{
                    background: "linear-gradient(135deg, #D4AF37 0%, #B8892E 100%)",
                    color: "#0A0800",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: 0,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    boxShadow: "0 0 28px rgba(212,175,55,0.28), 0 4px 16px rgba(0,0,0,0.45)",
                    transition: "box-shadow 0.2s ease, filter 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.boxShadow = "0 0 50px rgba(212,175,55,0.50), 0 6px 24px rgba(0,0,0,0.55)";
                    b.style.filter = "brightness(1.08)";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.boxShadow = "0 0 28px rgba(212,175,55,0.28), 0 4px 16px rgba(0,0,0,0.45)";
                    b.style.filter = "";
                  }}
                >
                  Start Creating
                  <ArrowRight size={14} />
                </button>

                {/* Secondary — black glass + gold border */}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm"
                  style={{
                    background: "rgba(4,3,2,0.65)",
                    border: "1px solid rgba(212,175,55,0.38)",
                    color: "rgba(245,199,107,0.88)",
                    cursor: "pointer",
                    borderRadius: 0,
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(212,175,55,0.10)";
                    b.style.borderColor = "rgba(212,175,55,0.65)";
                    b.style.boxShadow = "0 0 18px rgba(212,175,55,0.16)";
                    b.style.color = "#F5C76B";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(4,3,2,0.65)";
                    b.style.borderColor = "rgba(212,175,55,0.38)";
                    b.style.boxShadow = "none";
                    b.style.color = "rgba(245,199,107,0.88)";
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 5l4 2.5L6 10V5z" fill="currentColor" />
                  </svg>
                  Watch Demo
                </button>
              </div>
            </div>

            {/* Bottom timeline reel — gold/bronze accents */}
            <div
              className="absolute bottom-0 left-0 right-0 hidden md:flex items-center gap-px px-6 py-2.5"
              style={{ background: "linear-gradient(to top, rgba(4,3,2,0.92), transparent)", overflow: "hidden" }}
            >
              {/* Gold reflection sweep */}
              <div className="fcs-reel-shine" aria-hidden="true" />
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    height: i % 8 === 0 ? "14px" : "10px",
                    background:
                      i % 4 === 0
                        ? "rgba(212,175,55,0.52)"
                        : i % 9 === 0
                        ? "rgba(184,137,46,0.38)"
                        : "rgba(245,240,232,0.05)",
                    borderRadius: 0,
                  }}
                />
              ))}
              {/* Gold line above reel */}
              <div
                className="absolute top-0 left-6 right-6"
                style={{ height: "1px", background: "linear-gradient(to right, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0.10) 60%, transparent 100%)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. BUILT FOR CREATORS, FILMMAKERS, AND AGENCIES ─────────────────── */}
      {/* Split: left text + right 3 compact audience cards */}
      <section className="py-10 md:py-16" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="container-site">
          {/* gap-12 md:gap-16 keeps left text panel fully clear of the card grid */}
          <div className="flex flex-col md:flex-row gap-12 md:gap-16 items-start">

            {/* Left text — flex-shrink-0 prevents any compression */}
            <div className={LEFT_W} style={{ paddingTop: "8px" }}>
              <SectionLabel>Made for You</SectionLabel>
              <h2
                className="font-display tracking-tight"
                style={{
                  fontFamily: "var(--font-display, 'Syne', sans-serif)",
                  fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
                  fontWeight: 800,
                  lineHeight: 1.0,
                  letterSpacing: "-0.04em",
                  color: "var(--page-text)",
                  margin: "0 0 12px",
                }}
              >
                Built for<br />
                Creators,<br />
                Filmmakers,<br />
                <span style={{ whiteSpace: "nowrap" }}>and Agencies.</span>
              </h2>
              <SectionSub>Powerful tools for every type of storyteller.</SectionSub>
            </div>

            {/* Right: 3 square audience cards
                Mobile: horizontal swipe strip (~1.1 cards visible, 280px each, scroll-snap)
                Desktop: unchanged 3-col grid via md:grid md:grid-cols-3
            */}
            <div
              className="flex-1 min-w-0 audience-cards-wrap md:grid md:grid-cols-3 md:gap-4"
              style={{ paddingLeft: "clamp(0px, calc((100vw - 640px) * 0.2), 84px)" }}
            >
              {audienceCards.map((card) => {
                return (
                  <div
                    key={card.title}
                    className="relative overflow-hidden group cursor-pointer audience-card-item"
                    style={{
                      aspectRatio: "1/1",
                      background: card.gradient,
                      border: "none",
                      borderRadius: 0,
                      transition: "transform 0.25s ease, box-shadow 0.25s ease",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.5)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = "";
                      (e.currentTarget as HTMLElement).style.boxShadow = "";
                    }}
                  >
                    {/* Background video — deferred */}
                    {card.videoSrc && mounted && (
                      <VideoMuted
                        id={`audience-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
                        src={card.videoSrc}
                        preload="none"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, borderRadius: 0 }}
                        btnPos={{ bottom: "6px", right: "6px" }}
                      />
                    )}

                    {/* Bottom content */}
                    <div
                      style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px", background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.12) 70%, transparent 100%)" }}
                    >
                      <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", textShadow: "0 2px 14px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.8)", margin: "0 0 5px", letterSpacing: "-0.01em" }}>{card.title}</h3>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.78)", lineHeight: 1.55, textShadow: "0 1px 6px rgba(0,0,0,0.9)", margin: 0 }}>{card.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. PRICING ──────────────────────────────────────────────────────── */}
      <HomePricingPreview />

      {/* ── 8. FOOTER CTA BAND ──────────────────────────────────────────────── */}
      <section
        className="py-20 md:py-28"
        style={{
          position: "relative",
          overflow: "hidden",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Cinematic background still */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/hero/cyberpunk.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.62,
            zIndex: 0,
          }}
        />
        {/* Neutral black cinematic overlay — no blue tint */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(4,4,6,0.52) 0%, rgba(4,4,6,0.42) 50%, rgba(4,4,6,0.56) 100%)",
            zIndex: 1,
          }}
        />
        {/* Edge vignette — subtle blue/purple only at outer corners */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 40%, rgba(4,4,8,0.78) 78%, rgba(10,8,28,0.88) 100%)",
            zIndex: 2,
          }}
        />

        {/* Content */}
        <div
          className="container-site flex flex-col items-center gap-6 text-center px-6 md:px-0"
          style={{ position: "relative", zIndex: 3 }}
        >
          <h2
            className="font-display"
            style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              color: "#F8FAFC",
              margin: 0,
            }}
          >
            Ready to Direct Your Next Film?
          </h2>
          <p style={{
            color: "rgba(255,255,255,0.46)",
            lineHeight: 1.65,
            maxWidth: "380px",
            fontSize: "15px",
            margin: 0,
          }}>
            Start with a scene, a character, or a single idea.
          </p>
          <button
            onClick={handleStartCreating}
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
              boxShadow: "0 4px 28px rgba(59,130,246,0.30)",
              border: "none",
              cursor: "pointer",
              borderRadius: 0,
              letterSpacing: "0.01em",
              transition: "box-shadow 0.2s ease, transform 0.15s ease, opacity 0.2s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(59,130,246,0.46)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLElement).style.opacity = "0.92";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 28px rgba(59,130,246,0.30)";
              (e.currentTarget as HTMLElement).style.transform = "";
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
          >
            Start Creating Free
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

    </div>

    <style>{`
      /* Cinema Studio card: 9:16 on mobile → 16:9 on desktop */
      .cinema-card { aspect-ratio: 9/16; }
      @media (min-width: 768px) { .cinema-card { aspect-ratio: 16/9; } }

      /* Hide scrollbars on all native-scroll tracks */
      .overflow-x-auto::-webkit-scrollbar { display: none; }

      /* Audio button — lime identity */
      button[aria-label="Unmute video"]:hover,
      button[aria-label="Mute video"]:hover   { opacity: 1 !important; }

      /* ── FCS TITLE SYSTEM ────────────────────────────────────────────── */

      /* Scene-text continuous shimmer — used by "Scene by Scene." subtitle */
      @keyframes fcsShimmer {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }

      /* Title shine — slow sweep with natural pauses at each end */
      @keyframes fcsTitleShine {
        0%,  28% { background-position: 220% center; }
        72%, 100% { background-position: -220% center; }
      }

      /* Reel shine — a single narrow light bar travelling left → right */
      @keyframes fcsReelShine {
        0%,  18% { transform: translateX(-120%); opacity: 0; }
        22%       { opacity: 1; }
        78%       { opacity: 1; }
        82%, 100% { transform: translateX(280%);  opacity: 0; }
      }

      /* Main title — FUTURE CINEMA STUDIO */
      .fcs-title-main {
        display: block;
        font-family: var(--font-display, 'Syne', sans-serif);
        font-size: clamp(2.0rem, 5vw, 4.4rem);
        font-weight: 800;
        line-height: 1.0;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin: 0;
        /* Concentrated highlight band — rests dark, sweeps bright */
        background: linear-gradient(90deg, #B8892E, #C49A30, #D4AF37, #F5C76B, #FFF2B8, #F5C76B, #D4AF37, #C49A30, #B8892E);
        background-size: 400% 100%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fcsTitleShine 4s ease-in-out infinite;
      }
      /* Hover: ease off slightly — luxury feel, not a full stop */
      .cinema-card:hover .fcs-title-main {
        animation-duration: 6s;
      }

      /* Subtitle row */
      .fcs-subtitle-line {
        display: block;
        font-family: var(--font-display, 'Syne', sans-serif);
        font-size: clamp(1.1rem, 2.4vw, 1.9rem);
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.02em;
        margin: 0;
      }

      /* "Direct AI Films." — warm champagne white */
      .fcs-direct {
        color: #F5EDD8;
        text-shadow: 0 2px 18px rgba(0,0,0,0.92), 0 1px 4px rgba(0,0,0,0.75);
      }

      /* "Scene by Scene." — continuous gold shimmer, no filter */
      .fcs-scene-text {
        display: inline;
        background: linear-gradient(90deg, #F9E7A1, #D4AF37, #FFF2B8, #B8892E, #D4AF37, #F9E7A1);
        background-size: 300% 100%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: fcsShimmer 4.5s linear infinite;
      }

      /* Thin gold accent line */
      .fcs-scene-underline {
        display: block;
        height: 1px;
        width: min(300px, 80%);
        background: linear-gradient(to right, rgba(212,175,55,0.65) 0%, rgba(212,175,55,0.20) 70%, transparent 100%);
        margin-top: 2px;
      }

      /* Reel shine overlay — narrow gold reflection sliding across the strip */
      .fcs-reel-shine {
        position: absolute;
        top: 0;
        left: 0;
        width: 32%;
        height: 100%;
        background: linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.22) 50%, transparent 100%);
        pointer-events: none;
        z-index: 3;
        animation: fcsReelShine 4.5s ease-in-out infinite;
      }
      /* Hover: pause the reel shine */
      .cinema-card:hover .fcs-reel-shine {
        animation-play-state: paused;
      }

      @media (prefers-reduced-motion: reduce) {
        .fcs-title-main  { animation: none; background-position: 44% center; }
        .fcs-scene-text  { animation: none; background-position: 44% center; }
        .fcs-reel-shine  { animation: none; opacity: 0; }
      }

      /* ── HOW ZENCRA WORKS — force cards grid to full width on mobile ────── */
      @media (max-width: 767px) {
        .hzw-cards-wrap { width: 100% !important; }
      }

      /* ── FCS — release inline height so aspect-ratio: 9/16 applies ──────── */
      @media (max-width: 767px) {
        .cinema-card { height: auto !important; }
        /* Push content lower for upper-center feel in the tall 9:16 frame */
        .fcs-content { padding-top: 72px !important; }
      }

      /* ── BUILT FOR CREATORS — mobile horizontal swipe strip ─────────────── */
      @media (max-width: 767px) {
        .audience-cards-wrap {
          display: flex !important;
          gap: 14px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 16px;
          /* Right-side peek: pad so 1.1 cards visible without clipping */
          padding-right: calc(100vw - 280px - 14px);
        }
        .audience-cards-wrap::-webkit-scrollbar { display: none; }
        .audience-card-item {
          flex: 0 0 280px !important;
          width: 280px !important;
          scroll-snap-align: start;
        }
        /* Always show mute button on touch devices inside audience cards */
        .audience-card-item button[aria-label="Unmute video"],
        .audience-card-item button[aria-label="Mute video"] { opacity: 1 !important; }
      }
    `}</style>

    </HomeVideoAudioProvider>
  );
}
