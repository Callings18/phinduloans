-- Add source_account_id to disbursements table for account deduction tracking
ALTER TABLE public.disbursements 
ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES public.accounts(id);

-- Add contract signing tracking fields to loan_applications
ALTER TABLE public.loan_applications 
ADD COLUMN IF NOT EXISTS borrower_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS borrower_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS admin_signed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_signed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS admin_signed_by uuid;

-- Create index for faster lookups on contract signing status
CREATE INDEX IF NOT EXISTS idx_loan_applications_contract_signing 
ON public.loan_applications (borrower_signed, admin_signed) 
WHERE status = 'approved';