-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 — Atomic shot claim for sequence queue advancement
--
-- Problem: Two parallel advance requests can both SELECT the same pending shot
-- and both dispatch it — resulting in duplicate jobs and potential double-charge.
--
-- Solution: A PostgreSQL function that atomically claims the next pending shot
-- using UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED).
--
-- FOR UPDATE SKIP LOCKED ensures that if two transactions race, the second
-- one skips the row that the first has locked and finds the next available row
-- (or returns nothing if none remain).
--
-- Usage (from advance/route.ts):
--   const { data } = await supabaseAdmin.rpc('claim_next_sequence_shot', {
--     p_sequence_id: sequenceId,
--   });
--   const claimed = data?.[0] ?? null;   // null → no pending shots remain
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.claim_next_sequence_shot(p_sequence_id uuid)
returns setof public.video_shots
language sql
security definer   -- runs as function owner (service role) so RLS doesn't block
as $$
  update public.video_shots
  set shot_status = 'dispatching'
  where id = (
    select id
    from   public.video_shots
    where  sequence_id = p_sequence_id
      and  shot_status = 'pending'
    order  by shot_number asc
    for    update skip locked
    limit  1
  )
  returning *;
$$;

-- Grant execute to the service role used by supabaseAdmin
-- (anon and authenticated roles do not call this directly — only server routes do)
grant execute on function public.claim_next_sequence_shot(uuid) to service_role;
