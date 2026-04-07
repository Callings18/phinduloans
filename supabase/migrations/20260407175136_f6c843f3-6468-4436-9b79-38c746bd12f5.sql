ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'crb_failed';
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'pmic_pending';