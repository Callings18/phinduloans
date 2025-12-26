-- Add product_id to loan_applications to track which product was used
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.loan_products(id);

-- Update index for performance
CREATE INDEX IF NOT EXISTS idx_loan_applications_product_id ON public.loan_applications(product_id);
