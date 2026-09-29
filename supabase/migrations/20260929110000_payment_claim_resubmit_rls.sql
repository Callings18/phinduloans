-- Run in Supabase SQL Editor if 20260928120000 was applied before section 4 existed.
-- Borrower resubmit after staff sets claim to needs_more_info.

DROP POLICY IF EXISTS "Borrowers can resubmit payment claims needing info" ON public.payment_claims;
CREATE POLICY "Borrowers can resubmit payment claims needing info"
  ON public.payment_claims
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'needs_more_info')
  WITH CHECK (auth.uid() = user_id AND status = 'pending_review');
