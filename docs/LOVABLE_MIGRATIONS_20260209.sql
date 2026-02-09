-- =============================================================================
-- PhinduLoans – Full loan flow alignment migrations (2026-02-09)
-- Paste this entire file into Lovable / Supabase SQL Editor and run once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Unique NRC + phone on profiles (prevent duplicate combinations)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nrc_phone_unique
  ON public.profiles (nrc_number, phone)
  WHERE nrc_number IS NOT NULL AND phone IS NOT NULL;

COMMENT ON INDEX public.idx_profiles_nrc_phone_unique IS 'Ensures no two profiles share the same NRC number and phone combination.';

-- -----------------------------------------------------------------------------
-- 2. Log auth events (login/signup) to audit_logs with IP and device info
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. Profile verification status (email/phone verified for admin display)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_verified_at IS 'When email was verified (e.g. first password login or email confirmation)';
COMMENT ON COLUMN public.profiles.phone_verified_at IS 'When phone was verified (e.g. OTP sign-in)';

-- -----------------------------------------------------------------------------
-- 4. Blacklist expiry (optional duration for temporary blacklist)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blacklist_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.blacklist_expires_at IS 'When blacklist expires (null = permanent). If set and in the past, treat as not blacklisted.';

-- =============================================================================
-- End of migrations
-- =============================================================================
