-- Fix 1: Remove public access to otp_codes table - OTP verification must only happen via edge functions
-- This prevents attackers from reading active OTP codes and hijacking accounts

DROP POLICY IF EXISTS "Allow OTP creation" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow OTP verification" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow OTP update" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow OTP deletion" ON public.otp_codes;

-- No RLS policies needed for otp_codes - only service role (edge functions) should access this table
-- The send-otp and verify-otp edge functions use SUPABASE_SERVICE_ROLE_KEY to bypass RLS

-- Fix 2: Restrict system_settings access - prevent public access to notification_config containing API keys

DROP POLICY IF EXISTS "Everyone can read system settings" ON public.system_settings;

-- Allow public to read only non-sensitive configuration keys
CREATE POLICY "Public can read non-sensitive settings" 
ON public.system_settings 
FOR SELECT 
USING (
  key IN ('general_config', 'company_info', 'lending_rules')
);

-- Staff/Admin can read all settings including API keys
CREATE POLICY "Staff can read all settings" 
ON public.system_settings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);