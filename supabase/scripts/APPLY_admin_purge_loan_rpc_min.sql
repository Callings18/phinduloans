CREATE OR REPLACE FUNCTION public.admin_purge_loan_application(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_uid uuid := auth.uid();
  v_disb_ids uuid[];
  v_repay_ids uuid[];
  v_is_privileged boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  v_is_privileged :=
    public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'admin'::public.app_role);
  IF NOT (v_is_privileged OR public.has_permission(v_uid, 'loans', 'delete')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT status INTO v_status FROM public.loan_applications WHERE id = p_loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_status IN ('disbursed', 'active', 'completed', 'defaulted', 'written_off')
     AND NOT v_is_privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STATUS_BLOCKED',
      'message', format('Cannot delete loan in status %s without admin role.', v_status));
  END IF;
  SELECT array_agg(id) INTO v_disb_ids FROM public.disbursements WHERE loan_id = p_loan_id;
  SELECT array_agg(id) INTO v_repay_ids FROM public.loan_repayments WHERE loan_id = p_loan_id;
  DELETE FROM public.account_transactions
  WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'loan' AND reference_id = p_loan_id);
  BEGIN DELETE FROM public.loan_repayments WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.disbursements WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.payment_claims WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_events WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_status_transitions WHERE loan_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.application_documents WHERE application_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.loan_borrowers WHERE loan_application_id = p_loan_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  DELETE FROM public.loan_applications WHERE id = p_loan_id;
  RETURN jsonb_build_object('ok', true, 'loan_id', p_loan_id, 'previous_status', v_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_purge_loan_application(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
