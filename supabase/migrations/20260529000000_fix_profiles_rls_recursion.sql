-- Fix infinite recursion in profiles RLS policy.
-- The "Users can view organization members" policy queried profiles from within
-- a profiles policy, causing PostgreSQL to recurse infinitely.
-- Solution: use a SECURITY DEFINER function that bypasses RLS to fetch the
-- current user's organization_id, then use it in the policy check.

DROP POLICY IF EXISTS "Users can view organization members" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Users can view organization members"
ON public.profiles FOR SELECT
USING (
  organization_id = public.get_my_organization_id()
);
