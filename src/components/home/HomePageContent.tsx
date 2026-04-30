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

// ── Pricing tiers ─────────────────────────────────────────────────────────────
const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "/ month",
    description: "Get started with basic features.",
    color: "#64748B",
    features: ["720p Exports", "Limited Generations", "Watermark", "Community Support"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/ month",
    description: "Everything you need to create more.",
    color: "#3B82F6",
    features: ["1080p Exports", "Unlimited Generations", "No Watermark", "Priority Support"],
    cta: "Try Pro",
    highlight: true,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/ month",
    description: "Advanced tools for professionals.",
    color: "#A855F7",
    features: ["4K Exports", "Advanced AI Models", "Team Collaboration", "Commercial License"],
    cta: "Upgrade",
    highlight: false,
  },
];

// ── VideoMuted — video with purple mute toggle ────────────────────────────────
// V2: active state is purple (not teal).
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
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: muted ? "rgba(0,0,0,0.55)" : "rgba(139,92,246,0.30)",
          border: `1px solid ${muted ? "rgba(255,255,255,0.18)" : "rgba(139,92,246,0.65)"}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: muted
            ? "0 2px 14px rgba(0,0,0,0.45)"
            : "0 0 18px rgba(139,92,246,0.50)",
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
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = "scale(1)";
          el.style.background = muted ? "rgba(0,0,0,0.55)" : "rgba(139,92,246,0.30)";
        }}
      >
        {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
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
        fontSize: "clamp(28px, 3vw, 44px)",
        fontWeight: 800,
        lineHeight: 0.95,
        letterSpacing: "-0.04em",
        color: "var(--page-text)",
        margin: "0 0 12px",
        maxWidth: "280px",
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
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  // Open auth modal from query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    if (authParam === "login" || authParam === "signup") setAuthModal(authParam);
  }, []);

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

  // ── Split layout: left 28%, right 72% (flex-1)
  const LEFT_W = "w-full md:w-[28%] flex-shrink-0";

  return (
    <>
    <div style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)", minHeight: "100vh" }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── 2. VERTICAL STORIES ─────────────────────────────────────────────── */}
      <VerticalStoriesSection />

      {/* ── 3. HOW ZENCRA WORKS ─────────────────────────────────────────────── */}
      {/* Split: left text + right 3-card grid */}
      <section className="py-14 md:py-[72px]" style={{ backgroundColor: "var(--page-bg)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container-site">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

            {/* Left text */}
            <div className={LEFT_W} style={{ paddingTop: "8px" }}>
              <SectionLabel>Simple, Powerful, Fast</SectionLabel>
              <SectionHeading>How Zencra Works</SectionHeading>
              <SectionSub>Three simple steps to bring your ideas to life with AI.</SectionSub>
            </div>

            {/* Right: 3 step cards */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {/* Landscape thumbnail — spec: ~145px height */}
                    <div
                      className="relative w-full"
                      style={{ height: "145px", background: step.sample, overflow: "hidden" }}
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
      <section className="py-14 md:py-[72px]" style={{ backgroundColor: "var(--page-bg)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container-site">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

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

            {/* Right: native scroll showcase cards */}
            <div className="flex-1 min-w-0" style={{ overflow: "hidden" }}>
              <div
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
                      className="relative group"
                      style={{
                        scrollSnapAlign: "start",
                        flex: "0 0 auto",
                        width: "clamp(190px, 16vw, 210px)",
                        height: "150px",
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

                      {/* Bottom: tool + duration */}
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

              {/* Dot indicators */}
              <div className="flex items-center gap-1.5 mt-4">
                {showcaseSlides.slice(0, 8).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === 0 ? "16px" : "6px",
                      height: "6px",
                      borderRadius: "3px",
                      background: i === 0 ? "#3B82F6" : "rgba(255,255,255,0.18)",
                      transition: "width 0.2s ease",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FUTURE CINEMA STUDIO ─────────────────────────────────────────── */}
      {/* Full-bleed card, content left-aligned within left half */}
      <section className="py-14 md:py-[72px]" style={{ backgroundColor: "var(--page-bg)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container-site">
          <div
            className="cinema-card relative w-full overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #050a14 0%, #0a0f1e 30%, #120a26 60%, #1a0d3a 100%)",
              border: "1px solid rgba(168,85,247,0.22)",
              boxShadow: "0 0 80px rgba(168,85,247,0.08), 0 24px 70px rgba(0,0,0,0.5)",
              borderRadius: 0,
              maxWidth: "1280px",
              margin: "0 auto",
            }}
          >
            {/* BG video */}
            <VideoMuted
              src="/cinema/bg.mp4"
              preload="none"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.65, borderRadius: 0 }}
              btnPos={{ top: "14px", right: "14px" }}
            />

            {/* Glows */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div style={{ position: "absolute", width: "60%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)", top: "-20%", right: "-10%", filter: "blur(80px)" }} />
              <div style={{ position: "absolute", width: "40%", height: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)", bottom: "-15%", left: "5%", filter: "blur(60px)" }} />
            </div>

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(168,85,247,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} aria-hidden="true" />

            {/* Readability gradient */}
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to right, rgba(5,10,20,0.92) 0%, rgba(5,10,20,0.65) 40%, transparent 100%)" }} />

            {/* LEFT-aligned content (mockup: text in left ~50% of card) */}
            <div
              className="relative z-10 flex flex-col items-start gap-4 px-8 py-10 md:py-14 md:max-w-[56%]"
            >
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.35)", color: "#C084FC", backdropFilter: "blur(8px)", borderRadius: 0 }}
              >
                <Clapperboard size={11} />
                AI Filmmaking Redefined
              </div>

              {/* Headline */}
              <h2
                className="font-display tracking-tight"
                style={{
                  fontFamily: "var(--font-display, 'Syne', sans-serif)",
                  fontSize: "clamp(1.6rem, 4.5vw, 3.2rem)",
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
                  display: "block",
                  background: "linear-gradient(135deg, #A855F7 0%, #60A5FA 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>
                  Scene by Scene.
                </span>
              </h2>

              {/* Subline */}
              <p style={{ fontSize: "13px", lineHeight: 1.65, color: "rgba(255,255,255,0.72)", textShadow: "0 1px 10px rgba(0,0,0,0.9)", maxWidth: "380px" }}>
                From concept to final cut — generate, edit, voice, and export your film in one seamless studio.
              </p>

              {/* Feature chips */}
              <div className="flex flex-wrap gap-2">
                {["AI Scene Generation", "Smart Continuity", "Voice & Lip-Sync", "Cinematic Export"].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-1.5 px-3 py-1.5"
                    style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.20)", backdropFilter: "blur(8px)", borderRadius: 0 }}
                  >
                    <div style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "#A855F7", boxShadow: "0 0 5px #A855F7" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#C084FC" }}>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <button
                  onClick={() => router.push("/studio/cinema")}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #A855F7, #6366F1)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 0 28px rgba(168,85,247,0.32)", borderRadius: 0, transition: "box-shadow 0.2s ease" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 48px rgba(168,85,247,0.55)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(168,85,247,0.32)"; }}
                >
                  Start Creating
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", cursor: "pointer", borderRadius: 0 }}
                >
                  {/* Circle-play icon */}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 5l4 2.5L6 10V5z" fill="currentColor" />
                  </svg>
                  Watch Demo
                </button>
              </div>
            </div>

            {/* Bottom timeline strip — desktop only */}
            <div
              className="absolute bottom-0 left-0 right-0 hidden md:flex items-center gap-px px-6 py-2.5"
              style={{ background: "linear-gradient(to top, rgba(5,10,20,0.88), transparent)" }}
            >
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="flex-1" style={{
                  height: "12px",
                  background: i % 4 === 0 ? "rgba(168,85,247,0.45)" : i % 7 === 0 ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.04)",
                  borderRadius: 0,
                }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. BUILT FOR CREATORS, FILMMAKERS, AND AGENCIES ─────────────────── */}
      {/* Split: left text + right 3 compact audience cards */}
      <section className="py-14 md:py-[72px]" style={{ backgroundColor: "var(--page-bg)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container-site">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

            {/* Left text */}
            <div className={LEFT_W} style={{ paddingTop: "8px" }}>
              <SectionLabel>Made for You</SectionLabel>
              <SectionHeading>
                Built for Creators,<br />Filmmakers,<br />and Agencies
              </SectionHeading>
              <SectionSub>Powerful tools for every type of storyteller.</SectionSub>
            </div>

            {/* Right: 3 audience cards */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {audienceCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="relative overflow-hidden group cursor-pointer"
                    style={{
                      height: "220px",
                      background: card.gradient,
                      border: `1px solid ${card.color}22`,
                      borderRadius: 0,
                      transition: "transform 0.25s ease, box-shadow 0.25s ease",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${card.color}20`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = "";
                      (e.currentTarget as HTMLElement).style.boxShadow = "";
                    }}
                  >
                    {/* Most Popular badge */}
                    {card.isMostPopular && (
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          zIndex: 20,
                          padding: "3px 10px",
                          background: `linear-gradient(135deg, ${card.color}, #A855F7)`,
                          fontSize: "9px",
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          color: "#fff",
                          textTransform: "uppercase" as const,
                          borderRadius: 0,
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        Most Popular
                      </div>
                    )}

                    {/* Background video — deferred */}
                    {card.videoSrc && mounted && (
                      <VideoMuted
                        src={card.videoSrc}
                        preload="none"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, borderRadius: 0 }}
                        btnPos={{ bottom: "6px", right: "6px" }}
                      />
                    )}

                    {/* Icon badge */}
                    <div style={{ position: "absolute", top: card.isMostPopular ? "46px" : "14px", left: "14px" }}>
                      <div style={{ width: "36px", height: "36px", background: `${card.color}22`, border: `1px solid ${card.color}40`, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 0 }}>
                        <Icon size={18} style={{ color: card.color }} />
                      </div>
                    </div>

                    {/* Bottom content */}
                    <div
                      style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px", background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.10) 70%, transparent 100%)" }}
                    >
                      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#F8FAFC", textShadow: "0 2px 10px rgba(0,0,0,0.9)", margin: "0 0 5px" }}>{card.title}</h3>
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
      {/* Split: left text + right 3 pricing cards */}
      <section className="py-14 md:py-[72px]" style={{ backgroundColor: "var(--page-bg)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container-site">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">

            {/* Left text */}
            <div className={LEFT_W} style={{ paddingTop: "8px" }}>
              <SectionLabel>Flexible Pricing</SectionLabel>
              <SectionHeading>Start Free.<br />Scale as You Create.</SectionHeading>
              <SectionSub>Choose the plan that fits your needs.</SectionSub>
            </div>

            {/* Right: 3 pricing cards */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.name}
                  className="relative flex flex-col p-5 md:p-6"
                  style={{
                    minHeight: "320px",
                    background: tier.highlight
                      ? `linear-gradient(135deg, ${tier.color}14 0%, rgba(139,92,246,0.07) 100%)`
                      : "var(--page-bg-2)",
                    border: tier.highlight ? `1px solid ${tier.color}45` : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: tier.highlight ? `0 0 50px ${tier.color}12` : "none",
                    borderRadius: 0,
                  }}
                >
                  {/* Most Popular badge */}
                  {tier.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        style={{ padding: "3px 12px", background: `linear-gradient(135deg, ${tier.color}, #8B5CF6)`, color: "#fff", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, borderRadius: 0, whiteSpace: "nowrap" as const }}
                      >
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Price header */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: tier.color, marginBottom: "6px" }}>{tier.name}</p>
                    <div className="flex items-end gap-1">
                      <span style={{ fontSize: "28px", fontWeight: 900, color: "var(--page-text)", lineHeight: 1 }}>{tier.price}</span>
                      <span style={{ fontSize: "12px", color: "#64748B", marginBottom: "2px" }}>{tier.period}</span>
                    </div>
                    <p style={{ fontSize: "11px", color: "#64748B", marginTop: "5px", lineHeight: 1.5 }}>{tier.description}</p>
                  </div>

                  {/* Features */}
                  <ul className="flex flex-col gap-2 mb-6">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2" style={{ fontSize: "11px", color: "#94A3B8" }}>
                        <Check size={12} style={{ color: tier.color, flexShrink: 0 }} />
                        {feat}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-auto">
                    <button
                      onClick={handleStartCreating}
                      className="w-full py-2.5 text-xs font-semibold transition-all duration-200"
                      style={{
                        background: tier.highlight ? `linear-gradient(135deg, ${tier.color}, #8B5CF6)` : "var(--page-bg-3)",
                        border: tier.highlight ? "none" : "1px solid var(--border-medium)",
                        color: tier.highlight ? "#fff" : "var(--page-text-2)",
                        cursor: "pointer",
                        borderRadius: 0,
                      }}
                      onMouseEnter={e => {
                        if (!tier.highlight) { (e.currentTarget as HTMLElement).style.background = "var(--page-bg-2)"; }
                        else { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }
                      }}
                      onMouseLeave={e => {
                        if (!tier.highlight) { (e.currentTarget as HTMLElement).style.background = "var(--page-bg-3)"; }
                        else { (e.currentTarget as HTMLElement).style.opacity = "1"; }
                      }}
                    >
                      {tier.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FOOTER CTA BAND ──────────────────────────────────────────────── */}
      <section
        className="py-12 md:py-20"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(139,92,246,0.04) 50%, rgba(168,85,247,0.05) 100%)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="container-site flex flex-col items-center gap-5 text-center px-6 md:px-0">
          <h2
            className="font-display tracking-tight"
            style={{
              fontFamily: "var(--font-display, 'Syne', sans-serif)",
              fontSize: "clamp(1.6rem, 3.5vw, 2.6rem)",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              color: "var(--page-text)",
              margin: 0,
            }}
          >
            Ready to Create Something Cinematic?
          </h2>
          <p style={{ color: "#64748B", lineHeight: 1.65, maxWidth: "380px", fontSize: "14px" }}>
            Start for free. No credit card required.
          </p>
          <button
            onClick={handleStartCreating}
            className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
              boxShadow: "0 0 36px rgba(59,130,246,0.32)",
              border: "none",
              cursor: "pointer",
              borderRadius: 0,
              transition: "box-shadow 0.2s ease, transform 0.15s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 56px rgba(59,130,246,0.55)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 36px rgba(59,130,246,0.32)";
              (e.currentTarget as HTMLElement).style.transform = "";
            }}
          >
            Try Free Now
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

    </div>

    <style>{`
      /* Cinema Studio card: explicit heights — mobile portrait, desktop landscape */
      .cinema-card { min-height: 320px; }
      @media (min-width: 768px) { .cinema-card { height: 440px; min-height: unset; } }

      /* Hide scrollbars on all native-scroll tracks */
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
