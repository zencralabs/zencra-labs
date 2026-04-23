/**
 * CharacterPanel.tsx
 * Soul ID character system — persistent character identity across all Zencra studios.
 *
 * Features:
 *  - List existing characters (fetched from /api/creative-director/characters)
 *  - Create new character via modal form (POST)
 *  - Select / deselect a character to apply to the active concept
 *  - Display Soul ID in an elegant pill badge
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ── Design tokens (mirror Z constants used across Creative Director) ──────────
const Z = {
  bg:            "#080C1A",
  surfaceA:      "#0C1220",
  surfaceB:      "#101828",
  borderSubtle:  "rgba(255,255,255,0.07)",
  borderActive:  "rgba(86,140,255,0.5)",
  textPrimary:   "#F0F4FF",
  textSecondary: "#8FA4C0",
  textMuted:     "#566680",
  accentBlue:    "#3B82F6",
  glowPrimary:   "0 0 16px rgba(59,130,246,0.35)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Character {
  id:                   string;
  user_id:              string;
  name:                 string;
  soul_id:              string;
  appearance_prompt:    string;
  visual_style:         "cinematic" | "realistic" | "anime";
  voice_profile:        string | null;
  personality_traits:   Record<string, unknown>;
  visual_reference_url: string | null;
  created_at:           string;
  updated_at:           string;
}

export interface CharacterPanelProps {
  /** Auth header getter — same pattern as the rest of the CD shell */
  getAuthHeaders: () => Promise<Record<string, string>>;
  /** Currently applied character ID (null = none) */
  selectedCharacterId: string | null;
  /** Called when user selects or deselects a character */
  onSelectCharacter: (characterId: string | null) => void;
}

// ── Visual style options ──────────────────────────────────────────────────────
const VISUAL_STYLES: { value: "cinematic" | "realistic" | "anime"; label: string; description: string }[] = [
  { value: "cinematic", label: "Cinematic",  description: "Film-grade lighting, dramatic composition" },
  { value: "realistic", label: "Realistic",  description: "Photorealistic, natural detail" },
  { value: "anime",     label: "Anime",      description: "Stylized, expressive illustration" },
];

// ── Soul ID display truncator ────────────────────────────────────────────────
function truncateSoulId(soulId: string): string {
  if (soulId.length <= 18) return soulId;
  return `${soulId.slice(0, 10)}…${soulId.slice(-6)}`;
}

// ── Create Character Modal ────────────────────────────────────────────────────
function CreateCharacterModal({
  getAuthHeaders,
  onCreated,
  onClose,
}: {
  getAuthHeaders: () => Promise<Record<string, string>>;
  onCreated:      (character: Character) => void;
  onClose:        () => void;
}) {
  const [name,             setName]             = useState("");
  const [appearancePrompt, setAppearancePrompt] = useState("");
  const [visualStyle,      setVisualStyle]      = useState<"cinematic" | "realistic" | "anime">("cinematic");
  const [voiceProfile,     setVoiceProfile]     = useState("");
  const [isSubmitting,     setIsSubmitting]     = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [hoveredStyle,     setHoveredStyle]     = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!appearancePrompt.trim()) { setError("Appearance description is required."); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/creative-director/characters", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name:             name.trim(),
          appearancePrompt: appearancePrompt.trim(),
          visualStyle,
          voiceProfile:     voiceProfile.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create character");
      }
      const { character } = await res.json() as { character: Character };
      onCreated(character);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }, [name, appearancePrompt, visualStyle, voiceProfile, getAuthHeaders, onCreated]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(4, 6, 18, 0.88)",
        backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "linear-gradient(180deg, #0F1629 0%, #09101F 100%)",
          border: "1px solid rgba(86,140,255,0.28)",
          borderRadius: 20,
          boxShadow: "0 40px 80px rgba(0,0,0,0.85), 0 0 60px rgba(59,130,246,0.12)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: Z.textPrimary, letterSpacing: "-0.02em" }}>
              New Character
            </div>
            <div style={{ fontSize: 12, color: Z.textMuted, marginTop: 3 }}>
              A Soul ID will be generated automatically
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)", fontSize: 13,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: Z.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Character Name <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ava, Marcus, The Director…"
              style={{
                width: "100%", boxSizing: "border-box",
                height: 38, padding: "0 12px",
                fontSize: 13.5, color: Z.textPrimary,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9, outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(86,140,255,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Appearance Prompt */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: Z.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Appearance Description <span style={{ color: "#f87171" }}>*</span>
            </label>
            <textarea
              value={appearancePrompt}
              onChange={(e) => setAppearancePrompt(e.target.value)}
              placeholder="Describe your character's look — age, features, style, clothing, distinctive details…"
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px",
                fontSize: 13, color: Z.textPrimary, lineHeight: 1.6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9, outline: "none", resize: "vertical",
                fontFamily: "inherit",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(86,140,255,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Visual Style */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: Z.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Visual Style
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {VISUAL_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setVisualStyle(s.value)}
                  onMouseEnter={() => setHoveredStyle(s.value)}
                  onMouseLeave={() => setHoveredStyle(null)}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: 10,
                    border: visualStyle === s.value
                      ? "1px solid rgba(86,140,255,0.5)"
                      : hoveredStyle === s.value
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(255,255,255,0.07)",
                    background: visualStyle === s.value
                      ? "rgba(59,130,246,0.12)"
                      : hoveredStyle === s.value
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.02)",
                    cursor: "pointer", transition: "all 0.15s ease",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: visualStyle === s.value ? "#93c5fd" : Z.textSecondary, marginBottom: 3 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 10, color: Z.textMuted, lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Profile (optional) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: Z.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Voice Profile <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "rgba(86,110,140,0.6)" }}>optional</span>
            </label>
            <input
              value={voiceProfile}
              onChange={(e) => setVoiceProfile(e.target.value)}
              placeholder="ElevenLabs voice ID or Kits AI voice name…"
              style={{
                width: "100%", boxSizing: "border-box",
                height: 38, padding: "0 12px",
                fontSize: 13, color: Z.textPrimary,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9, outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(86,140,255,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize: 12, color: "#f87171",
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.22)",
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                flex: 1, height: 38, borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: Z.textMuted, fontSize: 13, fontWeight: 500,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !appearancePrompt.trim()}
              style={{
                flex: 2, height: 38, borderRadius: 9,
                border: "1px solid rgba(86,140,255,0.4)",
                background: isSubmitting
                  ? "rgba(59,130,246,0.08)"
                  : "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(79,70,229,0.16))",
                color: "#93c5fd", fontSize: 13, fontWeight: 700,
                cursor: isSubmitting || !name.trim() || !appearancePrompt.trim() ? "not-allowed" : "pointer",
                opacity: !name.trim() || !appearancePrompt.trim() ? 0.5 : 1,
                transition: "all 0.15s ease",
                letterSpacing: "0.01em",
              }}
            >
              {isSubmitting ? "Creating…" : "Create Character"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Character Card ─────────────────────────────────────────────────────────────
function CharacterCard({
  character,
  isSelected,
  onSelect,
}: {
  character:  Character;
  isSelected: boolean;
  onSelect:   () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const styleColors: Record<string, string> = {
    cinematic: "#93c5fd",
    realistic: "#6ee7b7",
    anime:     "#f9a8d4",
  };
  const styleBg: Record<string, string> = {
    cinematic: "rgba(59,130,246,0.12)",
    realistic: "rgba(16,185,129,0.1)",
    anime:     "rgba(236,72,153,0.1)",
  };
  const styleBorder: Record<string, string> = {
    cinematic: "rgba(59,130,246,0.28)",
    realistic: "rgba(16,185,129,0.25)",
    anime:     "rgba(236,72,153,0.25)",
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: isSelected
          ? "1px solid rgba(86,140,255,0.5)"
          : isHovered
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(255,255,255,0.06)",
        background: isSelected
          ? "rgba(59,130,246,0.09)"
          : isHovered
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.01)",
        cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: isSelected ? "0 0 16px rgba(59,130,246,0.15)" : "none",
      }}
    >
      {/* Top row: name + selected check */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: isSelected ? "#93c5fd" : Z.textPrimary, letterSpacing: "-0.01em" }}>
          {character.name}
        </div>
        {isSelected && (
          <span style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "rgba(59,130,246,0.25)",
            border: "1px solid rgba(86,140,255,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: "#93c5fd", fontWeight: 800, flexShrink: 0,
          }}>
            ✓
          </span>
        )}
      </div>

      {/* Soul ID pill */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 600,
          color: "rgba(140,165,200,0.6)",
          letterSpacing: "0.05em",
          fontFamily: "monospace",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 5, padding: "2px 7px",
        }}>
          {truncateSoulId(character.soul_id)}
        </span>
      </div>

      {/* Appearance excerpt */}
      <div style={{
        fontSize: 11.5, color: Z.textMuted, lineHeight: 1.5, marginBottom: 8,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      } as React.CSSProperties}>
        {character.appearance_prompt}
      </div>

      {/* Style tag */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
        background: styleBg[character.visual_style] ?? "rgba(255,255,255,0.05)",
        border: `1px solid ${styleBorder[character.visual_style] ?? "rgba(255,255,255,0.1)"}`,
        color: styleColors[character.visual_style] ?? Z.textMuted,
        letterSpacing: "0.04em",
        textTransform: "capitalize",
      }}>
        {character.visual_style}
      </span>
    </div>
  );
}

// ── Main CharacterPanel ────────────────────────────────────────────────────────
export function CharacterPanel({
  getAuthHeaders,
  selectedCharacterId,
  onSelectCharacter,
}: CharacterPanelProps) {
  const [characters,  setCharacters]  = useState<Character[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [hoveredNew,  setHoveredNew]  = useState(false);
  const [hoveredClear, setHoveredClear] = useState(false);

  // Fetch characters on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/creative-director/characters", { headers });
        if (!res.ok) throw new Error("Failed to load characters");
        const { characters: data } = await res.json() as { characters: Character[] };
        if (!cancelled) setCharacters(data);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Load failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getAuthHeaders]);

  const handleCreated = useCallback((character: Character) => {
    setCharacters((prev) => [character, ...prev]);
    setShowCreate(false);
    onSelectCharacter(character.id);
  }, [onSelectCharacter]);

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) ?? null;

  return (
    <>
      {showCreate && (
        <CreateCharacterModal
          getAuthHeaders={getAuthHeaders}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Panel header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 0 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 14,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: Z.textPrimary, letterSpacing: "-0.01em" }}>
              Characters
            </div>
            <div style={{ fontSize: 11, color: Z.textMuted, marginTop: 2 }}>
              Soul ID · persistent identity
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            onMouseEnter={() => setHoveredNew(true)}
            onMouseLeave={() => setHoveredNew(false)}
            style={{
              height: 28, padding: "0 12px",
              borderRadius: 8,
              border: hoveredNew ? "1px solid rgba(86,140,255,0.5)" : "1px solid rgba(86,140,255,0.28)",
              background: hoveredNew ? "rgba(59,130,246,0.16)" : "rgba(59,130,246,0.08)",
              color: hoveredNew ? "#93c5fd" : "#6BA8FF",
              fontSize: 11.5, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
          >
            + New
          </button>
        </div>

        {/* Selected character callout */}
        {selectedCharacter && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(59,130,246,0.07)",
              border: "1px solid rgba(86,140,255,0.22)",
              marginBottom: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Active Character
              </div>
              <button
                onClick={() => onSelectCharacter(null)}
                onMouseEnter={() => setHoveredClear(true)}
                onMouseLeave={() => setHoveredClear(false)}
                style={{
                  fontSize: 10, color: hoveredClear ? "#f87171" : "rgba(148,163,184,0.5)",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "2px 0", transition: "color 0.15s ease",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: Z.textPrimary, marginBottom: 2 }}>
              {selectedCharacter.name}
            </div>
            <div style={{ fontSize: 9.5, color: "rgba(140,165,200,0.5)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
              {selectedCharacter.soul_id}
            </div>
          </div>
        )}

        {/* Character list */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 8 }}>

          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 90, borderRadius: 12,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    animation: `charSkel 1.6s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
              <style>{`
                @keyframes charSkel {
                  0%, 100% { opacity: 0.5; }
                  50%       { opacity: 0.9; }
                }
              `}</style>
            </div>
          )}

          {!isLoading && loadError && (
            <div style={{
              fontSize: 12, color: "#f87171", textAlign: "center",
              padding: "16px 12px",
            }}>
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && characters.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 12px" }}>
              <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.4 }}>◈</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: Z.textSecondary, marginBottom: 4 }}>
                No characters yet
              </div>
              <div style={{ fontSize: 11, color: Z.textMuted, lineHeight: 1.55, marginBottom: 14 }}>
                Create a character to apply a persistent visual identity across all your concepts.
              </div>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: "8px 18px", borderRadius: 9,
                  border: "1px solid rgba(86,140,255,0.32)",
                  background: "rgba(59,130,246,0.1)",
                  color: "#6BA8FF", fontSize: 12, fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Create First Character
              </button>
            </div>
          )}

          {!isLoading && !loadError && characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              isSelected={char.id === selectedCharacterId}
              onSelect={() =>
                onSelectCharacter(char.id === selectedCharacterId ? null : char.id)
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}
