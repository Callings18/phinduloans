-- Allow the SECURITY DEFINER audit triggers (log_loan_changes, log_repayment_activity)
-- to write rows into audit_logs. Without an INSERT policy these inserts are denied,
-- which rolls back the entire loan/repayment write (reloan, restructure, top-up,
-- record payment all fail silently).
CREATE POLICY "Authenticated activity can be audited"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow service_role (edge functions / admin operations) to insert audit rows.
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);