-- Restore execution access required by authenticated staff row-level-security policies.
GRANT EXECUTE ON FUNCTION public.has_product_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
