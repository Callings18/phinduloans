-- Fix: Convert INSERT policies on loan_applications from RESTRICTIVE to PERMISSIVE
-- RESTRICTIVE policies require ALL to pass, and without a PERMISSIVE policy, nothing passes

-- Drop the restrictive INSERT policies
DROP POLICY IF EXISTS "Users can create applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can create loan applications" ON public.loan_applications;

-- Recreate as PERMISSIVE (default) - OR logic, so either borrower OR admin can insert
DROP POLICY IF EXISTS "Users can create applications" ON public.loan_applications;
CREATE POLICY "Users can create applications"
ON public.loan_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can create loan applications" ON public.loan_applications;
CREATE POLICY "Admins can create loan applications"
ON public.loan_applications
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'loan_officer'::app_role)
);