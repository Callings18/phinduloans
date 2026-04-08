
-- =============================================
-- FIX 1: Lock down otp_codes table
-- Remove all overly permissive RLS policies
-- OTP lifecycle handled exclusively via edge functions (service_role)
-- =============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to read OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow authenticated users to insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow authenticated users to delete OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow select OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Allow delete OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Users can read own OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Users can insert OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "Users can delete OTP codes" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_select" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_insert" ON public.otp_codes;
DROP POLICY IF EXISTS "otp_codes_delete" ON public.otp_codes;

-- Ensure RLS is enabled (should already be)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No client-facing policies needed - service_role key bypasses RLS
-- Edge functions (send-otp, verify-otp) use service_role key

-- =============================================
-- FIX 2: Prevent privilege escalation in user_roles
-- Admins cannot assign super_admin role
-- =============================================

-- Drop existing INSERT/UPDATE/DELETE policies on user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin manage roles" ON public.user_roles;

-- Re-create with privilege escalation prevention
-- INSERT: admins can assign roles but NOT super_admin
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- UPDATE: admins can update roles but cannot set role to super_admin
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- DELETE: admins can delete roles but not super_admin roles
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) AND role != 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
