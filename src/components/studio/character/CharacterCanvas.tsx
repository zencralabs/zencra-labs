"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterCanvas — persistent identity engine (Phase 3E)
// Canvas modes: Hero 9:16 | Blueprint 16:9 | Identity 1:1
// Hero: glow breathing, parallax on hover, consistency chips, cross-studio portals
// Blueprint: 5-panel character sheet, lighting overlays, "One Identity → Multiple Outputs"
// Identity: lock layer, face/skin/expression panels
// Props interface UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import type { CharacterMode, Character, SoulId, CharacterVersion } from "@/lib/character";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CharacterCanvasProps {
  mode: CharacterMode;
  character: Character | null;
  soul: SoulId | null;
  isGenerating: boolean;
  versions: CharacterVersion[];
  activeVersionId: string | null;
  onModeAction: (mode: CharacterMode) => void;
  onVersionSelect: (versionId: string) => void;
}

// ── Canvas modes ──────────────────────────────────────────────────────────────

type CanvasMode = "hero" | "blueprint" | "identity";

const CANVAS_MODES: Array<{
  id: CanvasMode; label: string; ratio: string; description: string;
}> = [
  { id: "hero",      label: "Hero",      ratio: "9:16", description: "Full character identity" },
  { id: "blueprint", label: "Blueprint", ratio: "16:9", description: "Multi-angle character sheet" },
  { id: "identity",  label: "Identity",  ratio: "1:1",  description: "Face & detail lock" },
];

// ── Starter data ──────────────────────────────────────────────────────────────

const STARTERS = [
  {
    name: "Nova Reyes",
    type: "AI Influencer",
    tagline: "Bold & empowered creator",
    color: "#f59e0b",
    colorRgb: "245,158,11",
    colorDim: "rgba(245,158,11,0.14)",
    colorBorder: "rgba(245,158,11,0.28)",
    bg: "linear-gradient(170deg, #130e02 0%, #0d0a02 45%, #080b10 100%)",
    glowColor: "rgba(245,158,11,0.30)",
    glowColorSoft: "rgba(245,158,11,0.08)",
    styleDna: ["Cinematic", "Editorial", "Bold"] as string[],
    presetImage: "/zencralabs/characters/presets/nova-reyes.jpg",
  },
  {
    name: "Marcus Veld",
    type: "Brand Avatar",
    tagline: "Professional, minimal presence",
    color: "#3b82f6",
    colorRgb: "59,130,246",
    colorDim: "rgba(59,130,246,0.14)",
    colorBorder: "rgba(59,130,246,0.28)",
    bg: "linear-gradient(170deg, #020912 0%, #030c18 45%, #080b10 100%)",
    glowColor: "rgba(59,130,246,0.22)",
    glowColorSoft: "rgba(59,130,246,0.06)",
    styleDna: ["Minimal", "Clean", "Professional"] as string[],
    presetImage: "/zencralabs/characters/presets/marcus-veld.jpg",
  },
  {
    name: "Zara Onyx",
    type: "AI Influencer",
    tagline: "Edgy editorial aesthetic",
    color: "#a855f7",
    colorRgb: "168,85,247",
    colorDim: "rgba(168,85,247,0.14)",
    colorBorder: "rgba(168,85,247,0.28)",
    bg: "linear-gradient(170deg, #0c0214 0%, #100318 45%, #080b10 100%)",
    glowColor: "rgba(168,85,247,0.22)",
    glowColorSoft: "rgba(168,85,247,0.06)",
    styleDna: ["Edgy", "Editorial", "Street"] as string[],
    presetImage: "/zencralabs/characters/presets/zara-onyx.jpg",
  },
] as const;

type StarterIdx = 0 | 1 | 2;

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  surface:     "#090c13",
  amber:       "#f59e0b",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Keyframes ─────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes ccFadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes ccFloat     { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-10px)} }
@keyframes ccShimmer   { 0%{transform:translateX(-120%)} 100%{transform:translateX(220%)} }
@keyframes ccSweep     { 0%{opacity:0.4} 50%{opacity:0.9} 100%{opacity:0.4} }
@keyframes ccGlowPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes ccImgFade   { from{opacity:0} to{opacity:1} }
@keyframes ccBreathe   { 0%,100%{opacity:0.58;transform:translateX(-50%) scale(1)} 50%{opacity:1;transform:translateX(-50%) scale(1.12)} }
@keyframes ccBreatheSlow { 0%,100%{opacity:0.35;transform:scale(1)} 50%{opacity:0.68;transform:scale(1.07)} }
`;

// ── Consistency chips data ────────────────────────────────────────────────────

const CONSISTENCY_CHIPS = [
  { label: "Identity Locked",       color: "#10b981", rgb: "16,185,129",  glow: true  },
  { label: "Outfit Consistent",     color: "#3b82f6", rgb: "59,130,246",  glow: false },
  { label: "Skin / Texture Match",  color: "#a855f7", rgb: "168,85,247",  glow: false },
  { label: "Body Structure Stable", color: "#f59e0b", rgb: "245,158,11",  glow: false },
  { label: "Soul ID Active",        color: "#10b981", rgb: "16,185,129",  glow: true  },
] as const;

// ── Studio portals data ───────────────────────────────────────────────────────

const STUDIO_PORTALS = [
  { label: "Image Studio", color: "#f59e0b", rgb: "245,158,11", href: "/studio/image"     },
  { label: "Video Studio", color: "#3b82f6", rgb: "59,130,246",  href: "/studio/video"     },
  { label: "Audio Studio", color: "#a855f7", rgb: "168,85,247",  href: "/studio/audio"     },
] as const;

// ── SVG silhouettes ───────────────────────────────────────────────────────────

function NovaSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="ng1" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ng2" cx="28%" cy="25%" r="45%">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="185" rx="85" ry="168" fill="url(#ng1)" />
      <ellipse cx="62" cy="108" rx="62" ry="88" fill="url(#ng2)" />
      <path d="M72 38 C56 22, 36 18, 30 36 C24 54, 30 82, 38 108 C44 128, 43 152, 39 178 C36 196, 34 212, 36 228"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" opacity="0.80" />
      <path d="M100 26 C118 16, 140 18, 146 34 C150 46, 144 60, 134 68"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M88 28 C94 18, 102 14, 110 16" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.60" />
      <ellipse cx="102" cy="65" rx="30" ry="36" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.08" />
      <path d="M93 100 L91 124 M111 100 L113 124" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.60" />
      <path d="M38 132 C58 120, 78 116, 94 120" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M110 120 C126 116, 146 120, 164 132" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M42 136 C32 155, 24 180, 22 205 C20 220, 20 234, 22 248" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M158 136 C168 155, 174 178, 174 200" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M56 132 C54 168, 54 204, 58 230 L144 230 C148 204, 148 168, 146 132 Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.06" />
      <path d="M58 228 C75 235, 95 238, 102 238 C109 238, 129 235, 144 228" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d="M58 230 C48 264, 34 306, 18 352 C10 376, 8 396, 10 416 L192 416 C194 396, 192 376, 184 352 C168 306, 154 264, 144 230 Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.10" />
      <path d="M94 232 C88 266, 80 306, 68 352" stroke={color} strokeWidth="0.8" fill="none" opacity="0.32" />
      <path d="M114 232 C120 266, 128 306, 140 352" stroke={color} strokeWidth="0.8" fill="none" opacity="0.32" />
      <path d="M40 128 C34 148, 26 172, 22 196" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M162 130 C170 148, 174 165, 174 182" stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function MarcusSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="mg1" cx="50%" cy="36%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="178" rx="78" ry="158" fill="url(#mg1)" />
      <ellipse cx="100" cy="52" rx="32" ry="18" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.18" />
      <ellipse cx="100" cy="70" rx="28" ry="34" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.08" />
      <path d="M94 103 L92 124 M106 103 L108 124" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.60" />
      <path d="M90 124 L96 136 L100 130 L104 136 L110 124" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.65" />
      <path d="M28 138 C50 124, 74 120, 92 124" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M108 124 C126 120, 150 124, 172 138" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M70 136 C78 148, 86 158, 90 170 L100 152 L110 170 C114 158, 122 148, 130 136" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.58" />
      <path d="M36 142 C30 165, 28 192, 28 222 L44 222 C46 192, 48 165, 52 142" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.07" />
      <path d="M164 142 C170 165, 172 192, 172 222 L156 222 C154 192, 152 165, 148 142" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.07" />
      <path d="M52 142 C50 180, 50 218, 52 256 L148 256 C150 218, 150 180, 148 142 Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.08" />
      <line x1="100" y1="172" x2="100" y2="254" stroke={color} strokeWidth="0.8" opacity="0.45" />
      <circle cx="100" cy="192" r="2.4" fill={color} opacity="0.45" />
      <circle cx="100" cy="210" r="2.4" fill={color} opacity="0.45" />
      <circle cx="100" cy="228" r="2.4" fill={color} opacity="0.45" />
      <path d="M52 256 C50 295, 48 340, 48 384 L96 384 L100 320 L104 384 L152 384 C152 340, 150 295, 148 256 Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.09" />
      <path d="M30 132 C24 155, 22 182, 24 210" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function ZaraSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 220 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="zg1" cx="50%" cy="36%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="185" rx="95" ry="170" fill="url(#zg1)" />
      <path d="M68 55 C48 32, 20 28, 14 50 C8 72, 18 95, 30 112 C40 126, 44 140, 40 158" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.78" />
      <path d="M148 55 C168 32, 196 28, 200 52 C204 74, 192 98, 178 116 C168 130, 162 144, 164 162" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.78" />
      <path d="M70 42 C80 24, 100 18, 110 16 C120 14, 136 18, 148 28" stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" opacity="0.72" />
      <path d="M56 68 C42 55, 28 56, 22 70 C16 86, 22 108, 34 122" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.44" />
      <ellipse cx="110" cy="70" rx="28" ry="33" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.08" />
      <path d="M103 102 L101 122 M117 102 L119 122" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.60" />
      <path d="M46 130 C66 118, 86 114, 103 120" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M117 120 C134 116, 154 122, 170 134" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M52 134 C44 150, 38 168, 36 188 C34 202, 34 214, 40 222 C50 232, 64 228, 68 220" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M164 138 C174 158, 180 182, 178 205" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M62 136 C60 170, 60 204, 64 232 L156 232 C160 204, 160 170, 158 136 Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.08" />
      <path d="M64 232 C54 260, 42 296, 34 336 C28 360, 26 382, 28 406 L116 406 L124 340 L158 406 L192 406 C190 382, 184 360, 174 334 C162 294, 152 262, 144 232 Z" stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.10" />
      <line x1="120" y1="232" x2="120" y2="340" stroke={color} strokeWidth="0.8" opacity="0.42" />
      <path d="M44 124 C36 148, 30 175, 28 204" stroke="rgba(255,255,255,0.20)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function StarterSilhouette({ idx }: { idx: StarterIdx }) {
  const { color } = STARTERS[idx];
  if (idx === 0) return <NovaSilhouette color={color} />;
  if (idx === 1) return <MarcusSilhouette color={color} />;
  return <ZaraSilhouette color={color} />;
}

// ── Canvas mode switcher — system control, not tabs ────────────────────────────

function CanvasModeSwitcher({
  active, onChange,
}: {
  active: CanvasMode; onChange: (m: CanvasMode) => void;
}) {
  const [hovered, setHovered] = useState<CanvasMode | null>(null);

  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "10px 16px",
      background: "rgba(6,8,15,0.55)",
      flexShrink: 0,
    }}>
      {CANVAS_MODES.map((cm, i) => {
        const isActive = active === cm.id;
        const isHovered = hovered === cm.id;
        const showDesc = isActive || (!isActive && isHovered);

        return (
          <div key={cm.id} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div style={{
                width: 1, height: 22,
                background: "rgba(255,255,255,0.07)",
                margin: "0 6px", flexShrink: 0,
              }} />
            )}
            <button
              onClick={() => onChange(cm.id)}
              onMouseEnter={() => setHovered(cm.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 8,
                background: isActive ? "rgba(245,158,11,0.09)" : "transparent",
                border: isActive ? "1px solid rgba(245,158,11,0.20)" : "1px solid transparent",
                cursor: "pointer", transition: "all 0.18s ease",
              }}
            >
              {/* Active dot */}
              {isActive && (
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: T.amber,
                  boxShadow: `0 0 8px ${T.amber}99`,
                  flexShrink: 0,
                }} />
              )}

              {/* Label */}
              <span style={{
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? T.amber : T.textMuted,
                letterSpacing: "0.01em", transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}>
                {cm.label}
              </span>

              {/* Ratio badge */}
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                color: isActive ? "rgba(245,158,11,0.60)" : T.textGhost,
                padding: "2px 6px", borderRadius: 4,
                background: isActive ? "rgba(245,158,11,0.09)" : "rgba(255,255,255,0.04)",
                letterSpacing: "0.05em", transition: "all 0.15s",
              }}>
                {cm.ratio}
              </span>

              {/* Description — shown on active or hover */}
              {showDesc && (
                <span style={{
                  fontSize: 11, color: isActive ? T.textMuted : T.textGhost,
                  letterSpacing: "0.01em", whiteSpace: "nowrap",
                  borderLeft: `1px solid rgba(255,255,255,0.08)`,
                  paddingLeft: 9,
                }}>
                  {cm.description}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Consistency chips — system status indicators ───────────────────────────────

function ConsistencyChips() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
      {CONSISTENCY_CHIPS.map(chip => (
        <div key={chip.label} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 11px", borderRadius: 20,
          background: `rgba(${chip.rgb}, 0.08)`,
          border: `1px solid rgba(${chip.rgb}, 0.20)`,
          backdropFilter: "blur(12px)",
          boxShadow: chip.glow ? `0 0 14px rgba(${chip.rgb}, 0.22), inset 0 0 8px rgba(${chip.rgb}, 0.04)` : "none",
          transition: "all 0.15s",
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
            background: chip.color,
            boxShadow: `0 0 6px ${chip.color}bb`,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: chip.color,
            letterSpacing: "0.04em",
            opacity: 0.90,
          }}>
            {chip.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Cross-studio portals ───────────────────────────────────────────────────────

function CrossStudioPortals() {
  const [hoveredPortal, setHoveredPortal] = useState<string | null>(null);

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: T.textGhost,
        letterSpacing: "0.06em", textTransform: "uppercase",
        marginBottom: 10,
      }}>
        Use this character in
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {STUDIO_PORTALS.map(portal => {
          const isHovered = hoveredPortal === portal.label;
          return (
            <a
              key={portal.label}
              href={portal.href}
              onMouseEnter={() => setHoveredPortal(portal.label)}
              onMouseLeave={() => setHoveredPortal(null)}
              style={{
                flex: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, padding: "9px 10px", borderRadius: 9,
                background: isHovered ? `rgba(${portal.rgb}, 0.12)` : `rgba(${portal.rgb}, 0.06)`,
                border: `1px solid rgba(${portal.rgb}, ${isHovered ? "0.38" : "0.18"})`,
                color: portal.color, textDecoration: "none",
                fontSize: 12, fontWeight: 700,
                letterSpacing: "0.02em",
                transition: "all 0.18s ease",
                boxShadow: isHovered ? `0 0 18px rgba(${portal.rgb}, 0.22), 0 4px 14px rgba(0,0,0,0.35)` : "0 2px 8px rgba(0,0,0,0.25)",
                backdropFilter: "blur(8px)",
              }}
            >
              {portal.label}
              <span style={{ opacity: 0.75, fontSize: 13 }}>→</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Stage style per canvas mode ────────────────────────────────────────────────

function getStageStyle(mode: CanvasMode, accentColor: string): React.CSSProperties {
  const shared: React.CSSProperties = {
    position: "relative", overflow: "hidden",
    borderRadius: 14,
    boxShadow: [
      "0 0 0 1px rgba(255,255,255,0.04)",
      `0 0 100px ${accentColor}10`,
      "0 24px 80px rgba(0,0,0,0.72)",
    ].join(", "),
    flexShrink: 0,
  };
  if (mode === "hero")      return { ...shared, height: "100%", aspectRatio: "9/16" };
  if (mode === "blueprint") return { ...shared, width: "100%",  aspectRatio: "16/9" };
  return                           { ...shared, height: "100%", aspectRatio: "1/1",  maxWidth: "100%" };
}

// ── Cinematic starter preview — Hero view ─────────────────────────────────────

function CinematicStarterPreview({
  idx, onCycle, onBuild,
}: {
  idx: StarterIdx;
  onCycle: (next: StarterIdx) => void;
  onBuild: () => void;
}) {
  const starter = STARTERS[idx];
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  const [parallax,  setParallax]  = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setParallax({
      x: ((e.clientX - rect.left)  / rect.width  - 0.5) * 10,
      y: ((e.clientY - rect.top)   / rect.height - 0.5) * 6,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setParallax({ x: 0, y: 0 }), []);

  const showSilhouette = imgError || !imgLoaded;

  return (
    <div
      style={{ position: "relative", height: "100%", overflow: "hidden" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background */}
      <div style={{ position: "absolute", inset: 0, background: starter.bg, transition: "background 0.5s ease" }} />

      {/* Primary ambient glow — breathing */}
      <div style={{
        position: "absolute",
        top: "2%", left: "50%",
        width: "88%", height: "78%",
        background: `radial-gradient(ellipse at 50% 34%, ${starter.glowColor} 0%, transparent 64%)`,
        animation: "ccBreathe 3.5s ease-in-out infinite",
        filter: "blur(4px)",
        pointerEvents: "none",
      }} />

      {/* Secondary deep glow — slower breathing */}
      <div style={{
        position: "absolute",
        bottom: "12%", left: "22%",
        width: "68%", height: "55%",
        background: `radial-gradient(ellipse, ${starter.glowColorSoft} 0%, transparent 70%)`,
        animation: "ccBreatheSlow 4.8s ease-in-out infinite 1.4s",
        filter: "blur(32px)",
        pointerEvents: "none",
      }} />

      {/* Parallax layer — image + silhouette move together */}
      <div style={{
        position: "absolute", inset: 0,
        transform: `translate(${parallax.x}px, ${parallax.y}px)`,
        transition: "transform 0.28s ease-out",
        pointerEvents: "none",
      }}>
        {/* Real preset image — full coverage */}
        {!imgError && (
          <img
            key={starter.presetImage}
            src={starter.presetImage}
            alt={starter.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setImgLoaded(false); }}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center top",
              opacity: imgLoaded ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          />
        )}

        {/* Silhouette fallback */}
        {showSilhouette && (
          <div style={{
            position: "absolute",
            top: "2%", left: "50%",
            height: "78%", aspectRatio: "200/420",
            animation: "ccFloat 6.5s ease-in-out infinite",
          }}>
            <StarterSilhouette idx={idx} />
          </div>
        )}
      </div>

      {/* Side vignettes */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to right, rgba(8,10,18,0.60) 0%, transparent 22%, transparent 78%, rgba(8,10,18,0.60) 100%)",
      }} />

      {/* Bottom vignette — deep gradient */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "72%",
        background: "linear-gradient(to top, rgba(8,10,18,1) 0%, rgba(8,10,18,0.94) 20%, rgba(8,10,18,0.70) 40%, rgba(8,10,18,0.30) 62%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Content overlay */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "52px 22px 22px" }}>

        {/* Consistency chips — system status indicators */}
        <ConsistencyChips />

        {/* Name */}
        <div style={{
          fontSize: 40, fontWeight: 800, color: "#f0f2f8",
          letterSpacing: "-0.038em", lineHeight: 1.05,
          marginBottom: 8,
          textShadow: "0 2px 28px rgba(0,0,0,0.65)",
          animation: "ccFadeUp 0.35s ease forwards",
        }}>
          {starter.name}
        </div>

        {/* Type · tagline */}
        <div style={{
          fontSize: 14, fontWeight: 600, color: starter.color,
          letterSpacing: "0.04em", textTransform: "uppercase",
          marginBottom: 18,
          textShadow: `0 0 24px ${starter.glowColor}`,
        }}>
          {starter.type}  ·  {starter.tagline}
        </div>

        {/* Style DNA tags */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 22 }}>
          {starter.styleDna.map(tag => (
            <div key={tag} style={{
              padding: "5px 14px", borderRadius: 20,
              background: starter.colorDim,
              border: `1px solid ${starter.colorBorder}`,
              color: starter.color, fontSize: 12, fontWeight: 600,
              backdropFilter: "blur(8px)",
            }}>
              {tag}
            </div>
          ))}
        </div>

        {/* Preset cycle + build CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {STARTERS.map((s, i) => (
              <button key={i}
                onClick={() => onCycle(i as StarterIdx)}
                style={{
                  width: i === idx ? 28 : 8, height: 8, borderRadius: 4,
                  background: i === idx ? s.color : "rgba(255,255,255,0.22)",
                  border: "none", cursor: "pointer",
                  transition: "all 0.22s ease", padding: 0,
                  boxShadow: i === idx ? `0 0 10px ${s.color}80` : "none",
                }}
              />
            ))}
          </div>
          <button onClick={onBuild} style={{
            marginLeft: "auto",
            padding: "12px 26px", borderRadius: 10,
            background: "linear-gradient(135deg, #92400e, #b45309 40%, #f59e0b)",
            color: "#060810", fontSize: 14, fontWeight: 800,
            border: "none", cursor: "pointer", letterSpacing: "0.02em",
            boxShadow: "0 0 34px rgba(245,158,11,0.44), 0 4px 18px rgba(0,0,0,0.45)",
          }}>
            Build This Character →
          </button>
        </div>

        {/* Cross-studio portals */}
        <CrossStudioPortals />
      </div>

      {/* Cycle arrows */}
      {(["left", "right"] as const).map(side => (
        <button key={side}
          onClick={() => onCycle(
            side === "left" ? ((idx - 1 + 3) % 3) as StarterIdx : ((idx + 1) % 3) as StarterIdx
          )}
          style={{
            position: "absolute",
            [side]: 12, top: "38%", transform: "translateY(-50%)",
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(0,0,0,0.50)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.72)", fontSize: 22, fontWeight: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(10px)", transition: "all 0.15s",
          }}
        >
          {side === "left" ? "‹" : "›"}
        </button>
      ))}

      {/* Preview badge */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        padding: "4px 10px", borderRadius: 5,
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.16em", textTransform: "uppercase",
        backdropFilter: "blur(8px)",
      }}>
        PREVIEW
      </div>
    </div>
  );
}

// ── Blueprint view — multi-panel character sheet ───────────────────────────────

interface PanelProps {
  label: string;
  image: string;
  objectPos: string;
  lightingOverlay: string;
  accentRgb: string;
}

function BlueprintPanel({ label, image, objectPos, lightingOverlay, accentRgb }: PanelProps) {
  const [loaded, setLoaded] = useState(false);
  const [error,  setError]  = useState(false);

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(170deg, rgba(10,12,22,0.98), rgba(6,8,16,0.98))",
    }}>
      {!error && (
        <img
          src={image}
          alt={label}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: objectPos,
            opacity: loaded ? 0.82 : 0,
            transition: "opacity 0.35s ease",
          }}
        />
      )}

      {/* Atmospheric fallback glow (always visible, even under image) */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 35%, rgba(${accentRgb},0.14) 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      {/* Per-panel lighting overlay — makes each feel captured differently */}
      <div style={{
        position: "absolute", inset: 0,
        background: lightingOverlay,
        pointerEvents: "none",
      }} />

      {/* Panel label badge */}
      <div style={{
        position: "absolute", top: 7, left: 7,
        padding: "3px 8px", borderRadius: 4,
        background: "rgba(0,0,0,0.62)",
        border: `1px solid rgba(${accentRgb},0.24)`,
        fontSize: 8, fontWeight: 900,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: `rgba(${accentRgb},0.85)`,
        backdropFilter: "blur(6px)",
      }}>
        {label}
      </div>
    </div>
  );
}

function BlueprintView({
  starter,
}: {
  starter: typeof STARTERS[number];
}) {
  const r = starter.colorRgb;

  const panels: PanelProps[] = [
    {
      label: "Front / Full Body", image: starter.presetImage,
      objectPos: "center top",
      lightingOverlay: `linear-gradient(to right, rgba(${r},0.05) 0%, transparent 60%)`,
      accentRgb: r,
    },
    {
      label: "Back", image: starter.presetImage,
      objectPos: "center 20%",
      lightingOverlay: "linear-gradient(145deg, rgba(18,30,80,0.50) 0%, rgba(6,10,28,0.38) 100%)",
      accentRgb: "59,130,246",
    },
    {
      label: "Profile", image: starter.presetImage,
      objectPos: "78% center",
      lightingOverlay: `linear-gradient(to left, rgba(${r},0.08) 0%, transparent 55%)`,
      accentRgb: r,
    },
    {
      label: "Outfit / Style", image: starter.presetImage,
      objectPos: "center 68%",
      lightingOverlay: "linear-gradient(to top, transparent 40%, rgba(0,0,0,0.22) 100%)",
      accentRgb: "168,85,247",
    },
    {
      label: "Detail", image: starter.presetImage,
      objectPos: "center 14%",
      lightingOverlay: `radial-gradient(ellipse at 50% 38%, rgba(${r},0.10) 0%, transparent 62%)`,
      accentRgb: r,
    },
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: starter.bg }}>

      {/* Panel grid — fills the full canvas */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid",
        gridTemplateColumns: "56fr 44fr",
        gap: 3,
      }}>
        {/* Left — FRONT (full height) */}
        <BlueprintPanel {...panels[0]} />

        {/* Right — 2×2 grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 3,
        }}>
          <BlueprintPanel {...panels[1]} />
          <BlueprintPanel {...panels[2]} />
          <BlueprintPanel {...panels[3]} />
          <BlueprintPanel {...panels[4]} />
        </div>
      </div>

      {/* Header overlay — gradient behind it */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        padding: "12px 16px 22px",
        background: "linear-gradient(to bottom, rgba(8,10,18,0.88) 0%, rgba(8,10,18,0.50) 65%, transparent 100%)",
        pointerEvents: "none",
      }}>
        <div style={{
          fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.18em", textTransform: "uppercase",
        }}>
          Character Blueprint
        </div>
        <div style={{
          fontSize: 11, color: T.textGhost, marginTop: 3,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          Multi-angle consistency preview
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 10, color: starter.color, opacity: 0.70,
          }}>
            <span style={{ fontSize: 14, opacity: 0.5 }}>·</span>
            One Identity → Multiple Outputs
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Identity view — face & detail lock layer ──────────────────────────────────

function ExpressionPlaceholder({ accentRgb, accentColor }: { accentRgb: string; accentColor: string }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(145deg, rgba(8,10,22,0.98), rgba(6,8,18,0.98))",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      {/* Atmospheric glow */}
      <div style={{
        position: "absolute",
        width: "75%", height: "65%",
        background: `radial-gradient(ellipse, rgba(${accentRgb},0.14) 0%, transparent 65%)`,
        filter: "blur(14px)",
        pointerEvents: "none",
      }} />

      {/* Label */}
      <div style={{
        position: "absolute", top: 7, left: 7,
        padding: "3px 8px", borderRadius: 4,
        background: "rgba(0,0,0,0.62)",
        border: "1px solid rgba(255,255,255,0.07)",
        fontSize: 8, fontWeight: 900,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: T.textGhost,
      }}>
        Expression Variants
      </div>

      {/* Micro face grid — implies expression variants */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, zIndex: 1 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 24, height: 30, borderRadius: "50% 50% 40% 40%",
            background: `radial-gradient(ellipse at 50% 28%, rgba(${accentRgb},${0.20 - i * 0.03}) 0%, transparent 68%)`,
            border: "1px solid rgba(255,255,255,0.06)",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 9, color: T.textGhost, zIndex: 1, letterSpacing: "0.05em" }}>
        Generated from face lock
      </div>
    </div>
  );
}

function IdentityView({
  starter,
}: {
  starter: typeof STARTERS[number];
}) {
  const r = starter.colorRgb;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: starter.bg }}>

      {/* Panel grid */}
      <div style={{
        position: "absolute", inset: 0,
        display: "grid",
        gridTemplateColumns: "55fr 45fr",
        gap: 3,
      }}>
        {/* Left — face close-up (dominant) */}
        <BlueprintPanel
          label="Face Close-up"
          image={starter.presetImage}
          objectPos="center 10%"
          lightingOverlay={`linear-gradient(to bottom, transparent 55%, rgba(8,10,18,0.18))`}
          accentRgb={r}
        />

        {/* Right — stacked 2 panels */}
        <div style={{
          display: "grid",
          gridTemplateRows: "1fr 1fr",
          gap: 3,
        }}>
          <BlueprintPanel
            label="Skin / Texture"
            image={starter.presetImage}
            objectPos="center 18%"
            lightingOverlay={`radial-gradient(ellipse at 50% 40%, rgba(${r},0.08) 0%, transparent 60%)`}
            accentRgb={r}
          />
          <ExpressionPlaceholder accentRgb={r} accentColor={starter.color} />
        </div>
      </div>

      {/* Header overlay */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
        padding: "12px 16px 22px",
        background: "linear-gradient(to bottom, rgba(8,10,18,0.88) 0%, rgba(8,10,18,0.50) 65%, transparent 100%)",
        pointerEvents: "none",
      }}>
        <div style={{
          fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.18em", textTransform: "uppercase",
        }}>
          Identity Lock Layer
        </div>
        <div style={{ fontSize: 11, color: T.textGhost, marginTop: 3 }}>
          Face · Skin · Expression Consistency
        </div>
      </div>
    </div>
  );
}

// ── Generating stage ──────────────────────────────────────────────────────────

function GeneratingStage() {
  return (
    <div style={{
      height: "100%", position: "relative", overflow: "hidden",
      background: "linear-gradient(170deg, #130e02, #090c13)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "65%", height: "58%",
        background: "radial-gradient(ellipse, rgba(245,158,11,0.16) 0%, transparent 70%)",
        animation: "ccGlowPulse 2s ease-in-out infinite",
        filter: "blur(4px)",
      }} />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, width: "40%",
          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.08), transparent)",
          animation: "ccShimmer 2.2s ease-in-out infinite",
        }} />
      </div>
      <div style={{
        position: "absolute", top: "16%", left: "18%", right: "18%",
        height: 1, background: "rgba(245,158,11,0.28)",
        animation: "ccSweep 2s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "19%", left: "18%", right: "18%",
        height: 1, background: "rgba(245,158,11,0.18)",
        animation: "ccSweep 2s ease-in-out infinite 0.7s",
      }} />
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.amber,
          letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: 20,
          animation: "ccSweep 1.5s ease-in-out infinite",
        }}>
          Generating Soul ID
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, marginBottom: 12 }}>
          Building your character…
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.7 }}>
          Embedding identity  ·  Locking visual DNA<br />
          Calibrating consistency scores
        </div>
        <div style={{ marginTop: 36, width: 224, margin: "36px auto 0" }}>
          {[{ label: "Identity", w: "85%" }, { label: "Style DNA", w: "62%" }, { label: "Embedding", w: "38%" }].map(bar => (
            <div key={bar.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.textGhost }}>{bar.label}</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: bar.w, background: T.amber, borderRadius: 2, boxShadow: "0 0 10px rgba(245,158,11,0.55)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Character result stage (Hero view with generated character) ────────────────

function CharacterResultStage({
  character, soul, mode,
}: {
  character: Character; soul: SoulId | null; mode: CharacterMode;
}) {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setParallax({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 8,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 5,
    });
  }, []);
  const handleMouseLeave = useCallback(() => setParallax({ x: 0, y: 0 }), []);

  return (
    <div
      style={{ position: "relative", height: "100%", overflow: "hidden" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(170deg, #130e02 0%, #0d0a02 45%, #090c13 100%)",
      }} />

      {/* Breathing ambient glow */}
      <div style={{
        position: "absolute", top: "4%", left: "50%",
        width: "82%", height: "74%",
        background: "radial-gradient(ellipse at 50% 34%, rgba(245,158,11,0.26) 0%, transparent 64%)",
        animation: "ccBreathe 3.8s ease-in-out infinite",
        filter: "blur(4px)",
        pointerEvents: "none",
      }} />

      {/* Parallax layer */}
      <div style={{
        position: "absolute", inset: 0,
        transform: `translate(${parallax.x}px, ${parallax.y}px)`,
        transition: "transform 0.28s ease-out",
        pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", top: "2%", left: "50%",
          height: "78%", aspectRatio: "200/420",
          animation: "ccFloat 6.5s ease-in-out infinite",
        }}>
          <NovaSilhouette color={T.amber} />
        </div>
      </div>

      {/* Vignettes */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to right, rgba(8,10,18,0.55) 0%, transparent 22%, transparent 78%, rgba(8,10,18,0.55) 100%)",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "70%",
        background: "linear-gradient(to top, rgba(8,10,18,1) 0%, rgba(8,10,18,0.90) 22%, rgba(8,10,18,0.55) 44%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Info overlay */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "52px 22px 22px" }}>
        <ConsistencyChips />
        <div style={{
          fontSize: 40, fontWeight: 800, color: T.textPrimary,
          letterSpacing: "-0.036em", marginBottom: 8,
          textShadow: "0 2px 28px rgba(0,0,0,0.65)",
        }}>
          {character.name}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.amber,
          letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16,
        }}>
          {character.notes ?? "AI Character"}  ·  {mode} mode
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
          {["Cinematic", "Editorial"].map(tag => (
            <div key={tag} style={{
              padding: "5px 13px", borderRadius: 20,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.26)",
              color: T.amber, fontSize: 12, fontWeight: 600,
            }}>{tag}</div>
          ))}
          {soul && (
            <div style={{
              padding: "5px 13px", borderRadius: 20,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.26)",
              color: "#10b981", fontSize: 12, fontWeight: 600,
            }}>Soul ID Active</div>
          )}
        </div>
        <CrossStudioPortals />
      </div>
    </div>
  );
}

// ── Version badge, overview card, hover action bar ────────────────────────────

function VersionBadge({ versions, activeVersionId }: {
  versions: CharacterVersion[]; activeVersionId: string | null;
}) {
  if (versions.length === 0) return null;
  const idx = activeVersionId ? versions.findIndex(v => v.id === activeVersionId) : 0;
  return (
    <div style={{
      position: "absolute", top: 14, left: 14, zIndex: 10,
      padding: "5px 12px", borderRadius: 6,
      background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.09)",
      fontSize: 11, fontWeight: 700, color: T.textSec,
      backdropFilter: "blur(8px)",
    }}>
      v{idx + 1} / {versions.length}
    </div>
  );
}

function OverviewCard({ character, soul, visible }: {
  character: Character; soul: SoulId | null; visible: boolean;
}) {
  const consistency = soul?.consistency_score ? Math.round(soul.consistency_score * 100) : 87;
  const identity    = soul?.identity_strength  ? Math.round(soul.identity_strength * 100) : 92;
  return (
    <div style={{
      position: "absolute", top: 14, right: 14, width: 202,
      padding: "14px 16px", borderRadius: 12,
      background: "rgba(8,10,18,0.82)",
      border: "1px solid rgba(255,255,255,0.09)",
      backdropFilter: "blur(18px)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(-6px)",
      transition: "all 0.2s ease", pointerEvents: visible ? "all" : "none", zIndex: 5,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>{character.name}</div>
      <div style={{ fontSize: 11, color: T.amber, fontWeight: 600, marginBottom: 14, letterSpacing: "0.05em" }}>
        {character.notes ?? "AI Character"}
      </div>
      {[{ label: "Consistency", value: consistency, color: T.amber }, { label: "Identity", value: identity, color: "#3b82f6" }].map(s => (
        <div key={s.label} style={{ marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${s.value}%`, background: s.color, borderRadius: 2, boxShadow: `0 0 8px ${s.color}55` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HoverActionBar({ mode, onModeAction, visible }: {
  mode: CharacterMode; onModeAction: (m: CharacterMode) => void; visible: boolean;
}) {
  const actions: Array<{ label: string; mode: CharacterMode }> = [
    { label: "Refine",   mode: "refine"   },
    { label: "Lookbook", mode: "lookbook" },
    { label: "Scene",    mode: "scene"    },
    { label: "Animate",  mode: "motion"   },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      padding: "44px 22px 20px",
      background: "linear-gradient(to top, rgba(8,10,18,0.97), transparent)",
      display: "flex", alignItems: "center", gap: 9,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: "all 0.2s ease",
      pointerEvents: visible ? "all" : "none", zIndex: 5,
    }}>
      <button onClick={() => onModeAction("base")} style={{
        padding: "11px 20px", borderRadius: 9,
        background: "linear-gradient(135deg, #b45309, #f59e0b)",
        border: "none", color: "#090c13",
        fontSize: 13, fontWeight: 800, cursor: "pointer",
        boxShadow: "0 0 20px rgba(245,158,11,0.36)",
      }}>✦ Generate New</button>
      {actions.map(a => (
        <button key={a.mode} onClick={() => onModeAction(a.mode)} style={{
          padding: "10px 15px", borderRadius: 9,
          border: mode === a.mode ? "1px solid rgba(245,158,11,0.48)" : "1px solid rgba(255,255,255,0.10)",
          background: mode === a.mode ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.05)",
          color: mode === a.mode ? T.amber : T.textSec,
          fontSize: 12, fontWeight: mode === a.mode ? 700 : 500,
          cursor: "pointer", backdropFilter: "blur(8px)", transition: "all 0.15s",
        }}>{a.label}</button>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterCanvas({
  mode, character, soul, isGenerating,
  versions, activeVersionId, onModeAction,
}: CharacterCanvasProps) {
  const [canvasMode,  setCanvasMode]  = useState<CanvasMode>("hero");
  const [starterIdx,  setStarterIdx]  = useState<StarterIdx>(0);
  const [hovered,     setHovered]     = useState(false);

  const starter     = STARTERS[starterIdx];
  const accentColor = character ? T.amber : starter.color;

  const handleCycle = useCallback((next: StarterIdx) => {
    setStarterIdx(next);
  }, []);

  // Resolve which content to show inside the stage
  function renderStageContent() {
    if (isGenerating) return <GeneratingStage />;

    // Blueprint and Identity modes — always show multi-panel layout
    if (canvasMode === "blueprint") return <BlueprintView starter={starter} />;
    if (canvasMode === "identity")  return <IdentityView starter={starter} />;

    // Hero mode — character result vs starter preview
    if (character) return <CharacterResultStage character={character} soul={soul} mode={mode} />;

    return (
      <CinematicStarterPreview
        key={starterIdx}
        idx={starterIdx}
        onCycle={handleCycle}
        onBuild={() => onModeAction("base")}
      />
    );
  }

  return (
    <div style={{ height: "100%", minHeight: 580, display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Canvas mode switcher */}
      <CanvasModeSwitcher active={canvasMode} onChange={setCanvasMode} />

      {/* Hairline divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />

      {/* Stage wrapper — centers inner frame, handles aspect ratio */}
      <div
        style={{
          flex: 1, minHeight: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", position: "relative",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Inner stage — aspect ratio constrained per mode */}
        <div style={getStageStyle(canvasMode, accentColor)}>
          {renderStageContent()}

          {/* Character overlays (only in Hero mode with loaded character) */}
          {character && !isGenerating && canvasMode === "hero" && (
            <>
              <VersionBadge versions={versions} activeVersionId={activeVersionId} />
              <OverviewCard character={character} soul={soul} visible={hovered} />
              <HoverActionBar mode={mode} onModeAction={onModeAction} visible={hovered} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
