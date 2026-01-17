-- HR and Payroll System for Phindu Loans Internal Employees
-- Date: 2026-01-15
-- Description: Complete HR and Payroll system compliant with Zambian labor and tax standards

-- 1. Employee Records Table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to auth user if exists
  employee_number TEXT NOT NULL UNIQUE, -- Unique employee ID (e.g., PHINDU-001)
  title TEXT CHECK (title IN ('Mr', 'Mrs', 'Ms', 'Dr', 'Prof')), -- Salutation
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  nrc_number TEXT NOT NULL UNIQUE, -- Zambian NRC
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  
  -- Contact Information
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternative_phone TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT, -- Zambian province
  postal_code TEXT,
  
  -- Employment Details
  employment_type TEXT NOT NULL CHECK (employment_type IN ('permanent', 'contract', 'temporary', 'intern')),
  department TEXT, -- e.g., 'Finance', 'Operations', 'IT', 'HR'
  position TEXT NOT NULL, -- Job title
  job_grade TEXT, -- e.g., 'A1', 'B2', 'C3'
  reporting_manager_id UUID REFERENCES public.employees(id), -- Self-referencing for hierarchy
  employment_start_date DATE NOT NULL,
  employment_end_date DATE, -- For contract employees
  probation_end_date DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Zambian Tax & Social Security
  napsa_number TEXT, -- NAPSA membership number
  tax_pin TEXT, -- ZRA Tax PIN
  nhima_number TEXT, -- National Health Insurance Membership Authority
  
  -- Banking Details
  bank_name TEXT,
  bank_account_number TEXT,
  bank_branch TEXT,
  mobile_money_number TEXT, -- For salary payment via mobile money
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  
  -- Documents
  nrc_front_url TEXT,
  nrc_back_url TEXT,
  contract_url TEXT,
  photo_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. Salary Structure Table
CREATE TABLE IF NOT EXISTS public.employee_salary_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL, -- When this salary structure becomes active
  expiry_date DATE, -- When it expires (NULL for current)
  
  -- Basic Salary Components
  basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Base salary
  housing_allowance NUMERIC(12, 2) DEFAULT 0,
  transport_allowance NUMERIC(12, 2) DEFAULT 0,
  meal_allowance NUMERIC(12, 2) DEFAULT 0,
  medical_allowance NUMERIC(12, 2) DEFAULT 0,
  communication_allowance NUMERIC(12, 2) DEFAULT 0,
  other_allowances NUMERIC(12, 2) DEFAULT 0,
  
  -- Calculated Totals
  gross_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    basic_salary + 
    COALESCE(housing_allowance, 0) + 
    COALESCE(transport_allowance, 0) + 
    COALESCE(meal_allowance, 0) + 
    COALESCE(medical_allowance, 0) + 
    COALESCE(communication_allowance, 0) + 
    COALESCE(other_allowances, 0)
  ) STORED,
  
  -- Deductions (Fixed amounts)
  napsa_employee_contribution NUMERIC(12, 2) DEFAULT 0, -- 5% of gross (capped)
  nhima_contribution NUMERIC(12, 2) DEFAULT 0, -- NHIMA contribution
  union_dues NUMERIC(12, 2) DEFAULT 0,
  loan_deductions NUMERIC(12, 2) DEFAULT 0, -- Internal loan repayments
  other_deductions NUMERIC(12, 2) DEFAULT 0,
  
  -- Tax Information
  paye_amount NUMERIC(12, 2) DEFAULT 0, -- Calculated PAYE
  tax_relief NUMERIC(12, 2) DEFAULT 0, -- Personal relief, etc.
  
  -- Net Salary (calculated)
  net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    gross_salary - 
    COALESCE(napsa_employee_contribution, 0) - 
    COALESCE(nhima_contribution, 0) - 
    COALESCE(union_dues, 0) - 
    COALESCE(loan_deductions, 0) - 
    COALESCE(other_deductions, 0) - 
    COALESCE(paye_amount, 0) + 
    COALESCE(tax_relief, 0)
  ) STORED,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Payroll Periods Table
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL, -- e.g., "January 2026"
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'bi-weekly', 'weekly')),
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  pay_date DATE NOT NULL, -- When employees will be paid
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'approved', 'paid', 'cancelled')),
  total_gross NUMERIC(12, 2) DEFAULT 0,
  total_deductions NUMERIC(12, 2) DEFAULT 0,
  total_net NUMERIC(12, 2) DEFAULT 0,
  total_employees INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Payroll Records (Individual employee payroll for each period)
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Salary Components (snapshot at time of payroll)
  basic_salary NUMERIC(12, 2) NOT NULL,
  housing_allowance NUMERIC(12, 2) DEFAULT 0,
  transport_allowance NUMERIC(12, 2) DEFAULT 0,
  meal_allowance NUMERIC(12, 2) DEFAULT 0,
  medical_allowance NUMERIC(12, 2) DEFAULT 0,
  communication_allowance NUMERIC(12, 2) DEFAULT 0,
  other_allowances NUMERIC(12, 2) DEFAULT 0,
  overtime_amount NUMERIC(12, 2) DEFAULT 0,
  bonus_amount NUMERIC(12, 2) DEFAULT 0,
  commission_amount NUMERIC(12, 2) DEFAULT 0,
  
  -- Gross Salary
  gross_salary NUMERIC(12, 2) NOT NULL,
  
  -- Zambian Statutory Deductions
  napsa_employee NUMERIC(12, 2) DEFAULT 0, -- 5% of gross (capped at threshold)
  napsa_employer NUMERIC(12, 2) DEFAULT 0, -- 5% employer contribution
  nhima_contribution NUMERIC(12, 2) DEFAULT 0,
  paye_tax NUMERIC(12, 2) DEFAULT 0, -- Calculated PAYE based on ZRA brackets
  
  -- Other Deductions
  union_dues NUMERIC(12, 2) DEFAULT 0,
  loan_deductions NUMERIC(12, 2) DEFAULT 0,
  advance_deductions NUMERIC(12, 2) DEFAULT 0, -- Salary advances
  other_deductions NUMERIC(12, 2) DEFAULT 0,
  
  -- Totals
  total_deductions NUMERIC(12, 2) GENERATED ALWAYS AS (
    COALESCE(napsa_employee, 0) + 
    COALESCE(nhima_contribution, 0) + 
    COALESCE(paye_tax, 0) + 
    COALESCE(union_dues, 0) + 
    COALESCE(loan_deductions, 0) + 
    COALESCE(advance_deductions, 0) + 
    COALESCE(other_deductions, 0)
  ) STORED,
  
  net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    gross_salary - (
      COALESCE(napsa_employee, 0) + 
      COALESCE(nhima_contribution, 0) + 
      COALESCE(paye_tax, 0) + 
      COALESCE(union_dues, 0) + 
      COALESCE(loan_deductions, 0) + 
      COALESCE(advance_deductions, 0) + 
      COALESCE(other_deductions, 0)
    )
  ) STORED,
  
  -- Payment Details
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'mobile_money', 'cash', 'cheque')),
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processed', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  
  -- Leave Deductions
  unpaid_leave_days NUMERIC(5, 2) DEFAULT 0,
  leave_deduction_amount NUMERIC(12, 2) DEFAULT 0,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(payroll_period_id, employee_id) -- One record per employee per period
);

-- 5. Leave Management
CREATE TABLE IF NOT EXISTS public.employee_leave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'study', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_taken NUMERIC(5, 2) NOT NULL, -- Can be fractional (half days)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Leave Balances
CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'study')),
  year INTEGER NOT NULL, -- e.g., 2026
  allocated_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  balance_days NUMERIC(5, 2) GENERATED ALWAYS AS (allocated_days - used_days) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, leave_type, year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON public.employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_nrc ON public.employees(nrc_number);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_salary_structure_employee_id ON public.employee_salary_structure(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_structure_effective_date ON public.employee_salary_structure(effective_date);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON public.payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_period_start ON public.payroll_periods(period_start_date);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period_id ON public.payroll_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_employee_id ON public.employee_leave(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_status ON public.employee_leave(status);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Admins can manage employees"
  ON public.employees FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "HR staff can view employees"
  ON public.employees FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Employees can view their own record"
  ON public.employees FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for salary structure
CREATE POLICY "Admins can manage salary structures"
  ON public.employee_salary_structure FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance staff can view salary structures"
  ON public.employee_salary_structure FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

-- RLS Policies for payroll periods
CREATE POLICY "Admins and finance can manage payroll periods"
  ON public.payroll_periods FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

-- RLS Policies for payroll records
CREATE POLICY "Admins and finance can manage payroll records"
  ON public.payroll_records FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Employees can view their own payroll records"
  ON public.payroll_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = payroll_records.employee_id 
      AND e.user_id = auth.uid()
    )
  );

-- RLS Policies for leave
CREATE POLICY "Admins can manage all leave"
  ON public.employee_leave FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can view their own leave"
  ON public.employee_leave FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = employee_leave.employee_id 
      AND e.user_id = auth.uid()
    )
  );

-- RLS Policies for leave balances
CREATE POLICY "Admins can manage leave balances"
  ON public.employee_leave_balances FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Employees can view their own leave balances"
  ON public.employee_leave_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = employee_leave_balances.employee_id 
      AND e.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_salary_structure_updated_at
  BEFORE UPDATE ON public.employee_salary_structure
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_leave_updated_at
  BEFORE UPDATE ON public.employee_leave
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_leave_balances_updated_at
  BEFORE UPDATE ON public.employee_leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate employee number
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  last_number INTEGER;
BEGIN
  -- Get the last employee number
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_number FROM 'PHINDU-(\d+)') AS INTEGER)), 0)
  INTO last_number
  FROM public.employees
  WHERE employee_number ~ '^PHINDU-\d+$';
  
  -- Generate new number
  new_number := 'PHINDU-' || LPAD((last_number + 1)::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.employees IS 'Internal employee records for Phindu Loans staff';
COMMENT ON TABLE public.employee_salary_structure IS 'Salary structure and components for each employee';
COMMENT ON TABLE public.payroll_periods IS 'Payroll processing periods (monthly, bi-weekly, etc.)';
COMMENT ON TABLE public.payroll_records IS 'Individual payroll records for each employee per period';
COMMENT ON TABLE public.employee_leave IS 'Employee leave applications and records';
COMMENT ON TABLE public.employee_leave_balances IS 'Annual leave balances for employees';

COMMENT ON COLUMN public.employees.napsa_number IS 'NAPSA (National Pension Scheme Authority) membership number';
COMMENT ON COLUMN public.employees.tax_pin IS 'ZRA (Zambia Revenue Authority) Tax PIN';
COMMENT ON COLUMN public.employees.nhima_number IS 'NHIMA (National Health Insurance Membership Authority) number';
COMMENT ON COLUMN public.employee_salary_structure.napsa_employee_contribution IS 'NAPSA employee contribution (5% of gross, capped at threshold)';
COMMENT ON COLUMN public.payroll_records.paye_tax IS 'PAYE (Pay As You Earn) tax calculated based on ZRA tax brackets';
COMMENT ON COLUMN public.payroll_records.napsa_employee IS 'NAPSA employee contribution for this period';
COMMENT ON COLUMN public.payroll_records.napsa_employer IS 'NAPSA employer contribution (5% of gross)';
