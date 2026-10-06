-- Fix UPDATE policies on loan_applications: change from RESTRICTIVE to PERMISSIVE
-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;
DROP POLICY IF EXISTS "Staff and Admins can update all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;

-- Recreate as PERMISSIVE (default) so any ONE matching policy grants access
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;
CREATE POLICY "Borrowers can sign their own contracts"
ON public.loan_applications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff and Admins can update all applications" ON public.loan_applications;
CREATE POLICY "Staff and Admins can update all applications"
ON public.loan_applications
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;
CREATE POLICY "Users can update their pending applications"
ON public.loan_applications
FOR UPDATE
USING (
  (auth.uid() = user_id AND status = 'pending'::loan_status) OR
  has_role(auth.uid(), 'admin'::app_role)
);