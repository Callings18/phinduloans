-- Phase 2.2: RPC to transition loan status with permission checks
-- transition_loan_status(loan_id, action) where action in ('verify_documents', 'finance_approve', 'approve')

CREATE OR REPLACE FUNCTION public.transition_loan_status(
  p_loan_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_uid UUID := auth.uid();
  v_updated RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, status, document_verified_by, document_verified_at, finance_verified_by, finance_verified_at
    INTO v_loan
    FROM public.loan_applications
    WHERE id = p_loan_id;

  IF v_loan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loan not found');
  END IF;

  CASE p_action
    WHEN 'verify_documents' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'verify_documents') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.verify_documents');
      END IF;
      UPDATE public.loan_applications
      SET
        document_verified_by = v_uid,
        document_verified_at = now(),
        approval_stage = 'documents_verified',
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'DOCUMENTS_VERIFIED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('document_verified_by', v_uid, 'document_verified_at', now()));

    WHEN 'finance_approve' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'finance_approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.finance_approve');
      END IF;
      UPDATE public.loan_applications
      SET
        finance_verified_by = v_uid,
        finance_verified_at = now(),
        approval_stage = 'finance_approved',
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'FINANCE_APPROVED', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('finance_verified_by', v_uid, 'finance_verified_at', now()));

    WHEN 'approve' THEN
      IF NOT public.has_permission(v_uid, 'loans', 'approve') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: loans.approve');
      END IF;
      IF v_loan.document_verified_at IS NULL OR v_loan.finance_verified_at IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Both document verification and finance approval are required before final approval');
      END IF;
      UPDATE public.loan_applications
      SET
        status = 'approved',
        approval_stage = 'approved',
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
      WHERE id = p_loan_id;
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
      VALUES (v_uid, 'STATUS_UPDATE', 'loan_application', p_loan_id, 'loans',
        jsonb_build_object('status', 'approved', 'approval_stage', 'approved'));

    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid action: ' || COALESCE(p_action, ''));
  END CASE;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.transition_loan_status(UUID, TEXT) IS 'Transition loan workflow: verify_documents, finance_approve, or approve (with permission and stage checks)';
