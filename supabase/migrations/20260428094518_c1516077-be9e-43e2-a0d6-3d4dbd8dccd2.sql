
-- ============================================================================
-- P0.1: Lock audit_logs writes — remove open INSERT policy.
-- SECURITY DEFINER functions write as the table owner (postgres) and bypass RLS,
-- so existing trigger/RPC writes continue to work.
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

-- ============================================================================
-- P0.2: Revoke PUBLIC EXECUTE on sensitive RPCs and grant to authenticated only.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.complete_disbursement(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_loan_writeoff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_disbursement(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_loan_defaulted(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_loan_writeoff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_loan_writeoff(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_writeoff_recovery(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_loan_status(uuid, text, text) TO authenticated;

-- ============================================================================
-- P0.3: Helper to record PERMISSION_DENIED audit rows from inside SECURITY DEFINER RPCs.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_permission_denied(
  p_module text,
  p_required_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, details)
  VALUES (
    auth.uid(),
    'PERMISSION_DENIED',
    p_entity_type,
    p_entity_id,
    p_module,
    jsonb_build_object(
      'required_action', p_required_action,
      'attempted_at', now()
    ) || COALESCE(p_extra, '{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_permission_denied(text, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_permission_denied(text, text, text, uuid, jsonb) TO authenticated;

-- ============================================================================
-- P0.3 (cont): Patch sensitive RPCs to write PERMISSION_DENIED rows on rejection.
-- Bodies are reproduced from current definitions with a denial-audit insert
-- added to every authorization failure branch.
-- ============================================================================

-- record_loan_payment ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_loan_payment(
  p_repayment_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash'::text,
  p_account_id uuid DEFAULT NULL::uuid,
  p_transaction_reference text DEFAULT NULL::text,
  p_paid_date date DEFAULT NULL::date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_repayment RECORD;
  v_loan RECORD;
  v_account RECORD;
  v_new_balance numeric;
  v_total_paid numeric;
  v_total_due numeric;
  v_remaining numeric;
  v_all_paid boolean;
  v_receipt_no text;
  v_paid_date date := COALESCE(p_paid_date, CURRENT_DATE);
  v_base_due numeric;
  v_already_paid numeric;
  v_outstanding numeric;
  v_new_principal_paid numeric;
  v_fully_paid boolean;
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (
    has_role(v_uid, 'admin'::app_role)
    OR has_role(v_uid, 'super_admin'::app_role)
    OR has_role(v_uid, 'loan_officer'::app_role)
    OR has_role(v_uid, 'finance_officer'::app_role)
    OR has_role(v_uid, 'collections_officer'::app_role)
  ) THEN
    PERFORM public.log_permission_denied(
      'collections', 'repayments.record', 'repayment', p_repayment_id,
      jsonb_build_object('rpc', 'record_loan_payment', 'amount', p_amount)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment amount');
  END IF;

  IF v_paid_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment date cannot be in the future');
  END IF;

  SELECT * INTO v_repayment FROM public.loan_repayments WHERE id = p_repayment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment not found');
  END IF;
  IF v_repayment.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paid');
  END IF;
  IF v_repayment.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment is cancelled');
  END IF;

  v_base_due       := COALESCE(v_repayment.original_amount, v_repayment.amount, 0);
  v_already_paid   := COALESCE(v_repayment.principal_paid, 0);
  v_outstanding    := GREATEST(v_base_due - v_already_paid, 0);

  IF v_outstanding <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Installment already settled');
  END IF;

  IF p_amount > v_outstanding + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Payment exceeds outstanding amount (%s). Use a smaller amount or split across installments.',
        to_char(v_outstanding, 'FM999,999,999,990.00'))
    );
  END IF;

  v_new_principal_paid := v_already_paid + p_amount;
  v_fully_paid := v_new_principal_paid >= v_base_due - 0.01;
  v_new_status := CASE WHEN v_fully_paid THEN 'paid' ELSE 'partial' END;

  SELECT * INTO v_loan FROM public.loan_applications WHERE id = v_repayment.loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  v_receipt_no := 'RCP-' || LPAD(EXTRACT(EPOCH FROM now())::bigint::text, 12, '0');

  UPDATE public.loan_repayments
  SET status = v_new_status,
      paid_date = CASE WHEN v_fully_paid THEN v_paid_date ELSE paid_date END,
      principal_paid = v_new_principal_paid,
      payment_method = p_payment_method,
      transaction_reference = COALESCE(p_transaction_reference, v_receipt_no),
      updated_at = now()
  WHERE id = p_repayment_id;

  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id FOR UPDATE;
    IF FOUND THEN
      v_new_balance := v_account.balance + p_amount;
      UPDATE public.accounts SET balance = v_new_balance, updated_at = now() WHERE id = p_account_id;
      INSERT INTO public.account_transactions (
        account_id, transaction_type, amount, balance_before, balance_after,
        source, reference_type, reference_id, notes
      ) VALUES (
        p_account_id, 'repayment', p_amount, v_account.balance, v_new_balance,
        v_loan.full_name, 'repayment', p_repayment_id,
        format('Loan repayment from %s - Installment #%s (%s, paid %s)',
               v_loan.full_name, v_repayment.installment_number, v_new_status, v_paid_date)
      );
    END IF;
  END IF;

  SELECT COALESCE(SUM(COALESCE(principal_paid, CASE WHEN status='paid' THEN amount ELSE 0 END)), 0)
    INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = v_loan.id;

  v_total_due := COALESCE(v_loan.total_repayment, v_loan.loan_amount);
  v_remaining := GREATEST(v_total_due - v_total_paid, 0);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending', 'overdue', 'partial')
      AND COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0) > 0.01
  ) INTO v_all_paid;

  IF v_all_paid AND v_loan.status::text NOT IN ('completed', 'defaulted', 'rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PAYMENT_RECORDED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'amount', p_amount, 'payment_method', p_payment_method,
      'receipt_no', v_receipt_no, 'installment', v_repayment.installment_number,
      'borrower', v_loan.full_name, 'loan_id', v_loan.id, 'paid_date', v_paid_date,
      'new_status', v_new_status, 'principal_paid_total', v_new_principal_paid
    ));

  RETURN jsonb_build_object(
    'success', true,
    'receipt_no', v_receipt_no,
    'installment_status', v_new_status,
    'borrower_name', v_loan.full_name,
    'borrower_phone', v_loan.phone,
    'borrower_email', v_loan.email,
    'loan_id', v_loan.id,
    'loan_amount', v_loan.loan_amount,
    'repayment_amount', p_amount,
    'payment_method', p_payment_method,
    'paid_date', v_paid_date,
    'installment_number', v_repayment.installment_number,
    'installment_outstanding', GREATEST(v_base_due - v_new_principal_paid, 0),
    'total_installments', (SELECT COUNT(*) FROM public.loan_repayments WHERE loan_id = v_loan.id),
    'total_paid', v_total_paid,
    'outstanding_balance', v_remaining,
    'loan_completed', v_all_paid
  );
END;
$function$;

-- complete_disbursement -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_disbursement(
  p_disbursement_id uuid,
  p_account_id uuid,
  p_transaction_reference text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_disb RECORD;
  v_account RECORD;
  v_loan RECORD;
  v_product RECORD;
  v_new_balance numeric;
  v_ref text;
  v_fee_percent numeric := 0;
  v_fee_mode text := 'none';
  v_fee_amount numeric := 0;
  v_net_to_borrower numeric;
  v_prev_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT (
    public.has_permission(v_uid, 'disbursement', 'approve')
    OR public.has_permission(v_uid, 'disbursement', 'manage')
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'finance_officer'::public.app_role)
  ) THEN
    PERFORM public.log_permission_denied(
      'disbursement', 'disbursement.approve', 'disbursement', p_disbursement_id,
      jsonb_build_object('rpc', 'complete_disbursement', 'account_id', p_account_id)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: disbursement approval required');
  END IF;

  SELECT * INTO v_disb FROM public.disbursements WHERE id = p_disbursement_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Disbursement not found');
  END IF;
  IF v_disb.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Disbursement is %s; only pending can be completed', v_disb.status));
  END IF;

  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source account not found');
  END IF;
  IF COALESCE(v_account.is_active, true) = false THEN
    RETURN jsonb_build_object('success', false, 'error', format('Account "%s" is inactive', v_account.account_name));
  END IF;

  IF v_account.balance < v_disb.amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient funds in %s. Available: %s, Required: %s',
        v_account.account_name,
        to_char(v_account.balance, 'FM999,999,999,990.00'),
        to_char(v_disb.amount, 'FM999,999,999,990.00')),
      'available_balance', v_account.balance,
      'required_amount', v_disb.amount
    );
  END IF;

  SELECT la.id, la.full_name, la.status::text AS status_text, la.loan_product_id
    INTO v_loan
  FROM public.loan_applications la WHERE la.id = v_disb.loan_id;
  v_prev_status := v_loan.status_text;

  IF v_loan.loan_product_id IS NOT NULL THEN
    SELECT COALESCE(legal_fee_percent, 0) AS lf_pct,
           COALESCE(legal_fee_deduction_mode, 'none') AS lf_mode
      INTO v_product
    FROM public.loan_products WHERE id = v_loan.loan_product_id;
    v_fee_percent := COALESCE(v_product.lf_pct, 0);
    v_fee_mode := COALESCE(v_product.lf_mode, 'none');
  END IF;

  IF v_fee_mode = 'upfront_net' AND v_fee_percent > 0 THEN
    v_fee_amount := round(v_disb.amount * v_fee_percent / 100.0, 2);
  ELSE
    v_fee_amount := 0;
  END IF;
  v_net_to_borrower := v_disb.amount - v_fee_amount;

  v_new_balance := v_account.balance - v_disb.amount;
  UPDATE public.accounts SET balance = v_new_balance, updated_at = now() WHERE id = p_account_id;

  v_ref := COALESCE(NULLIF(trim(p_transaction_reference), ''), v_disb.transaction_reference,
    'DISB-' || LPAD(EXTRACT(EPOCH FROM now())::bigint::text, 12, '0'));

  UPDATE public.disbursements
  SET status = 'completed',
      disbursed_at = now(),
      source_account_id = p_account_id,
      transaction_reference = v_ref
  WHERE id = p_disbursement_id;

  INSERT INTO public.account_transactions (
    account_id, transaction_type, amount, balance_before, balance_after,
    destination, reference_type, reference_id, notes, created_by
  ) VALUES (
    p_account_id, 'disbursement', v_net_to_borrower, v_account.balance, v_account.balance - v_net_to_borrower,
    COALESCE(v_loan.full_name, 'Borrower'), 'disbursement', p_disbursement_id,
    format('Net disbursement to %s (gross %s, legal fee %s). Ref: %s',
           COALESCE(v_loan.full_name, 'Borrower'),
           to_char(v_disb.amount, 'FM999,999,999,990.00'),
           to_char(v_fee_amount, 'FM999,999,999,990.00'),
           v_ref),
    v_uid
  );

  IF v_fee_amount > 0 THEN
    INSERT INTO public.account_transactions (
      account_id, transaction_type, amount, balance_before, balance_after,
      destination, reference_type, reference_id, notes, created_by
    ) VALUES (
      p_account_id, 'legal_fee', v_fee_amount,
      v_account.balance - v_net_to_borrower, v_new_balance,
      COALESCE(v_loan.full_name, 'Borrower'), 'disbursement', p_disbursement_id,
      format('Upfront legal fee %s%% on disbursement (gross %s). Ref: %s',
             to_char(v_fee_percent, 'FM990.00'),
             to_char(v_disb.amount, 'FM999,999,999,990.00'),
             v_ref),
      v_uid
    );
  END IF;

  IF v_loan.id IS NOT NULL THEN
    IF v_loan.status_text IN ('approved', 'awaiting_disbursement', 'contract_signing') THEN
      UPDATE public.loan_applications
      SET status = 'disbursed'::public.loan_status,
          disbursed_at = now(),
          disbursed_by = v_uid,
          updated_at = now()
      WHERE id = v_loan.id;

      INSERT INTO public.loan_status_transitions (loan_id, from_status, to_status, actor_type, actor_id, reason_code)
      VALUES (v_loan.id, v_prev_status, 'disbursed', 'admin', v_uid, 'disbursement_completed');
      v_prev_status := 'disbursed';
    END IF;

    UPDATE public.loan_applications
    SET status = 'active'::public.loan_status,
        updated_at = now()
    WHERE id = v_loan.id
      AND status::text IN ('disbursed', 'approved', 'awaiting_disbursement', 'contract_signing');

    IF v_prev_status <> 'active' THEN
      INSERT INTO public.loan_status_transitions (loan_id, from_status, to_status, actor_type, actor_id, reason_code)
      VALUES (v_loan.id, v_prev_status, 'active', 'admin', v_uid, 'disbursement_completed');
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'DISBURSEMENT_COMPLETED', 'disbursement', p_disbursement_id, 'disbursement',
    jsonb_build_object(
      'gross_amount', v_disb.amount,
      'legal_fee_percent', v_fee_percent,
      'legal_fee_amount', v_fee_amount,
      'net_to_borrower', v_net_to_borrower,
      'account_id', p_account_id,
      'account_name', v_account.account_name,
      'balance_after', v_new_balance,
      'transaction_reference', v_ref,
      'loan_id', v_disb.loan_id,
      'is_top_up', v_disb.is_top_up,
      'auto_activated', true
    ));

  RETURN jsonb_build_object(
    'success', true,
    'transaction_reference', v_ref,
    'balance_after', v_new_balance,
    'gross_amount', v_disb.amount,
    'legal_fee_amount', v_fee_amount,
    'legal_fee_percent', v_fee_percent,
    'net_to_borrower', v_net_to_borrower,
    'amount', v_net_to_borrower,
    'loan_id', v_disb.loan_id
  );
END;
$function$;

-- admin_mark_loan_defaulted ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mark_loan_defaulted(p_loan_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); la RECORD; v_prev_status text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'loans', 'edit') THEN
    PERFORM public.log_permission_denied('loans', 'loans.edit', 'loan_application', p_loan_id,
      jsonb_build_object('rpc', 'admin_mark_loan_defaulted'));
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RETURN jsonb_build_object('success', false, 'error', 'Reason is required (min 3 characters)'); END IF;
  SELECT id, status INTO la FROM public.loan_applications WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Loan not found'); END IF;
  v_prev_status := la.status::text;
  IF la.status::text NOT IN ('active', 'disbursed') THEN RETURN jsonb_build_object('success', false, 'error', 'Only active or disbursed loans can be marked defaulted'); END IF;
  UPDATE public.loan_applications SET status = 'defaulted', updated_at = now() WHERE id = p_loan_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, details)
    VALUES (v_uid, 'MOVE_TO_DEFAULTED', 'loan_application', p_loan_id, 'loans',
            jsonb_build_object('reason', trim(p_reason), 'previous_status', v_prev_status));
  INSERT INTO public.loan_events (loan_id, event_type, performed_by, reason, previous_values, new_values)
    VALUES (p_loan_id, 'manual_default', v_uid, trim(p_reason),
            jsonb_build_object('status', v_prev_status), jsonb_build_object('status', 'defaulted'));
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- admin_approve_loan_writeoff -------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_loan_writeoff(p_writeoff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); w RECORD; v_borrower text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    PERFORM public.log_permission_denied('writeoffs', 'writeoffs.manage', 'loan_writeoff', p_writeoff_id,
      jsonb_build_object('rpc', 'admin_approve_loan_writeoff'));
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Write-off not found'); END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be approved'); END IF;
  SELECT la.full_name INTO v_borrower FROM public.loan_applications la WHERE la.id = w.loan_id;
  UPDATE public.loan_writeoffs SET status = 'approved', approved_at = now(), approved_by = v_uid, updated_at = now() WHERE id = p_writeoff_id;
  UPDATE public.loan_applications SET status = 'defaulted', updated_at = now() WHERE id = w.loan_id;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details, module)
    VALUES (v_uid, 'WRITEOFF_APPROVED', 'loan_writeoff', p_writeoff_id,
            jsonb_build_object('loan_id', w.loan_id, 'amount', w.writeoff_amount, 'borrower', v_borrower), 'writeoffs');
  INSERT INTO public.collection_activities (loan_id, activity_type, notes, outcome)
    VALUES (w.loan_id, 'writeoff_approved',
            format('Write-off approved. Amount: K%s', to_char(w.writeoff_amount, 'FM999,999,999,990.00')),
            'Loan written off - marked as defaulted');
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- admin_reject_loan_writeoff --------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reject_loan_writeoff(p_writeoff_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); w RECORD;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    PERFORM public.log_permission_denied('writeoffs', 'writeoffs.manage', 'loan_writeoff', p_writeoff_id,
      jsonb_build_object('rpc', 'admin_reject_loan_writeoff'));
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Write-off not found'); END IF;
  IF w.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Only pending write-offs can be rejected'); END IF;
  UPDATE public.loan_writeoffs SET status = 'rejected',
    recovery_notes = format('Rejected: %s', COALESCE(nullif(trim(p_reason), ''), 'no reason')),
    updated_at = now() WHERE id = p_writeoff_id;
  INSERT INTO public.collection_activities (loan_id, activity_type, notes, outcome)
    VALUES (w.loan_id, 'writeoff_rejected',
            format('Write-off rejected. Reason: %s', COALESCE(nullif(trim(p_reason), ''), 'n/a')),
            'Continue collection efforts');
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- admin_record_writeoff_recovery ----------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_record_writeoff_recovery(p_writeoff_id uuid, p_amount numeric, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); w RECORD; v_new_recovery numeric; v_line text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT public.has_permission(v_uid, 'writeoffs', 'manage') THEN
    PERFORM public.log_permission_denied('writeoffs', 'writeoffs.manage', 'loan_writeoff', p_writeoff_id,
      jsonb_build_object('rpc', 'admin_record_writeoff_recovery', 'amount', p_amount));
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid recovery amount'); END IF;
  SELECT * INTO w FROM public.loan_writeoffs WHERE id = p_writeoff_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Write-off not found'); END IF;
  IF w.status IS DISTINCT FROM 'approved' THEN RETURN jsonb_build_object('success', false, 'error', 'Recovery only for approved write-offs'); END IF;
  v_new_recovery := COALESCE(w.recovery_amount, 0) + p_amount;
  v_line := format(E'\n[%s] Recovered K%s: %s',
    to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    to_char(p_amount, 'FM999,999,999,990.00'),
    COALESCE(nullif(trim(p_notes), ''), ''));
  UPDATE public.loan_writeoffs SET recovery_amount = v_new_recovery,
    recovery_notes = trim(both E'\n' from concat_ws(E'\n', COALESCE(w.recovery_notes, ''), v_line)),
    updated_at = now() WHERE id = p_writeoff_id;
  INSERT INTO public.collection_activities (loan_id, activity_type, notes, outcome)
    VALUES (w.loan_id, 'recovery_recorded',
            format('Recovery recorded: K%s. %s', to_char(p_amount, 'FM999,999,999,990.00'),
                   COALESCE(nullif(trim(p_notes), ''), '')),
            format('Total recovered: K%s', to_char(v_new_recovery, 'FM999,999,999,990.00')));
  RETURN jsonb_build_object('success', true);
END;
$function$;
