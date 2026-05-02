/**
 * direction-prompt.ts — Creative Director v2 prompt builder
 *
 * Assembles cinematic still-image prompt from:
 *   - direction (name, model lock)
 *   - refinements (shot, lens, light, color, energy)
 *   - elements (subject, world, object, atmosphere)
 *
 * Scope: Image Studio only. Still images only.
 * No video language. No motion language.
 * sceneEnergy represents pose/activity state for a STILL FRAME.
 *
 * Output: a string prompt passed directly to studioDispatch.
 * The orchestrator (studioDispatch) routes to the correct provider.
 * This function has NO knowledge of providers.
 */

import type {
  CreativeDirectionRow,
  DirectionRefinementsRow,
  DirectionElementRow,
  DirectionWithContext,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SCENE ENERGY → STILL IMAGE LANGUAGE
// Maps pose/activity state to still-image composition language.
// Never uses "motion" or video language.
// ─────────────────────────────────────────────────────────────────────────────
const SCENE_ENERGY_PHRASES: Record<string, string> = {
  "static":         "perfectly still, poised composition",
  "walking-pose":   "mid-stride pose, natural movement captured",
  "action-pose":    "dynamic action pose, peak moment frozen",
  "dramatic-still": "intense dramatic pose, cinematic freeze frame",
};

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENT TYPE → PROMPT POSITIONING
// Each element type has a natural place in the prompt string.
// ─────────────────────────────────────────────────────────────────────────────
function weightToEmphasis(weight: number): string {
  if (weight >= 0.8) return "prominently featured";
  if (weight >= 0.5) return "clearly visible";
  return "subtly present";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────────────────────────────────────
export function buildDirectionPrompt(
  direction: CreativeDirectionRow,
  refinements: DirectionRefinementsRow | null,
  elements: DirectionElementRow[]
): string {
  const parts: string[] = [];

  // ── Scene name / title (optional framing) ────────────────────────────────
  if (direction.name) {
    parts.push(`Scene: ${direction.name}.`);
  }

  // ── Elements — group by type ──────────────────────────────────────────────
  const subjects    = elements.filter(e => e.type === "subject").sort((a, b) => b.weight - a.weight);
  const worlds      = elements.filter(e => e.type === "world").sort((a, b) => b.weight - a.weight);
  const objects     = elements.filter(e => e.type === "object").sort((a, b) => b.weight - a.weight);
  const atmospheres = elements.filter(e => e.type === "atmosphere").sort((a, b) => b.weight - a.weight);

  if (subjects.length > 0) {
    const subjectStr = subjects
      .map(e => `${e.label} (${weightToEmphasis(e.weight)})`)
      .join(", ");
    parts.push(`Subject: ${subjectStr}.`);
  }

  if (worlds.length > 0) {
    const worldStr = worlds.map(e => e.label).join(", ");
    parts.push(`Setting: ${worldStr}.`);
  }

  if (objects.length > 0) {
    const objectStr = objects.map(e => e.label).join(", ");
    parts.push(`Objects: ${objectStr}.`);
  }

  if (atmospheres.length > 0) {
    const atmStr = atmospheres.map(e => e.label).join(", ");
    parts.push(`Atmosphere: ${atmStr}.`);
  }

  // ── Refinements — cinematography layer ────────────────────────────────────
  if (refinements) {
    const cineParts: string[] = [];

    if (refinements.shot_type) {
      cineParts.push(`${refinements.shot_type} shot`);
    }

    if (refinements.lens) {
      cineParts.push(`${refinements.lens} lens`);
    }

    if (refinements.camera_angle) {
      cineParts.push(`${refinements.camera_angle} angle`);
    }

    if (cineParts.length > 0) {
      parts.push(`Cinematography: ${cineParts.join(", ")}.`);
    }

    if (refinements.lighting_style) {
      parts.push(`Lighting: ${refinements.lighting_style}.`);
    }

    if (refinements.color_palette) {
      parts.push(`Color: ${refinements.color_palette} palette.`);
    }

    if (refinements.scene_energy) {
      const energyPhrase = SCENE_ENERGY_PHRASES[refinements.scene_energy] ?? refinements.scene_energy;
      parts.push(`Pose/Energy: ${energyPhrase}.`);
    }

    // Tone intensity → descriptor
    if (typeof refinements.tone_intensity === "number") {
      const intensity = refinements.tone_intensity;
      const toneDesc =
        intensity >= 80 ? "ultra-dramatic, maximum visual impact" :
        intensity >= 60 ? "high contrast, bold and striking" :
        intensity >= 40 ? "balanced, cinematic quality" :
        intensity >= 20 ? "soft, understated elegance" :
                          "minimal, subtle and refined";
      parts.push(`Tone: ${toneDesc}.`);
    }
  }

  // ── Quality anchor — always appended ─────────────────────────────────────
  parts.push("Ultra realistic, cinematic, film quality, professional photography, sharp focus.");

  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE WRAPPER — accepts DirectionWithContext
// ─────────────────────────────────────────────────────────────────────────────
export function buildDirectionPromptFromContext(ctx: DirectionWithContext): string {
  return buildDirectionPrompt(ctx.direction, ctx.refinements, ctx.elements);
}
