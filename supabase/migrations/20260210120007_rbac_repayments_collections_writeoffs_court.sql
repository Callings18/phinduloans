-- Add permissions for repayments, collections, writeoffs, court (Phase 5 RBAC)
INSERT INTO public.permissions (module, action, description) VALUES
  ('repayments', 'view', 'View repayment records'),
  ('repayments', 'record', 'Record and verify payments'),
  ('collections', 'view', 'View collections and overdue loans'),
  ('collections', 'manage', 'Manage collection activities and demand letters'),
  ('writeoffs', 'view', 'View write-off requests'),
  ('writeoffs', 'manage', 'Approve, reject, and manage write-offs'),
  ('court', 'view', 'View court cases'),
  ('court', 'manage', 'Create and manage court cases')
ON CONFLICT (module, action) DO NOTHING;

-- super_admin and admin: all new permissions (repayments, collections, writeoffs, court)
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module IN ('repayments', 'collections', 'writeoffs', 'court') AND p.action IN ('view', 'manage', 'record'))
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- finance_officer and collections_officer: repayments view + record
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'repayments' AND p.action IN ('view', 'record'))
WHERE r.name IN ('finance_officer', 'collections_officer')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- collections_officer: collections view + manage
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'collections' AND p.action IN ('view', 'manage'))
WHERE r.name = 'collections_officer'
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- super_admin and admin: writeoffs, court (view + manage)
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module IN ('writeoffs', 'court') AND p.action IN ('view', 'manage'))
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- loan_officer: repayments view + record (so they can record payments)
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.name, p.id FROM public.roles r JOIN public.permissions p
ON (p.module = 'repayments' AND p.action IN ('view', 'record'))
WHERE r.name = 'loan_officer'
ON CONFLICT (role_name, permission_id) DO NOTHING;
