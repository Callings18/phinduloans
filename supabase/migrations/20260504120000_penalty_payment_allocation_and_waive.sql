-- ============================================================
-- Penalty payment allocation + waive penalty RPCs
--
-- Context: Admins reported they could not record customer
-- payments that included a late-repayment penalty portion. The
-- existing record_loan_payment RPC only updates principal_paid
-- and rejects amounts above the installment outstanding, which
-- leaves penalty_paid permanently at 0 even after the borrower
-- physically pays the penalty. This migration:
--   1. Extends record_loan_payment to accept p_penalty_amount,
--      so callers can split a single payment between principal
--      and penalty in one atomic call.
--   2. Adds waive_loan_penalty for cases where management
--      decides to write off an outstanding penalty.
--
-- IMPORTANT: PostgreSQL distinguishes functions by argument list,
-- so we MUST drop the old 6-argument signature first. Otherwise
-- existing callers that pass only 6 args (e.g. recordLoanPayment
-- in houseWorkflowRepository.ts and bulk repayments) would still
-- resolve to the old function and continue ignoring penalties.
-- ============================================================

DROP FUNCTION IF EXISTS public.record_loan_payment(uuid, numeric, text, uuid, text, date);

CREATE OR REPLACE FUNCTION public.record_loan_payment(
  p_repayment_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash'::text,
  p_account_id uuid DEFAULT NULL::uuid,
  p_transaction_reference text DEFAULT NULL::text,
  p_paid_date date DEFAULT NULL::date,
  p_penalty_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_principal_reconciled boolean;
  v_receipt_no text;
  v_paid_date date := COALESCE(p_paid_date, CURRENT_DATE);
  v_base_due numeric;
  v_already_paid numeric;
  v_outstanding numeric;
  v_principal_portion numeric;
  v_penalty_portion numeric;
  v_penalty_due numeric;
  v_penalty_already numeric;
  v_penalty_outstanding numeric;
  v_new_principal_paid numeric;
  v_new_penalty_paid numeric;
  v_account_amount numeric;
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
      jsonb_build_object('rpc', 'record_loan_payment', 'amount', p_amount, 'penalty_amount', p_penalty_amount)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment amount');
  END IF;

  IF v_paid_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment date cannot be in the future');
  END IF;

  v_penalty_portion := COALESCE(p_penalty_amount, 0);
  IF v_penalty_portion < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Penalty portion cannot be negative');
  END IF;
  IF v_penalty_portion > p_amount + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Penalty portion cannot exceed total payment amount');
  END IF;
  v_principal_portion := GREATEST(p_amount - v_penalty_portion, 0);

  SELECT * INTO v_repayment FROM public.loan_repayments WHERE id = p_repayment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment not found');
  END IF;
  IF v_repayment.status = 'paid' AND v_principal_portion > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paid');
  END IF;
  IF v_repayment.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment is cancelled');
  END IF;

  v_base_due       := COALESCE(v_repayment.original_amount, v_repayment.amount, 0);
  v_already_paid   := COALESCE(v_repayment.principal_paid, 0);
  v_outstanding    := GREATEST(v_base_due - v_already_paid, 0);

  v_penalty_due       := COALESCE(v_repayment.penalty_amount, 0);
  v_penalty_already   := COALESCE(v_repayment.penalty_paid, 0);
  v_penalty_outstanding := GREATEST(v_penalty_due - v_penalty_already, 0);

  -- Validate principal portion fits the installment outstanding
  IF v_principal_portion > 0 AND v_outstanding <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Installment principal already settled. Apply only to penalty (set p_penalty_amount = total).');
  END IF;
  IF v_principal_portion > v_outstanding + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Principal portion (K%s) exceeds installment outstanding (K%s). Reduce the principal portion or split across installments.',
        to_char(v_principal_portion, 'FM999,999,999,990.00'),
        to_char(v_outstanding, 'FM999,999,999,990.00'))
    );
  END IF;

  -- Validate penalty portion fits the unpaid penalty
  IF v_penalty_portion > 0 AND v_penalty_outstanding <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No outstanding penalty on this installment. Set p_penalty_amount to 0.'
    );
  END IF;
  IF v_penalty_portion > v_penalty_outstanding + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Penalty portion (K%s) exceeds unpaid penalty (K%s).',
        to_char(v_penalty_portion, 'FM999,999,999,990.00'),
        to_char(v_penalty_outstanding, 'FM999,999,999,990.00'))
    );
  END IF;

  IF v_principal_portion = 0 AND v_penalty_portion = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing to allocate. Payment must include principal or penalty.');
  END IF;

  v_new_principal_paid := v_already_paid + v_principal_portion;
  v_new_penalty_paid   := v_penalty_already + v_penalty_portion;
  v_fully_paid := v_new_principal_paid >= v_base_due - 0.01
                  AND v_new_penalty_paid >= v_penalty_due - 0.01;
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
      penalty_paid = v_new_penalty_paid,
      payment_method = p_payment_method,
      transaction_reference = COALESCE(p_transaction_reference, v_receipt_no),
      updated_at = now()
  WHERE id = p_repayment_id;

  -- Record full received amount (principal + penalty) into the destination account
  v_account_amount := v_principal_portion + v_penalty_portion;
  IF p_account_id IS NOT NULL AND v_account_amount > 0 THEN
    SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id FOR UPDATE;
    IF FOUND THEN
      v_new_balance := v_account.balance + v_account_amount;
      UPDATE public.accounts SET balance = v_new_balance, updated_at = now() WHERE id = p_account_id;
      INSERT INTO public.account_transactions (
        account_id, transaction_type, amount, balance_before, balance_after,
        source, reference_type, reference_id, notes
      ) VALUES (
        p_account_id, 'repayment', v_account_amount, v_account.balance, v_new_balance,
        v_loan.full_name, 'repayment', p_repayment_id,
        format('Loan repayment from %s - Installment #%s (%s, paid %s)%s',
               v_loan.full_name, v_repayment.installment_number, v_new_status, v_paid_date,
               CASE WHEN v_penalty_portion > 0
                    THEN format(' [principal K%s + penalty K%s]',
                                to_char(v_principal_portion, 'FM999,999,990.00'),
                                to_char(v_penalty_portion, 'FM999,999,990.00'))
                    ELSE '' END)
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
      AND (
        COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0) > 0.01
        OR COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0) > 0.01
      )
  ) INTO v_all_paid;

  v_principal_reconciled := v_total_paid >= v_total_due - 0.01;

  IF v_all_paid
     AND v_principal_reconciled
     AND v_loan.status::text NOT IN ('completed', 'defaulted', 'rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PAYMENT_RECORDED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'amount', p_amount,
      'principal_portion', v_principal_portion,
      'penalty_portion', v_penalty_portion,
      'payment_method', p_payment_method,
      'receipt_no', v_receipt_no, 'installment', v_repayment.installment_number,
      'borrower', v_loan.full_name, 'loan_id', v_loan.id, 'paid_date', v_paid_date,
      'new_status', v_new_status,
      'principal_paid_total', v_new_principal_paid,
      'penalty_paid_total', v_new_penalty_paid,
      'principal_reconciled', v_principal_reconciled
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
    'principal_portion', v_principal_portion,
    'penalty_portion', v_penalty_portion,
    'payment_method', p_payment_method,
    'paid_date', v_paid_date,
    'installment_number', v_repayment.installment_number,
    'installment_outstanding', GREATEST(v_base_due - v_new_principal_paid, 0),
    'installment_penalty_outstanding', GREATEST(v_penalty_due - v_new_penalty_paid, 0),
    'total_installments', (SELECT COUNT(*) FROM public.loan_repayments WHERE loan_id = v_loan.id),
    'total_paid', v_total_paid,
    'outstanding_balance', v_remaining,
    'loan_completed', v_all_paid AND v_principal_reconciled,
    'principal_reconciled', v_principal_reconciled
  );
END;
$function$;

-- Waive an outstanding penalty on a single installment.
-- Used when management decides to write off the penalty after a goodwill
-- discussion with the borrower. Marks penalty_paid = penalty_amount and
-- leaves an audit trail; no money moves through the accounts ledger.
CREATE OR REPLACE FUNCTION public.waive_loan_penalty(
  p_repayment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_repayment RECORD;
  v_loan RECORD;
  v_penalty_due numeric;
  v_penalty_already numeric;
  v_waived numeric;
  v_all_paid boolean;
  v_principal_reconciled boolean;
  v_total_paid numeric;
  v_total_due numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (
    has_role(v_uid, 'admin'::app_role)
    OR has_role(v_uid, 'super_admin'::app_role)
    OR has_role(v_uid, 'finance_officer'::app_role)
  ) THEN
    PERFORM public.log_permission_denied(
      'collections', 'penalty.waive', 'repayment', p_repayment_id,
      jsonb_build_object('rpc', 'waive_loan_penalty')
    );
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO v_repayment FROM public.loan_repayments WHERE id = p_repayment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment not found');
  END IF;

  v_penalty_due     := COALESCE(v_repayment.penalty_amount, 0);
  v_penalty_already := COALESCE(v_repayment.penalty_paid, 0);
  v_waived          := GREATEST(v_penalty_due - v_penalty_already, 0);

  IF v_waived <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No outstanding penalty on this installment');
  END IF;

  UPDATE public.loan_repayments
  SET penalty_paid = v_penalty_due,
      updated_at = now()
  WHERE id = p_repayment_id;

  SELECT * INTO v_loan FROM public.loan_applications WHERE id = v_repayment.loan_id;

  -- Re-evaluate completion in case the only thing blocking was the penalty
  SELECT COALESCE(SUM(COALESCE(principal_paid, CASE WHEN status='paid' THEN amount ELSE 0 END)), 0)
    INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = v_repayment.loan_id;

  v_total_due := COALESCE(v_loan.total_repayment, v_loan.loan_amount);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.loan_repayments
    WHERE loan_id = v_repayment.loan_id
      AND status IN ('pending', 'overdue', 'partial')
      AND (
        COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0) > 0.01
        OR COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0) > 0.01
      )
  ) INTO v_all_paid;

  v_principal_reconciled := v_total_paid >= v_total_due - 0.01;

  IF v_all_paid
     AND v_principal_reconciled
     AND v_loan.status::text NOT IN ('completed', 'defaulted', 'rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PENALTY_WAIVED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'penalty_waived', v_waived,
      'reason', COALESCE(p_reason, 'Not provided'),
      'installment', v_repayment.installment_number,
      'loan_id', v_repayment.loan_id,
      'borrower', v_loan.full_name
    ));

  RETURN jsonb_build_object(
    'success', true,
    'penalty_waived', v_waived,
    'installment_number', v_repayment.installment_number,
    'loan_id', v_repayment.loan_id
  );
END;
$function$;

-- Re-grant EXECUTE on the new signature (the DROP above also wiped any
-- prior GRANT on the 6-arg form).
GRANT EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date, numeric)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.waive_loan_penalty(uuid, text) TO authenticated;
