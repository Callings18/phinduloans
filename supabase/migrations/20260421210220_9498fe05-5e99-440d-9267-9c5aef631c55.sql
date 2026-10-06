-- 1. user_roles: remove overlapping admin policies that allow self-escalation
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- 2. notification_logs: restrict INSERT to staff roles + service role only
DROP POLICY IF EXISTS "Authenticated can insert notification logs" ON public.notification_logs;

DROP POLICY IF EXISTS "Staff can insert notification logs" ON public.notification_logs;
CREATE POLICY "Staff can insert notification logs"
ON public.notification_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'loan_officer'::public.app_role)
  OR public.has_role(auth.uid(), 'credit_officer'::public.app_role)
  OR public.has_role(auth.uid(), 'finance_officer'::public.app_role)
  OR public.has_role(auth.uid(), 'collections_officer'::public.app_role)
  OR public.has_role(auth.uid(), 'support'::public.app_role)
  OR public.has_role(auth.uid(), 'auditor'::public.app_role)
);

-- 3. payment_gateway_settings: tighten secret access to super_admin only
DROP POLICY IF EXISTS "Admins can view payment settings" ON public.payment_gateway_settings;
DROP POLICY IF EXISTS "Admins can insert payment settings" ON public.payment_gateway_settings;
DROP POLICY IF EXISTS "Admins can update payment settings" ON public.payment_gateway_settings;
DROP POLICY IF EXISTS "Admins can delete payment settings" ON public.payment_gateway_settings;

DROP POLICY IF EXISTS "Super admins can view payment settings with secrets" ON public.payment_gateway_settings;
CREATE POLICY "Super admins can view payment settings with secrets"
ON public.payment_gateway_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can insert payment settings" ON public.payment_gateway_settings;
CREATE POLICY "Super admins can insert payment settings"
ON public.payment_gateway_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can update payment settings" ON public.payment_gateway_settings;
CREATE POLICY "Super admins can update payment settings"
ON public.payment_gateway_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can delete payment settings" ON public.payment_gateway_settings;
CREATE POLICY "Super admins can delete payment settings"
ON public.payment_gateway_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Sanitized view so regular admins can see which gateways are configured,
-- without exposing secret values.
CREATE OR REPLACE VIEW public.payment_gateway_settings_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  gateway_name,
  is_active,
  environment,
  created_at,
  updated_at,
  CASE WHEN api_key IS NOT NULL AND length(api_key) > 0 THEN true ELSE false END AS has_api_key,
  CASE WHEN webhook_secret IS NOT NULL AND length(webhook_secret) > 0 THEN true ELSE false END AS has_webhook_secret
FROM public.payment_gateway_settings;

GRANT SELECT ON public.payment_gateway_settings_safe TO authenticated;