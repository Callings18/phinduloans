-- Collateral: default processing fee to 5% of principal (deducted at disbursement).
-- Admins can change this anytime in the Collateral house product config; loan create preview updates live.

UPDATE public.loan_products
SET
  processing_fee_percent = 5,
  updated_at = now()
WHERE product_code = 'COLLATERAL'
  AND COALESCE(processing_fee_percent, 0) <> 5;
