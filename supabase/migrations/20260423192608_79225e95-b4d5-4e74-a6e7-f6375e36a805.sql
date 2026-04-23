-- =====================================================================
-- CRITICAL FIXES: payment correctness, duplicate triggers, auto-activate
-- =====================================================================

-- 1) Fix record_loan_payment: additive principal_paid, partial status,
--    overpayment guard, correct loan-completion check.
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

  -- Compute outstanding for THIS installment
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

  -- Total paid across loan = sum of principal_paid (handles partials correctly)
  SELECT COALESCE(SUM(COALESCE(principal_paid, CASE WHEN status='paid' THEN amount ELSE 0 END)), 0)
    INTO v_total_paid
  FROM public.loan_repayments
  WHERE loan_id = v_loan.id;

  v_total_due := COALESCE(v_loan.total_repayment, v_loan.loan_amount);
  v_remaining := GREATEST(v_total_due - v_total_paid, 0);

  -- Loan completed only when no installment has any outstanding amount
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

-- 2) Drop duplicate triggers on loan_repayments (double-fire SMS + audit)
DROP TRIGGER IF EXISTS trigger_log_repayment ON public.loan_repayments;
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON public.loan_repayments;

-- 3) Auto-activate loan after disbursement completes
CREATE OR REPLACE FUNCTION public.complete_disbursement(
  p_disbursement_id uuid,
  p_account_id uuid,
  p_transaction_reference text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_disb RECORD;
  v_account RECORD;
  v_loan RECORD;
  v_new_balance numeric;
  v_ref text;
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

  SELECT id, full_name, status::text AS status_text INTO v_loan
  FROM public.loan_applications WHERE id = v_disb.loan_id;

  INSERT INTO public.account_transactions (
    account_id, transaction_type, amount, balance_before, balance_after,
    destination, reference_type, reference_id, notes, created_by
  ) VALUES (
    p_account_id, 'disbursement', v_disb.amount, v_account.balance, v_new_balance,
    COALESCE(v_loan.full_name, 'Borrower'), 'disbursement', p_disbursement_id,
    format('Loan disbursement to %s. Ref: %s', COALESCE(v_loan.full_name, 'Borrower'), v_ref),
    v_uid
  );

  -- Move loan to disbursed if pre-disbursement, then immediately to active
  IF v_loan.id IS NOT NULL THEN
    IF v_loan.status_text IN ('approved', 'awaiting_disbursement', 'contract_signing') THEN
      UPDATE public.loan_applications
      SET status = 'disbursed'::public.loan_status,
          disbursed_at = now(),
          disbursed_by = v_uid,
          updated_at = now()
      WHERE id = v_loan.id;
    END IF;

    -- Auto-activate (schedule generator fires on disbursement INSERT/UPDATE to completed)
    UPDATE public.loan_applications
    SET status = 'active'::public.loan_status,
        updated_at = now()
    WHERE id = v_loan.id
      AND status::text IN ('disbursed', 'approved', 'awaiting_disbursement', 'contract_signing');
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'DISBURSEMENT_COMPLETED', 'disbursement', p_disbursement_id, 'disbursement',
    jsonb_build_object(
      'amount', v_disb.amount,
      'account_id', p_account_id,
      'account_name', v_account.account_name,
      'balance_after', v_new_balance,
      'transaction_reference', v_ref,
      'loan_id', v_disb.loan_id,
      'auto_activated', true
    ));

  RETURN jsonb_build_object(
    'success', true,
    'transaction_reference', v_ref,
    'balance_after', v_new_balance,
    'amount', v_disb.amount,
    'loan_id', v_disb.loan_id
  );
END;
$function$;

-- 4) Marketeer config: skip Sundays only (fix generate_repayment_schedule)
CREATE OR REPLACE FUNCTION public.generate_repayment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  loan_record RECORD;
  product_record RECORD;
  v_payment NUMERIC;
  v_due_date DATE;
  v_num_installments INTEGER;
  v_term_unit TEXT;
  v_repayment_frequency TEXT;
  v_product_code TEXT;
  v_cursor_date DATE;
  v_count INTEGER;
  i INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO loan_record FROM public.loan_applications WHERE id = NEW.loan_id;

    -- Idempotency: don't regenerate if a schedule already exists
    IF EXISTS (SELECT 1 FROM public.loan_repayments WHERE loan_id = NEW.loan_id) THEN
      RETURN NEW;
    END IF;

    IF loan_record IS NOT NULL THEN
      v_term_unit := COALESCE(loan_record.term_unit, 'months');
      v_repayment_frequency := 'monthly';
      v_product_code := NULL;

      IF loan_record.loan_product_id IS NOT NULL THEN
        SELECT term_unit, interest_period, repayment_frequency, product_code
        INTO product_record
        FROM public.loan_products
        WHERE id = loan_record.loan_product_id;

        IF product_record IS NOT NULL THEN
          v_term_unit := COALESCE(product_record.term_unit, v_term_unit);
          v_repayment_frequency := COALESCE(product_record.repayment_frequency, product_record.interest_period, 'monthly');
          v_product_code := product_record.product_code;
        END IF;
      END IF;

      IF v_term_unit = 'days' OR v_repayment_frequency = 'daily' THEN
        IF v_term_unit = 'days' THEN
          v_num_installments := loan_record.loan_term_months;
        ELSE
          v_num_installments := loan_record.loan_term_months * 30;
        END IF;
        v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);

        -- Marketeer/daily: skip SUNDAYS ONLY (DOW 0). Saturdays are collection days.
        v_cursor_date := CURRENT_DATE;
        v_count := 0;
        WHILE v_count < v_num_installments LOOP
          v_cursor_date := v_cursor_date + INTERVAL '1 day';
          IF EXTRACT(DOW FROM v_cursor_date) <> 0 THEN
            v_count := v_count + 1;
            INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
            VALUES (NEW.loan_id, loan_record.user_id, v_payment, v_payment, v_cursor_date, 'pending', v_count);
          END IF;
        END LOOP;

      ELSIF v_term_unit = 'weeks' OR v_repayment_frequency = 'weekly' THEN
        IF v_term_unit = 'weeks' THEN
          v_num_installments := loan_record.loan_term_months;
        ELSE
          v_num_installments := loan_record.loan_term_months * 4;
        END IF;
        v_payment := COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1);

        FOR i IN 1..v_num_installments LOOP
          v_due_date := (CURRENT_DATE + (i * 7 * INTERVAL '1 day'))::DATE;
          INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
          VALUES (NEW.loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', i);
        END LOOP;

      ELSE
        v_num_installments := loan_record.loan_term_months;
        v_payment := COALESCE(loan_record.monthly_payment,
                              COALESCE(loan_record.total_repayment, loan_record.loan_amount) / GREATEST(v_num_installments, 1));

        FOR i IN 1..v_num_installments LOOP
          v_due_date := (CURRENT_DATE + (i * INTERVAL '1 month'))::DATE;
          INSERT INTO public.loan_repayments (loan_id, user_id, amount, original_amount, due_date, status, installment_number)
          VALUES (NEW.loan_id, loan_record.user_id, v_payment, v_payment, v_due_date, 'pending', i);
        END LOOP;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) Allow 'partial' status on loan_repayments (status column is text — no enum change needed),
--    but make sure the cancel-on-closure trigger also cancels partials.
CREATE OR REPLACE FUNCTION public.cancel_repayments_on_loan_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('rejected', 'defaulted', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('rejected', 'defaulted', 'completed')) THEN

    UPDATE public.loan_repayments
    SET status = 'cancelled'
    WHERE loan_id = NEW.id
    AND status IN ('pending', 'overdue', 'partial');

    UPDATE public.notification_logs
    SET status = 'cancelled'
    WHERE user_id = NEW.user_id
    AND status = 'pending'
    AND title IN ('Overdue Payment Reminder', 'Payment Due Reminder', 'Payment Due Soon');

  END IF;
  RETURN NEW;
END;
$function$;