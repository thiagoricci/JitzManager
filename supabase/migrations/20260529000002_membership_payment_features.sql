-- Membership & payment management enhancements.

-- Students: billing start date + freeze details
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS billing_start_date DATE,
  ADD COLUMN IF NOT EXISTS freeze_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- Payments: retry tracking + Stripe metadata for retries
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
