-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260503_creative_directions
-- Phase A — Creative Director v2 Direction Layer
--
-- Adds:
--   creative_directions    — the direction a user commits to
--   direction_refinements  — cinematic still-image composition parameters
--   direction_elements     — scene elements (subject, world, object, atmosphere)
--   creative_generations.direction_id — links any generation to its direction
--
-- Scope: Image Studio / Creative Director only. Still images only.
-- No video logic. No motion logic.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── creative_directions ───────────────────────────────────────────────────────
create table if not exists creative_directions (
  id          uuid primary key default gen_random_uuid(),

  user_id     uuid not null,
  project_id  uuid references creative_projects(id) on delete cascade,
  session_id  uuid,          -- optional link to project_sessions

  concept_id  uuid references creative_concepts(id) on delete set null,
  -- concept_id is nullable — directions can exist independently of AI concepts

  name        text,          -- optional label: "Neon Night Scene", "Golden Hour Campaign"

  is_locked   boolean not null default false,
  -- is_locked = true → direction is committed; Generate button becomes active

  model_key   text,          -- model locked for this direction (e.g. "gpt-image-1", "nb-standard")

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_creative_directions_user_id    on creative_directions(user_id);
create index if not exists idx_creative_directions_project_id on creative_directions(project_id);
create index if not exists idx_creative_directions_concept_id on creative_directions(concept_id);

-- ── direction_refinements ─────────────────────────────────────────────────────
-- Cinematic still-image composition parameters.
-- One row per direction — upsert on update.
-- All fields nullable so partial saves work cleanly.
-- sceneEnergy replaces motionType (CD v2 generates stills, not video).

create table if not exists direction_refinements (
  id           uuid primary key default gen_random_uuid(),

  direction_id uuid not null references creative_directions(id) on delete cascade,

  -- Tone
  tone_intensity  int check (tone_intensity between 0 and 100),
  -- 0 = subtle / 100 = ultra-dramatic

  -- Color
  color_palette   text,
  -- warm / cool / cinematic / neon / desaturated / vivid / monochrome

  -- Light
  lighting_style  text,
  -- dramatic / soft / golden-hour / neon / overcast / studio / practical

  -- Composition
  shot_type       text,
  -- close / medium / wide / extreme-wide / macro / aerial

  lens            text,
  -- 24mm / 35mm / 50mm / 85mm / 135mm

  camera_angle    text,
  -- eye-level / low / high / dutch / top-down / worms-eye

  -- Scene energy (still image representation of pose/action state)
  -- Values: static / walking-pose / action-pose / dramatic-still
  -- Never "motion" or video language
  scene_energy    text,

  -- Identity
  identity_lock   boolean not null default true,
  -- true = @handle identity will be injected into prompt

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_direction_refinements_direction_id
  on direction_refinements(direction_id);
-- One refinements row per direction — unique enforced at DB level

-- ── direction_elements ────────────────────────────────────────────────────────
-- Scene elements the director places into the direction.
-- type: subject / world / object / atmosphere

create table if not exists direction_elements (
  id           uuid primary key default gen_random_uuid(),

  direction_id uuid not null references creative_directions(id) on delete cascade,

  type         text not null check (type in ('subject', 'world', 'object', 'atmosphere')),

  label        text not null,
  -- "car", "rain", "neon signs", "cinematic fog"

  asset_url    text,
  -- optional image reference for this element

  weight       float not null default 0.5 check (weight >= 0 and weight <= 1),
  -- 0 = barely visible / 1 = dominant element

  position     int not null default 0,
  -- ordering within type group

  created_at   timestamptz not null default now()
);

create index if not exists idx_direction_elements_direction_id
  on direction_elements(direction_id);

-- ── creative_generations: add direction_id ────────────────────────────────────
-- Nullable — existing rows have no direction. New rows from direction-generate
-- route will have direction_id set. Existing concept-based generate route
-- continues to work unchanged.

alter table creative_generations
  add column if not exists direction_id uuid references creative_directions(id) on delete set null;

create index if not exists idx_creative_generations_direction_id
  on creative_generations(direction_id);

-- ── RLS — service role only (consistent with existing CD tables) ──────────────
alter table creative_directions   enable row level security;
alter table direction_refinements enable row level security;
alter table direction_elements    enable row level security;

-- All reads/writes go through supabaseAdmin (service role).
-- No direct client-side access — consistent with existing CD architecture.
create policy "service role only" on creative_directions   for all using (true) with check (true);
create policy "service role only" on direction_refinements for all using (true) with check (true);
create policy "service role only" on direction_elements    for all using (true) with check (true);
