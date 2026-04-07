-- =============================================
-- Migration 1: Admin finance atomic functions
-- =============================================

-- Atomic expense approve / reject / paid with ledger posting
CREATE OR REPLACE FUNCTION public.admin_set_expense_status(
  p_expense_id uuid,
  p_new_status text,
  p_reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  e RECORD;
  acc RECORD;
  v_new_bal numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_new_status NOT IN ('approved', 'rejected', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;
  IF NOT public.has_permission(v_uid, 'expenses', 'approve') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  SELECT * INTO e FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expense not found');
  END IF;
  IF p_new_status = 'approved' AND e.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending expenses can be approved');
  END IF;
  IF p_new_status = 'rejected' AND e.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending expenses can be rejected');
  END IF;
  IF p_new_status = 'paid' AND e.status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved expenses can be marked paid');
  END IF;
  IF p_new_status = 'approved' THEN
    UPDATE public.expenses SET status = 'approved', approved_at = now(), approved_by = v_uid, updated_at = now() WHERE id = p_expense_id;
  ELSIF p_new_status = 'rejected' THEN
    UPDATE public.expenses SET status = 'rejected', updated_at = now(),
      description = CASE WHEN p_reject_reason IS NOT NULL AND length(trim(p_reject_reason)) > 0 THEN concat_ws(E'\n', COALESCE(e.description, ''), concat('Rejected: ', trim(p_reject_reason))) ELSE COALESCE(e.description, '') END
    WHERE id = p_expense_id;
  ELSIF p_new_status = 'paid' THEN
    IF e.account_id IS NOT NULL THEN
      SELECT * INTO acc FROM public.accounts WHERE id = e.account_id FOR UPDATE;
      IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Linked account not found'); END IF;
      v_new_bal := acc.balance - e.amount;
      IF v_new_bal < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance in the linked account'); END IF;
      UPDATE public.accounts SET balance = v_new_bal, updated_at = now() WHERE id = e.account_id;
      INSERT INTO public.account_transactions (account_id, transaction_type, amount, balance_before, balance_after, destination, reference_type, reference_id, notes)
      VALUES (e.account_id, 'expense', e.amount, acc.balance, v_new_bal, e.vendor_payee, 'expense', e.id, format('Expense: %s - %s', e.expense_category, e.vendor_payee));
    END IF;
    UPDATE public.expenses SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = p_expense_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
COMMENT ON FUNCTION public.admin_set_expense_status(uuid, text, text) IS 'Approve/reject/paid for expenses with optional account ledger in one transaction';
GRANT EXECUTE ON FUNCTION public.admin_set_expense_status(uuid, text, text) TO authenticated;

-- Write-off functions
CREATE OR REPLACE FUNCTION public.admin_approve_loan_writeoff(p_writeoff_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); w RECORD; v_borrower text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Write-off not found'); END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be approved'); END IF;
  SELECT la.full_name INTO v_borrower FROM public.loan_applications la WHERE la.id = w.loan_id;
  UPDATE public.loan_writeoffs SET status = 'approved', approved_at = now(), approved_by = v_uid, updated_at = now() WHERE id = p_writeoff_id;
  UPDATE public.loan_applications SET status = 'defaulted', updated_at = now() WHERE id = w.loan_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, module) VALUES (v_uid, 'WRITEOFF_APPROVED', 'loan_writeoff', p_writeoff_id, jsonb_build_object('loan_id', w.loan_id, 'amount', w.writeoff_amount, 'borrower', v_borrower), 'writeoffs');
  INSERT INTO public.collection_activities (loan_id, activity_type, notes, outcome) VALUES (w.loan_id, 'writeoff_approved', format('Write-off approved. Amount: K%s', to_char(w.writeoff_amount, 'FM999,999,999,990.00')), 'Loan written off - marked as defaulted');
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reject_loan_writeoff(p_writeoff_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); w RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Write-off not found'); END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be rejected'); END IF;
  UPDATE public.loan_writeoffs SET status = 'rejected', recovery_notes = format('Rejected: %s', COALESCE(nullif(trim(p_reason), ''), 'no reason')), updated_at = now() WHERE id = p_writeoff_id;
  INSERT INTO public.collection_activities (loan_id, activity_type, notes, outcome) VALUES (w.loan_id, 'writeoff_rejected', format('Write-off rejected. Reason: %s', COALESCE(nullif(trim(p_reason), ''), 'n/a')), 'Continue collection efforts');
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_record_writeoff_recovery(p_writeoff_id uuid, p_amount numeric, p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); w RECORD; v_new_recovery numeric; v_line text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid recovery amount'); END IF;
  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Write-off not found'); END IF;
  IF w.status IS DISTINCT FROM 'approved' THEN RETURN jsonb_build_object('success', false, 'error', 'Recovery only for approved write-offs'); END IF;
  v_new_recovery := COALESCE(w.recovery_amount, 0) + p_amount;
  v_line := format(E'\n[%s] Recovered K%s: %s', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), to_char(p_amount, 'FM999,999,999,990.00'), COALESCE(nullif(trim(p_notes), ''), ''));
  UPDATE public.loan_writeoffs SET recovery_amount = v_new_recovery, recovery_notes = trim(both E'\n' from concat_ws(E'\n', COALESCE(w.recovery_notes, ''), v_line)), updated_at = now() WHERE id = p_writeoff_id;
  INSERT INTO public.collection_activities (loan_id, activity_type, notes, outcome) VALUES (w.loan_id, 'recovery_recorded', format('Recovery recorded: K%s. %s', to_char(p_amount, 'FM999,999,999,990.00'), COALESCE(nullif(trim(p_notes), ''), '')), format('Total recovered: K%s', to_char(v_new_recovery, 'FM999,999,999,990.00')));
  RETURN jsonb_build_object('success', true);
END; $$;

COMMENT ON FUNCTION public.admin_approve_loan_writeoff(uuid) IS 'Approve pending write-off, mark loan defaulted, audit + activity';
COMMENT ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) IS 'Reject pending write-off with reason';
COMMENT ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) IS 'Append recovery amount/notes on approved write-off';
GRANT EXECUTE ON FUNCTION public.admin_approve_loan_writeoff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) TO authenticated;

-- Mark loan defaulted with reason
CREATE OR REPLACE FUNCTION public.admin_mark_loan_defaulted(p_loan_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); la RECORD; v_prev_status text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'loans', 'edit') THEN RETURN jsonb_build_object('success', false, 'error', 'Permission denied'); END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RETURN jsonb_build_object('success', false, 'error', 'Reason is required (min 3 characters)'); END IF;
  SELECT id, status INTO la FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Loan not found'); END IF;
  v_prev_status := la.status::text;
  IF la.status::text NOT IN ('active', 'disbursed') THEN RETURN jsonb_build_object('success', false, 'error', 'Only active or disbursed loans can be marked defaulted'); END IF;
  UPDATE public.loan_applications SET status = 'defaulted', updated_at = now() WHERE id = p_loan_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, details) VALUES (v_uid, 'MOVE_TO_DEFAULTED', 'loan_application', p_loan_id, 'loans', jsonb_build_object('reason', trim(p_reason), 'previous_status', v_prev_status));
  INSERT INTO public.loan_events (loan_id, event_type, performed_by, reason, previous_values, new_values) VALUES (p_loan_id, 'manual_default', v_uid, trim(p_reason), jsonb_build_object('status', v_prev_status), jsonb_build_object('status', 'defaulted'));
  RETURN jsonb_build_object('success', true);
END; $$;
COMMENT ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) IS 'Move loan to defaulted with reason; audit + loan_events';
GRANT EXECUTE ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) TO authenticated;

-- =============================================
-- Migration 2: CRB RLS tightening
-- =============================================
DROP POLICY IF EXISTS "Staff can view CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can view CRB requests" ON public.crb_requests
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'loans', 'view')
    OR public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Staff can insert CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can insert CRB requests" ON public.crb_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'loans', 'view')
    OR public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Staff can update CRB requests" ON public.crb_requests;
CREATE POLICY "Staff can update CRB requests" ON public.crb_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'loans', 'finance_approve')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- =============================================
-- Migration 3: Report performance indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_loan_applications_reports_created_at ON public.loan_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_applications_reports_disbursed_at ON public.loan_applications (disbursed_at DESC) WHERE disbursed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loan_repayments_reports_due_date ON public.loan_repayments (due_date);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_reports_loan_id ON public.loan_repayments (loan_id);

-- =============================================
-- Migration 4: Phase 1 workflow backbone
-- =============================================
CREATE TABLE IF NOT EXISTS public.loan_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('borrower', 'admin', 'system')),
  actor_id uuid,
  reason_code text,
  reason_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_status_transitions_loan_id ON public.loan_status_transitions (loan_id, created_at DESC);
ALTER TABLE public.loan_status_transitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'loan_status_transitions' AND policyname = 'Staff can read loan status transitions') THEN
    CREATE POLICY "Staff can read loan status transitions" ON public.loan_status_transitions FOR SELECT TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'loan_officer'::app_role) OR has_role(auth.uid(), 'credit_officer'::app_role) OR has_role(auth.uid(), 'finance_officer'::app_role) OR has_role(auth.uid(), 'collections_officer'::app_role) OR has_role(auth.uid(), 'auditor'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'loan_status_transitions' AND policyname = 'Borrowers can read own loan status transitions') THEN
    CREATE POLICY "Borrowers can read own loan status transitions" ON public.loan_status_transitions FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.loan_applications la WHERE la.id = loan_status_transitions.loan_id AND la.user_id = auth.uid()));
  END IF;
END $$;

-- Timeline visibility column
ALTER TABLE public.loan_events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'both';
DO $$ BEGIN
  ALTER TABLE public.loan_events ADD CONSTRAINT loan_events_visibility_check CHECK (visibility IN ('borrower', 'admin', 'both'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_loan_events_visibility ON public.loan_events(visibility);

-- Payment claim handshake fields
ALTER TABLE public.payment_claims ADD COLUMN IF NOT EXISTS review_comment text;
ALTER TABLE public.payment_claims ADD COLUMN IF NOT EXISTS decision_reason_code text;

DO $$ BEGIN
  ALTER TABLE public.payment_claims DROP CONSTRAINT IF EXISTS payment_claims_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
ALTER TABLE public.payment_claims ADD CONSTRAINT payment_claims_status_check CHECK (status IN ('pending', 'pending_review', 'needs_more_info', 'approved', 'verified', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_claims_unique_pending ON public.payment_claims (repayment_id, user_id) WHERE status IN ('pending', 'pending_review', 'needs_more_info');

-- =============================================
-- Migration 5: Fix loan transition trigger to allow disbursed -> defaulted
-- =============================================
CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('under_review', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('contract_signing', 'awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'contract_signing' AND NEW.status IN ('awaiting_disbursement', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'awaiting_disbursement' AND NEW.status IN ('disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'disbursed' AND NEW.status IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'defaulted' AND NEW.status = 'completed' THEN
    RETURN NEW;
  -- Allow CRB-related transitions to be skipped when CRB is disabled
  ELSIF OLD.status = 'crb_failed' AND NEW.status IN ('under_review', 'approved', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'pmic_pending' AND NEW.status IN ('under_review', 'approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', OLD.status, NEW.status;
END;
$function$;