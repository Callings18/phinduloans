-- Preserve money movement history when an undo or administrative deletion occurs.
-- A loan with a completed disbursement must be undone (refunded) before deletion.

CREATE OR REPLACE FUNCTION public.admin_undo_loan_disbursement(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_loan record;
  v_disb record;
  v_src record;
  v_refund numeric := 0;
  v_new_balance numeric;
  v_has_payments boolean;
  v_allowed boolean;
  v_schedule_count integer := 0;
  v_schedule_amount numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  v_allowed := public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_permission(v_uid, 'disbursement', 'manage')
    OR public.has_permission(v_uid, 'disbursement', 'approve')
    OR public.has_permission(v_uid, 'house', 'disbursement_disburse')
    OR public.has_permission(v_uid, 'loans', 'delete');
  IF NOT v_allowed THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;

  SELECT id, status, loan_amount, total_repayment, user_id
  INTO v_loan FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_loan.status NOT IN ('active', 'disbursed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'message', format('Undo is only valid for active or disbursed loans (current: %s).', v_loan.status));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.loan_repayments lr WHERE lr.loan_id = p_loan_id
      AND COALESCE(lr.is_reversed, false) = false
      AND (lr.status IN ('paid', 'partial') OR COALESCE(lr.principal_paid, 0) > 0 OR COALESCE(lr.penalty_paid, 0) > 0)
  ) INTO v_has_payments;
  IF v_has_payments THEN RETURN jsonb_build_object('ok', false, 'error', 'PAYMENTS_RECORDED', 'message', 'Reverse recorded borrower payments before undoing this disbursement.'); END IF;

  SELECT count(*), COALESCE(sum(amount), 0) INTO v_schedule_count, v_schedule_amount
  FROM public.loan_repayments WHERE loan_id = p_loan_id;
  SELECT * INTO v_disb FROM public.disbursements WHERE loan_id = p_loan_id AND status = 'completed' ORDER BY disbursed_at DESC NULLS LAST LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'DISBURSEMENT_NOT_FOUND'); END IF;

  IF v_disb.source_account_id IS NOT NULL THEN
    SELECT id, balance, account_name INTO v_src FROM public.accounts WHERE id = v_disb.source_account_id FOR UPDATE;
    IF FOUND THEN
      v_refund := COALESCE(v_disb.amount, 0)::numeric;
      v_new_balance := COALESCE(v_src.balance, 0) + v_refund;
      UPDATE public.accounts SET balance = v_new_balance, updated_at = now() WHERE id = v_src.id;
      INSERT INTO public.account_transactions (account_id, transaction_type, amount, balance_before, balance_after,
        reference_type, reference_id, source, destination, notes, created_by)
      VALUES (v_src.id, 'refund', v_refund, v_src.balance, v_new_balance, 'disbursement_reversal', p_loan_id,
        'Disbursement Reversal', v_src.account_name, format('Undo disbursement — loan %s', p_loan_id), v_uid);
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'SOURCE_ACCOUNT_NOT_FOUND', 'message', 'The source account is missing; no refund was posted.');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'SOURCE_ACCOUNT_NOT_FOUND', 'message', 'The disbursement has no source account; no refund was posted.');
  END IF;

  -- Keep the original disbursement and ledger transaction as immutable history.
  UPDATE public.disbursements SET status = 'reversed' WHERE id = v_disb.id;
  DELETE FROM public.loan_repayments WHERE loan_id = p_loan_id;
  UPDATE public.loan_applications SET status = 'approved', updated_at = now() WHERE id = p_loan_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, module)
  VALUES (v_uid, 'UNDO_DISBURSEMENT', 'loan_application', p_loan_id,
    jsonb_build_object('previous_status', v_loan.status, 'new_status', 'approved',
      'disbursement_id', v_disb.id, 'gross_disbursed_amount', v_disb.amount,
      'refunded_amount', v_refund, 'source_account_id', v_disb.source_account_id,
      'schedule_rows_removed', v_schedule_count, 'scheduled_amount_removed', v_schedule_amount), 'disbursement');

  RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'previous_status', v_loan.status,
    'new_status', 'approved', 'refunded_amount', v_refund,
    'schedule_rows_removed', v_schedule_count, 'scheduled_amount_removed', v_schedule_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'UNDO_FAILED', 'message', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_undo_loan_disbursement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_purge_loan_application(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_uid uuid := auth.uid();
  v_disb_ids uuid[];
  v_repay_ids uuid[];
  v_is_privileged boolean;
  v_disbursed numeric;
  v_completed_disbursed numeric;
  v_recovered numeric;
  v_outstanding numeric;
  v_disb_count integer;
  v_repay_count integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  v_is_privileged := public.has_role(v_uid, 'super_admin'::public.app_role) OR public.has_role(v_uid, 'admin'::public.app_role);
  IF NOT (v_is_privileged OR public.has_permission(v_uid, 'loans', 'delete')) THEN RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN'); END IF;

  SELECT id, status, user_id, full_name, phone, loan_amount, total_repayment, loan_product_id, created_at
  INTO v_loan FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF v_loan.status IN ('disbursed', 'active', 'completed', 'defaulted', 'written_off') AND NOT v_is_privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STATUS_BLOCKED', 'message', format('Cannot delete loan in status %s without admin role.', v_loan.status));
  END IF;

  SELECT count(*), COALESCE(sum(amount) FILTER (WHERE status IN ('completed', 'reversed')), 0),
    COALESCE(sum(amount) FILTER (WHERE status = 'completed'), 0)
    INTO v_disb_count, v_disbursed, v_completed_disbursed FROM public.disbursements WHERE loan_id = p_loan_id;
  IF v_completed_disbursed > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DISBURSEMENT_MUST_BE_UNDONE',
      'message', 'Undo and refund the disbursement before deleting this loan. A paid loan cannot be erased from the ledger.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.loan_repayments WHERE loan_id = p_loan_id AND
    (status IN ('paid', 'partial') OR COALESCE(principal_paid, 0) > 0 OR COALESCE(penalty_paid, 0) > 0)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENTS_RECORDED', 'message', 'A loan with recorded payments cannot be deleted.');
  END IF;

  SELECT count(*), COALESCE(sum(amount), 0) INTO v_repay_count, v_outstanding FROM public.loan_repayments WHERE loan_id = p_loan_id;
  v_recovered := 0;
  SELECT array_agg(id) INTO v_disb_ids FROM public.disbursements WHERE loan_id = p_loan_id;
  SELECT array_agg(id) INTO v_repay_ids FROM public.loan_repayments WHERE loan_id = p_loan_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, module)
  VALUES (v_uid, 'LOAN_DELETED', 'loan_application', p_loan_id,
    jsonb_build_object('loan_id', p_loan_id, 'borrower_id', v_loan.user_id, 'borrower_name', v_loan.full_name,
      'phone', v_loan.phone, 'previous_status', v_loan.status, 'loan_amount', v_loan.loan_amount,
      'total_repayment', v_loan.total_repayment, 'loan_product_id', v_loan.loan_product_id,
      'created_at', v_loan.created_at, 'disbursement_count', v_disb_count,
      'gross_disbursed_amount', v_disbursed, 'amount_refunded', 0,
      'repayment_schedule_rows_removed', v_repay_count, 'scheduled_amount_removed', v_outstanding,
      'amount_recovered', v_recovered), 'loans');

  DELETE FROM public.account_transactions
  WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'loan' AND reference_id = p_loan_id);
  BEGIN DELETE FROM public.loan_repayments_history WHERE loan_id = p_loan_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.loan_repayments WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.disbursements WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.payment_claims WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_events WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_status_transitions WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.application_documents WHERE application_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_borrowers WHERE loan_application_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_notes WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_documents WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_collateral WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_reviews WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_assignments WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.notifications WHERE related_loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.approval_workflow_steps WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  DELETE FROM public.loan_applications WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'previous_status', v_loan.status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_purge_loan_application(uuid) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;
  END IF;
END $$;
