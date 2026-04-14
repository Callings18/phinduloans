-- Product scope function for frontend and RLS checks

CREATE OR REPLACE FUNCTION public.has_product_access(p_user UUID, p_product_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(p_user, 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p_user
        AND ur.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_product_access upa
      WHERE upa.user_id = p_user
        AND upa.product_code = p_product_code
        AND upa.is_active = true
    );
$$;

COMMENT ON FUNCTION public.has_product_access(UUID, TEXT)
IS 'Returns true if user can operate in the specified product house.';
