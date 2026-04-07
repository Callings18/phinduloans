DROP FUNCTION IF EXISTS public.transition_loan_status(uuid, text);

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
BEGIN
  SELECT * INTO v_loan
  FROM public.loan_applications
  WHERE id = p_loan_id
  FOR UPDATE;

  IF v_loan IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan not found');
  END IF;

  v_prev_status := v_loan.status::text;

  IF p_action = 'verify_documents' THEN
    IF NOT public.has_permission(v_user_id, 'loans', 'verify_documents') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
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
      RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
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
      RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.loan_applications
    SET status = 'approved',
        approved_by = v_user_id,
        approved_at = now(),
        reviewed_by = v_user_id,
        reviewed_at = now(),
        approval_stage = 'approved',
        admin_signed = true,
        admin_signed_at = now(),
        admin_signed_by = v_user_id,
        borrower_signed = true,
        borrower_signed_at = now(),
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
      RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
    END IF;

    UPDATE public.loan_applications
    SET status = 'rejected',
        rejection_reason = COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided'),
        reviewed_by = v_user_id,
        reviewed_at = now(),
        approval_stage = 'rejected',
        updated_at = now()
    WHERE id = p_loan_id;

    v_new_stage := 'rejected';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown action: ' || p_action);
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

  RETURN jsonb_build_object('ok', true, 'stage', v_new_stage);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) TO authenticated;