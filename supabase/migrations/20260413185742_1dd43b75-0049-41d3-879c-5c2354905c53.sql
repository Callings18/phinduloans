
-- 0) Create missing employee_salary_structure table
CREATE TABLE IF NOT EXISTS public.employee_salary_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary numeric NOT NULL DEFAULT 0,
  housing_allowance numeric DEFAULT 0,
  transport_allowance numeric DEFAULT 0,
  meal_allowance numeric DEFAULT 0,
  medical_allowance numeric DEFAULT 0,
  other_allowances numeric DEFAULT 0,
  napsa_employee numeric DEFAULT 0,
  napsa_employer numeric DEFAULT 0,
  nhima_employee numeric DEFAULT 0,
  nhima_employer numeric DEFAULT 0,
  paye numeric DEFAULT 0,
  loan_deductions numeric DEFAULT 0,
  union_dues numeric DEFAULT 0,
  other_deductions numeric DEFAULT 0,
  gross_salary numeric GENERATED ALWAYS AS (basic_salary + COALESCE(housing_allowance,0) + COALESCE(transport_allowance,0) + COALESCE(meal_allowance,0) + COALESCE(medical_allowance,0) + COALESCE(other_allowances,0)) STORED,
  net_salary numeric DEFAULT 0,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.employee_salary_structure ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_employee_salary_structure_updated_at ON public.employee_salary_structure;
CREATE TRIGGER update_employee_salary_structure_updated_at
  BEFORE UPDATE ON public.employee_salary_structure
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1) Permissions
INSERT INTO public.permissions (module, action, description) VALUES
  ('hr', 'view', 'View internal employees and HR records'),
  ('hr', 'manage', 'Create, edit, and deactivate employees and salary structures'),
  ('payroll', 'approve', 'Approve payroll runs and mark as paid')
ON CONFLICT (module, action) DO NOTHING;

-- 2) Role mappings
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id
FROM public.roles r
JOIN public.permissions p ON p.module IN ('hr', 'payroll') AND p.action IN ('view', 'manage', 'approve')
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id
FROM public.roles r
JOIN public.permissions p
  ON (p.module = 'payroll' AND p.action IN ('view', 'manage', 'approve'))
  OR (p.module = 'hr' AND p.action = 'view')
WHERE r.name = 'finance_officer'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- 3) Tax engine defaults
INSERT INTO public.payroll_tax_config (config_type, label, ceiling_amount, effective_from, notes, is_active)
SELECT 'general', 'personal_relief_monthly', 300, '2026-01-01', 'Monthly personal relief (Kwacha) subtracted from calculated PAYE', true
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_tax_config WHERE config_type = 'general' AND label = 'personal_relief_monthly');

INSERT INTO public.payroll_tax_config (config_type, label, band_min, effective_from, notes, is_active)
SELECT 'general', 'paye_on_chargeable_after_napsa', 1, '2026-01-01', 'band_min 1 = PAYE on (gross minus NAPSA employee); 0 = PAYE on full gross', true
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_tax_config WHERE config_type = 'general' AND label = 'paye_on_chargeable_after_napsa');

-- 4) RLS — employees
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "HR staff can view employees" ON public.employees;
DROP POLICY IF EXISTS "Employees can view their own record" ON public.employees;

CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'view') OR public.has_permission(auth.uid(), 'hr', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'view') OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'));

CREATE POLICY "employees_insert" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'));

CREATE POLICY "employees_update" ON public.employees FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'));

CREATE POLICY "employees_delete" ON public.employees FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'));

-- 5) employee_salary_structure RLS
CREATE POLICY "employee_salary_structure_select" ON public.employee_salary_structure FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'view') OR public.has_permission(auth.uid(), 'hr', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'view') OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'));

CREATE POLICY "employee_salary_structure_write" ON public.employee_salary_structure FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'));

CREATE POLICY "employee_salary_structure_update" ON public.employee_salary_structure FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'));

CREATE POLICY "employee_salary_structure_delete" ON public.employee_salary_structure FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'hr', 'manage'));

-- 6) payroll_tax_config RLS
DROP POLICY IF EXISTS "Admins can manage tax config" ON public.payroll_tax_config;
DROP POLICY IF EXISTS "Staff can view tax config" ON public.payroll_tax_config;

CREATE POLICY "payroll_tax_config_select" ON public.payroll_tax_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_role(auth.uid(), 'loan_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'view') OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve') OR public.has_permission(auth.uid(), 'hr', 'manage'));

CREATE POLICY "payroll_tax_config_write" ON public.payroll_tax_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));

CREATE POLICY "payroll_tax_config_update" ON public.payroll_tax_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));

CREATE POLICY "payroll_tax_config_delete" ON public.payroll_tax_config FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));

-- 7) payroll_runs RLS
DROP POLICY IF EXISTS "Admins can manage payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Finance can view payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Finance can insert payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Finance can update draft payroll runs" ON public.payroll_runs;

CREATE POLICY "payroll_runs_select" ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'view') OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'));

CREATE POLICY "payroll_runs_insert" ON public.payroll_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));

CREATE POLICY "payroll_runs_update" ON public.payroll_runs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'));

CREATE POLICY "payroll_runs_delete" ON public.payroll_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));

-- 8) payroll_records RLS
DROP POLICY IF EXISTS "Admins can manage payroll records" ON public.payroll_records;
DROP POLICY IF EXISTS "Finance can view payroll records" ON public.payroll_records;
DROP POLICY IF EXISTS "Finance can manage draft payroll" ON public.payroll_records;
DROP POLICY IF EXISTS "Finance can update draft payroll" ON public.payroll_records;
DROP POLICY IF EXISTS "Admins and finance can manage payroll records" ON public.payroll_records;
DROP POLICY IF EXISTS "Employees can view their own payroll records" ON public.payroll_records;

CREATE POLICY "payroll_records_own_select" ON public.payroll_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll_records.employee_id AND e.user_id = auth.uid()));

CREATE POLICY "payroll_records_staff_select" ON public.payroll_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'view') OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'));

CREATE POLICY "payroll_records_insert" ON public.payroll_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));

CREATE POLICY "payroll_records_update" ON public.payroll_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'finance_officer'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage') OR public.has_permission(auth.uid(), 'payroll', 'approve'));

CREATE POLICY "payroll_records_delete" ON public.payroll_records FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_permission(auth.uid(), 'payroll', 'manage'));
