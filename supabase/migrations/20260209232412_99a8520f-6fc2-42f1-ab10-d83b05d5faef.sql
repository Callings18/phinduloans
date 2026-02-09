
-- =============================================================================
-- 1. audit_logs module column
-- =============================================================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT;

-- =============================================================================
-- 2. RBAC: roles, permissions, role_permissions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage roles" ON public.roles FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can view roles" ON public.roles FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (module, action)
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage permissions" ON public.permissions FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can view permissions" ON public.permissions FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (role_name, permission_id)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can view role_permissions" ON public.role_permissions FOR SELECT
    USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.permissions (module, action, description) VALUES
  ('loans', 'view', 'View loan applications'),
  ('loans', 'create', 'Create loan applications'),
  ('loans', 'update', 'Update loan applications'),
  ('loans', 'delete', 'Delete loan applications'),
  ('loans', 'approve', 'Approve loan applications'),
  ('loans', 'verify_documents', 'Verify loan documents'),
  ('loans', 'finance_approve', 'Finance approval for loans'),
  ('disbursement', 'view', 'View disbursements'),
  ('disbursement', 'create', 'Create disbursements'),
  ('disbursement', 'approve', 'Approve disbursements'),
  ('repayments', 'view', 'View repayments'),
  ('repayments', 'create', 'Record repayments'),
  ('repayments', 'reverse', 'Reverse repayments'),
  ('collections', 'view', 'View collections'),
  ('collections', 'manage', 'Manage collections'),
  ('products', 'view', 'View loan products'),
  ('products', 'create', 'Create loan products'),
  ('products', 'update', 'Update loan products'),
  ('products', 'delete', 'Delete loan products'),
  ('borrowers', 'view', 'View borrowers'),
  ('borrowers', 'manage', 'Manage borrowers'),
  ('borrowers', 'blacklist', 'Blacklist borrowers'),
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('audit', 'view', 'View audit logs'),
  ('settings', 'view', 'View settings'),
  ('settings', 'manage', 'Manage settings'),
  ('staff', 'view', 'View staff'),
  ('staff', 'manage', 'Manage staff'),
  ('expenses', 'view', 'View expenses'),
  ('expenses', 'create', 'Create expenses'),
  ('expenses', 'approve', 'Approve expenses'),
  ('payroll', 'view', 'View payroll'),
  ('payroll', 'manage', 'Manage payroll'),
  ('wallets', 'view', 'View wallets/accounts'),
  ('wallets', 'manage', 'Manage wallets/accounts')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.roles (name, description, is_system) VALUES
  ('super_admin', 'Full system access', true),
  ('admin', 'Administrative access', true),
  ('loan_officer', 'Loan processing and document verification', true),
  ('credit_officer', 'Credit assessment and risk evaluation', true),
  ('finance_officer', 'Disbursement and repayment management', true),
  ('collections_officer', 'Overdue account management', true),
  ('auditor', 'Read-only audit access', true),
  ('support', 'Customer support access', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'super_admin', id FROM public.permissions ON CONFLICT (role_name, permission_id) DO NOTHING;
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'admin', id FROM public.permissions ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'loan_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('loans','create'),('loans','update'),('loans','verify_documents'),
  ('borrowers','view'),('borrowers','manage'),('disbursement','view'),('repayments','view'),
  ('repayments','create'),('collections','view'),('reports','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'credit_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('loans','update'),('loans','approve'),('borrowers','view'),('reports','view'),('collections','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'finance_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('loans','finance_approve'),('disbursement','view'),('disbursement','create'),
  ('disbursement','approve'),('repayments','view'),('repayments','create'),('repayments','reverse'),
  ('expenses','view'),('expenses','create'),('expenses','approve'),('wallets','view'),('wallets','manage'),
  ('reports','view'),('reports','export'),('payroll','view'),('payroll','manage')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'collections_officer', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('collections','view'),('collections','manage'),('borrowers','view'),('repayments','view'),('reports','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'auditor', id FROM public.permissions WHERE (module, action) IN (
  ('audit','view'),('reports','view'),('loans','view'),('repayments','view'),('disbursement','view'),('expenses','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'support', id FROM public.permissions WHERE (module, action) IN (
  ('loans','view'),('borrowers','view'),('repayments','view')
) ON CONFLICT (role_name, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id AND p.module = _module AND p.action = _action
) $$;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_name = ur.role::text
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid() $$;

-- =============================================================================
-- 3. Approval workflow columns + loan_notes
-- =============================================================================
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS document_verified_by UUID,
  ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finance_verified_by UUID,
  ADD COLUMN IF NOT EXISTS finance_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_by UUID,
  ADD COLUMN IF NOT EXISTS approval_stage TEXT DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.loan_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Staff can view loan notes" ON public.loan_notes FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'loan_officer'::app_role) OR has_role(auth.uid(), 'credit_officer'::app_role)
      OR has_role(auth.uid(), 'finance_officer'::app_role) OR has_role(auth.uid(), 'collections_officer'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can insert loan notes" ON public.loan_notes FOR INSERT
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'loan_officer'::app_role) OR has_role(auth.uid(), 'credit_officer'::app_role)
      OR has_role(auth.uid(), 'finance_officer'::app_role) OR has_role(auth.uid(), 'collections_officer'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Staff can update own notes" ON public.loan_notes FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can delete notes" ON public.loan_notes FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 4. transition_loan_status RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transition_loan_status(p_loan_id UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_loan RECORD; v_user_id UUID := auth.uid(); v_new_stage TEXT;
BEGIN
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  IF v_loan IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Loan not found'); END IF;
  IF p_action = 'verify_documents' THEN
    IF NOT has_permission(v_user_id, 'loans', 'verify_documents') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET document_verified_by = v_user_id, document_verified_at = now(), approval_stage = 'documents_verified', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'documents_verified';
  ELSIF p_action = 'finance_approve' THEN
    IF NOT has_permission(v_user_id, 'loans', 'finance_approve') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET finance_verified_by = v_user_id, finance_verified_at = now(), approval_stage = 'finance_approved', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'finance_approved';
  ELSIF p_action = 'approve' THEN
    IF NOT has_permission(v_user_id, 'loans', 'approve') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET status = 'approved', reviewed_by = v_user_id, reviewed_at = now(), approval_stage = 'approved', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'approved';
  ELSE RETURN jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action); END IF;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_user_id, p_action, 'loan_application', p_loan_id, 'loans', jsonb_build_object('approval_stage', v_new_stage));
  RETURN jsonb_build_object('success', true, 'stage', v_new_stage);
END; $$;

-- =============================================================================
-- 5. Restrict loan deletes
-- =============================================================================
DROP POLICY IF EXISTS "Admins can delete applications" ON public.loan_applications;
CREATE POLICY "Staff can delete applications in early stages"
  ON public.loan_applications FOR DELETE
  USING (
    ( status IN ('pending', 'rejected', 'under_review') AND public.has_permission(auth.uid(), 'loans', 'delete') )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- =============================================================================
-- 6. Employees table + commission & branch
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  position TEXT,
  hire_date DATE,
  salary NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage employees" ON public.employees FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch TEXT;

-- =============================================================================
-- 7. Commission calculations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.commission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  loan_id UUID REFERENCES public.loan_applications(id),
  loan_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_employee ON public.commission_calculations(employee_id);
CREATE INDEX IF NOT EXISTS idx_commission_period ON public.commission_calculations(period_start, period_end);
ALTER TABLE public.commission_calculations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage commissions" ON public.commission_calculations FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_officer'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 8. officer_loan_stats & portfolio_at_risk
-- =============================================================================
CREATE OR REPLACE FUNCTION public.officer_loan_stats(p_period_start DATE, p_period_end DATE)
RETURNS TABLE(officer_id UUID, officer_name TEXT, total_applications BIGINT, approved_count BIGINT, rejected_count BIGINT, total_disbursed NUMERIC, total_collected NUMERIC, approval_rate NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT la.assigned_to, COALESCE(p.full_name, 'Unassigned'),
  COUNT(*), COUNT(*) FILTER (WHERE la.status IN ('approved','active','completed')),
  COUNT(*) FILTER (WHERE la.status = 'rejected'),
  COALESCE(SUM(la.loan_amount) FILTER (WHERE la.status IN ('active','completed','approved')), 0),
  0::NUMERIC,
  CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE la.status IN ('approved','active','completed'))::NUMERIC / COUNT(*)::NUMERIC * 100, 1) ELSE 0 END
  FROM public.loan_applications la LEFT JOIN public.profiles p ON p.id = la.assigned_to
  WHERE la.created_at::date BETWEEN p_period_start AND p_period_end AND la.assigned_to IS NOT NULL
  GROUP BY la.assigned_to, p.full_name $$;

CREATE OR REPLACE FUNCTION public.portfolio_at_risk(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(total_outstanding NUMERIC, par_30 NUMERIC, par_60 NUMERIC, par_90 NUMERIC, par_30_pct NUMERIC, par_60_pct NUMERIC, par_90_pct NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ WITH lb AS (
  SELECT la.id, COALESCE(la.total_repayment,0) - COALESCE((SELECT SUM(lr.amount) FROM public.loan_repayments lr WHERE lr.loan_id=la.id AND lr.status='paid'),0) AS outstanding,
    COALESCE((SELECT MIN(lr.due_date) FROM public.loan_repayments lr WHERE lr.loan_id=la.id AND lr.status='pending' AND lr.due_date<p_as_of_date), p_as_of_date) AS earliest_overdue
  FROM public.loan_applications la WHERE la.status='active'
) SELECT COALESCE(SUM(outstanding),0), COALESCE(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=30),0),
  COALESCE(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=60),0),
  COALESCE(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=90),0),
  CASE WHEN SUM(outstanding)>0 THEN ROUND(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=30)/SUM(outstanding)*100,2) ELSE 0 END,
  CASE WHEN SUM(outstanding)>0 THEN ROUND(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=60)/SUM(outstanding)*100,2) ELSE 0 END,
  CASE WHEN SUM(outstanding)>0 THEN ROUND(SUM(outstanding) FILTER (WHERE p_as_of_date-earliest_overdue>=90)/SUM(outstanding)*100,2) ELSE 0 END
FROM lb $$;
