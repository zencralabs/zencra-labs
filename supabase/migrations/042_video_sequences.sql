-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 042 — Cinematic Shot Sequencing
--
-- Creates two tables for the multi-shot video sequencing system:
--
--   video_sequences  — top-level sequence record (one per user session)
--   video_shots      — individual shots within a sequence
--
-- Design notes:
--   • sequence_status / shot_status kept distinct from generic "status" to
--     avoid ambiguity when joined with assets / job tables.
--   • resolved_prompt stores the final prompt after continuity engine runs
--     (7-step prompt construction + transition hint for shots 2+).
--   • identity_context (jsonb) stores all @handle resolutions used for this
--     shot — enables multi-character scene debugging without schema changes.
--   • continuity_disabled lets users opt a shot out of frame-carry-forward.
--     When false (default): previous shot end_frame overrides manual start_frame.
--     When true: user's manual start_frame_url is used as-is.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── video_sequences ───────────────────────────────────────────────────────────

create table if not exists public.video_sequences (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,

  -- metadata
  title             text,                          -- optional user-defined name
  description       text,                          -- optional intent / notes

  -- model config (inherited by all shots unless overridden per-shot in future)
  model_id          text        not null,           -- catalog model id, e.g. "kling-30-omni"
  aspect_ratio      text        not null default '16:9',
  duration_seconds  integer     not null default 5,

  -- progress tracking
  sequence_status   text        not null default 'draft'
                    check (sequence_status in (
                      'draft',        -- not yet submitted
                      'generating',   -- shots dispatching / in flight
                      'completed',    -- all shots done
                      'partial',      -- some shots done, some failed
                      'failed'        -- all shots failed
                    )),
  total_shots       integer     not null default 0,
  completed_shots   integer     not null default 0,

  -- timestamps
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── video_shots ───────────────────────────────────────────────────────────────

create table if not exists public.video_shots (
  id                    uuid        primary key default gen_random_uuid(),
  sequence_id           uuid        not null references public.video_sequences(id) on delete cascade,
  user_id               uuid        not null references auth.users(id) on delete cascade,

  -- ordering
  shot_number           integer     not null,       -- 1-based position in sequence

  -- prompt layer
  prompt                text        not null,       -- raw user prompt for this shot
  resolved_prompt       text,                       -- final prompt after continuity engine (set at dispatch time)
  identity_context      jsonb,                      -- debug: all @handle → identity mappings used for this shot

  -- frame continuity
  start_frame_url       text,                       -- user-provided start frame image URL
  end_frame_url         text,                       -- user-provided end frame image URL
  continuity_disabled   boolean     not null default false,
  -- When continuity_disabled = false (default):
  --   previous shot's output_video_url is used as end_frame for that shot
  --   AND its last frame URL overrides this shot's start_frame_url.
  -- When continuity_disabled = true:
  --   start_frame_url is used as-is; no carry-forward from prior shot.

  -- motion
  motion_control        jsonb,                      -- camera control settings {type, config?}

  -- dispatch linkage
  job_id                uuid,                       -- references generation_jobs(id) once dispatched
  asset_id              uuid,                       -- references assets(id) once complete

  -- shot lifecycle
  shot_status           text        not null default 'pending'
                        check (shot_status in (
                          'pending',      -- waiting to be dispatched
                          'dispatching',  -- being submitted to studioDispatch
                          'generating',   -- job submitted, polling in flight
                          'done',         -- generation complete, asset saved
                          'failed'        -- generation failed
                        )),
  error_message         text,                       -- populated on failure

  -- timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- enforce unique shot order within a sequence
  unique (sequence_id, shot_number)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_video_sequences_user_id
  on public.video_sequences (user_id);

create index if not exists idx_video_sequences_status
  on public.video_sequences (sequence_status);

create index if not exists idx_video_shots_sequence_id
  on public.video_shots (sequence_id);

create index if not exists idx_video_shots_user_id
  on public.video_shots (user_id);

create index if not exists idx_video_shots_job_id
  on public.video_shots (job_id);

create index if not exists idx_video_shots_shot_status
  on public.video_shots (shot_status);

-- ── updated_at trigger ────────────────────────────────────────────────────────

-- Reuse the set_updated_at() function that already exists in the schema.
-- If it doesn't exist, create it.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger video_sequences_updated_at
  before update on public.video_sequences
  for each row execute function public.set_updated_at();

create trigger video_shots_updated_at
  before update on public.video_shots
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.video_sequences enable row level security;
alter table public.video_shots     enable row level security;

-- Users can only see and modify their own sequences and shots.
-- Service role bypasses RLS (used by API routes and studioDispatch).

create policy "Users manage own sequences"
  on public.video_sequences
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own shots"
  on public.video_shots
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
