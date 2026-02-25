
-- 1. Allow loan_officer to read system_settings (operational keys only)
CREATE POLICY "Loan officers can read operational settings"
  ON public.system_settings FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    AND key IN (
      'contract_templates', 'company_info', 'general_config', 'lending_rules',
      'notification_settings', 'notification_providers', 'brevo_settings'
    )
  );

-- 2. Allow loan_officer to read contract_templates table
CREATE POLICY "Loan officers can view contract templates"
  ON public.contract_templates FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

-- 3. Allow loan_officer to view all disbursements
CREATE POLICY "Staff can view all disbursements"
  ON public.disbursements FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
  );

-- 4. Allow loan_officer to view all repayments
CREATE POLICY "Staff can view all repayments"
  ON public.loan_repayments FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'collections_officer'::app_role)
  );
