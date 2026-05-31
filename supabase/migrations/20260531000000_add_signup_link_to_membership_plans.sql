-- Reusable Stripe Payment Link for student self-signup, stored per plan.
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS signup_link_url TEXT,
  ADD COLUMN IF NOT EXISTS signup_link_id TEXT;
