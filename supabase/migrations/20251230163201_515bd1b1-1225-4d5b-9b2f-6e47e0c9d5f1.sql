-- PMIC (Payroll Management Integration Center) Tables

-- 1. PMIC Config (Single row for lender settings)
CREATE TABLE public.pmic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_authority TEXT, -- PMEC, PSPF, NAPSA, PRIVATE
  deduction_code TEXT, -- Assigned by authority (e.g., MFI-123)
  deduction_code_assigned_date DATE,
  max_deduction_percent NUMERIC DEFAULT 33, -- Max % of salary deductible
  min_net_pay_percent NUMERIC DEFAULT 50, -- Employee must retain this %
  max_loan_multiplier NUMERIC DEFAULT 36, -- Max loan = salary × multiplier
  default_loan_term_months INTEGER DEFAULT 24,
  max_concurrent_loans INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_config
CREATE POLICY "Admins can manage PMIC config"
ON public.pmic_config FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC config"
ON public.pmic_config FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer'));

-- 2. PMIC Employers
CREATE TABLE public.pmic_employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_code TEXT NOT NULL UNIQUE,
  employer_name TEXT NOT NULL,
  employer_type TEXT NOT NULL CHECK (employer_type IN ('government', 'parastatal', 'private', 'ngo')),
  payroll_cycle TEXT NOT NULL CHECK (payroll_cycle IN ('weekly', 'bi-weekly', 'monthly', 'quarterly')),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_employers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_employers
CREATE POLICY "Admins can manage PMIC employers"
ON public.pmic_employers FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC employers"
ON public.pmic_employers FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'credit_officer'));

CREATE POLICY "Loan officers can insert PMIC employers"
ON public.pmic_employers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 3. PMIC Borrower Enrollments
CREATE TABLE public.pmic_borrower_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.profiles(id),
  employer_id UUID REFERENCES public.pmic_employers(id),
  employee_number TEXT NOT NULL,
  department TEXT,
  gross_salary NUMERIC,
  net_salary NUMERIC,
  existing_deductions NUMERIC DEFAULT 0,
  available_deduction_capacity NUMERIC,
  enrollment_status TEXT DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'active', 'suspended', 'terminated')),
  enrolled_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_borrower_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_borrower_enrollments
CREATE POLICY "Admins can manage PMIC enrollments"
ON public.pmic_borrower_enrollments FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC enrollments"
ON public.pmic_borrower_enrollments FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'credit_officer'));

CREATE POLICY "Loan officers can insert PMIC enrollments"
ON public.pmic_borrower_enrollments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Loan officers can update PMIC enrollments"
ON public.pmic_borrower_enrollments FOR UPDATE
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 4. PMIC Payroll Submissions
CREATE TABLE public.pmic_payroll_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_reference TEXT NOT NULL UNIQUE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('deduction_request', 'stop_order', 'variation', 'reconciliation')),
  payroll_period_start DATE NOT NULL,
  payroll_period_end DATE NOT NULL,
  total_amount NUMERIC,
  total_records INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'submitted', 'processing', 'completed', 'failed', 'rejected')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  processed_at TIMESTAMPTZ,
  file_url TEXT,
  response_file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_payroll_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_payroll_submissions
CREATE POLICY "Admins can manage PMIC submissions"
ON public.pmic_payroll_submissions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC submissions"
ON public.pmic_payroll_submissions FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Staff can insert draft PMIC submissions"
ON public.pmic_payroll_submissions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- 5. PMIC Exceptions
CREATE TABLE public.pmic_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.pmic_borrower_enrollments(id),
  submission_id UUID REFERENCES public.pmic_payroll_submissions(id),
  exception_type TEXT NOT NULL CHECK (exception_type IN ('insufficient_salary', 'employment_terminated', 'duplicate_deduction', 'invalid_employee', 'exceeded_limit', 'payroll_error')),
  exception_status TEXT DEFAULT 'open' CHECK (exception_status IN ('open', 'investigating', 'resolved', 'closed')),
  description TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pmic_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pmic_exceptions
CREATE POLICY "Admins can manage PMIC exceptions"
ON public.pmic_exceptions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view PMIC exceptions"
ON public.pmic_exceptions FOR SELECT
USING (has_role(auth.uid(), 'loan_officer') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'collections_officer'));

-- Insert default PMIC config row
INSERT INTO public.pmic_config (
  payroll_authority,
  max_deduction_percent,
  min_net_pay_percent,
  max_loan_multiplier,
  default_loan_term_months,
  max_concurrent_loans,
  is_active
) VALUES (
  NULL,
  33,
  50,
  36,
  24,
  3,
  false
);

-- Create updated_at triggers
CREATE TRIGGER update_pmic_config_updated_at
BEFORE UPDATE ON public.pmic_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_employers_updated_at
BEFORE UPDATE ON public.pmic_employers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_borrower_enrollments_updated_at
BEFORE UPDATE ON public.pmic_borrower_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_payroll_submissions_updated_at
BEFORE UPDATE ON public.pmic_payroll_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pmic_exceptions_updated_at
BEFORE UPDATE ON public.pmic_exceptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();