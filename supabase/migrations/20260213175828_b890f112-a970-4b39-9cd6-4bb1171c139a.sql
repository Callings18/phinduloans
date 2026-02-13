-- Fix: Convert loan_applications UPDATE policies to PERMISSIVE
-- Currently all 3 UPDATE policies are RESTRICTIVE (AND logic), which means
-- admin must ALSO satisfy borrower-only policies, blocking rejection/approval.

-- Drop the existing RESTRICTIVE UPDATE policies
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;
DROP POLICY IF EXISTS "Staff and Admins can update all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;

-- Recreate as PERMISSIVE (OR logic) — any ONE policy passing grants access
CREATE POLICY "Borrowers can sign their own contracts"
ON public.loan_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff and Admins can update all applications"
ON public.loan_applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Users can update their pending applications"
ON public.loan_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending'::loan_status)
WITH CHECK (auth.uid() = user_id AND status = 'pending'::loan_status);