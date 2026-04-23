-- ─────────────────────────────────────────────────────────────────────────────
-- 029_project_system.sql
-- Zencra Project System — unified project + session backbone
--
-- Strategy:
--   • projects         → extend existing table (add cover_asset_id, visibility)
--   • project_sessions → new table (workflow/run container under a project)
--   • creative_concepts     → add session_id FK
--   • creative_generations  → add session_id FK
--   • assets (universal)   → add project_id, session_id, concept_id, is_favorite, visibility
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend projects table ──────────────────────────────────────────────────
-- Already has: id, user_id, name, description, cover_url, asset_count, timestamps
-- We add: cover_asset_id (structured FK for future), visibility

alter table projects
  add column if not exists cover_asset_id uuid references assets(id) on delete set null,
  add column if not exists visibility     text not null default 'private';

-- Validate visibility values going forward
alter table projects
  drop constraint if exists projects_visibility_check;
alter table projects
  add constraint projects_visibility_check
  check (visibility in ('private', 'public'));

-- ── 2. Create project_sessions table ─────────────────────────────────────────
-- Each session is one creative run: a brief → concepts → renders cycle.
-- type = 'image' | 'creative-director'
-- status progression: draft → concepts_generated → rendering → completed

create table if not exists project_sessions (
  id                  uuid        primary key default gen_random_uuid(),
  project_id          uuid        not null references projects(id) on delete cascade,
  name                text,                                        -- optional label, e.g. "Run 2"
  type                text        not null default 'creative-director',
  brief_json          jsonb       not null default '{}'::jsonb,    -- raw brief state
  parsed_brief_json   jsonb       not null default '{}'::jsonb,    -- LLM-parsed brief
  selected_concept_id uuid,                                        -- FK added below (avoids forward-ref)
  status              text        not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Validate type + status values
alter table project_sessions
  add constraint project_sessions_type_check
  check (type in ('image', 'creative-director'));

alter table project_sessions
  add constraint project_sessions_status_check
  check (status in ('draft', 'concepts_generated', 'rendering', 'completed'));

-- Indexes
create index if not exists idx_project_sessions_project_id on project_sessions(project_id);
create index if not exists idx_project_sessions_status     on project_sessions(status);

-- ── 3. Extend creative_concepts — add session_id ──────────────────────────────
-- existing project_id → creative_projects (unchanged)
-- new session_id → project_sessions

alter table creative_concepts
  add column if not exists session_id uuid references project_sessions(id) on delete set null;

create index if not exists idx_creative_concepts_session_id on creative_concepts(session_id);

-- Now we can add the selected_concept_id FK on project_sessions
alter table project_sessions
  add constraint project_sessions_selected_concept_id_fk
  foreign key (selected_concept_id) references creative_concepts(id) on delete set null;

-- ── 4. Extend creative_generations — add session_id ──────────────────────────
-- existing project_id → creative_projects (unchanged)
-- existing concept_id → creative_concepts (unchanged)
-- new session_id → project_sessions

alter table creative_generations
  add column if not exists session_id uuid references project_sessions(id) on delete set null;

create index if not exists idx_creative_generations_session_id on creative_generations(session_id);

-- ── 5. Extend assets (universal output table) ─────────────────────────────────
-- assets is the single library of all completed outputs across all studios.
-- We link each asset back to the project system and add user-facing flags.

alter table assets
  add column if not exists project_id  uuid    references projects(id)          on delete set null,
  add column if not exists session_id  uuid    references project_sessions(id)   on delete set null,
  add column if not exists concept_id  uuid    references creative_concepts(id)  on delete set null,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists visibility  text    not null default 'private';

-- Validate visibility
alter table assets
  drop constraint if exists assets_visibility_check;
alter table assets
  add constraint assets_visibility_check
  check (visibility in ('private', 'public'));

-- Indexes for dashboard queries
create index if not exists idx_assets_project_id  on assets(project_id);
create index if not exists idx_assets_session_id  on assets(session_id);
create index if not exists idx_assets_concept_id  on assets(concept_id);
create index if not exists idx_assets_is_favorite on assets(is_favorite) where is_favorite = true;
create index if not exists idx_assets_user_created on assets(user_id, created_at desc);

-- ── 6. RLS — project_sessions ─────────────────────────────────────────────────

alter table project_sessions enable row level security;

-- Users can read sessions that belong to their projects
create policy "users_select_own_sessions"
  on project_sessions for select to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

-- Users can insert sessions into their own projects
create policy "users_insert_own_sessions"
  on project_sessions for insert to authenticated
  with check (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

-- Users can update their own sessions
create policy "users_update_own_sessions"
  on project_sessions for update to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

-- Users can delete their own sessions
create policy "users_delete_own_sessions"
  on project_sessions for delete to authenticated
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

-- Service role bypass
create policy "service_role_all_sessions"
  on project_sessions for all to service_role
  using (true) with check (true);

-- ── 7. RLS — projects (ensure policies exist) ─────────────────────────────────

alter table projects enable row level security;

-- Drop + recreate to avoid duplicate-name errors on re-run
drop policy if exists "users_select_own_projects"  on projects;
drop policy if exists "users_insert_own_projects"  on projects;
drop policy if exists "users_update_own_projects"  on projects;
drop policy if exists "users_delete_own_projects"  on projects;
drop policy if exists "service_role_all_projects"  on projects;

create policy "users_select_own_projects"
  on projects for select to authenticated
  using (user_id = auth.uid());

create policy "users_insert_own_projects"
  on projects for insert to authenticated
  with check (user_id = auth.uid());

create policy "users_update_own_projects"
  on projects for update to authenticated
  using (user_id = auth.uid());

create policy "users_delete_own_projects"
  on projects for delete to authenticated
  using (user_id = auth.uid());

create policy "service_role_all_projects"
  on projects for all to service_role
  using (true) with check (true);

-- ── 8. updated_at trigger for project_sessions ───────────────────────────────

create or replace function update_updated_at_column()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_project_sessions on project_sessions;
create trigger set_updated_at_project_sessions
  before update on project_sessions
  for each row execute function update_updated_at_column();

drop trigger if exists set_updated_at_projects on projects;
create trigger set_updated_at_projects
  before update on projects
  for each row execute function update_updated_at_column();
