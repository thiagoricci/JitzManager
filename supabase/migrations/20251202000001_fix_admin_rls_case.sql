-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admin can view all platform subscriptions" ON public.platform_subscriptions;

-- Re-create policies with case-insensitive email check
CREATE POLICY "Admin can view all organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  lower(auth.jwt() ->> 'email') = 'thiago@reivien.com'
);

CREATE POLICY "Admin can view all platform subscriptions"
ON public.platform_subscriptions
FOR SELECT
TO authenticated
USING (
  lower(auth.jwt() ->> 'email') = 'thiago@reivien.com'
);