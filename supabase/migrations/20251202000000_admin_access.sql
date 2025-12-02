-- Allow admin to view all organizations
CREATE POLICY "Admin can view all organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'thiago@reivien.com'
);

-- Allow admin to view all platform subscriptions
CREATE POLICY "Admin can view all platform subscriptions"
ON public.platform_subscriptions
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'thiago@reivien.com'
);