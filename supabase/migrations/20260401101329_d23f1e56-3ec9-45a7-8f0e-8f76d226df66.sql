
-- 1) Prevent negative repayment amount
ALTER TABLE public.loan_repayments
  ADD CONSTRAINT loan_repayments_amount_non_negative
  CHECK (amount >= 0);

-- 2) Prevent negative principal_paid
ALTER TABLE public.loan_repayments
  ADD CONSTRAINT loan_repayments_principal_paid_non_negative
  CHECK (coalesce(principal_paid, 0) >= 0);

-- 3) Keep principal_paid within original amount when original_amount exists
ALTER TABLE public.loan_repayments
  ADD CONSTRAINT loan_repayments_principal_paid_not_over_original
  CHECK (
    original_amount IS NULL
    OR coalesce(principal_paid, 0) <= original_amount
  );

-- 4) Prevent negative account balances
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_balance_non_negative
  CHECK (balance >= 0);
