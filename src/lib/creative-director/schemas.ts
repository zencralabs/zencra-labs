/**
 * Creative Director — Input validation schemas
 *
 * Manual TypeScript validation (no external schema library).
 * Matches the validation pattern used in other Zencra routes.
 */

import type { V1VariationType, V1AdaptationTarget } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: true;
  data: T;
}
export interface ValidationError {
  success: false;
  error: string;
}
export type ValidationOutcome<T> = ValidationResult<T> | ValidationError;

function ok<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}
function err(error: string): ValidationError {
  return { success: false, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 ENUMS
// ─────────────────────────────────────────────────────────────────────────────

const V1_VARIATION_TYPES: V1VariationType[] = [
  "premium_pass",
  "minimal_pass",
  "cinematic_pass",
  "text_accuracy_pass",
  "product_focus_pass",
];

const V1_ADAPTATION_TARGETS: V1AdaptationTarget[] = [
  "story",
  "square_post",
  "banner",
];

const BRIEF_FIELDS = ["headline", "cta", "goal"] as const;
type BriefField = typeof BRIEF_FIELDS[number];

const PROJECT_STATUSES = ["draft", "concepted", "generated", "archived"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  title: string;
  projectType: string;
  brandName?: string;
  audience?: string;
  platform?: string;
}

export interface UpdateProjectInput {
  title?: string;
  status?: typeof PROJECT_STATUSES[number];
  cover_asset_id?: string | null;
}

export interface BriefInput {
  goal?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  additionalCopyNotes?: string;
  stylePreset?: string;
  moodTags?: string[];
  visualIntensity?: "subtle" | "balanced" | "bold" | "extreme";
  textRenderingIntent?: "none" | "minimal" | "ad_text" | "poster_text" | "typography_first";
  realismVsDesign?: number;
  colorPreference?: string;
  aspectRatio?: string;
  referenceAssets?: unknown[];
  advancedSettings?: Record<string, unknown>;
  originalInput?: string;
}

export interface GenerateConceptsInput {
  sessionKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD LIMITS — Zencra-enforced per model (backend source of truth)
// ─────────────────────────────────────────────────────────────────────────────

export const MODEL_UPLOAD_LIMITS: Record<string, number> = {
  "gpt-image-1":     16,
  "nano-banana-pro": 14,
  "nano-banana-2":   14,
  "seedream-v5":     14,
  "flux-kontext":    1,
};

export interface ReferenceImageInput {
  url: string;
  weight: number;
}

export type BlendMode =
  | "Primary Focus"
  | "Balanced"
  | "Style Transfer"
  | "Comp. Lock"
  | "Free Blend";

export interface StyleLocks {
  style: boolean;
  lighting: boolean;
  color: boolean;
  composition: boolean;
  texture: boolean;
}

export interface GenerateRenderInput {
  count: number;
  aspectRatio?: string;
  providerOverride?: string | null;
  modelOverride?: string | null;
  idempotencyKey?: string;
  referenceImages?: ReferenceImageInput[];
  blendMode?: BlendMode;
  locks?: StyleLocks;
  /** Links this render to a project_sessions row (project system) */
  session_id?: string;
}

export interface VariationInput {
  variationType: V1VariationType;
  count: number;
}

export interface AdaptFormatInput {
  targetFormat: V1AdaptationTarget;
  count: number;
}

export interface ForkInput {
  forkType: "concept" | "generation";
  sourceId: string;
  title?: string;
}

export interface ForkProjectInput {
  title?: string;
}

export interface BriefImproveInput {
  field: BriefField;
  currentValue: string;
  context: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isStringOrUndef(v: unknown): v is string | undefined {
  return v === undefined || typeof v === "string";
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

/**
 * validateCreateProject — POST /api/creative-director/projects body
 */
export function validateCreateProject(
  body: unknown
): ValidationOutcome<CreateProjectInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  if (!isString(b.title) || b.title.trim().length === 0) return err("title is required");
  if (b.title.length > 200) return err("title too long (max 200)");
  if (!isString(b.projectType) || b.projectType.trim().length === 0) return err("projectType is required");

  return ok({
    title: b.title.trim(),
    projectType: b.projectType,
    brandName: isString(b.brandName) ? b.brandName : undefined,
    audience: isString(b.audience) ? b.audience : undefined,
    platform: isString(b.platform) ? b.platform : undefined,
  });
}

/**
 * validateUpdateProject — PATCH /api/creative-director/projects/[projectId] body
 */
export function validateUpdateProject(
  body: unknown
): ValidationOutcome<UpdateProjectInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  if (b.title !== undefined && (!isString(b.title) || b.title.length > 200)) {
    return err("title must be a string under 200 chars");
  }

  if (b.status !== undefined && !PROJECT_STATUSES.includes(b.status as typeof PROJECT_STATUSES[number])) {
    return err(`status must be one of: ${PROJECT_STATUSES.join(", ")}`);
  }

  return ok({
    title: isString(b.title) ? b.title : undefined,
    status: b.status as typeof PROJECT_STATUSES[number] | undefined,
    cover_asset_id: (b.cover_asset_id === null || isString(b.cover_asset_id))
      ? (b.cover_asset_id as string | null | undefined)
      : undefined,
  });
}

/**
 * validateBriefInput — POST /api/creative-director/projects/[projectId]/brief body
 */
export function validateBriefInput(
  body: unknown
): ValidationOutcome<BriefInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  const TEXT_INTENTS = ["none", "minimal", "ad_text", "poster_text", "typography_first"];
  const INTENSITIES = ["subtle", "balanced", "bold", "extreme"];

  if (b.textRenderingIntent !== undefined && !TEXT_INTENTS.includes(b.textRenderingIntent as string)) {
    return err(`textRenderingIntent must be one of: ${TEXT_INTENTS.join(", ")}`);
  }

  if (b.visualIntensity !== undefined && !INTENSITIES.includes(b.visualIntensity as string)) {
    return err(`visualIntensity must be one of: ${INTENSITIES.join(", ")}`);
  }

  if (b.realismVsDesign !== undefined) {
    if (!isNumber(b.realismVsDesign) || b.realismVsDesign < 0 || b.realismVsDesign > 1) {
      return err("realismVsDesign must be a number between 0 and 1");
    }
  }

  return ok({
    goal: isString(b.goal) ? b.goal : undefined,
    headline: isString(b.headline) ? b.headline : undefined,
    subheadline: isString(b.subheadline) ? b.subheadline : undefined,
    cta: isString(b.cta) ? b.cta : undefined,
    additionalCopyNotes: isString(b.additionalCopyNotes) ? b.additionalCopyNotes : undefined,
    stylePreset: isString(b.stylePreset) ? b.stylePreset : undefined,
    moodTags: Array.isArray(b.moodTags) ? (b.moodTags as string[]) : undefined,
    visualIntensity: b.visualIntensity as BriefInput["visualIntensity"],
    textRenderingIntent: b.textRenderingIntent as BriefInput["textRenderingIntent"],
    realismVsDesign: isNumber(b.realismVsDesign) ? b.realismVsDesign : undefined,
    colorPreference: isString(b.colorPreference) ? b.colorPreference : undefined,
    aspectRatio: isString(b.aspectRatio) ? b.aspectRatio : undefined,
    referenceAssets: Array.isArray(b.referenceAssets) ? b.referenceAssets : undefined,
    advancedSettings: (b.advancedSettings && typeof b.advancedSettings === "object" && !Array.isArray(b.advancedSettings))
      ? (b.advancedSettings as Record<string, unknown>)
      : undefined,
    originalInput: isString(b.originalInput) ? b.originalInput : undefined,
  });
}

/**
 * validateGenerateConcepts — POST /projects/[projectId]/concepts body
 */
export function validateGenerateConcepts(
  body: unknown
): ValidationOutcome<GenerateConceptsInput> {
  if (!body || typeof body !== "object") return ok({ sessionKey: undefined });
  const b = body as Record<string, unknown>;
  return ok({ sessionKey: isString(b.sessionKey) ? b.sessionKey : undefined });
}

/**
 * validateGenerateRender — POST /concepts/[conceptId]/generate body
 */
export function validateGenerateRender(
  body: unknown
): ValidationOutcome<GenerateRenderInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  const count = isNumber(b.count) ? Math.floor(b.count) : 1;
  if (count < 1 || count > 4) return err("count must be between 1 and 4");

  // Validate referenceImages: Array<{ url: string; weight: number }>
  let referenceImages: ReferenceImageInput[] | undefined;
  if (b.referenceImages !== undefined) {
    if (!Array.isArray(b.referenceImages)) {
      return err("referenceImages must be an array");
    }
    for (const item of b.referenceImages) {
      if (!item || typeof item !== "object") return err("Each referenceImage must be an object");
      const ri = item as Record<string, unknown>;
      if (!isString(ri.url)) return err("Each referenceImage must have a string url");
      if (!isNumber(ri.weight) || ri.weight < 0 || ri.weight > 1) {
        return err("Each referenceImage weight must be a number between 0 and 1");
      }
    }
    referenceImages = (b.referenceImages as ReferenceImageInput[]);
  }

  // Enforce per-model upload limit when model is known
  const modelOverride = (b.modelOverride === null || isString(b.modelOverride))
    ? (b.modelOverride as string | null | undefined)
    : undefined;

  if (referenceImages && modelOverride) {
    const limit = MODEL_UPLOAD_LIMITS[modelOverride];
    if (limit !== undefined && referenceImages.length > limit) {
      return err(
        `Too many reference images for model "${modelOverride}": ` +
        `${referenceImages.length} provided, limit is ${limit}`
      );
    }
  }

  // Validate blendMode (optional)
  const BLEND_MODES: BlendMode[] = ["Primary Focus", "Balanced", "Style Transfer", "Comp. Lock", "Free Blend"];
  let blendMode: BlendMode | undefined;
  if (b.blendMode !== undefined) {
    if (!isString(b.blendMode) || !BLEND_MODES.includes(b.blendMode as BlendMode)) {
      return err(`blendMode must be one of: ${BLEND_MODES.join(", ")}`);
    }
    blendMode = b.blendMode as BlendMode;
  }

  // Validate locks (optional)
  let locks: StyleLocks | undefined;
  if (b.locks !== undefined) {
    if (!b.locks || typeof b.locks !== "object" || Array.isArray(b.locks)) {
      return err("locks must be an object");
    }
    const l = b.locks as Record<string, unknown>;
    const lockKeys: (keyof StyleLocks)[] = ["style", "lighting", "color", "composition", "texture"];
    for (const key of lockKeys) {
      if (l[key] !== undefined && typeof l[key] !== "boolean") {
        return err(`locks.${key} must be a boolean`);
      }
    }
    locks = {
      style:       typeof l.style       === "boolean" ? l.style       : false,
      lighting:    typeof l.lighting    === "boolean" ? l.lighting    : false,
      color:       typeof l.color       === "boolean" ? l.color       : false,
      composition: typeof l.composition === "boolean" ? l.composition : false,
      texture:     typeof l.texture     === "boolean" ? l.texture     : false,
    };
  }

  return ok({
    count,
    aspectRatio: isString(b.aspectRatio) ? b.aspectRatio : undefined,
    providerOverride: (b.providerOverride === null || isString(b.providerOverride))
      ? (b.providerOverride as string | null | undefined)
      : undefined,
    modelOverride,
    idempotencyKey: isString(b.idempotencyKey) ? b.idempotencyKey : undefined,
    referenceImages,
    blendMode,
    locks,
    session_id: isStringOrUndef(b.session_id) ? (b.session_id as string | undefined) : undefined,
  });
}

/**
 * validateVariation — POST /generations/[generationId]/variation body
 */
export function validateVariation(
  body: unknown
): ValidationOutcome<VariationInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  if (!isString(b.variationType) || !V1_VARIATION_TYPES.includes(b.variationType as V1VariationType)) {
    return err(`variationType must be one of: ${V1_VARIATION_TYPES.join(", ")}`);
  }

  const count = isNumber(b.count) ? Math.floor(b.count) : 1;
  if (count < 1 || count > 2) return err("count must be 1 or 2");

  return ok({
    variationType: b.variationType as V1VariationType,
    count,
  });
}

/**
 * validateAdaptFormat — POST /generations/[generationId]/adapt-format body
 */
export function validateAdaptFormat(
  body: unknown
): ValidationOutcome<AdaptFormatInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  if (!isString(b.targetFormat) || !V1_ADAPTATION_TARGETS.includes(b.targetFormat as V1AdaptationTarget)) {
    return err(`targetFormat must be one of: ${V1_ADAPTATION_TARGETS.join(", ")}`);
  }

  const count = isNumber(b.count) ? Math.floor(b.count) : 1;
  if (count < 1 || count > 2) return err("count must be 1 or 2");

  return ok({
    targetFormat: b.targetFormat as V1AdaptationTarget,
    count,
  });
}

/**
 * validateForkProject — POST /projects/[projectId]/fork body
 */
export function validateForkProject(
  body: unknown
): ValidationOutcome<ForkProjectInput> {
  if (!body || typeof body !== "object") return ok({});
  const b = body as Record<string, unknown>;

  if (b.title !== undefined) {
    if (!isString(b.title) || b.title.trim().length === 0) return err("title must be a non-empty string");
    if (b.title.length > 200) return err("title too long (max 200)");
  }

  return ok({ title: isString(b.title) ? b.title.trim() : undefined });
}

/**
 * validateBriefImprove — POST /brief/improve body
 */
export function validateBriefImprove(
  body: unknown
): ValidationOutcome<BriefImproveInput> {
  if (!body || typeof body !== "object") return err("Request body must be an object");
  const b = body as Record<string, unknown>;

  if (!isString(b.field) || !BRIEF_FIELDS.includes(b.field as BriefField)) {
    return err(`field must be one of: ${BRIEF_FIELDS.join(", ")}`);
  }

  if (!isString(b.currentValue)) return err("currentValue is required");
  if (!isString(b.context)) return err("context is required");

  return ok({
    field: b.field as BriefField,
    currentValue: b.currentValue,
    context: b.context,
  });
}
