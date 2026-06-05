-- Automated dunning: scheduled-jobs substrate (issue #7).
--
-- Failed payments are retried on a per-org schedule (default days 1/3/5/7 after
-- the first failure). Each scheduled retry is materialized as a row in
-- dunning_attempts (the attempts ledger), processed by the process-dunning edge
-- function which is invoked daily by pg_cron (see the companion cron migration).
--
-- The membership freezes after the final failed attempt. Reuses the existing
-- students freeze columns (membership_status / freeze_reason / frozen_at) and the
-- is_org_admin() SECURITY DEFINER helper from the audit-log migration.

-- Per-org dunning configuration (the "retry schedule and grace policy").
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS dunning_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dunning_retry_days INTEGER[] NOT NULL DEFAULT '{1,3,5,7}',
  ADD COLUMN IF NOT EXISTS dunning_freeze_on_final BOOLEAN NOT NULL DEFAULT true;

-- The attempts ledger: one row per planned retry of a failed payment.
CREATE TABLE public.dunning_attempts (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id INTEGER NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL,                 -- 1-based index into the schedule
  scheduled_for DATE NOT NULL,                     -- when this attempt should run
  is_final BOOLEAN NOT NULL DEFAULT false,         -- last attempt before freeze
  status TEXT NOT NULL DEFAULT 'pending',          -- pending | succeeded | failed | skipped
  outcome TEXT,                                    -- failure reason / detail
  notified_at TIMESTAMPTZ,                         -- member email sent for this attempt
  processed_at TIMESTAMPTZ,                        -- when the runner handled it
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per (payment, attempt) makes seeding idempotent.
  UNIQUE (payment_id, attempt_number)
);

-- The runner scans for due, unprocessed attempts.
CREATE INDEX dunning_attempts_due_idx
  ON public.dunning_attempts (status, scheduled_for);

ALTER TABLE public.dunning_attempts ENABLE ROW LEVEL SECURITY;

-- Admin-readable within the org; writes happen only from the service_role runner
-- (bypasses RLS). With no INSERT/UPDATE/DELETE policies, authenticated users can
-- neither write nor alter the ledger. Mirrors the audit_log policy.
CREATE POLICY "Org admins can view their dunning attempts"
ON public.dunning_attempts FOR SELECT
TO authenticated
USING (public.is_org_admin(organization_id));
