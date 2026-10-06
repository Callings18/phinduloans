-- 1. audit_logs: restrict client-side inserts to staff only
DROP POLICY IF EXISTS "Users can insert their own audit entries" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can insert their own audit entries" ON public.audit_logs;
CREATE POLICY "Staff can insert their own audit entries"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));

-- 2. profiles: block self-service tampering with blacklist / verification / risk fields
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_staff(v_user_id)
     OR public.has_role(v_user_id, 'admin')
     OR public.has_role(v_user_id, 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.is_blacklisted IS DISTINCT FROM OLD.is_blacklisted
     OR NEW.blacklist_reason IS DISTINCT FROM OLD.blacklist_reason
     OR NEW.blacklisted_by IS DISTINCT FROM OLD.blacklisted_by
     OR NEW.blacklisted_at IS DISTINCT FROM OLD.blacklisted_at
     OR NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at
     OR NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at
  THEN
    RAISE EXCEPTION 'You cannot modify verification or blacklist fields on your profile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_tamper ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_tamper
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_tamper();

-- 3. profiles: add explicit WITH CHECK so users cannot reassign ownership
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
