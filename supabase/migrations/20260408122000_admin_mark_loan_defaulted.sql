-- Mark active/disbursed loan as defaulted (audited, single transaction)

CREATE OR REPLACE FUNCTION public.admin_mark_loan_defaulted(
  p_loan_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  la RECORD;
  v_prev_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'loans', 'edit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required (min 3 characters)');
  END IF;

  SELECT id, status INTO la FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  v_prev_status := la.status::text;
  IF la.status::text NOT IN ('active', 'disbursed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only active or disbursed loans can be marked defaulted');
  END IF;

  UPDATE public.loan_applications
  SET status = 'defaulted', updated_at = now()
  WHERE id = p_loan_id;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, module, details
  ) VALUES (
    v_uid,
    'MOVE_TO_DEFAULTED',
    'loan_application',
    p_loan_id,
    'loans',
    jsonb_build_object('reason', trim(p_reason), 'previous_status', v_prev_status)
  );

  INSERT INTO public.loan_events (
    loan_id, event_type, performed_by, reason, previous_values, new_values
  ) VALUES (
    p_loan_id,
    'manual_default',
    v_uid,
    trim(p_reason),
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object('status', 'defaulted')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) IS 'Move loan to defaulted with reason; audit + loan_events';

GRANT EXECUTE ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) TO authenticated;
