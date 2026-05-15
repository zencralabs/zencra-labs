"use client";
// v3 — active state + pathname highlighting
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, X, ChevronDown, ChevronRight, ImageIcon, Music, Wand2, Sparkles, Mic,
  Zap, Film, Layers, LayoutDashboard, User, CreditCard, LogOut,
  UserCircle2, Clapperboard, ArrowUpCircle, ArrowLeft, Cpu,
  Compass, Images, Gem,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/components/auth/AuthContext";
import { getNavModels, getToolsByCategory, type CatalogTool } from "@/lib/tools/catalog";
import { hasFCSAccess } from "@/lib/fcs";

// ─────────────────────────────────────────────────────────────────────────────
// NAV DATA
// ─────────────────────────────────────────────────────────────────────────────

type RightPanel =
  | { type: "models"; heading: string; models: CatalogTool[]; hrefPrefix?: string }
  | { type: "soon"; title: string; desc: string; bullets: string[]; badge?: string };

interface NavFeature {
  icon: React.ElementType;
  label: string;
  desc: string;
  badge?: string | null;
  href: string;
  right: RightPanel;
}

interface NavCategory {
  color: string;
  label: string; // left-panel header
  features: NavFeature[];
}

const imageModels  = getNavModels("image", 7);
const videoModels  = getNavModels("video", 14);
const audioModels  = getToolsByCategory("audio").filter(t => t.id !== "suno-ai").slice(0, 4);
const charModels   = getToolsByCategory("character").slice(0, 3);

const navCategories: Record<string, NavCategory> = {
  Image: {
    color: "#2563EB",
    label: "Image Tools",
    features: [
      {
        icon: ImageIcon, label: "Image Studio", desc: "Generate AI images", badge: "HOT", href: "/studio/image",
        right: { type: "models", heading: "Image Models", models: imageModels },
      },
      {
        icon: Cpu, label: "Creative Director", desc: "AI-guided concept-to-creative workflow", badge: "NEW", href: "/studio/image?mode=creative-director",
        right: { type: "models", heading: "Image Models", models: imageModels, hrefPrefix: "/studio/image?mode=creative-director" },
      },
      {
        icon: Sparkles, label: "Enhance & Upscale", desc: "Topaz-powered 4K boost", badge: "SOON", href: "#",
        right: { type: "soon", title: "Enhance & Upscale", badge: "COMING SOON", desc: "Industry-leading Topaz AI technology to upscale, denoise, and sharpen any image to 4K+ resolution.", bullets: ["Up to 4× resolution boost", "AI noise reduction", "Face & skin recovery", "Batch processing support"] },
      },
      {
        icon: Layers, label: "Face Swap", desc: "Realistic face swaps", badge: "SOON", href: "#",
        right: { type: "soon", title: "Face Swap", badge: "COMING SOON", desc: "Photorealistic face replacement powered by deep learning. Works on portraits, group photos, and any angle.", bullets: ["Multi-face detection", "Expression & lighting match", "HD output quality", "One-click swap"] },
      },
      {
        icon: Wand2, label: "Background Remove", desc: "AI background removal", badge: "SOON", href: "#",
        right: { type: "soon", title: "Background Remove", badge: "COMING SOON", desc: "Precisely remove or replace any background in seconds — perfect edges, no manual masking required.", bullets: ["Hair & fine-detail edge", "Transparent PNG export", "Custom background swap", "Batch removal"] },
      },
      {
        icon: Sparkles, label: "Image to 3D", desc: "Convert images to 3D models", badge: "SOON", href: "#",
        right: { type: "soon", title: "Image to 3D", badge: "COMING SOON", desc: "Convert any 2D image into a fully traversable 3D model or scene. Built for creators, product designers, and storytellers.", bullets: ["NeRF & mesh output", "360° preview", "GLTF / OBJ export", "Scene depth control"] },
      },
    ],
  },
  Video: {
    color: "#0EA5A0",
    label: "Video Tools",
    features: [
      {
        icon: Film, label: "Video Studio", desc: "Generate AI videos", badge: "HOT", href: "/studio/video",
        right: { type: "models", heading: "Video Models", models: videoModels },
      },
      {
        icon: Wand2, label: "Enhance Video", desc: "Topaz upscale & frame boost", badge: "SOON", href: "#",
        right: { type: "soon", title: "Enhance Video", badge: "COMING SOON", desc: "Upscale, denoise, and boost frame rate on any video. Turn 480p footage into cinematic 4K.", bullets: ["Up to 4K upscaling", "Frame interpolation (60fps+)", "AI noise removal", "Colour grade assist"] },
      },
      {
        icon: Mic, label: "Lip Sync", desc: "Sync voice to video", badge: "NEW", href: "/studio/lipsync",
        right: { type: "soon", title: "Studio Lip Sync", badge: "NEW", desc: "Sync any audio to any video with perfectly matched lip movement. Frame-accurate, multi-language, and built for creators.", bullets: ["Frame-accurate lip sync", "Any language supported", "16:9 · 9:16 · 1:1 aspect ratios", "Pro mode with 1.5× quality boost"] },
      },
      {
        icon: Sparkles, label: "Video to Video", desc: "Style transfer & re-render", badge: "SOON", href: "#",
        right: { type: "soon", title: "Video to Video", badge: "COMING SOON", desc: "Re-render any video in a new visual style — anime, cinematic, oil painting, or fully custom aesthetics.", bullets: ["Frame-consistent style", "Custom style prompts", "Preserve motion & depth", "Batch clip processing"] },
      },
      {
        icon: Clapperboard, label: "Text to Short Film", desc: "Script to full short film", badge: "SOON", href: "#",
        right: { type: "soon", title: "Text to Short Film", badge: "CINEMA STUDIO", desc: "Write a prompt or script — Zencra produces a fully sequenced short film with scenes, transitions, and audio.", bullets: ["Auto scene breakdown", "Consistent characters", "AI voiceover + music", "Cinema Studio integration"] },
      },
    ],
  },
  Audio: {
    color: "#C6FF00",
    label: "Audio Tools",
    features: [
      {
        icon: Mic, label: "AI Voiceover", desc: "Generate speech from text", badge: "NEW", href: "/studio/audio",
        right: { type: "models", heading: "Voice Models", models: audioModels },
      },
      {
        icon: Music, label: "AI Music", desc: "Create full tracks", badge: "SOON", href: "#",
        right: { type: "soon", title: "AI Music", badge: "COMING SOON", desc: "Generate royalty-free original music in any genre or mood. Full stems, custom lyrics, infinite variations.", bullets: ["Any genre & tempo", "Custom lyrics support", "Stem export (vocals, drums…)", "Powered by Suno AI"] },
      },
      {
        icon: Zap, label: "Voice Clone", desc: "Clone any voice", badge: "SOON", href: "#",
        right: { type: "soon", title: "Voice Clone", badge: "COMING SOON", desc: "Clone a voice from a 30-second sample. Use it for narration, characters, and branded content.", bullets: ["30-second sample enough", "Emotion & tone control", "Multilingual output", "ElevenLabs & Kits.ai powered"] },
      },
      {
        icon: Music, label: "Sound Effects", desc: "Generate custom SFX", badge: "SOON", href: "#",
        right: { type: "soon", title: "Sound Effects", badge: "COMING SOON", desc: "Generate precise custom sound effects from a text description. Film-ready SFX in one prompt.", bullets: ["Cinematic & ambient SFX", "Frame-accurate timing", "No rights clearance needed", "Export WAV / MP3"] },
      },
    ],
  },
  Character: {
    color: "#F59E0B",
    label: "Character Tools",
    features: [
      {
        icon: UserCircle2, label: "AI Influencer", desc: "Build a persistent digital human", href: "/studio/character/ai-influencer",
        right: { type: "soon", title: "AI Influencer Builder", badge: "NEW", desc: "Create a persistent digital human with a locked identity. Generate content packs — looks, scenes, poses, social formats — all anchored to the same face, every time.", bullets: ["Identity lock system", "5 content pack types", "Face-consistent generation", "Social-ready formats"] },
      },
      {
        icon: Layers, label: "Face Swap", desc: "Seamless image face swap", badge: "SOON", href: "#",
        right: { type: "soon", title: "Face Swap", badge: "COMING SOON", desc: "Swap faces in images with photorealistic accuracy. Single and group photos supported.", bullets: ["Multi-face swap", "Expression matching", "Lighting preservation", "HD output"] },
      },
      {
        icon: Wand2, label: "Character Swap", desc: "Replace characters across scenes", badge: "SOON", href: "#",
        right: { type: "soon", title: "Character Swap", badge: "COMING SOON", desc: "Replace the main character across an entire video — consistent look, motion-aware, cinematic output.", bullets: ["Full-body replacement", "Motion tracking", "Scene-consistent appearance", "Works on AI & real clips"] },
      },
      {
        icon: Film, label: "Video Face Swap", desc: "Motion-tracked face swap in video", badge: "SOON", href: "#",
        right: { type: "soon", title: "Video Face Swap", badge: "COMING SOON", desc: "Frame-accurate face swap for video with natural movement, blinking, and expression transfer.", bullets: ["60fps tracking", "Occlusion handling", "Natural blink & expressions", "Export 1080p+"] },
      },
      {
        icon: Sparkles, label: "AI Stylist", desc: "AI wardrobe transformation", badge: "PLANNED", href: "#",
        right: { type: "soon", title: "AI Stylist", badge: "PLANNED", desc: "Transform any outfit or style on a person — virtual try-on, fashion shoots, and wardrobe exploration.", bullets: ["Virtual try-on", "Any garment or style", "Realistic fabric physics", "Brand campaign ready"] },
      },
      {
        icon: Clapperboard, label: "Recast Studio", desc: "Recast any video character", badge: "PLANNED", href: "#",
        right: { type: "soon", title: "Recast Studio", badge: "PLANNED", desc: "Replace any actor or character in an existing scene with your AI character — for film, ads, and content.", bullets: ["Scene-level replacement", "Voice + face sync", "Works on licensed clips", "Cinema Studio integration"] },
      },
    ],
  },
};

type DropdownKey = keyof typeof navCategories;

const navLinks: Array<{ label: string; href: string; hasDropdown: boolean; dropdownKey?: DropdownKey }> = [
  { label: "Explore",       href: "/",             hasDropdown: false },
  { label: "Image Studio",  href: "/studio/image", hasDropdown: true,  dropdownKey: "Image"     },
  { label: "Video Studio",  href: "/studio/video", hasDropdown: true,  dropdownKey: "Video"     },
  { label: "Audio Studio",  href: "/studio/audio", hasDropdown: true,  dropdownKey: "Audio"     },
  { label: "Character",     href: "/studio/character", hasDropdown: true,  dropdownKey: "Character" },
  { label: "Gallery",       href: "/gallery",      hasDropdown: false },
  { label: "Pricing",       href: "#",             hasDropdown: false },
];

// Premium icon metadata for plain mobile nav rows (Explore, Gallery, Pricing).
// Keeps icon + color co-located so the map stays clean.
const MOBILE_PLAIN_ICON: { [key: string]: { Icon: React.ElementType; color: string } | undefined } = {
  Explore: { Icon: Compass, color: "#A855F7" },
  Gallery: { Icon: Images,  color: "#0EA5A0" },
  Pricing: { Icon: Gem,     color: "#D4AF37" },
};

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function RightPanelContent({ panel, color, studioKey, onClose }: { panel: RightPanel; color: string; studioKey?: DropdownKey; onClose?: () => void }) {
  if (panel.type === "models") {
    const STUDIO_ROUTES: Partial<Record<DropdownKey, string>> = {
      Image: "/studio/image",
      Video: "/studio/video",
      Audio: "/studio/audio",
    };
    const studioBase = studioKey ? (STUDIO_ROUTES[studioKey] ?? "#") : "#";
    const paramName = studioKey === "Video" ? "tool" : "model";
    return (
      <div className="flex flex-col h-full">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${color}80` }}>
          {panel.heading}
        </p>
        <div className="flex flex-col gap-0.5">
          {panel.models.map((model) => {
            const isSoon = model.status !== "active";
            // hrefPrefix already contains the base + any existing query params (e.g. ?mode=creative-director)
            // so we join with & rather than ? to avoid double question marks.
            const href = !isSoon
              ? panel.hrefPrefix
                ? `${panel.hrefPrefix}&${paramName}=${model.id}`
                : `${studioBase}?${paramName}=${model.id}`
              : "#";
            return (
              <Link
                key={model.id}
                href={href}
                onClick={() => onClose?.()}
                className="flex items-start gap-3 rounded-xl px-3 py-3 transition-all duration-150"
                onMouseEnter={e => (e.currentTarget.style.background = `${color}12`)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: isSoon ? "#374151" : color,
                    boxShadow: isSoon ? "none" : `0 0 7px ${color}`,
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-white">{model.displayName}</p>
                    {isSoon ? (
                      <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: "rgba(55,65,81,0.8)", color: "#6B7280" }}>
                        {model.status === "planned" ? "PLANNED" : "SOON"}
                      </span>
                    ) : model.badge ? (
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${color}20`, color }}>
                        {model.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{model.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Coming soon panel
  return (
    <div className="flex flex-col gap-3">
      {panel.badge && (
        <span
          className="inline-flex w-fit rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em]"
          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
        >
          {panel.badge}
        </span>
      )}
      <h3 className="text-base font-bold leading-tight" style={{ color: "#F8FAFC" }}>{panel.title}</h3>
      <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>{panel.desc}</p>
      <ul className="flex flex-col gap-1.5 mt-1">
        {panel.bullets.map(b => (
          <li key={b} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}80` }} />
            <span className="text-xs" style={{ color: "#94A3B8" }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP DROPDOWN — two-panel with active-feature state
// ─────────────────────────────────────────────────────────────────────────────

function DropdownMenu({ category, onClose }: { category: DropdownKey; onClose: () => void }) {
  const data = navCategories[category];
  // Default to first item so right panel is always visible on open
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const activeFeat = data.features[activeIdx];

  return (
    <>
    <style>{`@keyframes ddOpen{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <div
      className="absolute top-full left-0 z-[200] overflow-hidden rounded-2xl"
      style={{
        width: "520px",
        background: "rgba(8,14,28,0.97)",
        border: `1px solid ${data.color}22`,
        backdropFilter: "blur(24px)",
        boxShadow: `0 28px 72px rgba(0,0,0,0.75), 0 0 40px ${data.color}14`,
        animation: "ddOpen 180ms ease-out forwards",
      }}
    >
      <div className="grid grid-cols-[220px_1fr]">

        {/* ── LEFT PANEL — feature list ──────────────────────────────────── */}
        <div
          className="border-r flex flex-col"
          style={{ borderColor: `${data.color}14`, padding: "14px 10px" }}
        >
          <p
            className="px-3 mb-3 font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: "0.2em", color: `${data.color}70` }}
          >
            {data.label}
          </p>
          <div className="flex flex-col gap-1">
            {data.features.map((feat, idx) => {
              const Icon     = feat.icon;
              const isActive = idx === activeIdx;
              const isSoon   = feat.badge === "SOON" || feat.badge === "PLANNED";
              return (
                <Link
                  key={feat.label}
                  href={feat.href}
                  onClick={onClose}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className="group flex items-center gap-3 rounded-xl transition-all duration-150"
                  style={{
                    padding: "11px 13px",
                    background: isActive ? `${data.color}16` : "transparent",
                    color: isActive ? "#F8FAFC" : "#94A3B8",
                    opacity: isSoon && !isActive ? 0.72 : 1,
                  }}
                >
                  {/* Icon box */}
                  <div
                    className="flex shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                    style={{
                      width: 34, height: 34,
                      background: isActive ? `${data.color}22` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? data.color + "35" : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    <Icon size={15} style={{ color: isActive ? data.color : "#64748B" }} />
                  </div>

                  {/* Label + desc */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.2 }}>{feat.label}</span>
                      {feat.badge && (
                        <span
                          className="rounded-full font-bold uppercase"
                          style={{
                            fontSize: 8,
                            padding: "2px 5px",
                            background: isSoon ? "rgba(55,65,81,0.7)" : `${data.color}22`,
                            color:      isSoon ? "#6B7280" : data.color,
                          }}
                        >
                          {feat.badge}
                        </span>
                      )}
                    </div>
                    <span
                      className="mt-0.5 block"
                      style={{
                        fontSize: 12,
                        color: isActive ? `${data.color}90` : "#475569",
                        lineHeight: 1.3,
                      }}
                    >
                      {feat.desc}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL — always visible, animates on item change ─────── */}
        <div
          className="flex flex-col"
          key={activeIdx}
          style={{
            padding: "16px",
            minHeight: "240px",
            animation: "ddOpen 150ms ease-out forwards",
          }}
        >
          <RightPanelContent panel={activeFeat.right} color={data.color} studioKey={category} onClose={onClose} />
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${data.color}35, transparent)` }} />
    </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER AVATAR DROPDOWN (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function UserDropdown({ user, onLogout }: { user: { name: string; email: string; credits: number; plan: string; role?: string }; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pct = Math.round((user.credits / 100) * 100);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: "9px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "14px", padding: "7px 12px 7px 7px", cursor: "pointer",
          transition: "background 0.2s, border-color 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
      >
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: "linear-gradient(135deg,#2563EB,#A855F7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "12px", color: "#fff", flexShrink: 0,
          boxShadow: "0 0 12px rgba(37,99,235,0.3)",
        }}>
          {user.name[0].toUpperCase()}
        </div>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#F8FAFC" }}>{user.name.split(" ")[0]}</span>
        <ChevronDown size={13} style={{ color: "#64748B", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0, width: "240px",
          background: "rgba(8,14,28,0.98)", border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "16px", padding: "8px", zIndex: 300,
          boxShadow: "0 24px 64px rgba(0,0,0,0.65)", backdropFilter: "blur(20px)",
        }}>
          <div style={{ padding: "12px 14px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: "6px" }}>
            <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 3px", color: "#F8FAFC" }}>{user.name}</p>
            <p style={{ fontSize: "12px", color: "#64748B", margin: "0 0 12px" }}>{user.email}</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", color: "#64748B" }}>Credits</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#60A5FA" }}>{user.credits.toLocaleString()}</span>
            </div>
            <div style={{ height: "5px", borderRadius: "10px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: "10px", background: "linear-gradient(90deg,#2563EB,#0EA5A0)", transition: "width 0.4s" }} />
            </div>
            <p style={{ fontSize: "11px", color: "#64748B", marginTop: "5px" }}>{user.plan} plan</p>
          </div>
          {[
            { icon: LayoutDashboard, label: user.role === "admin" ? "Admin Hub" : "Dashboard", href: user.role === "admin" ? "/hub" : "/dashboard" },
            { icon: User,            label: "Profile",      href: "/dashboard/profile"      },
            { icon: CreditCard,      label: "Subscription", href: "/dashboard/subscription" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 13px", borderRadius: "10px", color: "#94A3B8", fontSize: "14px", textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
              >
                <Icon size={15} />{item.label}
                <ChevronRight size={13} style={{ marginLeft: "auto" }} />
              </Link>
            );
          })}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
          <button
            onClick={() => { onLogout(); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "11px", padding: "10px 13px", borderRadius: "10px", color: "#94A3B8", fontSize: "14px", width: "100%", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE MENU — accordion with feature sub-panel
// ─────────────────────────────────────────────────────────────────────────────

function MobileMenu({
  onClose,
  onAuthModal,
  onOpenPricing,
}: {
  onClose: () => void;
  onAuthModal: (mode: "login" | "signup") => void;
  onOpenPricing?: () => void;
}) {
  const router = useRouter();
  // Which section is expanded (null = top level)
  const [section, setSection]   = useState<DropdownKey | null>(null);
  // Which feature detail panel is open (null = feature list)
  const [detail, setDetail]     = useState<number | null>(null);

  function openSection(key: DropdownKey) {
    setSection(key);
    setDetail(null);
  }
  function back() {
    if (detail !== null) { setDetail(null); return; }
    setSection(null);
  }
  /** Close all mobile state and the drawer in one call. Use for all navigating actions. */
  function handleNavigate() {
    setSection(null);
    setDetail(null);
    onClose();
  }

  const sectionData = section ? navCategories[section] : null;

  return (
    <div
      className="border-t lg:hidden"
      style={{
        borderColor: "var(--border-subtle)",
        background: "rgba(8,14,28,0.98)",
        backdropFilter: "blur(20px)",
        maxHeight: "calc(100vh - 76px)",
        overflowY: "auto",
      }}
    >
      {/* ── Back header when inside a section ── */}
      {section && (
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: `${sectionData!.color}15` }}
        >
          <button
            onClick={back}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ background: "none", border: "none", cursor: "pointer", color: sectionData!.color }}
          >
            <ArrowLeft size={15} />
            {detail !== null ? sectionData!.features[detail].label : "Back"}
          </button>
          {detail === null && (
            <span className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{section}</span>
          )}
          {detail !== null && (
            <span className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{sectionData!.label}</span>
          )}
        </div>
      )}

      {/* ── LEVEL 1: top-level nav links ── */}
      {!section && (
        <div className="py-3 px-3">
          <ul className="flex flex-col gap-0.5">
            {navLinks.map((link) => {
              const hasSection = link.hasDropdown && link.dropdownKey && link.dropdownKey in navCategories;
              const cat = hasSection ? navCategories[link.dropdownKey!] : null;
              // Premium icon for plain rows (Explore, Gallery, Pricing)
              const plainMeta = !hasSection ? MOBILE_PLAIN_ICON[link.label] : undefined;
              const PlainIcon = plainMeta?.Icon ?? null;
              return (
                <li key={link.href + link.label}>
                  {hasSection ? (
                    <button
                      onClick={() => openSection(link.dropdownKey!)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 font-medium transition-colors"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "16px" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${cat!.color}14`, border: `1px solid ${cat!.color}22`, boxShadow: `0 0 8px ${cat!.color}18` }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat!.color, boxShadow: `0 0 6px ${cat!.color}` }}
                        />
                      </div>
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronRight size={14} style={{ color: "#475569" }} />
                    </button>
                  ) : link.label === "Pricing" ? (
                    /* Pricing opens the overlay — no navigation */
                    <button
                      onClick={() => { handleNavigate(); onOpenPricing?.(); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 font-medium"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "16px", textAlign: "left" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#F8FAFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#94A3B8"}
                    >
                      {PlainIcon && plainMeta && (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${plainMeta.color}14`, border: `1px solid ${plainMeta.color}22`, boxShadow: `0 0 8px ${plainMeta.color}18` }}
                        >
                          <PlainIcon size={13} style={{ color: plainMeta.color }} />
                        </div>
                      )}
                      <span className="flex-1">{link.label}</span>
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={handleNavigate}
                      className="flex items-center gap-3 rounded-xl px-3 py-3.5 font-medium"
                      style={{ color: "#94A3B8", fontSize: "16px" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#F8FAFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#94A3B8"}
                    >
                      {PlainIcon && plainMeta && (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${plainMeta.color}14`, border: `1px solid ${plainMeta.color}22`, boxShadow: `0 0 8px ${plainMeta.color}18` }}
                        >
                          <PlainIcon size={13} style={{ color: plainMeta.color }} />
                        </div>
                      )}
                      <span className="flex-1">{link.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}

          </ul>

          {/* Auth buttons */}
          <div className="mt-4 flex flex-col gap-2 px-1">
            {/* Future Cinema Studio — lives here so width = Login/Try Free (same px-1 container) */}
            <Link
              href="/studio/cinema"
              onClick={handleNavigate}
              className="fcs-nav-link flex w-full items-center gap-3"
              style={{ padding: "12px 16px", borderRadius: "12px" }}
            >
              <Clapperboard size={15} style={{ color: "#D4AF37", flexShrink: 0 }} />
              <span className="fcs-text" style={{ flex: 1, fontSize: "16px" }}>Future Cinema Studio</span>
              <span className="fcs-soon">SOON</span>
            </Link>
            <button
              onClick={() => { handleNavigate(); router.push("/login"); }}
              className="block text-center rounded-xl font-medium w-full transition-colors"
              style={{ padding: "12px", fontSize: "16px", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)", background: "none", cursor: "pointer" }}
            >
              Login
            </button>
            <Link
              href="/studio/image"
              onClick={handleNavigate}
              className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white w-full"
              style={{ padding: "13px 16px", fontSize: "16px", background: "linear-gradient(135deg,#2563EB 0%,#0EA5A0 100%)", textDecoration: "none" }}
            >
              <Zap size={14} /> Try Free
            </Link>
          </div>
        </div>
      )}

      {/* ── LEVEL 2: feature list for a section ── */}
      {section && detail === null && sectionData && (
        <div className="py-3 px-3">
          <div className="flex flex-col gap-0.5">
            {sectionData.features.map((feat, idx) => {
              const Icon   = feat.icon;
              const isSoon = feat.badge === "SOON" || feat.badge === "PLANNED";
              return (
                <button
                  key={feat.label}
                  onClick={() => setDetail(idx)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 transition-all duration-150"
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", color: isSoon ? "#64748B" : "#94A3B8", fontSize: "16px" }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${sectionData.color}10`)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${sectionData.color}12`, border: `1px solid ${sectionData.color}20` }}
                  >
                    <Icon size={14} style={{ color: sectionData.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: "#F8FAFC" }}>{feat.label}</span>
                      {feat.badge && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase"
                          style={{ background: isSoon ? "rgba(55,65,81,0.7)" : `${sectionData.color}22`, color: isSoon ? "#6B7280" : sectionData.color }}
                        >
                          {feat.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "#475569" }}>{feat.desc}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: "#475569", flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEVEL 3: right panel detail for a feature ── */}
      {section && detail !== null && sectionData && (
        <div className="py-4 px-4">
          <RightPanelContent panel={sectionData.features[detail].right} color={sectionData.color} studioKey={section ?? undefined} onClose={handleNavigate} />

          {/* Link to feature if it's active */}
          {sectionData.features[detail].href !== "#" && (
            <Link
              href={sectionData.features[detail].href}
              onClick={handleNavigate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl font-semibold"
              style={{ padding: "13px 16px", fontSize: "16px", background: `linear-gradient(135deg, ${sectionData.color}, ${sectionData.color}bb)`, color: "#fff", textDecoration: "none" }}
            >
              Open {sectionData.features[detail].label}
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDITS PILL — shared style constant
//
// Both the loading skeleton and the real authenticated credits pill must
// render with IDENTICAL outer element type, href, and style so that React
// hydration never sees a structural mismatch between the SSR output and the
// first client render (which may already have a cached user from localStorage).
// ─────────────────────────────────────────────────────────────────────────────

const CREDITS_PILL_HREF = "/hub/credits";

const creditsPillStyle: React.CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  gap:            "9px",
  background:     "linear-gradient(135deg, rgba(10,18,52,0.96) 0%, rgba(5,10,34,0.98) 100%)",
  border:         "1px solid rgba(56,189,248,0.20)",
  borderRadius:   "24px",
  padding:        "7px 14px 7px 8px",
  textDecoration: "none",
  cursor:         "pointer",
  transition:     "all 0.25s ease",
  position:       "relative",
  overflow:       "hidden",
  backdropFilter: "blur(16px)",
  boxShadow:      "0 0 20px rgba(37,99,235,0.10), 0 2px 8px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)",
  flexShrink:     0,
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH LOADING SKELETON
// Shown in the desktop action slot while auth state is resolving.
// Matches the approximate dimensions of the credits pill + avatar pill so
// there is no layout shift when the real controls appear.
// ─────────────────────────────────────────────────────────────────────────────

function NavbarAuthSkeleton() {
  return (
    <div className="hidden items-center gap-3 lg:flex">
      {/* Credits pill skeleton — same href, style, and children SHAPE as the real
          credits pill so React hydration sees no structural mismatch between the
          SSR output and the first client render (which may already have a cached
          user from localStorage via AuthContext's provisional-user initializer). */}
      <Link href={CREDITS_PILL_HREF} className="cr-pill" style={creditsPillStyle}>
        {/* Gold zap icon — sits directly in pill, no box wrapper */}
        <Zap size={14} style={{ color: "#D4AF37", filter: "drop-shadow(0 0 4px rgba(212,175,55,0.85))", flexShrink: 0 }} />
        {/* Number — suppressHydrationWarning lets placeholder text differ from real value */}
        <span suppressHydrationWarning style={{ fontSize: "14px", fontWeight: 700, color: "#DBEAFE", letterSpacing: "-0.02em", minWidth: 46, display: "inline-block" }}>
          •••••
        </span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#7DD3FC", letterSpacing: "0.02em", marginLeft: "-4px" }}>cr</span>
      </Link>
      {/* Avatar + name pill placeholder */}
      <div
        style={{
          width: 116,
          height: 36,
          borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN NAVBAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Routes where the Navbar must not render.
 * Matches the isolated-route set in FooterConditional — keep both in sync.
 */
const NAVBAR_HIDDEN_ROUTES = ["/waitlist", "/login", "/signup"];

export function Navbar({ onOpenPricing }: { onOpenPricing?: () => void } = {}) {
  const [scrolled, setScrolled]             = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  // mounted gates all client-only auth UI. On the server (and on the first
  // client render before hydration) this is false, so we always render the
  // skeleton. After hydration useEffect flips it true and the real credits
  // pill appears — eliminating the SSR/client content mismatch that caused
  // React hydration errors when localStorage held a cached user.
  const [mounted, setMounted]               = useState(false);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router   = useRouter();

  // ── All hooks must run unconditionally (Rules of Hooks) ──────────────────
  // The hidden-route early return lives AFTER every hook so that hook count
  // never varies between renders regardless of current pathname.

  // Flip mounted after hydration — gates auth UI to client-only render.
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openDropdown = useCallback((key: DropdownKey) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setActiveDropdown(key);
  }, []);

  const closeDropdownDelayed = useCallback(() => {
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 80);
  }, []);

  const cancelClose = useCallback(() => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveDropdown(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setActiveDropdown(null);
  }, [pathname]);

  // Isolated full-screen routes (e.g. /waitlist) must not show the Navbar.
  // This return is intentionally placed AFTER all hooks.
  if (NAVBAR_HIDDEN_ROUTES.some(r => pathname.startsWith(r))) return null;

  return (
    <>
      {/* ── Credits pill hover styles ── */}
      <style>{`
        .cr-pill:hover {
          background: linear-gradient(135deg, rgba(15,28,72,0.98) 0%, rgba(8,16,52,0.99) 100%) !important;
          border-color: rgba(56,189,248,0.40) !important;
          box-shadow: 0 0 32px rgba(56,189,248,0.22), 0 0 60px rgba(37,99,235,0.12), 0 4px 16px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.07) !important;
          transform: translateY(-1px) !important;
        }
      `}</style>
      <header
        ref={navRef}
        className="fixed top-0 z-[1100] w-full transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "var(--page-bg)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: "none",
          boxShadow: scrolled ? "0 18px 50px rgba(0,0,0,0.38)" : "none",
        }}
      >
        <div className="container-site">
          <nav className="flex h-[76px] items-center justify-between">

            {/* Logo — size="lg" for increased presence */}
            <Logo size="lg" />

            {/* ── Desktop nav ── */}
            <ul className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => {
                const isDropdown = link.hasDropdown && link.dropdownKey && link.dropdownKey in navCategories;
                const dropKey    = link.dropdownKey as DropdownKey;
                const catData    = isDropdown ? navCategories[dropKey] : null;
                const isOpen     = activeDropdown === dropKey;
                // Active = dropdown is open OR pathname starts with the link's href (non-root)
                const isPathActive = link.href !== "/" && link.href !== "#"
                  ? pathname.startsWith(link.href)
                  : pathname === link.href;
                // For dropdown items: active if any feature href matches current path
                const isCatActive = isDropdown && catData
                  ? catData.features.some(f => f.href !== "#" && pathname.startsWith(f.href))
                  : false;
                const isActive = isOpen || isCatActive;

                return (
                  <li
                    key={link.href + link.label}
                    className="relative"
                    style={isOpen ? { zIndex: 10 } : undefined}
                    onMouseEnter={() => isDropdown && openDropdown(dropKey)}
                    onMouseLeave={() => isDropdown && closeDropdownDelayed()}
                  >
                    {/* Wrap in button for dropdown items so click also opens (touch laptops) */}
                    {isDropdown ? (
                      <button
                        onClick={() => isOpen ? setActiveDropdown(null) : openDropdown(dropKey)}
                        className="flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200"
                        style={{
                          padding: "10px 15px",
                          fontSize: "16px",
                          letterSpacing: "-0.01em",
                          background: isActive && catData ? `${catData.color}12` : "none",
                          border: "none",
                          cursor: "pointer",
                          color: isActive && catData ? catData.color : "#94A3B8",
                          textShadow: isActive && catData ? `0 0 16px ${catData.color}80` : "none",
                        }}
                      >
                        {link.label}
                        <ChevronDown
                          size={13}
                          className="transition-transform duration-200"
                          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                        />
                      </button>
                    ) : link.label === "Pricing" ? (
                      /* Pricing opens the overlay — no route navigation */
                      <button
                        onClick={onOpenPricing}
                        className="flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200"
                        style={{
                          padding: "10px 15px",
                          fontSize: "16px",
                          letterSpacing: "-0.01em",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94A3B8",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        href={link.href}
                        className="flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200"
                        style={{
                          padding: "10px 15px",
                          fontSize: "16px",
                          letterSpacing: "-0.01em",
                          color: isPathActive ? "#F8FAFC" : "#94A3B8",
                          background: isPathActive ? "rgba(255,255,255,0.06)" : "transparent",
                          borderRadius: 8,
                        }}
                        onMouseEnter={e => { if (!isPathActive) (e.currentTarget as HTMLElement).style.color = "#F8FAFC"; }}
                        onMouseLeave={e => { if (!isPathActive) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                      >
                        {link.label}
                      </Link>
                    )}

                    {isDropdown && isOpen && catData && (
                      /* Positioned wrapper — covers the 8px gap between nav button and panel.
                         paddingTop acts as an invisible bridge so onMouseEnter fires before
                         the 180ms closeDropdownDelayed fires, keeping the dropdown alive. */
                      <div
                        style={{ position: "absolute", top: "100%", left: 0, paddingTop: "8px", zIndex: 200 }}
                        onMouseEnter={cancelClose}
                        onMouseLeave={() => setActiveDropdown(null)}
                      >
                        <DropdownMenu category={dropKey} onClose={() => setActiveDropdown(null)} />
                      </div>
                    )}
                  </li>
                );
              })}

              {/* Future Cinema Studio — gold metallic premium */}
              <li className="relative ml-1">
                <style>{`
                  @keyframes fcsShimmer {
                    0%   { background-position: 200% center; }
                    100% { background-position: -200% center; }
                  }
                  @keyframes fcsGlide {
                    0%   { left: -60%; opacity: 0; }
                    8%   { opacity: 1; }
                    92%  { opacity: 1; }
                    100% { left: 120%; opacity: 0; }
                  }
                  .fcs-nav-link {
                    position: relative;
                    overflow: hidden;
                    border-radius: 10px;
                    background: rgba(212,175,55,0.06);
                    border: 1px solid rgba(212,175,55,0.22);
                    transition: background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
                  }
                  /* Film perforation dots — subtle cinematic backplate */
                  .fcs-nav-link::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background-image: radial-gradient(circle, rgba(80,72,32,0.55) 1px, transparent 1px);
                    background-size: 7px 7px;
                    opacity: 0.26;
                    pointer-events: none;
                    border-radius: inherit;
                  }
                  /* Animated gold shimmer sweep */
                  .fcs-nav-link::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -60%;
                    width: 52%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(212,175,55,0.18), transparent);
                    animation: fcsGlide 3.8s ease-in-out infinite;
                    pointer-events: none;
                  }
                  .fcs-nav-link:hover {
                    background: rgba(212,175,55,0.11);
                    border-color: rgba(212,175,55,0.42);
                    box-shadow: 0 0 18px rgba(212,175,55,0.14);
                  }
                  .fcs-nav-link:hover::after {
                    animation-play-state: paused;
                  }
                  .fcs-text {
                    background: linear-gradient(90deg, #F9E7A1, #D4AF37, #FFF2B8, #B8892E, #D4AF37, #F9E7A1);
                    background-size: 300% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: fcsShimmer 4.5s linear infinite;
                    font-size: 16px;
                    font-weight: 500;
                    letter-spacing: -0.01em;
                  }
                  .fcs-nav-link:hover .fcs-text {
                    animation-play-state: paused;
                    filter: brightness(1.12);
                  }
                  .fcs-soon {
                    background: rgba(212,175,55,0.12);
                    border: 1px solid rgba(212,175,55,0.38);
                    color: #C9A227;
                    font-size: 8px;
                    font-weight: 700;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    padding: 2px 7px;
                    border-radius: 20px;
                    flex-shrink: 0;
                  }
                `}</style>
                <Link
                  href="/studio/cinema"
                  className="fcs-nav-link inline-flex items-center gap-1.5"
                  style={{ padding: "8px 13px" }}
                >
                  <Clapperboard size={13} style={{ color: "#D4AF37", flexShrink: 0 }} />
                  <span className="fcs-text">Future Cinema Studio</span>
                  <span className="fcs-soon">SOON</span>
                </Link>
              </li>
            </ul>

            {/* ── Desktop actions ── */}
            {/*
              Rendering priority (after mounted):
                1. !mounted              →  skeleton (SSR + first client paint — prevents hydration mismatch)
                2. loading && !user      →  skeleton (auth still resolving, no cached state)
                3. user                  →  credits pill + FCS badge + avatar dropdown
                4. !user                 →  Login + Try Free  (only after loading=false)

              The `mounted` gate is the critical fix: AuthContext seeds `user` from
              localStorage on the client before React hydrates, so without this gate
              the server renders skeleton and the client renders the real credits pill,
              producing a hydration mismatch and re-render flicker.
            */}
            {!mounted || (loading && !user) ? (
              <NavbarAuthSkeleton />
            ) : user ? (
              <div className="hidden items-center gap-3 lg:flex">
                {/* Credits pill — uses shared href + style to match the skeleton exactly */}
                <Link
                  href={CREDITS_PILL_HREF}
                  className="cr-pill"
                  style={creditsPillStyle}
                >
                  {/* Gold zap icon — sits directly in pill, no box wrapper */}
                  <Zap size={14} style={{ color: "#D4AF37", filter: "drop-shadow(0 0 4px rgba(212,175,55,0.85))", flexShrink: 0 }} />
                  {/* Number — suppressHydrationWarning silences placeholder vs real diff */}
                  <span suppressHydrationWarning style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#DBEAFE", letterSpacing: "-0.01em", lineHeight: 1, minWidth: 46, display: "inline-block" }}>
                    {user.credits.toLocaleString()}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "12px", fontWeight: 700, color: "#7DD3FC", letterSpacing: "-0.01em", lineHeight: 1, marginLeft: "-4px" }}>cr</span>
                </Link>
                {/* FCS Active pill — clickable Link to Cinema Studio */}
                {hasFCSAccess(user) && (
                  <Link
                    href="/studio/cinema"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 13px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#0EA5A0",
                      background: "rgba(14,165,160,0.12)",
                      border: "1px solid rgba(14,165,160,0.40)",
                      boxShadow: "0 0 14px rgba(14,165,160,0.22)",
                      textDecoration: "none",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.2)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 22px rgba(14,165,160,0.35)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,165,160,0.12)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 14px rgba(14,165,160,0.22)"; }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        backgroundColor: "#0EA5A0",
                        boxShadow: "0 0 7px #0EA5A0",
                        flexShrink: 0,
                        display: "inline-block",
                        animation: "fcsPulse 2s ease-in-out infinite",
                      }}
                    />
                    FCS Active
                    <style>{`@keyframes fcsPulse { 0%,100%{opacity:1} 50%{opacity:0.65} }`}</style>
                  </Link>
                )}
                <UserDropdown user={user} onLogout={logout} />
              </div>
            ) : (
              /* loading=false && user=null → genuinely signed out */
              <div className="hidden items-center gap-2 lg:flex">
                {/* Login — premium glass pill */}
                <Link
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "118px",
                    height: "44px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(59,130,246,0.28)",
                    backdropFilter: "blur(8px)",
                    cursor: "pointer",
                    color: "#93C5FD",
                    fontSize: "15px",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease",
                    flexShrink: 0,
                    textDecoration: "none",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(59,130,246,0.10)";
                    b.style.borderColor = "rgba(59,130,246,0.55)";
                    b.style.boxShadow = "0 0 18px rgba(59,130,246,0.22)";
                    b.style.color = "#BFDBFE";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.background = "rgba(255,255,255,0.05)";
                    b.style.borderColor = "rgba(59,130,246,0.28)";
                    b.style.boxShadow = "none";
                    b.style.color = "#93C5FD";
                  }}
                >
                  Login
                </Link>

                {/* Try Free — Zencra blue/cyan gradient pill */}
                <Link
                  href="/studio/image"
                  className="inline-flex items-center justify-center gap-2 text-white"
                  style={{
                    width: "132px",
                    height: "44px",
                    borderRadius: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 45%, #0891B2 100%)",
                    border: "1px solid rgba(37,99,235,0.28)",
                    boxShadow: "0 0 22px rgba(37,99,235,0.32), inset 0 1px 0 rgba(255,255,255,0.10)",
                    textDecoration: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "box-shadow 0.2s ease, transform 0.2s ease, filter 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.boxShadow = "0 0 40px rgba(37,99,235,0.58), inset 0 1px 0 rgba(255,255,255,0.10)";
                    b.style.transform = "translateY(-1px)";
                    b.style.filter = "brightness(1.08)";
                  }}
                  onMouseLeave={e => {
                    const b = e.currentTarget as HTMLElement;
                    b.style.boxShadow = "0 0 22px rgba(37,99,235,0.32), inset 0 1px 0 rgba(255,255,255,0.10)";
                    b.style.transform = "none";
                    b.style.filter = "";
                  }}
                >
                  <Zap size={14} strokeWidth={2.5} />
                  Try Free
                </Link>
              </div>
            )}

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors lg:hidden"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F8FAFC" }}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </nav>

          {/* Mobile menu */}
          {mobileOpen && (
            <MobileMenu
              onClose={() => setMobileOpen(false)}
              onAuthModal={() => { setMobileOpen(false); router.push("/login"); }}
              onOpenPricing={onOpenPricing}
            />
          )}
        </div>
      </header>

    </>
  );
}
