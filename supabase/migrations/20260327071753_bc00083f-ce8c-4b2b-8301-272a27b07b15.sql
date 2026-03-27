
ALTER TABLE public.loan_applications 
  ADD COLUMN IF NOT EXISTS penalty_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defaulted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS legal_referred_at timestamp with time zone;
