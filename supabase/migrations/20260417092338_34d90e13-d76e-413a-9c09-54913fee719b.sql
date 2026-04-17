-- 1. Lock down otp_codes: remove permissive SELECT/DELETE policies.
-- OTP verification happens server-side via the verify-otp edge function using the service role.
DROP POLICY IF EXISTS "Anyone can read OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can delete OTP codes" ON public.otp_codes;

-- Keep INSERT permissive (send-otp edge function uses service role anyway, but client fallback is harmless).
-- No SELECT/DELETE policy = no client access. Service role bypasses RLS.

-- 2. Fix SECURITY DEFINER view: ensure v_house_report_summary runs as the querying user.
ALTER VIEW IF EXISTS public.v_house_report_summary SET (security_invoker = true);