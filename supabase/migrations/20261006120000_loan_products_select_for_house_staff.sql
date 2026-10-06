-- House staff and product editors must read loan_products (houses nav, dropdowns, insert .select()).

DROP POLICY IF EXISTS "loan_products_select_policy" ON public.loan_products;

CREATE POLICY "loan_products_select_policy"
  ON public.loan_products FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'products', 'view')
    OR public.has_permission(auth.uid(), 'products', 'edit')
    OR public.has_role(auth.uid(), 'user'::public.app_role)
    OR public.has_role(auth.uid(), 'employer'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'loan_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'credit_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'finance_officer'::public.app_role)
    OR public.has_role(auth.uid(), 'collections_officer'::public.app_role)
    OR public.has_permission(auth.uid(), 'house', 'dashboard_view')
  );

COMMENT ON POLICY "loan_products_select_policy" ON public.loan_products IS
  'Borrowers, product admins, and house staff can read loan product catalog rows.';
