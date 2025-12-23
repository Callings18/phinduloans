-- 1. Allow Admins and Staff to manage all profiles
CREATE POLICY "Admins and Staff can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer')
  );

-- 2. Update loan_applications policies to include staff roles for visibility
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;

CREATE POLICY "Staff and Admins can view all applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer') OR
    public.has_role(auth.uid(), 'finance_officer')
  );

DROP POLICY IF EXISTS "Admins can update all applications" ON public.loan_applications;

CREATE POLICY "Staff and Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
  );