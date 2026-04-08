CREATE OR REPLACE FUNCTION public.transition_loan_status(p_loan_id uuid, p_action text, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_new_status TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT status::text INTO v_current_status
  FROM public.loan_applications
  WHERE id = p_loan_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Loan application not found: %', p_loan_id;
  END IF;

  CASE p_action
    WHEN 'approve' THEN
      IF v_current_status NOT IN ('pending', 'under_review', 'crb_failed', 'pmic_pending') THEN
        RAISE EXCEPTION 'Cannot approve loan in status: %', v_current_status;
      END IF;
      v_new_status := 'awaiting_disbursement';
    WHEN 'reject' THEN
      IF v_current_status NOT IN ('pending', 'under_review', 'approved', 'awaiting_disbursement', 'crb_failed', 'pmic_pending') THEN
        RAISE EXCEPTION 'Cannot reject loan in status: %', v_current_status;
      END IF;
      v_new_status := 'rejected';
    WHEN 'disburse' THEN
      IF v_current_status NOT IN ('approved', 'awaiting_disbursement', 'contract_signing') THEN
        RAISE EXCEPTION 'Cannot disburse loan in status: %', v_current_status;
      END IF;
      v_new_status := 'disbursed';
    WHEN 'activate' THEN
      IF v_current_status NOT IN ('disbursed') THEN
        RAISE EXCEPTION 'Cannot activate loan in status: %', v_current_status;
      END IF;
      v_new_status := 'active';
    WHEN 'complete' THEN
      IF v_current_status NOT IN ('active') THEN
        RAISE EXCEPTION 'Cannot complete loan in status: %', v_current_status;
      END IF;
      v_new_status := 'completed';
    WHEN 'default' THEN
      IF v_current_status NOT IN ('active', 'disbursed') THEN
        RAISE EXCEPTION 'Cannot default loan in status: %', v_current_status;
      END IF;
      IF p_reason IS NULL OR p_reason = '' THEN
        RAISE EXCEPTION 'A reason is required to mark a loan as defaulted';
      END IF;
      v_new_status := 'defaulted';
    ELSE
      RAISE EXCEPTION 'Unknown action: %', p_action;
  END CASE;

  UPDATE public.loan_applications
  SET status = v_new_status::loan_status,
      approved_at = CASE WHEN p_action = 'approve' THEN NOW() ELSE approved_at END,
      approved_by = CASE WHEN p_action = 'approve' THEN v_user_id ELSE approved_by END,
      disbursed_at = CASE WHEN p_action = 'disburse' THEN NOW() ELSE disbursed_at END,
      disbursed_by = CASE WHEN p_action = 'disburse' THEN v_user_id ELSE disbursed_by END,
      rejection_reason = CASE WHEN p_action = 'reject' THEN p_reason ELSE rejection_reason END,
      defaulted_at = CASE WHEN p_action = 'default' THEN NOW() ELSE defaulted_at END,
      updated_at = NOW()
  WHERE id = p_loan_id;

  INSERT INTO public.loan_status_transitions (
    loan_id,
    from_status,
    to_status,
    actor_type,
    actor_id,
    reason_text
  )
  VALUES (
    p_loan_id,
    v_current_status,
    v_new_status,
    'admin',
    v_user_id,
    p_reason
  );

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
  VALUES (
    v_user_id,
    'STATUS_TRANSITION',
    'loan_application',
    p_loan_id,
    'loans',
    jsonb_build_object('status', v_current_status),
    jsonb_build_object('status', v_new_status, 'action', p_action, 'reason', p_reason)
  );
END;
$function$;