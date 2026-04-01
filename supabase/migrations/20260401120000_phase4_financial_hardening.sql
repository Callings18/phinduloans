-- Phase 4 hardening: invariants + idempotency guards for critical financial operations.

-- 1) Numeric safety constraints (added as NOT VALID to avoid blocking deployment on legacy rows).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_balance_non_negative'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_balance_non_negative CHECK (balance >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_repayments_amount_non_negative'
  ) THEN
    ALTER TABLE public.loan_repayments
      ADD CONSTRAINT loan_repayments_amount_non_negative CHECK (amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_repayments_principal_paid_non_negative'
  ) THEN
    ALTER TABLE public.loan_repayments
      ADD CONSTRAINT loan_repayments_principal_paid_non_negative CHECK (COALESCE(principal_paid, 0) >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_repayments_principal_paid_not_over_amount'
  ) THEN
    ALTER TABLE public.loan_repayments
      ADD CONSTRAINT loan_repayments_principal_paid_not_over_amount CHECK (COALESCE(principal_paid, 0) <= amount) NOT VALID;
  END IF;
END $$;

-- 2) Idempotency for borrower claim submissions: one pending claim per borrower+repayment.
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_claims_pending_per_user_repayment
  ON public.payment_claims (user_id, repayment_id)
  WHERE status = 'pending';

-- 3) Idempotency for disbursement transaction references once completed.
CREATE UNIQUE INDEX IF NOT EXISTS ux_disbursements_completed_txn_reference
  ON public.disbursements (transaction_reference)
  WHERE status = 'completed' AND transaction_reference IS NOT NULL;

-- 4) Idempotency for disbursement ledger posting.
CREATE UNIQUE INDEX IF NOT EXISTS ux_account_transactions_disbursement_reference
  ON public.account_transactions (reference_id)
  WHERE transaction_type = 'disbursement' AND reference_id IS NOT NULL;

-- 5) Normalize notes visibility query pattern.
CREATE INDEX IF NOT EXISTS idx_loan_notes_visibility
  ON public.loan_notes (loan_id, is_internal, created_at DESC);
