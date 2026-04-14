-- Step 1: Update existing products with canonical codes

UPDATE public.loan_products SET product_code = 'SALARY_ADVANCE',
  repayment_anchor_rule = 'payday_dom_23', home_verification_required = false, physical_collateral_collection = false,
  repayment_frequency = COALESCE(repayment_frequency, 'monthly')
WHERE name = 'Salary Advance Loan';

UPDATE public.loan_products SET product_code = 'BUSINESS',
  collateral_required = true, physical_collateral_collection = false, home_verification_required = false
WHERE name ILIKE 'Business Loan%';

UPDATE public.loan_products SET product_code = 'COLLATERAL',
  collateral_required = true, physical_collateral_collection = true, home_verification_required = false
WHERE name ILIKE 'Collateral Based%';

-- Update existing Marketeer if it exists without code
UPDATE public.loan_products SET product_code = 'MARKETEER',
  late_fee_fixed_amount = 30,
  pricing_tiers = '[{"minPrincipal":1000,"maxPrincipal":5000,"interestPercent":30,"durationDays":10},{"minPrincipal":5001,"maxPrincipal":10000,"interestPercent":20,"durationDays":15}]'::jsonb
WHERE name ILIKE 'Marketeer%' AND (product_code IS NULL OR product_code = '');

-- Update existing Payday Soft if it exists without code
UPDATE public.loan_products SET product_code = 'PAYDAY_SOFT',
  home_verification_required = true, physical_collateral_collection = false
WHERE name ILIKE 'Pay%day%Soft%' AND (product_code IS NULL OR product_code = '');

-- Update existing staff salary advance if different from main
UPDATE public.loan_products SET product_code = 'SALARY_ADVANCE_STAFF'
WHERE name ILIKE 'Members of staff%' AND (product_code IS NULL OR product_code = '');

-- Insert PAYDAY_SOFT if still missing
INSERT INTO public.loan_products (
  name, description, product_code, min_amount, max_amount, min_term_months, max_term_months,
  term_unit, interest_rate, interest_type, interest_period, processing_fee_percent, enforcement_fee_percent,
  penalty_frequency, is_active, status, requirements, employment_types, grace_period_days,
  late_payment_penalty_percent, insurance_required, insurance_percent, collateral_required,
  repayment_frequency, eligible_locations, home_verification_required, physical_collateral_collection,
  repayment_methods, channels
)
SELECT 'Payday Soft Loan', 'Non-civil servants in Lusaka. 30-day term.',
  'PAYDAY_SOFT', 500, 25000, 30, 30, 'days', 18, 'flat', 'monthly', 2, 10, 'monthly', true, 'active',
  ARRAY['NRC','Proof of employment','Proof of residence','Sketch map','Selfie holding NRC'],
  ARRAY['employed','contract','self_employed']::text[], 0, 5, false, 0, true, 'monthly',
  ARRAY['Lusaka']::text[], true, false, ARRAY['bank_transfer','mobile_money']::text[], ARRAY['website','admin']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE product_code = 'PAYDAY_SOFT');

-- Insert MOTOR_VEHICLE if missing
INSERT INTO public.loan_products (
  name, description, product_code, min_amount, max_amount, min_term_months, max_term_months,
  term_unit, interest_rate, interest_type, interest_period, processing_fee_percent, enforcement_fee_percent,
  penalty_frequency, is_active, status, requirements, employment_types, grace_period_days,
  late_payment_penalty_percent, insurance_required, insurance_percent, collateral_required,
  repayment_frequency, home_verification_required, physical_collateral_collection,
  repayment_methods, channels
)
SELECT 'Motor Vehicle Loan', 'Vehicle title held by lender.',
  'MOTOR_VEHICLE', 5000, 500000, 3, 24, 'months', 15, 'reducing_balance', 'monthly', 2, 10, 'monthly', true, 'active',
  ARRAY['NRC','3 months payslip','3 months bank statements','Selfie holding NRC','Vehicle photos']::text[],
  ARRAY['employed','self_employed']::text[], 3, 5, true, 2.5, true, 'monthly', false, false,
  ARRAY['bank_transfer','mobile_money']::text[], ARRAY['website','admin']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE product_code = 'MOTOR_VEHICLE');

-- Insert MARKETEER if still missing
INSERT INTO public.loan_products (
  name, description, product_code, min_amount, max_amount, min_term_months, max_term_months,
  term_unit, interest_rate, interest_type, interest_period, processing_fee_percent, enforcement_fee_percent,
  penalty_frequency, is_active, status, requirements, employment_types, grace_period_days,
  late_payment_penalty_percent, insurance_required, insurance_percent, collateral_required,
  repayment_frequency, home_verification_required, physical_collateral_collection,
  late_fee_fixed_amount, pricing_tiers, repayment_methods, channels
)
SELECT 'Marketeer Loan', 'Daily repayment tiers.',
  'MARKETEER', 1000, 10000, 10, 15, 'days', 0, 'flat', 'daily', 0, 0, 'daily', true, 'active',
  ARRAY['NRC','Selfie holding NRC','Video of business','Video of residence','Sketch map']::text[],
  ARRAY['self_employed']::text[], 0, 0, false, 0, false, 'daily', false, false,
  30, '[{"minPrincipal":1000,"maxPrincipal":5000,"interestPercent":30,"durationDays":10},{"minPrincipal":5001,"maxPrincipal":10000,"interestPercent":20,"durationDays":15}]'::jsonb,
  ARRAY['mobile_money','bank_transfer']::text[], ARRAY['website','admin']::text[]
WHERE NOT EXISTS (SELECT 1 FROM public.loan_products WHERE product_code = 'MARKETEER');

-- Step 2: user_product_access table (NO check constraint - allow flexible codes)

CREATE TABLE IF NOT EXISTS public.user_product_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_product_access_user_product_idx
  ON public.user_product_access(user_id, product_code);

-- Seed admin/super_admin with only the 6 canonical codes
INSERT INTO public.user_product_access (user_id, product_code, is_active)
SELECT ur.user_id, lp.product_code, true
FROM public.user_roles ur
CROSS JOIN public.loan_products lp
WHERE ur.role IN ('admin', 'super_admin')
  AND lp.product_code IN ('SALARY_ADVANCE','PAYDAY_SOFT','COLLATERAL','BUSINESS','MOTOR_VEHICLE','MARKETEER')
ON CONFLICT (user_id, product_code) DO UPDATE SET is_active = EXCLUDED.is_active;

ALTER TABLE public.user_product_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_product_access_select_own_or_admin" ON public.user_product_access;
CREATE POLICY "user_product_access_select_own_or_admin"
  ON public.user_product_access FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Step 3: house permissions

WITH perms(module, action, description) AS (
  VALUES
    ('house','dashboard_view','View house dashboard'),('house','borrowers_view','View house borrowers'),
    ('house','borrowers_manage','Manage house borrowers'),('house','loans_view','View house loans'),
    ('house','loans_create','Create house loans'),('house','loans_update','Update house loans'),
    ('house','review_officer_approve','Officer review approval'),('house','review_finance_approve','Finance review approval'),
    ('house','review_manager_approve','Manager review approval'),('house','disbursement_view','View house disbursements'),
    ('house','disbursement_disburse','Disburse in house'),('house','collections_view','View house collections'),
    ('house','collections_manage','Manage house collections'),('house','reports_view','View house reports'),
    ('house','reports_export','Export house reports')
)
INSERT INTO public.permissions (module, action, description)
SELECT module, action, description FROM perms
ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description;

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
SELECT ra.role_name, p.id FROM role_actions ra JOIN public.permissions p ON p.module = ra.module AND p.action = ra.action
ON CONFLICT (role_name, permission_id) DO NOTHING;

-- Step 4: has_product_access function

CREATE OR REPLACE FUNCTION public.has_product_access(p_user UUID, p_product_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(p_user, 'super_admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user AND ur.role = 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.user_product_access upa WHERE upa.user_id = p_user AND upa.product_code = p_product_code AND upa.is_active = true);
$$;

-- Step 5: Product-scoped RLS policies

CREATE OR REPLACE FUNCTION public.loan_product_code_for_loan(p_loan_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT lp.product_code FROM public.loan_applications la JOIN public.loan_products lp ON lp.id = la.loan_product_id WHERE la.id = p_loan_id LIMIT 1; $$;

DROP POLICY IF EXISTS "house_product_scope_loan_applications_select" ON public.loan_applications;
CREATE POLICY "house_product_scope_loan_applications_select" ON public.loan_applications FOR SELECT
  USING (public.has_product_access(auth.uid(), (SELECT lp.product_code FROM public.loan_products lp WHERE lp.id = loan_product_id LIMIT 1)));

DROP POLICY IF EXISTS "house_product_scope_loan_repayments_select" ON public.loan_repayments;
CREATE POLICY "house_product_scope_loan_repayments_select" ON public.loan_repayments FOR SELECT
  USING (public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id)));

DROP POLICY IF EXISTS "house_product_scope_loan_events_select" ON public.loan_events;
CREATE POLICY "house_product_scope_loan_events_select" ON public.loan_events FOR SELECT
  USING (public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id)));

DROP POLICY IF EXISTS "house_product_scope_disbursements_select" ON public.disbursements;
CREATE POLICY "house_product_scope_disbursements_select" ON public.disbursements FOR SELECT
  USING (public.has_product_access(auth.uid(), public.loan_product_code_for_loan(loan_id)));

DROP POLICY IF EXISTS "house_product_scope_application_documents_select" ON public.application_documents;
CREATE POLICY "house_product_scope_application_documents_select" ON public.application_documents FOR SELECT
  USING (public.has_product_access(auth.uid(), public.loan_product_code_for_loan(application_id)));

-- Step 6: Indexes and views

CREATE INDEX IF NOT EXISTS loan_applications_house_idx ON public.loan_applications(loan_product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS loan_repayments_house_idx ON public.loan_repayments(loan_id, status, due_date);
CREATE INDEX IF NOT EXISTS disbursements_house_idx ON public.disbursements(loan_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS loan_events_house_idx ON public.loan_events(loan_id, created_at DESC);

CREATE OR REPLACE VIEW public.v_house_report_summary AS
SELECT lp.product_code, lp.name AS product_name,
  COUNT(la.id) AS total_loans,
  COUNT(*) FILTER (WHERE la.status IN ('active','disbursed','approved')) AS active_loans,
  COALESCE(SUM(d.amount) FILTER (WHERE d.status = 'completed'), 0) AS total_disbursed
FROM public.loan_products lp
LEFT JOIN public.loan_applications la ON la.loan_product_id = lp.id
LEFT JOIN public.disbursements d ON d.loan_id = la.id
GROUP BY lp.product_code, lp.name;

-- Step 7: Staged review defaults

UPDATE public.loan_applications
SET approval_stage = COALESCE(approval_stage, 'loan_officer'),
  product_specific_data = COALESCE(product_specific_data, '{}'::jsonb)
    || jsonb_build_object('approvals', COALESCE(product_specific_data->'approvals',
      jsonb_build_object('loan_officer',jsonb_build_object('status','pending'),'finance',jsonb_build_object('status','pending'),'manager',jsonb_build_object('status','pending'))))
WHERE product_specific_data IS NULL OR product_specific_data->'approvals' IS NULL OR approval_stage IS NULL;