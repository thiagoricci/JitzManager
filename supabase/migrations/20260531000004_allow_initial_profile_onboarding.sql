-- Allow first-time onboarding to assign organization_id/role to one's own profile.
--
-- The prevent_profile_privilege_escalation trigger (20260530000001) blocked any
-- self-update that changed role or organization_id. That also blocked the
-- legitimate onboarding case where a brand-new, unlinked profile assigns itself
-- to the organization it just created.
--
-- Relax the guard so the initial assignment is permitted (OLD.organization_id IS
-- NULL), while still blocking role changes or org switches for any user who
-- already belongs to an organization. Service-role edge functions run with
-- auth.uid() = NULL and continue to bypass this guard entirely.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id
     AND OLD.organization_id IS NOT NULL
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     )
  THEN
    RAISE EXCEPTION 'Changing your own role or organization is not allowed';
  END IF;

  RETURN NEW;
END;
$$;
