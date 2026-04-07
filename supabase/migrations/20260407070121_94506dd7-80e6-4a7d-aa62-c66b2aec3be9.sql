-- otp_codes uses phone column, not user_id - allow authenticated insert/select/delete
CREATE POLICY "Anyone can read OTP codes"
  ON public.otp_codes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert OTP codes"
  ON public.otp_codes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete OTP codes"
  ON public.otp_codes FOR DELETE TO authenticated
  USING (true);

-- loan_status_transitions needs INSERT policy for staff
CREATE POLICY "Staff can insert loan status transitions"
  ON public.loan_status_transitions FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'loan_officer'::app_role)
    OR has_role(auth.uid(), 'credit_officer'::app_role)
    OR has_role(auth.uid(), 'finance_officer'::app_role)
  );

-- Tighten audit_logs INSERT
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Tighten notification_logs INSERT
DROP POLICY IF EXISTS "System can insert notification logs" ON public.notification_logs;
CREATE POLICY "Authenticated can insert notification logs"
  ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (true);