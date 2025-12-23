-- 1. Enhance Roles (Add specific staff roles)
-- We cannot execute ALTER TYPE inside a transaction block nicely in all environments, 
-- but Supabase migrations usually run independently. 
-- Note: 'admin' acts as Admin/Operations. 'super_admin' will be the Platform Owner.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'loan_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'credit_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'collections_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- 2. System Settings (Super Admin controlled)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for System Settings
CREATE POLICY "Everyone can read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

CREATE POLICY "Only Super Admins can modify settings"
  ON public.system_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- 3. Audit Logs (Compliance & Security)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Audit Logs
CREATE POLICY "Admins and Auditors can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'auditor')
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true); -- Usually inserted via triggers or backend logic

-- 4. Credit & Risk Assessment Module
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB, -- checklist items, scores
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id),
  credit_score INTEGER,
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  decision TEXT CHECK (decision IN ('approve', 'reject', 'more_info')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- Policies for Risk Assessments
CREATE POLICY "Credit Officers and Admins can manage risk assessments"
  ON public.risk_assessments FOR ALL
  USING (
    public.has_role(auth.uid(), 'credit_officer') OR 
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Loan Officers can view risk assessments"
  ON public.risk_assessments FOR SELECT
  USING (public.has_role(auth.uid(), 'loan_officer'));

-- 5. Notification Logs (SMS/Email History)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'sms', 'email', 'whatsapp'
  recipient TEXT NOT NULL,
  title TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent', -- sent, failed, delivered
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications"
  ON public.notification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own notifications"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Trigger for updated_at on new tables
CREATE TRIGGER update_risk_assessments_updated_at
  BEFORE UPDATE ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Insert Default System Settings
INSERT INTO public.system_settings (key, value, description) VALUES
('general_config', '{"currency": "ZMW", "country": "ZM", "date_format": "DD/MM/YYYY"}'::jsonb, 'General Localization Settings'),
('lending_rules', '{"default_interest_rate": 15.0, "max_loan_amount": 50000, "min_loan_amount": 500}'::jsonb, 'Global Lending Parameters'),
('company_info', '{"name": "LoanSphere Microfinance", "address": "Lusaka, Zambia", "support_email": "support@loansphere.com"}'::jsonb, 'Company Details');
