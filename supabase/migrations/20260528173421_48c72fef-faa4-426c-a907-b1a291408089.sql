
-- 1) Employers: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view verified employers" ON public.employers;
CREATE POLICY "Authenticated users can view verified employers"
ON public.employers
FOR SELECT
TO authenticated
USING (is_verified = true OR has_role(auth.uid(), 'admin'::app_role));

-- 2) Roles / role_permissions: restrict to staff (admin/super_admin)
DROP POLICY IF EXISTS "Staff can view roles" ON public.roles;
CREATE POLICY "Staff can view roles"
ON public.roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Staff can view role_permissions" ON public.role_permissions;
CREATE POLICY "Staff can view role_permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3) OTP codes: only edge functions (service role) should insert. Remove permissive policy.
DROP POLICY IF EXISTS "Anyone can insert OTP codes" ON public.otp_codes;

-- 4) user_roles: prevent admin from modifying their OWN role row (only super_admin can)
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_id <> auth.uid()
    AND role <> 'super_admin'::app_role
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND user_id <> auth.uid()
    AND role <> 'super_admin'::app_role
  )
);
