-- Fix disbursement account trigger: single deduction when status = completed, balance check, balance_before, notes column
-- Ensures account is deducted only once (when marking disbursement completed) and transaction row is valid.

CREATE OR REPLACE FUNCTION update_account_on_disbursement()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before DECIMAL(15, 2);
  v_balance_after DECIMAL(15, 2);
BEGIN
  -- Only process if source_account_id is set and status is completed
  IF NEW.source_account_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- For new disbursements or status changes to completed
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'completed') THEN
      -- Get current balance and validate before deducting (especially when marking pending -> completed)
      SELECT balance INTO v_balance_before
      FROM accounts
      WHERE id = NEW.source_account_id;

      IF v_balance_before IS NULL THEN
        RAISE EXCEPTION 'Source account not found for disbursement';
      END IF;
      IF v_balance_before < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient balance in source account. Available: %, Required: %', v_balance_before, NEW.amount;
      END IF;

      v_balance_after := v_balance_before - NEW.amount;

      -- Deduct from source account
      UPDATE accounts
      SET balance = v_balance_after,
          updated_at = NOW()
      WHERE id = NEW.source_account_id;

      -- Record transaction with balance_before and balance_after (notes column per schema)
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        notes
      )
      VALUES (
        NEW.source_account_id,
        'disbursement',
        NEW.amount,
        v_balance_before,
        v_balance_after,
        'loan_disbursement',
        NEW.id,
        'Loan disbursement for loan ID: ' || NEW.loan_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_account_on_disbursement() IS 'Deducts from source account and records transaction only when disbursement status is completed (single deduction, balance check, correct columns)';
