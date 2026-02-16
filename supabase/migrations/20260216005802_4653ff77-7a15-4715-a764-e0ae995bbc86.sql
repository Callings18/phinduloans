
-- Allow staff to INSERT into borrower_document_vault on behalf of borrowers
CREATE POLICY "Staff can insert vault documents"
ON public.borrower_document_vault
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Allow staff to INSERT into borrower_kyc_info on behalf of borrowers
CREATE POLICY "Staff can insert kyc info"
ON public.borrower_kyc_info
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Allow staff to INSERT references on behalf of borrowers
CREATE POLICY "Staff can insert references"
ON public.borrower_references
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role)
);

-- Allow staff to UPDATE references
CREATE POLICY "Staff can update references"
ON public.borrower_references
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role)
);

-- Allow staff to DELETE references
CREATE POLICY "Staff can delete references"
ON public.borrower_references
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);
