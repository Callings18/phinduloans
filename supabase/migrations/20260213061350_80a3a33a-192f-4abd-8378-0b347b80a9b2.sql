
-- Fix the uploaded_by CHECK constraint to allow UUID values (actual user IDs)
ALTER TABLE public.application_documents DROP CONSTRAINT IF EXISTS application_documents_uploaded_by_check;

-- Expand admin INSERT policy to include loan_officer and credit_officer
DROP POLICY IF EXISTS "Admins can upload documents for borrowers" ON public.application_documents;
CREATE POLICY "Admins can upload documents for borrowers"
ON public.application_documents
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);
