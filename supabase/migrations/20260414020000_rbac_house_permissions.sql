-- Canonical house permissions and role mappings

WITH perms(module, action, description) AS (
  VALUES
    ('house','dashboard_view','View house dashboard'),
    ('house','borrowers_view','View house borrowers'),
    ('house','borrowers_manage','Manage house borrowers'),
    ('house','loans_view','View house loans'),
    ('house','loans_create','Create house loans'),
    ('house','loans_update','Update house loans'),
    ('house','review_officer_approve','Officer review approval'),
    ('house','review_finance_approve','Finance review approval'),
    ('house','review_manager_approve','Manager review approval'),
    ('house','disbursement_view','View house disbursements'),
    ('house','disbursement_disburse','Disburse in house'),
    ('house','collections_view','View house collections'),
    ('house','collections_manage','Manage house collections'),
    ('house','reports_view','View house reports'),
    ('house','reports_export','Export house reports')
)
INSERT INTO public.permissions (module, action, description)
SELECT module, action, description
FROM perms
ON CONFLICT (module, action) DO UPDATE
SET description = EXCLUDED.description;

WITH role_actions(role_name, module, action) AS (
  VALUES
    ('admin','house','dashboard_view'),('admin','house','borrowers_view'),('admin','house','borrowers_manage'),('admin','house','loans_view'),('admin','house','loans_create'),('admin','house','loans_update'),('admin','house','review_officer_approve'),('admin','house','review_finance_approve'),('admin','house','review_manager_approve'),('admin','house','disbursement_view'),('admin','house','disbursement_disburse'),('admin','house','collections_view'),('admin','house','collections_manage'),('admin','house','reports_view'),('admin','house','reports_export'),
    ('loan_officer','house','dashboard_view'),('loan_officer','house','borrowers_view'),('loan_officer','house','borrowers_manage'),('loan_officer','house','loans_view'),('loan_officer','house','loans_create'),('loan_officer','house','loans_update'),('loan_officer','house','review_officer_approve'),('loan_officer','house','reports_view'),
    ('credit_officer','house','dashboard_view'),('credit_officer','house','borrowers_view'),('credit_officer','house','loans_view'),('credit_officer','house','loans_update'),('credit_officer','house','review_officer_approve'),('credit_officer','house','collections_view'),('credit_officer','house','reports_view'),
    ('finance_officer','house','dashboard_view'),('finance_officer','house','loans_view'),('finance_officer','house','review_finance_approve'),('finance_officer','house','disbursement_view'),('finance_officer','house','disbursement_disburse'),('finance_officer','house','collections_view'),('finance_officer','house','collections_manage'),('finance_officer','house','reports_view'),('finance_officer','house','reports_export'),
    ('collections_officer','house','dashboard_view'),('collections_officer','house','loans_view'),('collections_officer','house','collections_view'),('collections_officer','house','collections_manage'),('collections_officer','house','reports_view'),
    ('auditor','house','dashboard_view'),('auditor','house','borrowers_view'),('auditor','house','loans_view'),('auditor','house','disbursement_view'),('auditor','house','collections_view'),('auditor','house','reports_view'),('auditor','house','reports_export'),
    ('support','house','dashboard_view'),('support','house','borrowers_view'),('support','house','loans_view'),('support','house','reports_view')
)
INSERT INTO public.role_permissions (role_name, permission_id)
SELECT ra.role_name, p.id
FROM role_actions ra
JOIN public.permissions p ON p.module = ra.module AND p.action = ra.action
ON CONFLICT (role_name, permission_id) DO NOTHING;
