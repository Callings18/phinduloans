-- 1. Update user_roles policies to allow Super Admins and Admins to manage roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins and Super Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin')
  );

-- 2. Allow staff to view roles (needed for the staff list)
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles; -- In case it existed
CREATE POLICY "Staff can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer') OR
    public.has_role(auth.uid(), 'finance_officer') OR
    public.has_role(auth.uid(), 'collections_officer')
  );

-- 3. Update has_role function to be more flexible? 
-- Actually it's fine as it is, but we might want a 'is_staff' helper.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role NOT IN ('user', 'employer')
  )
$$;
