-- ─────────────────────────────────────────────────────────────────────────────
-- 028_character_soul_id.sql
-- Soul ID system — persistent character identities across all Zencra studios
-- ─────────────────────────────────────────────────────────────────────────────

-- characters: persistent character identities (Soul ID system)
create table if not exists characters (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  soul_id              text not null unique,
  appearance_prompt    text not null default '',
  voice_profile        text,                           -- e.g. ElevenLabs voice ID
  personality_traits   jsonb not null default '{}'::jsonb,
  visual_style         text not null default 'cinematic', -- cinematic | realistic | anime
  visual_reference_url text,                           -- uploaded reference image
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Index for fast user lookups
create index if not exists idx_characters_user_id on characters(user_id);
create index if not exists idx_characters_soul_id  on characters(soul_id);

-- Extend creative_generations with character linkage
alter table creative_generations
  add column if not exists character_id uuid references characters(id) on delete set null;

create index if not exists idx_creative_generations_character_id
  on creative_generations(character_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table characters enable row level security;

-- Users can read their own characters
create policy "users_select_own_characters"
  on characters for select to authenticated
  using (user_id = auth.uid());

-- Users can insert their own characters
create policy "users_insert_own_characters"
  on characters for insert to authenticated
  with check (user_id = auth.uid());

-- Users can update their own characters
create policy "users_update_own_characters"
  on characters for update to authenticated
  using (user_id = auth.uid());

-- Users can delete their own characters
create policy "users_delete_own_characters"
  on characters for delete to authenticated
  using (user_id = auth.uid());

-- Service role bypass
create policy "service_role_all_characters"
  on characters for all to service_role
  using (true) with check (true);
