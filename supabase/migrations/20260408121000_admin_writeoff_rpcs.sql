-- Atomic write-off approve / reject / recovery (audit + collection activity in one transaction)

CREATE OR REPLACE FUNCTION public.admin_approve_loan_writeoff(p_writeoff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  w RECORD;
  v_borrower text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write-off not found');
  END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be approved');
  END IF;

  SELECT la.full_name INTO v_borrower FROM public.loan_applications la WHERE la.id = w.loan_id;

  UPDATE public.loan_writeoffs
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = v_uid,
    updated_at = now()
  WHERE id = p_writeoff_id;

  UPDATE public.loan_applications
  SET status = 'defaulted', updated_at = now()
  WHERE id = w.loan_id;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, details, module
  ) VALUES (
    v_uid,
    'WRITEOFF_APPROVED',
    'loan_writeoff',
    p_writeoff_id,
    jsonb_build_object(
      'loan_id', w.loan_id,
      'amount', w.writeoff_amount,
      'borrower', v_borrower
    ),
    'writeoffs'
  );

  INSERT INTO public.collection_activities (
    loan_id, activity_type, notes, outcome
  ) VALUES (
    w.loan_id,
    'writeoff_approved',
    format('Write-off approved. Amount: K%s', to_char(w.writeoff_amount, 'FM999,999,999,990.00')),
    'Loan written off - marked as defaulted'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_loan_writeoff(p_writeoff_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  w RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write-off not found');
  END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be rejected');
  END IF;

  UPDATE public.loan_writeoffs
  SET
    status = 'rejected',
    recovery_notes = format('Rejected: %s', COALESCE(nullif(trim(p_reason), ''), 'no reason')),
    updated_at = now()
  WHERE id = p_writeoff_id;

  INSERT INTO public.collection_activities (
    loan_id, activity_type, notes, outcome
  ) VALUES (
    w.loan_id,
    'writeoff_rejected',
    format('Write-off rejected. Reason: %s', COALESCE(nullif(trim(p_reason), ''), 'n/a')),
    'Continue collection efforts'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_writeoff_recovery(
  p_writeoff_id uuid,
  p_amount numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  w RECORD;
  v_new_recovery numeric;
  v_line text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid recovery amount');
  END IF;

  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Write-off not found');
  END IF;
  IF w.status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recovery only for approved write-offs');
  END IF;

  v_new_recovery := COALESCE(w.recovery_amount, 0) + p_amount;
  v_line := format(E'\n[%s] Recovered K%s: %s',
    to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    to_char(p_amount, 'FM999,999,999,990.00'),
    COALESCE(nullif(trim(p_notes), ''), '')
  );

  UPDATE public.loan_writeoffs
  SET
    recovery_amount = v_new_recovery,
    recovery_notes = trim(both E'\n' from concat_ws(E'\n', COALESCE(w.recovery_notes, ''), v_line)),
    updated_at = now()
  WHERE id = p_writeoff_id;

  INSERT INTO public.collection_activities (
    loan_id, activity_type, notes, outcome
  ) VALUES (
    w.loan_id,
    'recovery_recorded',
    format('Recovery recorded: K%s. %s', to_char(p_amount, 'FM999,999,999,990.00'), COALESCE(nullif(trim(p_notes), ''), '')),
    format('Total recovered: K%s', to_char(v_new_recovery, 'FM999,999,999,990.00'))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_approve_loan_writeoff(uuid) IS 'Approve pending write-off, mark loan defaulted, audit + activity';
COMMENT ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) IS 'Reject pending write-off with reason';
COMMENT ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) IS 'Append recovery amount/notes on approved write-off';

GRANT EXECUTE ON FUNCTION public.admin_approve_loan_writeoff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) TO authenticated;
