-- Add term_unit column to loan_products table to support daily/weekly/monthly/yearly terms
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS term_unit text NOT NULL DEFAULT 'months';

-- Add comment for documentation
COMMENT ON COLUMN public.loan_products.term_unit IS 'Unit for loan term: days, weeks, months, or years';

-- Also add term_unit to loan_applications to store the selected unit when loan is created
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS term_unit text NOT NULL DEFAULT 'months';

COMMENT ON COLUMN public.loan_applications.term_unit IS 'Unit for loan term: days, weeks, months, or years';