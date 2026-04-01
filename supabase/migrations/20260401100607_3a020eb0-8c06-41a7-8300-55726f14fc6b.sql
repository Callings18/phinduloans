ALTER TABLE public.loan_products
ADD COLUMN IF NOT EXISTS flat_interest_mode text
CHECK (flat_interest_mode IN ('recurring', 'one_time'));