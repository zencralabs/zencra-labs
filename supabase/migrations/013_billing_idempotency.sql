-- ──────────────────────────────────────────────────────────────────────────────
-- 013_billing_idempotency.sql
--
-- Upgrades the idempotency_key constraint on orders from a global UNIQUE
-- (any two orders with the same key are rejected, regardless of user) to a
-- per-user composite unique index (unique per user, not globally).
--
-- This prevents two different users from accidentally colliding on the same
-- client-generated UUID, which would cause a 500 for the second user even
-- though their request is perfectly valid.
--
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop the global unique constraint added by 004_orders.sql
-- (PostgreSQL names it <table>_<column>_key by convention)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_idempotency_key_key;

-- Add a per-user composite unique index (partial — only when key is set)
-- This allows two different users to have the same idempotency key value
-- while still preventing the same user from creating duplicate orders.
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_idempotency_key_idx
  ON public.orders (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
