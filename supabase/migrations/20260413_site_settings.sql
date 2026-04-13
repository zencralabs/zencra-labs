-- ─────────────────────────────────────────────────────────────
-- site_settings: key/value store for admin-editable site content
-- ─────────────────────────────────────────────────────────────

create table if not exists public.site_settings (
  key         text        primary key,
  value       text        not null default '',
  updated_at  timestamptz not null default now()
);

-- Only service role (admin API) can write; public can read
alter table public.site_settings enable row level security;

create policy "Public can read site_settings"
  on public.site_settings for select
  using (true);

-- No insert/update/delete for regular users — admin API uses service role which bypasses RLS
