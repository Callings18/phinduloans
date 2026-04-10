-- Restore transition_loan_status: workflow stages (verify, finance, approve, reject)
-- plus lifecycle actions (disburse, activate, complete, default). Replaces the
-- simplified 20260408205053 version that dropped verify_documents/finance_approve.

CREATE OR REPLACE FUNCTION public.transition_loan_status(
  p_loan_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_user_id uuid := auth.uid();
  v_new_stage text;
  v_prev_status text;
  v_new_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_loan
  FROM public.loan_applications
  WHERE id = p_loan_id
  FOR UPDATE;

  IF v_loan IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Loan not found');
  END IF;

  v_prev_status := v_loan.status::text;

  IF p_action = 'verify_documents' THEN
    IF NOT public.has_permission(v_user_id, 'loans', 'verify_documents') THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.loan_applications
    SET document_verified_by = v_user_id,
        document_verified_at = now(),
        approval_stage = 'documents_verified',
        updated_at = now()
    WHERE id = p_loan_id;

    v_new_stage := 'documents_verified';

  ELSIF p_action = 'finance_approve' THEN
    IF NOT public.has_permission(v_user_id, 'loans', 'finance_approve') THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.loan_applications
    SET finance_verified_by = v_user_id,
        finance_verified_at = now(),
        approval_stage = 'finance_approved',
        updated_at = now()
    WHERE id = p_loan_id;

    v_new_stage := 'finance_approved';

  ELSIF p_action = 'approve' THEN
    IF NOT (
      public.has_permission(v_user_id, 'loans', 'approve')
      OR public.has_permission(v_user_id, 'loans', 'finance_approve')
      OR public.has_role(v_user_id, 'admin'::public.app_role)
      OR public.has_role(v_user_id, 'super_admin'::public.app_role)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.loan_applications
    SET status = 'approved'::public.loan_status,
        approved_by = v_user_id,
        approved_at = now(),
        reviewed_by = v_user_id,
        reviewed_at = now(),
        approval_stage = 'approved',
        admin_signed = true,
        admin_signed_at = now(),
        admin_signed_by = v_user_id,
        updated_at = now()
    WHERE id = p_loan_id;

    v_new_stage := 'approved';

  ELSIF p_action = 'reject' THEN
    IF NOT (
      public.has_permission(v_user_id, 'loans', 'approve')
      OR public.has_permission(v_user_id, 'loans', 'finance_approve')
      OR public.has_role(v_user_id, 'admin'::public.app_role)
      OR public.has_role(v_user_id, 'super_admin'::public.app_role)
    ) THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.loan_applications
    SET status = 'rejected'::public.loan_status,
        rejection_reason = COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided'),
        reviewed_by = v_user_id,
        reviewed_at = now(),
        approval_stage = 'rejected',
        updated_at = now()
    WHERE id = p_loan_id;

    v_new_stage := 'rejected';

  ELSIF p_action = 'disburse' THEN
    IF v_prev_status NOT IN ('approved', 'awaiting_disbursement', 'contract_signing') THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot disburse loan in status: ' || v_prev_status);
    END IF;

    v_new_status := 'disbursed';

    UPDATE public.loan_applications
    SET status = v_new_status::public.loan_status,
        disbursed_at = now(),
        disbursed_by = v_user_id,
        updated_at = now()
    WHERE id = p_loan_id;

    INSERT INTO public.loan_status_transitions (
      loan_id, from_status, to_status, actor_type, actor_id, reason_text
    ) VALUES (
      p_loan_id, v_prev_status, v_new_status, 'admin', v_user_id, p_reason
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
    VALUES (
      v_user_id, 'STATUS_TRANSITION', 'loan_application', p_loan_id, 'loans',
      jsonb_build_object('status', v_prev_status),
      jsonb_build_object('status', v_new_status, 'action', p_action)
    );

    RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_status);

  ELSIF p_action = 'activate' THEN
    IF v_prev_status <> 'disbursed' THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot activate loan in status: ' || v_prev_status);
    END IF;

    v_new_status := 'active';

    UPDATE public.loan_applications
    SET status = v_new_status::public.loan_status,
        updated_at = now()
    WHERE id = p_loan_id;

    INSERT INTO public.loan_status_transitions (
      loan_id, from_status, to_status, actor_type, actor_id, reason_text
    ) VALUES (
      p_loan_id, v_prev_status, v_new_status, 'admin', v_user_id, p_reason
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
    VALUES (
      v_user_id, 'STATUS_TRANSITION', 'loan_application', p_loan_id, 'loans',
      jsonb_build_object('status', v_prev_status),
      jsonb_build_object('status', v_new_status, 'action', p_action)
    );

    RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_status);

  ELSIF p_action = 'complete' THEN
    IF v_prev_status <> 'active' THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot complete loan in status: ' || v_prev_status);
    END IF;

    v_new_status := 'completed';

    UPDATE public.loan_applications
    SET status = v_new_status::public.loan_status,
        updated_at = now()
    WHERE id = p_loan_id;

    INSERT INTO public.loan_status_transitions (
      loan_id, from_status, to_status, actor_type, actor_id, reason_text
    ) VALUES (
      p_loan_id, v_prev_status, v_new_status, 'admin', v_user_id, p_reason
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
    VALUES (
      v_user_id, 'STATUS_TRANSITION', 'loan_application', p_loan_id, 'loans',
      jsonb_build_object('status', v_prev_status),
      jsonb_build_object('status', v_new_status, 'action', p_action)
    );

    RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_status);

  ELSIF p_action = 'default' THEN
    IF v_prev_status NOT IN ('active', 'disbursed') THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Cannot default loan in status: ' || v_prev_status);
    END IF;
    IF p_reason IS NULL OR p_reason = '' THEN
      RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'A reason is required to mark a loan as defaulted');
    END IF;

    v_new_status := 'defaulted';

    UPDATE public.loan_applications
    SET status = v_new_status::public.loan_status,
        defaulted_at = now(),
        updated_at = now()
    WHERE id = p_loan_id;

    INSERT INTO public.loan_status_transitions (
      loan_id, from_status, to_status, actor_type, actor_id, reason_text
    ) VALUES (
      p_loan_id, v_prev_status, v_new_status, 'admin', v_user_id, p_reason
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, old_values, new_values)
    VALUES (
      v_user_id, 'STATUS_TRANSITION', 'loan_application', p_loan_id, 'loans',
      jsonb_build_object('status', v_prev_status),
      jsonb_build_object('status', v_new_status, 'action', p_action, 'reason', p_reason)
    );

    RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_status);

  ELSE
    RETURN jsonb_build_object('ok', false, 'success', false, 'error', 'Unknown action: ' || p_action);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (
    v_user_id,
    p_action,
    'loan_application',
    p_loan_id,
    'loans',
    jsonb_build_object('approval_stage', v_new_stage, 'previous_status', v_prev_status)
  );

  RETURN jsonb_build_object('ok', true, 'success', true, 'stage', v_new_stage);
END;
$$;

COMMENT ON FUNCTION public.transition_loan_status(uuid, text, text) IS
  'Workflow: verify_documents, finance_approve, approve, reject. Lifecycle: disburse, activate, complete, default.';

GRANT EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) TO authenticated;
