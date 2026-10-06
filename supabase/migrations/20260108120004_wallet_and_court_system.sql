-- Migration: Wallet/Account Management and Court Module
-- Description: Add wallet accounts for tracking balances and court cases management
-- Created: 2026-01-08

-- ==============================================
-- 1. WALLET/ACCOUNT MANAGEMENT SYSTEM
-- ==============================================

-- Create wallet_accounts table for tracking borrower available balances
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  pending_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  total_deposited DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  total_withdrawn DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT positive_available_balance CHECK (available_balance >= 0),
  CONSTRAINT positive_pending_balance CHECK (pending_balance >= 0),
  CONSTRAINT positive_total_deposited CHECK (total_deposited >= 0),
  CONSTRAINT positive_total_withdrawn CHECK (total_withdrawn >= 0)
);

-- Create wallet_transactions table for all wallet movements
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'loan_payment', 'refund', 'withdrawal', 'adjustment'
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  reference_type VARCHAR(50), -- 'loan_payment', 'repayment', 'manual', 'reversal', etc.
  reference_id UUID, -- ID of related record (repayment_id, loan_id, etc.)
  description TEXT,
  status VARCHAR(50) DEFAULT 'completed' NOT NULL, -- 'pending', 'completed', 'failed', 'reversed'
  processed_by UUID REFERENCES auth.users(id), -- Admin who processed it
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('credit', 'debit', 'loan_payment', 'refund', 'withdrawal', 'adjustment', 'reversal')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Create wallet_withdrawal_requests table for borrower withdrawal requests
CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  withdrawal_method VARCHAR(50) NOT NULL, -- 'bank_transfer', 'mobile_money', 'cash_pickup'
  account_details JSONB, -- Bank account, mobile money number, etc.
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES wallet_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_withdrawal_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  CONSTRAINT valid_withdrawal_method CHECK (withdrawal_method IN ('bank_transfer', 'mobile_money', 'cash_pickup')),
  CONSTRAINT positive_withdrawal_amount CHECK (amount > 0)
);

-- ==============================================
-- 2. COURT CASES MODULE
-- ==============================================

-- Create court_cases table for legal enforcement tracking
CREATE TABLE IF NOT EXISTS court_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  case_number VARCHAR(100) UNIQUE NOT NULL,
  borrower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_name VARCHAR(255) NOT NULL,
  case_type VARCHAR(100) NOT NULL, -- 'recovery', 'enforcement', 'garnishment', 'bankruptcy'
  filing_date DATE NOT NULL,
  hearing_date DATE,
  case_status VARCHAR(50) DEFAULT 'filed' NOT NULL,
  judgment_amount DECIMAL(15, 2),
  judgment_date DATE,
  enforcement_status VARCHAR(50), -- 'pending', 'in_progress', 'completed', 'abandoned'
  court_costs DECIMAL(15, 2) DEFAULT 0.00,
  legal_fees DECIMAL(15, 2) DEFAULT 0.00,
  case_notes TEXT,
  documents JSONB, -- Array of document URLs
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id), -- Assigned lawyer/staff
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_case_type CHECK (case_type IN ('recovery', 'enforcement', 'garnishment', 'bankruptcy', 'other')),
  CONSTRAINT valid_case_status CHECK (case_status IN ('filed', 'pending_hearing', 'judgment_obtained', 'enforcement', 'closed', 'withdrawn')),
  CONSTRAINT valid_enforcement_status CHECK (enforcement_status IN ('pending', 'in_progress', 'completed', 'abandoned'))
);

-- Create court_case_events table for tracking court proceedings
CREATE TABLE IF NOT EXISTS court_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id UUID NOT NULL REFERENCES court_cases(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'filing', 'hearing', 'judgment', 'payment', 'document_submission'
  event_date DATE NOT NULL,
  event_time TIME,
  description TEXT NOT NULL,
  outcome TEXT,
  next_action TEXT,
  next_action_date DATE,
  documents JSONB,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('filing', 'hearing', 'judgment', 'payment', 'document_submission', 'correspondence', 'other'))
);

-- ==============================================
-- 3. ENHANCED NOTIFICATION SYSTEM
-- ==============================================

-- Add rejection_reason field to loan_applications
ALTER TABLE loan_applications 
ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS rejection_details TEXT;

-- Add contract signing fields
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS contract_url TEXT,
ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signed_contract_url TEXT;

-- ==============================================
-- 4. PARTIAL PAYMENT SYSTEM
-- ==============================================

-- Add fields to loan_repayments table for partial/split payments
ALTER TABLE loan_repayments
ADD COLUMN IF NOT EXISTS is_partial_payment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS installment_number INTEGER,
ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50) DEFAULT 'direct'; -- 'direct', 'wallet', 'split'

-- Create payment_splits table for tracking split payments
CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repayment_id UUID NOT NULL REFERENCES loan_repayments(id) ON DELETE CASCADE,
  split_number INTEGER NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  transaction_reference VARCHAR(100),
  payment_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status VARCHAR(50) DEFAULT 'completed' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT positive_split_amount CHECK (amount > 0),
  CONSTRAINT valid_split_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- ==============================================
-- 5. INDEXES FOR PERFORMANCE
-- ==============================================

-- Wallet indexes
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_id ON wallet_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_active ON wallet_accounts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_user_id ON wallet_withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_status ON wallet_withdrawal_requests(status);

-- Court cases indexes
CREATE INDEX IF NOT EXISTS idx_court_cases_loan_id ON court_cases(loan_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_borrower_id ON court_cases(borrower_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_status ON court_cases(case_status);
CREATE INDEX IF NOT EXISTS idx_court_cases_filing_date ON court_cases(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_court_cases_hearing_date ON court_cases(hearing_date);
CREATE INDEX IF NOT EXISTS idx_court_case_events_case_id ON court_case_events(court_case_id);
CREATE INDEX IF NOT EXISTS idx_court_case_events_date ON court_case_events(event_date DESC);

-- Payment splits indexes
CREATE INDEX IF NOT EXISTS idx_payment_splits_repayment_id ON payment_splits(repayment_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_date ON payment_splits(payment_date DESC);

-- Loan applications indexes for new fields
CREATE INDEX IF NOT EXISTS idx_loan_applications_contract_signed ON loan_applications(contract_signed_at) WHERE contract_signed_at IS NOT NULL;

-- ==============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS on all new tables
ALTER TABLE wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;

-- Wallet RLS Policies
DROP POLICY IF EXISTS "Users can view their own wallet" ON wallet_accounts;
CREATE POLICY "Users can view their own wallet"
  ON wallet_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all wallets" ON wallet_accounts;
CREATE POLICY "Admins can view all wallets"
  ON wallet_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- Wallet Transactions RLS
DROP POLICY IF EXISTS "Users can view their own transactions" ON wallet_transactions;
CREATE POLICY "Users can view their own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallet_accounts
      WHERE wallet_accounts.id = wallet_transactions.wallet_id
      AND wallet_accounts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
CREATE POLICY "Admins can view all transactions"
  ON wallet_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- Withdrawal Requests RLS
DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON wallet_withdrawal_requests;
CREATE POLICY "Users can view their own withdrawal requests"
  ON wallet_withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own withdrawal requests" ON wallet_withdrawal_requests;
CREATE POLICY "Users can create their own withdrawal requests"
  ON wallet_withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all withdrawal requests" ON wallet_withdrawal_requests;
CREATE POLICY "Admins can manage all withdrawal requests"
  ON wallet_withdrawal_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- Court Cases RLS (Admin only)
DROP POLICY IF EXISTS "Admins can manage court cases" ON court_cases;
CREATE POLICY "Admins can manage court cases"
  ON court_cases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'collections_officer')
    )
  );

DROP POLICY IF EXISTS "Admins can manage court case events" ON court_case_events;
CREATE POLICY "Admins can manage court case events"
  ON court_case_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'collections_officer')
    )
  );

-- Payment Splits RLS
DROP POLICY IF EXISTS "Users can view their own payment splits" ON payment_splits;
CREATE POLICY "Users can view their own payment splits"
  ON payment_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loan_repayments
      JOIN loan_applications ON loan_repayments.loan_id = loan_applications.id
      WHERE loan_repayments.id = payment_splits.repayment_id
      AND loan_applications.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all payment splits" ON payment_splits;
CREATE POLICY "Admins can manage all payment splits"
  ON payment_splits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin', 'loan_officer')
    )
  );

-- ==============================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- ==============================================

-- Trigger to update wallet_accounts.updated_at
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wallet_accounts_updated_at ON wallet_accounts;
CREATE TRIGGER wallet_accounts_updated_at
  BEFORE UPDATE ON wallet_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

DROP TRIGGER IF EXISTS wallet_withdrawal_requests_updated_at ON wallet_withdrawal_requests;
CREATE TRIGGER wallet_withdrawal_requests_updated_at
  BEFORE UPDATE ON wallet_withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

DROP TRIGGER IF EXISTS court_cases_updated_at ON court_cases;
CREATE TRIGGER court_cases_updated_at
  BEFORE UPDATE ON court_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

-- ==============================================
-- 8. VIEWS FOR EASY DATA ACCESS
-- ==============================================

-- View for wallet summary with user details
CREATE OR REPLACE VIEW wallet_summary AS
SELECT 
  wa.id,
  wa.user_id,
  p.full_name,
  p.email,
  p.phone,
  wa.available_balance,
  wa.pending_balance,
  wa.total_deposited,
  wa.total_withdrawn,
  wa.is_active,
  wa.created_at,
  wa.updated_at,
  (SELECT COUNT(*) FROM wallet_transactions WHERE wallet_id = wa.id) as transaction_count,
  (SELECT COUNT(*) FROM wallet_withdrawal_requests WHERE wallet_id = wa.id AND status = 'pending') as pending_withdrawals
FROM wallet_accounts wa
JOIN profiles p ON wa.user_id = p.id;

-- View for court cases with loan and borrower details
CREATE OR REPLACE VIEW court_cases_detailed AS
SELECT 
  cc.*,
  la.loan_amount,
  la.total_repayment,
  la.status as loan_status,
  p.full_name as borrower_name,
  p.email as borrower_email,
  p.phone as borrower_phone,
  p.nrc_number as borrower_nrc,
  (SELECT COUNT(*) FROM court_case_events WHERE court_case_id = cc.id) as event_count
FROM court_cases cc
JOIN loan_applications la ON cc.loan_id = la.id
JOIN profiles p ON cc.borrower_id = p.id;

-- ==============================================
-- 9. FUNCTIONS FOR BUSINESS LOGIC
-- ==============================================

-- Function to credit wallet (add money)
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type VARCHAR,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_processed_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before DECIMAL;
  v_balance_after DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM wallet_accounts
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallet_accounts (user_id, available_balance)
    VALUES (p_user_id, 0)
    RETURNING id, available_balance INTO v_wallet_id, v_balance_before;
  END IF;
  
  -- Calculate new balance
  v_balance_after := v_balance_before + p_amount;
  
  -- Update wallet
  UPDATE wallet_accounts
  SET 
    available_balance = v_balance_after,
    total_deposited = total_deposited + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, balance_before, balance_after,
    reference_type, reference_id, description, status, processed_by
  ) VALUES (
    v_wallet_id, p_transaction_type, p_amount, v_balance_before, v_balance_after,
    p_reference_type, p_reference_id, p_description, 'completed', p_processed_by
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to debit wallet (remove money)
CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type VARCHAR,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_processed_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before DECIMAL;
  v_balance_after DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id, available_balance INTO v_wallet_id, v_balance_before
  FROM wallet_accounts
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;
  
  -- Check sufficient balance
  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Calculate new balance
  v_balance_after := v_balance_before - p_amount;
  
  -- Update wallet
  UPDATE wallet_accounts
  SET 
    available_balance = v_balance_after,
    total_withdrawn = total_withdrawn + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id, transaction_type, amount, balance_before, balance_after,
    reference_type, reference_id, description, status, processed_by
  ) VALUES (
    v_wallet_id, p_transaction_type, p_amount, v_balance_before, v_balance_after,
    p_reference_type, p_reference_id, p_description, 'completed', p_processed_by
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 10. SEED DATA / INITIAL SETUP
-- ==============================================

-- Create wallets for existing users (optional, can be done on-demand)
INSERT INTO wallet_accounts (user_id, available_balance)
SELECT id, 0
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_accounts WHERE wallet_accounts.user_id = auth.users.id
)
ON CONFLICT DO NOTHING;

-- Add comment for tracking
COMMENT ON TABLE wallet_accounts IS 'Stores wallet/account balances for borrowers to track overpayments and available funds';
COMMENT ON TABLE court_cases IS 'Manages legal enforcement and court proceedings for defaulted loans';
COMMENT ON TABLE payment_splits IS 'Tracks split/partial payments for loan repayments';
