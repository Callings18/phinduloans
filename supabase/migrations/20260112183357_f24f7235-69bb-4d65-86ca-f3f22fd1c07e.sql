-- Update loan products to set the 10% legal fee (platform_fee_percent)
UPDATE public.loan_products 
SET platform_fee_percent = 10 
WHERE is_active = true AND (platform_fee_percent IS NULL OR platform_fee_percent = 0);

-- Ensure processing fee is set correctly (2.5%)
UPDATE public.loan_products 
SET processing_fee_percent = 2.5 
WHERE is_active = true AND (processing_fee_percent IS NULL OR processing_fee_percent = 0);