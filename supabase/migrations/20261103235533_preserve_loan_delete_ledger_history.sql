-- Preserve account transaction history when a loan record is deleted. A prior
-- undo is represented by its original disbursement and refund rows, and the
-- deletion audit must report the actual refund total.
CREATE OR REPLACE FUNCTION public.admin_purge_loan_application(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan record;
  v_uid uuid := auth.uid();
  v_is_privileged boolean;
  v_disbursed numeric := 0;
  v_completed_disbursed numeric := 0;
  v_refunded numeric := 0;
  v_recovered numeric := 0;
  v_outstanding numeric := 0;
  v_disb_count integer := 0;
  v_repay_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED'); END IF;
  v_is_privileged := public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role);
  IF NOT (v_is_privileged OR public.has_permission(v_uid, 'loans', 'delete')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT id, status, user_id, full_name, phone, loan_amount, total_repayment,
    loan_product_id, created_at
  INTO v_loan
  FROM public.loan_applications
  WHERE id = p_loan_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;

  IF v_loan.status IN ('disbursed', 'active', 'completed', 'defaulted', 'written_off')
    AND NOT v_is_privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STATUS_BLOCKED',
      'message', format('Cannot delete loan in status %s without admin role.', v_loan.status));
  END IF;

  SELECT count(*),
    COALESCE(sum(amount) FILTER (WHERE status IN ('completed', 'reversed')), 0),
    COALESCE(sum(amount) FILTER (WHERE status = 'completed'), 0)
  INTO v_disb_count, v_disbursed, v_completed_disbursed
  FROM public.disbursements
  WHERE loan_id = p_loan_id;
  IF v_completed_disbursed > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DISBURSEMENT_MUST_BE_UNDONE',
      'message', 'Undo and refund the disbursement before deleting this loan. A paid loan cannot be erased from the ledger.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loan_repayments
    WHERE loan_id = p_loan_id
      AND (status IN ('paid', 'partial') OR COALESCE(principal_paid, 0) > 0 OR COALESCE(penalty_paid, 0) > 0)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PAYMENTS_RECORDED',
      'message', 'A loan with recorded payments cannot be deleted.');
  END IF;

  SELECT count(*), COALESCE(sum(amount), 0)
  INTO v_repay_count, v_outstanding
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id;

  SELECT COALESCE(sum(amount), 0)
  INTO v_refunded
  FROM public.account_transactions
  WHERE transaction_type = 'refund'
    AND reference_type = 'disbursement_reversal'
    AND reference_id = p_loan_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, module)
  VALUES (v_uid, 'LOAN_DELETED', 'loan_application', p_loan_id,
    jsonb_build_object(
      'loan_id', p_loan_id,
      'borrower_id', v_loan.user_id,
      'borrower_name', v_loan.full_name,
      'phone', v_loan.phone,
      'previous_status', v_loan.status,
      'loan_amount', v_loan.loan_amount,
      'total_repayment', v_loan.total_repayment,
      'loan_product_id', v_loan.loan_product_id,
      'created_at', v_loan.created_at,
      'disbursement_count', v_disb_count,
      'gross_disbursed_amount', v_disbursed,
      'amount_refunded', v_refunded,
      'repayment_schedule_rows_removed', v_repay_count,
      'scheduled_amount_removed', v_outstanding,
      'amount_recovered', v_recovered
    ), 'loans');

  -- Account transactions are immutable financial history and intentionally
  -- remain queryable after the loan/application row is removed.
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
  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', p_loan_id,
    'previous_status', v_loan.status,
    'gross_disbursed_amount', v_disbursed,
    'amount_refunded', v_refunded,
    'scheduled_amount_removed', v_outstanding
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_loan_application(uuid) TO authenticated;
