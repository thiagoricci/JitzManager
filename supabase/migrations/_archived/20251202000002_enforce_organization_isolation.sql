-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Students Policies
DROP POLICY IF EXISTS "Users can view students for their organization" ON public.students;
CREATE POLICY "Users can view students for their organization"
ON public.students FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert students for their organization" ON public.students;
CREATE POLICY "Users can insert students for their organization"
ON public.students FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update students for their organization" ON public.students;
CREATE POLICY "Users can update students for their organization"
ON public.students FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete students for their organization" ON public.students;
CREATE POLICY "Users can delete students for their organization"
ON public.students FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Membership Plans Policies
DROP POLICY IF EXISTS "Users can view membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Users can view membership plans for their organization"
ON public.membership_plans FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Users can insert membership plans for their organization"
ON public.membership_plans FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Users can update membership plans for their organization"
ON public.membership_plans FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete membership plans for their organization" ON public.membership_plans;
CREATE POLICY "Users can delete membership plans for their organization"
ON public.membership_plans FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Schedules Policies
DROP POLICY IF EXISTS "Users can view schedules for their organization" ON public.schedules;
CREATE POLICY "Users can view schedules for their organization"
ON public.schedules FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert schedules for their organization" ON public.schedules;
CREATE POLICY "Users can insert schedules for their organization"
ON public.schedules FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update schedules for their organization" ON public.schedules;
CREATE POLICY "Users can update schedules for their organization"
ON public.schedules FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete schedules for their organization" ON public.schedules;
CREATE POLICY "Users can delete schedules for their organization"
ON public.schedules FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Attendance Policies
DROP POLICY IF EXISTS "Users can view attendance for their organization" ON public.attendance;
CREATE POLICY "Users can view attendance for their organization"
ON public.attendance FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert attendance for their organization" ON public.attendance;
CREATE POLICY "Users can insert attendance for their organization"
ON public.attendance FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update attendance for their organization" ON public.attendance;
CREATE POLICY "Users can update attendance for their organization"
ON public.attendance FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete attendance for their organization" ON public.attendance;
CREATE POLICY "Users can delete attendance for their organization"
ON public.attendance FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Organizations Policies
-- Users can only view their own organization
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Users can only update their own organization
DROP POLICY IF EXISTS "Users can update their own organization" ON public.organizations;
CREATE POLICY "Users can update their own organization"
ON public.organizations FOR UPDATE
USING (
  id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Note: Insert policy for organizations is usually handled during signup/onboarding via Edge Functions or specific flows
-- but if we want to allow users to create organizations (e.g. multi-tenant), we might need an insert policy.
-- For now, assuming organization creation is handled securely elsewhere or via service role.