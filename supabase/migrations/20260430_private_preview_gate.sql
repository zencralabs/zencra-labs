-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20260430 — Private Preview Gate
--
-- Creates the private_preview_access table used by /api/preview-access.
-- All validation goes through the server API route using the service role key.
-- Anon and authenticated roles have ZERO direct access to this table.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists private_preview_access (
  id           uuid        primary key default gen_random_uuid(),
  access_code  text        unique not null,
  email        text        null,
  label        text        null,
  is_active    boolean     not null default true,
  max_uses     int         null,                        -- null = unlimited
  used_count   int         not null default 0,
  expires_at   timestamptz null,                        -- null = never expires
  created_at   timestamptz not null default now()
);

comment on table private_preview_access is
  'Access codes for the private preview gate. Validated server-side only via service role.';
comment on column private_preview_access.access_code is 'The code users enter. Stored plain; treat as semi-public after sharing.';
comment on column private_preview_access.max_uses     is 'NULL = unlimited uses.';
comment on column private_preview_access.expires_at   is 'NULL = code never expires.';

-- ── RLS — lock down the table completely ────────────────────────────────────
alter table private_preview_access enable row level security;

-- No public reads, no public writes. Service role bypasses RLS automatically.
-- If you need admin read access via the Supabase dashboard, use the service
-- role key in the table editor (it bypasses RLS by design).
create policy "no_public_select" on private_preview_access
  for select using (false);

create policy "no_public_insert" on private_preview_access
  for insert with check (false);

create policy "no_public_update" on private_preview_access
  for update using (false);

create policy "no_public_delete" on private_preview_access
  for delete using (false);

-- ── Index — code lookup must be fast ────────────────────────────────────────
create index if not exists idx_private_preview_access_code
  on private_preview_access (access_code);

-- ── Seed — copy and run manually to add the founder preview code ─────────────
-- Do NOT uncomment here unless you want this applied automatically on every
-- migration run (idempotent only if the code doesn't already exist).
--
-- INSERT INTO private_preview_access (access_code, label, max_uses)
-- VALUES ('ZENCRA-PRIVATE-2026', 'Founder preview code', 100)
-- ON CONFLICT (access_code) DO NOTHING;
