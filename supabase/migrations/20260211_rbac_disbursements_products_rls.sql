-- RBAC: RLS policies for disbursements and loan_products using has_permission
-- Ensures only users with correct permissions can view/create/update/delete
-- Date: 2026-02-11

-- Disbursements: view for disbursement.view; insert/update for disbursement.disburse
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'disbursements') THEN
    RETURN;
  END IF;
  ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  NULL; -- table may already have RLS
END $$;

-- Drop legacy policies if they exist
DROP POLICY IF EXISTS "Users can view their loan disbursements" ON public.disbursements;
DROP POLICY IF EXISTS "Admins can manage disbursements" ON public.disbursements;
DROP POLICY IF EXISTS "disbursements_select_policy" ON public.disbursements;
CREATE POLICY "disbursements_select_policy"
  ON public.disbursements FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'disbursement', 'view'));

DROP POLICY IF EXISTS "disbursements_insert_policy" ON public.disbursements;
CREATE POLICY "disbursements_insert_policy"
  ON public.disbursements FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'disbursement', 'disburse'));

DROP POLICY IF EXISTS "disbursements_update_policy" ON public.disbursements;
CREATE POLICY "disbursements_update_policy"
  ON public.disbursements FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'disbursement', 'disburse'));

-- Disbursements: no delete for audit trail (or only super_admin)
DROP POLICY IF EXISTS "disbursements_delete_policy" ON public.disbursements;
CREATE POLICY "disbursements_delete_policy"
  ON public.disbursements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Loan products: view for products.view; insert/update for products.edit; delete for products.delete
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loan_products') THEN
    RETURN;
  END IF;
  ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Drop legacy policies if they exist
DROP POLICY IF EXISTS "Anyone can view active loan products" ON public.loan_products;
DROP POLICY IF EXISTS "loan_products_select_policy" ON public.loan_products;
CREATE POLICY "loan_products_select_policy"
  ON public.loan_products FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'view') OR public.has_role(auth.uid(), 'user'::app_role) OR public.has_role(auth.uid(), 'employer'::app_role));

DROP POLICY IF EXISTS "loan_products_insert_policy" ON public.loan_products;
CREATE POLICY "loan_products_insert_policy"
  ON public.loan_products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products', 'edit'));

DROP POLICY IF EXISTS "loan_products_update_policy" ON public.loan_products;
CREATE POLICY "loan_products_update_policy"
  ON public.loan_products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'edit'));

DROP POLICY IF EXISTS "loan_products_delete_policy" ON public.loan_products;
CREATE POLICY "loan_products_delete_policy"
  ON public.loan_products FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products', 'delete'));

COMMENT ON POLICY "disbursements_select_policy" ON public.disbursements IS 'View disbursements with disbursement.view';
COMMENT ON POLICY "disbursements_insert_policy" ON public.disbursements IS 'Create disbursements with disbursement.disburse';
COMMENT ON POLICY "loan_products_select_policy" ON public.loan_products IS 'View products with products.view or borrower roles';
COMMENT ON POLICY "loan_products_insert_policy" ON public.loan_products IS 'Create products with products.edit';
