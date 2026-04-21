-- Allow loan officers, credit officers, and finance officers to add/view/update borrowers
-- in any product house, matching their existing borrowers.manage / borrowers.view permissions.
-- Without this, RLS on product_house_borrowers blocked the create-borrower flow for loan officers.

-- product_house_borrowers: extend to staff with borrower management permissions
DROP POLICY IF EXISTS product_house_borrowers_insert ON public.product_house_borrowers;
CREATE POLICY product_house_borrowers_insert ON public.product_house_borrowers
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_product_access(auth.uid(), product_code)
  );

DROP POLICY IF EXISTS product_house_borrowers_update ON public.product_house_borrowers;
CREATE POLICY product_house_borrowers_update ON public.product_house_borrowers
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_product_access(auth.uid(), product_code)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_product_access(auth.uid(), product_code)
  );

DROP POLICY IF EXISTS product_house_borrowers_delete ON public.product_house_borrowers;
CREATE POLICY product_house_borrowers_delete ON public.product_house_borrowers
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_product_access(auth.uid(), product_code)
  );

DROP POLICY IF EXISTS product_house_borrowers_select ON public.product_house_borrowers;
CREATE POLICY product_house_borrowers_select ON public.product_house_borrowers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = product_house_borrowers.borrower_id AND p.id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
    OR has_product_access(auth.uid(), product_code)
  );

-- Update has_product_access to grant loan_officer / credit_officer / finance_officer
-- access to all product houses by default. This keeps house dashboards, borrower lists,
-- and loan creation working without per-user user_product_access rows.
CREATE OR REPLACE FUNCTION public.has_product_access(p_user uuid, p_product_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(p_user, 'super_admin'::public.app_role)
    OR public.has_role(p_user, 'admin'::public.app_role)
    OR public.has_role(p_user, 'loan_officer'::public.app_role)
    OR public.has_role(p_user, 'credit_officer'::public.app_role)
    OR public.has_role(p_user, 'finance_officer'::public.app_role)
    OR public.has_role(p_user, 'collections_officer'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_product_access upa
      WHERE upa.user_id = p_user
        AND upa.product_code = p_product_code
        AND upa.is_active = true
    );
$function$;

-- Ensure profiles INSERT works for staff creating borrower records (edge function uses
-- service role so bypasses RLS; this is a defensive policy in case the client path is used).
DROP POLICY IF EXISTS "Staff can insert borrower profiles" ON public.profiles;
CREATE POLICY "Staff can insert borrower profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
  );