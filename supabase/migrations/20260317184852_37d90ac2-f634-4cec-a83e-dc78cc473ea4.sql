
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS product_specific_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_loan_applications_product_data
ON public.loan_applications USING gin (product_specific_data);
