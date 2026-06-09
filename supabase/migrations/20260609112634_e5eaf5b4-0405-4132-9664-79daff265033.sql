ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.loan_guarantors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS email TEXT;