-- The permission UI calls this own-user-only RPC after staff login.
-- Super admins receive every defined UI permission; other roles retain their
-- configured role_permissions. No caller can request another user's grants.
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module text, action text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.permissions p
  WHERE public.has_role(auth.uid(), 'super_admin'::public.app_role)

  UNION

  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;
