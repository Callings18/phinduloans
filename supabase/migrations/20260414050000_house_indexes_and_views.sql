-- House query performance indexes and base views

CREATE INDEX IF NOT EXISTS loan_applications_house_idx
  ON public.loan_applications(loan_product_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS loan_repayments_house_idx
  ON public.loan_repayments(loan_id, status, due_date);

CREATE INDEX IF NOT EXISTS disbursements_house_idx
  ON public.disbursements(loan_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS loan_events_house_idx
  ON public.loan_events(loan_id, created_at DESC);

CREATE OR REPLACE VIEW public.v_house_report_summary AS
SELECT
  lp.product_code,
  lp.name AS product_name,
  COUNT(la.id) AS total_loans,
  COUNT(*) FILTER (WHERE la.status IN ('active', 'disbursed', 'approved')) AS active_loans,
  COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'completed'), 0) AS total_disbursed
FROM public.loan_products lp
LEFT JOIN public.loan_applications la ON la.loan_product_id = lp.id
LEFT JOIN public.disbursements d ON d.loan_id = la.id
GROUP BY lp.product_code, lp.name;
