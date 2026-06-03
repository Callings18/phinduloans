-- Collateral installment repair (run after 20260603185037 term bounds migration).
-- Old 6-month-only logic sometimes stored monthly_payment as total_repayment/6
-- even when loan_term_months was 1. Recompute for collateral loans with no paid
-- installments yet, and align pending/overdue schedule rows.

UPDATE public.loan_applications la
SET
  monthly_payment = la.total_repayment / NULLIF(la.loan_term_months, 0),
  updated_at = now()
FROM public.loan_products lp
WHERE la.loan_product_id = lp.id
  AND lp.product_code = 'COLLATERAL'
  AND la.loan_term_months > 0
  AND la.total_repayment > 0
  AND la.monthly_payment IS DISTINCT FROM (la.total_repayment / la.loan_term_months)
  AND NOT EXISTS (
    SELECT 1
    FROM public.loan_repayments lr
    WHERE lr.loan_id = la.id
      AND lr.status = 'paid'
  );

UPDATE public.loan_repayments lr
SET
  amount = la.total_repayment / NULLIF(la.loan_term_months, 0),
  original_amount = la.total_repayment / NULLIF(la.loan_term_months, 0),
  updated_at = now()
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lr.loan_id = la.id
  AND lp.product_code = 'COLLATERAL'
  AND la.loan_term_months > 0
  AND la.total_repayment > 0
  AND lr.status IN ('pending', 'overdue')
  AND NOT EXISTS (
    SELECT 1
    FROM public.loan_repayments paid
    WHERE paid.loan_id = la.id
      AND paid.status = 'paid'
  )
  AND (
    lr.amount IS DISTINCT FROM (la.total_repayment / la.loan_term_months)
    OR lr.original_amount IS DISTINCT FROM (la.total_repayment / la.loan_term_months)
  );
