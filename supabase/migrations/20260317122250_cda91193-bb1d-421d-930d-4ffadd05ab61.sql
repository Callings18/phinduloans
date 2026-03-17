
-- Add parent_loan_id to loan_applications for reloan chaining
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS parent_loan_id uuid REFERENCES public.loan_applications(id);

-- Create index for fast chain lookups
CREATE INDEX IF NOT EXISTS idx_loan_applications_parent_loan_id ON public.loan_applications(parent_loan_id);

-- Create loan_events table for full audit trail of actions
CREATE TABLE public.loan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'reloan', 'top_up', 'restructure', 'disbursement', 'early_settlement', 'penalty_applied', 'payment_reversal'
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Before/after snapshots
  previous_values jsonb, -- { principal, interest_rate, term, total_repayment, monthly_payment, ... }
  new_values jsonb,      -- { principal, interest_rate, term, total_repayment, monthly_payment, ... }
  
  -- Action-specific metadata
  reason text,
  source_account_id uuid REFERENCES public.accounts(id),
  amount numeric,                -- e.g. top-up additional amount, disbursement amount
  fees_charged numeric DEFAULT 0,
  net_amount numeric,            -- amount after fees
  
  -- Linked records
  new_loan_id uuid REFERENCES public.loan_applications(id), -- for reloans: the new loan created
  document_url text,             -- auto-generated amended contract/schedule PDF
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;

-- Staff can view loan events
CREATE POLICY "Staff can view loan events"
ON public.loan_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role) OR
  has_role(auth.uid(), 'finance_officer'::app_role) OR
  has_role(auth.uid(), 'collections_officer'::app_role) OR
  has_role(auth.uid(), 'auditor'::app_role)
);

-- Staff can insert loan events
CREATE POLICY "Staff can insert loan events"
ON public.loan_events
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'loan_officer'::app_role) OR
  has_role(auth.uid(), 'credit_officer'::app_role) OR
  has_role(auth.uid(), 'finance_officer'::app_role)
);

-- Borrowers can view events on their own loans
CREATE POLICY "Borrowers can view own loan events"
ON public.loan_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id = loan_events.loan_id AND la.user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_loan_events_loan_id ON public.loan_events(loan_id);
CREATE INDEX idx_loan_events_event_type ON public.loan_events(event_type);
CREATE INDEX idx_loan_events_new_loan_id ON public.loan_events(new_loan_id);
