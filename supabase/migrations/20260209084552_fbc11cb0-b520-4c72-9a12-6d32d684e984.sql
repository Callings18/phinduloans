
-- Unique NRC + phone on profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nrc_phone_unique
  ON public.profiles (nrc_number, phone)
  WHERE nrc_number IS NOT NULL AND phone IS NOT NULL;

-- Log auth events function
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
    user_id, action, entity_type, entity_id, ip_address, details
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

-- Profile verification columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Blacklist expiry
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMPTZ;
