-- Payment allocation hardening: split penalty payments from principal payments
DROP FUNCTION IF EXISTS public.record_loan_payment(uuid, numeric, text, uuid, text, date);
DROP FUNCTION IF EXISTS public.record_loan_payment(uuid, numeric, text, uuid, text, date, numeric);

CREATE OR REPLACE FUNCTION public.record_loan_payment(
  p_repayment_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_account_id uuid DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_paid_date date DEFAULT NULL,
  p_penalty_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_first RECORD;
  v_loan RECORD;
  v_account RECORD;
  v_paid_date date := COALESCE(p_paid_date, CURRENT_DATE);
  v_penalty_payment numeric := COALESCE(p_penalty_amount, 0);
  v_principal_payment numeric;
  v_receipt_no text;
  v_target RECORD;
  v_base numeric;
  v_already numeric;
  v_penalty_due numeric;
  v_penalty_apply numeric;
  v_outstanding numeric;
  v_apply numeric;
  v_new_paid numeric;
  v_new_penalty_paid numeric;
  v_fully boolean;
  v_new_status text;
  v_total_principal_outstanding numeric;
  v_total_penalty_due numeric;
  v_total_paid numeric;
  v_total_due numeric;
  v_remaining_balance numeric;
  v_all_paid boolean;
  v_principal_reconciled boolean;
  v_new_account_balance numeric;
  v_account_before numeric;
  v_installments_touched jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'loan_officer'::public.app_role)
    OR public.has_role(v_uid, 'finance_officer'::public.app_role)
    OR public.has_role(v_uid, 'collections_officer'::public.app_role)
  ) THEN
    PERFORM public.log_permission_denied(
      'collections', 'repayments.record', 'repayment', p_repayment_id,
      jsonb_build_object('rpc', 'record_loan_payment', 'amount', p_amount, 'penalty_amount', v_penalty_payment)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment amount');
  END IF;
  IF v_penalty_payment < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Penalty amount cannot be negative');
  END IF;
  IF v_penalty_payment > p_amount + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Penalty allocation cannot exceed total payment');
  END IF;
  IF v_paid_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment date cannot be in the future');
  END IF;

  SELECT * INTO v_first FROM public.loan_repayments WHERE id = p_repayment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment not found');
  END IF;
  IF v_first.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paid');
  END IF;
  IF v_first.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment is cancelled');
  END IF;

  SELECT * INTO v_loan FROM public.loan_applications WHERE id = v_first.loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  SELECT COALESCE(SUM(GREATEST(COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0), 0)), 0),
         COALESCE(SUM(GREATEST(COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0), 0)), 0)
    INTO v_total_principal_outstanding, v_total_penalty_due
  FROM public.loan_repayments
  WHERE loan_id = v_loan.id
    AND status IN ('pending','overdue','partial');

  IF v_penalty_payment > v_total_penalty_due + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Penalty payment exceeds unpaid penalties (K%s).', to_char(v_total_penalty_due, 'FM999,999,999,990.00')),
      'unpaid_penalties', v_total_penalty_due
    );
  END IF;

  v_principal_payment := p_amount - v_penalty_payment;

  IF v_principal_payment > v_total_principal_outstanding + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Principal payment exceeds total outstanding balance (K%s).',
        to_char(v_total_principal_outstanding, 'FM999,999,999,990.00')),
      'outstanding_balance', v_total_principal_outstanding
    );
  END IF;

  v_receipt_no := 'RCP-' || LPAD(EXTRACT(EPOCH FROM now())::bigint::text, 12, '0');

  FOR v_target IN
    SELECT * FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending','overdue','partial')
      AND (id = p_repayment_id OR installment_number > v_first.installment_number)
    ORDER BY (id = p_repayment_id) DESC, installment_number ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_penalty_payment <= 0.005;

    v_penalty_due := GREATEST(COALESCE(v_target.penalty_amount, 0) - COALESCE(v_target.penalty_paid, 0), 0);
    IF v_penalty_due <= 0 THEN CONTINUE; END IF;

    v_penalty_apply := LEAST(v_penalty_payment, v_penalty_due);
    v_new_penalty_paid := COALESCE(v_target.penalty_paid, 0) + v_penalty_apply;

    UPDATE public.loan_repayments
    SET penalty_paid = v_new_penalty_paid,
        payment_method = p_payment_method,
        transaction_reference = COALESCE(p_transaction_reference, v_receipt_no),
        updated_at = now()
    WHERE id = v_target.id;

    v_installments_touched := v_installments_touched || jsonb_build_object(
      'repayment_id', v_target.id,
      'installment_number', v_target.installment_number,
      'penalty_applied', v_penalty_apply,
      'principal_applied', 0
    );

    v_penalty_payment := v_penalty_payment - v_penalty_apply;
  END LOOP;

  FOR v_target IN
    SELECT * FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending','overdue','partial')
      AND (id = p_repayment_id OR installment_number > v_first.installment_number)
    ORDER BY (id = p_repayment_id) DESC, installment_number ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_principal_payment <= 0.005;

    v_base := COALESCE(v_target.original_amount, v_target.amount, 0);
    v_already := COALESCE(v_target.principal_paid, 0);
    v_outstanding := GREATEST(v_base - v_already, 0);
    IF v_outstanding <= 0 THEN CONTINUE; END IF;

    v_apply := LEAST(v_principal_payment, v_outstanding);
    v_new_paid := v_already + v_apply;
    v_fully := v_new_paid >= v_base - 0.01;
    v_new_status := CASE WHEN v_fully THEN 'paid' ELSE 'partial' END;

    UPDATE public.loan_repayments
    SET status = v_new_status,
        paid_date = CASE WHEN v_fully THEN v_paid_date ELSE paid_date END,
        principal_paid = v_new_paid,
        payment_method = p_payment_method,
        transaction_reference = COALESCE(p_transaction_reference, v_receipt_no),
        updated_at = now()
    WHERE id = v_target.id;

    v_installments_touched := v_installments_touched || jsonb_build_object(
      'repayment_id', v_target.id,
      'installment_number', v_target.installment_number,
      'penalty_applied', 0,
      'principal_applied', v_apply,
      'new_status', v_new_status
    );

    v_principal_payment := v_principal_payment - v_apply;
  END LOOP;

  IF p_account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id FOR UPDATE;
    IF FOUND THEN
      v_account_before := v_account.balance;
      v_new_account_balance := v_account.balance + p_amount;
      UPDATE public.accounts SET balance = v_new_account_balance, updated_at = now() WHERE id = p_account_id;
      INSERT INTO public.account_transactions (
        account_id, transaction_type, amount, balance_before, balance_after,
        source, reference_type, reference_id, notes
      ) VALUES (
        p_account_id, 'repayment', p_amount, v_account_before, v_new_account_balance,
        v_loan.full_name, 'repayment', p_repayment_id,
        format('Loan repayment from %s — K%s received (principal K%s, penalty K%s) across %s installment event(s) (paid %s)',
               v_loan.full_name,
               to_char(p_amount, 'FM999,999,999,990.00'),
               to_char(p_amount - COALESCE(p_penalty_amount, 0), 'FM999,999,999,990.00'),
               to_char(COALESCE(p_penalty_amount, 0), 'FM999,999,999,990.00'),
               jsonb_array_length(v_installments_touched),
               v_paid_date)
      );
    END IF;
  END IF;

  SELECT COALESCE(SUM(COALESCE(principal_paid, CASE WHEN status='paid' THEN amount ELSE 0 END)), 0)
    INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = v_loan.id;

  v_total_due := COALESCE(v_loan.total_repayment, v_loan.loan_amount);
  v_remaining_balance := GREATEST(v_total_due - v_total_paid, 0);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending','overdue','partial')
      AND (
        COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0) > 0.01
        OR COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0) > 0.01
      )
  ) INTO v_all_paid;

  v_principal_reconciled := v_total_paid >= v_total_due - 0.01;

  IF v_all_paid AND v_principal_reconciled
     AND v_loan.status::text NOT IN ('completed','defaulted','rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  UPDATE public.loan_applications
  SET total_penalties = COALESCE((
    SELECT SUM(GREATEST(COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0), 0))
    FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending','overdue','partial')
  ), 0),
  updated_at = now()
  WHERE id = v_loan.id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PAYMENT_RECORDED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'amount', p_amount,
      'principal_amount', p_amount - COALESCE(p_penalty_amount, 0),
      'penalty_amount', COALESCE(p_penalty_amount, 0),
      'payment_method', p_payment_method,
      'receipt_no', v_receipt_no,
      'borrower', v_loan.full_name,
      'loan_id', v_loan.id,
      'paid_date', v_paid_date,
      'installments_touched', v_installments_touched,
      'remaining_balance', v_remaining_balance
    )
  );

  INSERT INTO public.loan_events (loan_id, event_type, performed_by, reason, new_values)
  VALUES (
    v_loan.id,
    'payment_recorded',
    v_uid,
    format('Payment recorded: K%s (principal K%s, penalty K%s)',
      to_char(p_amount, 'FM999,999,999,990.00'),
      to_char(p_amount - COALESCE(p_penalty_amount, 0), 'FM999,999,999,990.00'),
      to_char(COALESCE(p_penalty_amount, 0), 'FM999,999,999,990.00')
    ),
    jsonb_build_object(
      'repayment_id', p_repayment_id,
      'amount', p_amount,
      'principal_amount', p_amount - COALESCE(p_penalty_amount, 0),
      'penalty_amount', COALESCE(p_penalty_amount, 0),
      'payment_method', p_payment_method,
      'transaction_reference', COALESCE(p_transaction_reference, v_receipt_no),
      'paid_date', v_paid_date,
      'remaining_balance', v_remaining_balance,
      'installments_touched', v_installments_touched
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'receipt_no', v_receipt_no,
    'amount', p_amount,
    'principal_amount', p_amount - COALESCE(p_penalty_amount, 0),
    'penalty_amount', COALESCE(p_penalty_amount, 0),
    'remaining_balance', v_remaining_balance,
    'installments_touched', v_installments_touched
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_loan_payment(uuid, numeric, text, uuid, text, date, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.waive_loan_penalty(
  p_repayment_id uuid,
  p_amount numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_repayment RECORD;
  v_loan RECORD;
  v_unpaid_penalty numeric;
  v_waive_amount numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
    OR public.has_role(v_uid, 'finance_officer'::public.app_role)
    OR public.has_role(v_uid, 'collections_officer'::public.app_role)
  ) THEN
    PERFORM public.log_permission_denied(
      'collections', 'repayments.waive_penalty', 'repayment', p_repayment_id,
      jsonb_build_object('rpc', 'waive_loan_penalty', 'amount', p_amount)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  SELECT * INTO v_repayment FROM public.loan_repayments WHERE id = p_repayment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment not found');
  END IF;
  IF v_repayment.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repayment is cancelled');
  END IF;

  SELECT * INTO v_loan FROM public.loan_applications WHERE id = v_repayment.loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  v_unpaid_penalty := GREATEST(COALESCE(v_repayment.penalty_amount, 0) - COALESCE(v_repayment.penalty_paid, 0), 0);
  IF v_unpaid_penalty <= 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No unpaid penalty to waive');
  END IF;

  v_waive_amount := COALESCE(p_amount, v_unpaid_penalty);
  IF v_waive_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Waive amount must be greater than 0');
  END IF;
  IF v_waive_amount > v_unpaid_penalty + 0.01 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Waive amount exceeds unpaid penalty');
  END IF;

  UPDATE public.loan_repayments
  SET penalty_paid = COALESCE(penalty_paid, 0) + v_waive_amount,
      updated_at = now()
  WHERE id = p_repayment_id;

  UPDATE public.loan_applications
  SET total_penalties = COALESCE((
    SELECT SUM(GREATEST(COALESCE(penalty_amount, 0) - COALESCE(penalty_paid, 0), 0))
    FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending','overdue','partial')
  ), 0),
  updated_at = now()
  WHERE id = v_loan.id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PENALTY_WAIVED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'loan_id', v_loan.id,
      'borrower', v_loan.full_name,
      'amount', v_waive_amount,
      'reason', p_reason
    )
  );

  INSERT INTO public.loan_events (loan_id, event_type, performed_by, reason, new_values)
  VALUES (
    v_loan.id,
    'penalty_waived',
    v_uid,
    COALESCE(p_reason, format('Penalty waived: K%s', to_char(v_waive_amount, 'FM999,999,999,990.00'))),
    jsonb_build_object('repayment_id', p_repayment_id, 'amount', v_waive_amount)
  );

  RETURN jsonb_build_object('success', true, 'amount', v_waive_amount);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.waive_loan_penalty(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.waive_loan_penalty(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.waive_loan_penalty(uuid, numeric, text) TO authenticated;