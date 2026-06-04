-- Org staff roles & permissions (issue #5).
--
-- Introduces the role set owner / admin / coach / front_desk and enforces the
-- approved permission matrix at the database layer:
--
--   capability              owner admin coach front_desk
--   billing/subscriptions     x    x     -       -
--   manage staff              x    x     -       -
--   org settings              x    x     -       -
--   view audit log            x    x     -       -
--   add/edit/delete students  x    x     -       x
--   record attendance         x    x     x       x
--   promote ranks (belt/str)  x    x     x       -
--
-- owner/admin gates reuse the existing is_org_admin() helper. The student rules
-- are column-sensitive (front desk edits everything *except* rank; coaches edit
-- *only* rank), which RLS alone can't express, so a BEFORE UPDATE trigger refines
-- the row-level UPDATE policy.

-- 1. Migrate the legacy free-text 'staff' role to 'admin' so existing staff keep
--    their current access. Owners can demote them to coach/front_desk afterward.
UPDATE public.profiles SET role = 'admin' WHERE role = 'staff';

-- 2. Constrain role to the known set. NULL is allowed mid-onboarding (a profile
--    row can exist before its org/role is chosen).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('owner', 'admin', 'coach', 'front_desk'));

-- 3. Does the caller hold one of the given roles in this org? SECURITY DEFINER so
--    the profiles lookup isn't itself subject to RLS (mirrors is_org_admin()).
CREATE OR REPLACE FUNCTION public.has_org_role(org UUID, roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id = org
      AND role = ANY(roles)
  );
$$;

-- 4. Students.
--    INSERT/DELETE follow the matrix directly (owner/admin/front_desk).
DROP POLICY IF EXISTS "Users can insert students for their organization" ON public.students;
CREATE POLICY "Staff can insert students"
ON public.students FOR INSERT
WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'front_desk']));

DROP POLICY IF EXISTS "Users can delete students for their organization" ON public.students;
CREATE POLICY "Staff can delete students"
ON public.students FOR DELETE
USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'front_desk']));

--    UPDATE is allowed at the row level for any org member (coaches need it to
--    promote ranks); the trigger below enforces which *columns* each role may
--    touch.
DROP POLICY IF EXISTS "Users can update students for their organization" ON public.students;
CREATE POLICY "Staff can update students"
ON public.students FOR UPDATE
USING (organization_id = public.get_my_organization_id())
WITH CHECK (organization_id = public.get_my_organization_id());

-- Column-level rule for student updates. Runs BEFORE UPDATE so a violation aborts
-- the write (and the AFTER audit trigger never fires).
CREATE OR REPLACE FUNCTION public.enforce_student_update_perms()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Resolve the caller's role within the row's org. Service-role edge functions
  -- and the audit/system context run with auth.uid() = NULL (no matching row),
  -- and platform admins have no profile in this org -> v_role NULL -> bypass.
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND organization_id = NEW.organization_id;

  IF v_role IS NULL OR v_role IN ('owner', 'admin') THEN
    RETURN NEW;
  END IF;

  IF v_role = 'coach' THEN
    -- Coaches may change rank only: everything except belt/stripes must be equal.
    IF (to_jsonb(NEW) - 'belt' - 'stripes') IS DISTINCT FROM (to_jsonb(OLD) - 'belt' - 'stripes') THEN
      RAISE EXCEPTION 'coaches can only change a student''s rank (belt/stripes)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF v_role = 'front_desk' THEN
    -- Front desk may change anything except rank.
    IF NEW.belt IS DISTINCT FROM OLD.belt OR NEW.stripes IS DISTINCT FROM OLD.stripes THEN
      RAISE EXCEPTION 'front desk cannot change a student''s rank'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_student_update_perms
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_update_perms();

-- 5. Membership plans are billing config -> owner/admin only for writes.
DROP POLICY IF EXISTS "Users can insert membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Admins can insert membership plans"
ON public.membership_plans FOR INSERT
WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Users can update membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Admins can update membership plans"
ON public.membership_plans FOR UPDATE
USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Users can delete membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Admins can delete membership plans"
ON public.membership_plans FOR DELETE
USING (public.is_org_admin(organization_id));

-- 6. Schedules (the class schedule) stay readable AND writable by every staff
--    role, so the existing org-member policies are left untouched.

-- 7. Organization settings -> owner/admin only for updates.
DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
CREATE POLICY "Admins can update their organization"
ON public.organizations FOR UPDATE
USING (public.is_org_admin(id));

-- 8. Payments are written by service-role edge functions; restrict any
--    client-side insert to owner/admin (billing).
DROP POLICY IF EXISTS "Users can insert payments for their organization" ON public.payments;
CREATE POLICY "Admins can insert payments"
ON public.payments FOR INSERT
WITH CHECK (public.is_org_admin(organization_id));
