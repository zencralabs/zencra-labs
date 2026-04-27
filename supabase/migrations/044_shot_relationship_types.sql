-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 044 — Shot Relationship Types
--
-- Adds cinematic intent fields to video_shots:
--
--   transition_type  — HOW the cut from shot N-1 to shot N happens
--   composition_type — WHAT shot N IS (framing / composition intent)
--
-- Both are nullable. First shot always has transition_type = null.
-- The two fields are orthogonal: a shot may have both, either, or neither.
--
-- Transition types:
--   cut_to          — standard cut, maintain visual consistency
--   match_action    — cut on matched motion/timing from previous shot
--   continue_motion — direct continuation, unbroken camera movement
--
-- Composition types:
--   reveal              — opens to wider view, exposes new visual info
--   close_up            — tight framing on subject face or detail
--   wide_establishing   — full environment, subject small in frame
--   reaction_shot       — subject's emotional response to previous moment
--   over_the_shoulder   — framed from behind another character / foreground element
--
-- Enforcement:
--   - Check constraints validate allowed values at DB level
--   - API route enforces: shot_number = 1 cannot have transition_type
--   - State hook enforces: continue_motion forces continuity_disabled = false
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.video_shots
  add column if not exists transition_type text
    check (transition_type in ('cut_to', 'match_action', 'continue_motion')),
  add column if not exists composition_type text
    check (composition_type in ('reveal', 'close_up', 'wide_establishing', 'reaction_shot', 'over_the_shoulder'));

-- Index on transition_type — useful for debugging and future analytics
create index if not exists idx_video_shots_transition_type
  on public.video_shots (transition_type)
  where transition_type is not null;

create index if not exists idx_video_shots_composition_type
  on public.video_shots (composition_type)
  where composition_type is not null;
