-- Add policy to allow admins and staff to create loan applications for any user
DROP POLICY IF EXISTS "Admins can create loan applications" ON public.loan_applications;
CREATE POLICY "Admins can create loan applications" 
ON public.loan_applications 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);