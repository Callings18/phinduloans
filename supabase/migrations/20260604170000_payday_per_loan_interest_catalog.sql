-- Payday Soft: 30% is total interest over the 30-day term (not per month).

UPDATE public.loan_products
SET
  interest_period = 'per_loan',
  updated_at = now()
WHERE product_code = 'PAYDAY_SOFT'
  AND COALESCE(interest_period::text, '') <> 'per_loan';
