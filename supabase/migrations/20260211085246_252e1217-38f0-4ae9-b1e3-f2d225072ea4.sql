
-- Add missing columns to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS nrc_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'permanent';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_start_date text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city text;
