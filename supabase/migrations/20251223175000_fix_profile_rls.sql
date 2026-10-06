-- Profile policy lives in 20251223160312_*.sql; extend loan_application staff access here.
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Staff and Admins can view all applications" ON public.loan_applications;
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
DROP POLICY IF EXISTS "Staff and Admins can update all applications" ON public.loan_applications;
CREATE POLICY "Staff and Admins can update all applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'super_admin') OR
    public.has_role(auth.uid(), 'loan_officer') OR
    public.has_role(auth.uid(), 'credit_officer')
  );
