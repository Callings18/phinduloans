-- Log login/signup to audit_logs with IP and optional device info
-- Date: 2026-02-09

CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_action TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    ip_address,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    'user',
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    p_ip_address,
    CASE WHEN p_device_info IS NOT NULL THEN jsonb_build_object('device_info', p_device_info) ELSE NULL END
  );
END;
$$;

COMMENT ON FUNCTION public.log_auth_event(TEXT, TEXT, JSONB) IS 'Records login/signup in audit_logs with IP and optional device info. Call after auth success.';
