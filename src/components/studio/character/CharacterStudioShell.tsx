"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterStudioShell — Master layout (Phase 3D layout rebuild)
//
// STRUCTURE:
//   height: 100vh, paddingTop: 80px (navbar), overflow: hidden
//   └── TopBar          (flexShrink: 0, ~50px)
//   └── SoulCommandBar  (flexShrink: 0, only when character active)
//   └── Three panels    (flex: 1, overflow: hidden)
//       ├── Left  320px  — CharacterBuilder (scrollable internally)
//       ├── Center 1fr   — CharacterCanvas  (fills height)
//       └── Right 360px  — CharacterIntelligencePanel (scrollable internally)
//   └── WorkflowStrip   (flexShrink: 0, always visible at bottom)
//
// StarterCharacters moved into left panel compact section.
// No page scroll. No footer visible within studio.
// Grid: 320px minmax(0,1fr) 360px
// State, API, props, routing all UNCHANGED.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from "react";
import { useAuth }  from "@/components/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import type { CharacterMode, Character, SoulId, CharacterVersion } from "@/lib/character";
import type { CharacterAsset } from "@/lib/character";

import CharacterCanvas            from "./CharacterCanvas";
import CharacterBuilder           from "./CharacterBuilder";
import type { BuildPayload }      from "./CharacterBuilder";
import CharacterIntelligencePanel from "./CharacterIntelligencePanel";
import SoulCommandBar             from "./SoulCommandBar";
import WorkflowStrip              from "./WorkflowStrip";
import CrossStudioBridge          from "./CrossStudioBridge";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  body:        "#090c13",
  topBar:      "#0a0d1a",
  border:      "#1a2035",
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.10)",
  amberBorder: "rgba(245,158,11,0.25)",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Mode definitions ──────────────────────────────────────────────────────────

const MODES: Array<{ key: CharacterMode; label: string }> = [
  { key: "base",     label: "Build"    },
  { key: "refine",   label: "Refine"   },
  { key: "lookbook", label: "Lookbook" },
  { key: "scene",    label: "Scene"    },
  { key: "motion",   label: "Animate"  },
];

// ── Compact starter row (inside left panel) ───────────────────────────────────

const QUICK_STARTERS = [
  { name: "Nova Reyes", type: "AI Influencer", color: "#f59e0b" },
  { name: "Marcus Veld", type: "Brand Avatar",  color: "#3b82f6" },
  { name: "Zara Onyx",  type: "AI Influencer", color: "#a855f7" },
] as const;

function QuickStartRow({ onSelect }: {
  onSelect: (name: string, type: string) => void;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 10, fontWeight: 900, color: T.textGhost,
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
      }}>
        Quick Start
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {QUICK_STARTERS.map(s => (
          <button key={s.name}
            onClick={() => onSelect(s.name, s.type)}
            style={{
              flex: 1, padding: "8px 4px", borderRadius: 8,
              border: `1px solid ${s.color}22`,
              background: `${s.color}08`,
              color: s.color, fontSize: 11, fontWeight: 700,
              cursor: "pointer", textAlign: "center",
              transition: "all 0.15s", lineHeight: 1.4,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `${s.color}16`;
              (e.currentTarget as HTMLElement).style.borderColor = `${s.color}38`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = `${s.color}08`;
              (e.currentTarget as HTMLElement).style.borderColor = `${s.color}22`;
            }}
          >
            {s.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <div style={{
        marginTop: 10, fontSize: 10, color: T.textGhost,
        textAlign: "center",
      }}>
        or build from scratch below
      </div>
    </div>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────────

function TopBar({
  character, activeMode, onModeChange, onSave,
}: {
  character: Character | null;
  activeMode: CharacterMode;
  onModeChange: (m: CharacterMode) => void;
  onSave: () => void;
}) {
  return (
    <div style={{
      width: "100%", background: T.topBar,
      borderBottom: `1px solid ${T.border}`,
      display: "flex", alignItems: "center",
      padding: "10px 24px", gap: 16,
      flexShrink: 0, boxSizing: "border-box",
      backdropFilter: "blur(12px)",
    }}>
      {/* Character identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <div style={{
          width: 9, height: 9, borderRadius: "50%",
          background: character ? T.amber : T.textGhost,
          boxShadow: character ? `0 0 10px ${T.amber}` : "none",
          transition: "all 0.3s ease",
        }} />
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: character ? T.textPrimary : T.textMuted,
        }}>
          {character?.name ?? "New Character"}
        </span>
      </div>

      {/* Soul ID pill */}
      {character && (
        <div style={{
          padding: "3px 11px", borderRadius: 20,
          background: T.amberDim, border: `1px solid ${T.amberBorder}`,
          fontSize: 10, fontWeight: 800, color: T.amber,
          letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0,
        }}>
          SOUL ID Active
        </div>
      )}

      {/* Studio label */}
      <div style={{
        fontSize: 11, color: T.textGhost,
        fontWeight: 600, letterSpacing: "0.06em",
      }}>
        Character Studio
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
        {MODES.map(m => {
          const active = activeMode === m.key;
          return (
            <button key={m.key}
              onClick={() => onModeChange(m.key)}
              style={{
                padding: "6px 14px", borderRadius: 8,
                border: active ? `1px solid ${T.amberBorder}` : `1px solid transparent`,
                background: active ? T.amberDim : "transparent",
                color: active ? T.amber : T.textMuted,
                fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={!character}
        style={{
          padding: "7px 18px", borderRadius: 8, border: "none",
          background: character
            ? "linear-gradient(135deg, #b45309, #f59e0b)"
            : "rgba(255,255,255,0.04)",
          color: character ? "#090c13" : T.textGhost,
          fontSize: 12, fontWeight: 700,
          cursor: character ? "pointer" : "not-allowed",
          letterSpacing: "0.03em", flexShrink: 0, transition: "all 0.2s",
          boxShadow: character ? "0 0 14px rgba(245,158,11,0.22)" : "none",
        }}
      >
        Save
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterStudioShell() {
  const { user, session } = useAuth();

  // ── Core state — UNCHANGED ──────────────────────────────────────────────────
  const [activeMode,      setActiveMode]      = useState<CharacterMode>("base");
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [activeSoul,      setActiveSoul]      = useState<SoulId | null>(null);
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [versions,        setVersions]        = useState<CharacterVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [assets,          setAssets]          = useState<CharacterAsset[]>([]);

  // ── Auth token — UNCHANGED ──────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthToken(s?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  void session;

  // ── Generate handler — UNCHANGED ────────────────────────────────────────────
  const handleGenerate = useCallback(async (payload: BuildPayload) => {
    if (!user || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/studio/character/generate", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          characterName:     payload.name,
          characterType:     payload.type,
          personalityTraits: payload.traits,
          styleDna:          payload.styleDna,
          appearancePrompt:  payload.appearancePrompt,
          platformIntent:    payload.platformIntent,
          mode:              payload.mode,
        }),
      });
      if (!res.ok) {
        console.warn("[CharacterStudio] generation failed:", res.status);
      } else {
        const data = await res.json() as {
          data?: { character?: Character; soul?: SoulId; version?: CharacterVersion };
        };
        if (data.data?.character) setActiveCharacter(data.data.character);
        if (data.data?.soul)      setActiveSoul(data.data.soul);
        if (data.data?.version) {
          const v = data.data.version;
          setVersions(prev => [v, ...prev]);
          setActiveVersionId(v.id);
        }
      }
    } catch (err) {
      console.warn("[CharacterStudio] generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [user, authToken, isGenerating]);

  // ── Starter select — UNCHANGED ──────────────────────────────────────────────
  function handleSelectStarter(name: string, type: string) {
    const provisional: Character = {
      id:              crypto.randomUUID(),
      user_id:         user?.id ?? "",
      project_id:      null,
      name,
      status:          "draft",
      cover_asset_id:  null,
      platform_intent: null,
      notes:           type,
      created_at:      new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    };
    setActiveCharacter(provisional);
    setActiveMode("base");
  }

  function handleSave() {
    console.info("[CharacterStudio] Save triggered for:", activeCharacter?.name);
  }

  const GUTTER = 20;

  return (
    <div style={{
      // Fixed-height app container — fills viewport minus navbar
      height: "100vh",
      paddingTop: 80,         // account for fixed navbar
      boxSizing: "border-box",
      overflow: "hidden",     // NO page scroll — studio fills screen
      display: "flex",
      flexDirection: "column",
      // Cinematic background
      background: [
        "radial-gradient(ellipse at 14% 18%, rgba(245,158,11,0.07), transparent 42%)",
        "radial-gradient(ellipse at 86% 82%, rgba(180,83,9,0.05), transparent 42%)",
        T.body,
      ].join(", "),
      color: T.textPrimary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* ── TopBar — fixed height ─────────────────────────────────── */}
      <TopBar
        character={activeCharacter}
        activeMode={activeMode}
        onModeChange={setActiveMode}
        onSave={handleSave}
      />

      {/* ── Soul command bar — only when character active ─────────── */}
      {activeCharacter && (
        <div style={{ flexShrink: 0, padding: `6px ${GUTTER}px 0` }}>
          <SoulCommandBar
            soul={activeSoul}
            character={activeCharacter}
            onNewSoul={() => {
              setActiveSoul(null);
              setActiveVersionId(null);
            }}
            onSwitchCharacter={() => {
              setActiveCharacter(null);
              setActiveSoul(null);
              setVersions([]);
            }}
          />
        </div>
      )}

      {/* ── Three-panel grid — fills remaining vertical space ─────── */}
      <div style={{
        flex: 1,
        minHeight: 0,          // critical for flex child to shrink
        overflow: "hidden",
        display: "grid",
        // 320px left | flexible center (≥ remaining) | 360px right
        gridTemplateColumns: "320px minmax(0, 1fr) 360px",
        columnGap: 10,
        padding: `10px ${GUTTER}px 0`,
        boxSizing: "border-box",
      }}>

        {/* ── Left — Identity Builder ─────────────────────────────── */}
        <div style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.05) transparent",
          background: "rgba(11,14,23,0.65)",
          borderRadius: "14px 14px 0 0",
          boxShadow: [
            "inset 0 0 0 1px rgba(255,255,255,0.03)",
            "0 0 32px rgba(0,0,0,0.28)",
          ].join(", "),
          padding: "18px 16px 20px 18px",
          boxSizing: "border-box",
        }}>
          {/* Quick-start row — only when no character */}
          {!activeCharacter && (
            <QuickStartRow onSelect={handleSelectStarter} />
          )}
          <CharacterBuilder
            mode={activeMode}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            character={activeCharacter}
          />
        </div>

        {/* ── Center — Canvas (hero, fills height) ────────────────── */}
        <div style={{ height: "100%", overflow: "hidden", minWidth: 0 }}>
          <CharacterCanvas
            mode={activeMode}
            character={activeCharacter}
            soul={activeSoul}
            isGenerating={isGenerating}
            versions={versions}
            activeVersionId={activeVersionId}
            onModeAction={setActiveMode}
            onVersionSelect={setActiveVersionId}
          />
        </div>

        {/* ── Right — Intelligence Panel ──────────────────────────── */}
        <div style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.05) transparent",
          background: "rgba(11,14,23,0.45)",
          borderRadius: "14px 14px 0 0",
          boxShadow: [
            "inset 0 0 0 1px rgba(255,255,255,0.025)",
            "0 0 32px rgba(0,0,0,0.22)",
          ].join(", "),
          padding: "18px 18px 20px 14px",
          boxSizing: "border-box",
        }}>
          <CharacterIntelligencePanel
            soul={activeSoul}
            versions={versions}
            activeVersionId={activeVersionId}
            onVersionSelect={setActiveVersionId}
            assets={assets}
          />
        </div>
      </div>

      {/* ── WorkflowStrip — fixed at bottom inside studio ─────────── */}
      <div style={{
        flexShrink: 0,
        padding: `10px ${GUTTER}px 14px`,
        background: T.body,
      }}>
        <WorkflowStrip
          activeMode={activeMode}
          onStepClick={m => setActiveMode(m)}
          character={activeCharacter}
        />
      </div>

      {/* CrossStudioBridge — outside visible viewport, available for routing */}
      <div style={{ display: "none" }}>
        <CrossStudioBridge
          character={activeCharacter}
          soul={activeSoul}
          activeMode={activeMode}
        />
      </div>

    </div>
  );
}
