"use client";
// v3 — active state + pathname highlighting
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X, ChevronDown, ChevronRight, ImageIcon, Music, Wand2, Sparkles, Mic,
  Zap, Film, Layers, LayoutDashboard, User, CreditCard, LogOut,
  UserCircle2, Clapperboard, ArrowUpCircle, ArrowLeft, Cpu,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthContext";
import { getNavModels, getToolsByCategory, type CatalogTool } from "@/lib/tools/catalog";
import { hasFCSAccess } from "@/lib/fcs";

// ─────────────────────────────────────────────────────────────────────────────
// NAV DATA
// ─────────────────────────────────────────────────────────────────────────────

type RightPanel =
  | { type: "models"; heading: string; models: CatalogTool[] }
  | { type: "soon"; title: string; desc: string; bullets: string[]; badge?: string };

interface NavFeature {
  icon: React.ElementType;
  label: string;
  desc: string;
  badge: string | null;
  href: string;
  right: RightPanel;
}

interface NavCategory {
  color: string;
  label: string; // left-panel header
  features: NavFeature[];
}

const imageModels  = getNavModels("image", 6);
const videoModels  = getNavModels("video", 6);
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
        icon: Cpu, label: "Creative Director", desc: "AI-guided concept-to-creative workflow", badge: "NEW", href: "/studio/image",
        right: { type: "soon", title: "Creative Director", badge: "NEW", desc: "Brief your campaign, receive 3 distinct creative concepts from an AI art director, then render any concept into production-ready visuals — all in one workflow.", bullets: ["AI-generated creative concepts", "Multi-provider smart routing", "Variation engine (5 passes)", "Format adaptation (Story, Square, Banner)"] },
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
        icon: Mic, label: "Lip Sync", desc: "Sync voice to video", badge: "SOON", href: "#",
        right: { type: "soon", title: "Lip Sync", badge: "COMING SOON", desc: "Sync any audio or voice to any video with perfectly matched lip movement. Powered by HeyGen & ElevenLabs.", bullets: ["Any language supported", "Natural mouth physics", "Works on AI & real footage", "Export in 1080p+"] },
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
    color: "#A855F7",
    label: "Audio Tools",
    features: [
      {
        icon: Mic, label: "AI Voiceover", desc: "Generate speech from text", badge: "NEW", href: "/studio?mode=audio",
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
        icon: UserCircle2, label: "AI Influencer", desc: "Consistent AI persona for socials", badge: "SOON", href: "#",
        right: { type: "soon", title: "AI Influencer", badge: "COMING SOON", desc: "Build a persistent AI character that posts, speaks, and evolves — for Instagram, TikTok, and beyond.", bullets: ["Face & voice consistency", "Automated content calendar", "Platform-ready formats", "Soul ID powered"] },
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
  { label: "Character",     href: "#",             hasDropdown: true,  dropdownKey: "Character" },
  { label: "Gallery",       href: "/gallery",      hasDropdown: false },
  { label: "Pricing",       href: "/pricing",      hasDropdown: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function RightPanelContent({ panel, color, onClose }: { panel: RightPanel; color: string; onClose?: () => void }) {
  if (panel.type === "models") {
    return (
      <div className="flex flex-col h-full">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: `${color}80` }}>
          {panel.heading}
        </p>
        <div className="flex flex-col gap-0.5">
          {panel.models.map((model) => {
            const isSoon = model.status !== "active";
            const studioBase = color === "#2563EB" ? "/studio/image" : color === "#0EA5A0" ? "/studio/video" : color === "#A855F7" ? "/studio/audio" : "#";
            const paramName = color === "#0EA5A0" ? "tool" : "model";
            const href = !isSoon ? `${studioBase}?${paramName}=${model.id}` : "#";
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
  // null = no inner item hovered yet — right panel stays hidden until user moves into the left panel
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const activeFeat = activeIdx !== null ? data.features[activeIdx] : null;

  return (
    <>
    {/* Keyframe injected once per mount — negligible cost */}
    <style>{`@keyframes ddOpen{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <div
      className="absolute top-full left-0 z-[200] overflow-hidden rounded-2xl"
      style={{
        width: activeFeat ? "620px" : "260px",
        transition: "width 200ms ease",
        background: "rgba(8,14,28,0.97)",
        border: `1px solid ${data.color}20`,
        backdropFilter: "blur(20px)",
        boxShadow: `0 24px 64px rgba(0,0,0,0.75), 0 0 40px ${data.color}12`,
        animation: "ddOpen 200ms ease-out forwards",
      }}
    >
      <div className={activeFeat ? "grid grid-cols-[240px_1fr]" : ""}>

        {/* ── LEFT PANEL — features ────────────────────────────────────── */}
        <div className="border-r p-3.5" style={{ borderColor: `${data.color}12` }}>
          <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: `${data.color}60` }}>
            {data.label}
          </p>
          <div className="flex flex-col gap-0.5">
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
                  className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150"
                  style={{
                    background: isActive ? `${data.color}14` : "transparent",
                    color: isActive ? "#F8FAFC" : "#94A3B8",
                    opacity: isSoon && !isActive ? 0.75 : 1,
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                    style={{
                      background: isActive ? `${data.color}20` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? data.color + "30" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <Icon size={14} style={{ color: isActive ? data.color : "#64748B" }} />
                  </div>

                  {/* Label + desc */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-medium leading-none">{feat.label}</span>
                      {feat.badge && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"
                          style={{
                            background: isSoon ? "rgba(55,65,81,0.7)" : `${data.color}22`,
                            color:      isSoon ? "#6B7280" : data.color,
                          }}
                        >
                          {feat.badge}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 block text-[12px] leading-none" style={{ color: isActive ? `${data.color}90` : "#475569" }}>
                      {feat.desc}
                    </span>
                  </div>

                  {/* Right affordance arrow — only visible when this item is active */}
                  <ChevronRight
                    size={13}
                    className="shrink-0 transition-all duration-150"
                    style={{
                      color: isActive ? data.color : "transparent",
                      transform: isActive ? "translateX(1px)" : "none",
                    }}
                  />
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANEL — only rendered after inner-item hover ──────────
             Nothing exists in the DOM here until the user hovers a left item. */}
        {activeFeat && (
          <div
            className="p-4"
            style={{ minHeight: "200px" }}
            key={activeIdx}
          >
            <RightPanelContent panel={activeFeat.right} color={data.color} onClose={onClose} />
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${data.color}30, transparent)` }} />
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
}: {
  onClose: () => void;
  onAuthModal: (mode: "login" | "signup") => void;
}) {
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

  const sectionData = section ? navCategories[section] : null;

  return (
    <div
      className="border-t lg:hidden"
      style={{
        borderColor: "var(--border-subtle)",
        background: "rgba(8,14,28,0.98)",
        backdropFilter: "blur(20px)",
        maxHeight: "calc(100vh - 72px)",
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
              return (
                <li key={link.href + link.label}>
                  {hasSection ? (
                    <button
                      onClick={() => openSection(link.dropdownKey!)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 font-medium transition-colors"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "15px" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                    >
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat!.color, boxShadow: `0 0 6px ${cat!.color}` }}
                      />
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronRight size={14} style={{ color: "#475569" }} />
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl px-3 py-3.5 font-medium"
                      style={{ color: "#94A3B8", fontSize: "15px" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#F8FAFC"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#94A3B8"}
                    >
                      <span className="h-2 w-2 rounded-full flex-shrink-0 bg-transparent" />
                      {link.label}
                    </Link>
                  )}
                </li>
              );
            })}

            {/* Cinema Studio */}
            <li>
              <Link
                href="/studio/cinema"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 font-medium"
                style={{ color: "#94A3B8", fontSize: "15px" }}
              >
                <Clapperboard size={14} style={{ color: "#A855F7", flexShrink: 0 }} />
                <span className="flex-1">Cinema Studio</span>
                <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7" }}>SOON</span>
              </Link>
            </li>
          </ul>

          {/* Auth buttons */}
          <div className="mt-4 flex flex-col gap-2 px-1">
            <button
              onClick={() => { onClose(); onAuthModal("login"); }}
              className="block text-center rounded-xl font-medium w-full transition-colors"
              style={{ padding: "12px", fontSize: "15px", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)", background: "none", cursor: "pointer" }}
            >
              Login
            </button>
            <Link
              href="/studio/image"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white w-full"
              style={{ padding: "13px 16px", fontSize: "15px", background: "linear-gradient(135deg,#2563EB 0%,#0EA5A0 100%)", textDecoration: "none" }}
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
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", color: isSoon ? "#64748B" : "#94A3B8", fontSize: "15px" }}
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
          <RightPanelContent panel={sectionData.features[detail].right} color={sectionData.color} />

          {/* Link to feature if it's active */}
          {sectionData.features[detail].href !== "#" && (
            <Link
              href={sectionData.features[detail].href}
              onClick={onClose}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl font-semibold"
              style={{ padding: "13px 16px", fontSize: "15px", background: `linear-gradient(135deg, ${sectionData.color}, ${sectionData.color}bb)`, color: "#fff", textDecoration: "none" }}
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
// MAIN NAVBAR
// ─────────────────────────────────────────────────────────────────────────────

export function Navbar() {
  const [scrolled, setScrolled]             = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [authModal, setAuthModal]           = useState<"login" | "signup" | null>(null);
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, logout } = useAuth();
  const pathname = usePathname();

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
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 180);
  }, []);

  const cancelClose = useCallback(() => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
  }, []);

  // Close dropdown on click outside
  const navRef = useRef<HTMLElement>(null);
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

  return (
    <>
      <header
        ref={navRef}
        className="fixed top-0 z-[1100] w-full transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "var(--page-bg)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border-subtle)" : "none",
          boxShadow: scrolled ? "0 4px 40px rgba(0,0,0,0.25)" : "none",
        }}
      >
        <div className="container-site">
          <nav className="flex h-[72px] items-center justify-between">

            {/* Logo — size="lg" for increased presence */}
            <Logo size="lg" />

            {/* ── Desktop nav ── */}
            <ul className="hidden items-center gap-0.5 lg:flex">
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
                          padding: "9px 14px",
                          fontSize: "15px",
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
                    ) : (
                      <Link
                        href={link.href}
                        className="flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200"
                        style={{
                          padding: "9px 14px",
                          fontSize: "15px",
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

              {/* Future Cinema Studio */}
              <li className="relative ml-1">
                <Link
                  href="/studio/cinema"
                  className="flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200"
                  style={{ padding: "9px 14px", fontSize: "15px", color: "#94A3B8" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#C084FC")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                >
                  <Clapperboard size={14} style={{ color: "#A855F7" }} />
                  Future Cinema Studio
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.25)" }}
                  >
                    SOON
                  </span>
                </Link>
              </li>
            </ul>

            {/* ── Desktop actions ── */}
            <div className="hidden items-center gap-3 lg:flex">
              {user ? (
                <>
                  {/* Credits pill — scaled up */}
                  <Link
                    href={user.role === "admin" ? "/hub/credits" : "/dashboard/credits"}
                    style={{ display: "flex", alignItems: "center", gap: "7px", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: "20px", padding: "7px 15px", fontSize: "13px", fontWeight: 600, color: "#60A5FA", textDecoration: "none", transition: "all 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.16)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(37,99,235,0.25)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                  >
                    <Zap size={13} />
                    {user.credits} cr
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
                </>
              ) : (
                <>
                  <button
                    onClick={() => setAuthModal("login")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "15px", fontWeight: 500, transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#F8FAFC")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
                  >
                    Login
                  </button>
                  <Link
                    href="/studio/image"
                    className="inline-flex items-center gap-2 rounded-xl text-white transition-all duration-300"
                    style={{ padding: "11px 22px", fontSize: "15px", fontWeight: 600, background: "linear-gradient(135deg,#2563EB 0%,#0EA5A0 100%)", boxShadow: "0 0 20px rgba(37,99,235,0.3)", border: "none", cursor: "pointer", textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(37,99,235,0.6)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(37,99,235,0.3)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    <Zap size={15} />
                    Try Free
                  </Link>
                </>
              )}
            </div>

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
              onAuthModal={(mode) => { setMobileOpen(false); setAuthModal(mode); }}
            />
          )}
        </div>
      </header>

      {authModal && (
        <Suspense fallback={null}>
          <AuthModal
            defaultTab={authModal}
            onClose={() => setAuthModal(null)}
          />
        </Suspense>
      )}
    </>
  );
}
