-- Backfill loan_repayments.original_amount where NULL for Salary Advance products
-- so the Pay dialog can compute remaining principal correctly on legacy rows.
UPDATE public.loan_repayments lr
SET original_amount = lr.amount
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lr.loan_id = la.id
  AND lp.product_code IN ('SALARY_ADVANCE','SALARY_ADVANCE_STAFF')
  AND lr.original_amount IS NULL;