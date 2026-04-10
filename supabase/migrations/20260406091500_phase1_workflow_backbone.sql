-- Phase 1 workflow backbone
-- Adds lifecycle transition audit table, timeline visibility, and payment claim review fields.

-- 1) Explicit transition audit table
CREATE TABLE IF NOT EXISTS public.loan_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('borrower', 'admin', 'system')),
  actor_id uuid REFERENCES auth.users(id),
  reason_code text,
  reason_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_status_transitions_loan_id
  ON public.loan_status_transitions (loan_id, created_at DESC);

ALTER TABLE public.loan_status_transitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'loan_status_transitions'
      AND policyname = 'Staff can read loan status transitions'
  ) THEN
    CREATE POLICY "Staff can read loan status transitions"
      ON public.loan_status_transitions FOR SELECT TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'loan_officer'::app_role)
        OR has_role(auth.uid(), 'credit_officer'::app_role)
        OR has_role(auth.uid(), 'finance_officer'::app_role)
        OR has_role(auth.uid(), 'collections_officer'::app_role)
        OR has_role(auth.uid(), 'auditor'::app_role)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'loan_status_transitions'
      AND policyname = 'Borrowers can read own loan status transitions'
  ) THEN
    CREATE POLICY "Borrowers can read own loan status transitions"
      ON public.loan_status_transitions FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.loan_applications la
          WHERE la.id = loan_status_transitions.loan_id
            AND la.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 2) Timeline visibility column for borrower/admin scopes
ALTER TABLE public.loan_events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'both'
  CHECK (visibility IN ('borrower', 'admin', 'both'));

CREATE INDEX IF NOT EXISTS idx_loan_events_visibility ON public.loan_events(visibility);

-- 3) Payment claim handshake fields
ALTER TABLE public.payment_claims
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD COLUMN IF NOT EXISTS decision_reason_code text;

-- Expand state model while staying backward-compatible
DO $$
BEGIN
  ALTER TABLE public.payment_claims
    DROP CONSTRAINT IF EXISTS payment_claims_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.payment_claims
  ADD CONSTRAINT payment_claims_status_check
  CHECK (status IN ('pending', 'pending_review', 'needs_more_info', 'approved', 'verified', 'rejected'));

-- Prevent duplicate pending claims for same repayment/user
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_claims_unique_pending
  ON public.payment_claims (repayment_id, user_id)
  WHERE status IN ('pending', 'pending_review', 'needs_more_info');
