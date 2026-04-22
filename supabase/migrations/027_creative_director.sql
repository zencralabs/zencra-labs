-- ============================================================
-- Migration 027: Creative Director
-- AI-guided creative workflow mode for Zencra Image Studio
-- ============================================================

-- creative_projects: top-level project container
create table if not exists creative_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  project_type text not null,
  brand_name text,
  audience text,
  platform text,
  status text not null default 'draft', -- draft, concepted, generated, archived
  selected_concept_id uuid,
  cover_asset_id uuid,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- creative_briefs: parsed + raw brief for a project
create table if not exists creative_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references creative_projects(id) on delete cascade,
  original_input text,
  goal text,
  headline text,
  subheadline text,
  cta text,
  additional_copy_notes text,
  project_type text,
  style_preset text,
  mood_tags jsonb not null default '[]'::jsonb,
  visual_intensity text,
  text_rendering_intent text,
  realism_vs_design numeric(5,2),
  color_preference text,
  aspect_ratio text,
  reference_assets jsonb not null default '[]'::jsonb,
  advanced_settings jsonb not null default '{}'::jsonb,
  parsed_brief_json jsonb not null default '{}'::jsonb,
  concepting_session_key text, -- idempotency key for concept generation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- creative_concepts: 3 concept directions per brief
create table if not exists creative_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references creative_projects(id) on delete cascade,
  brief_id uuid references creative_briefs(id) on delete set null,
  concept_index int not null,
  title text not null,
  summary text not null,
  rationale text,
  layout_strategy text,
  typography_strategy text,
  color_strategy text,
  recommended_provider text,
  recommended_model text,
  recommended_use_case text,
  scores jsonb not null default '{}'::jsonb,
  concept_payload jsonb not null default '{}'::jsonb,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- creative_generations: lineage-aware generation records
-- asset_id links to existing assets table (no separate creative asset table)
create table if not exists creative_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references creative_projects(id) on delete cascade,
  concept_id uuid references creative_concepts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_type text not null default 'base', -- base, variation, adaptation, fork
  provider text not null,
  model text not null,
  request_payload jsonb not null default '{}'::jsonb,
  normalized_prompt jsonb not null default '{}'::jsonb,
  asset_id uuid references assets(id) on delete set null,
  status text not null default 'queued', -- queued, processing, completed, failed
  credit_cost numeric(10,2) not null default 0,
  parent_generation_id uuid references creative_generations(id) on delete set null,
  variation_type text,
  adaptation_target text,
  idempotency_key text unique,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- creative_activity_log: full event chain
create table if not exists creative_activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references creative_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_creative_projects_user_id on creative_projects(user_id);
create index if not exists idx_creative_projects_status on creative_projects(status);
create index if not exists idx_creative_briefs_project_id on creative_briefs(project_id);
create index if not exists idx_creative_concepts_project_id on creative_concepts(project_id);
create index if not exists idx_creative_generations_project_id on creative_generations(project_id);
create index if not exists idx_creative_generations_concept_id on creative_generations(concept_id);
create index if not exists idx_creative_generations_parent_id on creative_generations(parent_generation_id);
create index if not exists idx_creative_activity_log_project_id on creative_activity_log(project_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table creative_projects enable row level security;
alter table creative_briefs enable row level security;
alter table creative_concepts enable row level security;
alter table creative_generations enable row level security;
alter table creative_activity_log enable row level security;

-- Service role bypass (same pattern as other tables)
create policy "service_role_all_creative_projects"
  on creative_projects for all to service_role
  using (true) with check (true);

create policy "service_role_all_creative_briefs"
  on creative_briefs for all to service_role
  using (true) with check (true);

create policy "service_role_all_creative_concepts"
  on creative_concepts for all to service_role
  using (true) with check (true);

create policy "service_role_all_creative_generations"
  on creative_generations for all to service_role
  using (true) with check (true);

create policy "service_role_all_creative_activity_log"
  on creative_activity_log for all to service_role
  using (true) with check (true);
