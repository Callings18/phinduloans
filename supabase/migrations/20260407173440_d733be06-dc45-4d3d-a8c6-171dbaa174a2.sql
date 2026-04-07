-- Fix: Allow pending -> approved directly (simplified admin workflow)
CREATE OR REPLACE FUNCTION public.enforce_loan_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('under_review', 'approved', 'rejected', 'crb_failed', 'pmic_pending') THEN
    RETURN NEW;
  ELSIF OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected', 'crb_failed', 'pmic_pending', 'contract_signing') THEN
    RETURN NEW;
  ELSIF OLD.status = 'approved' AND NEW.status IN ('contract_signing', 'awaiting_disbursement', 'disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'contract_signing' AND NEW.status IN ('awaiting_disbursement', 'disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'awaiting_disbursement' AND NEW.status IN ('disbursed', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'disbursed' AND NEW.status IN ('active', 'completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status IN ('completed', 'defaulted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'defaulted' AND NEW.status = 'completed' THEN
    RETURN NEW;
  ELSIF OLD.status = 'crb_failed' AND NEW.status IN ('under_review', 'approved', 'rejected') THEN
    RETURN NEW;
  ELSIF OLD.status = 'pmic_pending' AND NEW.status IN ('under_review', 'approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid loan_applications status transition: % -> %', OLD.status, NEW.status;
END;
$$;

-- Fix the transition_loan_status RPC to handle approve/reject with full field updates
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
DECLARE v_loan RECORD; v_user_id UUID := auth.uid(); v_new_stage TEXT; v_prev_status TEXT;
BEGIN
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  IF v_loan IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Loan not found'); END IF;
  v_prev_status := v_loan.status::text;

  IF p_action = 'verify_documents' THEN
    IF NOT has_permission(v_user_id, 'loans', 'verify_documents') THEN RETURN jsonb_build_object('ok', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET document_verified_by = v_user_id, document_verified_at = now(), approval_stage = 'documents_verified', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'documents_verified';
  ELSIF p_action = 'finance_approve' THEN
    IF NOT has_permission(v_user_id, 'loans', 'finance_approve') THEN RETURN jsonb_build_object('ok', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET finance_verified_by = v_user_id, finance_verified_at = now(), approval_stage = 'finance_approved', updated_at = now() WHERE id = p_loan_id;
    v_new_stage := 'finance_approved';
  ELSIF p_action = 'approve' THEN
    IF NOT has_permission(v_user_id, 'loans', 'approve') THEN RETURN jsonb_build_object('ok', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET
      status = 'approved',
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
    IF NOT has_permission(v_user_id, 'loans', 'approve') THEN RETURN jsonb_build_object('ok', false, 'error', 'Permission denied'); END IF;
    UPDATE public.loan_applications SET
      status = 'rejected',
      rejection_reason = COALESCE(p_reason, 'No reason provided'),
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
  VALUES (v_user_id, p_action, 'loan_application', p_loan_id, 'loans', jsonb_build_object('approval_stage', v_new_stage, 'previous_status', v_prev_status));

  RETURN jsonb_build_object('ok', true, 'stage', v_new_stage);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) TO authenticated;