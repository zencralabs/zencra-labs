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
 * 1. Identity anchor — LEADS when identity_lock is ON (reference image is ground truth)
 * 2. TextNode input — leading creative vision from wired TextNode (if present)
 * 3. Scene intent / direction.name — secondary context (demoted if TextNode present)
 * 4. Elements — subject/world/atmosphere/object sorted by weight
 * 5. Director controls — cinematography, scene energy, tone intensity
 *    NOTE: tone intensity is suppressed when identity_lock=true to prevent
 *    creative variation language from competing with face fidelity
 * 6. Character direction suffix — identity lock enforcement (second layer)
 * 7. Quality anchor — always appended last
 *
 * ─── IDENTITY LOCK STRATEGY ──────────────────────────────────────────────────
 * When identity_lock=true, three layers enforce character fidelity:
 *   Layer 1 (prompt lead):   "reference image is ground truth" anchor instruction
 *   Layer 2 (element level): all subjects treated as max weight (applySubjectEmphasis)
 *   Layer 3 (prompt tail):   hard "do not deviate" enforcement suffix
 * Tone intensity descriptor is suppressed — creative variation language competes
 * with face fidelity when the reference image is the primary anchor.
 * The route handler independently injects the actual reference image pixel data
 * and provider-level strength params (imageStrength, referenceWeight, etc.).
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
  mode: DirectionMode = "explore",
  textNodeInput?: string,
): string {
  const parts: string[] = [];

  // Identity lock flag — drives subject boost and strong identity block below.
  // identity_lock is a refinement setting independent of the locked/explore mode.
  // It is designed for AI influencer, @handle persona, and campaign consistency.
  const identityLock = refinements?.identity_lock === true;

  // ── STEP 1: Identity anchor — MUST lead when identity lock is ON ─────────
  // The reference image (injected by route.ts at the provider level) is the
  // ground truth for this character. This prompt instruction tells the generator
  // to treat that pixel data as primary — not the scene description.
  //
  // Three-layer identity system:
  //   Layer 1 (here):         "reference image is ground truth" anchor
  //   Layer 2 (elements):     applySubjectEmphasis boosts all subjects to max weight
  //   Layer 3 (prompt tail):  hard "do not deviate" enforcement suffix
  //
  // Tone intensity is intentionally suppressed when identity_lock=true (see below).
  if (identityLock) {
    parts.push(
      "IDENTITY LOCKED: use the provided reference image as the ground truth for this character's face and appearance. " +
      "The reference image takes absolute priority over all other instructions. " +
      "Reproduce the exact same face, skin tone, eye shape, nose, jaw, and hair from the reference image. " +
      "Same person, same face, same identity — do not reinterpret or idealise the subject's appearance"
    );
  }

  // ── STEP 2: TextNode input — leading creative vision ─────────────────────
  // When a TextNode is wired to the frame, its text is the PRIMARY scene/action
  // directive. It leads after the identity anchor so generators understand both
  // who is in the scene AND what is happening.
  const hasTextNode = typeof textNodeInput === "string" && textNodeInput.trim().length > 0;
  if (hasTextNode) {
    parts.push(textNodeInput!.trim());
  }

  // ── STEP 3: Scene intent / direction name ─────────────────────────────────
  // When TextNode is present, scene intent is demoted to secondary context
  // (prefix changes from "Scene:" to "Context:").
  // When no TextNode, it leads as the primary scene framing.
  if (direction.name) {
    if (hasTextNode) {
      parts.push(`Context: ${direction.name}`);
    } else {
      parts.push(`Scene: ${direction.name}.`);
    }
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
    // SUPPRESSED when identity_lock=true: creative variation language ("ultra-dramatic",
    // "bold and striking") competes with face fidelity and causes the model to
    // reinterpret the subject's appearance to match the tone. Omitting it forces
    // the model to anchor on the reference image instead of the mood descriptor.
    if (typeof refinements.tone_intensity === "number" && !identityLock) {
      parts.push(toneIntensityDesc(refinements.tone_intensity));
    }
  }

  // ── Identity lock enforcement (Layer 3 — hard tail instruction) ──────────
  // Fires when refinements.identity_lock === true — independent of mode.
  // This is the mechanism for AI influencer, @handle persona outputs, and
  // multi-output campaign consistency. Subject weight is ALSO boosted at the
  // element level above (applySubjectEmphasis, Layer 2), so this block is the
  // closing hard instruction — a final direct command to the generator.
  //
  // "explore" + identity_lock = lock the face, explore the scene around it.
  // "locked"  + identity_lock = maximum consistency — campaign-grade output.
  //
  // DO NOT add creative variation language here. This block must ONLY enforce
  // identity. Any style/mood descriptors should be in the cinematography section.
  if (identityLock) {
    parts.push(
      "HARD CONSTRAINT: do not alter, idealise, reinterpret, or stylise the subject's face. " +
      "Preserve exact facial features from the reference image — same eye shape, same nose, " +
      "same jaw structure, same skin tone, same hair. " +
      "If there is any conflict between the scene description and the reference image face, " +
      "the reference image face ALWAYS wins. " +
      "Same person. Same face. Every output."
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
  modeOverride?: DirectionMode,
  textNodeInput?: string,
): string {
  const mode: DirectionMode = modeOverride ?? (ctx.direction.is_locked ? "locked" : "explore");
  return buildDirectionPrompt(ctx.direction, ctx.refinements, ctx.elements, mode, textNodeInput);
}
