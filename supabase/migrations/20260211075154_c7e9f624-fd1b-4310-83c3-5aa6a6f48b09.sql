
-- ============================================================
-- PAYROLL RECORDS: monthly payroll runs per employee
-- ============================================================
CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Period
  payroll_month integer NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year integer NOT NULL CHECK (payroll_year >= 2020),
  
  -- Gross components
  basic_salary numeric NOT NULL DEFAULT 0,
  housing_allowance numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  lunch_allowance numeric NOT NULL DEFAULT 0,
  other_allowances numeric NOT NULL DEFAULT 0,
  overtime_pay numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,

  -- Statutory deductions
  paye_tax numeric NOT NULL DEFAULT 0,
  nhima_employee numeric NOT NULL DEFAULT 0,
  nhima_employer numeric NOT NULL DEFAULT 0,
  napsa_employee numeric NOT NULL DEFAULT 0,
  napsa_employer numeric NOT NULL DEFAULT 0,
  
  -- Other deductions
  loan_deduction numeric NOT NULL DEFAULT 0,
  pension_deduction numeric NOT NULL DEFAULT 0,
  union_dues numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  
  -- Totals
  total_deductions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  total_employer_cost numeric NOT NULL DEFAULT 0,

  -- Status & meta
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  notes text,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One record per employee per month
  UNIQUE (employee_id, payroll_month, payroll_year)
);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- RLS: Admins full access
CREATE POLICY "Admins can manage payroll records"
  ON public.payroll_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS: Finance officers can view
CREATE POLICY "Finance can view payroll records"
  ON public.payroll_records FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_officer'));

-- RLS: Finance can insert/update draft payroll
CREATE POLICY "Finance can manage draft payroll"
  ON public.payroll_records FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Finance can update draft payroll"
  ON public.payroll_records FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'finance_officer') AND status = 'draft');

-- ============================================================
-- PAYROLL TAX CONFIG: Zambian PAYE bands + statutory rates
-- ============================================================
CREATE TABLE public.payroll_tax_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL, -- 'paye_band', 'nhima', 'napsa', 'general'
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  
  -- PAYE band fields
  band_min numeric,
  band_max numeric,
  rate_percent numeric,
  
  -- Statutory rate fields
  employee_rate_percent numeric,
  employer_rate_percent numeric,
  ceiling_amount numeric, -- e.g. NAPSA ceiling
  
  label text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_tax_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tax config"
  ON public.payroll_tax_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can view tax config"
  ON public.payroll_tax_config FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'loan_officer'));

-- ============================================================
-- SEED: 2026 Zambian PAYE tax bands (monthly)
-- ============================================================
INSERT INTO public.payroll_tax_config (config_type, label, band_min, band_max, rate_percent, effective_from, notes) VALUES
  ('paye_band', 'Band 1: 0%',         0,      5100,   0,    '2026-01-01', 'Tax-free threshold'),
  ('paye_band', 'Band 2: 20%',     5100.01,   7100,  20,    '2026-01-01', 'First taxable band'),
  ('paye_band', 'Band 3: 30%',     7100.01,   9200,  30,    '2026-01-01', 'Middle band'),
  ('paye_band', 'Band 4: 37.5%',   9200.01,   NULL,  37.5,  '2026-01-01', 'Top rate on excess');

-- NHIMA rates (1% each side)
INSERT INTO public.payroll_tax_config (config_type, label, employee_rate_percent, employer_rate_percent, effective_from, notes) VALUES
  ('nhima', 'NHIMA Contribution', 1, 1, '2026-01-01', 'National Health Insurance - 1% employee, 1% employer');

-- NAPSA rates (5% each, ceiling K30,408.80/month for 2026)
INSERT INTO public.payroll_tax_config (config_type, label, employee_rate_percent, employer_rate_percent, ceiling_amount, effective_from, notes) VALUES
  ('napsa', 'NAPSA Contribution', 5, 5, 30408.80, '2026-01-01', 'National Pension - 5% each, ceiling K30,408.80/month');

-- ============================================================
-- PAYROLL RUNS: batch processing log
-- ============================================================
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_month integer NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
  payroll_year integer NOT NULL CHECK (payroll_year >= 2020),
  total_employees integer NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  total_paye numeric NOT NULL DEFAULT 0,
  total_nhima numeric NOT NULL DEFAULT 0,
  total_napsa numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  total_employer_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_month, payroll_year)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll runs"
  ON public.payroll_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance can view payroll runs"
  ON public.payroll_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Finance can insert payroll runs"
  ON public.payroll_runs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'finance_officer'));

CREATE POLICY "Finance can update draft payroll runs"
  ON public.payroll_runs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'finance_officer') AND status = 'draft');

-- Add payroll_run_id reference to payroll_records
ALTER TABLE public.payroll_records ADD COLUMN payroll_run_id uuid REFERENCES public.payroll_runs(id);

-- ============================================================
-- Add allowance columns to employees table
-- ============================================================
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS housing_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowances numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS napsa_number text,
  ADD COLUMN IF NOT EXISTS nhima_number text,
  ADD COLUMN IF NOT EXISTS tpin text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_branch text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'bank_transfer';

-- Updated_at trigger for new tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_tax_config_updated_at
  BEFORE UPDATE ON public.payroll_tax_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
