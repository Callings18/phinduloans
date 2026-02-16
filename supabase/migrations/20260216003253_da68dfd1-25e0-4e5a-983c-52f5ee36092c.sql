-- Add KYC permanent detail fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employer_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text; -- permanent, contract, casual, other
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_in_employment integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS net_income numeric;