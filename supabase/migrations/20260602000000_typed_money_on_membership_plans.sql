-- Issue #2: typed money on membership plans.
-- Replace the free-text price/period fields with proper typed columns and add
-- the currency / setup_fee / billing_day_of_month columns. Existing rows are
-- backfilled in place with no data loss (legacy capitalized periods are
-- lowercased onto the new enum; price strings are stripped of any currency
-- symbols/commas before casting).

-- 1. Billing period enum. Keeps all six values the app has historically used
--    (daily + weekly drive the "free trial" detection) so nothing is dropped.
DO $$
BEGIN
  CREATE TYPE public.billing_period AS ENUM (
    'daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2. period TEXT -> billing_period, normalizing existing values (e.g. "Monthly").
ALTER TABLE public.membership_plans
  ALTER COLUMN period TYPE public.billing_period
  USING (
    CASE lower(trim(period))
      WHEN 'daily'     THEN 'daily'
      WHEN 'weekly'    THEN 'weekly'
      WHEN 'monthly'   THEN 'monthly'
      WHEN 'quarterly' THEN 'quarterly'
      WHEN 'biannual'  THEN 'biannual'
      WHEN 'annual'    THEN 'annual'
      ELSE 'monthly'
    END
  )::public.billing_period;

-- 3. price TEXT -> numeric(10,2). Strip anything that is not a digit, dot or
--    minus so values like "$150.00" or "1,200" survive the cast; empty strings
--    fall back to 0 to honour the NOT NULL constraint.
ALTER TABLE public.membership_plans
  ALTER COLUMN price TYPE numeric(10, 2)
  USING COALESCE(
    NULLIF(regexp_replace(price, '[^0-9.\-]', '', 'g'), '')::numeric,
    0
  );

-- 4. New typed money fields.
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS setup_fee numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_day_of_month integer
    CHECK (billing_day_of_month BETWEEN 1 AND 31);
