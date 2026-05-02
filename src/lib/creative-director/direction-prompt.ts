/**
 * direction-prompt.ts — Creative Director v2 prompt builder
 *
 * Assembles cinematic still-image prompt from:
 *   - direction (name, model lock)
 *   - refinements (shot, lens, angle, light, color, energy, tone)
 *   - elements (subject, world, object, atmosphere — sorted by weight)
 *   - mode ("explore" | "locked") — controls identity enforcement language
 *
 * Scope: Image Studio only. Still images only.
 * No video language. No motion language.
 * sceneEnergy represents pose/activity state for a STILL FRAME.
 *
 * Output: a string prompt passed directly to studioDispatch.
 * The orchestrator (studioDispatch) routes to the correct provider.
 * This function has NO knowledge of providers.
 *
 * ─── WEIGHT SYSTEM ───────────────────────────────────────────────────────────
 * weight >= 0.8 → element reinforced in prompt (prominence emphasis)
 * weight >= 0.5 → element appears naturally (no qualifier)
 * weight <  0.5 → element appears with soft qualifier (subtle presence)
 *
 * Sorting by weight ensures image generators prioritise the right elements
 * in their internal composition logic. Higher-weight elements appear first
 * in each group, giving them structural priority.
 *
 * ─── COMPOSITION ORDER ───────────────────────────────────────────────────────
 * 1. Subject — who/what is in the scene, with weight-driven emphasis
 * 2. World   — composed with subject as "X in Y" for natural flow
 * 3. Atmosphere — mood + lighting feel before specific props
 * 4. Objects — specific props and foreground elements
 * 5. Cinematography — shot/lens/angle/lighting/color
 * 6. Scene energy — pose state (still-image language only)
 * 7. Identity lock — injected only in "locked" mode
 * 8. Quality anchor — always appended
 */

import type {
  CreativeDirectionRow,
  DirectionRefinementsRow,
  DirectionElementRow,
  DirectionMode,
  DirectionWithContext,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SCENE ENERGY → STILL IMAGE POSE LANGUAGE
// Never uses "motion", "moving", "video", or temporal language.
// Each phrase describes a pose STATE captured in a single frame.
// ─────────────────────────────────────────────────────────────────────────────
const SCENE_ENERGY_PHRASES: Record<string, string> = {
  "static":         "perfectly still, poised composition",
  "walking-pose":   "mid-stride pose, natural movement captured in still",
  "action-pose":    "dynamic action pose, peak moment frozen in frame",
  "dramatic-still": "intense dramatic pose, cinematic freeze frame",
};

// ─────────────────────────────────────────────────────────────────────────────
// TONE INTENSITY → DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────
function toneIntensityDesc(intensity: number): string {
  if (intensity >= 80) return "ultra-dramatic, maximum visual impact, high contrast";
  if (intensity >= 60) return "bold and striking, high contrast";
  if (intensity >= 40) return "balanced, cinematic quality";
  if (intensity >= 20) return "soft, understated elegance";
  return "minimal, subtle and refined";
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHT → EMPHASIS MODIFIER
// High-weight elements get reinforcement language so image generators
// know what to prioritize compositionally. Low-weight elements get a
// soft qualifier so they don't compete with primary elements.
// ─────────────────────────────────────────────────────────────────────────────
function applyEmphasis(label: string, weight: number): string {
  if (weight >= 0.8) return `${label}, prominently featured`;
  if (weight <  0.5) return `${label}, subtly present`;
  return label; // 0.5–0.79: natural appearance, no qualifier
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT EMPHASIS WITH IDENTITY BOOST
// When identity_lock is active, ALL subjects are treated as maximum weight
// regardless of their configured value. This forces the image generator to
// anchor on the character identity first — critical for AI influencer,
// campaign consistency, and @handle persona outputs.
// ─────────────────────────────────────────────────────────────────────────────
function applySubjectEmphasis(label: string, weight: number, identityLock: boolean): string {
  if (identityLock) return `${label}, prominently featured`; // always max when locked
  return applyEmphasis(label, weight);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────────────────────────────────────
export function buildDirectionPrompt(
  direction: CreativeDirectionRow,
  refinements: DirectionRefinementsRow | null,
  elements: DirectionElementRow[],
  mode: DirectionMode = "explore"
): string {
  const parts: string[] = [];

  // Identity lock flag — drives subject boost and strong identity block below.
  // identity_lock is a refinement setting independent of the locked/explore mode.
  // It is designed for AI influencer, @handle persona, and campaign consistency.
  const identityLock = refinements?.identity_lock === true;

  // ── Scene name framing (optional) ─────────────────────────────────────────
  if (direction.name) {
    parts.push(`Scene: ${direction.name}.`);
  }

  // ── Sort all element groups by weight descending ───────────────────────────
  // Higher-weight elements appear first → structural composition priority.
  // When identityLock is active, subjects are additionally boosted to max
  // emphasis (see applySubjectEmphasis) to anchor the character identity.
  const byWeight = (a: DirectionElementRow, b: DirectionElementRow) => b.weight - a.weight;

  const subjects    = elements.filter(e => e.type === "subject").sort(byWeight);
  const worlds      = elements.filter(e => e.type === "world").sort(byWeight);
  const atmospheres = elements.filter(e => e.type === "atmosphere").sort(byWeight);
  const objects     = elements.filter(e => e.type === "object").sort(byWeight);

  // ── Subject — lead with who/what is in the scene ─────────────────────────
  // applySubjectEmphasis treats all subjects as max weight when identityLock
  // is active — the generator must anchor on the character before anything else.
  if (subjects.length > 0) {
    const subjectStr = subjects
      .map(e => applySubjectEmphasis(e.label, e.weight, identityLock))
      .join(", ");

    // Compose "Subject in World" as a single phrase when both exist.
    // Produces: "cinematic figure, prominently featured in neon-lit Tokyo alley"
    if (worlds.length > 0) {
      const worldStr = worlds.map(e => e.label).join(", ");
      parts.push(`${subjectStr} in ${worldStr}`);
    } else {
      parts.push(subjectStr);
    }
  } else if (worlds.length > 0) {
    // World without subject (establishing shot / environment)
    const worldStr = worlds.map(e => e.label).join(", ");
    parts.push(worldStr);
  }

  // ── Atmosphere — mood before props (establishes scene feel first) ─────────
  if (atmospheres.length > 0) {
    const atmStr = atmospheres.map(e => applyEmphasis(e.label, e.weight)).join(", ");
    parts.push(atmStr);
  }

  // ── Objects — specific props and foreground elements ─────────────────────
  if (objects.length > 0) {
    const objStr = objects.map(e => applyEmphasis(e.label, e.weight)).join(", ");
    parts.push(objStr);
  }

  // ── Cinematography layer ──────────────────────────────────────────────────
  if (refinements) {
    const cineParts: string[] = [];

    if (refinements.shot_type)    cineParts.push(`${refinements.shot_type} shot`);
    if (refinements.lens)         cineParts.push(`${refinements.lens} lens`);
    if (refinements.camera_angle) cineParts.push(`${refinements.camera_angle} angle`);

    if (cineParts.length > 0) {
      parts.push(`Shot: ${cineParts.join(", ")}`);
    }

    if (refinements.lighting_style) {
      parts.push(`Lighting: ${refinements.lighting_style}`);
    }

    if (refinements.color_palette) {
      parts.push(`Color: ${refinements.color_palette} palette`);
    }

    // Scene energy → still-image pose language only (no motion words)
    if (refinements.scene_energy) {
      const phrase = SCENE_ENERGY_PHRASES[refinements.scene_energy] ?? refinements.scene_energy;
      parts.push(phrase);
    }

    // Tone intensity → descriptor
    if (typeof refinements.tone_intensity === "number") {
      parts.push(toneIntensityDesc(refinements.tone_intensity));
    }
  }

  // ── Identity lock enforcement ─────────────────────────────────────────────
  // Fires when refinements.identity_lock === true — independent of mode.
  // This is the mechanism for AI influencer, @handle persona outputs, and
  // multi-output campaign consistency. Subject weight is ALSO boosted at the
  // element level above (applySubjectEmphasis), so this block is the second
  // layer — a direct instruction to the generator about character fidelity.
  //
  // "explore" + identity_lock = lock the face, explore the scene around it.
  // "locked"  + identity_lock = maximum consistency — campaign-grade output.
  if (identityLock) {
    parts.push(
      "preserve exact facial features, maintain same character identity, " +
      "consistent face structure, same person across all outputs, " +
      "do not alter or reinterpret the subject's appearance"
    );
  }

  // ── Quality anchor — always appended ─────────────────────────────────────
  parts.push("ultra realistic, cinematic, film still, professional photography, sharp focus");

  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE WRAPPER — accepts DirectionWithContext + optional mode override.
// Mode is auto-derived from direction.is_locked when not explicitly passed.
// ─────────────────────────────────────────────────────────────────────────────
export function buildDirectionPromptFromContext(
  ctx: DirectionWithContext,
  modeOverride?: DirectionMode
): string {
  const mode: DirectionMode = modeOverride ?? (ctx.direction.is_locked ? "locked" : "explore");
  return buildDirectionPrompt(ctx.direction, ctx.refinements, ctx.elements, mode);
}
