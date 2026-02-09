-- Phase 2.1: Multi-level approval workflow columns + loan_notes table
-- loan_applications: document_verified_by, document_verified_at, finance_verified_by, finance_verified_at, disbursed_by, approval_stage
-- loan_notes: id, loan_id, user_id, note, type (internal | borrower_visible), created_at

-- 1. Add columns to loan_applications
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS document_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finance_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finance_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_stage TEXT;

COMMENT ON COLUMN public.loan_applications.document_verified_by IS 'User who verified documents (loan officer)';
COMMENT ON COLUMN public.loan_applications.document_verified_at IS 'When documents were verified';
COMMENT ON COLUMN public.loan_applications.finance_verified_by IS 'User who approved finance (accounts officer)';
COMMENT ON COLUMN public.loan_applications.finance_verified_at IS 'When finance was approved';
COMMENT ON COLUMN public.loan_applications.disbursed_by IS 'User who performed disbursement';
COMMENT ON COLUMN public.loan_applications.approval_stage IS 'Workflow stage: submitted, under_review, documents_verified, finance_approved, approved, contract_signing, disbursed, active, completed';

-- 2. loan_notes table
CREATE TABLE IF NOT EXISTS public.loan_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal' CHECK (type IN ('internal', 'borrower_visible')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_notes_loan_id ON public.loan_notes(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_notes_created_at ON public.loan_notes(created_at);

ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;

-- Staff (any role in user_roles) can read all notes; borrowers can read only borrower_visible for their loans
CREATE POLICY "Staff can view all loan notes"
  ON public.loan_notes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Borrowers can view borrower_visible notes for their loans"
  ON public.loan_notes FOR SELECT TO authenticated
  USING (
    type = 'borrower_visible'
    AND EXISTS (
      SELECT 1 FROM public.loan_applications la
      WHERE la.id = loan_notes.loan_id AND la.user_id = auth.uid()
    )
  );

-- Only staff can insert/update/delete (use permission or role check)
CREATE POLICY "Staff can insert loan notes"
  ON public.loan_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Staff can update loan notes"
  ON public.loan_notes FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Staff can delete loan notes"
  ON public.loan_notes FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

COMMENT ON TABLE public.loan_notes IS 'Internal and borrower-visible notes on loan applications; RLS restricts borrowers to borrower_visible only for their loans';
