-- Product-scoped RLS policies for house tables

CREATE OR REPLACE FUNCTION public.loan_product_code_for_loan(p_loan_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lp.product_code
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE la.id = p_loan_id
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "house_product_scope_loan_applications_select" ON public.loan_applications;
CREATE POLICY "house_product_scope_loan_applications_select"
  ON public.loan_applications
  FOR SELECT
  USING (
    public.has_product_access(
      auth.uid(),
      (SELECT lp.product_code FROM public.loan_products lp WHERE lp.id = loan_product_id LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "house_product_scope_loan_repayments_select" ON public.loan_repayments;
CREATE POLICY "house_product_scope_loan_repayments_select"
  ON public.loan_repayments
  FOR SELECT
  USING (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  );

DROP POLICY IF EXISTS "house_product_scope_loan_events_select" ON public.loan_events;
CREATE POLICY "house_product_scope_loan_events_select"
  ON public.loan_events
  FOR SELECT
  USING (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  );

DROP POLICY IF EXISTS "house_product_scope_disbursements_select" ON public.disbursements;
CREATE POLICY "house_product_scope_disbursements_select"
  ON public.disbursements
  FOR SELECT
  USING (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id))
  );

DROP POLICY IF EXISTS "house_product_scope_application_documents_select" ON public.application_documents;
CREATE POLICY "house_product_scope_application_documents_select"
  ON public.application_documents
  FOR SELECT
  USING (
    public.has_product_access(auth.uid(), public.loan_product_code_for_loan(application_id))
  );
