-- ============================================================
-- Migration: 20260506_business_workspace
-- Purpose  : Business Plan Team Workspace infrastructure
--            Workspaces own a shared credit pool; members
--            spend from it instead of their personal balance.
-- Plans    : Only plan_id = 'business' uses workspaces.
--            Credits live on workspaces.shared_credit_pool,
--            NOT on user_credits.balance for business users.
-- ============================================================

-- ── 1. workspaces ──────────────────────────────────────────
create table if not exists public.workspaces (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete restrict,
  name                text not null,
  plan_id             text not null default 'business',
  seat_count          smallint not null default 2,
  max_seats           smallint not null default 3,
  shared_credit_pool  integer not null default 0 check (shared_credit_pool >= 0),
  stripe_subscription_id text,
  billing_cycle_start date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint workspaces_seat_count_range   check (seat_count  between 2 and 10),
  constraint workspaces_max_seats_range    check (max_seats   between 2 and 10),
  constraint workspaces_seat_lte_max      check (seat_count  <= max_seats)
);

comment on table  public.workspaces                    is 'Business-plan team workspaces with a shared credit pool.';
comment on column public.workspaces.owner_id           is 'The user who created/owns the workspace (role = owner in workspace_members).';
comment on column public.workspaces.seat_count         is 'Current purchased seats (2 base + optional extras).';
comment on column public.workspaces.max_seats          is 'Upper self-serve cap; currently 3. Override for enterprise.';
comment on column public.workspaces.shared_credit_pool is 'Credits available to ALL members. Decremented by spend_credits RPC for business users.';

-- auto-update updated_at
create or replace function public.workspaces_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.workspaces_set_updated_at();

-- ── 2. workspace_members ────────────────────────────────────
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  status       text not null default 'active' check (status in ('active','suspended','removed')),
  invited_by   uuid references auth.users(id) on delete set null,
  joined_at    timestamptz not null default now(),

  constraint workspace_members_unique unique (workspace_id, user_id)
);

comment on table  public.workspace_members           is 'Membership roster for each workspace.';
comment on column public.workspace_members.role      is 'owner = full control; admin = manage members; member = consume credits.';
comment on column public.workspace_members.status    is 'active = can spend credits; suspended = blocked but still listed; removed = soft-deleted.';

create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user_id      on public.workspace_members(user_id);

-- ── 3. workspace_invites ────────────────────────────────────
create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email        text not null,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  role         text not null default 'member' check (role in ('admin','member')),
  invited_by   uuid not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),

  -- one pending invite per email per workspace
  constraint workspace_invites_unique unique (workspace_id, email)
);

comment on table  public.workspace_invites            is 'Pending email invitations to join a workspace.';
comment on column public.workspace_invites.token      is 'Secure random hex token sent in invite URL.';
comment on column public.workspace_invites.expires_at is 'Invite link expires 7 days after creation.';
comment on column public.workspace_invites.accepted_at is 'Set when invite is accepted; NULL = still pending.';

create index if not exists idx_workspace_invites_workspace_id on public.workspace_invites(workspace_id);
create index if not exists idx_workspace_invites_token        on public.workspace_invites(token);
create index if not exists idx_workspace_invites_email        on public.workspace_invites(email);

-- ── 4. RLS ─────────────────────────────────────────────────
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- workspaces: owner or any active member can read their workspace
create policy "workspaces_select_member"
  on public.workspaces for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

-- workspaces: only owner/admin can update (e.g. rename, seat changes handled server-side)
create policy "workspaces_update_owner"
  on public.workspaces for update
  using (auth.uid() = owner_id);

-- workspaces: service role handles insert (subscription webhook creates workspace)
create policy "workspaces_insert_service"
  on public.workspaces for insert
  with check (false);   -- blocked for direct client; use service-role only

-- workspace_members: read own memberships or if owner/admin of workspace
create policy "workspace_members_select"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id
        and (
          w.owner_id = auth.uid()
          or exists (
            select 1 from public.workspace_members wm2
            where wm2.workspace_id = workspace_id
              and wm2.user_id = auth.uid()
              and wm2.role in ('owner','admin')
              and wm2.status = 'active'
          )
        )
    )
  );

-- workspace_members: service role only for insert/update/delete
create policy "workspace_members_insert_service" on public.workspace_members for insert with check (false);
create policy "workspace_members_update_service" on public.workspace_members for update using (false);
create policy "workspace_members_delete_service" on public.workspace_members for delete using (false);

-- workspace_invites: workspace owner/admin can read invites for their workspace
create policy "workspace_invites_select"
  on public.workspace_invites for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
        and wm.status = 'active'
    )
  );

-- workspace_invites: anyone can read their own invite by token (for accept page)
create policy "workspace_invites_select_by_token"
  on public.workspace_invites for select
  using (email = (select email from auth.users where id = auth.uid()));

-- workspace_invites: owner/admin can insert invites
create policy "workspace_invites_insert"
  on public.workspace_invites for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
        and wm.status = 'active'
    )
  );

-- workspace_invites: service role handles accept (sets accepted_at, creates member row)
create policy "workspace_invites_update_service" on public.workspace_invites for update using (false);
create policy "workspace_invites_delete_service" on public.workspace_invites for delete using (false);

-- ── 5. Helper: get_workspace_for_user ──────────────────────
-- Returns the workspace_id for a given user if they are an
-- active member of a business workspace. Used by credit RPCs.
create or replace function public.get_workspace_for_user(p_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select wm.workspace_id
  from public.workspace_members wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = p_user_id
    and wm.status  = 'active'
    and w.plan_id  = 'business'
  limit 1;
$$;

comment on function public.get_workspace_for_user is
  'Returns the business workspace_id for a user, or NULL if not in a business workspace. Used to route credit deductions to the shared pool.';
