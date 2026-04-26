"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer Builder — Main Shell
// 3-column layout: Library (260px) | Canvas (flex) | Controls (320px)
// Fixed-height viewport — no scrolling at the shell level.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import InfluencerLibrary from "./InfluencerLibrary";
import InfluencerCanvas  from "./InfluencerCanvas";
import InfluencerControls from "./InfluencerControls";
import type { AIInfluencer, StyleCategory } from "@/lib/influencer/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:       "#07090f",
  border:   "#111827",
  surface:  "#0b0e17",
  text:     "#e8eaf0",
  muted:    "#8b92a8",
  ghost:    "#3d4560",
  amber:    "#f59e0b",
} as const;

// ── Active influencer state ───────────────────────────────────────────────────

export interface ActiveInfluencer {
  influencer:         AIInfluencer;
  hero_url:           string | null;
  identity_lock_id:   string | null;
  canonical_asset_id: string | null;
}

// ── Canvas state type ─────────────────────────────────────────────────────────

export type CanvasState =
  | { phase: "empty" }
  | { phase: "generating"; influencer_id: string; jobs: string[]; style_category: StyleCategory }
  | { phase: "candidates"; influencer_id: string; candidates: string[]; style_category: StyleCategory }
  | { phase: "selected"; active: ActiveInfluencer };

// ── Main component ────────────────────────────────────────────────────────────

export default function AIInfluencerBuilder() {
  const [canvasState, setCanvasState] = useState<CanvasState>({ phase: "empty" });
  const [libraryKey, setLibraryKey]   = useState(0);

  // Ref to trigger creation from the Canvas dock Create button
  // The dock's "Create Influencer" button calls onCreateClick which invokes this
  const createTriggerRef = useRef<(() => void) | null>(null);

  const handleCreated = useCallback((influencer: AIInfluencer, jobIds: string[]) => {
    setCanvasState({
      phase:          "generating",
      influencer_id:  influencer.id,
      jobs:           jobIds,
      style_category: influencer.style_category ?? "hyper-real",
    });
  }, []);

  const handleCandidatesReady = useCallback(
    (influencer_id: string, candidateUrls: string[]) => {
      setCanvasState(prev => ({
        phase:          "candidates",
        influencer_id,
        candidates:     candidateUrls,
        style_category: prev.phase === "generating" ? prev.style_category : "hyper-real",
      }));
    },
    [],
  );

  const handleSelected = useCallback(
    (active: ActiveInfluencer) => {
      setCanvasState({ phase: "selected", active });
      setLibraryKey(k => k + 1);  // refresh library to show new active influencer
    },
    [],
  );

  const handleNewInfluencer = useCallback(() => {
    setCanvasState({ phase: "empty" });
  }, []);

  const handleSelectFromLibrary = useCallback((influencer: AIInfluencer) => {
    if (influencer.identity_lock_id && influencer.hero_asset_id) {
      setCanvasState({
        phase: "selected",
        active: {
          influencer,
          hero_url:           influencer.thumbnail_url,
          identity_lock_id:   influencer.identity_lock_id,
          canonical_asset_id: influencer.hero_asset_id,
        },
      });
    }
  }, []);

  // When dock "Create Influencer" is clicked:
  // If currently selected, reset to empty so user can build a new one
  const handleCreateClick = useCallback(() => {
    if (canvasState.phase === "selected") {
      setCanvasState({ phase: "empty" });
    }
    // If already empty or candidates, the Builder tab CTA in Controls handles it
    // The dock button provides a shortcut — user's eye goes to Canvas first
  }, [canvasState.phase]);

  const activeInfluencer =
    canvasState.phase === "selected" ? canvasState.active : null;

  return (
    <div style={{
      height: "100%",                  // fills the page wrapper (100dvh - 76px)
      display: "flex",
      background: T.bg,
      overflow: "hidden",
      fontFamily: "var(--font-body), 'Inter', -apple-system, sans-serif",
      color: T.text,
    }}>

      {/* ── Left: Influencer Library ─────────────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <InfluencerLibrary
          key={libraryKey}
          onNew={handleNewInfluencer}
          onSelect={handleSelectFromLibrary}
          activeId={activeInfluencer?.influencer.id ?? null}
        />
      </div>

      {/* ── Center: Canvas ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <InfluencerCanvas
          canvasState={canvasState}
          onCandidatesReady={handleCandidatesReady}
          onSelected={handleSelected}
          onCreateClick={handleCreateClick}
        />
      </div>

      {/* ── Right: Controls ──────────────────────────────────────────────── */}
      <div style={{
        width: 320, flexShrink: 0,
        borderLeft: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <InfluencerControls
          canvasState={canvasState}
          activeInfluencer={activeInfluencer}
          onCreated={handleCreated}
        />
      </div>

    </div>
  );

  void createTriggerRef; // used for future direct trigger wiring
}
