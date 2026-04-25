"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterStudioShell — Master layout for Character Studio
// Three-panel grid + top bar + soul bar + workflow strip
// Design: dark navy/amber — matches Zencra Video Studio cinematic feel
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { useAuth }      from "@/components/auth/AuthContext";
import { supabase }     from "@/lib/supabase";
import { useEffect }    from "react";
import type { CharacterMode, Character, SoulId, CharacterVersion } from "@/lib/character";
import type { CharacterAsset } from "@/lib/character";

import CharacterCanvas        from "./CharacterCanvas";
import CharacterBuilder       from "./CharacterBuilder";
import type { BuildPayload }  from "./CharacterBuilder";
import CharacterIntelligencePanel from "./CharacterIntelligencePanel";
import SoulCommandBar         from "./SoulCommandBar";
import WorkflowStrip          from "./WorkflowStrip";
import StarterCharacters      from "./StarterCharacters";
import CrossStudioBridge      from "./CrossStudioBridge";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  body:        "#090c13",
  panel:       "#0b0e17",
  topBar:      "#0c1020",
  border:      "#1a2035",
  borderAmber: "#3d2800",
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
      padding: "10px 20px", gap: 14,
      position: "sticky", top: 80, zIndex: 100,
      boxSizing: "border-box",
    }}>
      {/* Character name */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: character ? T.amber : T.textGhost,
          boxShadow: character ? `0 0 8px ${T.amber}` : "none",
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: character ? T.textPrimary : T.textMuted }}>
          {character?.name ?? "New Character"}
        </span>
      </div>

      {/* Soul pill */}
      {character && (
        <div style={{
          padding: "3px 10px", borderRadius: 20,
          background: T.amberDim, border: `1px solid ${T.amberBorder}`,
          fontSize: 10, fontWeight: 700, color: T.amber,
          letterSpacing: "0.06em", textTransform: "uppercase",
          flexShrink: 0,
        }}>
          SOUL ID Active
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
        {MODES.map(m => {
          const active = activeMode === m.key;
          return (
            <button key={m.key}
              onClick={() => onModeChange(m.key)}
              style={{
                padding: "6px 12px", borderRadius: 7,
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

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={!character}
        style={{
          padding: "7px 14px", borderRadius: 8,
          border: "none",
          background: character ? "linear-gradient(135deg, #b45309, #f59e0b)" : "rgba(255,255,255,0.05)",
          color: character ? "#090c13" : T.textGhost,
          fontSize: 12, fontWeight: 700, cursor: character ? "pointer" : "not-allowed",
          letterSpacing: "0.03em", flexShrink: 0,
          transition: "all 0.2s",
        }}
      >
        Save
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterStudioShell() {
  const { user, session }  = useAuth();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [activeMode,      setActiveMode]      = useState<CharacterMode>("base");
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [activeSoul,      setActiveSoul]      = useState<SoulId | null>(null);
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [showStarterStrip, setShowStarterStrip] = useState(true);
  const [versions,        setVersions]        = useState<CharacterVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [assets,          setAssets]          = useState<CharacterAsset[]>([]);

  // ── Auth token ─────────────────────────────────────────────────────────────
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
  void session; // used implicitly via authToken

  // ── Generate handler ───────────────────────────────────────────────────────
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
        if (data.data?.character) {
          setActiveCharacter(data.data.character);
          setShowStarterStrip(false);
        }
        if (data.data?.soul) {
          setActiveSoul(data.data.soul);
        }
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

  // ── Starter select ─────────────────────────────────────────────────────────
  function handleSelectStarter(name: string, type: string) {
    // Create a provisional character from starter
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
    setShowStarterStrip(false);
    setActiveMode("base");
  }

  function handleBuildOwn() {
    setShowStarterStrip(false);
    setActiveMode("base");
  }

  function handleSave() {
    // No backend save in Phase 3B UI — show toast in future
    console.info("[CharacterStudio] Save triggered for:", activeCharacter?.name);
  }

  const SIDE_GUTTER = 20;

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: [
        "radial-gradient(circle at 15% 25%, rgba(245,158,11,0.06), transparent 35%)",
        "radial-gradient(circle at 85% 75%, rgba(180,83,9,0.04), transparent 35%)",
        T.body,
      ].join(", "),
      color: T.textPrimary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      paddingTop: 80,
      boxSizing: "border-box",
    }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <TopBar
        character={activeCharacter}
        activeMode={activeMode}
        onModeChange={setActiveMode}
        onSave={handleSave}
      />

      {/* ── Soul command bar ──────────────────────────────────── */}
      <div style={{ paddingLeft: SIDE_GUTTER, paddingRight: SIDE_GUTTER, paddingTop: 10 }}>
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
            setShowStarterStrip(true);
          }}
        />

        {/* ── Starter strip ── */}
        {showStarterStrip && (
          <StarterCharacters
            onSelectStarter={handleSelectStarter}
            onBuildOwn={handleBuildOwn}
          />
        )}
      </div>

      {/* ── Three-panel workspace ──────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr 200px",
        columnGap: 14,
        alignItems: "start",
        width: "100%",
        paddingBottom: 24,
        boxSizing: "border-box",
      }}>

        {/* Left — Character Builder */}
        <div style={{
          paddingLeft: SIDE_GUTTER,
          paddingRight: 8,
          paddingTop: 14, paddingBottom: 14,
          position: "sticky", top: 130, zIndex: 10,
          maxHeight: "calc(100vh - 140px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.18)",
          borderRadius: 12,
          borderRight: `1px solid ${T.border}`,
          boxSizing: "border-box",
        }}>
          <CharacterBuilder
            mode={activeMode}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            character={activeCharacter}
          />
        </div>

        {/* Center — Canvas */}
        <div style={{ minWidth: 0, paddingTop: 14, paddingBottom: 14 }}>
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

        {/* Right — Intelligence Panel */}
        <div style={{
          paddingRight: SIDE_GUTTER,
          paddingLeft: 8,
          paddingTop: 14, paddingBottom: 14,
          position: "sticky", top: 130,
          maxHeight: "calc(100vh - 140px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.04) transparent",
          background: "rgba(0,0,0,0.14)",
          borderRadius: 12,
          borderLeft: `1px solid ${T.border}`,
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

      {/* ── Workflow strip + bridge ─────────────────────────────── */}
      <div style={{
        paddingLeft: SIDE_GUTTER, paddingRight: SIDE_GUTTER, paddingBottom: 48,
      }}>
        <WorkflowStrip
          activeMode={activeMode}
          onStepClick={m => { setActiveMode(m); }}
          character={activeCharacter}
        />
        <CrossStudioBridge
          character={activeCharacter}
          soul={activeSoul}
          activeMode={activeMode}
        />
      </div>

    </div>
  );
}
