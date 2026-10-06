-- Migration: Account-Based Financial System
-- Description: Link all financial transactions to specific accounts
-- Created: 2026-01-08

-- Add source_account_id to disbursements table
ALTER TABLE disbursements
ADD COLUMN IF NOT EXISTS source_account_id UUID REFERENCES accounts(id);

-- Add destination_account_id to loan_repayments table (for recording which account received the payment)
ALTER TABLE loan_repayments
ADD COLUMN IF NOT EXISTS destination_account_id UUID REFERENCES accounts(id);

-- Ensure expenses already have account_id (should exist, but making sure)
-- expenses.account_id should already exist from previous schema

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_disbursements_source_account ON disbursements(source_account_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_destination_account ON loan_repayments(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);

-- Add comments for documentation
COMMENT ON COLUMN disbursements.source_account_id IS 'The account from which funds were disbursed';
COMMENT ON COLUMN loan_repayments.destination_account_id IS 'The account to which the repayment was deposited';

-- Create view for account cash flow analysis
CREATE OR REPLACE VIEW account_cash_flow AS
SELECT 
  a.id AS account_id,
  a.account_name,
  a.account_type,
  a.balance AS current_balance,
  -- Inflows (loan_repayments deposited)
  COALESCE(SUM(CASE WHEN r.destination_account_id = a.id THEN r.amount ELSE 0 END), 0) AS total_loan_repayments_received,
  -- Outflows (disbursements and expenses)
  COALESCE(SUM(CASE WHEN d.source_account_id = a.id THEN d.amount ELSE 0 END), 0) AS total_disbursements_sent,
  COALESCE(SUM(CASE WHEN e.account_id = a.id THEN e.amount ELSE 0 END), 0) AS total_expenses_paid,
  -- Net flow
  COALESCE(SUM(CASE WHEN r.destination_account_id = a.id THEN r.amount ELSE 0 END), 0) -
  (COALESCE(SUM(CASE WHEN d.source_account_id = a.id THEN d.amount ELSE 0 END), 0) +
   COALESCE(SUM(CASE WHEN e.account_id = a.id THEN e.amount ELSE 0 END), 0)) AS net_cash_flow
FROM accounts a
LEFT JOIN loan_repayments r ON r.destination_account_id = a.id AND r.status = 'paid'
LEFT JOIN disbursements d ON d.source_account_id = a.id AND d.status = 'completed'
LEFT JOIN expenses e ON e.account_id = a.id AND e.status = 'paid'
WHERE a.is_active = true
GROUP BY a.id, a.account_name, a.account_type, a.balance;

-- Create function to validate account balance before disbursement
CREATE OR REPLACE FUNCTION check_account_balance_before_disbursement()
RETURNS TRIGGER AS $$
DECLARE
  account_balance DECIMAL(15, 2);
BEGIN
  -- Only check if source_account_id is set
  IF NEW.source_account_id IS NOT NULL THEN
    -- Get current account balance
    SELECT balance INTO account_balance
    FROM accounts
    WHERE id = NEW.source_account_id;

    -- Check if account has sufficient funds
    IF account_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient balance in source account. Available: %, Required: %', account_balance, NEW.amount;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for balance validation
DROP TRIGGER IF EXISTS validate_disbursement_balance ON disbursements;
CREATE TRIGGER validate_disbursement_balance
  BEFORE INSERT ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION check_account_balance_before_disbursement();

-- Create function to automatically update account balances on disbursement
CREATE OR REPLACE FUNCTION update_account_on_disbursement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if source_account_id is set and status is completed
  IF NEW.source_account_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- For new disbursements or status changes to completed
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'completed') THEN
      -- Deduct from source account
      UPDATE accounts
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.source_account_id;

      -- Record transaction
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      SELECT 
        NEW.source_account_id,
        'disbursement',
        NEW.amount,
        balance,
        'loan_disbursement',
        NEW.id,
        'Loan disbursement for loan ID: ' || NEW.loan_id
      FROM accounts
      WHERE id = NEW.source_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account updates
DROP TRIGGER IF EXISTS auto_update_account_disbursement ON disbursements;
CREATE TRIGGER auto_update_account_disbursement
  AFTER INSERT OR UPDATE ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION update_account_on_disbursement();

-- Create function to automatically update account balances on repayment
CREATE OR REPLACE FUNCTION update_account_on_repayment()
RETURNS TRIGGER AS $$
DECLARE
  payment_amount DECIMAL(15, 2);
BEGIN
  -- Only process if destination_account_id is set and status is paid
  IF NEW.destination_account_id IS NOT NULL AND NEW.status = 'paid' THEN
    -- For new paid loan_repayments or status changes to paid
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'paid') THEN
      -- Calculate the actual payment amount
      payment_amount := COALESCE(NEW.principal_paid, NEW.amount);

      -- Add to destination account
      UPDATE accounts
      SET balance = balance + payment_amount,
          updated_at = NOW()
      WHERE id = NEW.destination_account_id;

      -- Record transaction
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      SELECT 
        NEW.destination_account_id,
        'repayment',
        payment_amount,
        balance,
        'loan_repayment',
        NEW.id,
        'Loan repayment for loan ID: ' || NEW.loan_id
      FROM accounts
      WHERE id = NEW.destination_account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account updates on repayment
DROP TRIGGER IF EXISTS auto_update_account_repayment ON loan_repayments;
CREATE TRIGGER auto_update_account_repayment
  AFTER INSERT OR UPDATE ON loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION update_account_on_repayment();

-- Create function to automatically update account balances on expense
CREATE OR REPLACE FUNCTION update_account_on_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if account_id is set and status is paid
  IF NEW.account_id IS NOT NULL AND NEW.status = 'paid' THEN
    -- For new paid expenses or status changes to paid
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.status != 'paid') THEN
      -- Deduct from account
      UPDATE accounts
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.account_id;

      -- Record transaction
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
      )
      SELECT 
        NEW.account_id,
        'expense',
        NEW.amount,
        balance,
        'expense',
        NEW.id,
        'Expense: ' || COALESCE(NEW.expense_category, 'General') || ' - ' || COALESCE(NEW.vendor_payee, 'N/A')
      FROM accounts
      WHERE id = NEW.account_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account updates on expense
DROP TRIGGER IF EXISTS auto_update_account_expense ON expenses;
CREATE TRIGGER auto_update_account_expense
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_account_on_expense();

-- Add helpful comments
COMMENT ON VIEW account_cash_flow IS 'Shows cash flow analysis for each account including inflows (loan_repayments) and outflows (disbursements, expenses)';
COMMENT ON FUNCTION check_account_balance_before_disbursement() IS 'Validates that the source account has sufficient balance before allowing a disbursement';
COMMENT ON FUNCTION update_account_on_disbursement() IS 'Automatically deducts disbursement amount from source account and records transaction';
COMMENT ON FUNCTION update_account_on_repayment() IS 'Automatically adds repayment amount to destination account and records transaction';
COMMENT ON FUNCTION update_account_on_expense() IS 'Automatically deducts expense amount from account and records transaction';
