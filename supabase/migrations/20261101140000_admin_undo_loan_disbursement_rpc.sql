-- Atomic Undo Disbursement (mistaken disbursement → back to approved).
-- Not the same as write-off (unrecoverable debt). Works for active/disbursed with zero payments.

CREATE OR REPLACE FUNCTION public.admin_undo_loan_disbursement(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_disb record;
  v_src record;
  v_refund numeric;
  v_new_balance numeric;
  v_has_payments boolean;
  v_has_disb boolean := false;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  v_allowed :=
    public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_permission(v_uid, 'disbursement', 'manage')
    OR public.has_permission(v_uid, 'disbursement', 'approve')
    OR public.has_permission(v_uid, 'house', 'disbursement_disburse')
    OR public.has_permission(v_uid, 'loans', 'delete');

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN', 'message', 'You do not have permission to undo disbursements.');
  END IF;

  SELECT status INTO v_status FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_status NOT IN ('active', 'disbursed') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'INVALID_STATUS',
      'message',
      format('Undo disbursement is only for active or disbursed loans (current: %s).', v_status)
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.loan_repayments lr
    WHERE lr.loan_id = p_loan_id
      AND COALESCE(lr.is_reversed, false) = false
      AND (
        lr.status IN ('paid', 'partial')
        OR COALESCE(lr.principal_paid, 0) > 0
        OR COALESCE(lr.penalty_paid, 0) > 0
      )
  ) INTO v_has_payments;

  IF v_has_payments THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'PAYMENTS_RECORDED',
      'message',
      'Reverse or remove recorded payments before undoing disbursement.'
    );
  END IF;

  SELECT * INTO v_disb FROM public.disbursements WHERE loan_id = p_loan_id LIMIT 1;
  v_has_disb := FOUND;

  IF v_has_disb AND v_disb.source_account_id IS NOT NULL THEN
    SELECT id, balance, account_name INTO v_src
    FROM public.accounts
    WHERE id = v_disb.source_account_id
    FOR UPDATE;

    IF FOUND THEN
      v_refund := COALESCE(v_disb.amount, 0)::numeric;
      v_new_balance := COALESCE(v_src.balance, 0) + v_refund;

      UPDATE public.accounts
      SET balance = v_new_balance, updated_at = now()
      WHERE id = v_src.id;

      INSERT INTO public.account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        source,
        destination,
        notes,
        created_by
      ) VALUES (
        v_src.id,
        'refund',
        v_refund,
        v_src.balance,
        v_new_balance,
        'disbursement_reversal',
        p_loan_id,
        'Disbursement Reversal',
        v_src.account_name,
        format('Undo disbursement — loan %s', p_loan_id),
        v_uid
      );
    END IF;
  END IF;

  IF v_has_disb THEN
    DELETE FROM public.account_transactions
    WHERE reference_type = 'disbursement' AND reference_id = v_disb.id;
  END IF;

  DELETE FROM public.loan_repayments WHERE loan_id = p_loan_id;
  DELETE FROM public.disbursements WHERE loan_id = p_loan_id;

  UPDATE public.loan_applications
  SET status = 'approved', updated_at = now()
  WHERE id = p_loan_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, module)
  VALUES (
    v_uid,
    'UNDO_DISBURSEMENT',
    'loan_application',
    p_loan_id,
    jsonb_build_object(
      'previous_status', v_status,
      'refunded_amount', CASE WHEN v_has_disb THEN v_disb.amount ELSE NULL END,
      'source_account_id', CASE WHEN v_has_disb THEN v_disb.source_account_id ELSE NULL END
    ),
    'disbursement'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', p_loan_id,
    'previous_status', v_status,
    'new_status', 'approved'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNDO_FAILED', 'message', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.admin_undo_loan_disbursement(uuid) IS
  'Revert mistaken disbursement to approved: refund source account, remove schedule/disbursement rows. Not write-off.';

GRANT EXECUTE ON FUNCTION public.admin_undo_loan_disbursement(uuid) TO authenticated;
