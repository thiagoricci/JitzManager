-- Add missing INSERT policies on profiles and organizations.
-- The Onboarding page inserts into both tables directly from the client
-- (RLS-bound), but neither table had an INSERT policy, causing 403s.

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (owner_id = auth.uid());
