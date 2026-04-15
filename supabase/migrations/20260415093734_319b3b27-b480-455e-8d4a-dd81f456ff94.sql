
-- Fix MARKETEER pricing_tiers to correct 26-day duration (no Sundays)
UPDATE public.loan_products
SET pricing_tiers = '[{"minPrincipal":1000,"maxPrincipal":10000,"interestPercent":30,"durationDays":26}]'::jsonb,
    term_unit = 'days',
    repayment_frequency = 'daily',
    interest_rate = 30,
    interest_period = 'daily',
    interest_type = 'flat'
WHERE product_code = 'MARKETEER';
