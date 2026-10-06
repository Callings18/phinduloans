-- Create accounts table for capital management (bank accounts, wallets, etc.)
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank', -- bank, mobile_money, cash, petty_cash
  account_number TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create account transactions for tracking all money movements
CREATE TABLE public.account_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- deposit, withdrawal, transfer_in, transfer_out, disbursement, repayment
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  source TEXT, -- where money came from (for deposits)
  destination TEXT, -- where money went (for withdrawals)
  reference_type TEXT, -- loan, expense, transfer, capital_injection
  reference_id UUID, -- link to loan_id, expense_id, or transfer pair
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table based on user reference
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_category TEXT NOT NULL, -- origination, collection, legal, overhead, marketing, salaries, utilities, rent, other
  amount NUMERIC NOT NULL,
  vendor_payee TEXT NOT NULL,
  description TEXT,
  loan_id UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  branch TEXT,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- cash, bank_transfer, petty_cash, mobile_money
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, paid, rejected
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Accounts policies
DROP POLICY IF EXISTS "Staff can view accounts" ON public.accounts;
CREATE POLICY "Staff can view accounts"
ON public.accounts FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

DROP POLICY IF EXISTS "Admins can manage accounts" ON public.accounts;
CREATE POLICY "Admins can manage accounts"
ON public.accounts FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Account transactions policies
DROP POLICY IF EXISTS "Staff can view transactions" ON public.account_transactions;
CREATE POLICY "Staff can view transactions"
ON public.account_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

DROP POLICY IF EXISTS "Staff can insert transactions" ON public.account_transactions;
CREATE POLICY "Staff can insert transactions"
ON public.account_transactions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

-- Expenses policies
DROP POLICY IF EXISTS "Staff can view expenses" ON public.expenses;
CREATE POLICY "Staff can view expenses"
ON public.expenses FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer') OR has_role(auth.uid(), 'loan_officer'));

DROP POLICY IF EXISTS "Staff can insert expenses" ON public.expenses;
CREATE POLICY "Staff can insert expenses"
ON public.expenses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

DROP POLICY IF EXISTS "Staff can update expenses" ON public.expenses;
CREATE POLICY "Staff can update expenses"
ON public.expenses FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_officer'));

DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
CREATE POLICY "Admins can delete expenses"
ON public.expenses FOR DELETE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();