-- SMS package tracking: aggregate usage from notification_logs + optional package config in system_settings.

CREATE OR REPLACE FUNCTION public.sms_units_from_provider_response(resp jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF((resp -> 'data' ->> 'sms_count')::integer, 0),
    NULLIF((resp ->> 'sms_count')::integer, 0),
    1
  );
$$;

COMMENT ON FUNCTION public.sms_units_from_provider_response(jsonb) IS
  'ExciteSMS segments per log row; defaults to 1 when provider did not return sms_count.';

CREATE OR REPLACE FUNCTION public.get_sms_usage_stats(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since_ts timestamptz := COALESCE(p_since, TIMESTAMPTZ '1970-01-01');
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'since', since_ts,
    'messages_sent', COUNT(*) FILTER (WHERE nl.status = 'sent'),
    'messages_failed', COUNT(*) FILTER (WHERE nl.status = 'failed'),
    'messages_pending', COUNT(*) FILTER (WHERE nl.status IN ('pending', 'pending_config')),
    'sms_units_used', COALESCE(SUM(
      CASE
        WHEN nl.status = 'sent' THEN public.sms_units_from_provider_response(nl.provider_response)
        ELSE 0
      END
    ), 0)::bigint
  )
  INTO result
  FROM public.notification_logs nl
  WHERE nl.type = 'sms'
    AND nl.created_at >= since_ts;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_sms_usage_stats(timestamptz) IS
  'Staff-only aggregate SMS usage from notification_logs since a timestamp (package period start).';

GRANT EXECUTE ON FUNCTION public.get_sms_usage_stats(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sms_package_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT value INTO cfg FROM public.system_settings WHERE key = 'sms_package';
  RETURN COALESCE(cfg, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_sms_package_config() IS
  'Staff-only read of sms_package settings (no API secrets).';

GRANT EXECUTE ON FUNCTION public.get_sms_package_config() TO authenticated;

INSERT INTO public.system_settings (key, value)
VALUES (
  'sms_package',
  jsonb_build_object(
    'provider', 'excitesms',
    'package_size', 2000,
    'package_start_at', NULL,
    'low_balance_threshold', 200,
    'notes', 'Set package_start_at when you top up ExciteSMS; usage is counted from Phindu sends only.'
  )
)
ON CONFLICT (key) DO NOTHING;

-- Finance/loan officers may read package config (not API tokens).
DROP POLICY IF EXISTS "Loan officers can read operational settings" ON public.system_settings;
CREATE POLICY "Loan officers can read operational settings"
  ON public.system_settings FOR SELECT
  USING (
    has_role(auth.uid(), 'loan_officer'::app_role)
    AND key IN (
      'contract_templates', 'company_info', 'general_config', 'lending_rules',
      'notification_settings', 'notification_providers', 'brevo_settings', 'sms_package'
    )
  );
