-- Audit log for sensitive changes (issue #4).
-- Records who changed what across students, payments, and staff/roles, surfaced
-- by an org-scoped, admin-only viewer in Settings.
--
-- Recording is hybrid by necessity:
--  * Student edits happen client-side as the authenticated user, so a DB trigger
--    captures them with actor = auth.uid().
--  * Payment/refund and staff/role actions run in service_role edge functions
--    (auth.uid() is NULL there), so those functions insert audit rows explicitly
--    with the caller they resolve from the JWT (see supabase/functions/_shared/audit.ts).

CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID,                                -- auth.users id; NULL = system/automated
  actor_email TEXT,                             -- denormalized snapshot for display
  action TEXT NOT NULL,                         -- e.g. 'student.rank_changed', 'payment.refunded'
  entity_type TEXT NOT NULL,                    -- 'student' | 'payment' | 'staff'
  entity_id TEXT,                               -- stringified id of the affected entity
  summary TEXT,                                 -- human-readable one-liner for the viewer
  details JSONB NOT NULL DEFAULT '{}'::jsonb,   -- structured before/after / context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_org_created_idx
  ON public.audit_log (organization_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Whether the current user is an owner/admin of the given org. SECURITY DEFINER
-- so the profiles lookup isn't itself subject to RLS (mirrors get_my_organization_id()).
CREATE OR REPLACE FUNCTION public.is_org_admin(org UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND organization_id = org
      AND role IN ('owner', 'admin')
  );
$$;

-- The audit log is admin-readable within the org and append-only for everyone:
-- with no INSERT/UPDATE/DELETE policies, authenticated users can neither write
-- nor alter entries. The trigger (SECURITY DEFINER) and edge functions
-- (service_role) bypass RLS to insert.
CREATE POLICY "Org admins can view their audit log"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_org_admin(organization_id));

-- Email of the acting user, for display without a join under RLS.
CREATE OR REPLACE FUNCTION public.audit_actor_email()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Trigger: record student inserts/updates/deletes. Belt/stripe changes get a
-- distinct action + summary so rank promotions are clearly visible. Updates that
-- touch only untracked plumbing columns (e.g. subscription_id) are skipped.
CREATE OR REPLACE FUNCTION public.audit_students()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_action  TEXT;
  v_summary TEXT;
  v_details JSONB := '{}'::jsonb;
  v_org     UUID;
  v_id      TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_org := NEW.organization_id;
    v_id := NEW.id::text;
    v_action := 'student.created';
    v_summary := 'Added student ' || COALESCE(NEW.name, '');
  ELSIF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
    v_id := OLD.id::text;
    v_action := 'student.deleted';
    v_summary := 'Deleted student ' || COALESCE(OLD.name, '');
  ELSE
    v_org := NEW.organization_id;
    v_id := NEW.id::text;

    IF NEW.name IS DISTINCT FROM OLD.name THEN
      v_details := v_details || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    IF NEW.belt IS DISTINCT FROM OLD.belt THEN
      v_details := v_details || jsonb_build_object('belt', jsonb_build_object('from', OLD.belt, 'to', NEW.belt));
    END IF;
    IF NEW.stripes IS DISTINCT FROM OLD.stripes THEN
      v_details := v_details || jsonb_build_object('stripes', jsonb_build_object('from', OLD.stripes, 'to', NEW.stripes));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_details := v_details || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      v_details := v_details || jsonb_build_object('membership_status', jsonb_build_object('from', OLD.membership_status, 'to', NEW.membership_status));
    END IF;
    IF NEW.membership_plan_id IS DISTINCT FROM OLD.membership_plan_id THEN
      v_details := v_details || jsonb_build_object('membership_plan_id', jsonb_build_object('from', OLD.membership_plan_id, 'to', NEW.membership_plan_id));
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      v_details := v_details || jsonb_build_object('email', jsonb_build_object('from', OLD.email, 'to', NEW.email));
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      v_details := v_details || jsonb_build_object('phone', jsonb_build_object('from', OLD.phone, 'to', NEW.phone));
    END IF;

    -- Only untracked plumbing changed -> nothing worth auditing.
    IF v_details = '{}'::jsonb THEN
      RETURN NULL;
    END IF;

    IF (NEW.belt IS DISTINCT FROM OLD.belt) OR (NEW.stripes IS DISTINCT FROM OLD.stripes) THEN
      v_action := 'student.rank_changed';
      v_summary := COALESCE(NEW.name, 'Student') || ': '
        || COALESCE(OLD.belt, 'none') || ' (' || COALESCE(OLD.stripes, 0) || ' stripes)'
        || ' -> '
        || COALESCE(NEW.belt, 'none') || ' (' || COALESCE(NEW.stripes, 0) || ' stripes)';
    ELSE
      v_action := 'student.updated';
      v_summary := 'Updated student ' || COALESCE(NEW.name, '');
    END IF;
  END IF;

  INSERT INTO public.audit_log
    (organization_id, actor_id, actor_email, action, entity_type, entity_id, summary, details)
  VALUES
    (v_org, auth.uid(), public.audit_actor_email(), v_action, 'student', v_id, v_summary, v_details);

  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_students();
