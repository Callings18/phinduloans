-- Add contract_signing to the loan_status enum
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'contract_signing' AFTER 'approved';