/**
 * Save History — Creative Director
 *
 * Persistence layer for all Creative Director DB operations.
 * All writes use supabaseAdmin (service role bypass).
 * Ownership checks are done at the API route level before calling these.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  CreativeBriefRow,
  CreativeConceptRow,
  CreativeGenerationRow,
  CreativeProjectRow,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveProject — Insert a new creative project record.
 */
export async function saveProject(
  data: Omit<CreativeProjectRow, "id" | "created_at" | "updated_at" | "last_activity_at">
): Promise<CreativeProjectRow> {
  const { data: row, error } = await supabaseAdmin
    .from("creative_projects")
    .insert({
      user_id: data.user_id,
      title: data.title,
      project_type: data.project_type,
      brand_name: data.brand_name ?? null,
      audience: data.audience ?? null,
      platform: data.platform ?? null,
      status: data.status ?? "draft",
      selected_concept_id: data.selected_concept_id ?? null,
      cover_asset_id: data.cover_asset_id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[save-history] saveProject failed: ${error.message}`);
  }

  return row as CreativeProjectRow;
}

/**
 * updateProject — Partial update on a creative project.
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Pick<CreativeProjectRow, "title" | "status" | "selected_concept_id">> & {
    cover_asset_id?: string | null;
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("creative_projects")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(`[save-history] updateProject failed: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIEF OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveBrief — Insert or upsert a creative brief for a project.
 * Uses insert; callers should check for existing brief and update instead.
 */
export async function saveBrief(
  // parsed_brief_json is optional in the call signature. When omitted, saveBrief
  // stores {} as the official sentinel meaning "not yet parsed". The concepts route
  // is the only caller that passes a populated value, after parseBrief() succeeds.
  // The type is always Record<string, unknown> — never null in storage.
  data: Omit<CreativeBriefRow, "id" | "created_at" | "updated_at" | "parsed_brief_json">
        & { parsed_brief_json?: Record<string, unknown> }
): Promise<CreativeBriefRow> {
  const { data: row, error } = await supabaseAdmin
    .from("creative_briefs")
    .insert({
      project_id: data.project_id,
      original_input: data.original_input ?? null,
      goal: data.goal ?? null,
      headline: data.headline ?? null,
      subheadline: data.subheadline ?? null,
      cta: data.cta ?? null,
      additional_copy_notes: data.additional_copy_notes ?? null,
      project_type: data.project_type ?? null,
      style_preset: data.style_preset ?? null,
      mood_tags: data.mood_tags ?? [],
      visual_intensity: data.visual_intensity ?? null,
      text_rendering_intent: data.text_rendering_intent ?? null,
      realism_vs_design: data.realism_vs_design ?? null,
      color_preference: data.color_preference ?? null,
      aspect_ratio: data.aspect_ratio ?? null,
      reference_assets: data.reference_assets ?? [],
      advanced_settings: data.advanced_settings ?? {},
      parsed_brief_json: data.parsed_brief_json ?? {},
      concepting_session_key: data.concepting_session_key ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[save-history] saveBrief failed: ${error.message}`);
  }

  return row as CreativeBriefRow;
}

/**
 * updateBrief — Update an existing brief record.
 */
export async function updateBrief(
  briefId: string,
  updates: Partial<Omit<CreativeBriefRow, "id" | "project_id" | "created_at">>
): Promise<CreativeBriefRow> {
  const { data: row, error } = await supabaseAdmin
    .from("creative_briefs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", briefId)
    .select()
    .single();

  if (error) {
    throw new Error(`[save-history] updateBrief failed: ${error.message}`);
  }

  return row as CreativeBriefRow;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveConcepts — Insert multiple concept records in one call.
 * Returns the inserted rows in order.
 */
export async function saveConcepts(
  concepts: Array<Omit<CreativeConceptRow, "id" | "created_at">>
): Promise<CreativeConceptRow[]> {
  if (concepts.length === 0) return [];

  const { data: rows, error } = await supabaseAdmin
    .from("creative_concepts")
    .insert(
      concepts.map((c) => ({
        project_id: c.project_id,
        brief_id: c.brief_id ?? null,
        concept_index: c.concept_index,
        title: c.title,
        summary: c.summary,
        rationale: c.rationale ?? null,
        layout_strategy: c.layout_strategy ?? null,
        typography_strategy: c.typography_strategy ?? null,
        color_strategy: c.color_strategy ?? null,
        recommended_provider: c.recommended_provider ?? null,
        recommended_model: c.recommended_model ?? null,
        recommended_use_case: c.recommended_use_case ?? null,
        scores: c.scores ?? {},
        concept_payload: c.concept_payload ?? {},
        is_selected: c.is_selected ?? false,
      }))
    )
    .select();

  if (error) {
    throw new Error(`[save-history] saveConcepts failed: ${error.message}`);
  }

  return (rows ?? []) as CreativeConceptRow[];
}

/**
 * markConceptSelected — Set is_selected=true on one concept,
 * false on all others in the project, and update projects.selected_concept_id.
 */
export async function markConceptSelected(
  conceptId: string,
  projectId: string
): Promise<void> {
  // Deselect all concepts in the project
  const { error: deselErr } = await supabaseAdmin
    .from("creative_concepts")
    .update({ is_selected: false })
    .eq("project_id", projectId);

  if (deselErr) {
    throw new Error(
      `[save-history] markConceptSelected deselect failed: ${deselErr.message}`
    );
  }

  // Select the target concept
  const { error: selErr } = await supabaseAdmin
    .from("creative_concepts")
    .update({ is_selected: true })
    .eq("id", conceptId)
    .eq("project_id", projectId); // Safety: ensure concept belongs to project

  if (selErr) {
    throw new Error(
      `[save-history] markConceptSelected select failed: ${selErr.message}`
    );
  }

  // Update project's selected_concept_id
  const { error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .update({
      selected_concept_id: conceptId,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (projErr) {
    throw new Error(
      `[save-history] markConceptSelected project update failed: ${projErr.message}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATION OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveGeneration — Insert a creative generation record.
 */
export async function saveGeneration(
  data: Omit<CreativeGenerationRow, "id" | "created_at">
): Promise<CreativeGenerationRow> {
  const { data: row, error } = await supabaseAdmin
    .from("creative_generations")
    .insert({
      // project_id is nullable — CDv2 "free" directions supply null here.
      project_id: data.project_id ?? null,
      concept_id: data.concept_id ?? null,
      user_id: data.user_id,
      generation_type: data.generation_type ?? "base",
      provider: data.provider,
      model: data.model,
      request_payload: data.request_payload ?? {},
      normalized_prompt: data.normalized_prompt ?? {},
      asset_id: data.asset_id ?? null,
      status: data.status ?? "queued",
      credit_cost: data.credit_cost ?? 0,
      parent_generation_id: data.parent_generation_id ?? null,
      variation_type: data.variation_type ?? null,
      adaptation_target: data.adaptation_target ?? null,
      idempotency_key: data.idempotency_key ?? null,
      error_message: data.error_message ?? null,
      completed_at: data.completed_at ?? null,
      ...(data.session_id   ? { session_id:   data.session_id   } : {}),
      ...(data.direction_id ? { direction_id: data.direction_id } : {}),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[save-history] saveGeneration failed: ${error.message}`);
  }

  return row as CreativeGenerationRow;
}

/**
 * updateGenerationStatus — Update status, asset_id, and optionally error_message.
 * Sets completed_at when status becomes "completed" or "failed".
 */
export async function updateGenerationStatus(
  generationId: string,
  status: string,
  assetId?: string,
  errorMessage?: string
): Promise<void> {
  const isTerminal = status === "completed" || status === "failed";

  const { error } = await supabaseAdmin
    .from("creative_generations")
    .update({
      status,
      ...(assetId ? { asset_id: assetId } : {}),
      ...(errorMessage ? { error_message: errorMessage } : {}),
      ...(isTerminal ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", generationId);

  if (error) {
    throw new Error(
      `[save-history] updateGenerationStatus failed: ${error.message}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT CHAIN QUERY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getProjectChain — Load a project with its brief, concepts, and generations.
 * Returns null if the project does not exist or does not belong to the user.
 */
export async function getProjectChain(
  projectId: string,
  userId: string
): Promise<{
  project: CreativeProjectRow;
  brief: CreativeBriefRow | null;
  concepts: CreativeConceptRow[];
  generations: CreativeGenerationRow[];
} | null> {
  // Load project (user ownership check)
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projErr || !project) return null;

  // Load brief (most recent for this project)
  const { data: briefs } = await supabaseAdmin
    .from("creative_briefs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  // Load all concepts for project
  const { data: concepts } = await supabaseAdmin
    .from("creative_concepts")
    .select("*")
    .eq("project_id", projectId)
    .order("concept_index", { ascending: true });

  // Load all generations for project (most recent first)
  const { data: generations } = await supabaseAdmin
    .from("creative_generations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return {
    project: project as CreativeProjectRow,
    brief: (briefs?.[0] as CreativeBriefRow) ?? null,
    concepts: (concepts ?? []) as CreativeConceptRow[],
    generations: (generations ?? []) as CreativeGenerationRow[],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORK OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * forkProject — Duplicate a project + its brief + selected concept (not generations).
 * Creates a fresh project in "draft" status.
 */
export async function forkProject(
  sourceProjectId: string,
  userId: string,
  newTitle?: string
): Promise<CreativeProjectRow> {
  // Load source project + brief + selected concept
  const chain = await getProjectChain(sourceProjectId, userId);
  if (!chain) {
    throw new Error(`[save-history] forkProject: source project not found or unauthorized`);
  }

  const { project, brief, concepts } = chain;
  const selectedConcept = concepts.find((c) => c.is_selected) ?? concepts[0] ?? null;

  // Create new project
  const newProject = await saveProject({
    user_id: userId,
    title: newTitle ?? `${project.title} (Fork)`,
    project_type: project.project_type,
    brand_name: project.brand_name,
    audience: project.audience,
    platform: project.platform,
    status: "draft",
    selected_concept_id: undefined,
    cover_asset_id: undefined,
  });

  // Duplicate brief if it exists
  if (brief) {
    await saveBrief({
      project_id: newProject.id,
      original_input: brief.original_input,
      goal: brief.goal,
      headline: brief.headline,
      subheadline: brief.subheadline,
      cta: brief.cta,
      additional_copy_notes: brief.additional_copy_notes,
      project_type: brief.project_type,
      style_preset: brief.style_preset,
      mood_tags: brief.mood_tags,
      visual_intensity: brief.visual_intensity,
      text_rendering_intent: brief.text_rendering_intent,
      realism_vs_design: brief.realism_vs_design,
      color_preference: brief.color_preference,
      aspect_ratio: brief.aspect_ratio,
      reference_assets: brief.reference_assets,
      advanced_settings: brief.advanced_settings,
      parsed_brief_json: brief.parsed_brief_json,
      concepting_session_key: undefined, // Clear idempotency key on fork
    });
  }

  // Duplicate the selected concept only
  if (selectedConcept) {
    const [newConcept] = await saveConcepts([
      {
        project_id: newProject.id,
        brief_id: undefined, // Brief ID changed on fork
        concept_index: 0,
        title: selectedConcept.title,
        summary: selectedConcept.summary,
        rationale: selectedConcept.rationale,
        layout_strategy: selectedConcept.layout_strategy,
        typography_strategy: selectedConcept.typography_strategy,
        color_strategy: selectedConcept.color_strategy,
        recommended_provider: selectedConcept.recommended_provider,
        recommended_model: selectedConcept.recommended_model,
        recommended_use_case: selectedConcept.recommended_use_case,
        scores: selectedConcept.scores,
        concept_payload: selectedConcept.concept_payload,
        is_selected: true,
      },
    ]);

    // Update project with selected_concept_id
    if (newConcept) {
      await updateProject(newProject.id, {
        selected_concept_id: newConcept.id,
        status: "concepted",
      });

      return { ...newProject, selected_concept_id: newConcept.id, status: "concepted" };
    }
  }

  return newProject;
}

/**
 * forkFromGeneration — Create a new generation record branched from an existing one.
 * generation_type="fork", parent_generation_id set to source.
 * The new generation starts at "queued" status for re-rendering.
 */
export async function forkFromGeneration(
  generationId: string,
  projectId: string,
  userId: string
): Promise<CreativeGenerationRow> {
  // Load source generation
  const { data: source, error } = await supabaseAdmin
    .from("creative_generations")
    .select("*")
    .eq("id", generationId)
    .eq("project_id", projectId)
    .single();

  if (error || !source) {
    throw new Error(
      `[save-history] forkFromGeneration: generation not found: ${generationId}`
    );
  }

  const src = source as CreativeGenerationRow;

  // Create forked generation record
  return saveGeneration({
    project_id: projectId,
    concept_id: src.concept_id,
    user_id: userId,
    generation_type: "fork",
    provider: src.provider,
    model: src.model,
    request_payload: src.request_payload,
    normalized_prompt: src.normalized_prompt,
    asset_id: undefined, // Fresh generation — no asset yet
    status: "queued",
    credit_cost: src.credit_cost,
    parent_generation_id: generationId,
    variation_type: undefined,
    adaptation_target: undefined,
    idempotency_key: undefined,
    error_message: undefined,
    completed_at: undefined,
  });
}
