-- Business loans are nationwide; the [Lusaka]-only restriction was a misconfiguration
-- that caused the enforce_loan_product_location() trigger to silently reject every
-- BUSINESS application for borrowers whose city was blank or not exactly "Lusaka".
UPDATE public.loan_products
SET eligible_locations = NULL,
    updated_at = now()
WHERE product_code = 'BUSINESS';