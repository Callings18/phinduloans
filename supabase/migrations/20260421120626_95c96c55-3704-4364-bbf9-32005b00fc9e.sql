-- Grant missing permissions to staff roles for end-to-end loan flow in houses

-- Loan officers: need approve/finance_approve to push loans through stages, plus disbursement create
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'loan_officer', p.id FROM public.permissions p
WHERE (p.module, p.action) IN (
  ('loans','approve'),
  ('loans','finance_approve'),
  ('loans','edit'),
  ('disbursement','create'),
  ('disbursement','approve'),
  ('repayments','record'),
  ('repayments','create'),
  ('collections','manage')
)
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Credit officers: borrower mgmt + finance approve + disbursement
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'credit_officer', p.id FROM public.permissions p
WHERE (p.module, p.action) IN (
  ('borrowers','manage'),
  ('loans','create'),
  ('loans','finance_approve'),
  ('loans','verify_documents'),
  ('loans','edit'),
  ('disbursement','view'),
  ('disbursement','create'),
  ('repayments','view')
)
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Finance officers: also need approve and verify_documents to keep flow moving
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'finance_officer', p.id FROM public.permissions p
WHERE (p.module, p.action) IN (
  ('loans','approve'),
  ('loans','verify_documents'),
  ('loans','edit'),
  ('borrowers','view'),
  ('borrowers','manage'),
  ('disbursement','manage'),
  ('collections','view')
)
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Collections officers: need borrower view+manage and loans edit for default marking
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT 'collections_officer', p.id FROM public.permissions p
WHERE (p.module, p.action) IN (
  ('borrowers','manage'),
  ('loans','edit'),
  ('writeoffs','view')
)
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Ensure permissions rows exist for any we referenced above (idempotent)
INSERT INTO public.permissions (module, action, description)
VALUES 
  ('loans','approve','Approve loan applications'),
  ('loans','finance_approve','Finance approval of loans'),
  ('loans','verify_documents','Verify loan application documents'),
  ('loans','edit','Edit loan applications'),
  ('loans','create','Create loan applications'),
  ('borrowers','manage','Create and manage borrowers'),
  ('borrowers','view','View borrowers'),
  ('disbursement','create','Create disbursements'),
  ('disbursement','approve','Approve and complete disbursements'),
  ('disbursement','manage','Manage disbursements'),
  ('disbursement','view','View disbursements'),
  ('repayments','record','Record repayments'),
  ('repayments','create','Create repayments'),
  ('repayments','view','View repayments'),
  ('collections','manage','Manage collections'),
  ('collections','view','View collections'),
  ('writeoffs','view','View write-offs')
ON CONFLICT (module, action) DO NOTHING;

-- Re-run the role grants in case permissions were just inserted
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.role_name, p.id FROM (VALUES
  ('loan_officer','loans','approve'),
  ('loan_officer','loans','finance_approve'),
  ('loan_officer','loans','edit'),
  ('loan_officer','disbursement','create'),
  ('loan_officer','disbursement','approve'),
  ('loan_officer','repayments','record'),
  ('loan_officer','repayments','create'),
  ('loan_officer','collections','manage'),
  ('credit_officer','borrowers','manage'),
  ('credit_officer','loans','create'),
  ('credit_officer','loans','finance_approve'),
  ('credit_officer','loans','verify_documents'),
  ('credit_officer','loans','edit'),
  ('credit_officer','disbursement','view'),
  ('credit_officer','disbursement','create'),
  ('credit_officer','repayments','view'),
  ('finance_officer','loans','approve'),
  ('finance_officer','loans','verify_documents'),
  ('finance_officer','loans','edit'),
  ('finance_officer','borrowers','view'),
  ('finance_officer','borrowers','manage'),
  ('finance_officer','disbursement','manage'),
  ('finance_officer','collections','view'),
  ('collections_officer','borrowers','manage'),
  ('collections_officer','loans','edit'),
  ('collections_officer','writeoffs','view')
) AS r(role_name, mod, act)
JOIN public.permissions p ON p.module = r.mod AND p.action = r.act
ON CONFLICT (role_name, permission_id) DO NOTHING;