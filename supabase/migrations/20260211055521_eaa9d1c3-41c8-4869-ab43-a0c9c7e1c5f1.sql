
-- Allow borrowers to insert their own KYC documents
DROP POLICY IF EXISTS "Borrowers can insert own documents" ON public.borrower_document_vault;
CREATE POLICY "Borrowers can insert own documents"
ON public.borrower_document_vault
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = borrower_id);

-- Allow borrowers to view their own documents
DROP POLICY IF EXISTS "Borrowers can select own documents" ON public.borrower_document_vault;
CREATE POLICY "Borrowers can select own documents"
ON public.borrower_document_vault
FOR SELECT
TO authenticated
USING (auth.uid() = borrower_id);
