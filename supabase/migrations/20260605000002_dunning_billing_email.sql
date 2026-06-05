-- Per-org billing contact for dunning emails (issue #7 follow-up).
--
-- Dunning emails are sent from the platform's verified domain (one
-- DUNNING_FROM_EMAIL), but with the gym's name as the display name and this
-- address as Reply-To, so members see the gym and replies reach the gym without
-- per-gym domain verification. Falls back to the org owner's email when unset.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_email TEXT;
