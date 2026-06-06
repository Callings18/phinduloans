-- Finding 1: Narrow the borrower contract-signing UPDATE policy to signing-eligible statuses.
DROP POLICY IF EXISTS "Borrowers can sign their own contracts" ON public.loan_applications;

CREATE POLICY "Borrowers can sign their own contracts"
ON public.loan_applications
FOR UPDATE
USING (
  auth.uid() = user_id
  AND status = ANY (ARRAY['approved'::loan_status, 'contract_signing'::loan_status, 'awaiting_disbursement'::loan_status])
)
WITH CHECK (
  auth.uid() = user_id
  AND status = ANY (ARRAY['approved'::loan_status, 'contract_signing'::loan_status, 'awaiting_disbursement'::loan_status])
);

-- Finding 2: Restrict borrower loan_events SELECT to visible events only.
DROP POLICY IF EXISTS "Borrowers can view own loan events" ON public.loan_events;

CREATE POLICY "Borrowers can view own loan events"
ON public.loan_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.loan_applications la
    WHERE la.id = loan_events.loan_id
      AND la.user_id = auth.uid()
  )
  AND (loan_events.visibility = 'both' OR loan_events.visibility = 'borrower')
);