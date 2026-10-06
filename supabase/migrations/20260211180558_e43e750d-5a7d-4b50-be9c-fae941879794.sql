-- Allow admins and staff to update borrower_document_vault (approve/reject)
DROP POLICY IF EXISTS "Staff can update vault documents" ON public.borrower_document_vault;
CREATE POLICY "Staff can update vault documents"
ON public.borrower_document_vault
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Also allow loan officers and credit officers to view vault documents
DROP POLICY IF EXISTS "Staff can view all vaults" ON public.borrower_document_vault;
CREATE POLICY "Staff can view all vaults"
ON public.borrower_document_vault
FOR SELECT
USING (
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);