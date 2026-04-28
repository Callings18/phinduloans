-- ============================================================
-- Module 17 — P0.1 Migration Pack (retry, md5-based key)
-- ============================================================

-- 1. Deduplicate the 2 known repayment duplicate groups
DELETE FROM public.loan_repayments
WHERE id IN ('8bae9b4f-1baf-4159-bdcb-75af30711900',
             'f4813844-da8c-422d-9bd2-33e119a9ee30');

-- 2. Unique guard on (loan_id, installment_number)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_loan_repayments_loan_installment
  ON public.loan_repayments(loan_id, installment_number);

-- 3. Notification idempotency key column + unique partial index
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_logs_idempotency_key
  ON public.notification_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 4a. Helper: derive canonical idempotency key (md5-based; built-in)
CREATE OR REPLACE FUNCTION public.notification_idempotency_key(
  p_user_id uuid,
  p_event_type text,
  p_channel text,
  p_entity_id text DEFAULT NULL,
  p_status_to text DEFAULT NULL,
  p_window_bucket text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT md5(
    concat_ws('|',
      COALESCE(p_user_id::text, ''),
      COALESCE(p_event_type, ''),
      COALESCE(p_channel, ''),
      COALESCE(p_entity_id, ''),
      COALESCE(p_status_to, ''),
      COALESCE(p_window_bucket, '')
    )
  );
$$;

-- 4b. Wire the in-DB sender to set an idempotency key and skip duplicates
CREATE OR REPLACE FUNCTION public.send_notification_via_edge_function(
  p_user_id uuid,
  p_type text,
  p_recipient text,
  p_title text,
  p_message text,
  p_subject text DEFAULT NULL::text,
  p_event_type text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := public.notification_idempotency_key(
    p_user_id,
    COALESCE(p_event_type, p_type),
    p_type,
    p_recipient,
    NULL,
    to_char(date_trunc('minute', now()), 'YYYY-MM-DD"T"HH24:MI')
  ) || ':' || md5(COALESCE(p_title, '') || '|' || COALESCE(p_message, ''));

  INSERT INTO public.notification_logs (
    user_id, type, recipient, title, message, subject,
    status, idempotency_key, created_at
  ) VALUES (
    p_user_id, p_type, p_recipient, p_title, p_message, p_subject,
    'pending', v_key, now()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$function$;

-- 5. Completion gate hardening: principal sum must reconcile to total_repayment
CREATE OR REPLACE FUNCTION public.record_loan_payment(
  p_repayment_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash'::text,
  p_account_id uuid DEFAULT NULL::uuid,
  p_transaction_reference text DEFAULT NULL::text,
  p_paid_date date DEFAULT NULL::date
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

  v_principal_reconciled := v_total_paid >= v_total_due - 0.01;

  IF v_all_paid
     AND v_principal_reconciled
     AND v_loan.status::text NOT IN ('completed', 'defaulted', 'rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PAYMENT_RECORDED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'amount', p_amount, 'payment_method', p_payment_method,
      'receipt_no', v_receipt_no, 'installment', v_repayment.installment_number,
      'borrower', v_loan.full_name, 'loan_id', v_loan.id, 'paid_date', v_paid_date,
      'new_status', v_new_status, 'principal_paid_total', v_new_principal_paid,
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
    'payment_method', p_payment_method,
    'paid_date', v_paid_date,
    'installment_number', v_repayment.installment_number,
    'installment_outstanding', GREATEST(v_base_due - v_new_principal_paid, 0),
    'total_installments', (SELECT COUNT(*) FROM public.loan_repayments WHERE loan_id = v_loan.id),
    'total_paid', v_total_paid,
    'outstanding_balance', v_remaining,
    'loan_completed', v_all_paid AND v_principal_reconciled,
    'principal_reconciled', v_principal_reconciled
  );
END;
$function$;