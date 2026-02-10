-- Allow borrowers to update contract signing fields on their own loans
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;

CREATE POLICY "Borrowers can sign their own contracts"
  ON public.loan_applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);