-- 1. Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule payment-reminder-cron 3x/day (08:00, 13:00, 17:00 CAT = 06:00, 11:00, 15:00 UTC)
SELECT cron.schedule(
  'payment-reminder-morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://yqrfheavftgybhcafzpt.supabase.co/functions/v1/payment-reminder-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA"}'::jsonb,
    body:=concat('{"slot":"morning","time":"', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'payment-reminder-midday',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://yqrfheavftgybhcafzpt.supabase.co/functions/v1/payment-reminder-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA"}'::jsonb,
    body:=concat('{"slot":"midday","time":"', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'payment-reminder-evening',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url:='https://yqrfheavftgybhcafzpt.supabase.co/functions/v1/payment-reminder-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA"}'::jsonb,
    body:=concat('{"slot":"evening","time":"', now(), '"}')::jsonb
  );
  $$
);

-- 3. Schedule process-notification-queue every 5 minutes
SELECT cron.schedule(
  'process-notification-queue-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yqrfheavftgybhcafzpt.supabase.co/functions/v1/process-notification-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmZoZWF2ZnRneWJoY2FmenB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzM5NzksImV4cCI6MjA4MTgwOTk3OX0.IGgNEPOV3UQKJ02SVxB1p3XzoSGSOK-r_U3zUBezgBA"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  );
  $$
);

-- 4. UAT sign-off table
CREATE TABLE IF NOT EXISTS public.uat_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_code text NOT NULL,
  checklist_item text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_signed_off boolean NOT NULL DEFAULT false,
  signed_off_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_off_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (house_code, checklist_item)
);

ALTER TABLE public.uat_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view UAT signoffs"
ON public.uat_signoffs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'loan_officer'::app_role)
  OR public.has_role(auth.uid(), 'finance_officer'::app_role)
  OR public.has_role(auth.uid(), 'credit_officer'::app_role)
  OR public.has_role(auth.uid(), 'collections_officer'::app_role)
  OR public.has_role(auth.uid(), 'auditor'::app_role)
);

CREATE POLICY "Admins can insert UAT signoffs"
ON public.uat_signoffs FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Admins can update UAT signoffs"
ON public.uat_signoffs FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Super admins can delete UAT signoffs"
ON public.uat_signoffs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_uat_signoffs_updated_at
BEFORE UPDATE ON public.uat_signoffs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Feature flags table (kill-switch)
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL UNIQUE,
  flag_label text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'general',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read feature flags"
ON public.feature_flags FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Super admins can insert feature flags"
ON public.feature_flags FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update feature flags"
ON public.feature_flags FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete feature flags"
ON public.feature_flags FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default feature flags
INSERT INTO public.feature_flags (flag_key, flag_label, description, category, is_enabled) VALUES
  ('whatsapp_notifications', 'WhatsApp Notifications', 'Send notifications via Twilio WhatsApp. Disable if delivery is failing.', 'notifications', true),
  ('sms_notifications', 'SMS Notifications', 'Send notifications via ExciteSMS. Disable to silence SMS sends.', 'notifications', true),
  ('email_notifications', 'Email Notifications', 'Send notifications via Brevo. Disable to silence email sends.', 'notifications', true),
  ('crb_checks', 'CRB Credit Checks', 'Run CRB checks during application review. Disable if provider is down.', 'lending', true),
  ('payment_reminders', 'Automated Payment Reminders', 'Run scheduled cron job that sends payment reminders 3x/day.', 'notifications', true),
  ('borrower_self_payment_claim', 'Borrower Self Payment Claims', 'Allow borrowers to mark "I paid" from their dashboard.', 'borrower', true),
  ('borrower_reloan', 'Borrower Reloan', 'Show "Apply again" prefilled flow on completed loans.', 'borrower', true),
  ('contract_signing_inapp', 'In-App Contract Signing', 'Show contract upload widget on borrower dashboard (offline signing flow).', 'borrower', true),
  ('pmic_module', 'PMIC Module', 'PMIC employer enrollment and reconciliation workflows.', 'lending', true)
ON CONFLICT (flag_key) DO NOTHING;