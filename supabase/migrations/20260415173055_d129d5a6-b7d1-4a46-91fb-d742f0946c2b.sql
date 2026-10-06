
-- Allow staff roles to update repayments (not just admin)
DROP POLICY IF EXISTS "Staff can update repayments" ON public.loan_repayments;
CREATE POLICY "Staff can update repayments"
ON public.loan_repayments
FOR UPDATE
USING (
  has_role(auth.uid(), 'loan_officer'::app_role)
  OR has_role(auth.uid(), 'finance_officer'::app_role)
  OR has_role(auth.uid(), 'collections_officer'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Atomic payment recording function with account integration
CREATE OR REPLACE FUNCTION public.record_loan_payment(
  p_repayment_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_account_id uuid DEFAULT NULL,
  p_transaction_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Auth check
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

  -- Lock repayment row
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

  -- Get loan details
  SELECT * INTO v_loan FROM public.loan_applications WHERE id = v_repayment.loan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
  END IF;

  -- Generate receipt number
  v_receipt_no := 'RCP-' || LPAD(EXTRACT(EPOCH FROM now())::bigint::text, 12, '0');

  -- Update repayment
  UPDATE public.loan_repayments
  SET status = 'paid',
      paid_date = CURRENT_DATE,
      principal_paid = p_amount,
      payment_method = p_payment_method,
      transaction_reference = COALESCE(p_transaction_reference, v_receipt_no),
      updated_at = now()
  WHERE id = p_repayment_id;

  -- Credit account if specified
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
        format('Loan repayment from %s - Installment #%s', v_loan.full_name, v_repayment.installment_number)
      );
    END IF;
  END IF;

  -- Calculate totals
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.loan_repayments WHERE loan_id = v_loan.id AND status = 'paid';

  v_total_due := COALESCE(v_loan.total_repayment, v_loan.loan_amount);
  v_remaining := GREATEST(v_total_due - v_total_paid, 0);

  -- Check if all installments are paid
  SELECT NOT EXISTS (
    SELECT 1 FROM public.loan_repayments
    WHERE loan_id = v_loan.id AND status IN ('pending', 'overdue')
  ) INTO v_all_paid;

  IF v_all_paid AND v_loan.status::text NOT IN ('completed', 'defaulted', 'rejected') THEN
    UPDATE public.loan_applications SET status = 'completed', updated_at = now() WHERE id = v_loan.id;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, module, new_values)
  VALUES (v_uid, 'PAYMENT_RECORDED', 'repayment', p_repayment_id, 'collections',
    jsonb_build_object(
      'amount', p_amount, 'payment_method', p_payment_method,
      'receipt_no', v_receipt_no, 'installment', v_repayment.installment_number,
      'borrower', v_loan.full_name, 'loan_id', v_loan.id
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
    'installment_number', v_repayment.installment_number,
    'total_installments', (SELECT COUNT(*) FROM public.loan_repayments WHERE loan_id = v_loan.id),
    'total_paid', v_total_paid,
    'outstanding_balance', v_remaining,
    'loan_completed', v_all_paid
  );
END;
$$;
