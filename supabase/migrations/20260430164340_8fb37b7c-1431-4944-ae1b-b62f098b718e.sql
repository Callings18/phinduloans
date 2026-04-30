
DO $$
DECLARE
  v_marketeer_product uuid := '48cb3330-77de-42f8-add8-5e154f5f0f86';
  v_loan_ids uuid[];
  v_disb_ids uuid[];
  v_repay_ids uuid[];
  v_acct record;
  v_net_disbursed numeric;
  v_net_repaid numeric;
  v_new_bal numeric;
BEGIN
  SELECT array_agg(id) INTO v_loan_ids
  FROM loan_applications WHERE loan_product_id = v_marketeer_product;

  IF v_loan_ids IS NULL THEN RETURN; END IF;

  SELECT array_agg(id) INTO v_disb_ids FROM disbursements WHERE loan_id = ANY(v_loan_ids);
  SELECT array_agg(id) INTO v_repay_ids FROM loan_repayments WHERE loan_id = ANY(v_loan_ids);

  FOR v_acct IN
    SELECT DISTINCT account_id FROM account_transactions
    WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
       OR (reference_type = 'repayment'    AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])))
  LOOP
    SELECT COALESCE(SUM(amount),0) INTO v_net_disbursed
    FROM account_transactions WHERE account_id = v_acct.account_id
      AND reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[]));
    SELECT COALESCE(SUM(amount),0) INTO v_net_repaid
    FROM account_transactions WHERE account_id = v_acct.account_id
      AND reference_type = 'repayment' AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[]));

    SELECT balance INTO v_new_bal FROM accounts WHERE id = v_acct.account_id;
    v_new_bal := v_new_bal + v_net_disbursed - v_net_repaid;
    UPDATE accounts SET balance = v_new_bal, updated_at = now() WHERE id = v_acct.account_id;

    INSERT INTO account_transactions(
      account_id, transaction_type, amount, balance_before, balance_after,
      source, destination, reference_type, notes
    ) VALUES (
      v_acct.account_id, 'adjustment', (v_net_disbursed - v_net_repaid),
      v_new_bal - (v_net_disbursed - v_net_repaid), v_new_bal,
      'system', 'reversal', 'marketeer_wipe',
      'Reversal: wiped all Marketeer loans'
    );
  END LOOP;

  DELETE FROM account_transactions
  WHERE (reference_type = 'disbursement' AND reference_id = ANY(COALESCE(v_disb_ids, ARRAY[]::uuid[])))
     OR (reference_type = 'repayment'    AND reference_id = ANY(COALESCE(v_repay_ids, ARRAY[]::uuid[])));

  BEGIN DELETE FROM loan_events WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_repayments WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM disbursements WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_borrowers WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM payment_claims WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_documents WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_collateral WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_reviews WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_assignments WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM notifications WHERE related_loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM loan_repayments_history WHERE loan_id = ANY(v_loan_ids); EXCEPTION WHEN OTHERS THEN NULL; END;

  DELETE FROM loan_applications WHERE id = ANY(v_loan_ids);
END $$;
