-- Collateral loans: interest rate is TOTAL over the whole term (per_loan), not compounded per month.
-- Older catalog rows used monthly + 5% which caused 5% × term-months when admins entered "30".

UPDATE public.loan_products
SET
  interest_period = 'per_loan',
  interest_rate = CASE
    WHEN interest_period = 'monthly' AND interest_rate <= 6 THEN 30
    ELSE interest_rate
  END,
  description = COALESCE(
    NULLIF(trim(description), ''),
    'Collateral loan: enter total % interest for the whole term (e.g. 30% over 3 months = 10%/month effective). Term 1–12 months.'
  )
WHERE product_code = 'COLLATERAL';
