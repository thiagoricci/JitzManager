-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies

-- 1. Users can view and update their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING ( id = auth.uid() );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING ( id = auth.uid() );

-- 2. Users can view profiles of others in the same organization
-- We use a separate policy to avoid potential recursion issues with complex logic,
-- though Postgres is generally good at optimizing 'id = auth.uid()'
DROP POLICY IF EXISTS "Users can view organization members" ON public.profiles;
CREATE POLICY "Users can view organization members"
ON public.profiles FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Platform Subscriptions Policies
-- Users need to see their organization's subscription status
DROP POLICY IF EXISTS "Users can view organization subscription" ON public.platform_subscriptions;
CREATE POLICY "Users can view organization subscription"
ON public.platform_subscriptions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);