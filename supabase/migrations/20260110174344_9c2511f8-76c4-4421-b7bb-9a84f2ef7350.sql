-- 1. Add eligible_locations column to loan_products for location control
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS eligible_locations text[] DEFAULT NULL;

-- Comment: NULL means nationwide, specific values like ['Lusaka', 'Kitwe'] restrict eligibility

-- 2. Add payslip_password field to loan_applications for payslip password verification
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS payslip_password text DEFAULT NULL;

-- 3. Add signed_contract_url column for borrower contract uploads
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS signed_contract_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS signed_contract_uploaded_at timestamp with time zone DEFAULT NULL;

-- 4. Add legal_fees to loan_applications for tracking legal deductions
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS legal_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS enforcement_fees numeric DEFAULT 0;

-- 5. Update court_cases table to add more fields for full case management
ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS plaintiff_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS defendant_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS claim_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recovered_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS court_location text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_hearing_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enforcement_status text DEFAULT 'pending';