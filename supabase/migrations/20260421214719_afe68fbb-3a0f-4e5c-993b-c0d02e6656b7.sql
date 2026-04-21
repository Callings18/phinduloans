ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS repayment_start_date date;

COMMENT ON COLUMN public.loan_applications.repayment_start_date IS
'Optional first installment due date. When set, schedule generation uses this as installment #1 date.';

WITH affected_loans AS (
  SELECT DISTINCT la.id
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE lp.term_unit = 'days'
    AND EXISTS (
      SELECT 1
      FROM public.disbursements d
      WHERE d.loan_id = la.id
        AND d.status = 'completed'
        AND d.created_at::date = CURRENT_DATE
    )
    AND EXISTS (
      SELECT 1
      FROM public.loan_repayments r
      WHERE r.loan_id = la.id
        AND r.status = 'pending'
        AND r.due_date = CURRENT_DATE
    )
)
UPDATE public.loan_applications la
SET repayment_start_date = CURRENT_DATE + 1
WHERE la.id IN (SELECT id FROM affected_loans);

WITH affected_loans AS (
  SELECT DISTINCT la.id
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE lp.term_unit = 'days'
    AND EXISTS (
      SELECT 1
      FROM public.disbursements d
      WHERE d.loan_id = la.id
        AND d.status = 'completed'
        AND d.created_at::date = CURRENT_DATE
    )
    AND EXISTS (
      SELECT 1
      FROM public.loan_repayments r
      WHERE r.loan_id = la.id
        AND r.status = 'pending'
        AND r.due_date = CURRENT_DATE
    )
)
UPDATE public.loan_repayments r
SET due_date = (r.due_date + INTERVAL '1 day')::date
WHERE r.loan_id IN (SELECT id FROM affected_loans)
  AND r.status = 'pending';