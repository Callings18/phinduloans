-- Fix: complete_disbursement() referenced loan_applications.application_number,
-- but that column was never added to the table. Every "Confirm Disbursement"
-- click failed with:
--   column la.application_number does not exist
--
-- Resolution: remove the column reference and use loan_applications.id::text
-- directly as the loan reference (which is what the COALESCE already fell back
-- to). The function body is otherwise byte-identical to the version in
-- 20260428221317_b215ee23-a832-4f5d-8bf8-c9aa43a11483.sql.

DROP FUNCTION IF EXISTS public.complete_disbursement(uuid, uuid, text);

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
  v_reserve RECORD;
  v_new_balance numeric;
  v_after_borrower numeric;
  v_reserve_new_balance numeric;
  v_ref text;
  v_fee_percent numeric := 0;
  v_fee_mode text := 'none';
  v_fee_amount numeric := 0;
  v_net_to_borrower numeric;
  v_prev_status text;
  v_loan_ref text;
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
  IF COALESCE(v_account.is_protected, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', format('Account "%s" is a protected reserve and cannot be used to disburse loans', v_account.account_name));
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

  -- FIX: dropped la.application_number from the SELECT list. The column
  -- doesn't exist on loan_applications. v_loan_ref now uses la.id::text
  -- directly, matching the original COALESCE fallback behaviour.
  SELECT la.id, la.full_name, la.nrc_number, la.user_id,
         la.status::text AS status_text, la.loan_product_id
    INTO v_loan
  FROM public.loan_applications la WHERE la.id = v_disb.loan_id;
  v_prev_status := v_loan.status_text;
  v_loan_ref := v_loan.id::text;

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
  v_after_borrower := v_account.balance - v_net_to_borrower;
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
    destination, reference_type, reference_id, notes, created_by, metadata
  ) VALUES (
    p_account_id, 'disbursement', v_net_to_borrower, v_account.balance, v_after_borrower,
    COALESCE(v_loan.full_name, 'Borrower'), 'disbursement', p_disbursement_id,
    format('Net disbursement to %s (NRC %s, loan %s). Gross K%s, legal fee K%s. Ref: %s',
           COALESCE(v_loan.full_name, 'Borrower'),
           COALESCE(v_loan.nrc_number, 'N/A'),
           v_loan_ref,
           to_char(v_disb.amount, 'FM999,999,999,990.00'),
           to_char(v_fee_amount, 'FM999,999,999,990.00'),
           v_ref),
    v_uid,
    jsonb_build_object(
      'borrower_id', v_loan.user_id,
      'borrower_name', v_loan.full_name,
      'nrc_number', v_loan.nrc_number,
      'loan_id', v_loan.id,
      'loan_reference', v_loan_ref,
      'disbursement_id', p_disbursement_id,
      'gross_amount', v_disb.amount,
      'legal_fee_amount', v_fee_amount,
      'transaction_reference', v_ref
    )
  );

  IF v_fee_amount > 0 THEN
    SELECT * INTO v_reserve
      FROM public.accounts
     WHERE account_type = 'legal_reserve' AND COALESCE(is_protected, false) = true
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Legal Fees Reserve account is missing. Cannot ring-fence legal fee for disbursement %.', p_disbursement_id;
    END IF;

    INSERT INTO public.account_transactions (
      account_id, transaction_type, amount, balance_before, balance_after,
      destination, reference_type, reference_id, notes, created_by, metadata
    ) VALUES (
      p_account_id, 'legal_fee_transfer', v_fee_amount,
      v_after_borrower, v_new_balance,
      v_reserve.account_name, 'disbursement', p_disbursement_id,
      format('Legal fee transfer to %s for %s (NRC %s, loan %s). %s%% of K%s = K%s. Ref: %s',
             v_reserve.account_name,
             COALESCE(v_loan.full_name, 'Borrower'),
             COALESCE(v_loan.nrc_number, 'N/A'),
             v_loan_ref,
             to_char(v_fee_percent, 'FM990.00'),
             to_char(v_disb.amount, 'FM999,999,999,990.00'),
             to_char(v_fee_amount, 'FM999,999,999,990.00'),
             v_ref),
      v_uid,
      jsonb_build_object(
        'borrower_id', v_loan.user_id,
        'borrower_name', v_loan.full_name,
        'nrc_number', v_loan.nrc_number,
        'loan_id', v_loan.id,
        'loan_reference', v_loan_ref,
        'disbursement_id', p_disbursement_id,
        'fee_percent', v_fee_percent,
        'gross_amount', v_disb.amount,
        'destination_account_id', v_reserve.id,
        'destination_account_name', v_reserve.account_name,
        'transaction_reference', v_ref
      )
    );

    v_reserve_new_balance := v_reserve.balance + v_fee_amount;
    UPDATE public.accounts SET balance = v_reserve_new_balance, updated_at = now() WHERE id = v_reserve.id;

    INSERT INTO public.account_transactions (
      account_id, transaction_type, amount, balance_before, balance_after,
      source, reference_type, reference_id, notes, created_by, metadata
    ) VALUES (
      v_reserve.id, 'legal_fee_collection', v_fee_amount,
      v_reserve.balance, v_reserve_new_balance,
      v_account.account_name, 'disbursement', p_disbursement_id,
      format('Legal fee collected from %s on disbursement to %s (NRC %s, loan %s). %s%% of K%s = K%s. Ref: %s',
             v_account.account_name,
             COALESCE(v_loan.full_name, 'Borrower'),
             COALESCE(v_loan.nrc_number, 'N/A'),
             v_loan_ref,
             to_char(v_fee_percent, 'FM990.00'),
             to_char(v_disb.amount, 'FM999,999,999,990.00'),
             to_char(v_fee_amount, 'FM999,999,999,990.00'),
             v_ref),
      v_uid,
      jsonb_build_object(
        'borrower_id', v_loan.user_id,
        'borrower_name', v_loan.full_name,
        'nrc_number', v_loan.nrc_number,
        'loan_id', v_loan.id,
        'loan_reference', v_loan_ref,
        'disbursement_id', p_disbursement_id,
        'fee_percent', v_fee_percent,
        'gross_amount', v_disb.amount,
        'source_account_id', p_account_id,
        'source_account_name', v_account.account_name,
        'transaction_reference', v_ref
      )
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
      'legal_fee_ring_fenced', v_fee_amount > 0,
      'net_to_borrower', v_net_to_borrower,
      'account_id', p_account_id,
      'account_name', v_account.account_name,
      'balance_after', v_new_balance,
      'transaction_reference', v_ref,
      'loan_id', v_disb.loan_id,
      'borrower_name', v_loan.full_name,
      'nrc_number', v_loan.nrc_number,
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
    'legal_fee_ring_fenced', v_fee_amount > 0,
    'net_to_borrower', v_net_to_borrower,
    'amount', v_net_to_borrower,
    'loan_id', v_disb.loan_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.complete_disbursement(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_disbursement(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_disbursement(uuid, uuid, text) TO authenticated;
