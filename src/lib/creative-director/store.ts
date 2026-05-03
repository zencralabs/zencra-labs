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
// Character Direction — local controls that build a prompt suffix.
// Not stored in DB; injected as promptSuffix at generate time.
// ─────────────────────────────────────────────────────────────────────────────
export interface CharacterDirection {
  faceExpression: "neutral" | "smile" | "serious" | "angry" | "surprised" | "emotional" | null;
  hairstyleLock:  boolean;
  outfitLock:     boolean;
  bodyView:       "front" | "left-profile" | "right-profile" | "back" | "three-quarter" | null;
  headDirection:  "left" | "right" | "up" | "down" | "forward" | null;
  eyeDirection:   "left" | "right" | "up" | "down" | "camera" | null;
  poseAction:     "standing" | "walking" | "running" | "jumping" | "driving" | "sitting" | null;
  handsLegs:      "natural-hands" | "visible-hands" | "full-body" | "dynamic-legs" | null;
}

export const DEFAULT_CHARACTER_DIRECTION: CharacterDirection = {
  faceExpression: null,
  hairstyleLock:  false,
  outfitLock:     false,
  bodyView:       null,
  headDirection:  null,
  eyeDirection:   null,
  poseAction:     null,
  handsLegs:      null,
};

/**
 * Build a prompt suffix from character direction state.
 * Returns empty string if no meaningful fields are set.
 */
export function buildCharacterDirectionSuffix(cd: CharacterDirection): string {
  const parts: string[] = [];
  if (cd.faceExpression)                  parts.push(`${cd.faceExpression} expression`);
  if (cd.bodyView)                        parts.push(`${cd.bodyView.replace("-", " ")} view`);
  if (cd.headDirection)                   parts.push(`head turned ${cd.headDirection}`);
  if (cd.eyeDirection)                    parts.push(`eyes looking ${cd.eyeDirection}`);
  if (cd.poseAction)                      parts.push(`${cd.poseAction} pose`);
  if (cd.handsLegs)                       parts.push(cd.handsLegs.replace("-", " "));
  if (cd.hairstyleLock)                   parts.push("consistent hairstyle");
  if (cd.outfitLock)                      parts.push("consistent outfit");
  return parts.length > 0 ? parts.join(", ") : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Uploaded assets — local object URLs for image references.
// Assigned to a scene role via drag-to-canvas or manual assignment.
// URL.revokeObjectURL is called on removeUploadedAsset to prevent memory leaks.
// ─────────────────────────────────────────────────────────────────────────────
export interface UploadedAsset {
  id:           string;
  url:          string;          // object URL (blob:…)
  name:         string;          // original file name
  assignedRole: "subject" | "world" | "atmosphere" | "object" | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image model keys available in Creative Director
// ─────────────────────────────────────────────────────────────────────────────
export interface CDModelDef {
  key:    string;
  label:  string;
  active: boolean;
  soon?:  boolean;
}

export const CD_MODELS: CDModelDef[] = [
  // GPT Image
  { key: "gpt-image-1",          label: "GPT Image 1.5",    active: true  },
  { key: "gpt-image-2",          label: "GPT Image 2",      active: true  },
  // Nano Banana
  { key: "nano-banana-standard", label: "Nano Banana",      active: true  },
  { key: "nano-banana-pro",      label: "Nano Banana Pro",  active: true  },
  { key: "nano-banana-2",        label: "Nano Banana 2",    active: true  },
  // Seedream
  { key: "seedream-4-5",         label: "Seedream 4.5",     active: true  },
  { key: "seedream-v5",          label: "Seedream 5.0 Lite", active: true  },
  // Flux
  { key: "flux-kontext",         label: "Flux.2 Flex",      active: true  },
  { key: "flux-2-image",         label: "Flux.2 Pro",       active: false, soon: true },
  { key: "flux-2-max",           label: "Flux.2 Max",       active: false, soon: true },
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

  // ── Selected image model ─────────────────────────────────────────────────
  selectedModel: string;

  // ── Character direction (local — injected as promptSuffix) ───────────────
  characterDirection: CharacterDirection;

  // ── Uploaded asset references (local object URLs) ─────────────────────────
  uploadedAssets: UploadedAsset[];

  // ── Canvas viewport transform (pan + discrete zoom) ──────────────────────
  canvasTransform: { x: number; y: number; scale: number };

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

  // Model selection
  setSelectedModel: (model: string) => void;

  // Character direction (local, builds promptSuffix)
  patchCharacterDirection: (patch: Partial<CharacterDirection>) => void;
  resetCharacterDirection: () => void;

  // Uploaded assets
  addUploadedAsset:    (asset: UploadedAsset) => void;
  removeUploadedAsset: (id: string) => void;
  assignAssetToRole:   (id: string, role: UploadedAsset["assignedRole"]) => void;

  // Canvas transform
  setCanvasTransform: (patch: Partial<{ x: number; y: number; scale: number }>) => void;
  resetCanvasView:    () => void;

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
  directionId:         null,
  mode:                "explore",
  directionVersion:    1,
  sceneIntent:         { text: "", uploadedUrl: null },
  elements:            [],
  refinements:         null,
  activeStyleMood:     null,
  selectedModel:       "gpt-image-2",
  characterDirection:  DEFAULT_CHARACTER_DIRECTION,
  uploadedAssets:      [],
  canvasTransform:     { x: 0, y: 0, scale: 100 },
  directorPanelOpen:   false,
  outputs:             [],
  isGenerating:        false,
  lastGenError:        null,
  directionCreated:    false,
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

  // ── Model selection ───────────────────────────────────────────────────────
  setSelectedModel: (model) => set({ selectedModel: model }),

  // ── Character direction ───────────────────────────────────────────────────
  patchCharacterDirection: (patch) =>
    set((s) => ({ characterDirection: { ...s.characterDirection, ...patch } })),

  resetCharacterDirection: () => set({ characterDirection: DEFAULT_CHARACTER_DIRECTION }),

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

  // ── Uploaded assets ───────────────────────────────────────────────────────
  addUploadedAsset: (asset) =>
    set((s) => ({ uploadedAssets: [...s.uploadedAssets, asset] })),

  removeUploadedAsset: (id) =>
    set((s) => {
      const target = s.uploadedAssets.find((a) => a.id === id);
      if (target?.url.startsWith("blob:")) {
        try { URL.revokeObjectURL(target.url); } catch { /* silent */ }
      }
      return { uploadedAssets: s.uploadedAssets.filter((a) => a.id !== id) };
    }),

  assignAssetToRole: (id, role) =>
    set((s) => ({
      uploadedAssets: s.uploadedAssets.map((a) =>
        a.id === id ? { ...a, assignedRole: role } : a
      ),
    })),

  // ── Canvas transform ──────────────────────────────────────────────────────
  setCanvasTransform: (patch) =>
    set((s) => ({
      canvasTransform: {
        x:     patch.x     !== undefined ? patch.x     : s.canvasTransform.x,
        y:     patch.y     !== undefined ? patch.y     : s.canvasTransform.y,
        scale: patch.scale !== undefined ? patch.scale : s.canvasTransform.scale,
      },
    })),

  resetCanvasView: () => set({ canvasTransform: { x: 0, y: 0, scale: 100 } }),

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
export const selectElements       = (s: DirectionState & DirectionActions) => s.elements;
export const selectRefinements    = (s: DirectionState & DirectionActions) => s.refinements;
export const selectOutputs        = (s: DirectionState & DirectionActions) => s.outputs;
export const selectMode           = (s: DirectionState & DirectionActions) => s.mode;
export const selectIsGenerating   = (s: DirectionState & DirectionActions) => s.isGenerating;
export const selectCanvasTransform = (s: DirectionState & DirectionActions) => s.canvasTransform;
