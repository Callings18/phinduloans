
-- =============================================================
-- PART 1 — Wipe imported Marketeer loans + sentinel borrowers
-- =============================================================

CREATE TEMP TABLE _imp_loans ON COMMIT DROP AS
SELECT id, user_id FROM public.loan_applications
WHERE nrc_number ~ '^999[0-9]{3}/26/9$';

CREATE TEMP TABLE _imp_users ON COMMIT DROP AS
SELECT DISTINCT user_id AS id FROM _imp_loans WHERE user_id IS NOT NULL
UNION
SELECT id FROM auth.users WHERE email LIKE 'mkt.import.%@offline.phindu.zm';

CREATE TEMP TABLE _imp_reps ON COMMIT DROP AS
SELECT id FROM public.loan_repayments WHERE loan_id IN (SELECT id FROM _imp_loans);

CREATE TEMP TABLE _imp_disb ON COMMIT DROP AS
SELECT id FROM public.disbursements WHERE loan_id IN (SELECT id FROM _imp_loans);

-- 1a. Reverse Zanaco pre-funding top-up (importer)
DO $$
DECLARE v_zanaco uuid := '4e89f7c7-691a-4ebb-84be-e152378ff357'; v_total numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_total
    FROM public.account_transactions
   WHERE account_id = v_zanaco AND transaction_type = 'top_up'
     AND notes ILIKE '%marketeer%import%';
  IF v_total > 0 THEN
    UPDATE public.accounts SET balance = GREATEST(balance - v_total, 0), updated_at = now() WHERE id = v_zanaco;
    DELETE FROM public.account_transactions
     WHERE account_id = v_zanaco AND transaction_type = 'top_up' AND notes ILIKE '%marketeer%import%';
  END IF;
END $$;

-- 1b. Remove account_transactions tied to imported loans
DELETE FROM public.account_transactions
 WHERE (reference_type = 'repayment'    AND reference_id IN (SELECT id FROM _imp_reps))
    OR (reference_type = 'disbursement' AND reference_id IN (SELECT id FROM _imp_disb));

-- 1c. Restore Zanaco for removed disbursement entries
DO $$
DECLARE v_zanaco uuid := '4e89f7c7-691a-4ebb-84be-e152378ff357'; v_t numeric;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_t FROM public.disbursements WHERE id IN (SELECT id FROM _imp_disb);
  IF v_t > 0 THEN
    UPDATE public.accounts SET balance = balance + v_t, updated_at = now() WHERE id = v_zanaco;
  END IF;
END $$;

-- 1d. Subtract Zanaco for removed repayments
DO $$
DECLARE v_zanaco uuid := '4e89f7c7-691a-4ebb-84be-e152378ff357'; v_t numeric;
BEGIN
  SELECT COALESCE(SUM(COALESCE(principal_paid,0)),0) INTO v_t
    FROM public.loan_repayments WHERE id IN (SELECT id FROM _imp_reps);
  IF v_t > 0 THEN
    UPDATE public.accounts SET balance = GREATEST(balance - v_t, 0), updated_at = now() WHERE id = v_zanaco;
  END IF;
END $$;

-- 1e. Delete loan-dependent rows
DELETE FROM public.loan_repayments         WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.disbursements           WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.loan_events             WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.loan_status_transitions WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.loan_borrowers          WHERE loan_application_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.loan_collateral_images  WHERE loan_application_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.loan_notes              WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.collection_activities   WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.collection_assignments  WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.payment_claims          WHERE loan_id IN (SELECT id FROM _imp_loans);
DELETE FROM public.audit_logs
 WHERE entity_type IN ('repayment','disbursement','loan_application')
   AND (entity_id IN (SELECT id FROM _imp_loans)
     OR entity_id IN (SELECT id FROM _imp_reps)
     OR entity_id IN (SELECT id FROM _imp_disb));

-- 1f. Delete loan applications
DELETE FROM public.loan_applications WHERE id IN (SELECT id FROM _imp_loans);

-- 1g. Delete user-FK rows for sentinel borrowers
DELETE FROM public.notification_logs    WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.notification_inbox   WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.push_subscriptions   WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.consent_logs         WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.user_product_access  WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.user_roles           WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.audit_logs           WHERE user_id IN (SELECT id FROM _imp_users);
DELETE FROM public.profiles             WHERE id IN (SELECT id FROM _imp_users)
                                            OR email LIKE 'mkt.import.%@offline.phindu.zm';
DELETE FROM auth.users                  WHERE id IN (SELECT id FROM _imp_users)
                                            OR email LIKE 'mkt.import.%@offline.phindu.zm';


-- =============================================================
-- PART 2 — record_loan_payment: cascade over-payments forward
-- =============================================================

CREATE OR REPLACE FUNCTION public.record_loan_payment(
  p_repayment_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_account_id uuid DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL,
  p_paid_date date DEFAULT NULL
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
  v_remaining_payment numeric;
  v_receipt_no text;
  v_target RECORD;
  v_base numeric;
  v_already numeric;
  v_outstanding numeric;
  v_apply numeric;
  v_new_paid numeric;
  v_fully boolean;
  v_new_status text;
  v_total_outstanding numeric;
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

  SELECT COALESCE(SUM(GREATEST(COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0), 0)), 0)
    INTO v_total_outstanding
  FROM public.loan_repayments
  WHERE loan_id = v_loan.id
    AND status IN ('pending','overdue','partial');

  IF p_amount > v_total_outstanding + 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Payment exceeds total outstanding balance (K%s).',
        to_char(v_total_outstanding, 'FM999,999,999,990.00')),
      'outstanding_balance', v_total_outstanding
    );
  END IF;

  v_receipt_no := 'RCP-' || LPAD(EXTRACT(EPOCH FROM now())::bigint::text, 12, '0');
  v_remaining_payment := p_amount;

  FOR v_target IN
    SELECT * FROM public.loan_repayments
    WHERE loan_id = v_loan.id
      AND status IN ('pending','overdue','partial')
      AND (id = p_repayment_id OR installment_number > v_first.installment_number)
    ORDER BY (id = p_repayment_id) DESC, installment_number ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_payment <= 0.005;

    v_base      := COALESCE(v_target.original_amount, v_target.amount, 0);
    v_already   := COALESCE(v_target.principal_paid, 0);
    v_outstanding := GREATEST(v_base - v_already, 0);
    IF v_outstanding <= 0 THEN CONTINUE; END IF;

    v_apply := LEAST(v_remaining_payment, v_outstanding);
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
      'amount_applied', v_apply,
      'new_status', v_new_status
    );

    v_remaining_payment := v_remaining_payment - v_apply;
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
        format('Loan repayment from %s — K%s applied across %s installment(s) (paid %s)',
               v_loan.full_name,
               to_char(p_amount, 'FM999,999,999,990.00'),
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
      AND COALESCE(original_amount, amount, 0) - COALESCE(principal_paid, 0) > 0.01
  ) INTO v_all_paid;

  v_principal_reconciled := v_total_paid >= v_total_due - 0.01;

  IF v_all_paid AND v_principal_reconciled
     AND v_loan.status::text NOT IN ('completed','defaulted','rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PAYMENT_RECORDED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'amount', p_amount, 'payment_method', p_payment_method,
      'receipt_no', v_receipt_no,
      'borrower', v_loan.full_name, 'loan_id', v_loan.id, 'paid_date', v_paid_date,
      'installments_touched', v_installments_touched,
      'cascade_count', jsonb_array_length(v_installments_touched),
      'total_paid', v_total_paid,
      'principal_reconciled', v_principal_reconciled
    ));

  RETURN jsonb_build_object(
    'success', true,
    'receipt_no', v_receipt_no,
    'borrower_name', v_loan.full_name,
    'borrower_phone', v_loan.phone,
    'borrower_email', v_loan.email,
    'loan_id', v_loan.id,
    'loan_amount', v_loan.loan_amount,
    'repayment_amount', p_amount,
    'payment_method', p_payment_method,
    'paid_date', v_paid_date,
    'installments_applied', v_installments_touched,
    'cascade_count', jsonb_array_length(v_installments_touched),
    'total_paid', v_total_paid,
    'outstanding_balance', v_remaining_balance,
    'loan_completed', v_all_paid AND v_principal_reconciled,
    'principal_reconciled', v_principal_reconciled
  );
END;
$function$;
