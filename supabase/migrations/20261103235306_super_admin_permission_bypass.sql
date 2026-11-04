-- Super admins must pass every module/action permission check. This keeps the
-- UI permission gates and database RLS/RPC checks consistent with the role.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_name = ur.role::text
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND p.module = _module
        AND p.action = _action
    );
$$;

COMMENT ON FUNCTION public.has_permission(uuid, text, text) IS
  'Checks explicit role permissions and grants super admins the complete permission set.';
