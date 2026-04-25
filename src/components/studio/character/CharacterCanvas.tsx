"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterCanvas — cinematic hero stage (Phase 3D layout rebuild)
// Default state: cinematic starter preview (Nova Reyes) with large portrait
// Preview tabs: Hero | Profile | Story | Assets
// Character image occupies ≥75% of stage height
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
    colorBorder: "rgba(245,158,11,0.25)",
    bg: "linear-gradient(170deg, #110c01 0%, #0d0a02 50%, #090c13 100%)",
    glowColor: "rgba(245,158,11,0.18)",
    styleDna: ["Cinematic", "Editorial", "Bold"],
  },
  {
    name: "Marcus Veld",
    type: "Brand Avatar",
    tagline: "Professional, minimal",
    color: "#3b82f6",
    colorDim: "rgba(59,130,246,0.15)",
    colorBorder: "rgba(59,130,246,0.25)",
    bg: "linear-gradient(170deg, #020812 0%, #030c18 50%, #090c13 100%)",
    glowColor: "rgba(59,130,246,0.14)",
    styleDna: ["Minimal", "Clean", "Professional"],
  },
  {
    name: "Zara Onyx",
    type: "AI Influencer",
    tagline: "Edgy editorial aesthetic",
    color: "#a855f7",
    colorDim: "rgba(168,85,247,0.15)",
    colorBorder: "rgba(168,85,247,0.25)",
    bg: "linear-gradient(170deg, #0c0214 0%, #100318 50%, #090c13 100%)",
    glowColor: "rgba(168,85,247,0.14)",
    styleDna: ["Edgy", "Editorial", "Street"],
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
@keyframes ccFadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes ccFloat     { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-8px)} }
@keyframes ccShimmer   { 0%{transform:translateX(-120%)} 100%{transform:translateX(220%)} }
@keyframes ccSweep     { 0%{opacity:0.4} 50%{opacity:0.9} 100%{opacity:0.4} }
@keyframes ccGlowPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
`;

// ── Nova Reyes silhouette (editorial, flowing gown) ────────────────────────────

function NovaSilhouette({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 420" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="ng1" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ng2" cx="28%" cy="25%" r="45%">
          <stop offset="0%" stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="185" rx="85" ry="168" fill="url(#ng1)" />
      <ellipse cx="62"  cy="108" rx="62" ry="88"  fill="url(#ng2)" />

      {/* Hair — long flowing left */}
      <path d="M72 38 C56 22, 36 18, 30 36 C24 54, 30 82, 38 108 C44 128, 43 152, 39 178 C36 196, 34 212, 36 228"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.72" />
      {/* Hair crown right */}
      <path d="M100 26 C118 16, 140 18, 146 34 C150 46, 144 60, 134 68"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.68" />
      {/* Hair crown detail */}
      <path d="M88 28 C94 18, 102 14, 110 16"
        stroke={color} strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.52" />

      {/* Head */}
      <ellipse cx="102" cy="65" rx="30" ry="36"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.06" />

      {/* Neck */}
      <path d="M93 100 L91 124 M111 100 L113 124"
        stroke={color} strokeWidth="1.0" strokeLinecap="round" opacity="0.52" />

      {/* Shoulders */}
      <path d="M38 132 C58 120, 78 116, 94 120"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M110 120 C126 116, 146 120, 164 132"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* Left arm — slight bend */}
      <path d="M42 136 C32 155, 24 180, 22 205 C20 220, 20 234, 22 248"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.80" />
      {/* Right arm */}
      <path d="M158 136 C168 155, 174 178, 174 200"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.80" />

      {/* Torso */}
      <path d="M56 132 C54 168, 54 204, 58 230 L144 230 C148 204, 148 168, 146 132 Z"
        stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.05" />

      {/* Neckline */}
      <path d="M76 130 C84 122, 92 118, 102 120 C112 118, 120 122, 128 130"
        stroke={color} strokeWidth="1.0" strokeLinecap="round" fill="none" opacity="0.48" />

      {/* Waist accent */}
      <path d="M58 228 C75 235, 95 238, 102 238 C109 238, 129 235, 144 228"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.38" />

      {/* Dress — dramatic editorial gown flare */}
      <path d="M58 230 C48 264, 34 306, 18 352 C10 376, 8 396, 10 416 L192 416 C194 396, 192 376, 184 352 C168 306, 154 264, 144 230 Z"
        stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.08" />

      {/* Dress fabric folds */}
      <path d="M94 232 C88 266, 80 306, 68 352"
        stroke={color} strokeWidth="0.7" fill="none" opacity="0.28" />
      <path d="M114 232 C120 266, 128 306, 140 352"
        stroke={color} strokeWidth="0.7" fill="none" opacity="0.28" />
      <path d="M104 232 C102 270, 100 310, 100 360"
        stroke={color} strokeWidth="0.5" fill="none" opacity="0.16" />

      {/* Rim light — studio left shoulder */}
      <path d="M40 128 C34 148, 26 172, 22 196"
        stroke="rgba(255,255,255,0.14)" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Rim light right */}
      <path d="M162 130 C170 148, 174 165, 174 182"
        stroke="rgba(255,255,255,0.07)" strokeWidth="2" strokeLinecap="round" fill="none" />
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
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="178" rx="78" ry="158" fill="url(#mg1)" />

      {/* Short hair cap */}
      <ellipse cx="100" cy="52" rx="32" ry="18"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.15" />

      {/* Head */}
      <ellipse cx="100" cy="70" rx="28" ry="34"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.06" />

      {/* Neck */}
      <path d="M94 103 L92 124 M106 103 L108 124"
        stroke={color} strokeWidth="1.0" strokeLinecap="round" opacity="0.52" />

      {/* Collar */}
      <path d="M90 124 L96 136 L100 130 L104 136 L110 124"
        stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.58" />

      {/* Broad suit shoulders */}
      <path d="M28 138 C50 124, 74 120, 92 124"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" />
      <path d="M108 124 C126 120, 150 124, 172 138"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" />

      {/* Jacket lapels */}
      <path d="M70 136 C78 148, 86 158, 90 170 L100 152 L110 170 C114 158, 122 148, 130 136"
        stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.52" />

      {/* Left arm */}
      <path d="M36 142 C30 165, 28 192, 28 222 L44 222 C46 192, 48 165, 52 142"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.05" />

      {/* Right arm */}
      <path d="M164 142 C170 165, 172 192, 172 222 L156 222 C154 192, 152 165, 148 142"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.05" />

      {/* Jacket body */}
      <path d="M52 142 C50 180, 50 218, 52 256 L148 256 C150 218, 150 180, 148 142 Z"
        stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.06" />

      {/* Centre button line */}
      <line x1="100" y1="172" x2="100" y2="254"
        stroke={color} strokeWidth="0.7" opacity="0.4" />
      <circle cx="100" cy="192" r="2.2" fill={color} opacity="0.4" />
      <circle cx="100" cy="210" r="2.2" fill={color} opacity="0.4" />
      <circle cx="100" cy="228" r="2.2" fill={color} opacity="0.4" />

      {/* Trousers */}
      <path d="M52 256 C50 295, 48 340, 48 384 L96 384 L100 320 L104 384 L152 384 C152 340, 150 295, 148 256 Z"
        stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.07" />

      {/* Trouser creases */}
      <path d="M72 256 C70 300, 68 340, 68 384"
        stroke={color} strokeWidth="0.5" fill="none" opacity="0.28" />
      <path d="M128 256 C130 300, 132 340, 132 384"
        stroke={color} strokeWidth="0.5" fill="none" opacity="0.28" />

      {/* Rim light */}
      <path d="M30 132 C24 155, 22 182, 24 210"
        stroke="rgba(255,255,255,0.14)" strokeWidth="3" strokeLinecap="round" />
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
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="185" rx="95" ry="170" fill="url(#zg1)" />

      {/* Voluminous hair — dramatic */}
      <path d="M68 55 C48 32, 20 28, 14 50 C8 72, 18 95, 30 112 C40 126, 44 140, 40 158"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" opacity="0.70" />
      <path d="M148 55 C168 32, 196 28, 200 52 C204 74, 192 98, 178 116 C168 130, 162 144, 164 162"
        stroke={color} strokeWidth="2.0" strokeLinecap="round" fill="none" opacity="0.70" />
      <path d="M70 42 C80 24, 100 18, 110 16 C120 14, 136 18, 148 28"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.65" />
      <path d="M56 68 C42 55, 28 56, 22 70 C16 86, 22 108, 34 122"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.38" />

      {/* Head */}
      <ellipse cx="110" cy="70" rx="28" ry="33"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.06" />

      {/* Neck */}
      <path d="M103 102 L101 122 M117 102 L119 122"
        stroke={color} strokeWidth="1.0" strokeLinecap="round" opacity="0.52" />

      {/* Shoulders — asymmetric pose */}
      <path d="M46 130 C66 118, 86 114, 103 120"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M117 120 C134 116, 154 122, 170 134"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* Left arm — hand on hip (bent) */}
      <path d="M52 134 C44 150, 38 168, 36 188 C34 202, 34 214, 40 222 C50 232, 64 228, 68 220"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.80" />
      {/* Right arm — relaxed */}
      <path d="M164 138 C174 158, 180 182, 178 205"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.80" />

      {/* Body */}
      <path d="M62 136 C60 170, 60 204, 64 232 L156 232 C160 204, 160 170, 158 136 Z"
        stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.06" />

      {/* Structured top detail */}
      <path d="M78 136 C76 155, 76 175, 78 195"
        stroke={color} strokeWidth="0.6" fill="none" opacity="0.33" />
      <path d="M142 136 C144 155, 144 175, 142 195"
        stroke={color} strokeWidth="0.6" fill="none" opacity="0.33" />

      {/* Skirt — asymmetric, structured */}
      <path d="M64 232 C54 260, 42 296, 34 336 C28 360, 26 382, 28 406 L116 406 L124 340 L158 406 L192 406 C190 382, 184 360, 174 334 C162 294, 152 262, 144 232 Z"
        stroke={color} strokeWidth="0.8" fill={color} fillOpacity="0.08" />

      {/* Slit detail */}
      <line x1="120" y1="232" x2="120" y2="340"
        stroke={color} strokeWidth="0.7" opacity="0.38" />

      {/* Rim light */}
      <path d="M44 124 C36 148, 30 175, 28 204"
        stroke="rgba(255,255,255,0.13)" strokeWidth="3" strokeLinecap="round" />
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

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      {/* Background */}
      <div style={{ position: "absolute", inset: 0, background: starter.bg, transition: "background 0.5s ease" }} />

      {/* Primary ambient glow — behind figure */}
      <div style={{
        position: "absolute",
        top: "8%", left: "50%", transform: "translateX(-50%)",
        width: "75%", height: "68%",
        background: `radial-gradient(ellipse at 50% 38%, ${starter.glowColor} 0%, transparent 68%)`,
        pointerEvents: "none",
        transition: "all 0.5s ease",
      }} />

      {/* Secondary soft glow */}
      <div style={{
        position: "absolute",
        bottom: "22%", left: "35%",
        width: "55%", height: "40%",
        background: `radial-gradient(ellipse, ${starter.glowColor.replace("0.14", "0.06").replace("0.18", "0.07")} 0%, transparent 70%)`,
        filter: "blur(24px)",
        pointerEvents: "none",
      }} />

      {/* The silhouette — 74% of stage height, centered, floating */}
      <div style={{
        position: "absolute",
        top: "2%",
        left: "50%",
        height: "74%",
        aspectRatio: "200/420",
        animation: "ccFloat 6.5s ease-in-out infinite",
      }}>
        <StarterSilhouette idx={idx} />
      </div>

      {/* Bottom info overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top, rgba(9,12,19,0.97) 0%, rgba(9,12,19,0.65) 58%, transparent 100%)",
        padding: "52px 28px 22px",
      }}>
        {/* Name */}
        <div style={{
          fontSize: 32, fontWeight: 800, color: "#e8eaf0",
          letterSpacing: "-0.03em", lineHeight: 1.1,
          marginBottom: 6,
          animation: "ccFadeUp 0.35s ease forwards",
        }}>
          {starter.name}
        </div>

        {/* Type · tagline */}
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: starter.color,
          letterSpacing: "0.05em", textTransform: "uppercase",
          marginBottom: 16,
        }}>
          {starter.type}  ·  {starter.tagline}
        </div>

        {/* Style DNA tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
          {starter.styleDna.map(tag => (
            <div key={tag} style={{
              padding: "4px 12px", borderRadius: 20,
              background: starter.colorDim,
              border: `1px solid ${starter.colorBorder}`,
              color: starter.color, fontSize: 11, fontWeight: 600,
            }}>
              {tag}
            </div>
          ))}
        </div>

        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {STARTERS.map((s, i) => (
              <button key={i}
                onClick={() => onCycle(i as StarterIdx)}
                style={{
                  width: i === idx ? 24 : 7, height: 7, borderRadius: 4,
                  background: i === idx ? s.color : "rgba(255,255,255,0.20)",
                  border: "none", cursor: "pointer",
                  transition: "all 0.22s ease", padding: 0,
                }}
              />
            ))}
          </div>

          {/* Build CTA */}
          <button
            onClick={onBuild}
            style={{
              marginLeft: "auto",
              padding: "11px 24px", borderRadius: 9,
              background: "linear-gradient(135deg, #b45309, #f59e0b)",
              color: "#090c13", fontSize: 13, fontWeight: 800,
              border: "none", cursor: "pointer",
              letterSpacing: "0.02em",
              boxShadow: "0 0 22px rgba(245,158,11,0.32)",
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
            [side]: 14, top: "42%", transform: "translateY(-50%)",
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(0,0,0,0.48)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.65)", fontSize: 20, fontWeight: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(8px)",
            transition: "all 0.15s",
          }}
        >
          {side === "left" ? "‹" : "›"}
        </button>
      ))}

      {/* Preview badge */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        padding: "3px 9px", borderRadius: 4,
        background: "rgba(0,0,0,0.52)", border: "1px solid rgba(255,255,255,0.07)",
        fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.32)",
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
      background: "linear-gradient(170deg, #110c01, #090c13)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        position: "absolute",
        top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "65%", height: "58%",
        background: "radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)",
        animation: "ccGlowPulse 2s ease-in-out infinite",
      }} />

      {/* Shimmer sweep */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, bottom: 0, width: "40%",
          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)",
          animation: "ccShimmer 2.2s ease-in-out infinite",
        }} />
      </div>

      {/* Scan lines */}
      <div style={{
        position: "absolute", top: "16%", left: "18%", right: "18%",
        height: 1, background: "rgba(245,158,11,0.22)",
        animation: "ccSweep 2s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "19%", left: "18%", right: "18%",
        height: 1, background: "rgba(245,158,11,0.16)",
        animation: "ccSweep 2s ease-in-out infinite 0.7s",
      }} />

      {/* Content */}
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.amber,
          letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: 18,
          animation: "ccSweep 1.5s ease-in-out infinite",
        }}>
          Generating Soul ID
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginBottom: 10 }}>
          Building your character…
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7 }}>
          Embedding identity  ·  Locking visual DNA<br />
          Calibrating consistency scores
        </div>

        {/* Progress bars */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10, width: 224, margin: "32px auto 0" }}>
          {[
            { label: "Identity",  w: "85%" },
            { label: "Style DNA", w: "62%" },
            { label: "Embedding", w: "38%" },
          ].map(bar => (
            <div key={bar.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textGhost }}>{bar.label}</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", width: bar.w,
                  background: T.amber, borderRadius: 2,
                  boxShadow: "0 0 8px rgba(245,158,11,0.5)",
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
        background: "linear-gradient(170deg, #110c01 0%, #0d0a02 50%, #090c13 100%)",
      }} />
      <div style={{
        position: "absolute",
        top: "8%", left: "50%", transform: "translateX(-50%)",
        width: "72%", height: "66%",
        background: "radial-gradient(ellipse at 50% 38%, rgba(245,158,11,0.16) 0%, transparent 68%)",
        pointerEvents: "none",
      }} />

      {/* Silhouette */}
      <div style={{
        position: "absolute",
        top: "2%", left: "50%",
        height: "74%", aspectRatio: "200/420",
        animation: "ccFloat 6.5s ease-in-out infinite",
      }}>
        <NovaSilhouette color={T.amber} />
      </div>

      {/* Info overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(to top, rgba(9,12,19,0.97) 0%, rgba(9,12,19,0.6) 55%, transparent 100%)",
        padding: "48px 28px 20px",
      }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.025em", marginBottom: 5 }}>
          {character.name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.amber, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
          {character.notes ?? "AI Character"}  ·  {mode} mode
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Cinematic", "Editorial"].map(tag => (
            <div key={tag} style={{
              padding: "4px 11px", borderRadius: 20,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.22)",
              color: T.amber, fontSize: 11, fontWeight: 600,
            }}>{tag}</div>
          ))}
          {soul && (
            <div style={{
              marginLeft: "auto", padding: "4px 11px", borderRadius: 20,
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.22)",
              color: "#10b981", fontSize: 11, fontWeight: 600,
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
              padding: "7px 14px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
              background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
              color: isActive ? color : T.textMuted,
              fontSize: 12, fontWeight: isActive ? 700 : 500,
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
          padding: "4px 10px", borderRadius: 6,
          background: `${color}14`, border: `1px solid ${color}28`,
          fontSize: 10, fontWeight: 700, color,
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
      padding: "4px 10px", borderRadius: 6,
      background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)",
      fontSize: 10, fontWeight: 700, color: T.textSec,
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
      position: "absolute", top: 14, right: 14, width: 192,
      padding: "13px 15px", borderRadius: 12,
      background: "rgba(9,12,19,0.78)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(16px)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(-6px)",
      transition: "all 0.2s ease", pointerEvents: visible ? "all" : "none", zIndex: 5,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>
        {character.name}
      </div>
      <div style={{ fontSize: 10, color: T.amber, fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em" }}>
        {character.notes ?? "AI Character"}
      </div>
      {[
        { label: "Consistency", value: consistency, color: T.amber },
        { label: "Identity",    value: identity,    color: "#3b82f6" },
      ].map(s => (
        <div key={s.label} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${s.value}%`, background: s.color, borderRadius: 2 }} />
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
      padding: "40px 20px 18px",
      background: "linear-gradient(to top, rgba(9,12,19,0.96), transparent)",
      display: "flex", alignItems: "center", gap: 8,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(8px)",
      transition: "all 0.2s ease",
      pointerEvents: visible ? "all" : "none", zIndex: 5,
    }}>
      <button onClick={() => onModeAction("base")} style={{
        padding: "10px 18px", borderRadius: 8,
        background: "linear-gradient(135deg, #b45309, #f59e0b)",
        border: "none", color: "#090c13",
        fontSize: 12, fontWeight: 800, cursor: "pointer",
        boxShadow: "0 0 16px rgba(245,158,11,0.3)",
      }}>
        ✦ Generate New
      </button>
      {actions.map(a => (
        <button key={a.mode} onClick={() => onModeAction(a.mode)} style={{
          padding: "9px 14px", borderRadius: 8,
          border: mode === a.mode ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.10)",
          background: mode === a.mode ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
          color: mode === a.mode ? T.amber : T.textSec,
          fontSize: 11, fontWeight: mode === a.mode ? 700 : 500,
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
            `0 0 80px ${accentColor}0a`,
            "0 24px 80px rgba(0,0,0,0.7)",
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
