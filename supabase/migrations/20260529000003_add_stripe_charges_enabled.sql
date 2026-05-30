-- Track whether a gym's Stripe Express account has completed onboarding
-- and is cleared to accept charges. Set to true via the account.updated webhook.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false;
