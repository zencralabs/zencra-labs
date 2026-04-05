"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Play, ImageIcon, Video, Music, Sparkles, Wand2, Mic, Film, Star, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

// ─────────────────────────────────────────────────────────────────────────────
// ZENCRA LABS – Cinematic Media Showcase Homepage
// Inspired by Higgsfield.ai — content-first, dark cinematic, glow-accented
// ─────────────────────────────────────────────────────────────────────────────

// ── Phase 1 Tool Categories ──────────────────────────────────────────────────
const toolCategories = [
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    color: "#2563EB",
    glow: "rgba(37,99,235,0.5)",
    glowClass: "card-glow-blue",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a1040 40%, #1e3a8a 100%)",
    description: "Generate stunning AI images",
    tools: ["Create Image", "Enhance & Upscale", "Face Swap"],
    badge: null,
  },
  {
    id: "video",
    label: "Video",
    icon: Video,
    color: "#0EA5A0",
    glow: "rgba(14,165,160,0.5)",
    glowClass: "card-glow-teal",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #0d2626 40%, #0f4038 100%)",
    description: "Create cinematic AI videos",
    tools: ["Create Video", "Edit Video", "Lip Sync"],
    badge: "HOT",
  },
  {
    id: "audio",
    label: "Audio",
    icon: Music,
    color: "#A855F7",
    glow: "rgba(168,85,247,0.5)",
    glowClass: "card-glow-purple",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1a0d2e 40%, #3b0764 100%)",
    description: "AI voiceovers, music & cloning",
    tools: ["AI Voiceover", "AI Music", "Voice Clone"],
    badge: "NEW",
  },
];

// ── Showcase Grid Items (placeholder cinematic cards) ────────────────────────
// Replace these with real AI-generated media when ready
const showcaseItems = [
  {
    id: 1,
    gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 50%, #1d4ed8 100%)",
    accentColor: "#2563EB",
    label: "AI Video",
    tool: "Kling 3.0",
    title: "Cinematic Chase",
    height: 300,
    overlay: true,
  },
  {
    id: 2,
    gradient: "linear-gradient(160deg, #0d0d1a 0%, #1a0d2e 50%, #7c3aed 100%)",
    accentColor: "#A855F7",
    label: "AI Image",
    tool: "Nano Banana Pro",
    title: "Neon Portrait",
    height: 220,
    overlay: true,
  },
  {
    id: 3,
    gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 50%, #0ea5a0 100%)",
    accentColor: "#0EA5A0",
    label: "AI Video",
    tool: "Runway ML",
    title: "Ocean Drift",
    height: 260,
    overlay: true,
  },
  {
    id: 4,
    gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 50%, #dc2626 100%)",
    accentColor: "#EF4444",
    label: "AI Image",
    tool: "Flux",
    title: "Fire Abstract",
    height: 180,
    overlay: true,
  },
  {
    id: 5,
    gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 50%, #2563eb 100%)",
    accentColor: "#60A5FA",
    label: "AI Video",
    tool: "Veo 3",
    title: "Urban Storm",
    height: 340,
    overlay: true,
  },
  {
    id: 6,
    gradient: "linear-gradient(160deg, #0f0a1a 0%, #2d1b69 50%, #7c3aed 100%)",
    accentColor: "#A855F7",
    label: "AI Music",
    tool: "Suno AI",
    title: "Deep Frequency",
    height: 200,
    overlay: true,
  },
  {
    id: 7,
    gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 50%, #10b981 100%)",
    accentColor: "#10B981",
    label: "AI Image",
    tool: "Seedream",
    title: "Forest Spirit",
    height: 250,
    overlay: true,
  },
  {
    id: 8,
    gradient: "linear-gradient(160deg, #1a1206 0%, #422006 50%, #f59e0b 100%)",
    accentColor: "#F59E0B",
    label: "AI Video",
    tool: "LTX-2",
    title: "Golden Hour",
    height: 190,
    overlay: true,
  },
  {
    id: 9,
    gradient: "linear-gradient(160deg, #0f1a32 0%, #1e3a5f 50%, #0ea5a0 100%)",
    accentColor: "#0EA5A0",
    label: "AI Video",
    tool: "HeyGen",
    title: "Avatar Dance",
    height: 280,
    overlay: true,
  },
  {
    id: 10,
    gradient: "linear-gradient(160deg, #1a0f1a 0%, #4c0d8a 50%, #c084fc 100%)",
    accentColor: "#C084FC",
    label: "AI Image",
    tool: "Seedance",
    title: "Galactic Dream",
    height: 210,
    overlay: true,
  },
  {
    id: 11,
    gradient: "linear-gradient(160deg, #0a1020 0%, #162040 50%, #2563eb 100%)",
    accentColor: "#2563EB",
    label: "AI Video",
    tool: "Kling 3.0",
    title: "Underwater City",
    height: 290,
    overlay: true,
  },
  {
    id: 12,
    gradient: "linear-gradient(160deg, #1a0a10 0%, #5a0a20 50%, #f43f5e 100%)",
    accentColor: "#F43F5E",
    label: "AI Audio",
    tool: "Kits AI",
    title: "Voice Morph",
    height: 170,
    overlay: true,
  },
];

// ── Slider rows for the showcase section (Image + Video tools only) ──────────
const sliderRow1 = [
  { gradient: "linear-gradient(160deg, #0F1A32 0%, #1e3a8a 60%, #3b82f6 100%)", label: "AI Video", tool: "Kling 3.0", color: "#2563EB" },
  { gradient: "linear-gradient(160deg, #0d0d1a 0%, #2d1b69 60%, #8b5cf6 100%)", label: "AI Image", tool: "Nano Banana Pro", color: "#A855F7" },
  { gradient: "linear-gradient(160deg, #0d1a1a 0%, #0f3030 60%, #14b8a6 100%)", label: "AI Video", tool: "Runway ML", color: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #3b1010 60%, #ef4444 100%)", label: "AI Image", tool: "Flux", color: "#EF4444" },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #60a5fa 100%)", label: "AI Video", tool: "Google Veo", color: "#60A5FA" },
  { gradient: "linear-gradient(160deg, #1a0f1a 0%, #4c0d8a 60%, #c084fc 100%)", label: "AI Video", tool: "HeyGen", color: "#C084FC" },
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #064e3b 60%, #10b981 100%)", label: "AI Image", tool: "Seedream", color: "#10B981" },
  { gradient: "linear-gradient(160deg, #1a1206 0%, #422006 60%, #f59e0b 100%)", label: "AI Video", tool: "Seedance", color: "#F59E0B" },
];
const sliderRow1Doubled = [...sliderRow1, ...sliderRow1];

const sliderRow2 = [
  { gradient: "linear-gradient(160deg, #0d0d1a 0%, #1a0d2e 60%, #7c3aed 100%)", label: "AI Image", tool: "ChatGPT Image", color: "#7c3aed" },
  { gradient: "linear-gradient(160deg, #0a1020 0%, #162040 60%, #2563eb 100%)", label: "AI Video", tool: "LTX-2", color: "#2563EB" },
  { gradient: "linear-gradient(160deg, #0f1a32 0%, #1e3a5f 60%, #0ea5a0 100%)", label: "AI Video", tool: "Kling 3.0", color: "#0EA5A0" },
  { gradient: "linear-gradient(160deg, #1a0a0a 0%, #2d1020 60%, #e11d48 100%)", label: "AI Video", tool: "Runway ML", color: "#E11D48" },
  { gradient: "linear-gradient(160deg, #0d1a14 0%, #052e16 60%, #22c55e 100%)", label: "AI Image", tool: "Nano Banana 2", color: "#22C55E" },
  { gradient: "linear-gradient(160deg, #0f0a1a 0%, #1e1035 60%, #818cf8 100%)", label: "AI Video", tool: "Seedance", color: "#818CF8" },
  { gradient: "linear-gradient(160deg, #0a0f1a 0%, #1a2744 60%, #38bdf8 100%)", label: "AI Video", tool: "Google Veo", color: "#38BDF8" },
  { gradient: "linear-gradient(160deg, #1a0f00 0%, #3d2500 60%, #f59e0b 100%)", label: "AI Image", tool: "Flux", color: "#F59E0B" },
];
const sliderRow2Doubled = [...sliderRow2, ...sliderRow2];

// ── Featured Showcase (top row hero cards) ───────────────────────────────────
const featuredItems = [
  {
    id: "f1",
    gradient: "linear-gradient(135deg, #0F1A32 0%, #1e3a8a 60%, #2563EB 100%)",
    title: "ZENCRA AI VIDEO",
    subtitle: "Cinematic video generation with Kling & Runway",
    badge: "VIDEO",
    badgeColor: "#0EA5A0",
    icon: Film,
  },
  {
    id: "f2",
    gradient: "linear-gradient(135deg, #0d0d1a 0%, #2d1b69 60%, #7c3aed 100%)",
    title: "AI IMAGE STUDIO",
    subtitle: "4K images with Nano Banana Pro & Flux",
    badge: "IMAGE",
    badgeColor: "#A855F7",
    icon: ImageIcon,
  },
  {
    id: "f3",
    gradient: "linear-gradient(135deg, #0d1a1a 0%, #064e3b 60%, #0ea5a0 100%)",
    title: "SOUND & VOICE",
    subtitle: "AI music, voiceover & voice cloning",
    badge: "AUDIO",
    badgeColor: "#10B981",
    icon: Mic,
  },
  {
    id: "f4",
    gradient: "linear-gradient(135deg, #1a0f0a 0%, #451a03 60%, #f59e0b 100%)",
    title: "AI CHARACTERS",
    subtitle: "Build AI influencers & digital personas",
    badge: "COMING",
    badgeColor: "#F59E0B",
    icon: Star,
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  function handleTryFree() {
    if (user) { router.push("/dashboard"); } else { setAuthModal("signup"); }
  }

  return (
    <>
    <div style={{ backgroundColor: "var(--page-bg)", color: "var(--page-text)", minHeight: "100vh" }}>

      {/* ── CINEMATIC HERO ─────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "calc(100vh - 300px)" }}>

        {/* ── VIDEO BACKGROUND ───────────────────────────────────────────────── */}
        {/* Drop your AI-generated video as /public/hero-video.mp4 to activate */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.55 }}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>

        {/* Dark cinematic overlay over the video */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,14,28,0.55) 0%, rgba(8,14,28,0.25) 40%, rgba(8,14,28,0.75) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Animated Background Orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* Primary blue orb */}
          <div
            className="animate-orb-1 absolute"
            style={{
              width: "600px", height: "600px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)",
              top: "-10%", left: "20%",
              filter: "blur(40px)",
            }}
          />
          {/* Teal orb */}
          <div
            className="animate-orb-2 absolute"
            style={{
              width: "500px", height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(14,165,160,0.25) 0%, transparent 70%)",
              bottom: "0%", right: "15%",
              filter: "blur(50px)",
            }}
          />
          {/* Purple orb */}
          <div
            className="animate-orb-3 absolute"
            style={{
              width: "400px", height: "400px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)",
              top: "40%", left: "-5%",
              filter: "blur(60px)",
            }}
          />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(248,250,252,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(248,250,252,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Hero Content */}
        <div className="container-site relative z-10 flex flex-col items-center gap-8 pt-32 pb-20 text-center">

          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{
              background: "rgba(37,99,235,0.12)",
              border: "1px solid rgba(37,99,235,0.3)",
              color: "#60A5FA",
              boxShadow: "0 0 20px rgba(37,99,235,0.15)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "#2563EB",
                boxShadow: "0 0 6px #2563EB",
                animation: "pulse 2s infinite",
              }}
            />
            AI-Powered Creative Studio
          </div>

          {/* Main Headline */}
          <h1
            className="max-w-5xl font-bold leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(3rem, 8vw, 6rem)" }}
          >
            Create Without{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 50%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Limits
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: "#94A3B8" }}
          >
            Generate cinematic AI videos, stunning images, and immersive audio
            — all in one intelligent creative platform.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleTryFree}
              className="group inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
                boxShadow: "0 0 30px rgba(37,99,235,0.4)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(37,99,235,0.7), 0 0 80px rgba(14,165,160,0.3)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(37,99,235,0.4)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              <Zap size={16} />
              {user ? "Go to Dashboard" : "Try Free"}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#F8FAFC",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(37,99,235,0.15)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <Play size={16} />
              Watch Demo
            </button>
          </div>

          {/* Tool badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            {["Kling", "Runway ML", "Veo", "Flux", "Suno AI", "ElevenLabs", "HeyGen"].map((tool) => (
              <span
                key={tool}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#64748B",
                }}
              >
                {tool}
              </span>
            ))}
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ color: "#2563EB" }}
            >
              + more
            </span>
          </div>
        </div>

        {/* Top navbar fade */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-24" style={{ background: "linear-gradient(to bottom, #080E1C, transparent)" }} aria-hidden="true" />
        {/* Bottom fade into slider section */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20" style={{ background: "linear-gradient(to bottom, transparent, #080E1C)" }} aria-hidden="true" />
      </section>

      {/* ── SHOWCASE SLIDER ─────────────────────────────────────────────────────
           Sits directly below the hero, filling the remaining viewport height.
           Single row · 6 cards · 3–4 visible at once · no overlap anywhere.
           Replace gradient placeholders with real <video> clips when ready.
      ──────────────────────────────────────────────────────────────────────── */}
      <section
        style={{
          height: "300px",
          overflow: "hidden",
          position: "relative",
          backgroundColor: "var(--page-bg)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Left edge fade */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10" style={{ width: "120px", background: "linear-gradient(to right, var(--page-bg), transparent)" }} aria-hidden="true" />
        {/* Right edge fade */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10" style={{ width: "120px", background: "linear-gradient(to left, var(--page-bg), transparent)" }} aria-hidden="true" />

        {/* "Created with Zencra" label — sits just above the card row */}
        <p className="absolute top-0 left-0 right-0 text-center text-[10px] font-semibold uppercase tracking-[0.25em] z-10" style={{ color: "#334155", marginTop: "-22px" }}>
          Created with Zencra
        </p>

        {/* Single scrolling row */}
        <div style={{ overflow: "hidden" }}>
          <div
            className="flex"
            style={{
              gap: "20px",
              animation: "slide-left 38s linear infinite",
              width: "max-content",
              paddingLeft: "20px",
            }}
          >
            {sliderRow1Doubled.map((card, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 rounded-2xl cursor-pointer"
                style={{
                  width: "420px",
                  height: "250px",
                  background: card.gradient,
                  border: `1px solid ${card.color}30`,
                  boxShadow: `0 6px 30px rgba(0,0,0,0.45), inset 0 1px 0 ${card.color}15`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  overflow: "hidden",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.03) translateY(-5px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 50px rgba(0,0,0,0.55), 0 0 35px ${card.color}45`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "none";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 30px rgba(0,0,0,0.45), inset 0 1px 0 ${card.color}15`;
                }}
              >
                {/* Inner shimmer */}
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 20%, rgba(255,255,255,0.07) 0%, transparent 55%)" }} />
                {/* Tool name bottom-left */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color, boxShadow: `0 0 10px ${card.color}` }} />
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>{card.tool}</span>
                </div>
                {/* Label badge top-right */}
                <div
                  className="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase"
                  style={{ background: `${card.color}20`, color: card.color, border: `1px solid ${card.color}40` }}
                >
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED CATEGORIES (Horizontal Scroll) ────────────────────────── */}
      <section className="pb-8">
        <div className="container-site mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#475569" }}>
            What will you create?
          </p>
        </div>
        <div className="flex gap-4 overflow-x-auto px-6 pb-4 scrollbar-hide" style={{ paddingLeft: "max(1.5rem, calc((100vw - 1280px) / 2))" }}>
          {featuredItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl transition-all duration-300"
                style={{
                  width: "300px",
                  height: "180px",
                  background: item.gradient,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px) scale(1.02)";
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${item.badgeColor}40, 0 20px 40px rgba(0,0,0,0.5)`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${item.badgeColor}50`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "none";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                {/* Subtle inner glow overlay */}
                <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.04) 0%, transparent 60%)" }} />

                <div className="relative z-10 flex h-full flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${item.badgeColor}20`, border: `1px solid ${item.badgeColor}30` }}
                    >
                      <Icon size={18} style={{ color: item.badgeColor }} />
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: `${item.badgeColor}20`, color: item.badgeColor, border: `1px solid ${item.badgeColor}30` }}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40 mb-1">{item.title}</p>
                    <p className="text-sm text-white/70">{item.subtitle}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── TOOL CATEGORIES ──────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="container-site">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {toolCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl p-6 transition-all duration-300 ${cat.glowClass}`}
                  style={{ background: cat.gradient, minHeight: "220px" }}
                >
                  {/* Animated inner glow on hover */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: `radial-gradient(circle at 30% 30%, ${cat.glow} 0%, transparent 60%)` }}
                  />

                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl"
                          style={{ background: `${cat.color}20`, border: `1px solid ${cat.color}30` }}
                        >
                          <Icon size={22} style={{ color: cat.color }} />
                        </div>
                        <div className="flex items-center gap-2">
                          {cat.badge && (
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: `${cat.color}25`, color: cat.color, border: `1px solid ${cat.color}35` }}
                            >
                              {cat.badge}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{cat.label}</h3>
                      <p className="text-sm text-white/50 mb-5">{cat.description}</p>
                    </div>

                    {/* Tool list */}
                    <div className="flex flex-col gap-2">
                      {cat.tools.map((tool) => (
                        <div
                          key={tool}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors duration-200"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color, boxShadow: `0 0 6px ${cat.color}` }} />
                          <span className="text-sm text-white/70">{tool}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SHOWCASE MEDIA GRID ──────────────────────────────────────────────── */}
      <section className="py-8">
        <div className="container-site mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#475569" }}>
              Community Showcase
            </p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Made with Zencra
            </h2>
          </div>
          <button
            className="text-sm font-medium transition-colors"
            style={{ color: "#2563EB" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#60A5FA")}
            onMouseLeave={e => (e.currentTarget.style.color = "#2563EB")}
          >
            View all →
          </button>
        </div>

        {/* Masonry Grid — 4 columns */}
        <div
          className="container-site"
          style={{ columns: "4", columnGap: "12px" }}
        >
          {showcaseItems.map((item) => (
            <div
              key={item.id}
              className="group relative mb-3 cursor-pointer overflow-hidden rounded-xl transition-all duration-300"
              style={{
                breakInside: "avoid",
                height: `${item.height}px`,
                background: item.gradient,
                border: "1px solid rgba(255,255,255,0.04)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
                (e.currentTarget as HTMLElement).style.zIndex = "10";
                (e.currentTarget as HTMLElement).style.borderColor = `${item.accentColor}60`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${item.accentColor}30`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "none";
                (e.currentTarget as HTMLElement).style.zIndex = "auto";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {/* Gradient overlay at bottom */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: "linear-gradient(to top, rgba(8,14,28,0.95), transparent)" }}
              />

              {/* Content overlay (visible on hover) */}
              <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="text-xs font-bold text-white leading-tight">{item.title}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: `${item.accentColor}25`, color: item.accentColor, border: `1px solid ${item.accentColor}35` }}
                  >
                    {item.label}
                  </span>
                  <span className="text-[10px]" style={{ color: "#64748B" }}>
                    {item.tool}
                  </span>
                </div>
              </div>

              {/* Category dot — always visible */}
              <div className="absolute top-2.5 right-2.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.accentColor, boxShadow: `0 0 8px ${item.accentColor}` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CINEMATIC CTA BANNER ─────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container-site">
          <div
            className="relative overflow-hidden rounded-3xl px-12 py-16 text-center"
            style={{
              background: "linear-gradient(135deg, #0F1A32 0%, #1e3a8a 50%, #0f4038 100%)",
              border: "1px solid rgba(37,99,235,0.25)",
              boxShadow: "0 0 80px rgba(37,99,235,0.15), 0 0 160px rgba(14,165,160,0.08)",
            }}
          >
            {/* Background orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div
                className="absolute"
                style={{
                  width: "400px", height: "400px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)",
                  top: "-50%", left: "-10%", filter: "blur(40px)",
                }}
              />
              <div
                className="absolute"
                style={{
                  width: "300px", height: "300px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(14,165,160,0.25) 0%, transparent 70%)",
                  bottom: "-30%", right: "5%", filter: "blur(40px)",
                }}
              />
            </div>

            <div className="relative z-10">
              <div
                className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em]"
                style={{
                  background: "rgba(37,99,235,0.15)",
                  border: "1px solid rgba(37,99,235,0.3)",
                  color: "#60A5FA",
                }}
              >
                <Sparkles size={12} />
                Phase 1 – Now Building
              </div>
              <h2
                className="mb-4 font-bold text-white"
                style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }}
              >
                Be Part of What&apos;s Coming
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-base" style={{ color: "#94A3B8" }}>
                Zencra Labs is evolving into a full AI creative ecosystem.
                Join early and shape what gets built.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, #2563EB 0%, #0EA5A0 100%)",
                    boxShadow: "0 0 30px rgba(37,99,235,0.4)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(37,99,235,0.6)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(37,99,235,0.4)";
                    (e.currentTarget as HTMLElement).style.transform = "none";
                  }}
                >
                  Get Early Access
                  <ArrowRight size={16} />
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F8FAFC",
                  }}
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "var(--page-bg)", padding: "100px 0 120px" }}>
        <div className="container-site">

          {/* Section label */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.15em", backgroundColor: "rgba(37,99,235,0.1)", padding: "5px 14px", borderRadius: "20px", border: "1px solid rgba(37,99,235,0.2)" }}>
              How It Works
            </span>
          </div>

          {/* Heading */}
          <h2 style={{ textAlign: "center", color: "var(--page-text)", margin: "0 auto 16px", maxWidth: "700px", lineHeight: 1.1 }}>
            From idea to creation<br />
            <span style={{ background: "linear-gradient(135deg,#2563EB,#0EA5A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              in four steps
            </span>
          </h2>
          <p style={{ textAlign: "center", color: "var(--page-text-2)", fontSize: "17px", maxWidth: "540px", margin: "0 auto 72px", lineHeight: 1.6 }}>
            No accounts with 10 different AI tools. No complexity. Just one platform, one credit balance, instant results.
          </p>

          {/* Steps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0", position: "relative" }}>
            {/* Connector line */}
            <div style={{ position: "absolute", top: "36px", left: "12.5%", right: "12.5%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.3) 20%, rgba(14,165,160,0.3) 80%, transparent)", zIndex: 0 }} />

            {[
              { step: "01", icon: "🎯", title: "Choose a Tool", desc: "Pick from image, video, or audio generators — all in one place.", color: "#2563EB" },
              { step: "02", icon: "✍️", title: "Write Your Prompt", desc: "Describe what you want to create. Be as creative or precise as you like.", color: "#A855F7" },
              { step: "03", icon: "⚡", title: "Generate Instantly", desc: "Our platform calls the best AI model for your task and returns results in seconds.", color: "#0EA5A0" },
              { step: "04", icon: "💎", title: "Credits Deducted", desc: "A small credit amount is used per generation. Buy more anytime, no subscriptions required.", color: "#F59E0B" },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center", padding: "0 24px", position: "relative", zIndex: 1 }}>
                {/* Step circle */}
                <div style={{ width: "72px", height: "72px", borderRadius: "50%", margin: "0 auto 24px", backgroundColor: "var(--page-bg-2)", border: `2px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", boxShadow: `0 0 40px ${item.color}18`, position: "relative" }}>
                  {item.icon}
                  <div style={{ position: "absolute", top: "-8px", right: "-8px", width: "22px", height: "22px", borderRadius: "50%", backgroundColor: item.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#fff", fontFamily: "var(--font-display)" }}>
                    {item.step}
                  </div>
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--page-text)", marginBottom: "10px", letterSpacing: "-0.01em" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "var(--page-text-2)", lineHeight: 1.6, maxWidth: "220px", margin: "0 auto" }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div style={{ textAlign: "center", marginTop: "72px" }}>
            <button
              onClick={handleTryFree}
              style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "14px 32px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#2563EB,#0EA5A0)", color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 40px rgba(37,99,235,0.3)", fontFamily: "var(--font-body)" }}>
              <Zap size={16} />
              Start Creating Free
            </button>
            <p style={{ fontSize: "12px", color: "var(--page-text-muted)", marginTop: "12px" }}>
              50 free credits on signup · No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* ── TOOL GRID PREVIEW ───────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "var(--page-bg-2)", padding: "80px 0 100px", borderTop: "1px solid var(--border-subtle)" }}>
        <div className="container-site">
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#A855F7", textTransform: "uppercase", letterSpacing: "0.15em", backgroundColor: "rgba(168,85,247,0.1)", padding: "5px 14px", borderRadius: "20px", border: "1px solid rgba(168,85,247,0.2)" }}>
              Powered By
            </span>
            <h2 style={{ color: "var(--page-text)", margin: "20px auto 12px", maxWidth: "600px", lineHeight: 1.1 }}>
              The world's best<br />
              <span style={{ background: "linear-gradient(135deg,#A855F7,#2563EB)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>AI models, unified</span>
            </h2>
            <p style={{ color: "var(--page-text-2)", fontSize: "16px" }}>One account. One credit balance. Every top AI tool.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
            {[
              { name: "Nano Banana Pro",  cat: "Image",  color: "#2563EB", cost: "2 cr / image",  badge: "HOT" },
              { name: "Kling 3.0",        cat: "Video",  color: "#0EA5A0", cost: "5 cr / 15s",    badge: "HOT" },
              { name: "Google Veo",       cat: "Video",  color: "#60A5FA", cost: "8 cr / 15s",    badge: "NEW" },
              { name: "Runway ML",        cat: "Video",  color: "#A855F7", cost: "6 cr / 15s",    badge: null  },
              { name: "Flux",             cat: "Image",  color: "#EF4444", cost: "2 cr / image",  badge: null  },
              { name: "Seedream",         cat: "Image",  color: "#10B981", cost: "2 cr / image",  badge: null  },
              { name: "HeyGen",           cat: "Video",  color: "#C084FC", cost: "10 cr / video", badge: null  },
              { name: "Seedance",         cat: "Video",  color: "#F59E0B", cost: "5 cr / 15s",    badge: null  },
            ].map((tool, i) => (
              <div key={i} style={{ backgroundColor: "var(--page-bg)", borderRadius: "14px", padding: "18px 20px", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "14px", transition: "all 0.2s", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${tool.color}50`; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${tool.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "18px" }}>
                  {tool.cat === "Image" ? "🖼️" : "🎬"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--page-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tool.name}</span>
                    {tool.badge && <span style={{ fontSize: "8px", fontWeight: 800, color: tool.color, backgroundColor: `${tool.color}18`, padding: "1px 5px", borderRadius: "5px", flexShrink: 0 }}>{tool.badge}</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--page-text-muted)" }}>{tool.cat} · <span style={{ color: tool.color, fontWeight: 600 }}>{tool.cost}</span></div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--page-text-muted)", marginTop: "28px" }}>
            + more tools added every week
          </p>
        </div>
      </section>

    </div>

    {/* Auth Modal */}
    {authModal && <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />}
    </>
  );
}
