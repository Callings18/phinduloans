-- Canonical RBAC functions for role_permissions(role_name, permission_id) + roles(name)
-- Re-applies the 20260209 join model so UI get_my_permissions / has_permission stay aligned
-- after any migration that may have replaced these with a code/role_id variant.

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role::text
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = _action
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT, TEXT) IS 'True if user has permission via role_permissions.role_name matching user_roles.role';
COMMENT ON FUNCTION public.get_my_permissions() IS 'Distinct (module, action) for current user via role_name RBAC model';
