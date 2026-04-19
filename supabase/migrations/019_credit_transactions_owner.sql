-- ──────────────────────────────────────────────────────────────────────────────
-- 019_credit_transactions_owner.sql
--
-- Additive column to credit_transactions for Business shared pool tracking.
--
-- owner_user_id: populated only when a Business team member generates.
--   user_id      = the member who triggered the generation
--   owner_user_id = the subscription owner whose credits were debited
--
-- For all non-Business transactions, owner_user_id remains NULL.
-- Existing rows are unaffected (nullable column).
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS credit_transactions_owner_user_id_idx
  ON public.credit_transactions (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
