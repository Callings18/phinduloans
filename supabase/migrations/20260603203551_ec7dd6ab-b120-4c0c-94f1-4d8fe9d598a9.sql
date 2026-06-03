-- Collateral installment repair for loans WITH paid or partial installments.
-- Idempotent: fixes monthly_payment and redistributes remaining balance across
-- untouched unpaid installments. Skips rows already partially paid (principal_paid > 0).

-- 1) monthly_payment metadata — safe even when payments exist
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
  AND EXISTS (
    SELECT 1
    FROM public.loan_repayments lr
    WHERE lr.loan_id = la.id
      AND (
        lr.status IN ('paid', 'partial')
        OR COALESCE(lr.principal_paid, 0) > 0
      )
  );

-- 2) Redistribute remaining balance across untouched unpaid installments
WITH collateral_in_progress AS (
  SELECT
    la.id AS loan_id,
    la.total_repayment,
    COALESCE((
      SELECT SUM(
        COALESCE(
          lr.principal_paid,
          CASE WHEN lr.status = 'paid' THEN lr.amount ELSE 0 END,
          0
        )
      )
      FROM public.loan_repayments lr
      WHERE lr.loan_id = la.id
    ), 0) AS total_principal_paid,
    (
      SELECT COUNT(*)::numeric
      FROM public.loan_repayments lr
      WHERE lr.loan_id = la.id
        AND lr.status IN ('pending', 'overdue')
        AND COALESCE(lr.principal_paid, 0) = 0
    ) AS untouched_unpaid_count
  FROM public.loan_applications la
  JOIN public.loan_products lp ON lp.id = la.loan_product_id
  WHERE lp.product_code = 'COLLATERAL'
    AND la.total_repayment > 0
    AND EXISTS (
      SELECT 1
      FROM public.loan_repayments lr
      WHERE lr.loan_id = la.id
        AND (
          lr.status IN ('paid', 'partial')
          OR COALESCE(lr.principal_paid, 0) > 0
        )
    )
),
per_installment AS (
  SELECT
    cip.loan_id,
    GREATEST(cip.total_repayment - cip.total_principal_paid, 0)
      / NULLIF(cip.untouched_unpaid_count, 0) AS new_amount
  FROM collateral_in_progress cip
  WHERE cip.untouched_unpaid_count > 0
    AND GREATEST(cip.total_repayment - cip.total_principal_paid, 0) > 0
)
UPDATE public.loan_repayments lr
SET
  amount = pi.new_amount,
  original_amount = pi.new_amount,
  updated_at = now()
FROM per_installment pi
WHERE lr.loan_id = pi.loan_id
  AND lr.status IN ('pending', 'overdue')
  AND COALESCE(lr.principal_paid, 0) = 0
  AND (
    lr.amount IS DISTINCT FROM pi.new_amount
    OR lr.original_amount IS DISTINCT FROM pi.new_amount
  );