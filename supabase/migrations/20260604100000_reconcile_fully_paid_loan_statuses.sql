-- Reconcile loan_applications stuck in active/disbursed after the borrower has fully paid.
-- Unblocks block_duplicate_active_loan and admin "already has an active loan" checks.

CREATE OR REPLACE FUNCTION public.try_complete_loan_if_fully_paid(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_total_paid numeric;
  v_total_due numeric;
  v_all_paid boolean;
  v_principal_reconciled boolean;
  v_updated boolean := false;
  v_prev_status text;
BEGIN
  SELECT id, status::text AS status_text, total_repayment, loan_amount
    INTO v_loan
  FROM public.loan_applications
  WHERE id = p_loan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  v_prev_status := v_loan.status_text;

  IF v_prev_status IN ('completed', 'defaulted', 'rejected') THEN
    RETURN jsonb_build_object(
      'success', true,
      'updated', false,
      'reason', 'already_terminal',
      'status', v_prev_status
    );
  END IF;

  -- Zero-balance installments left pending/overdue/partial (common after schedule repairs).
  UPDATE public.loan_repayments lr
  SET
    status = 'paid',
    principal_paid = COALESCE(lr.principal_paid, lr.original_amount, lr.amount),
    paid_at = COALESCE(lr.paid_at, now()),
    updated_at = now()
  WHERE lr.loan_id = p_loan_id
    AND COALESCE(lr.is_reversed, false) = false
    AND lr.status IN ('pending', 'overdue', 'partial')
    AND COALESCE(lr.original_amount, lr.amount, 0) - COALESCE(lr.principal_paid, 0) <= 0.01
    AND COALESCE(lr.penalty_amount, 0) - COALESCE(lr.penalty_paid, 0) <= 0.01;

  SELECT COALESCE(SUM(
    COALESCE(principal_paid, CASE WHEN status = 'paid' THEN amount ELSE 0 END)
  ), 0)
    INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id
    AND COALESCE(is_reversed, false) = false;

  v_total_due := COALESCE(v_loan.total_repayment, v_loan.loan_amount);

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.loan_repayments
    WHERE loan_id = p_loan_id
      AND COALESCE(is_reversed, false) = false
      AND status IN ('pending', 'overdue', 'partial')
      AND (
        COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0) > 0.01
        OR COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0) > 0.01
      )
  ) INTO v_all_paid;

  v_principal_reconciled := v_total_paid >= v_total_due - 0.01;

  IF v_all_paid AND v_principal_reconciled THEN
    UPDATE public.loan_applications
    SET status = 'completed',
        updated_at = now()
    WHERE id = p_loan_id
      AND status::text NOT IN ('completed', 'defaulted', 'rejected');

    v_updated := FOUND;

    IF v_updated THEN
      INSERT INTO public.loan_status_transitions (loan_id, from_status, to_status, actor_type, actor_id, reason_code)
      VALUES (p_loan_id, v_prev_status, 'completed', 'system', NULL, 'fully_paid_reconciled');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated,
    'status', CASE WHEN v_updated THEN 'completed' ELSE v_prev_status END,
    'total_paid', v_total_paid,
    'total_due', v_total_due,
    'all_installments_clear', v_all_paid,
    'principal_reconciled', v_principal_reconciled
  );
END;
$$;

COMMENT ON FUNCTION public.try_complete_loan_if_fully_paid(uuid) IS
  'Marks loan completed when all non-reversed installments are cleared and principal paid >= total_repayment.';

CREATE OR REPLACE FUNCTION public.admin_reconcile_loan_completion(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT (
    public.has_permission(v_uid, 'repayments', 'record')
    OR public.has_permission(v_uid, 'collections', 'record')
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'finance_officer'::public.app_role)
    OR public.has_role(v_uid, 'collections_officer'::public.app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  RETURN public.try_complete_loan_if_fully_paid(p_loan_id);
END;
$$;

COMMENT ON FUNCTION public.admin_reconcile_loan_completion(uuid) IS
  'Staff-only wrapper to reconcile a fully paid loan to status completed.';

CREATE OR REPLACE FUNCTION public.trg_loan_repayment_try_complete_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.try_complete_loan_if_fully_paid(COALESCE(NEW.loan_id, OLD.loan_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_repayment_try_complete_loan ON public.loan_repayments;
CREATE TRIGGER trg_loan_repayment_try_complete_loan
  AFTER INSERT OR UPDATE OF status, principal_paid, penalty_paid, amount, original_amount
  ON public.loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_loan_repayment_try_complete_loan();

-- One-time backfill for loans already fully paid but still active/disbursed.
DO $$
DECLARE
  r RECORD;
  v_result jsonb;
BEGIN
  FOR r IN
    SELECT la.id
    FROM public.loan_applications la
    WHERE la.status::text IN ('active', 'disbursed')
    ORDER BY la.updated_at ASC
  LOOP
    v_result := public.try_complete_loan_if_fully_paid(r.id);
    -- no-op when not eligible; safe to run for all active/disbursed rows
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_complete_loan_if_fully_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_loan_completion(uuid) TO authenticated;
