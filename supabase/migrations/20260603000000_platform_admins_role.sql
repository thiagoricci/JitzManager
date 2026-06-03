-- Role-based platform admin (de-hardcode email).
--
-- Replaces the hardcoded `thiago@reivien.com` literal in the platform-admin RLS
-- policies with a data-driven `platform_admins` table. Membership in that table
-- (not an email string) grants cross-tenant read access for the /admin console.
--
-- Decision (issue #3): a `platform_admins` table over a JWT custom claim. It
-- fits the existing profiles-lookup RLS pattern, is managed with plain
-- inserts/deletes, and is trivially testable in the RLS harness by seeding a row.

-- 1. The role table. Membership = platform admin. Writes are service_role only
--    (no INSERT/UPDATE/DELETE policy below -> authenticated cannot self-grant;
--    service_role bypasses RLS).
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- A user may read their own admin row (so the app can gate /admin), nothing more.
-- (00000 also defines this on fresh installs; drop-then-create keeps both paths idempotent.)
DROP POLICY IF EXISTS "Users can check their own platform admin status" ON public.platform_admins;
CREATE POLICY "Users can check their own platform admin status"
ON public.platform_admins FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. Centralized check. SECURITY DEFINER so it reads platform_admins regardless
--    of the caller's RLS (mirrors get_my_organization_id()), avoiding recursion
--    and keeping the membership test in one place. EXECUTE is granted to PUBLIC
--    by default, so the app can call it via supabase.rpc('is_platform_admin').
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

-- 3. Swap the email-literal policies for the role-driven check. Drop both the
--    old (email) name and the new name so this is idempotent whether the DB
--    started from the old 00000 (already-deployed) or the new one (fresh).
DROP POLICY IF EXISTS "Admin can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
CREATE POLICY "Platform admins can view all organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin can view all platform subscriptions" ON public.platform_subscriptions;
DROP POLICY IF EXISTS "Platform admins can view all platform subscriptions" ON public.platform_subscriptions;
CREATE POLICY "Platform admins can view all platform subscriptions"
ON public.platform_subscriptions FOR SELECT
TO authenticated
USING (public.is_platform_admin());

-- 4. One-time backfill: preserve the existing platform admin's access by
--    promoting the previously hardcoded account. Safe no-op on databases where
--    that user does not exist (e.g. fresh installs / the test harness).
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'thiago@reivien.com'
ON CONFLICT (user_id) DO NOTHING;
