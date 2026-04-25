"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterCanvas — cinematic hero stage (Phase 3D visual tuning pass)
// Typography: 38px name, 14px type/tagline, 12px tags
// Image: real <img> with onError fallback to cinematic gradient + silhouette
// Stronger bloom, vignette, rim light
// Props interface UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
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

// ── Starter data ──────────────────────────────────────────────────────────────

const STARTERS = [
  {
    name: "Nova Reyes",
    type: "AI Influencer",
    tagline: "Bold & empowered creator",
    color: "#f59e0b",
    colorDim: "rgba(245,158,11,0.15)",
    colorBorder: "rgba(245,158,11,0.28)",
    bg: "linear-gradient(170deg, #130e02 0%, #0d0a02 45%, #080b10 100%)",
    glowColor: "rgba(245,158,11,0.26)",
    glowColorSoft: "rgba(245,158,11,0.08)",
    styleDna: ["Cinematic", "Editorial", "Bold"],
    presetImage: "/zencralabs/characters/presets/nova-reyes.jpg",
  },
  {
    name: "Marcus Veld",
    type: "Brand Avatar",
    tagline: "Professional, minimal presence",
    color: "#3b82f6",
    colorDim: "rgba(59,130,246,0.15)",
    colorBorder: "rgba(59,130,246,0.28)",
    bg: "linear-gradient(170deg, #020912 0%, #030c18 45%, #080b10 100%)",
    glowColor: "rgba(59,130,246,0.20)",
    glowColorSoft: "rgba(59,130,246,0.06)",
    styleDna: ["Minimal", "Clean", "Professional"],
    presetImage: "/zencralabs/characters/presets/marcus-veld.jpg",
  },
  {
    name: "Zara Onyx",
    type: "AI Influencer",
    tagline: "Edgy editorial aesthetic",
    color: "#a855f7",
    colorDim: "rgba(168,85,247,0.15)",
    colorBorder: "rgba(168,85,247,0.28)",
    bg: "linear-gradient(170deg, #0c0214 0%, #100318 45%, #080b10 100%)",
    glowColor: "rgba(168,85,247,0.20)",
    glowColorSoft: "rgba(168,85,247,0.06)",
    styleDna: ["Edgy", "Editorial", "Street"],
    presetImage: "/zencralabs/characters/presets/zara-onyx.jpg",
  },
] as const;

type StarterIdx = 0 | 1 | 2;

// ── Preview tabs ──────────────────────────────────────────────────────────────

type PreviewTab = "Hero" | "Profile" | "Story" | "Assets";
const TABS: PreviewTab[] = ["Hero", "Profile", "Story", "Assets"];

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
`;

// ── Nova Reyes silhouette (editorial, flowing gown) ────────────────────────────

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
      <ellipse cx="62"  cy="108" rx="62" ry="88"  fill="url(#ng2)" />
      {/* Hair — long flowing left */}
      <path d="M72 38 C56 22, 36 18, 30 36 C24 54, 30 82, 38 108 C44 128, 43 152, 39 178 C36 196, 34 212, 36 228"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" opacity="0.80" />
      <path d="M100 26 C118 16, 140 18, 146 34 C150 46, 144 60, 134 68"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M88 28 C94 18, 102 14, 110 16"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.60" />
      {/* Head */}
      <ellipse cx="102" cy="65" rx="30" ry="36"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.08" />
      {/* Neck */}
      <path d="M93 100 L91 124 M111 100 L113 124"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.60" />
      {/* Shoulders */}
      <path d="M38 132 C58 120, 78 116, 94 120"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M110 120 C126 116, 146 120, 164 132"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Arms */}
      <path d="M42 136 C32 155, 24 180, 22 205 C20 220, 20 234, 22 248"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M158 136 C168 155, 174 178, 174 200"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      {/* Torso */}
      <path d="M56 132 C54 168, 54 204, 58 230 L144 230 C148 204, 148 168, 146 132 Z"
        stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.06" />
      {/* Waist */}
      <path d="M58 228 C75 235, 95 238, 102 238 C109 238, 129 235, 144 228"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.45" />
      {/* Dress */}
      <path d="M58 230 C48 264, 34 306, 18 352 C10 376, 8 396, 10 416 L192 416 C194 396, 192 376, 184 352 C168 306, 154 264, 144 230 Z"
        stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.10" />
      {/* Fabric folds */}
      <path d="M94 232 C88 266, 80 306, 68 352"
        stroke={color} strokeWidth="0.8" fill="none" opacity="0.32" />
      <path d="M114 232 C120 266, 128 306, 140 352"
        stroke={color} strokeWidth="0.8" fill="none" opacity="0.32" />
      {/* Rim light — studio left */}
      <path d="M40 128 C34 148, 26 172, 22 196"
        stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M162 130 C170 148, 174 165, 174 182"
        stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Marcus Veld silhouette (professional suit) ────────────────────────────────

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
      <ellipse cx="100" cy="52" rx="32" ry="18"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.18" />
      <ellipse cx="100" cy="70" rx="28" ry="34"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.08" />
      <path d="M94 103 L92 124 M106 103 L108 124"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.60" />
      <path d="M90 124 L96 136 L100 130 L104 136 L110 124"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.65" />
      <path d="M28 138 C50 124, 74 120, 92 124"
        stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M108 124 C126 120, 150 124, 172 138"
        stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M70 136 C78 148, 86 158, 90 170 L100 152 L110 170 C114 158, 122 148, 130 136"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.58" />
      <path d="M36 142 C30 165, 28 192, 28 222 L44 222 C46 192, 48 165, 52 142"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.07" />
      <path d="M164 142 C170 165, 172 192, 172 222 L156 222 C154 192, 152 165, 148 142"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.07" />
      <path d="M52 142 C50 180, 50 218, 52 256 L148 256 C150 218, 150 180, 148 142 Z"
        stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.08" />
      <line x1="100" y1="172" x2="100" y2="254"
        stroke={color} strokeWidth="0.8" opacity="0.45" />
      <circle cx="100" cy="192" r="2.4" fill={color} opacity="0.45" />
      <circle cx="100" cy="210" r="2.4" fill={color} opacity="0.45" />
      <circle cx="100" cy="228" r="2.4" fill={color} opacity="0.45" />
      <path d="M52 256 C50 295, 48 340, 48 384 L96 384 L100 320 L104 384 L152 384 C152 340, 150 295, 148 256 Z"
        stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.09" />
      <path d="M30 132 C24 155, 22 182, 24 210"
        stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ── Zara Onyx silhouette (edgy, voluminous hair) ──────────────────────────────

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
      <path d="M68 55 C48 32, 20 28, 14 50 C8 72, 18 95, 30 112 C40 126, 44 140, 40 158"
        stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.78" />
      <path d="M148 55 C168 32, 196 28, 200 52 C204 74, 192 98, 178 116 C168 130, 162 144, 164 162"
        stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.78" />
      <path d="M70 42 C80 24, 100 18, 110 16 C120 14, 136 18, 148 28"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" opacity="0.72" />
      <path d="M56 68 C42 55, 28 56, 22 70 C16 86, 22 108, 34 122"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.44" />
      <ellipse cx="110" cy="70" rx="28" ry="33"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.08" />
      <path d="M103 102 L101 122 M117 102 L119 122"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.60" />
      <path d="M46 130 C66 118, 86 114, 103 120"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M117 120 C134 116, 154 122, 170 134"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M52 134 C44 150, 38 168, 36 188 C34 202, 34 214, 40 222 C50 232, 64 228, 68 220"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M164 138 C174 158, 180 182, 178 205"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M62 136 C60 170, 60 204, 64 232 L156 232 C160 204, 160 170, 158 136 Z"
        stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.08" />
      <path d="M64 232 C54 260, 42 296, 34 336 C28 360, 26 382, 28 406 L116 406 L124 340 L158 406 L192 406 C190 382, 184 360, 174 334 C162 294, 152 262, 144 232 Z"
        stroke={color} strokeWidth="0.9" fill={color} fillOpacity="0.10" />
      <line x1="120" y1="232" x2="120" y2="340"
        stroke={color} strokeWidth="0.8" opacity="0.42" />
      <path d="M44 124 C36 148, 30 175, 28 204"
        stroke="rgba(255,255,255,0.20)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// ── Starter silhouette switcher ────────────────────────────────────────────────

function StarterSilhouette({ idx }: { idx: StarterIdx }) {
  const { color } = STARTERS[idx];
  if (idx === 0) return <NovaSilhouette color={color} />;
  if (idx === 1) return <MarcusSilhouette color={color} />;
  return <ZaraSilhouette color={color} />;
}

// ── Cinematic starter preview ─────────────────────────────────────────────────

function CinematicStarterPreview({
  idx, onCycle, onBuild,
}: {
  idx: StarterIdx;
  onCycle: (next: StarterIdx) => void;
  onBuild: () => void;
}) {
  const starter = STARTERS[idx];
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const showSilhouette = imgError || !imgLoaded;

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      {/* Background */}
      <div style={{
        position: "absolute", inset: 0,
        background: starter.bg, transition: "background 0.5s ease",
      }} />

      {/* Primary ambient bloom — behind figure */}
      <div style={{
        position: "absolute",
        top: "4%", left: "50%", transform: "translateX(-50%)",
        width: "82%", height: "72%",
        background: `radial-gradient(ellipse at 50% 36%, ${starter.glowColor} 0%, transparent 65%)`,
        pointerEvents: "none", transition: "all 0.5s ease",
        filter: "blur(2px)",
      }} />

      {/* Secondary deep glow */}
      <div style={{
        position: "absolute",
        bottom: "18%", left: "28%",
        width: "62%", height: "46%",
        background: `radial-gradient(ellipse, ${starter.glowColorSoft} 0%, transparent 70%)`,
        filter: "blur(32px)",
        pointerEvents: "none",
      }} />

      {/* Real image — try preset photo */}
      {!imgError && (
        <img
          key={starter.presetImage}
          src={starter.presetImage}
          alt={starter.name}
          onLoad={() => setImgLoaded(true)}
          onError={() => { setImgError(true); setImgLoaded(false); }}
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            width: "100%",
            height: "80%",
            objectFit: "cover",
            objectPosition: "center top",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.4s ease",
            animation: imgLoaded ? "ccImgFade 0.4s ease" : "none",
          }}
        />
      )}

      {/* Silhouette fallback — shown while img loading or on error */}
      {showSilhouette && (
        <div style={{
          position: "absolute",
          top: "2%",
          left: "50%",
          height: "76%",
          aspectRatio: "200/420",
          animation: "ccFloat 6.5s ease-in-out infinite",
        }}>
          <StarterSilhouette idx={idx} />
        </div>
      )}

      {/* Vignette — bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
        background: "linear-gradient(to top, rgba(8,10,18,1) 0%, rgba(8,10,18,0.85) 30%, rgba(8,10,18,0.5) 60%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Vignette — sides */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to right, rgba(8,10,18,0.55) 0%, transparent 25%, transparent 75%, rgba(8,10,18,0.55) 100%)",
      }} />

      {/* Bottom info overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "56px 28px 24px",
      }}>
        {/* Name */}
        <div style={{
          fontSize: 38, fontWeight: 800, color: "#f0f2f8",
          letterSpacing: "-0.035em", lineHeight: 1.08,
          marginBottom: 8,
          animation: "ccFadeUp 0.35s ease forwards",
          textShadow: "0 2px 24px rgba(0,0,0,0.6)",
        }}>
          {starter.name}
        </div>

        {/* Type · tagline */}
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: starter.color,
          letterSpacing: "0.04em", textTransform: "uppercase",
          marginBottom: 18,
          textShadow: `0 0 20px ${starter.glowColor}`,
        }}>
          {starter.type}  ·  {starter.tagline}
        </div>

        {/* Style DNA tags */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
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

        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Dot indicators */}
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

          {/* Build CTA */}
          <button
            onClick={onBuild}
            style={{
              marginLeft: "auto",
              padding: "12px 26px", borderRadius: 10,
              background: "linear-gradient(135deg, #b45309, #f59e0b)",
              color: "#080b10", fontSize: 14, fontWeight: 800,
              border: "none", cursor: "pointer",
              letterSpacing: "0.02em",
              boxShadow: "0 0 30px rgba(245,158,11,0.40), 0 4px 16px rgba(0,0,0,0.4)",
              transition: "all 0.15s",
            }}
          >
            Build This Character →
          </button>
        </div>
      </div>

      {/* Cycle arrows */}
      {(["left", "right"] as const).map(side => (
        <button key={side}
          onClick={() => onCycle(
            side === "left"
              ? ((idx - 1 + 3) % 3) as StarterIdx
              : ((idx + 1) % 3) as StarterIdx
          )}
          style={{
            position: "absolute",
            [side]: 14, top: "40%", transform: "translateY(-50%)",
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(0,0,0,0.52)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.70)", fontSize: 22, fontWeight: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(10px)",
            transition: "all 0.15s",
          }}
        >
          {side === "left" ? "‹" : "›"}
        </button>
      ))}

      {/* Preview badge */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        padding: "4px 10px", borderRadius: 5,
        background: "rgba(0,0,0,0.56)", border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.36)",
        letterSpacing: "0.16em", textTransform: "uppercase",
        backdropFilter: "blur(8px)",
      }}>
        PREVIEW
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
        position: "absolute",
        top: "20%", left: "50%", transform: "translateX(-50%)",
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
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 12, width: 224, margin: "36px auto 0" }}>
          {[
            { label: "Identity",  w: "85%" },
            { label: "Style DNA", w: "62%" },
            { label: "Embedding", w: "38%" },
          ].map(bar => (
            <div key={bar.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.textGhost }}>{bar.label}</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", width: bar.w,
                  background: T.amber, borderRadius: 2,
                  boxShadow: "0 0 10px rgba(245,158,11,0.55)",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Character result stage ────────────────────────────────────────────────────

function CharacterResultStage({
  character, soul, mode,
}: {
  character: Character; soul: SoulId | null; mode: CharacterMode;
}) {
  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(170deg, #130e02 0%, #0d0a02 45%, #090c13 100%)",
      }} />
      <div style={{
        position: "absolute",
        top: "6%", left: "50%", transform: "translateX(-50%)",
        width: "78%", height: "70%",
        background: "radial-gradient(ellipse at 50% 36%, rgba(245,158,11,0.22) 0%, transparent 65%)",
        pointerEvents: "none", filter: "blur(2px)",
      }} />
      {/* Silhouette */}
      <div style={{
        position: "absolute",
        top: "2%", left: "50%",
        height: "76%", aspectRatio: "200/420",
        animation: "ccFloat 6.5s ease-in-out infinite",
      }}>
        <NovaSilhouette color={T.amber} />
      </div>
      {/* Vignette */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
        background: "linear-gradient(to top, rgba(8,10,18,1) 0%, rgba(8,10,18,0.8) 28%, transparent 100%)",
        pointerEvents: "none",
      }} />
      {/* Info overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "52px 28px 22px",
      }}>
        <div style={{
          fontSize: 38, fontWeight: 800, color: T.textPrimary,
          letterSpacing: "-0.03em", marginBottom: 7,
          textShadow: "0 2px 24px rgba(0,0,0,0.6)",
        }}>
          {character.name}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.amber,
          letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16,
        }}>
          {character.notes ?? "AI Character"}  ·  {mode} mode
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {["Cinematic", "Editorial"].map(tag => (
            <div key={tag} style={{
              padding: "5px 13px", borderRadius: 20,
              background: "rgba(245,158,11,0.13)",
              border: "1px solid rgba(245,158,11,0.26)",
              color: T.amber, fontSize: 12, fontWeight: 600,
            }}>{tag}</div>
          ))}
          {soul && (
            <div style={{
              marginLeft: "auto", padding: "5px 13px", borderRadius: 20,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.26)",
              color: "#10b981", fontSize: 12, fontWeight: 600,
            }}>Soul ID Active</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Preview tabs strip ─────────────────────────────────────────────────────────

function PreviewTabsBar({
  active, onChange, color,
}: {
  active: PreviewTab; onChange: (t: PreviewTab) => void; color: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "10px 16px 0", gap: 2, flexShrink: 0,
    }}>
      {TABS.map(tab => {
        const isActive = tab === active;
        return (
          <button key={tab}
            onClick={() => onChange(tab)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
              background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
              color: isActive ? color : T.textMuted,
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
              letterSpacing: "0.02em",
            }}
          >
            {tab}
          </button>
        );
      })}
      <div style={{ marginLeft: "auto", paddingRight: 4 }}>
        <div style={{
          padding: "4px 11px", borderRadius: 6,
          background: `${color}14`, border: `1px solid ${color}28`,
          fontSize: 11, fontWeight: 700, color,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {active}
        </div>
      </div>
    </div>
  );
}

// ── Version badge ─────────────────────────────────────────────────────────────

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

// ── Floating overview card ────────────────────────────────────────────────────

function OverviewCard({ character, soul, visible }: {
  character: Character; soul: SoulId | null; visible: boolean;
}) {
  const consistency = soul?.consistency_score ? Math.round(soul.consistency_score * 100) : 87;
  const identity    = soul?.identity_strength  ? Math.round(soul.identity_strength * 100)  : 92;

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
      <div style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>
        {character.name}
      </div>
      <div style={{ fontSize: 11, color: T.amber, fontWeight: 600, marginBottom: 14, letterSpacing: "0.05em" }}>
        {character.notes ?? "AI Character"}
      </div>
      {[
        { label: "Consistency", value: consistency, color: T.amber },
        { label: "Identity",    value: identity,    color: "#3b82f6" },
      ].map(s => (
        <div key={s.label} style={{ marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
            <div style={{
              height: "100%", width: `${s.value}%`,
              background: s.color, borderRadius: 2,
              boxShadow: `0 0 8px ${s.color}55`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hover action bar ──────────────────────────────────────────────────────────

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
      }}>
        ✦ Generate New
      </button>
      {actions.map(a => (
        <button key={a.mode} onClick={() => onModeAction(a.mode)} style={{
          padding: "10px 15px", borderRadius: 9,
          border: mode === a.mode ? "1px solid rgba(245,158,11,0.48)" : "1px solid rgba(255,255,255,0.10)",
          background: mode === a.mode ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.05)",
          color: mode === a.mode ? T.amber : T.textSec,
          fontSize: 12, fontWeight: mode === a.mode ? 700 : 500,
          cursor: "pointer", backdropFilter: "blur(8px)", transition: "all 0.15s",
        }}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterCanvas({
  mode, character, soul, isGenerating,
  versions, activeVersionId, onModeAction,
}: CharacterCanvasProps) {
  const [activeTab,  setActiveTab]  = useState<PreviewTab>("Hero");
  const [starterIdx, setStarterIdx] = useState<StarterIdx>(0);
  const [hovered,    setHovered]    = useState(false);

  const accentColor = character
    ? T.amber
    : STARTERS[starterIdx].color;

  return (
    <div style={{ height: "100%", minHeight: 580, display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Preview tabs */}
      <PreviewTabsBar active={activeTab} onChange={setActiveTab} color={accentColor} />

      {/* Hairline divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />

      {/* Hero stage — flex:1 */}
      <div
        style={{
          flex: 1, minHeight: 0,
          position: "relative", overflow: "hidden",
          borderRadius: "0 0 16px 16px",
          boxShadow: [
            "0 0 0 1px rgba(255,255,255,0.04)",
            `0 0 100px ${accentColor}0d`,
            "0 24px 80px rgba(0,0,0,0.75)",
          ].join(", "),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isGenerating ? (
          <GeneratingStage />
        ) : character ? (
          <CharacterResultStage character={character} soul={soul} mode={mode} />
        ) : (
          <CinematicStarterPreview
            idx={starterIdx}
            onCycle={setStarterIdx}
            onBuild={() => onModeAction("base")}
          />
        )}

        {character && !isGenerating && (
          <>
            <VersionBadge versions={versions} activeVersionId={activeVersionId} />
            <OverviewCard character={character} soul={soul} visible={hovered} />
            <HoverActionBar mode={mode} onModeAction={onModeAction} visible={hovered} />
          </>
        )}
      </div>
    </div>
  );
}
