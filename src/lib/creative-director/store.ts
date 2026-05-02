/**
 * src/lib/creative-director/store.ts
 *
 * Creative Director v2 — Zustand client store.
 *
 * Single source of truth for all CD v2 UI state:
 *   - Direction identity (id, mode)
 *   - Scene elements (subject / world / object / atmosphere)
 *   - Refinements (cinematography, style mood, identity lock)
 *   - Generation outputs (latest + history for current direction)
 *   - Generation loading state
 *
 * ─── LAZY CREATION RULE ──────────────────────────────────────────────────────
 * directionId stays null until the first user interaction (upload, type text,
 * add element). Components must call ensureDirection() before any API write
 * that requires a direction row.
 *
 * ─── OUTPUTS RULE ─────────────────────────────────────────────────────────────
 * Outputs come from the API response (POST /api/creative-director/generate).
 * Never fetched directly from DB in the UI layer.
 *
 * ─── MODE RULE ────────────────────────────────────────────────────────────────
 * mode is local UI state that mirrors direction.is_locked.
 * "explore" = not locked, free variation.
 * "locked"  = committed, campaign-grade output.
 *
 * ─── STYLE MOOD ───────────────────────────────────────────────────────────────
 * Style mood chip selections map to direction_refinements fields
 * (color_palette, lighting_style) — NOT direction_elements.
 */

"use client";

import { create } from "zustand";
import type {
  DirectionMode,
  DirectionElementRow,
  DirectionRefinementsRow,
  CreativeGenerationRow,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Generation output shape returned from POST /api/creative-director/generate
// ─────────────────────────────────────────────────────────────────────────────
export interface CDGenerationOutput {
  id:             string;
  status:         "processing" | "completed" | "failed";
  asset_id?:      string;
  url?:           string | null;
  error_message?: string;
  mode:           DirectionMode;
  credit_cost:    number;
  provider:       string;
  model:          string;
  created_at:     string;
  completed_at?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene intent — the user's freetext opening description.
// Stored locally; used as the direction name and for first-time direction creation.
// ─────────────────────────────────────────────────────────────────────────────
export interface SceneIntent {
  text:        string;   // raw freetext
  uploadedUrl: string | null; // reference image for the scene (optional)
}

// ─────────────────────────────────────────────────────────────────────────────
// Style mood presets — chips in LeftPanel that write into direction_refinements
// ─────────────────────────────────────────────────────────────────────────────
export type StyleMoodPreset =
  | "cinematic-neon"
  | "golden-hour"
  | "monochrome"
  | "vivid-pop"
  | "dark-drama"
  | "soft-light"
  | "overcast"
  | "studio-clean";

export interface StyleMoodPresetDef {
  key:            StyleMoodPreset;
  label:          string;
  color_palette:  string;
  lighting_style: string;
}

export const STYLE_MOOD_PRESETS: StyleMoodPresetDef[] = [
  { key: "cinematic-neon",  label: "Cinematic Neon",  color_palette: "neon",        lighting_style: "neon"        },
  { key: "golden-hour",     label: "Golden Hour",     color_palette: "warm",        lighting_style: "golden-hour" },
  { key: "monochrome",      label: "Monochrome",      color_palette: "monochrome",  lighting_style: "dramatic"    },
  { key: "vivid-pop",       label: "Vivid Pop",       color_palette: "vivid",       lighting_style: "studio"      },
  { key: "dark-drama",      label: "Dark Drama",      color_palette: "cool",        lighting_style: "dramatic"    },
  { key: "soft-light",      label: "Soft Light",      color_palette: "warm",        lighting_style: "soft"        },
  { key: "overcast",        label: "Overcast",        color_palette: "desaturated", lighting_style: "overcast"    },
  { key: "studio-clean",    label: "Studio Clean",    color_palette: "cinematic",   lighting_style: "studio"      },
];

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────
export interface DirectionState {
  // ── Direction identity ────────────────────────────────────────────────────
  directionId:      string | null;   // null until first interaction
  mode:             DirectionMode;   // "explore" | "locked"
  directionVersion: number;         // monotonically increasing

  // ── Scene intent ──────────────────────────────────────────────────────────
  sceneIntent: SceneIntent;

  // ── Scene elements ────────────────────────────────────────────────────────
  elements: DirectionElementRow[];

  // ── Refinements (cinematography + style mood) ─────────────────────────────
  refinements: Partial<DirectionRefinementsRow> | null;

  // ── Active style mood chip (drives refinements.color_palette + lighting_style)
  activeStyleMood: StyleMoodPreset | null;

  // ── Director panel ────────────────────────────────────────────────────────
  directorPanelOpen: boolean;

  // ── Generation outputs ────────────────────────────────────────────────────
  outputs:       CDGenerationOutput[];
  isGenerating:  boolean;
  lastGenError:  string | null;

  // ── Creation flag — has a direction row been written to DB? ───────────────
  directionCreated: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions shape
// ─────────────────────────────────────────────────────────────────────────────
export interface DirectionActions {
  // Direction lifecycle
  setDirectionId:     (id: string) => void;
  setMode:            (mode: DirectionMode) => void;
  markDirectionCreated: (id: string, version?: number) => void;

  // Scene intent
  setSceneIntentText:    (text: string) => void;
  setSceneIntentUpload:  (url: string | null) => void;

  // Elements
  addElement:     (el: DirectionElementRow) => void;
  removeElement:  (id: string) => void;
  updateElement:  (id: string, patch: Partial<Pick<DirectionElementRow, "label" | "weight">>) => void;
  setElements:    (els: DirectionElementRow[]) => void;

  // Refinements
  patchRefinements: (patch: Partial<DirectionRefinementsRow>) => void;
  setRefinements:   (r: DirectionRefinementsRow | null) => void;

  // Style mood chips
  setStyleMood: (preset: StyleMoodPreset | null) => void;

  // Director panel
  openDirectorPanel:   () => void;
  closeDirectorPanel:  () => void;
  toggleDirectorPanel: () => void;

  // Generation
  startGenerating:    () => void;
  finishGenerating:   (outputs: CDGenerationOutput[], error?: string) => void;
  appendOutputs:      (outputs: CDGenerationOutput[]) => void;
  clearOutputs:       () => void;

  // Full reset (switching back to standard mode / new direction)
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL: DirectionState = {
  directionId:       null,
  mode:              "explore",
  directionVersion:  1,
  sceneIntent:       { text: "", uploadedUrl: null },
  elements:          [],
  refinements:       null,
  activeStyleMood:   null,
  directorPanelOpen: false,
  outputs:           [],
  isGenerating:      false,
  lastGenError:      null,
  directionCreated:  false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useDirectionStore = create<DirectionState & DirectionActions>()((set) => ({
  ...INITIAL,

  // ── Direction lifecycle ───────────────────────────────────────────────────
  setDirectionId: (id) => set({ directionId: id }),
  setMode:        (mode) => set({ mode }),

  markDirectionCreated: (id, version = 1) =>
    set({ directionId: id, directionCreated: true, directionVersion: version }),

  // ── Scene intent ──────────────────────────────────────────────────────────
  setSceneIntentText:   (text)  => set((s) => ({ sceneIntent: { ...s.sceneIntent, text } })),
  setSceneIntentUpload: (url)   => set((s) => ({ sceneIntent: { ...s.sceneIntent, uploadedUrl: url } })),

  // ── Elements ──────────────────────────────────────────────────────────────
  addElement: (el) =>
    set((s) => ({ elements: [...s.elements, el] })),

  removeElement: (id) =>
    set((s) => ({ elements: s.elements.filter((e) => e.id !== id) })),

  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  setElements: (els) => set({ elements: els }),

  // ── Refinements ───────────────────────────────────────────────────────────
  patchRefinements: (patch) =>
    set((s) => ({
      refinements: s.refinements ? { ...s.refinements, ...patch } : patch,
    })),

  setRefinements: (r) => set({ refinements: r }),

  // ── Style mood chips ──────────────────────────────────────────────────────
  // Apply preset → writes color_palette + lighting_style into refinements
  setStyleMood: (preset) => {
    if (preset === null) {
      set({ activeStyleMood: null });
      return;
    }
    const def = STYLE_MOOD_PRESETS.find((p) => p.key === preset);
    if (!def) return;
    set((s) => ({
      activeStyleMood: preset,
      refinements: s.refinements
        ? { ...s.refinements, color_palette: def.color_palette, lighting_style: def.lighting_style }
        : { color_palette: def.color_palette, lighting_style: def.lighting_style } as Partial<DirectionRefinementsRow>,
    }));
  },

  // ── Director panel ────────────────────────────────────────────────────────
  openDirectorPanel:   () => set({ directorPanelOpen: true }),
  closeDirectorPanel:  () => set({ directorPanelOpen: false }),
  toggleDirectorPanel: () => set((s) => ({ directorPanelOpen: !s.directorPanelOpen })),

  // ── Generation ────────────────────────────────────────────────────────────
  startGenerating: () => set({ isGenerating: true, lastGenError: null }),

  finishGenerating: (outputs, error) =>
    set((s) => ({
      isGenerating: false,
      lastGenError: error ?? null,
      outputs: [...outputs, ...s.outputs].slice(0, 50), // cap at 50 outputs
    })),

  appendOutputs: (outputs) =>
    set((s) => ({ outputs: [...outputs, ...s.outputs].slice(0, 50) })),

  clearOutputs: () => set({ outputs: [] }),

  // ── Reset ─────────────────────────────────────────────────────────────────
  reset: () => set(INITIAL),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Convenience selectors — stable references so components don't re-render on
// unrelated state changes.
// ─────────────────────────────────────────────────────────────────────────────
export const selectElements    = (s: DirectionState & DirectionActions) => s.elements;
export const selectRefinements = (s: DirectionState & DirectionActions) => s.refinements;
export const selectOutputs     = (s: DirectionState & DirectionActions) => s.outputs;
export const selectMode        = (s: DirectionState & DirectionActions) => s.mode;
export const selectIsGenerating = (s: DirectionState & DirectionActions) => s.isGenerating;
