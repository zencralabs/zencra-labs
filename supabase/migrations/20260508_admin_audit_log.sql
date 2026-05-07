-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: admin_audit_log
-- Date:      2026-05-08
-- Purpose:   Insert-only audit trail for privileged admin actions.
--
-- Design decisions:
--   - No UPDATE or DELETE policies — rows are immutable forensic records.
--   - service role only for INSERT — no client-side writes possible.
--   - Indexes on admin_user_id + occurred_at for admin dashboard queries.
--   - event_context JSONB stores action-specific fields (e.g. affected user ID)
--     without requiring schema changes for each new admin action type.
--
-- Table is NOT exposed through RLS to authenticated users.
-- Only the service role key (used in API routes) can read or write.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  admin_user_id   uuid        NOT NULL,

  -- What route was called (e.g. "/api/admin/waitlist/approve")
  target_route    text        NOT NULL,

  -- HTTP method (GET, POST, etc.)
  method          text        NOT NULL DEFAULT 'POST',

  -- Action-specific context — denormalised for self-contained forensic records
  -- Examples: { waitlistUserId: "...", accessCode: "ZEN-INVITE-..." }
  --           { userId: "...", newRole: "admin" }
  event_context   jsonb       NOT NULL DEFAULT '{}',

  -- When the action occurred — set by the server, never the client
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary query pattern: "show me all actions by admin X in the last 30 days"
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_occurred
  ON public.admin_audit_log (admin_user_id, occurred_at DESC);

-- Secondary query: "show me all actions on route X"
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_route_occurred
  ON public.admin_audit_log (target_route, occurred_at DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────

-- Enable RLS — no policies defined means NO access from client-side PostgREST.
-- The service role key bypasses RLS entirely (used in API routes only).
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ── Grants ───────────────────────────────────────────────────────────────────

-- Revoke all public/authenticated access — this table is service-role-only.
-- The service role is granted implicitly by Supabase; no explicit grant needed.
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

-- ── Comment ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.admin_audit_log IS
  'Insert-only audit trail for Zencra Shield admin actions. '
  'Rows are immutable forensic records. No client-side access. '
  'Service role write-only from API routes.';
