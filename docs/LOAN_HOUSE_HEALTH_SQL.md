# Loan house health SQL (read-only)

Run on **staging** before UAT and on **production** after migrations. Replace `:product_code` or use the per-house blocks below.

## A. Catalog vs open applications (wrong interest model)

```sql
-- Collateral: pending pipeline apps still on monthly interest (wrong pricing model)
SELECT la.id, la.full_name, la.status, la.loan_amount, la.loan_term_months,
       la.interest_rate, la.total_repayment, la.monthly_payment,
       la.product_specific_data->>'interest_period' AS psd_period
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'COLLATERAL'
  AND la.status::text IN ('pending','under_review','approved','contract_signing','awaiting_disbursement')
  AND COALESCE(la.product_specific_data->>'interest_period', lp.interest_period::text) = 'monthly';
```

## B. Stuck active but fully paid (blocks new loans)

```sql
SELECT la.id, la.full_name, lp.product_code, la.status, la.total_repayment,
       (SELECT COALESCE(SUM(COALESCE(lr.principal_paid,
         CASE WHEN lr.status = 'paid' THEN lr.amount ELSE 0 END)), 0)
        FROM public.loan_repayments lr
        WHERE lr.loan_id = la.id AND COALESCE(lr.is_reversed, false) = false) AS total_paid,
       (SELECT COUNT(*) FROM public.loan_repayments lr
        WHERE lr.loan_id = la.id
          AND lr.status IN ('pending','overdue','partial')
          AND COALESCE(lr.is_reversed, false) = false) AS open_installments
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE la.status::text IN ('active', 'disbursed')
  AND lp.product_code = :product_code;  -- repeat per house or remove filter
```

After `20260604100000_reconcile_fully_paid_loan_statuses.sql`, expect **zero** rows where `total_paid >= total_repayment - 0.01` and `open_installments = 0`.

## C. Schedule sum vs total_repayment (collateral focus)

```sql
SELECT la.id, la.full_name, lp.product_code, la.total_repayment,
       (SELECT COALESCE(SUM(lr.amount), 0)
        FROM public.loan_repayments lr
        WHERE lr.loan_id = la.id
          AND lr.status IN ('pending','overdue','paid','partial')
          AND COALESCE(lr.is_reversed, false) = false) AS schedule_sum,
       la.total_repayment - (SELECT COALESCE(SUM(lr.amount), 0) FROM public.loan_repayments lr
        WHERE lr.loan_id = la.id AND COALESCE(lr.is_reversed, false) = false) AS delta
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'COLLATERAL'
  AND la.status::text IN ('active','disbursed','completed')
HAVING ABS(la.total_repayment - (SELECT COALESCE(SUM(lr.amount), 0) FROM public.loan_repayments lr
  WHERE lr.loan_id = la.id AND COALESCE(lr.is_reversed, false) = false)) > 0.05;
```

## D. Duplicate open loans per borrower (same product)

```sql
SELECT la.user_id, la.full_name, lp.product_code, COUNT(*) AS open_count,
       array_agg(la.id ORDER BY la.created_at) AS loan_ids,
       array_agg(la.status::text ORDER BY la.created_at) AS statuses
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE la.status::text IN ('pending','under_review','approved','contract_signing',
                          'awaiting_disbursement','disbursed','active')
GROUP BY la.user_id, la.full_name, lp.product_code
HAVING COUNT(*) > 1;
```

## E. Per-house quick filter

```sql
-- Replace PRODUCT_CODE each run
SELECT la.id, la.status, la.loan_amount, la.total_repayment, la.created_at
FROM public.loan_applications la
JOIN public.loan_products lp ON lp.id = la.loan_product_id
WHERE lp.product_code = 'MARKETEER'
ORDER BY la.created_at DESC
LIMIT 20;
```

## F. Manual reconcile one loan (staff RPC exists in app)

Prefer UI: loan detail → **Mark completed** when schedule shows zero outstanding.

Or SQL (staging only, with finance approval):

```sql
SELECT public.try_complete_loan_if_fully_paid('loan-uuid-here'::uuid);
```
