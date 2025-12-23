-- 1. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can modify settings" ON public.system_settings FOR ALL USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- 2. Audit Logs Table
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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Auditors can view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 3. Risk Assessments Table
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB,
  loan_application_id UUID REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES auth.users(id),
  credit_score INTEGER,
  risk_rating TEXT CHECK (risk_rating IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  decision TEXT CHECK (decision IN ('approve', 'reject', 'more_info')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers can manage risk assessments" ON public.risk_assessments FOR ALL USING (public.has_role(auth.uid(), 'credit_officer') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Loan Officers view risk assessments" ON public.risk_assessments FOR SELECT USING (public.has_role(auth.uid(), 'loan_officer'));

-- 4. Notification Logs Table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  title TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications" ON public.notification_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view own notifications" ON public.notification_logs FOR SELECT USING (auth.uid() = user_id);

-- 5. Add Staff Assignment Column
ALTER TABLE public.loan_applications ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_assigned_to ON public.loan_applications(assigned_to);

-- 6. Audit Trigger for Loan Applications
CREATE OR REPLACE FUNCTION public.log_loan_changes() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES ((select auth.uid()), TG_OP, 'loan_application', NEW.id, row_to_json(OLD), row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_log_loan_updates ON public.loan_applications;
CREATE TRIGGER trigger_log_loan_updates
AFTER UPDATE ON public.loan_applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION public.log_loan_changes();

-- 7. Audit Trigger for Repayments
CREATE OR REPLACE FUNCTION public.log_repayment_activity() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_values)
  VALUES ((select auth.uid()), 'REPAYMENT_CREATED', 'repayment', NEW.id, row_to_json(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_log_repayment_insert ON public.loan_repayments;
CREATE TRIGGER trigger_log_repayment_insert
AFTER INSERT ON public.loan_repayments
FOR EACH ROW EXECUTE FUNCTION public.log_repayment_activity();

-- 8. Default System Settings Data
INSERT INTO public.system_settings (key, value, description) VALUES
('general_config', '{"currency": "ZMW", "country": "ZM", "date_format": "DD/MM/YYYY"}'::jsonb, 'General Localization Settings'),
('lending_rules', '{"default_interest_rate": 15.0, "max_loan_amount": 50000, "min_loan_amount": 500}'::jsonb, 'Global Lending Parameters')
ON CONFLICT (key) DO NOTHING;