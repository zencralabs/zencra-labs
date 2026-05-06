-- Migration: add refunded_at to creative_generations
-- Tracks whether a failed async generation has already been refunded.
-- Used by POST /api/creative-director/generations/[id]/refund for idempotency.
-- NULL = never refunded. Non-null = refund timestamp.

alter table creative_generations
  add column if not exists refunded_at timestamptz default null;

comment on column creative_generations.refunded_at is
  'Timestamp when credits were refunded for this failed generation. NULL = not refunded.';
