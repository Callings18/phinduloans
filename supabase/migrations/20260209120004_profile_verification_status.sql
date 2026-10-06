-- Add verification timestamps to profiles for admin display
-- Date: 2026-02-09

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_verified_at IS 'When email was verified (e.g. first password login or email confirmation)';
COMMENT ON COLUMN public.profiles.phone_verified_at IS 'When phone was verified (e.g. OTP sign-in)';
