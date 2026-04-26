"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Canvas — Center panel
// Manages 3 states: empty → candidates → selected
// Pack sections animate into view below the hero. Progressive reveal only.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import type { CanvasState, ActiveInfluencer } from "./AIInfluencerBuilder";
import type { PackType } from "@/lib/influencer/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:      "#07090f",
  border:  "#111827",
  surface: "#0b0e17",
  text:    "#e8eaf0",
  muted:   "#8b92a8",
  ghost:   "#3d4560",
  amber:   "#f59e0b",
  green:   "#10b981",
} as const;

// ── Pack action definitions ───────────────────────────────────────────────────

const PACK_ACTIONS: Array<{
  type: PackType;
  label: string;
  cta: string;
  accent: string;
  descriptor: string;
}> = [
  { type: "identity-sheet", label: "Identity Sheet", cta: "Build Sheet",       accent: "#e2e8f0", descriptor: "5-angle character reference" },
  { type: "look-pack",      label: "Look Pack",      cta: "Create Looks",      accent: "#f59e0b", descriptor: "Outfit variations for your influencer" },
  { type: "scene-pack",     label: "Scene Pack",     cta: "Build Scenes",      accent: "#10b981", descriptor: "Place them in real-world environments" },
  { type: "pose-pack",      label: "Pose Pack",      cta: "Create Poses",      accent: "#3b82f6", descriptor: "Dynamic body positions and angles" },
  { type: "social-pack",    label: "Social Pack",    cta: "Create Social",     accent: "#a855f7", descriptor: "Formats ready for every platform" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  canvasState:        CanvasState;
  onCandidatesReady:  (influencer_id: string, candidateUrls: string[]) => void;
  onSelected:         (active: ActiveInfluencer) => void;
}

// ── Pack output state ─────────────────────────────────────────────────────────

interface PackOutput {
  type:    PackType;
  label:   string;
  accent:  string;
  descriptor: string;
  status:  "loading" | "complete" | "failed";
  images:  Array<{ url: string; label: string }>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InfluencerCanvas({ canvasState, onCandidatesReady, onSelected }: Props) {
  const [packOutputs, setPackOutputs]   = useState<PackOutput[]>([]);
  const [activePack,  setActivePack]    = useState<PackType | null>(null);
  const packSectionRef = useRef<HTMLDivElement>(null);
  const canvasRef      = useRef<HTMLDivElement>(null);

  // Reset packs when influencer changes
  useEffect(() => {
    setPackOutputs([]);
    setActivePack(null);
  }, [canvasState.phase === "selected" ? canvasState.active?.influencer.id : null]);

  const handleTriggerPack = useCallback(
    async (packType: PackType) => {
      if (canvasState.phase !== "selected") return;
      const { active } = canvasState;
      if (!active.identity_lock_id || !active.canonical_asset_id) return;

      const packDef = PACK_ACTIONS.find(p => p.type === packType)!;

      // Add loading section immediately — then animate in
      setPackOutputs(prev => {
        if (prev.some(p => p.type === packType)) return prev; // already triggered
        return [...prev, {
          type:       packType,
          label:      packDef.label,
          accent:     packDef.accent,
          descriptor: packDef.descriptor,
          status:     "loading",
          images:     [],
        }];
      });
      setActivePack(packType);

      // Scroll to pack section after animation frame
      setTimeout(() => {
        packSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 320);

      // Dispatch pack generation
      try {
        const res = await fetch(
          `/api/character/ai-influencers/${active.influencer.id}/packs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              pack_type:          packType,
              identity_lock_id:   active.identity_lock_id,
              canonical_asset_id: active.canonical_asset_id,
            }),
          },
        );

        if (!res.ok) {
          setPackOutputs(prev =>
            prev.map(p => p.type === packType ? { ...p, status: "failed" } : p),
          );
          return;
        }

        const data = await res.json();
        const jobs: Array<{ jobId: string; label: string }> = data.data?.jobs ?? [];

        // Poll each job for its result URL
        const images: Array<{ url: string; label: string }> = [];
        await Promise.all(
          jobs.map(async ({ jobId, label }) => {
            const url = await pollJobForUrl(jobId);
            if (url) images.push({ url, label });
          }),
        );

        setPackOutputs(prev =>
          prev.map(p =>
            p.type === packType
              ? { ...p, status: images.length > 0 ? "complete" : "failed", images }
              : p,
          ),
        );
      } catch (err) {
        console.error("[triggerPack]", err);
        setPackOutputs(prev =>
          prev.map(p => p.type === packType ? { ...p, status: "failed" } : p),
        );
      }
    },
    [canvasState],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={canvasRef}
      style={{
        height: "100%",
        overflowY: "auto",
        background: T.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {canvasState.phase === "empty"      && <EmptyState />}
      {canvasState.phase === "generating" && (
        <GeneratingState influencer_id={canvasState.influencer_id} onReady={onCandidatesReady} />
      )}
      {canvasState.phase === "candidates" && (
        <CandidatesState
          influencer_id={canvasState.influencer_id}
          candidates={canvasState.candidates}
          onSelected={onSelected}
        />
      )}
      {canvasState.phase === "selected" && (
        <SelectedState
          active={canvasState.active}
          packOutputs={packOutputs}
          activePack={activePack}
          onTriggerPack={handleTriggerPack}
          packSectionRef={packSectionRef}
        />
      )}
    </div>
  );
}

// ── STATE 1: Empty ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 32px", textAlign: "center",
    }}>
      {/* Ambient glow */}
      <div style={{
        width: 120, height: 120, borderRadius: "50%", marginBottom: 32,
        background: "radial-gradient(ellipse, rgba(245,158,11,0.10) 0%, transparent 70%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: "rgba(245,158,11,0.07)",
          border: "1px solid rgba(245,158,11,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(245,158,11,0.12)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
            <path d="M20 21a8 8 0 1 0-16 0" />
          </svg>
        </div>
      </div>

      <h2 style={{
        fontSize: 22, fontWeight: 800, color: T.text,
        letterSpacing: "-0.02em", marginBottom: 10,
      }}>
        Your AI Influencer lives here
      </h2>
      <p style={{
        fontSize: 15, color: T.muted, lineHeight: 1.65,
        maxWidth: 380, marginBottom: 0,
      }}>
        Create a realistic digital creator and build content-ready visuals — reusable across every studio.
      </p>
    </div>
  );
}

// ── STATE 2: Generating ───────────────────────────────────────────────────────

function GeneratingState({
  influencer_id,
  onReady,
}: {
  influencer_id: string;
  onReady: (influencer_id: string, urls: string[]) => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress while jobs run
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 8, 88));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 32px", textAlign: "center", gap: 24,
    }}>
      {/* Animated ring */}
      <div style={{
        width: 80, height: 80, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="80" height="80" viewBox="0 0 80 80" style={{
          position: "absolute", inset: 0,
          animation: "spin 1.4s linear infinite",
        }}>
          <circle
            cx="40" cy="40" r="34"
            fill="none" stroke="#f59e0b" strokeWidth="2"
            strokeDasharray="60 160" strokeLinecap="round"
          />
        </svg>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          Building your AI influencer…
        </div>
        <div style={{ fontSize: 13, color: T.ghost }}>
          Generating candidates. This takes about 30–60 seconds.
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: 240, height: 2, borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: "#f59e0b",
          width: `${progress}%`,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

// ── STATE 2b: Candidates grid ─────────────────────────────────────────────────

function CandidatesState({
  influencer_id,
  candidates,
  onSelected,
}: {
  influencer_id: string;
  candidates: string[];
  onSelected: (active: ActiveInfluencer) => void;
}) {
  const [selecting, setSelecting] = useState<string | null>(null);

  async function handleSelect(url: string) {
    setSelecting(url);
    try {
      const res = await fetch(
        `/api/character/ai-influencers/${influencer_id}/select`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ candidate_url: url }),
        },
      );
      if (!res.ok) { setSelecting(null); return; }
      const data = await res.json();
      onSelected({
        influencer:         data.data.influencer,
        hero_url:           data.data.hero_url,
        identity_lock_id:   data.data.identity_lock_id,
        canonical_asset_id: data.data.canonical_asset_id,
      });
    } catch (err) {
      console.error(err);
      setSelecting(null);
    }
  }

  return (
    <div style={{ padding: "28px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 6 }}>
          Choose your influencer
        </div>
        <div style={{ fontSize: 13, color: T.ghost }}>
          Select the best candidate — this becomes their identity.
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 12,
      }}>
        {candidates.map((url, i) => (
          <CandidateCard
            key={url}
            url={url}
            index={i + 1}
            selecting={selecting === url}
            disabled={!!selecting && selecting !== url}
            onSelect={() => handleSelect(url)}
          />
        ))}

        {/* Empty placeholders while waiting */}
        {candidates.length < 4 && Array.from({ length: 4 - candidates.length }).map((_, i) => (
          <div key={`placeholder-${i}`} style={{
            aspectRatio: "2/3", borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            animation: "pulse 1.8s ease-in-out infinite",
          }}>
            <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateCard({
  url, index, selecting, disabled, onSelect,
}: {
  url: string; index: number; selecting: boolean; disabled: boolean; onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative", aspectRatio: "2/3",
        borderRadius: 12, overflow: "hidden",
        cursor: disabled ? "not-allowed" : "pointer",
        border: selecting ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.07)",
        opacity: disabled && !selecting ? 0.5 : 1,
        transition: "all 0.2s ease",
        transform: hovered && !disabled ? "translateY(-2px)" : "none",
        boxShadow: selecting ? "0 0 20px rgba(245,158,11,0.25)" : "none",
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!disabled ? onSelect : undefined}
    >
      <img src={url} alt={`Candidate ${index}`}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* Hover overlay */}
      {(hovered || selecting) && (
        <div style={{
          position: "absolute", inset: 0,
          background: selecting
            ? "rgba(245,158,11,0.12)"
            : "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          paddingBottom: 14,
        }}>
          {!selecting ? (
            <div style={{
              padding: "7px 16px", borderRadius: 20,
              background: "rgba(245,158,11,0.92)",
              color: "#060810", fontSize: 12, fontWeight: 800,
              letterSpacing: "0.02em",
            }}>
              Select as Influencer
            </div>
          ) : (
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              border: "2px solid #f59e0b", borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
            }} />
          )}
        </div>
      )}
    </div>
  );
}

// ── STATE 3: Selected — the main experience ───────────────────────────────────

function SelectedState({
  active,
  packOutputs,
  activePack,
  onTriggerPack,
  packSectionRef,
}: {
  active: ActiveInfluencer;
  packOutputs: PackOutput[];
  activePack: PackType | null;
  onTriggerPack: (type: PackType) => void;
  packSectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Hero image — dominant ────────────────────────────────────── */}
      <HeroSection active={active} />

      {/* ── Pack action buttons ──────────────────────────────────────── */}
      <PackActions
        active={active}
        triggeredPacks={packOutputs.map(p => p.type)}
        activePack={activePack}
        onTrigger={onTriggerPack}
      />

      {/* ── Pack output sections — progressive reveal ────────────────── */}
      <div ref={packSectionRef}>
        {packOutputs.map((output, i) => (
          <PackSection
            key={output.type}
            output={output}
            isFirst={i === 0}
          />
        ))}
      </div>

      {/* ── Save Identity CTA ─────────────────────────────────────────── */}
      {packOutputs.length > 0 && (
        <SaveIdentityBar influencer_id={active.influencer.id} />
      )}
    </div>
  );
}

// ── Hero section ───────────────────────────────────────────────────────────────

function HeroSection({ active }: { active: ActiveInfluencer }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div style={{
      width: "100%",
      background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.06) 0%, transparent 60%), #07090f",
      display: "flex", justifyContent: "center",
      padding: "28px 24px 0",
    }}>

      {/* Influencer name above */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <div style={{
          fontSize: 11, fontWeight: 900, color: T.ghost,
          letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14,
        }}>
          Identity
        </div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: T.text,
          letterSpacing: "-0.02em", marginBottom: 20,
        }}>
          {active.influencer.name}
        </div>

        {/* Hero image container */}
        <div style={{
          display: "inline-block", position: "relative",
          maxWidth: 260, width: "100%",
        }}>
          <div style={{
            aspectRatio: "2/3", borderRadius: 16, overflow: "hidden",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 0 60px rgba(245,158,11,0.08), 0 20px 60px rgba(0,0,0,0.5)",
          }}>
            {active.hero_url ? (
              <>
                {!imgLoaded && (
                  <div style={{
                    width: "100%", height: "100%",
                    background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.10), transparent 60%)",
                    animation: "pulse 1.8s ease-in-out infinite",
                  }} />
                )}
                <img
                  src={active.hero_url}
                  alt={active.influencer.name}
                  onLoad={() => setImgLoaded(true)}
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    display: imgLoaded ? "block" : "none",
                    transition: "opacity 0.3s ease",
                  }}
                />
              </>
            ) : (
              <div style={{
                width: "100%", height: "100%",
                background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.12), transparent 65%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="#3d4560" strokeWidth="1.2" strokeLinecap="round">
                  <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </div>
            )}
          </div>

          {/* Identity locked indicator */}
          <div style={{
            position: "absolute", bottom: -12, left: "50%",
            transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.22)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#10b981", boxShadow: "0 0 7px #10b981",
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", letterSpacing: "0.08em" }}>
              Identity Locked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pack action buttons ────────────────────────────────────────────────────────

function PackActions({
  active, triggeredPacks, activePack, onTrigger,
}: {
  active: ActiveInfluencer;
  triggeredPacks: PackType[];
  activePack: PackType | null;
  onTrigger: (type: PackType) => void;
}) {
  return (
    <div style={{
      padding: "36px 24px 20px",
      display: "flex", gap: 8, flexWrap: "wrap",
      justifyContent: "center",
    }}>
      {PACK_ACTIONS.map(pack => {
        const triggered = triggeredPacks.includes(pack.type);
        const isActive  = activePack === pack.type;

        return (
          <button
            key={pack.type}
            onClick={() => !triggered && onTrigger(pack.type)}
            disabled={triggered}
            style={{
              padding: "9px 16px", borderRadius: 8,
              border: isActive
                ? `1px solid ${pack.accent}55`
                : triggered
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(255,255,255,0.10)",
              background: isActive
                ? `${pack.accent}14`
                : triggered
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.04)",
              color: isActive
                ? pack.accent
                : triggered
                ? "#4a5168"
                : T.muted,
              fontSize: 12, fontWeight: triggered ? 500 : 700,
              cursor: triggered ? "not-allowed" : "pointer",
              letterSpacing: "0.02em",
              transition: "all 0.15s",
              boxShadow: isActive ? `0 0 12px ${pack.accent}18` : "none",
            }}
          >
            {triggered && !isActive ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                  stroke="#10b981" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {pack.label}
              </span>
            ) : pack.cta}
          </button>
        );
      })}
    </div>
  );
}

// ── Pack output section — animates into view on trigger ───────────────────────

function PackSection({ output, isFirst }: { output: PackOutput; isFirst: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      padding: "0 24px",
      marginTop: isFirst ? 4 : 0,
      marginBottom: 32,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.28s ease, transform 0.28s ease",
    }}>
      {/* Section header */}
      <div style={{
        paddingTop: 28, paddingBottom: 14,
        borderTop: `1px solid ${T.border}`,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: output.accent,
          marginBottom: 4,
        }}>
          {output.label}
        </div>
        <div style={{ fontSize: 13, color: T.ghost }}>
          {output.descriptor}
        </div>
      </div>

      {/* Output strip */}
      {output.status === "loading" && (
        <div style={{
          display: "flex", gap: 10, overflowX: "auto",
          paddingBottom: 8,
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              flexShrink: 0, width: 120, aspectRatio: "2/3",
              borderRadius: 10, background: "rgba(255,255,255,0.04)",
              animation: "pulse 1.8s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}>
              <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
            </div>
          ))}
        </div>
      )}

      {output.status === "failed" && (
        <div style={{
          padding: "16px 0", fontSize: 13, color: "#ef4444",
        }}>
          This pack couldn't be generated. Try again.
        </div>
      )}

      {output.status === "complete" && output.images.length > 0 && (
        <div style={{
          display: "flex", gap: 10, overflowX: "auto",
          paddingBottom: 8,
        }}>
          {output.images.map((img, i) => (
            <PackAssetCard
              key={img.url}
              url={img.url}
              label={img.label}
              accentColor={output.accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pack asset card ────────────────────────────────────────────────────────────

function PackAssetCard({
  url, label, accentColor,
}: { url: string; label: string; accentColor: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        flexShrink: 0, width: 130, aspectRatio: "2/3",
        borderRadius: 10, overflow: "hidden", position: "relative",
        cursor: "pointer",
        transition: "transform 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={url} alt={label}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* Hover action overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.18s ease",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-end",
        padding: "10px 8px",
        gap: 4,
      }}>
        {/* Label */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: accentColor,
          letterSpacing: "0.06em", marginBottom: 6,
        }}>
          {label}
        </div>

        {/* Action icons */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { icon: "⭐", tip: "Save as Hero" },
            { icon: "↺", tip: "Refine" },
            { icon: "⬆", tip: "Upscale" },
            { icon: "⬇", tip: "Download" },
          ].map(action => (
            <button key={action.tip}
              title={action.tip}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: "rgba(255,255,255,0.12)",
                border: "none", cursor: "pointer",
                fontSize: 10, color: T.text,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {action.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Save Identity bar ─────────────────────────────────────────────────────────

function SaveIdentityBar({ influencer_id }: { influencer_id: string }) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/character/ai-influencers/${influencer_id}/save-identity`, {
        method: "POST", credentials: "include",
      });
      setSaved(true);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div style={{
      padding: "20px 24px 36px",
      display: "flex", justifyContent: "center",
    }}>
      <button
        onClick={handleSave}
        disabled={saving || saved}
        style={{
          padding: "13px 28px", borderRadius: 11,
          background: saved
            ? "rgba(16,185,129,0.15)"
            : "linear-gradient(135deg, #92400e, #b45309 40%, #f59e0b)",
          border: saved ? "1px solid rgba(16,185,129,0.30)" : "none",
          color: saved ? "#10b981" : "#060810",
          fontSize: 14, fontWeight: 800,
          cursor: saving || saved ? "not-allowed" : "pointer",
          letterSpacing: "0.02em",
          boxShadow: saved ? "none" : "0 0 32px rgba(245,158,11,0.25), 0 4px 16px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        {saved ? "✓ Identity saved" : saving ? "Saving…" : "Save Identity"}
      </button>
    </div>
  );
}

// ── Job polling helper ────────────────────────────────────────────────────────

async function pollJobForUrl(jobId: string, maxMs = 300_000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`/api/studio/jobs/${jobId}/status`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const job = data.data?.job ?? data.job;
      if (job?.status === "completed" && job?.result?.url) return job.result.url;
      if (job?.status === "failed") return null;
    } catch { return null; }
    await new Promise(r => setTimeout(r, 3000));
  }
  return null;
}
