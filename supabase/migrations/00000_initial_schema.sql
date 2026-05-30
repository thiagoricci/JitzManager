-- ============================================
-- BJJ Gym Management - Initial Schema
-- Consolidated from all incremental migrations
-- ============================================

-- 1. Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  logo_url TEXT,
  owner_id UUID,
  timezone TEXT,
  check_in_minutes_before INTEGER,
  check_in_minutes_after INTEGER,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Membership Plans
CREATE TABLE public.membership_plans (
  id SERIAL PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL,
  period TEXT NOT NULL,
  features TEXT[],
  status TEXT NOT NULL
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

-- 4. Schedules
CREATE TABLE public.schedules (
  id SERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- 5. Students
CREATE TABLE public.students (
  id SERIAL PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  belt TEXT,
  stripes INTEGER NOT NULL DEFAULT 0,
  birth_date DATE,
  join_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  membership_status TEXT,
  membership_plan_id INTEGER REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  subscription_id TEXT,
  stripe_customer_id TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 6. Attendance
CREATE TABLE public.attendance (
  id SERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES public.schedules(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 7. Payments
CREATE TABLE public.payments (
  id SERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 8. Platform Subscriptions
CREATE TABLE public.platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  plan_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their own organization"
ON public.organizations FOR UPDATE
USING (
  id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Admin can view all organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (
  lower(auth.jwt() ->> 'email') = 'thiago@reivien.com'
);

-- Profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can view organization members"
ON public.profiles FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Students
CREATE POLICY "Users can view students for their organization"
ON public.students FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert students for their organization"
ON public.students FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update students for their organization"
ON public.students FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete students for their organization"
ON public.students FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Membership Plans
CREATE POLICY "Users can view membership plans for their organization"
ON public.membership_plans FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert membership plans for their organization"
ON public.membership_plans FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update membership plans for their organization"
ON public.membership_plans FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete membership plans for their organization"
ON public.membership_plans FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Schedules
CREATE POLICY "Users can view schedules for their organization"
ON public.schedules FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert schedules for their organization"
ON public.schedules FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update schedules for their organization"
ON public.schedules FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete schedules for their organization"
ON public.schedules FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Attendance
CREATE POLICY "Users can view attendance for their organization"
ON public.attendance FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert attendance for their organization"
ON public.attendance FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update attendance for their organization"
ON public.attendance FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete attendance for their organization"
ON public.attendance FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Payments
CREATE POLICY "Users can view payments for their organization"
ON public.payments FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert payments for their organization"
ON public.payments FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

-- Platform Subscriptions
CREATE POLICY "Users can view organization subscription"
ON public.platform_subscriptions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Admin can view all platform subscriptions"
ON public.platform_subscriptions FOR SELECT
TO authenticated
USING (
  lower(auth.jwt() ->> 'email') = 'thiago@reivien.com'
);
