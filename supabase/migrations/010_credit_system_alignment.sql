-- ============================================================
-- Migration 010: Credit System Alignment
--
-- Problem:
--   1. credit_transactions.balance_after was NOT NULL, blocking
--      job-lifecycle audit entries (reserve / finalize / rollback)
--      that do not carry a balance snapshot (the balance snapshot
--      already exists on the spend/refund row written by the RPC).
--
--   2. credit_transactions.type CHECK constraint did not include
--      the job-lifecycle audit types used by hooks.ts:
--        reserve  — credits held at job start
--        finalize — actual cost settled on completion
--        rollback — credits returned on provider failure
--
-- Changes:
--   A. Drop the existing inline type CHECK constraint (auto-named
--      by Postgres) and replace it with a named constraint that
--      includes the three new lifecycle types.
--   B. Make balance_after nullable — audit entries do not carry a
--      balance snapshot; only spend / refund rows do.
--
-- Safe to re-run: uses IF EXISTS / DO block for idempotency.
-- ============================================================

-- ── A. Expand the type CHECK constraint ────────────────────────────────────────

-- Drop the existing (auto-named) CHECK constraint on type.
-- We use a DO block to look up the actual constraint name from pg_constraint,
-- because inline CHECK constraints get an auto-generated name that may vary.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO   v_constraint_name
  FROM   pg_constraint
  WHERE  conrelid = 'public.credit_transactions'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%type IN%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.credit_transactions DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END;
$$;

-- Add named constraint with the full allowed-type list.
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    -- ── Financial operations (written by spend_credits / refund_credits RPCs) ──
    'purchase',   -- bought a credit pack
    'spend',      -- deducted for a generation
    'gift_sent',  -- gifted credits to another user
    'gift_recv',  -- received gifted credits
    'referral',   -- earned from referral program
    'promo',      -- redeemed a promo code
    'refund',     -- credits returned from failed generation (RPC path)
    'admin',      -- manual adjustment by an admin
    -- ── Job lifecycle audit (written by hooks.ts) ──────────────────────────────
    'reserve',    -- credits held at job dispatch start
    'finalize',   -- actual cost settled on job completion
    'rollback'    -- credits returned when provider fails
  ));

-- ── B. Make balance_after nullable ─────────────────────────────────────────────
-- Audit entries (reserve / finalize / rollback) do not carry a balance snapshot.
-- The balance_after value is always captured on the authoritative spend / refund row.
ALTER TABLE public.credit_transactions
  ALTER COLUMN balance_after DROP NOT NULL;

-- ── Verification query (run manually to confirm) ───────────────────────────────
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM   pg_constraint
-- WHERE  conrelid = 'public.credit_transactions'::regclass
--   AND  contype  = 'c';
--
-- SELECT column_name, is_nullable
-- FROM   information_schema.columns
-- WHERE  table_name = 'credit_transactions'
--   AND  column_name = 'balance_after';
