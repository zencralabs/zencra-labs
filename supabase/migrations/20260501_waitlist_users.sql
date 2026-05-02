-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20260501 — Waitlist Users
--
-- Stores public waitlist signups. Approved users receive a ZEN-INVITE-XXXXX
-- access code which is inserted into private_preview_access and can be entered
-- in the existing private preview gate (/api/preview-access).
--
-- Security:
--   - RLS enabled; no public reads, updates, or deletes.
--   - Inserts happen only via /api/waitlist/join using the service role key.
--   - Approvals happen only via /api/admin/waitlist/approve (admin-gated).
--   - The service role bypasses RLS automatically (no insert policy needed).
--
-- Status values: 'pending' | 'approved' | 'rejected'
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.waitlist_users (
  id           uuid        primary key default gen_random_uuid(),
  email        text        unique not null,
  name         text        null,
  role         text        null,
  intent       text        null,
  status       text        not null default 'pending',
  access_code  text        null,
  approved_at  timestamptz null,
  created_at   timestamptz not null default now()
);

comment on table public.waitlist_users is
  'Public waitlist signups. Approved users receive a ZEN-INVITE-XXXXX code.';
comment on column public.waitlist_users.status is
  'Lifecycle status: pending | approved | rejected';
comment on column public.waitlist_users.access_code is
  'Populated on approval; matches an entry in private_preview_access.access_code';

-- ── RLS — lock down completely ────────────────────────────────────────────────
alter table public.waitlist_users enable row level security;

create policy "waitlist_users_no_public_select"
  on public.waitlist_users
  for select
  using (false);

create policy "waitlist_users_no_public_update"
  on public.waitlist_users
  for update
  using (false)
  with check (false);

create policy "waitlist_users_no_public_delete"
  on public.waitlist_users
  for delete
  using (false);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists waitlist_users_email_idx
  on public.waitlist_users (email);

create index if not exists waitlist_users_status_idx
  on public.waitlist_users (status);
