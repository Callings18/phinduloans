-- RBAC: roles, permissions, role_permissions, has_permission
-- Phase 1.1 - Run after app_role and user_roles exist
-- Date: 2026-02-10

-- 1. roles table (display name + code matching app_role for join)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. permissions table (module + action)
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);

-- 3. role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- 4. RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read roles/permissions (for UI)
CREATE POLICY "Authenticated can read roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Only super_admin/admin can manage (optional; add when needed)
CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 5. has_permission RPC: user_id, module, action -> boolean
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_module TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.code = ur.role::text
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND p.module = p_module
      AND p.action = p_action
  )
$$;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT, TEXT) IS 'Returns true if user has the given permission via any of their roles';

-- 5b. get_my_permissions: returns (module, action) for current user (for usePermissions hook)
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.roles r ON r.code = ur.role::text
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
$$;

COMMENT ON FUNCTION public.get_my_permissions() IS 'Returns all (module, action) permissions for the current user';

-- 6. Seed permissions (fixed set)
INSERT INTO public.permissions (module, action, description) VALUES
  ('loans', 'view', 'View loan applications and loans'),
  ('loans', 'approve', 'Approve or reject loan applications'),
  ('loans', 'verify_documents', 'Mark documents as verified'),
  ('loans', 'finance_approve', 'Approve finance / credit check'),
  ('loans', 'edit', 'Edit loan application details'),
  ('loans', 'delete', 'Delete loan applications (pending/under_review only)'),
  ('loans', 'assign', 'Assign applications to staff'),
  ('disbursement', 'view', 'View disbursements'),
  ('disbursement', 'disburse', 'Create and complete disbursements'),
  ('products', 'view', 'View loan products'),
  ('products', 'edit', 'Create and edit loan products'),
  ('products', 'delete', 'Delete loan products'),
  ('reports', 'view', 'View reports'),
  ('reports', 'export', 'Export reports (CSV/PDF/Excel)'),
  ('payroll', 'view', 'View payroll'),
  ('payroll', 'manage', 'Manage payroll periods and runs'),
  ('audit', 'view', 'View audit logs'),
  ('borrowers', 'view', 'View borrowers'),
  ('borrowers', 'edit', 'Edit borrower profiles'),
  ('settings', 'manage', 'Manage system settings')
ON CONFLICT (module, action) DO NOTHING;

-- 7. Seed roles (match app_role enum: admin, user, employer, super_admin, loan_officer, credit_officer, finance_officer, collections_officer, auditor, support)
INSERT INTO public.roles (code, name, description, is_system_role) VALUES
  ('super_admin', 'Super Admin', 'Full platform access', true),
  ('admin', 'Admin', 'Administrative access', true),
  ('loan_officer', 'Loan Officer', 'Process applications, verify documents', true),
  ('credit_officer', 'Credit Officer', 'Credit and risk assessment', true),
  ('finance_officer', 'Finance / Accounts Officer', 'Finance approval, disbursement', true),
  ('collections_officer', 'Collections Officer', 'Collections and recovery', true),
  ('auditor', 'Auditor', 'View audit logs and reports', true),
  ('support', 'Support', 'Support and view access', true),
  ('user', 'User', 'Borrower / customer', true),
  ('employer', 'Employer', 'Employer portal', true)
ON CONFLICT (code) DO NOTHING;

-- 8. Map role_permissions
-- super_admin: all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- admin: all except maybe some super_admin-only (treat same as super_admin for now)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- loan_officer: loans view, verify_documents, assign, edit (application details); borrowers view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action IN ('view', 'verify_documents', 'assign', 'edit')) OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'loan_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- credit_officer: loans view, assign; reports view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON (p.module = 'loans' AND p.action IN ('view', 'assign')) OR (p.module = 'reports' AND p.action = 'view') OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'credit_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- finance_officer: loans view, finance_approve; disbursement view, disburse; reports view, export
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action IN ('view', 'finance_approve', 'assign')) OR (p.module = 'disbursement') OR (p.module = 'reports') OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'finance_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- collections_officer: loans view, borrowers view, reports view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action = 'view') OR (p.module = 'borrowers' AND p.action = 'view') OR (p.module = 'reports' AND p.action = 'view')
WHERE r.code = 'collections_officer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- auditor: reports view, export; audit view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON p.module IN ('reports', 'audit') AND p.action IN ('view', 'export')
WHERE r.code = 'auditor'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- support: loans view, borrowers view (read-only)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'loans' AND p.action = 'view') OR (p.module = 'borrowers' AND p.action = 'view')
WHERE r.code = 'support'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Trigger for roles updated_at
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
